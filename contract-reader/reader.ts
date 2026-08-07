import dotenv from "dotenv";
dotenv.config({ path: "./backend/.env" });

import { TonClient, Address } from "@ton/ton";
import { AlamdarCollection } from "../wrappers-ts/AlamdarCollection.gen";

const endpoint =
    process.env.TON_RPC ??
    "https://toncenter.com/api/v2/jsonRPC";

const client = new TonClient({
    endpoint
});

const address = process.env.TON_COLLECTION_ADDRESS;

if (!address) {
    throw new Error("TON_COLLECTION_ADDRESS is missing");
}

const contract = client.open(
    AlamdarCollection.fromAddress(
        Address.parse(address)
    )
);

export async function getCollectionData() {
    return await contract.getCollectionData();
}

export async function getMaxSupply() {
    return await contract.getMaxSupply();
}

export async function getRevealStatus() {
    return await contract.getRevealStatus();
}

export async function getBaseUri() {
    return await contract.getBaseUri();
}

export async function getProjectName() {
    return await contract.getProjectName();
}