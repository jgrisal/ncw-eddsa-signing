import inquirer from "inquirer";
import { SolanaWallet } from "./wallets";

const FPRV_INPUT = "fprv_input";
const NETWORK = "network";
const DEST_ADDR = "dest";
const AMOUNT = "amount";
const STAKE_ACCOUNT_PUB_KEY = "StakeAccountPubkey";
const STAKE_ACCOUNT_PUB_KEY_W = "StakeAccountPubkeyW";
const WITHDRAW_ACCOUNT_PUB_KEY_W = "destinationPubkey";
const OPERATION = "operation";

async function start() {
  const answers = await inquirer.prompt([
    {
      name: FPRV_INPUT,
      type: "input",
      message: "Please provide the FPRV to use",
      validate: (input) => input.startsWith("fprv") ? true : "Key must start with fprv",
    },
    {
      name: NETWORK,
      type: "list",
      choices: ["devnet", "mainnet"],
      default: "devnet",
      message: "Please specify the network you'd like to use",
    },
    {
      name: OPERATION,
      type: "list",
      choices: ["transfer", "stake", "unstake", "withdraw"],
      message: "Select an operation",
    },
    {
      name: DEST_ADDR,
      type: "input",
      message: "Please provide destination address",
      when: (answers) => answers[OPERATION] !== "stake" && "unstake", // Stake operation does not need a destination address
    },
    {
      name: AMOUNT,
      type: "input",
      message: "Please provide the amount",
      when: (answers) => answers[OPERATION] !== "unstake",
      validate: (input) => parseFloat(input) > 0 ? true : "Please provide a positive value",
    },
    {
      name: STAKE_ACCOUNT_PUB_KEY,
      type: "input",
      message: "Please provide the Stake Account Pub key",
      when: (answers) => answers[OPERATION] == "unstake",
    },
    {
      name: STAKE_ACCOUNT_PUB_KEY_W,
      type: "input",
      message: "Please provide the Stake Account Pub key",
      when: (answers) => answers[OPERATION] == "withdraw",
    },
    {
      name: WITHDRAW_ACCOUNT_PUB_KEY_W,
      type: "input",
      message: "Please provide the withdraw Account Pub key",
      when: (answers) => answers[OPERATION] == "withdraw",
    },
  ]);

  const isTestnet = answers[NETWORK] === "devnet";
  const wallet = new SolanaWallet(answers[FPRV_INPUT] as string, isTestnet);

  switch (answers[OPERATION]) {
    case "transfer":
      const txHash = await wallet.transfer(answers[DEST_ADDR], answers[AMOUNT] as number);
      console.log(`Transaction hash: ${txHash}`);
      break;

    case "stake":
      const stakeHash = await wallet.createStakeAccountAndDelegate(answers[AMOUNT] as number);
      console.log(`Staking transaction hash: ${stakeHash}`);
      break;

    case "unstake":
      const stakeAccountPubkey = await wallet.deactivateStake(answers[STAKE_ACCOUNT_PUB_KEY] as string);
      console.log(`Unstake transaction hash: ${stakeAccountPubkey}`);
      break;

    case "withdraw":
      const withdrawHash = await wallet.withdrawStake(
        answers[STAKE_ACCOUNT_PUB_KEY_W] as string,
        answers[WITHDRAW_ACCOUNT_PUB_KEY_W] as string,
        parseFloat(answers[AMOUNT] as string)
      );
      console.log(`Withdraw transaction hash: ${withdrawHash}`);
      break;

    default:
      console.error("Invalid operation selected");
  }
}

(async () => start())().catch((err) => {
  console.error("Caught failure: ", err);
  console.log(JSON.stringify(err, null, 2));
});
