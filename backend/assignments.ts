import {
  assertCatalogTotals,
  buildCardCatalog,
  TOTAL_SUPPLY,
} from "./cardCatalog";

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

/**
 * Seed full 16,120 inventory slots (one row per copy).
 * Idempotent when count already matches TOTAL_SUPPLY.
 * Preserves existing token assignments by re-marking matching free slots.
 */
export function seedCardInventory(db: Db) {
  ensureAssignmentTables(db);
  const cards = buildCardCatalog();
  const totals = assertCatalogTotals(cards);

  const countRow = db
    .prepare("SELECT COUNT(*) AS c FROM card_inventory")
    .get() as { c: number };
  if (countRow.c === TOTAL_SUPPLY) {
    return totals;
  }

  const existingAssignments = db
    .prepare(
      `SELECT token_id, name, rarity, image FROM card_assignments`
    )
    .all() as Array<{
    token_id: number;
    name: string;
    rarity: string;
    image: string;
  }>;

  db.exec("DELETE FROM card_inventory");

  const insert = db.prepare(`
    INSERT INTO card_inventory(card_key, name, rarity, image, assigned_token_id)
    VALUES (?, ?, ?, ?, NULL)
  `);

  for (const card of cards) {
    for (let i = 0; i < card.copies; i++) {
      const key = `${card.rarity.toLowerCase()}:${card.stem}#${i}`;
      insert.run(key, card.name, card.rarity, card.image);
    }
  }

  const mark = db.prepare(
    `UPDATE card_inventory
     SET assigned_token_id = ?
     WHERE card_key = (
       SELECT card_key FROM card_inventory
       WHERE assigned_token_id IS NULL AND image = ?
       LIMIT 1
     )`
  );
  for (const row of existingAssignments) {
    mark.run(row.token_id, row.image);
  }

  return totals;
}

/** @deprecated use seedCardInventory */
export function seedLegendaryInventory(db: Db) {
  return seedCardInventory(db);
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
 * Picks unused inventory slots without replacement.
 */
export function assignCardsForTokens(
  db: Db,
  tokenIds: number[]
): CardAssignment[] {
  ensureAssignmentTables(db);
  seedCardInventory(db);

  const results: CardAssignment[] = [];
  const now = Math.floor(Date.now() / 1000);

  const getExisting = db.prepare(
    `SELECT token_id, card_key, name, rarity, image FROM card_assignments WHERE token_id = ?`
  );
  const pickStmt = db.prepare(
    `SELECT card_key, name, rarity, image, assigned_token_id
     FROM card_inventory
     WHERE assigned_token_id IS NULL
     ORDER BY RANDOM()
     LIMIT 1`
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

    const pick = pickStmt.get() as InventoryRow | undefined;
    if (!pick) {
      throw new Error("Card inventory exhausted (all 16120 slots assigned)");
    }

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
