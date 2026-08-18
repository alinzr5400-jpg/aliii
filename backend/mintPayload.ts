import {
  Address,
  beginCell,
  toNano,
} from "../lib/tonCore";

/** Opcode for PublicMint on AlamdarCollection */
export const PUBLIC_MINT_OP = 0x10000005;

/** Gas attached per NFT when using public on-chain mint */
export const PUBLIC_MINT_ITEM_GAS = toNano("0.05");

export function buildTextCommentPayload(text: string): string {
  return beginCell()
    .storeUint(0, 32)
    .storeStringTail(text)
    .endCell()
    .toBoc()
    .toString("base64");
}

export function buildPublicMintPayload(count: number, queryId = 0n): string {
  return beginCell()
    .storeUint(PUBLIC_MINT_OP, 32)
    .storeUint(queryId, 64)
    .storeUint(count, 8)
    .endCell()
    .toBoc()
    .toString("base64");
}

export function mintPaymentNano(
  mintPriceTon: number,
  count: number,
  mode: "admin" | "public"
): bigint {
  const price = toNano(mintPriceTon.toString());
  if (mode === "public") {
    return (price + PUBLIC_MINT_ITEM_GAS) * BigInt(count);
  }
  return price * BigInt(count);
}

export function toFriendlyAddress(raw: string): string {
  return Address.parse(raw).toString({ bounceable: true, testOnly: false });
}

/**
 * TonConnect (esp. Android Tonkeeper) is more reliable with EQ/UQ forms
 * than testnet-flagged kQ/0Q addresses in message.address.
 */
export function toTonConnectAddress(raw: string): string {
  return Address.parse(raw).toString({
    bounceable: true,
    testOnly: false,
    urlSafe: true,
  });
}
