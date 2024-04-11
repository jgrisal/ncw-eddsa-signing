import inquirer from "inquirer";
import { SolanaWallet } from "./wallets";

const FPRV_INPUT = "fprv_input";
const NETWORK = "network";
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
      name: NETWORK,
      type: "list",
      choices: ["devnet", "mainnet"],
      default: "devnet",
      message: "Please specify the network you'd like to use",
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
          return parseFloat(input) > 0
            ? true
            : "Please provide a positive value to transfer";
        } catch (e) {
          return "Please provide a positive value";
        }
      },
    },
  ]);

  const isTestnet = answers[NETWORK] === "devnet";
  const wallet = new SolanaWallet(answers[FPRV_INPUT] as string, isTestnet);

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
