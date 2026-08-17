/**
 * Deploy a new AlamdarCollection on testnet whose admin is ADMIN_MNEMONIC.
 * Reuses nftItemCode from the existing collection so item code stays compatible.
 *
 * Usage (from alamdar-contract):
 *   npx tsx backend/deploy-collection.ts
 *
 * Prints the new TON_COLLECTION_ADDRESS to set on Render.
 */
import dotenv from "dotenv";
dotenv.config({ path: "./backend/.env" });

import { mnemonicToPrivateKey } from "@ton/crypto";
import {
  Address,
  beginCell,
  Cell,
  SendMode,
  TonClient,
  WalletContractV4,
  WalletContractV5R1,
  toNano,
} from "@ton/ton";
import {
  AlamdarCollection,
  CollectionContent,
  NftCollectionStorage,
  RoyaltyParams,
} from "../wrappers-ts/AlamdarCollection.gen";

const OLD_COLLECTION =
  process.env.TON_COLLECTION_ADDRESS?.trim() ||
  "kQBJukUFjWoPUtoQGjpxIzRH-duuTxAaMkRG61eA3Ktwqxtl";

const BASE_URI =
  process.env.COLLECTION_BASE_URI?.trim() ||
  "https://alamdar-backend1.onrender.com/nft/";

function requireMnemonic(): string[] {
  const raw = process.env.ADMIN_MNEMONIC?.trim();
  if (!raw) throw new Error("ADMIN_MNEMONIC missing in backend/.env");
  return raw.split(/\s+/);
}

function createWallet(publicKey: Buffer) {
  const version = (process.env.ADMIN_WALLET_VERSION ?? "v5r1").toLowerCase();
  if (version === "v4") {
    return WalletContractV4.create({ workchain: 0, publicKey });
  }
  return WalletContractV5R1.create({ publicKey });
}

function sleep(ms: number) {
  return new Promise((r) => setTimeout(r, ms));
}

async function main() {
  const endpoint =
    process.env.TON_RPC ?? "https://testnet.toncenter.com/api/v2/jsonRPC";
  const apiKey =
    process.env.TON_API_KEY?.trim() ||
    process.env.TONCENTER_API_KEY?.trim() ||
    undefined;
  const client = new TonClient({ endpoint, apiKey });

  const key = await mnemonicToPrivateKey(requireMnemonic());
  const wallet = createWallet(key.publicKey);
  const openedWallet = client.open(wallet);
  const admin = wallet.address;

  console.log("Admin wallet:", admin.toString({ bounceable: false, testOnly: true }));
  const bal = await client.getBalance(admin);
  console.log("Admin balance TON:", Number(bal) / 1e9);
  if (bal < toNano("0.25")) {
    throw new Error("Admin wallet needs at least ~0.25 testnet TON to deploy");
  }

  // Reuse item code from existing live collection storage
  const oldAddr = Address.parse(OLD_COLLECTION);
  const oldState = await client.getContractState(oldAddr);
  if (!oldState.data) {
    throw new Error("Could not read old collection data");
  }
  const oldStorage = NftCollectionStorage.fromSlice(
    Cell.fromBoc(oldState.data)[0].beginParse()
  );
  console.log(
    "Reusing nftItemCode from old collection; old admin was",
    oldStorage.adminAddress.toString()
  );

  // Minimal off-chain collection metadata cell (name/description/image as snake ref)
  const collectionMetadata = beginCell()
    .storeStringRefTail(
      JSON.stringify({
        name: "Alamdar",
        description: "Alamdar NFT Collection",
        image:
          process.env.HIDDEN_IMAGE_URL ||
          "https://gateway.pinata.cloud/ipfs/bafybeigsk72nzcyweotcgzxzzoryhfc6azdqro66xbsayyuiembksur3je",
      })
    )
    .endCell();

  const collection = AlamdarCollection.fromStorage({
    adminAddress: admin,
    nextItemIndex: 0n,
    maxSupply: 16120n,
    revealEnabled: false,
    baseUri: BASE_URI,
    content: {
      ref: CollectionContent.create({
        collectionMetadata,
        commonContent: BASE_URI,
      }),
    },
    nftItemCode: oldStorage.nftItemCode,
    royaltyParams: {
      ref: RoyaltyParams.create({
        numerator: 5n,
        denominator: 100n,
        royaltyAddress: admin,
      }),
    },
  });

  console.log(
    "New collection address:",
    collection.address.toString({ bounceable: true, testOnly: true })
  );

  const openedCollection = client.open(collection);
  await openedCollection.sendDeploy(openedWallet.sender(key.secretKey), toNano("0.15"), {
    sendMode: SendMode.PAY_GAS_SEPARATELY,
  });

  console.log("Deploy sent. Waiting for confirmation...");
  for (let i = 0; i < 30; i++) {
    await sleep(3000);
    try {
      const data = await openedCollection.getCollectionData();
      console.log(
        JSON.stringify(
          {
            ok: true,
            collectionAddress: collection.address.toString({
              bounceable: true,
              testOnly: true,
            }),
            collectionAddressEQ: collection.address.toString({
              bounceable: true,
              testOnly: false,
            }),
            adminAddress: data.adminAddress.toString({
              bounceable: true,
              testOnly: false,
            }),
            nextItemIndex: Number(data.nextItemIndex),
            maxSupply: Number(data.maxSupply),
            baseUri: data.baseUri,
          },
          null,
          2
        )
      );
      console.log(
        "\nSet on Render:\nTON_COLLECTION_ADDRESS=" +
          collection.address.toString({ bounceable: true, testOnly: true })
      );
      return;
    } catch {
      process.stdout.write(".");
    }
  }
  throw new Error("Deploy sent but collection did not become readable in time");
}

main().catch((e) => {
  console.error(e instanceof Error ? e.message : e);
  process.exit(1);
});
