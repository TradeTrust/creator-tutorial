import { CHAIN_ID, SUPPORTED_CHAINS, v5ContractAddress, v5Contracts } from "@trustvc/trustvc";
import { utils as v5Utils } from "@trustvc/trustvc/token-registry-v5";
import { ethers, Wallet } from "ethers";
import { writeEnvVariable } from "./utils";

const main = async () => {
    const chainId: CHAIN_ID = process.env.NET as CHAIN_ID ?? CHAIN_ID.stabilitytestnet;

    const unconnectedWallet = new Wallet(process.env.WALLET_PRIVATE_KEY!);
    const provider = new ethers.JsonRpcProvider(SUPPORTED_CHAINS[chainId].rpcUrl);
    const wallet = unconnectedWallet.connect(provider);
    const walletAddress = await wallet.getAddress();

    const { TDocDeployer__factory } = v5Contracts;

    const { TokenImplementation, Deployer } = v5ContractAddress;
    const deployerContract = TDocDeployer__factory.connect(Deployer[chainId], wallet);
    const initParam = v5Utils.encodeInitParams({
        name: "DemoTokenRegistry",
        symbol: "DTR",
        deployer: walletAddress,
    });

    const tx = await deployerContract.deploy(TokenImplementation[chainId], initParam);
    const receipt = await tx.wait();

    let registryAddress;
    if (ethers.version.includes("/5.")) {
        registryAddress = v5Utils.getEventFromReceipt<any>(
            receipt,
            (deployerContract as any).getEventTopic("Deployment"),
            deployerContract.interface
        ).args.deployed;
    } else if (ethers.version.startsWith("6.")) {
        registryAddress = v5Utils.getEventFromReceipt<any>(
            receipt,
            "Deployment",
            deployerContract.interface
        ).args.deployed;
    } else {
        throw new Error("Unsupported ethers version");
    }

    console.log(`Contract Address: ${registryAddress}`);
    console.log(`Transaction: ${JSON.stringify(receipt, null, 2)}`);

    // write registryAddress to .env file as TOKEN_REGISTRY_ADDRESS key
    writeEnvVariable('TOKEN_REGISTRY_ADDRESS', registryAddress);
};
main();
