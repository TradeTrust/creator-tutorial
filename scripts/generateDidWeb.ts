import { generateKeyPair, issueDID, VerificationType } from "@trustvc/trustvc/w3c/issuer";
import { writeFileSync } from "fs";
import { join } from "path";
import { writeEnvVariable } from "./utils";
import { ethers } from "ethers";

const main = async () => {
    console.log('ethers.version', ethers.version);
    console.log('process.env.DOMAIN', process.env.DOMAIN)
    const keyPair = await generateKeyPair({
        type: VerificationType.Bls12381G2Key2020
    });
    console.log('keyPair: ', keyPair);
    const issuedDidWeb = await issueDID({
        domain: process.env.DOMAIN,
        ...keyPair
    });
    console.log('issuedDidWeb: ', JSON.stringify(issuedDidWeb, null, 2));

    // Write the wellKnownDid to a JSON file
    const outputPath = join(process.cwd());
    writeFileSync(
        join(outputPath, 'did.json'),
        JSON.stringify(issuedDidWeb.wellKnownDid, null, 2)
    );
    console.log('DID document has been written to ./did.json');

    // write issuedDidWeb.didKeyPairs into .env as DID_KEY_PAIRS key
    writeEnvVariable('DID_KEY_PAIRS', JSON.stringify(issuedDidWeb.didKeyPairs));
}
main();
