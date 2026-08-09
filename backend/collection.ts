import { AlamdarCollection } from "../wrappers-ts/AlamdarCollection.gen";
import { client, getCollectionAddress } from "./ton";

const contract = client.open(
  AlamdarCollection.fromAddress(getCollectionAddress())
);

export type CollectionState = {
  nextItemIndex: number;
  maxSupply: number;
  revealEnabled: boolean;
  baseUri: string;
  adminAddress: string;
};

const CACHE_TTL_MS = Number(process.env.COLLECTION_CACHE_MS ?? 20000);

let cached: { at: number; state: CollectionState } | null = null;

export async function readCollectionState(
  options?: { force?: boolean }
): Promise<CollectionState> {
  const now = Date.now();
  if (
    !options?.force &&
    cached &&
    now - cached.at < CACHE_TTL_MS
  ) {
    return cached.state;
  }

  const data = await contract.getCollectionData();
  const state: CollectionState = {
    nextItemIndex: Number(data.nextItemIndex),
    maxSupply: Number(data.maxSupply),
    revealEnabled: data.revealEnabled,
    baseUri: data.baseUri,
    adminAddress: data.adminAddress.toString(),
  };

  cached = { at: now, state };
  return state;
}

export function clearCollectionCache() {
  cached = null;
}
