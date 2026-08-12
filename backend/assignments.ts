import { randomInt } from "node:crypto";
import {
  getLegendaryImageUrl,
  LEGENDARY_FILES,
} from "./media";
import fs from "node:fs";
import path from "node:path";

type Db = {
  prepare: (sql: string) => {
    run: (...args: unknown[]) => unknown;
    get: (...args: unknown[]) => unknown;
    all: (...args: unknown[]) => unknown[];
  };
  exec: (sql: string) => void;
};

export type CardAssignment = {
  tokenId: number;
  cardKey: string;
  name: string;
  rarity: string;
  image: string;
};

type InventoryRow = {
  card_key: string;
  name: string;
  rarity: string;
  image: string;
  assigned_token_id: number | null;
};

function loadLegendaryMeta(): Array<{ id: number; name: string; file: string }> {
  const file = path.join(__dirname, "legendary-cards.json");
  return JSON.parse(fs.readFileSync(file, "utf8"));
}

export function ensureAssignmentTables(db: Db) {
  db.exec(`
    CREATE TABLE IF NOT EXISTS card_inventory (
      card_key TEXT PRIMARY KEY,
      name TEXT NOT NULL,
      rarity TEXT NOT NULL,
      image TEXT NOT NULL,
      assigned_token_id INTEGER
    );

    CREATE TABLE IF NOT EXISTS card_assignments (
      token_id INTEGER PRIMARY KEY,
      card_key TEXT NOT NULL,
      name TEXT NOT NULL,
      rarity TEXT NOT NULL,
      image TEXT NOT NULL,
      assigned_at INTEGER NOT NULL
    );
  `);
}

/** Idempotent: add Legendary cards into the pool (Rare/Common later). */
export function seedLegendaryInventory(db: Db) {
  ensureAssignmentTables(db);
  const meta = loadLegendaryMeta();
  const byFile = new Map(meta.map((m) => [m.file, m]));
  const insert = db.prepare(`
    INSERT OR IGNORE INTO card_inventory(card_key, name, rarity, image, assigned_token_id)
    VALUES (?, ?, ?, ?, NULL)
  `);

  for (const file of LEGENDARY_FILES) {
    const card = byFile.get(file);
    const key = `legendary:${file}`;
    insert.run(
      key,
      card?.name ?? `علمدار Legendary (${file})`,
      "Legendary",
      getLegendaryImageUrl(file)
    );
  }
}

export function getAssignment(
  db: Db,
  tokenId: number
): CardAssignment | null {
  const row = db
    .prepare(
      `SELECT token_id, card_key, name, rarity, image
       FROM card_assignments WHERE token_id = ?`
    )
    .get(tokenId) as
    | {
        token_id: number;
        card_key: string;
        name: string;
        rarity: string;
        image: string;
      }
    | undefined;

  if (!row) return null;
  return {
    tokenId: row.token_id,
    cardKey: row.card_key,
    name: row.name,
    rarity: row.rarity,
    image: row.image,
  };
}

export function listAssignments(db: Db, limit = 24): CardAssignment[] {
  const rows = db
    .prepare(
      `SELECT token_id, card_key, name, rarity, image
       FROM card_assignments
       ORDER BY token_id ASC
       LIMIT ?`
    )
    .all(limit) as Array<{
    token_id: number;
    card_key: string;
    name: string;
    rarity: string;
    image: string;
  }>;

  return rows.map((row) => ({
    tokenId: row.token_id,
    cardKey: row.card_key,
    name: row.name,
    rarity: row.rarity,
    image: row.image,
  }));
}

/**
 * Random reveal assignment for minted on-chain token ids.
 * Picks unused inventory cards without replacement when possible.
 */
export function assignCardsForTokens(
  db: Db,
  tokenIds: number[]
): CardAssignment[] {
  ensureAssignmentTables(db);
  seedLegendaryInventory(db);

  const results: CardAssignment[] = [];
  const now = Math.floor(Date.now() / 1000);

  const getExisting = db.prepare(
    `SELECT token_id, card_key, name, rarity, image FROM card_assignments WHERE token_id = ?`
  );
  const availableStmt = db.prepare(
    `SELECT card_key, name, rarity, image, assigned_token_id
     FROM card_inventory
     WHERE assigned_token_id IS NULL`
  );
  const anyStmt = db.prepare(
    `SELECT card_key, name, rarity, image, assigned_token_id FROM card_inventory`
  );
  const markInventory = db.prepare(
    `UPDATE card_inventory SET assigned_token_id = ? WHERE card_key = ?`
  );
  const insertAssignment = db.prepare(`
    INSERT INTO card_assignments(token_id, card_key, name, rarity, image, assigned_at)
    VALUES (?, ?, ?, ?, ?, ?)
  `);

  for (const tokenId of tokenIds) {
    const existing = getExisting.get(tokenId) as
      | {
          token_id: number;
          card_key: string;
          name: string;
          rarity: string;
          image: string;
        }
      | undefined;

    if (existing) {
      results.push({
        tokenId: existing.token_id,
        cardKey: existing.card_key,
        name: existing.name,
        rarity: existing.rarity,
        image: existing.image,
      });
      continue;
    }

    let pool = availableStmt.all() as InventoryRow[];
    // If Legendary pool is exhausted, allow reuse from full inventory
    // until Rare/Common folders are added.
    if (pool.length === 0) {
      pool = anyStmt.all() as InventoryRow[];
    }
    if (pool.length === 0) {
      throw new Error("Card inventory is empty");
    }

    const pick = pool[randomInt(pool.length)];
    markInventory.run(tokenId, pick.card_key);
    insertAssignment.run(
      tokenId,
      pick.card_key,
      pick.name,
      pick.rarity,
      pick.image,
      now
    );

    results.push({
      tokenId,
      cardKey: pick.card_key,
      name: pick.name,
      rarity: pick.rarity,
      image: pick.image,
    });
  }

  return results;
}
