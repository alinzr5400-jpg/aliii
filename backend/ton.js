const { TonClient, Address } = require("@ton/ton");
require("dotenv").config();

const endpoint =
    process.env.TON_RPC ||
    "https://toncenter.com/api/v2/jsonRPC";

const client = new TonClient({
    endpoint
});

let collectionAddress = null;

if (process.env.TON_COLLECTION_ADDRESS) {
    try {
        collectionAddress = Address.parse(
            process.env.TON_COLLECTION_ADDRESS
        );
    } catch (e) {
        console.error("Invalid TON_COLLECTION_ADDRESS");
        process.exit(1);
    }
}

function requireCollectionAddress() {
    if (!collectionAddress) {
        throw new Error("Collection address is not configured");
    }

    return collectionAddress;
}

module.exports = {
    client,
    collectionAddress,
    requireCollectionAddress
};