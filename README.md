# About

This is a quick'n dirty demo app for showcasing the Superfluid [MacroForwarder](https://github.com/superfluid-finance/protocol-monorepo/pull/1786).
It uses the `MultiFlowDeleteMacro` included in the [testsuite for that PR](https://github.com/superfluid-finance/protocol-monorepo/pull/1786/files#diff-958c10aa36a4d6d70592e1d02765c3228cb3733b4ab961df1db34c61ce142fe7).

If run, it first creates a CFA flow to 5 addresses (random addresses, hardcoded in the script), using `host.batchCall()`.
Then it deletes those 5 streams in another transaction:
* If run with env var `MACRO_ADDR` set, it deletes them using the macro by calling `MacroForwarder.runMacro()`
* If run without that env var, it uses `host.batchCall`

On L2s where L1 calldata is very expensive relative to L2 gas, the macro variant considerably reduces tx cost, because that tx takes less calldata.

As an example, compare this 2 delete transactions made on optimism-sepolia:
* [With batchCall](https://sepolia-optimism.etherscan.io/tx/0x367ce32d356f5aae703113714c7b43e6d9fd05df7f8a0eb7872275cf70e94d58): tx fee 0.041 mETH
* [With runMacro](https://sepolia-optimism.etherscan.io/tx/0xf70e7b32646e2b4f4efd06240d9d3b26c927438ba945b77d0bc800768eb77376):  tx fee 0.012 mETH

# Run

After checking out, run `yarn install`.
At the time of writing, a github npm package of @superfluid-finance/ethereum-contracts is used, which requires github npm registry auth set up:
```
$ cat .npmrc
@superfluid-finance:registry=https://npm.pkg.github.com
//npm.pkg.github.com/:_authToken=YOUR_GH_TOKEN_HERE
```

Then
```
[MACRO_ADDR=...] [TOKEN_ADDR=...] PRIVKEY=... RPC=... node app.js
```

RPC must point to an RPC with Superfluid and the MacroForwarder deployed (at the time of writing, that's only optimism-sepolia).
MACRO_ADDR for the test run shown above is [0x997b37Fb47c489CF067421aEeAf7Be0543fA5362](https://sepolia-optimism.etherscan.io/address/0x997b37Fb47c489CF067421aEeAf7Be0543fA5362).
TOKEN_ADDR must be a SuperToken. If unset, the native-asset SuperToken wrapper is used.

The sender account (specified by PRIVKEY) must have native coins (for tx fees) and the specified SuperToken (or native-asset SuperTokens if not set) in order to create flows. Only a small amount (0.01 or so) of SuperTokens is needed.

Reminder: leave MACRO_ADDR unset in order to delete with batchCall.
