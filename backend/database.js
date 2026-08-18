const fs = require("fs");
const path = require("path");
const Database = require("better-sqlite3");

/**
 * Resolve SQLite path.
 * On Render with a persistent disk, set:
 *   DATA_DIR=/var/data
 *   (optional) DB_PATH=/var/data/alamdar.db
 * Without DATA_DIR, uses ./alamdar.db (ephemeral on Render free diskless deploys).
 */
function resolveDbPath() {
  if (process.env.DB_PATH?.trim()) {
    return process.env.DB_PATH.trim();
  }
  const dataDir = process.env.DATA_DIR?.trim();
  if (dataDir) {
    return path.join(dataDir, "alamdar.db");
  }
  return path.join(process.cwd(), "alamdar.db");
}

const dbPath = resolveDbPath();
fs.mkdirSync(path.dirname(dbPath), { recursive: true });

const db = new Database(dbPath);
console.log(`[alamdar] SQLite at ${dbPath}`);

db.exec(`
CREATE TABLE IF NOT EXISTS settings(
    key TEXT PRIMARY KEY,
    value TEXT
);

CREATE TABLE IF NOT EXISTS martyrs(
    id INTEGER PRIMARY KEY,
    name TEXT,
    rarity TEXT,
    image TEXT
);
`);

module.exports = db;
