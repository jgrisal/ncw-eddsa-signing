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

  public async transfer(dest: String, amount: number): Promise<string> {
    // Load private key
    const from = new web3.PublicKey(
      Buffer.from(this.publicKey.replace("0x", ""), "hex")
    );

    // Prepare target
    const to = new web3.PublicKey(dest);

    console.log(
      `Going to transfer ${amount} ${
        this.isTestnet ? "SOL_TEST" : "SOL"
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

    // Sign and store signature in tx - EdDSA uses custom signaturem must be used like this
    console.log("Signing and appending signature to transaction.");
    const sig = await this.sign(tx.serializeMessage());
    tx.addSignature(from, sig as Buffer);

    // Broadcast
    console.log("Broadcasting transaction.");
    const hash = await this.solConn.sendRawTransaction(tx.serialize());
    return hash;
  }
}
