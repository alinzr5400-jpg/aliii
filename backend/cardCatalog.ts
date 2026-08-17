/**
 * Full Alamdar card catalog: rarities, IPFS folders, and copy counts.
 * Total supply = 16,120.
 */

import {
  getLegendaryImageUrl,
  getMythicImageUrl,
  getUniqueImageUrl,
  LEGENDARY_FILES,
  MYTHIC_FILES,
  UNIQUE_FILES,
} from "./media";
import fs from "node:fs";
import path from "node:path";

export const TOTAL_SUPPLY = 16120;

export type CardRarity = "Legendary" | "Mythic" | "Unique";

export type CatalogCard = {
  /** Stem without extension, e.g. "11-1" */
  stem: string;
  file: string;
  rarity: CardRarity;
  name: string;
  copies: number;
  image: string;
};

function legendaryCopies(stem: string): number {
  if (stem === "0-1" || stem === "0-2") return 1;
  if (/^1-[1-9]$/.test(stem)) return 10;
  if (/^2-[1-6]$/.test(stem)) return 20;
  return 40;
}

function loadLegendaryNames(): Map<string, string> {
  const file = path.join(__dirname, "legendary-cards.json");
  const rows = JSON.parse(fs.readFileSync(file, "utf8")) as Array<{
    name: string;
    file: string;
  }>;
  return new Map(rows.map((r) => [r.file.replace(/\.jpg$/i, ""), r.name]));
}

function displayName(stem: string, rarity: CardRarity): string {
  const [major, minor] = stem.split("-");
  if (minor === "1") return `علمدار ${major}`;
  return `علمدار ${major}٫${minor}`;
}

/** Build the authoritative list of unique artworks + copy counts. */
export function buildCardCatalog(): CatalogCard[] {
  const legendaryNames = loadLegendaryNames();
  const cards: CatalogCard[] = [];

  for (const file of LEGENDARY_FILES) {
    const stem = file.replace(/\.jpg$/i, "");
    cards.push({
      stem,
      file,
      rarity: "Legendary",
      name: legendaryNames.get(stem) ?? displayName(stem, "Legendary"),
      copies: legendaryCopies(stem),
      image: getLegendaryImageUrl(file),
    });
  }

  for (const file of MYTHIC_FILES) {
    const stem = file.replace(/\.jpg$/i, "");
    cards.push({
      stem,
      file,
      rarity: "Mythic",
      name: displayName(stem, "Mythic"),
      copies: 62,
      image: getMythicImageUrl(file),
    });
  }

  for (const file of UNIQUE_FILES) {
    const stem = file.replace(/\.jpg$/i, "");
    cards.push({
      stem,
      file,
      rarity: "Unique",
      name: displayName(stem, "Unique"),
      copies: 81,
      image: getUniqueImageUrl(file),
    });
  }

  return cards;
}

export function assertCatalogTotals(cards: CatalogCard[] = buildCardCatalog()) {
  const byRarity: Record<string, number> = {};
  let total = 0;
  for (const card of cards) {
    byRarity[card.rarity] = (byRarity[card.rarity] ?? 0) + card.copies;
    total += card.copies;
  }
  if (total !== TOTAL_SUPPLY) {
    throw new Error(
      `Card catalog copies sum to ${total}, expected ${TOTAL_SUPPLY}. ` +
        JSON.stringify(byRarity)
    );
  }
  return { total, byRarity, uniqueArts: cards.length };
}
