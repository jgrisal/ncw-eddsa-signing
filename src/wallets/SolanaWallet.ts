import * as web3 from "@solana/web3.js";
import { EdDSAWallet } from "./EdDSAWallet";

/**
 * A class for generating a transfer transaction for SOL.
 * The classes uses Solana's SDK to perform operations.
 */
export class SolanaWallet extends EdDSAWallet {
  private solConn: web3.Connection;

  constructor(fprv: string, private isTestnet: boolean) {
    super(fprv, isTestnet ? "SOL_TEST" : "SOL");

    // Setup endpoint for communication
    const endpoint = isTestnet
      ? web3.clusterApiUrl("devnet")
      : web3.clusterApiUrl("mainnet-beta");
    this.solConn = new web3.Connection(endpoint);
  }

  /**
    * Creates a transfer from solana derivation account to desired destinaion account 
    */
  public async transfer(dest: String, amount: number): Promise<string> {
    // Load private key
    const from = new web3.PublicKey(
      Buffer.from(this.publicKey.replace("0x", ""), "hex")
    );

    // Prepare target
    const to = new web3.PublicKey(dest);

    console.log(
      `Going to transfer ${amount} ${this.isTestnet ? "SOL_TEST" : "SOL"
      } from ${from.toBase58()} to ${to.toBase58()}`
    );

    // Create transaction
    console.log("Fetching latest block and generating a transaction");
    const latestBlockHash = await this.solConn.getLatestBlockhash();
    const tx = new web3.Transaction({
      feePayer: from,
      recentBlockhash: latestBlockHash.blockhash,
    }).add(
      web3.SystemProgram.transfer({
        fromPubkey: from,
        toPubkey: to,
        lamports: amount * web3.LAMPORTS_PER_SOL,
      })
    );

    // Sign and store signature in tx
    console.log("Signing and appending signature to transaction.");
    const sig = await this.sign(tx.serializeMessage());
    tx.addSignature(from, sig as Buffer);

    // Broadcast
    console.log("Broadcasting transaction.");
    const hash = await this.solConn.sendRawTransaction(tx.serialize());
    return hash;
  }

  /**
   * Creates a stake account operation and delegates it to a non-delinquent validator.
   */
  public async createStakeAccountAndDelegate(amount: number): Promise<string> {
    const from = new web3.PublicKey(Buffer.from(this.publicKey.replace("0x", ""), "hex"));
    const stakeAccount = web3.Keypair.generate();

    // Step 1: Create and Initialize Stake Account
    const latestBlockHash1 = await this.solConn.getLatestBlockhash();
    const initTx = new web3.Transaction({
      feePayer: from,
      recentBlockhash: latestBlockHash1.blockhash,
    }).add(
      web3.SystemProgram.createAccount({
        fromPubkey: from,
        newAccountPubkey: stakeAccount.publicKey,
        lamports: amount * web3.LAMPORTS_PER_SOL,
        space: web3.StakeProgram.space,
        programId: web3.StakeProgram.programId,
      }),
      web3.StakeProgram.initialize({
        stakePubkey: stakeAccount.publicKey,
        authorized: new web3.Authorized(from, from),
        lockup: new web3.Lockup(0, 0, from),
      })
    );

    initTx.partialSign(stakeAccount); // Firmar con la cuenta de stake
    initTx.addSignature(from, await this.sign(initTx.serializeMessage()) as Buffer);

    console.log("Broadcasting transaction to create and initialize stake account.");
    const createStakeAccountHash = await this.solConn.sendRawTransaction(initTx.serialize(), { skipPreflight: false });
    console.log(`Stake account created and initialized with transaction hash: ${createStakeAccountHash}`);

    // Verify Stake Account creation Before Proceed
    await this.solConn.confirmTransaction(createStakeAccountHash);

    // Step 2: Delegate Stake to Non-Delinquest Validator
    console.log("Fetching non-delinquent validators.");
    const validators = await this.solConn.getVoteAccounts();
    const nonDelinquentValidators = validators.current
      .filter(v => !v.delinquent)
      .map(v => v.votePubkey);

    if (nonDelinquentValidators.length === 0) {
      throw new Error("No non-delinquent validators found.");
    }
    const validatorPubkey = new web3.PublicKey(nonDelinquentValidators[0]);

    const latestBlockHash2 = await this.solConn.getLatestBlockhash();
    const delegateTx = new web3.Transaction({
      feePayer: from,
      recentBlockhash: latestBlockHash2.blockhash,
    }).add(
      web3.StakeProgram.delegate({
        stakePubkey: stakeAccount.publicKey,
        authorizedPubkey: from,
        votePubkey: validatorPubkey,
      })
    );

    delegateTx.addSignature(from, await this.sign(delegateTx.serializeMessage()) as Buffer);

    console.log("Broadcasting transaction to delegate stake.");
    const delegateHash = await this.solConn.sendRawTransaction(delegateTx.serialize(), { skipPreflight: false });
    console.log(`Stake delegated with transaction hash: ${delegateHash}`);

    return delegateHash;
  }

  /**
  * Create deactivate stake operation in an active delegated stake account
  */
  public async deactivateStake(stakeAccountPubkey: string): Promise<string> {
    const from = new web3.PublicKey(Buffer.from(this.publicKey.replace("0x", ""), "hex"));
    const stakeAccount = new web3.PublicKey(stakeAccountPubkey);  // Convert to PublicKey

    // Get last blockhash for execute transaction
    const latestBlockHash = await this.solConn.getLatestBlockhash();

    // Create operation for deactivate stake
    const deactivateTx = new web3.Transaction({
      feePayer: from,
      recentBlockhash: latestBlockHash.blockhash,
    }).add(
      web3.StakeProgram.deactivate({
        stakePubkey: stakeAccount,
        authorizedPubkey: from,
      })
    );

    // Sign transaction with eddsa derived private key
    deactivateTx.addSignature(from, await this.sign(deactivateTx.serializeMessage()) as Buffer);

    // Send transaction request operation for deactivate stake
    console.log("Broadcasting transaction to deactivate stake.");
    const deactivateHash = await this.solConn.sendRawTransaction(deactivateTx.serialize(), { skipPreflight: false });
    console.log(`Stake deactivated with transaction hash: ${deactivateHash}`);

    // Confirm that the transaction was successful
    await this.solConn.confirmTransaction(deactivateHash);
    console.log("Stake deactivation confirmed.");

    return deactivateHash;
  }

  /**
  * Create withdraw stake operation in an undelegated stake account
  */

  public async withdrawStake(stakeAccountPubkey1: string, destinationPubkey: string, amount: number): Promise<string> {
    const from = new web3.PublicKey(Buffer.from(this.publicKey.replace("0x", ""), "hex"));
    const stakeAccount = new web3.PublicKey(stakeAccountPubkey1);
    const destinationAccount = new web3.PublicKey(destinationPubkey);

    // Proceed with withdrawal if deactivation check passes
    const latestBlockHash = await this.solConn.getLatestBlockhash();
    const withdrawTx = new web3.Transaction({
      feePayer: from,
      recentBlockhash: latestBlockHash.blockhash,
    }).add(
      web3.StakeProgram.withdraw({
        stakePubkey: stakeAccount,
        authorizedPubkey: from,
        toPubkey: destinationAccount,
        lamports: amount * web3.LAMPORTS_PER_SOL,
      })
    );

    withdrawTx.addSignature(from, await this.sign(withdrawTx.serializeMessage()) as Buffer);
    console.log("Broadcasting transaction to withdraw stake.");
    const withdrawHash = await this.solConn.sendRawTransaction(withdrawTx.serialize(), { skipPreflight: false });
    console.log(`Stake withdrawn with transaction hash: ${withdrawHash}`);

    await this.solConn.confirmTransaction(withdrawHash);
    console.log("Stake withdrawal confirmed.");

    return withdrawHash;
  }

}
