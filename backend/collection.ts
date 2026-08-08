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

export async function readCollectionState(): Promise<CollectionState> {
  const data = await contract.getCollectionData();

  return {
    nextItemIndex: Number(data.nextItemIndex),
    maxSupply: Number(data.maxSupply),
    revealEnabled: data.revealEnabled,
    baseUri: data.baseUri,
    adminAddress: data.adminAddress.toString(),
  };
}