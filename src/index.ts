import ngrok from "@ngrok/ngrok";
import { CHAIN_ID, encrypt, getTokenId, signW3C, SUPPORTED_CHAINS } from "@trustvc/trustvc";
import { TradeTrustToken__factory } from "@trustvc/trustvc/token-registry-v5/contracts";
import { CredentialSubjects } from "@trustvc/trustvc/w3c/vc";
import dotenv from "dotenv";
import { ethers, Wallet } from "ethers";
import express, { Express, NextFunction, Request, Response } from "express";
import fs from "fs";
import path from "path";


dotenv.config();

const app: Express = express();
const port = process.env.PORT || 3000;

// Add middleware to parse JSON bodies
app.use(express.json({ limit: '50mb' }));
// CORS allow all
app.use((req, res, next) => {
  res.header('Access-Control-Allow-Origin', '*');
  res.header('Access-Control-Allow-Headers', 'Origin, X-Requested-With, Content-Type, Accept');
  next();
});

app.get("/.well-known/did.json", (req: Request, res: Response, next: NextFunction) => {
  try {
    const didJsonPath = path.join(__dirname, "../did.json");
    const didJson = fs.readFileSync(didJsonPath, "utf-8");
    res.json(JSON.parse(didJson));
  } catch (error) {
    console.error(error);
    next(error);
  }
});

const SUPPORTED_DOCUMENT: {
  [key: string]: string;
} = {
  BILL_OF_LADING: "https://trustvc.io/context/bill-of-lading.json",
  // "INVOICE": "https://trustvc.io/context/invoice.json",
  // "CERTIFICATE_OF_ORIGIN": "https://trustvc.io/context/coo.json"
}

app.post("/create/:documentId", async (req: Request, res: Response, next: NextFunction) => {
  try {
    let { documentId } = req.params;
    documentId = documentId?.toUpperCase() || '';

    // Validate documentId
    if (!SUPPORTED_DOCUMENT[documentId]) {
      throw new Error('Document not supported');
    }

    const { credentialSubject, owner, holder, remarks } = req.body as {
      credentialSubject: CredentialSubjects,
      owner: string,
      holder: string,
      remarks: string
    };

    if (!process.env.WALLET_PRIVATE_KEY) {
      throw new Error('Wallet private key not found in environment variables');
    }

    if (!process.env.DID_KEY_PAIRS) {
      throw new Error('DID key pairs not found in environment variables');
    }

    if (!process.env.TOKEN_REGISTRY_ADDRESS) {
      throw new Error('Token registry address not found in environment variables');
    }

    // Get environment variables
    const SYSTEM_TOKEN_REGISTRY_ADDRESS = process.env.TOKEN_REGISTRY_ADDRESS;
    const CHAINID: CHAIN_ID = process.env.NET as CHAIN_ID ?? CHAIN_ID.amoy;
    const CHAININFO = SUPPORTED_CHAINS[CHAINID];
    // Remove escaped characters before parsing
    const cleanedJsonString = process.env.DID_KEY_PAIRS.replace(/\\(?=["])/g, '');
    const DID_KEY_PAIRS = JSON.parse(cleanedJsonString);

    // Prepare the document
    const issuanceDate = new Date();
    const expirationDate = new Date();
    expirationDate.setMonth(expirationDate.getMonth() + 3);
    const document = {
      "@context": [
        "https://www.w3.org/2018/credentials/v1",
        "https://w3id.org/security/bbs/v1",
        "https://trustvc.io/context/transferable-records-context.json",
        "https://trustvc.io/context/render-method-context.json",
        "https://trustvc.io/context/attachments-context.json",
        SUPPORTED_DOCUMENT[documentId],
      ],
      type: ["VerifiableCredential"],
      "credentialStatus": {
        "type": "TransferableRecords",
        "tokenNetwork": {
          "chain": CHAININFO.currency,
          "chainId": CHAINID
        },
        "tokenRegistry": SYSTEM_TOKEN_REGISTRY_ADDRESS,
      },
      "renderMethod": [
        {
          "id": "https://generic-templates.tradetrust.io",
          "type": "EMBEDDED_RENDERER",
          "templateName": documentId
        }
      ],
      credentialSubject,
      "issuanceDate": issuanceDate.toISOString(),
      "expirationDate": expirationDate.toISOString(),
      "issuer": DID_KEY_PAIRS.id?.split('#')?.[0],
    }

    // Sign the document
    const { error, signed: signedW3CDocument } = await signW3C(document, DID_KEY_PAIRS);
    if (error) {
      throw new Error(error);
    }

    // Issue the document on chain:
    const tokenId = getTokenId(signedW3CDocument!);
    const unconnectedWallet = new Wallet(process.env.WALLET_PRIVATE_KEY!);
    let provider;
    if (ethers.version.startsWith('6.')) {
      provider = new (ethers as any).JsonRpcProvider(CHAININFO.rpcUrl);
    } else if (ethers.version.includes('/5.')) {
      provider = new (ethers as any).providers.JsonRpcProvider(CHAININFO.rpcUrl);
    }
    const wallet = unconnectedWallet.connect(provider);
    const tokenRegistry = new ethers.Contract(
      SYSTEM_TOKEN_REGISTRY_ADDRESS,
      TradeTrustToken__factory.abi,
      wallet
    );

    // Encrypt remarks
    const encryptedRemarks = remarks && encrypt(remarks ?? '', signedW3CDocument?.id!) || '0x'

    // mint the document
    try {
      const mintTx = await tokenRegistry.mint.staticCall(owner, holder, tokenId, encryptedRemarks);
    } catch (error) {
      console.error(error);
      throw new Error('Failed to mint token');
    }
    let tx;
    // query gas station
    if (CHAININFO.gasStation) {
      const gasFees = await CHAININFO.gasStation();
      console.log('gasFees', gasFees);

      tx = await tokenRegistry.mint(owner, holder, tokenId, encryptedRemarks, {
        maxFeePerGas: gasFees!.maxFeePerGas?.toBigInt() ?? 0,
        maxPriorityFeePerGas: gasFees!.maxPriorityFeePerGas?.toBigInt() ?? 0,
      });
    } else {
      tx = await tokenRegistry.mint(owner, holder, tokenId, encryptedRemarks);
    }

    // Long polling for the transaction to be mined, can be optimized to skip the wait for transaction to be confirmed in 1 block
    const receipt = await tx.wait()
    console.log(`Document ${documentId} minted on tx hash ${receipt?.hash}`);

    return res.json({
      signedW3CDocument: signedW3CDocument,
      txHash: tx.hash,
    });
  } catch (error) {
    console.error(error);
    next(error);
  }
});

// Global error handling middleware
app.use((err: Error, req: Request, res: Response, next: NextFunction) => {
  console.error({ 'error:': err, 'req.url': req.url });
  res.status(500).json({
    error: {
      message: 'Internal server error',
      ...(process.env.NODE_ENV === 'development' ? { stack: err.stack } : {})
    }
  });
});

app.listen(port, () => {
  console.log(`[server]: Server is running at http://localhost:${port}`);
});

(async function () {
  if (process.env.NGROK_AUTHTOKEN) {
    ngrok.connect({ addr: port, authtoken_from_env: true, hostname: process.env.DOMAIN, host_header: 'rewrite', })
      .then(listener => console.log(`[ngrok]: Ingress established at: ${listener.url()}`));
  }
})();