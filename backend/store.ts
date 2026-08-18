/**
 * Thin DB access point.
 * Today: better-sqlite3 file (local or Render Disk via DATA_DIR).
 * Later: can swap implementation to Turso/Postgres without rewriting routes.
 */
export const db = require("./database");
