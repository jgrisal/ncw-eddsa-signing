import inquirer from "inquirer";
import { SolanaWallet } from "./wallets";

const FPRV_INPUT = "fprv_input";
const TESTNET = "testnet";
const DEST_ADDR = "dest";
const AMOUNT = "amount";

async function start() {
  const answers = await inquirer.prompt([
    {
      name: FPRV_INPUT,
      type: "input",
      message: "Please provide the FPRV to use",
      validate: (input, answers) =>
        input.startsWith("fprv") ? true : "Key must start with fprv",
    },
    {
      name: TESTNET,
      type: "confirm",
      message: "Please specify if you'd like to use testnet\\devnet",
    },
    {
      name: DEST_ADDR,
      type: "input",
      message: "Please provide destination address",
    },
    {
      name: AMOUNT,
      type: "input",
      message: "Please provide the amount to transfer",
      validate: (input, answers) => {
        try {
          return parseInt(input) <= 0
            ? "Please provide a positive value to transfer"
            : true;
        } catch (e) {
          return "Please provide a positive value";
        }
      },
    },
  ]);

  const wallet = new SolanaWallet(
    answers[FPRV_INPUT] as string,
    answers[TESTNET] as boolean
  );

  const txHash = await wallet.transfer(
    answers[DEST_ADDR],
    answers[AMOUNT] as number
  );

  console.log(`Transaction hash: ${txHash}`);
}

(async () => start())().catch((err) => {
  console.error("Caught failure: ", err);
  console.log(JSON.stringify(err, null, 2));
});
