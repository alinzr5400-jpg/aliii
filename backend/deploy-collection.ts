/**
 * Deploy a new AlamdarCollection on testnet whose admin is ADMIN_MNEMONIC.
 *
 * IMPORTANT:
 *   1) acton build
 *   2) preferably: acton wrapper AlamdarCollection --ts
 *   3) npx tsx backend/deploy-collection.ts
 *
 * Uses code from build/*.json (fresh Acton output), NOT stale wrappers-ts CodeCell.
 *
 * Optional:
 *   DEPLOY_SALT=wallet-fix-v3
 *
 * Prints the new TON_COLLECTION_ADDRESS to set on Render.
 */
import dotenv from "dotenv";
dotenv.config({ path: "./backend/.env" });

import fs from "node:fs";
import path from "node:path";
import { mnemonicToPrivateKey } from "@ton/crypto";
import {
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
  RoyaltyParams,
} from "../wrappers-ts/AlamdarCollection.gen";

const BASE_URI =
  process.env.COLLECTION_BASE_URI?.trim() ||
  "https://alamdar-backend1.onrender.com/nft/";

const DEPLOY_SALT = process.env.DEPLOY_SALT?.trim() || `alamdar-${Date.now()}`;

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

/** Load compiled contract code produced by `acton build`. */
function loadBuiltCode(contractName: string): Cell {
  const file = path.join(__dirname, "..", "build", `${contractName}.json`);
  if (!fs.existsSync(file)) {
    throw new Error(
      `Missing ${file}. Run: acton build`
    );
  }
  const json = JSON.parse(fs.readFileSync(file, "utf8")) as {
    code_boc64?: string;
    hash?: string;
  };
  if (!json.code_boc64) {
    throw new Error(`No code_boc64 in ${file}`);
  }
  const mtime = fs.statSync(file).mtime.toISOString();
  console.log(`Using build/${contractName}.json (mtime ${mtime}, hash ${json.hash ?? "?"})`);
  return Cell.fromBase64(json.code_boc64);
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

  const collectionCode = loadBuiltCode("AlamdarCollection");
  const nftItemCode = loadBuiltCode("AlamdarItem");
  console.log("Deploy salt:", DEPLOY_SALT);

  const collectionMetadata = beginCell()
    .storeStringRefTail(
      JSON.stringify({
        name: "Alamdar",
        description: "Alamdar NFT Collection",
        image:
          process.env.HIDDEN_IMAGE_URL ||
          "https://gateway.pinata.cloud/ipfs/bafybeigsk72nzcyweotcgzxzzoryhfc6azdqro66xbsayyuiembksur3je",
        deploySalt: DEPLOY_SALT,
      })
    )
    .endCell();

  const collection = AlamdarCollection.fromStorage(
    {
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
      nftItemCode,
      royaltyParams: {
        ref: RoyaltyParams.create({
          numerator: 5n,
          denominator: 100n,
          royaltyAddress: admin,
        }),
      },
    },
    { overrideContractCode: collectionCode }
  );

  const newAddr = collection.address.toString({ bounceable: true, testOnly: true });
  console.log("New collection address:", newAddr);

  const existing = await client.getContractState(collection.address);
  if (existing.state === "active") {
    throw new Error(
      `Address ${newAddr} is already active. Set a new DEPLOY_SALT and retry.`
    );
  }

  const openedCollection = client.open(collection);
  await openedCollection.sendDeploy(openedWallet.sender(key.secretKey), toNano("0.15"), {
    sendMode: SendMode.PAY_GAS_SEPARATELY,
  });

  console.log("Deploy sent. Waiting for confirmation...");
  for (let i = 0; i < 30; i++) {
    await sleep(3000);
    try {
      const data = await openedCollection.getCollectionData();
      const minted = Number(data.nextItemIndex);
      if (minted !== 0) {
        throw new Error(
          `Expected fresh collection (minted=0) but got minted=${minted}`
        );
      }

      // Sanity: get_nft_content must return absolute URL (wallet fix)
      const content = await openedCollection.getNftContent(0n, "0");
      const uri =
        (content as { ref?: { string?: string } }).ref?.string ??
        (content as { string?: string }).string ??
        "";
      console.log("get_nft_content(0) =>", uri);
      if (!/^https?:\/\//i.test(uri)) {
        throw new Error(
          `Deployed code still returns relative metadata URI (${uri}). ` +
            `Re-run acton build, then redeploy. Do not use stale wrappers-ts CodeCell.`
        );
      }

      console.log(
        JSON.stringify(
          {
            ok: true,
            collectionAddress: newAddr,
            collectionAddressEQ: collection.address.toString({
              bounceable: true,
              testOnly: false,
            }),
            adminAddress: data.adminAddress.toString({
              bounceable: true,
              testOnly: false,
            }),
            nextItemIndex: minted,
            maxSupply: Number(data.maxSupply),
            baseUri: data.baseUri,
            sampleMetadataUri: uri,
          },
          null,
          2
        )
      );
      console.log("\nSet on Render:\nTON_COLLECTION_ADDRESS=" + newAddr);
      return;
    } catch (e) {
      if (
        e instanceof Error &&
        (e.message.includes("Expected fresh") ||
          e.message.includes("relative metadata"))
      ) {
        throw e;
      }
      process.stdout.write(".");
    }
  }
  throw new Error("Deploy sent but collection did not become readable in time");
}

main().catch((e) => {
  console.error(e instanceof Error ? e.message : e);
  process.exit(1);
});
