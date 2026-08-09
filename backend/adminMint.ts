import { mnemonicToPrivateKey } from "@ton/crypto";
import {
  Address as TonAddress,
  Cell,
  SendMode,
  WalletContractV4,
  WalletContractV5R1,
} from "@ton/ton";
import {
  Address,
  Dictionary,
  toNano,
  type Sender,
} from "../lib/tonCore";
import {
  AlamdarCollection,
  BatchDeployDictItem,
  NftItemInitAtDeployment,
} from "../wrappers-ts/AlamdarCollection.gen";
import { clearCollectionCache } from "./collection";
import { client, getCollectionAddress } from "./ton";

function requireMnemonic(): string[] {
  const raw = process.env.ADMIN_MNEMONIC?.trim();
  if (!raw) {
    throw new Error(
      "ADMIN_MNEMONIC is missing. Set the collection admin wallet mnemonic in backend/.env"
    );
  }
  return raw.split(/\s+/);
}

function createAdminWallet(publicKey: Buffer) {
  const version = (process.env.ADMIN_WALLET_VERSION ?? "v5r1").toLowerCase();
  if (version === "v4") {
    return WalletContractV4.create({ workchain: 0, publicKey });
  }
  // Standard W5 R1 wallet (matches Acton wallets.toml v5r1)
  return WalletContractV5R1.create({ publicKey });
}

/**
 * Re-hydrate Cell/Address through @ton/ton so WalletContract sender
 * (CJS @ton/core) accepts them. Wrappers/tsx can load ESM @ton/core;
 * instanceof checks fail across the two copies without this bridge.
 */
function forWalletCell(cell: { toBoc: () => Buffer }): Cell {
  return Cell.fromBoc(cell.toBoc())[0];
}

function forWalletAddress(address: Address | string): TonAddress {
  return TonAddress.parse(
    typeof address === "string" ? address : address.toString()
  );
}

export async function openAdminSender(): Promise<{
  sender: Sender;
  address: Address;
}> {
  const key = await mnemonicToPrivateKey(requireMnemonic());
  const wallet = createAdminWallet(key.publicKey);
  const opened = client.open(wallet);
  return {
    sender: opened.sender(key.secretKey),
    address: wallet.address,
  };
}

export async function adminMintToBuyer(
  buyerAddress: string,
  count: number
): Promise<number[]> {
  const { sender } = await openAdminSender();
  const collectionAddr = getCollectionAddress();
  const collection = client.open(
    AlamdarCollection.fromAddress(collectionAddr)
  );

  const data = await collection.getCollectionData();
  const startIndex = Number(data.nextItemIndex);
  const maxSupply = Number(data.maxSupply);

  if (startIndex + count > maxSupply) {
    throw new Error("Not enough supply remaining");
  }

  const buyer = Address.parse(buyerAddress);
  const dict = Dictionary.empty(
    Dictionary.Keys.BigUint(64),
    {
      serialize(
        src: ReturnType<typeof BatchDeployDictItem.create>,
        builder: Parameters<typeof BatchDeployDictItem.store>[1]
      ) {
        BatchDeployDictItem.store(src, builder);
      },
      parse(src: Parameters<typeof BatchDeployDictItem.fromSlice>[0]) {
        return BatchDeployDictItem.fromSlice(src);
      },
    }
  );

  const indices: number[] = [];
  for (let i = 0; i < count; i++) {
    const itemIndex = startIndex + i;
    indices.push(itemIndex);
    dict.set(
      BigInt(itemIndex),
      BatchDeployDictItem.create({
        attachTonAmount: toNano("0.03"),
        initParams: {
          ref: NftItemInitAtDeployment.create({
            ownerAddress: buyer,
            content: String(itemIndex),
          }),
        },
      })
    );
  }

  const msgValue = toNano("0.03") * BigInt(count) + toNano("0.1");
  const bodyEsm = AlamdarCollection.createCellOfBatchDeployNfts({
    queryId: BigInt(Date.now()),
    deployList: dict,
  });

  await sender.send({
    to: forWalletAddress(collectionAddr),
    value: msgValue,
    body: forWalletCell(bodyEsm),
    sendMode: SendMode.PAY_GAS_SEPARATELY,
  });

  clearCollectionCache();
  return indices;
}
