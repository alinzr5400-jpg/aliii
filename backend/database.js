const Database = require("better-sqlite3");

const db = new Database("alamdar.db");

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