/**
 * Seed SQLite martyrs table for dynamic /nft/:id metadata.
 * - Legendary images: Pinata folder CID (41 files)
 * - Rare/Common: placeholders until those folder CIDs are provided
 *
 * Run from alamdar-contract root:
 *   npx tsx backend/seed-media.ts
 */
import Database from "better-sqlite3";
import fs from "node:fs";
import path from "node:path";
import {
  getHiddenImageUrl,
  getLegendaryImageUrl,
  LEGENDARY_FILES,
} from "./media";

const TOTAL = 12652;
const dbPath =
  process.env.DB_PATH ||
  path.join(process.cwd(), "backend", "alamdar.db");

const legendaryCards = JSON.parse(
  fs.readFileSync(path.join(__dirname, "legendary-cards.json"), "utf8")
) as Array<{ id: number; name: string; file: string }>;

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

const legendaryByIndex = new Map(
  (legendaryCards as Array<{ id: number; name: string; file: string }>).map(
    (c) => [c.id, c]
  )
);

const tx = db.transaction(() => {
  for (let id = 0; id < TOTAL; id++) {
    if (id < LEGENDARY_FILES.length) {
      const card = legendaryByIndex.get(id);
      const file = card?.file ?? LEGENDARY_FILES[id];
      insert.run(
        id,
        card?.name ?? `علمدار Legendary #${id}`,
        "Legendary",
        getLegendaryImageUrl(file)
      );
    } else {
      // Temporary placeholder until Rare/Common Pinata folders arrive
      insert.run(
        id,
        `علمدار #${id}`,
        "Pending",
        getHiddenImageUrl()
      );
    }
  }
});

tx();

console.log(
  `Seed complete → ${dbPath}\n` +
    `Legendary rows: ${LEGENDARY_FILES.length}\n` +
    `Hidden image: ${getHiddenImageUrl()}`
);
