import {
  Address as TonAddress,
  Cell,
  SendMode,
  toNano,
} from "@ton/ton";
import { Address } from "../lib/tonCore";
import { AlamdarCollection } from "../wrappers-ts/AlamdarCollection.gen";
import { openAdminSender } from "./adminMint";
import { clearCollectionCache, readCollectionState } from "./collection";
import { client, getCollectionAddress } from "./ton";

function forWalletCell(cell: { toBoc: () => Buffer }): Cell {
  return Cell.fromBoc(cell.toBoc())[0];
}

function forWalletAddress(address: Address | string): TonAddress {
  return TonAddress.parse(
    typeof address === "string" ? address : address.toString()
  );
}

function sleep(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

/**
 * Enable/disable on-chain reveal using collection admin wallet.
 */
export async function setRevealEnabled(enabled: boolean): Promise<{
  revealEnabled: boolean;
}> {
  const { sender, address: adminWallet } = await openAdminSender();
  const collectionAddr = getCollectionAddress();
  const collection = client.open(
    AlamdarCollection.fromAddress(collectionAddr)
  );

  const data = await collection.getCollectionData();
  if (
    !TonAddress.parse(adminWallet.toString()).equals(
      TonAddress.parse(data.adminAddress.toString())
    )
  ) {
    throw new Error(
      "ADMIN_MNEMONIC does not match on-chain collection admin"
    );
  }

  if (Boolean(data.revealEnabled) === enabled) {
    return { revealEnabled: enabled };
  }

  const bodyEsm = enabled
    ? AlamdarCollection.createCellOfEnableReveal({
        queryId: BigInt(Date.now()),
      })
    : AlamdarCollection.createCellOfDisableReveal({
        queryId: BigInt(Date.now()),
      });

  await sender.send({
    to: forWalletAddress(collectionAddr),
    value: toNano("0.05"),
    body: forWalletCell(bodyEsm),
    sendMode: SendMode.PAY_GAS_SEPARATELY,
  });

  for (let i = 0; i < 20; i++) {
    await sleep(2500);
    clearCollectionCache();
    const state = await readCollectionState({ force: true });
    if (state.revealEnabled === enabled) {
      return { revealEnabled: state.revealEnabled };
    }
  }

  throw new Error(
    `Reveal tx sent but on-chain revealEnabled did not become ${enabled}`
  );
}
