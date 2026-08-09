import dotenv from "dotenv";
import { Address, TonClient } from "@ton/ton";

dotenv.config({ path: "./backend/.env" });

const endpoint =
  process.env.TON_RPC ?? "https://toncenter.com/api/v2/jsonRPC";

const apiKey =
  process.env.TON_API_KEY?.trim() ||
  process.env.TONCENTER_API_KEY?.trim() ||
  undefined;

export const client = new TonClient({
  endpoint,
  apiKey,
});

export function getCollectionAddress(): Address {
  const raw = process.env.TON_COLLECTION_ADDRESS;
  if (!raw) {
    throw new Error("TON_COLLECTION_ADDRESS is missing");
  }
  return Address.parse(raw);
}

export function isRateLimitError(error: unknown): boolean {
  const message = error instanceof Error ? error.message : String(error);
  return /\b429\b|rate limit|too many requests/i.test(message);
}
