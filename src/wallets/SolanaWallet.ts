import * as web3 from "@solana/web3.js";
import { EdDSAWallet } from "./EdDSAWallet";

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
    const from = web3.Keypair.fromSecretKey(
      Buffer.from(this.privateKey!.replace("0x", ""), "hex")
    );

    // Prepare target
    const to = new web3.PublicKey(dest);

    console.log(
      `Going to transfer ${amount} ${
        this.isTestnet ? "SOL_TEST" : "SOL"
      } from ${from.publicKey.toBase58()} to ${to.toBase58()}`
    );
    // Create transaction
    const tx = new web3.Transaction().add(
      web3.SystemProgram.transfer({
        fromPubkey: from.publicKey,
        toPubkey: to,
        lamports: amount * web3.LAMPORTS_PER_SOL,
      })
    );

    // Sign and store signature in tx - EdDSA uses custom signaturem must be used like this
    const sig = await this.sign(tx.serializeMessage());
    tx.addSignature(from.publicKey, sig as Buffer);

    // Broadcast
    const hash = await this.solConn.sendRawTransaction(tx.serialize());
    return hash;
  }
}
