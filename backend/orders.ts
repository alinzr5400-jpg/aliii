import { randomUUID } from "crypto";

type Db = {
  prepare: (sql: string) => {
    run: (...args: unknown[]) => unknown;
    get: (...args: unknown[]) => unknown;
    all: (...args: unknown[]) => unknown[];
  };
  exec: (sql: string) => void;
};

export type MintOrder = {
  id: string;
  buyer: string;
  count: number;
  amount_nano: string;
  mode: string;
  status: string;
  created_at: number;
  mint_indices: string | null;
  tx_hash: string | null;
  start_index: number | null;
};

export function ensureOrdersTable(db: Db) {
  db.exec(`
    CREATE TABLE IF NOT EXISTS orders (
      id TEXT PRIMARY KEY,
      buyer TEXT NOT NULL,
      count INTEGER NOT NULL,
      amount_nano TEXT NOT NULL,
      mode TEXT NOT NULL,
      status TEXT NOT NULL,
      created_at INTEGER NOT NULL,
      mint_indices TEXT,
      tx_hash TEXT,
      start_index INTEGER
    );
  `);
  // Additive migration for older DBs
  try {
    db.prepare("SELECT start_index FROM orders LIMIT 1").get();
  } catch {
    db.exec("ALTER TABLE orders ADD COLUMN start_index INTEGER");
  }
}

export function createOrder(
  db: Db,
  args: {
    buyer: string;
    count: number;
    amountNano: string;
    mode: string;
    startIndex?: number | null;
  }
): MintOrder {
  const id = randomUUID().replace(/-/g, "").slice(0, 16);
  const created_at = Math.floor(Date.now() / 1000);
  db.prepare(
    `INSERT INTO orders (id, buyer, count, amount_nano, mode, status, created_at, mint_indices, tx_hash, start_index)
     VALUES (?, ?, ?, ?, ?, 'pending', ?, NULL, NULL, ?)`
  ).run(
    id,
    args.buyer,
    args.count,
    args.amountNano,
    args.mode,
    created_at,
    args.startIndex ?? null
  );

  return getOrder(db, id)!;
}

export function getOrder(db: Db, id: string): MintOrder | undefined {
  return db.prepare(`SELECT * FROM orders WHERE id = ?`).get(id) as
    | MintOrder
    | undefined;
}

export function updateOrderStatus(
  db: Db,
  id: string,
  status: string,
  extra?: { mintIndices?: number[]; txHash?: string }
) {
  db.prepare(
    `UPDATE orders
     SET status = ?,
         mint_indices = COALESCE(?, mint_indices),
         tx_hash = COALESCE(?, tx_hash)
     WHERE id = ?`
  ).run(
    status,
    extra?.mintIndices ? JSON.stringify(extra.mintIndices) : null,
    extra?.txHash ?? null,
    id
  );
}
