import { Buffer } from "buffer";
import { toBigIntBE } from "bigint-buffer";
import bs58check from "bs58check";
import { createHmac, randomBytes as cRandomBytes } from "crypto";
import crypto from "crypto";
import { toBeHex } from "ethers";
import { ExtendedPoint, CURVE as edCURVE, etc } from "@noble/ed25519";
import {
  bytesToNumberLE,
  concatBytes,
  numberToBytesBE,
  numberToBytesLE,
  hexToNumber,
} from "@noble/curves/abstract/utils";
import {
  DerivationPath,
  supportedAssets,
  SupportedAssets,
} from "./SupportedAssets";

/**
 * Get a SHA-512 digest of concatenated byte array messages.
 *
 * @param messages list of byte arrays
 * @returns byte array of SHA-512 digest
 */
const sha512 = async (...messages: Uint8Array[]) => {
  const buffer = concatBytes(...messages);

  const digest = await crypto.subtle.digest("SHA-512", buffer);

  return new Uint8Array(digest);
};

/**
 * Get a byte array of cryptographically-secure random bytes.
 *
 * @param length length of byte array
 * @returns byte array
 */
const randomBytes = (length = 32) => {
  if (typeof crypto.getRandomValues !== "function") {
    return cRandomBytes(length);
  }

  return crypto.getRandomValues(new Uint8Array(length));
};

// @ts-ignore
const _0n = 0n;

/**
 * Convert a number to a 4-byte long byte array in big-endian order.
 *
 * @param number number
 * @returns 4-byte long byte array in big-endian order
 */
const numberTo4BytesBE = (number: number) =>
  Buffer.from([number >> 24, number >> 16, number >> 8, number]);

const flatten = (p: ExtendedPoint): ExtendedPoint =>
  ExtendedPoint.fromAffine(p.toAffine());

  /**
   * A class representing an EdDSA wallet.
   * Fireblocks uses a non-standard signature for EdDSA, this signature is implemented here under the `sign` function.
   * This class also handles the derivation of the x-private key (fprv for EdDSA) and generating of the pri/pub keys.
   */
export class EdDSAWallet {
  private privateKey;
  protected publicKey;

  constructor(fprv: string, asset: SupportedAssets) {
    if (!fprv.startsWith("fprv")) {
      throw new Error("Provided fprv must start with the phrase 'fprv'.");
    }

    const derivationPath: DerivationPath = supportedAssets[asset];
    const keys = this.derive(fprv, derivationPath);
    this.privateKey = keys.privateKey;
    this.publicKey = keys.publicKey;
  }

  private static hashForDerive(
    pubKey: ExtendedPoint,
    chainCode: Uint8Array,
    idx: number
  ) {
    const hmac = createHmac("sha512", chainCode);
    hmac.update(Buffer.from(pubKey.toHex(), "hex"));
    hmac.update(Buffer.from([0x0]));
    hmac.update(numberTo4BytesBE(idx));
    return hmac.digest();
  }

  private static deriveNextKeyLevel(
    pubKey: ExtendedPoint,
    prvKey: bigint,
    chainCode: Uint8Array,
    idx: number
  ): [ExtendedPoint, bigint, Uint8Array] {
    const hash = EdDSAWallet.hashForDerive(pubKey, chainCode, idx);
    const derivedChainCode = hash.subarray(32);
    const exp = toBigIntBE(hash.subarray(undefined, 32));
    const tmpPoint = flatten(ExtendedPoint.BASE.mul(exp % edCURVE.n));
    const derivedPubKey = flatten(pubKey.add(tmpPoint));
    const derivedPrvKey = (prvKey + exp) % edCURVE.n;
    return [derivedPubKey, derivedPrvKey, derivedChainCode];
  }

  /**
   * Derive an address from an fprv
   * @param extendedKey The fprv/fpub to derive from
   * @param derivationPath The derivation path to use
   */
  protected derive(extendedKey: string, derivationPath: DerivationPath) {
    const decodedKey = bs58check.decode(extendedKey);

    if (decodedKey.length !== 78) {
      throw new Error("Extended key is not a valid FPRV or FPUB");
    }

    let chainCode = decodedKey.subarray(13, 45);
    let prvKey: bigint | undefined =
      toBigIntBE(Buffer.from(decodedKey.subarray(46))) ?? undefined;
    let pubKey: ExtendedPoint;

    pubKey = ExtendedPoint.fromAffine(
      ExtendedPoint.BASE.mul(prvKey).toAffine()
    );

    [pubKey, prvKey, chainCode] = (
      derivationPath as [number, number, number, number, number]
    ).reduce(
      ([_pubKey, _prvKey, _chainCode], pathPart) =>
        EdDSAWallet.deriveNextKeyLevel(_pubKey, _prvKey, _chainCode, pathPart),
      [pubKey, prvKey, chainCode]
    );

    const publicKey = `0x${pubKey.toHex()}`;
    const privateKey = prvKey ? toBeHex(prvKey) : undefined;

    return { publicKey, privateKey };
  }

  /**
   * Generate a Fireblocks EdDSA signature for a given message and private key.
   *
   * @param message string or byte array to sign
   * @param privateKey hex-encoded private key
   * @returns Fireblocks EdDSA signature
   */
  protected async sign(
    message: string | Uint8Array,
    hasher: (...msgs: Uint8Array[]) => Promise<Uint8Array> = sha512
  ) {
    if (!this.privateKey) {
      throw new Error("Cannot sign without a derived private key");
    }

    const privateKeyInt = hexToNumber(this.privateKey.slice(2));
    const privateKeyBytes = numberToBytesLE(privateKeyInt, 32);
    const messagesBytes =
      typeof message === "string" ? Buffer.from(message) : message;
    const messageBytes = concatBytes(messagesBytes);

    const seed = randomBytes();

    const nonceDigest = await hasher(seed, privateKeyBytes, messageBytes);
    const nonce = etc.mod(bytesToNumberLE(nonceDigest), edCURVE.n);

    const R = ExtendedPoint.BASE.mul(nonce);
    const A = ExtendedPoint.BASE.mul(privateKeyInt);

    const serializedR = R.toRawBytes();
    const serializedA = A.toRawBytes();

    const hramDigest = await hasher(serializedR, serializedA, messageBytes);
    const hram = etc.mod(bytesToNumberLE(hramDigest), edCURVE.n);

    const s = etc.mod(hram * privateKeyInt + nonce, edCURVE.n);
    const signature = concatBytes(serializedR, numberToBytesLE(s, 32));

    return signature;
  }
}
