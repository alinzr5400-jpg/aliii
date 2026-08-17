/**
 * Seed SQLite martyrs table for dynamic /nft/:id fallback metadata.
 * Prefer card_assignments after mint; this table is a secondary fallback.
 *
 * Run from alamdar-contract root:
 *   npx tsx backend/seed-media.ts
 */
import Database from "better-sqlite3";
import path from "node:path";
import { buildCardCatalog, TOTAL_SUPPLY } from "./cardCatalog";

const dbPath =
  process.env.DB_PATH ||
  path.join(process.cwd(), "backend", "alamdar.db");

const db = new Database(dbPath);

db.exec(`
CREATE TABLE IF NOT EXISTS martyrs(
  id INTEGER PRIMARY KEY,
  name TEXT,
  rarity TEXT,
  image TEXT
);
`);

db.prepare("DELETE FROM martyrs").run();

const insert = db.prepare(`
INSERT INTO martyrs(id, name, rarity, image)
VALUES(?, ?, ?, ?)
`);

const cards = buildCardCatalog();
let id = 0;
const tx = db.transaction(() => {
  for (const card of cards) {
    for (let i = 0; i < card.copies; i++) {
      if (id >= TOTAL_SUPPLY) break;
      insert.run(id, card.name, card.rarity, card.image);
      id += 1;
    }
  }
});
tx();

console.log(
  `Seed complete → ${dbPath}\n` +
    `Rows: ${id} (expected ${TOTAL_SUPPLY})\n` +
    `Arts: ${cards.length}`
);
