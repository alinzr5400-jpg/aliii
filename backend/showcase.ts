/**
 * Curated Mini App showcase + martyr bios (1–114).
 * Card major 0 → martyr id 1; major N (N≥1) → martyr id N.
 */
import fs from "node:fs";
import path from "node:path";
import {
  getLegendaryImageUrl,
  getMythicImageUrl,
  getUniqueImageUrl,
} from "./media";

export const SHOWCASE_STEMS = [
  "111-1",
  "68-1",
  "110-2",
  "26-1",
  "36-2",
  "17-2",
  "19-2",
  "31-2",
  "0-1",
  "1-5",
  "1-3",
  "2-6",
  "3-3",
  "9-1",
] as const;

export type MartyrBio = {
  id: number;
  name: string;
  summary: string;
};

export type ShowcaseItem = {
  stem: string;
  major: number;
  name: string;
  summary: string;
  rarity: "Legendary" | "Mythic" | "Unique";
  image: string;
  martyrId: number;
};

let cachedBios: MartyrBio[] | null = null;

export function loadMartyrBios(): MartyrBio[] {
  if (cachedBios) return cachedBios;
  const file = path.join(__dirname, "martyrBios.json");
  const rows = JSON.parse(fs.readFileSync(file, "utf8")) as MartyrBio[];
  if (!Array.isArray(rows) || rows.length !== 114) {
    throw new Error(`martyrBios.json must have 114 entries, got ${rows?.length}`);
  }
  cachedBios = rows;
  return rows;
}

export function martyrIdFromMajor(major: number): number {
  if (major === 0) return 1;
  return major;
}

export function getMartyrById(id: number): MartyrBio | undefined {
  return loadMartyrBios().find((m) => m.id === id);
}

export function getMartyrByMajor(major: number): MartyrBio | undefined {
  return getMartyrById(martyrIdFromMajor(major));
}

function rarityFromMajor(major: number): "Legendary" | "Mythic" | "Unique" {
  if (major <= 10) return "Legendary";
  if (major <= 60) return "Mythic";
  return "Unique";
}

function imageFromStem(stem: string): string {
  const file = `${stem}.jpg`;
  const major = Number(stem.split("-")[0]);
  if (major <= 10) return getLegendaryImageUrl(file);
  if (major <= 60) return getMythicImageUrl(file);
  return getUniqueImageUrl(file);
}

export function buildShowcaseItems(
  stems: readonly string[] = SHOWCASE_STEMS
): ShowcaseItem[] {
  return stems.map((stem) => {
    const major = Number(stem.split("-")[0]);
    const martyr = getMartyrByMajor(major);
    const rarity = rarityFromMajor(major);
    return {
      stem,
      major,
      martyrId: martyrIdFromMajor(major),
      name: martyr?.name ?? `علمدار ${stem.replace("-", "/")}`,
      summary: martyr?.summary ?? "",
      rarity,
      image: imageFromStem(stem),
    };
  });
}
