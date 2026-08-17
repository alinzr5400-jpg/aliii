/**
 * Pinata / IPFS media for Alamdar dynamic metadata.
 * Images live on IPFS; JSON metadata stays dynamic via GET /nft/:id.
 */

const DEFAULT_GATEWAY =
  process.env.IPFS_GATEWAY?.replace(/\/$/, "") ||
  "https://gateway.pinata.cloud/ipfs";

export const HIDDEN_IMAGE_CID =
  process.env.HIDDEN_IMAGE_CID?.trim() ||
  "bafybeigsk72nzcyweotcgzxzzoryhfc6azdqro66xbsayyuiembksur3je";

/** Folder CID for NFT_Legendary (41 jpgs: 0-1.jpg … 10-3.jpg) */
export const LEGENDARY_FOLDER_CID =
  process.env.IPFS_LEGENDARY_CID?.trim() ||
  "bafybeid5gyufb36n5iq7jfuylrqpvxefmej24kyzzvrhp7fmpkxdxsqnrq";

/** Folder CID for NFT_Mythic (100 jpgs: 11-1.jpg … 60-2.jpg) */
export const MYTHIC_FOLDER_CID =
  process.env.IPFS_MYTHIC_CID?.trim() ||
  "bafybeiera5opfkep6tyqqfktdq7ez33cgxnyesg6splmf7jwne2i5al3uu";

/** Folder CID for NFT_Unique (108 jpgs: 61-1.jpg … 114-2.jpg) */
export const UNIQUE_FOLDER_CID =
  process.env.IPFS_UNIQUE_CID?.trim() ||
  "bafybeic63nnkc2gzhh3ylui66uivoroxja572zhrraavmkcjpkc74cck4a";

/** @deprecated use MYTHIC_FOLDER_CID */
export const RARE_FOLDER_CID =
  process.env.IPFS_RARE_CID?.trim() || MYTHIC_FOLDER_CID;
/** @deprecated use UNIQUE_FOLDER_CID */
export const COMMON_FOLDER_CID =
  process.env.IPFS_COMMON_CID?.trim() || UNIQUE_FOLDER_CID;

/** Filenames in the Legendary Pinata folder */
export const LEGENDARY_FILES = [
  "0-1.jpg",
  "0-2.jpg",
  "1-1.jpg",
  "1-2.jpg",
  "1-3.jpg",
  "1-4.jpg",
  "1-5.jpg",
  "1-6.jpg",
  "1-7.jpg",
  "1-8.jpg",
  "1-9.jpg",
  "2-1.jpg",
  "2-2.jpg",
  "2-3.jpg",
  "2-4.jpg",
  "2-5.jpg",
  "2-6.jpg",
  "3-1.jpg",
  "3-2.jpg",
  "3-3.jpg",
  "4-1.jpg",
  "4-2.jpg",
  "4-3.jpg",
  "5-1.jpg",
  "5-2.jpg",
  "5-3.jpg",
  "6-1.jpg",
  "6-2.jpg",
  "6-3.jpg",
  "7-1.jpg",
  "7-2.jpg",
  "7-3.jpg",
  "8-1.jpg",
  "8-2.jpg",
  "8-3.jpg",
  "9-1.jpg",
  "9-2.jpg",
  "9-3.jpg",
  "10-1.jpg",
  "10-2.jpg",
  "10-3.jpg",
] as const;

/** Mythic: 11-1 … 60-2 (each major has -1 and -2) */
export const MYTHIC_FILES: string[] = (() => {
  const files: string[] = [];
  for (let major = 11; major <= 60; major++) {
    files.push(`${major}-1.jpg`, `${major}-2.jpg`);
  }
  return files;
})();

/** Unique: 61-1 … 114-2 (each major has -1 and -2) */
export const UNIQUE_FILES: string[] = (() => {
  const files: string[] = [];
  for (let major = 61; major <= 114; major++) {
    files.push(`${major}-1.jpg`, `${major}-2.jpg`);
  }
  return files;
})();

export function ipfsUrl(cid: string, path?: string): string {
  const base = `${DEFAULT_GATEWAY}/${cid}`;
  if (!path) return base;
  return `${base}/${path.replace(/^\//, "")}`;
}

export function getHiddenImageUrl(): string {
  return (
    process.env.HIDDEN_IMAGE_URL?.trim() ||
    ipfsUrl(HIDDEN_IMAGE_CID)
  );
}

export function getLegendaryImageUrl(filename: string): string {
  return ipfsUrl(LEGENDARY_FOLDER_CID, filename);
}

export function getMythicImageUrl(filename: string): string {
  return ipfsUrl(MYTHIC_FOLDER_CID, filename);
}

export function getUniqueImageUrl(filename: string): string {
  return ipfsUrl(UNIQUE_FOLDER_CID, filename);
}

export type RarityTier = "Legendary" | "Mythic" | "Unique";

export function getRarityFolderCid(rarity: RarityTier): string {
  if (rarity === "Legendary") return LEGENDARY_FOLDER_CID;
  if (rarity === "Mythic") return MYTHIC_FOLDER_CID;
  return UNIQUE_FOLDER_CID;
}
