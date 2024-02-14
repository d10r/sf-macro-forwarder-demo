const { ethers } = require("ethers");
const sfMeta = require("@superfluid-finance/metadata")
const sfAbis = require("@superfluid-finance/ethereum-contracts/build/bundled-abi");
const MacroForwarderAbi = require("@superfluid-finance/ethereum-contracts/build/truffle/MacroForwarder.json").abi;

const privKey = process.env.PRIVKEY;
if (!privKey) throw "missing PRIVKEY env var";

const rpcUrl = process.env.RPC;
if (!rpcUrl) throw "missing RPC env var";

// default contract addr for rc1 of the forwarder
const macroFwdAddr = process.env.MACROFWD_ADDR || "0xFd017DBC8aCf18B06cff9322fA6cAae2243a5c95";

// for optimism-sepolia: 0x997b37Fb47c489CF067421aEeAf7Be0543fA5362
const macroAddr = process.env.MACRO_ADDR;

// Super Token address - if not defined, it defaults to the native super token wrapper of the connected chain
let tokenAddr = process.env.TOKEN_ADDR;

let network;

function batchCreateFlows(signer, host, tokenAddr, flowRate, receiverAddrs) {
    const cfaV1Iface = new ethers.Interface(sfAbis.IConstantFlowAgreementV1);

    return host.connect(signer).batchCall(
        receiverAddrs.map(receiver => ({
            operationType: 201, // call agreement
            target: network.contractsV1.cfaV1,
            data: ethers.AbiCoder.defaultAbiCoder().encode(
                ["bytes", "bytes"],
                [
                    cfaV1Iface.encodeFunctionData(
                        "createFlow",
                        [tokenAddr, receiver, flowRate, "0x"]
                    ),
                    "0x", // user data
                ]
            ),
        })),
    );
}

function batchDeleteFlows(signer, host, tokenAddr, sender, receiverAddrs) {
    const cfaV1Iface = new ethers.Interface(sfAbis.IConstantFlowAgreementV1);

    return host.connect(signer).batchCall(
        receiverAddrs.map(receiver => ({
            operationType: 201, // call agreement
            target: network.contractsV1.cfaV1,
            data: ethers.AbiCoder.defaultAbiCoder().encode(
                ["bytes", "bytes"],
                [
                    cfaV1Iface.encodeFunctionData(
                        "deleteFlow",
                        [tokenAddr, sender, receiver, "0x"]
                    ),
                    "0x", // user data
                ]
            ),
        })),
    );
}

function macroDeleteFlows(signer, macroFwd, macroAddr, tokenAddr, receiverAddrs) {
    return macroFwd.connect(signer).runMacro(
        macroAddr,
        ethers.AbiCoder.defaultAbiCoder().encode(
            ["address", "address[]"],
            [tokenAddr, receiverAddrs]
        )
    );
}

async function run() {
    const provider = new ethers.JsonRpcProvider(rpcUrl);
    const chainId = parseInt((await provider.getNetwork()).chainId);
    console.log(`init: connected to network via RPC ${rpcUrl} with chainId ${chainId} at ${new Date()}`);

    network = sfMeta.getNetworkByChainId(chainId);
    if (!network) throw `no network found for chainId ${chainId}`;
    console.log(`init: network ${network.name}`);

    const wallet = new ethers.Wallet(privKey);
    const signer = wallet.connect(provider);

    console.log(`init: signer account: ${signer.address}`);

    const macroFwd = new ethers.Contract(macroFwdAddr, MacroForwarderAbi, provider);
    const host = new ethers.Contract(network.contractsV1.host, sfAbis.ISuperfluid, provider);

    const receivers = [
        "0xef3c00d768e978e6680deb47ca6858f4a7654155",
        "0xa67ff89475892a18f724bd29fca5a94baf4a87f9",
        "0xb166fa64f2f9d69d83bfcbc73e2ea227ded9b02b",
        "0xa165296704ee866041f68911a87ce340091ca363",
        "0x24d262c6fe5376c31c0184358183fa1839e279be"
    ];

    // check balance
    tokenAddr = tokenAddr || network.nativeTokenWrapper;
    console.log(`using SuperToken: ${tokenAddr}`);
    const token = new ethers.Contract(tokenAddr, sfAbis.IERC20, signer);
    const balance = await token.balanceOf(signer.address);
    console.log(`signer token balance: ${balance.toString()}`);

    if (!process.env.SKIP_CREATE) {
        const createTx = await batchCreateFlows(signer, host, tokenAddr, "1000000000", receivers);
        console.log(`+++ waiting for create tx ${createTx.hash}`);
        const createReceipt = await createTx.wait();
        console.log(`+++ receipt: ${JSON.stringify(createReceipt)}`);
    }

    const deleteTx = macroAddr ?
        await macroDeleteFlows(signer, macroFwd, macroAddr, tokenAddr, receivers) :
        await batchDeleteFlows(signer, host, tokenAddr, signer.address, receivers);
    console.log(`+++ waiting for delete tx ${deleteTx.hash}`);
    const deleteReceipt = await deleteTx.wait();
    console.log(`+++ receipt: ${JSON.stringify(deleteReceipt)}`);
}

run();
