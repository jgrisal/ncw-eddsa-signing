# NCW - Example of signing EdDSA Transactions

This repo aims to provide a compact way to perform signatures fore Fireblocks EdDSA extended keys.

## Limitations

- Currently, in this repo we only support SOL (and SOL_TEST) transactions.

## Requirements

To use this repo you will need:

1. An `fprv` key for which there exists a SOL or SOL_TEST account. Note that the `fprv` is akin to the `xprv` the extended key from which all keys are derived. Within Fireblocks `fprv` is used for EdDSA assets.

2. A SOL (or other supported asset) account with a balance in it.

3. Node (18 and above).

## How to run

Simply follow these three steps:

1. Run: `npm i`
2. Run: `npm start`
3. Follow the instructions
