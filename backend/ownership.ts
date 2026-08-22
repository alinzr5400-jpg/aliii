/**
 * On-chain ownership helpers (TonAPI).
 * Source of truth for "who owns which NFT" is the chain — not SQLite.
 * SQLite only stores reveal card assignments (tokenId → artwork).
 */

import { Address } from "@ton/ton";
import {
  assignCardsForTokens,
  getAssignment,
  upsertAssignmentFromCardKey,
} from "./assignments";
import { buildCardCatalog } from "./cardCatalog";
import { readCollectionState } from "./collection";
import { getHiddenImageUrl } from "./media";
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

function sameAccount(a: string, b: string): boolean {
  try {
    return Address.parse(a).equals(Address.parse(b));
  } catch {
    return false;
  }
}

async function fetchJson(url: string): Promise<unknown> {
  const res = await fetch(url, { headers: { Accept: "application/json" } });
  if (!res.ok) {
    throw new Error(`TonAPI failed: HTTP ${res.status}`);
  }
  return res.json();
}

/**
 * Wallet NFT list: merge account endpoint + collection items filtered by owner.
 * Account endpoint often lags and returns a subset (bought 3, site showed 1).
 */
export async function fetchWalletCollectionNfts(
  ownerAddress: string
): Promise<Array<{ tokenId: number; address: string }>> {
  const owner = Address.parse(ownerAddress).toRawString();
  const collection = getCollectionAddress().toRawString();
  const byId = new Map<number, { tokenId: number; address: string }>();

  const accountUrl =
    `${tonApiBase()}/v2/accounts/${encodeURIComponent(owner)}/nfts` +
    `?collection=${encodeURIComponent(collection)}&limit=1000&indirect_ownership=false`;
  const collectionUrl =
    `${tonApiBase()}/v2/nfts/collections/${encodeURIComponent(collection)}/items?limit=1000`;

  const [accountRes, collectionRes] = await Promise.allSettled([
    fetchJson(accountUrl),
    fetchJson(collectionUrl),
  ]);

  if (accountRes.status === "fulfilled") {
    const data = accountRes.value as {
      nft_items?: Array<{ address: string; index: number }>;
    };
    for (const item of data.nft_items ?? []) {
      const tokenId = Number(item.index);
      if (!Number.isInteger(tokenId) || tokenId < 0) continue;
      byId.set(tokenId, { tokenId, address: item.address });
    }
  }

  if (collectionRes.status === "fulfilled") {
    const data = collectionRes.value as {
      nft_items?: Array<{
        address: string;
        index: number;
        owner?: { address?: string };
      }>;
    };
    for (const item of data.nft_items ?? []) {
      if (!item.owner?.address || !sameAccount(item.owner.address, owner)) {
        continue;
      }
      const tokenId = Number(item.index);
      if (!Number.isInteger(tokenId) || tokenId < 0) continue;
      byId.set(tokenId, { tokenId, address: item.address });
    }
  }

  if (byId.size === 0 && accountRes.status === "rejected" && collectionRes.status === "rejected") {
    throw new Error("TonAPI holdings failed on both endpoints");
  }

  return [...byId.values()].sort((a, b) => a.tokenId - b.tokenId);
}

let lastHydrateAt = 0;

function cardKeyFromMetadata(meta?: {
  attributes?: Array<{ trait_type?: string; value?: unknown }>;
}): string | null {
  const card = meta?.attributes?.find((a) => a.trait_type === "Card")?.value;
  return typeof card === "string" && card.includes(":") ? card : null;
}

/**
 * Restore SQLite assignments from TonAPI cached metadata (what Tonkeeper shows).
 * Prevents random re-roll after Render disk wipe.
 */
export async function hydrateAssignmentsFromTonApi(db: Db): Promise<number> {
  if (Date.now() - lastHydrateAt < 30_000) return 0;
  const collection = getCollectionAddress().toRawString();
  const url = `${tonApiBase()}/v2/nfts/collections/${encodeURIComponent(collection)}/items?limit=1000`;
  const data = (await fetchJson(url)) as {
    nft_items?: Array<{
      index: number;
      metadata?: {
        attributes?: Array<{ trait_type?: string; value?: unknown }>;
      };
    }>;
  };

  let n = 0;
  for (const item of data.nft_items ?? []) {
    const tokenId = Number(item.index);
    const key = cardKeyFromMetadata(item.metadata);
    if (!Number.isInteger(tokenId) || tokenId < 0 || !key) continue;
    if (upsertAssignmentFromCardKey(db, tokenId, key)) n += 1;
  }
  lastHydrateAt = Date.now();
  return n;
}

export async function buildWalletHoldings(
  db: Db,
  ownerAddress: string
): Promise<{
  address: string;
  count: number;
  items: HoldingItem[];
  legendaryProgress: LegendaryPersonProgress[];
  reveal: boolean;
}> {
  try {
    await hydrateAssignmentsFromTonApi(db);
  } catch {
    /* indexer optional */
  }

  const nfts = await fetchWalletCollectionNfts(ownerAddress);

  // Only randomly backfill tokens the indexer has not described yet.
  const missing = nfts
    .map((n) => n.tokenId)
    .filter((id) => !getAssignment(db, id));
  if (missing.length > 0) {
    assignCardsForTokens(db, missing);
  }

  let reveal = false;
  try {
    reveal = Boolean((await readCollectionState()).revealEnabled);
  } catch {
    reveal = false;
  }
  const hiddenImage = getHiddenImageUrl();

  const items: HoldingItem[] = nfts
    .map((nft) => {
      const assigned = getAssignment(db, nft.tokenId);
      return {
        tokenId: nft.tokenId,
        address: nft.address,
        name: assigned?.name ?? `Alamdar #${nft.tokenId}`,
        rarity: assigned?.rarity ?? null,
        cardKey: assigned?.cardKey ?? null,
        image: reveal ? assigned?.image ?? null : hiddenImage,
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
    reveal,
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
