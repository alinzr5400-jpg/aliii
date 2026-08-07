import { readCollectionState } from "./collection";

export type SaleConfig = {
  project: string;
  network: string;
  payment: string;
  saleMode: "admin" | "public";
  mintPrice: number;
  minBuy: number;
  maxBuy: number;
  totalSupply: number;
  minted: number;
  remaining: number;
  reveal: boolean;
  saleOpen: boolean;
  saleStartsAt: number | null;
  collectionAddress: string | null;
  paymentAddress: string | null;
  adminAddress: string | null;
  baseUri: string | null;
  hiddenImage: string;
};

function parseSaleMode(): "admin" | "public" {
  const mode = (process.env.SALE_MODE ?? "admin").toLowerCase();
  return mode === "public" ? "public" : "admin";
}

export function getStaticSaleSettings() {
  const mintPrice = Number(process.env.MINT_PRICE ?? "0.5");
  const minBuy = Number(process.env.MIN_BUY ?? "1");
  const maxBuy = Number(process.env.MAX_BUY ?? "10");
  const saleStartsAtRaw = process.env.SALE_START_AT?.trim();
  const saleStartsAt = saleStartsAtRaw
    ? Math.floor(new Date(saleStartsAtRaw).getTime() / 1000)
    : null;

  return {
    mintPrice: Number.isFinite(mintPrice) ? mintPrice : 0.5,
    minBuy: Number.isFinite(minBuy) ? minBuy : 1,
    maxBuy: Number.isFinite(maxBuy) ? maxBuy : 10,
    saleStartsAt,
    saleMode: parseSaleMode(),
    network: process.env.NETWORK ?? "testnet",
    hiddenImage:
      process.env.HIDDEN_IMAGE_URL ?? "https://xxx.ir/hidden.png",
  };
}

export async function buildSaleConfig(): Promise<SaleConfig> {
  const staticSettings = getStaticSaleSettings();
  const now = Math.floor(Date.now() / 1000);
  const saleOpen =
    staticSettings.saleStartsAt === null ||
    now >= staticSettings.saleStartsAt;

  try {
    const state = await readCollectionState();
    const totalSupply = Number(state.maxSupply) || 12652;
    const minted = Number(state.nextItemIndex) || 0;
    const paymentAddress =
      process.env.PAYMENT_ADDRESS?.trim() ||
      state.adminAddress ||
      process.env.TON_COLLECTION_ADDRESS ||
      null;

    return {
      project: "Alamdar",
      network: staticSettings.network,
      payment: "TON",
      saleMode: staticSettings.saleMode,
      mintPrice: staticSettings.mintPrice,
      minBuy: staticSettings.minBuy,
      maxBuy: staticSettings.maxBuy,
      totalSupply,
      minted,
      remaining: Math.max(totalSupply - minted, 0),
      reveal: state.revealEnabled,
      saleOpen,
      saleStartsAt: staticSettings.saleStartsAt,
      collectionAddress: process.env.TON_COLLECTION_ADDRESS ?? null,
      paymentAddress,
      adminAddress: state.adminAddress,
      baseUri: state.baseUri,
      hiddenImage: staticSettings.hiddenImage,
    };
  } catch {
    const totalSupply = 12652;
    return {
      project: "Alamdar",
      network: staticSettings.network,
      payment: "TON",
      saleMode: staticSettings.saleMode,
      mintPrice: staticSettings.mintPrice,
      minBuy: staticSettings.minBuy,
      maxBuy: staticSettings.maxBuy,
      totalSupply,
      minted: 0,
      remaining: totalSupply,
      reveal: false,
      saleOpen,
      saleStartsAt: staticSettings.saleStartsAt,
      collectionAddress: process.env.TON_COLLECTION_ADDRESS ?? null,
      paymentAddress:
        process.env.PAYMENT_ADDRESS?.trim() ||
        process.env.TON_COLLECTION_ADDRESS ||
        null,
      adminAddress: null,
      baseUri: null,
      hiddenImage: staticSettings.hiddenImage,
    };
  }
}
