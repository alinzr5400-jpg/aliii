/**
 * On-chain ownership helpers (TonAPI).
 * Source of truth for "who owns which NFT" is the chain — not SQLite.
 * SQLite only stores reveal card assignments (tokenId → artwork).
 */

import { Address } from "@ton/ton";
import { getAssignment } from "./assignments";
import { buildCardCatalog } from "./cardCatalog";
import { getCollectionAddress } from "./ton";

type Db = {
  prepare: (sql: string) => {
    run: (...args: unknown[]) => unknown;
    get: (...args: unknown[]) => unknown;
    all: (...args: unknown[]) => unknown[];
  };
};

function tonApiBase(): string {
  const network = (process.env.NETWORK ?? "testnet").toLowerCase();
  if (network === "mainnet") return "https://tonapi.io";
  return "https://testnet.tonapi.io";
}

export type HoldingItem = {
  tokenId: number;
  address: string;
  name: string | null;
  rarity: string | null;
  cardKey: string | null;
  image: string | null;
};

export type LegendaryPersonProgress = {
  personId: number;
  /** Legendary stems for this person, e.g. ["0-1","0-2"] */
  required: string[];
  owned: string[];
  complete: boolean;
};

export async function fetchWalletCollectionNfts(
  ownerAddress: string
): Promise<Array<{ tokenId: number; address: string }>> {
  const owner = Address.parse(ownerAddress).toRawString();
  const collection = getCollectionAddress().toRawString();
  const url =
    `${tonApiBase()}/v2/accounts/${encodeURIComponent(owner)}/nfts` +
    `?collection=${encodeURIComponent(collection)}&limit=1000&indirect_ownership=false`;

  const res = await fetch(url, {
    headers: { Accept: "application/json" },
  });
  if (!res.ok) {
    throw new Error(`TonAPI holdings failed: HTTP ${res.status}`);
  }
  const data = (await res.json()) as {
    nft_items?: Array<{ address: string; index: number }>;
  };

  return (data.nft_items ?? []).map((item) => ({
    tokenId: Number(item.index),
    address: item.address,
  }));
}

export async function buildWalletHoldings(
  db: Db,
  ownerAddress: string
): Promise<{
  address: string;
  count: number;
  items: HoldingItem[];
  legendaryProgress: LegendaryPersonProgress[];
}> {
  const nfts = await fetchWalletCollectionNfts(ownerAddress);
  const items: HoldingItem[] = nfts
    .map((nft) => {
      const assigned = getAssignment(db, nft.tokenId);
      return {
        tokenId: nft.tokenId,
        address: nft.address,
        name: assigned?.name ?? null,
        rarity: assigned?.rarity ?? null,
        cardKey: assigned?.cardKey ?? null,
        image: assigned?.image ?? null,
      };
    })
    .sort((a, b) => a.tokenId - b.tokenId);

  const legendaryProgress = computeLegendaryProgress(items);

  return {
    address: Address.parse(ownerAddress).toString({
      bounceable: true,
      testOnly: (process.env.NETWORK ?? "testnet") !== "mainnet",
    }),
    count: items.length,
    items,
    legendaryProgress,
  };
}

/**
 * Legendary artworks are keyed like legendary:0-1#3 → stem "0-1".
 * Person id = major number before "-".
 * Complete = owns at least one copy of every legendary stem for that person.
 */
export function computeLegendaryProgress(
  items: HoldingItem[]
): LegendaryPersonProgress[] {
  const catalog = buildCardCatalog().filter((c) => c.rarity === "Legendary");
  const byPerson = new Map<number, string[]>();
  for (const card of catalog) {
    const personId = Number(card.stem.split("-")[0]);
    if (!byPerson.has(personId)) byPerson.set(personId, []);
    byPerson.get(personId)!.push(card.stem);
  }

  const ownedStems = new Set<string>();
  for (const item of items) {
    if (item.rarity !== "Legendary" || !item.cardKey) continue;
    const stem = item.cardKey.includes(":")
      ? item.cardKey.split(":")[1]?.split("#")[0]
      : null;
    if (stem) ownedStems.add(stem);
  }

  return [...byPerson.entries()]
    .sort((a, b) => a[0] - b[0])
    .map(([personId, required]) => {
      const owned = required.filter((s) => ownedStems.has(s));
      return {
        personId,
        required,
        owned,
        complete: owned.length === required.length,
      };
    });
}
