import dotenv from "dotenv";
import { Address, TonClient } from "@ton/ton";

dotenv.config({ path: "./backend/.env" });

const endpoint =
  process.env.TON_RPC ?? "https://toncenter.com/api/v2/jsonRPC";

export const client = new TonClient({ endpoint });

export function getCollectionAddress(): Address {
  const raw = process.env.TON_COLLECTION_ADDRESS;
  if (!raw) {
    throw new Error("TON_COLLECTION_ADDRESS is missing");
  }
  return Address.parse(raw);
}