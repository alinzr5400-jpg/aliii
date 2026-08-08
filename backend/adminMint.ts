import { Address, Dictionary, toNano, type Sender } from "@ton/core";
import { mnemonicToPrivateKey } from "@ton/crypto";
import { WalletContractV4, WalletContractV5R1 } from "@ton/ton";
import {
  AlamdarCollection,
  BatchDeployDictItem,
  NftItemInitAtDeployment,
} from "../wrappers-ts/AlamdarCollection.gen";
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
  const collection = client.open(
    AlamdarCollection.fromAddress(getCollectionAddress())
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
  await collection.sendBatchDeployNfts(sender, msgValue, {
    queryId: BigInt(Date.now()),
    deployList: dict,
  });

  return indices;
}
