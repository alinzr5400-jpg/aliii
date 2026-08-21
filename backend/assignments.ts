import {
  assertCatalogTotals,
  buildCardCatalog,
  TOTAL_SUPPLY,
  type CatalogCard,
} from "./cardCatalog";
import {
  LEGENDARY_FOLDER_CID,
  MYTHIC_FOLDER_CID,
  UNIQUE_FOLDER_CID,
  getMediaVersion,
  getPublicBaseUrl,
  useMediaProxy,
} from "./media";

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

function catalogFingerprint(): string {
  return [
    TOTAL_SUPPLY,
    LEGENDARY_FOLDER_CID,
    MYTHIC_FOLDER_CID,
    UNIQUE_FOLDER_CID,
    useMediaProxy() ? getPublicBaseUrl() || "proxy" : "direct",
    getMediaVersion(),
  ].join("|");
}

function stemFromCardKey(cardKey: string): string | null {
  // mythic:32-1#0  OR legacy legendary:0-1.jpg
  const body = cardKey.includes(":") ? cardKey.split(":")[1] : cardKey;
  if (!body) return null;
  return body.replace(/\.jpg$/i, "").split("#")[0] || null;
}

function cardByStem(
  cards: CatalogCard[],
  stem: string
): CatalogCard | undefined {
  return cards.find((c) => c.stem === stem);
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

    CREATE TABLE IF NOT EXISTS app_meta (
      key TEXT PRIMARY KEY,
      value TEXT NOT NULL
    );
  `);
}

/**
 * Token ids restart at 0 on each new collection deploy.
 * Assignments are keyed only by token_id — wipe when collection address changes
 * so old-collection art is not reused for the new collection's #0,#1,...
 */
export function resetAssignmentsIfCollectionChanged(db: Db) {
  ensureAssignmentTables(db);
  const current =
    process.env.TON_COLLECTION_ADDRESS?.trim() ||
    process.env.COLLECTION_ADDRESS?.trim() ||
    "";
  if (!current) return;

  const prev = db
    .prepare(`SELECT value FROM app_meta WHERE key = 'collection_addr'`)
    .get() as { value: string } | undefined;

  if (prev?.value === current) return;

  db.exec(`DELETE FROM card_assignments`);
  db.exec(`UPDATE card_inventory SET assigned_token_id = NULL`);
  db.prepare(
    `INSERT INTO app_meta(key, value) VALUES('collection_addr', ?)
     ON CONFLICT(key) DO UPDATE SET value = excluded.value`
  ).run(current);

  console.log(
    `[alamdar] Collection address changed — cleared card assignments for fresh mint map`
  );
}

function refreshAssignmentImages(db: Db, cards: CatalogCard[]) {
  const rows = db
    .prepare(`SELECT token_id, card_key, image FROM card_assignments`)
    .all() as Array<{ token_id: number; card_key: string; image: string }>;
  const update = db.prepare(
    `UPDATE card_assignments SET image = ?, name = ?, rarity = ? WHERE token_id = ?`
  );

  for (const row of rows) {
    const stem = stemFromCardKey(row.card_key);
    if (!stem) continue;
    const card = cardByStem(cards, stem);
    if (!card) continue;
    if (
      row.image === card.image &&
      /* name/rarity already ok */ true
    ) {
      // still sync name/rarity in case of catalog rename
    }
    update.run(card.image, card.name, card.rarity, row.token_id);
  }
}

/**
 * Seed full 16,120 inventory slots (one row per copy).
 * Rebuilds when supply or IPFS folder CIDs change (fixes broken image URLs).
 */
export function seedCardInventory(db: Db) {
  ensureAssignmentTables(db);
  const cards = buildCardCatalog();
  const totals = assertCatalogTotals(cards);
  const fp = catalogFingerprint();

  const countRow = db
    .prepare("SELECT COUNT(*) AS c FROM card_inventory")
    .get() as { c: number };
  const meta = db
    .prepare(`SELECT value FROM app_meta WHERE key = 'catalog_fp'`)
    .get() as { value: string } | undefined;

  if (countRow.c === TOTAL_SUPPLY && meta?.value === fp) {
    refreshAssignmentImages(db, cards);
    return totals;
  }

  const existingAssignments = db
    .prepare(
      `SELECT token_id, card_key, name, rarity, image FROM card_assignments`
    )
    .all() as Array<{
    token_id: number;
    card_key: string;
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

  const markByKey = db.prepare(
    `UPDATE card_inventory SET assigned_token_id = ? WHERE card_key = ?`
  );
  const markByStem = db.prepare(
    `UPDATE card_inventory
     SET assigned_token_id = ?
     WHERE card_key = (
       SELECT card_key FROM card_inventory
       WHERE assigned_token_id IS NULL
         AND card_key LIKE ?
       LIMIT 1
     )`
  );
  const updateAssignment = db.prepare(
    `UPDATE card_assignments SET card_key = ?, name = ?, rarity = ?, image = ? WHERE token_id = ?`
  );

  for (const row of existingAssignments) {
    const stem = stemFromCardKey(row.card_key);
    const card = stem ? cardByStem(cards, stem) : undefined;
    const image = card?.image ?? row.image;
    const name = card?.name ?? row.name;
    const rarity = card?.rarity ?? row.rarity;

    let usedKey = row.card_key;
    const exact = db
      .prepare(
        `SELECT card_key FROM card_inventory WHERE card_key = ? AND assigned_token_id IS NULL`
      )
      .get(row.card_key) as { card_key: string } | undefined;

    if (exact) {
      markByKey.run(row.token_id, row.card_key);
    } else if (stem) {
      markByStem.run(row.token_id, `%:${stem}#%`);
      const marked = db
        .prepare(
          `SELECT card_key FROM card_inventory WHERE assigned_token_id = ?`
        )
        .get(row.token_id) as { card_key: string } | undefined;
      if (marked) usedKey = marked.card_key;
    }

    updateAssignment.run(usedKey, name, rarity, image, row.token_id);
  }

  db.prepare(
    `INSERT INTO app_meta(key, value) VALUES('catalog_fp', ?)
     ON CONFLICT(key) DO UPDATE SET value = excluded.value`
  ).run(fp);

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

/**
 * Backfill random card assignments for on-chain minted token ids
 * that are missing from SQLite (e.g. after Render ephemeral disk wipe).
 */
export function ensureMintedAssignments(
  db: Db,
  mintedCount: number
): CardAssignment[] {
  if (!Number.isFinite(mintedCount) || mintedCount <= 0) return [];
  const ids = Array.from({ length: Math.floor(mintedCount) }, (_, i) => i);
  return assignCardsForTokens(db, ids);
}
