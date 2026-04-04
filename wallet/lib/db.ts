import Database from "better-sqlite3";
import path from "path";

let db: Database.Database | null = null;

export function getDb(): Database.Database {
  if (!db) {
    const dbPath = path.join(process.cwd(), "cannes-wallet.db");
    db = new Database(dbPath);
    db.pragma("journal_mode = WAL");
    db.pragma("foreign_keys = ON");
    initTables(db);
  }
  return db;
}

function initTables(db: Database.Database) {
  db.exec(`
    CREATE TABLE IF NOT EXISTS accounts (
      address TEXT PRIMARY KEY,
      username TEXT NOT NULL,
      unlink_mnemonic TEXT,
      unlink_address TEXT,
      created_at TEXT DEFAULT (datetime('now'))
    );

    CREATE TABLE IF NOT EXISTS burners (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      owner_address TEXT NOT NULL,
      burner_address TEXT NOT NULL,
      private_key TEXT NOT NULL,
      network TEXT NOT NULL,
      status TEXT DEFAULT 'created',
      token TEXT,
      amount TEXT,
      created_at TEXT DEFAULT (datetime('now')),
      disposed_at TEXT,
      FOREIGN KEY (owner_address) REFERENCES accounts(address)
    );

    CREATE TABLE IF NOT EXISTS transactions (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      owner_address TEXT NOT NULL,
      type TEXT NOT NULL,
      network TEXT NOT NULL,
      status TEXT NOT NULL,
      amount TEXT,
      token TEXT,
      recipient TEXT,
      tx_hash TEXT,
      unlink_tx_id TEXT,
      payment_id TEXT,
      metadata TEXT,
      created_at TEXT DEFAULT (datetime('now')),
      updated_at TEXT DEFAULT (datetime('now')),
      FOREIGN KEY (owner_address) REFERENCES accounts(address)
    );
  `);
}

// --- Account queries ---

export function upsertAccount(address: string, username: string) {
  const db = getDb();
  db.prepare(`
    INSERT INTO accounts (address, username) VALUES (?, ?)
    ON CONFLICT(address) DO UPDATE SET username = excluded.username
  `).run(address, username);
}

export function getAccount(address: string) {
  return getDb().prepare("SELECT * FROM accounts WHERE address = ?").get(address) as {
    address: string;
    username: string;
    unlink_mnemonic: string | null;
    unlink_address: string | null;
  } | undefined;
}

export function setUnlinkMnemonic(address: string, mnemonic: string, unlinkAddress: string) {
  getDb().prepare(
    "UPDATE accounts SET unlink_mnemonic = ?, unlink_address = ? WHERE address = ?"
  ).run(mnemonic, unlinkAddress, address);
}

// --- Burner queries ---

export function insertBurner(
  ownerAddress: string,
  burnerAddress: string,
  privateKey: string,
  network: string,
  token: string,
  amount: string
) {
  return getDb().prepare(`
    INSERT INTO burners (owner_address, burner_address, private_key, network, token, amount, status)
    VALUES (?, ?, ?, ?, ?, ?, 'created')
  `).run(ownerAddress, burnerAddress, privateKey, network, token, amount);
}

export function updateBurnerStatus(burnerAddress: string, status: string) {
  getDb().prepare(
    "UPDATE burners SET status = ?, disposed_at = CASE WHEN ? = 'disposed' THEN datetime('now') ELSE disposed_at END WHERE burner_address = ?"
  ).run(status, status, burnerAddress);
}

export function getActiveBurner(ownerAddress: string, network: string) {
  return getDb().prepare(
    "SELECT * FROM burners WHERE owner_address = ? AND network = ? AND status NOT IN ('disposed', 'failed') ORDER BY created_at DESC LIMIT 1"
  ).get(ownerAddress, network) as {
    burner_address: string;
    private_key: string;
    network: string;
    status: string;
    token: string;
    amount: string;
  } | undefined;
}

// --- Transaction queries ---

export function insertTransaction(tx: {
  ownerAddress: string;
  type: string;
  network: string;
  status: string;
  amount?: string;
  token?: string;
  recipient?: string;
  txHash?: string;
  unlinkTxId?: string;
  paymentId?: string;
  metadata?: string;
}) {
  return getDb().prepare(`
    INSERT INTO transactions (owner_address, type, network, status, amount, token, recipient, tx_hash, unlink_tx_id, payment_id, metadata)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `).run(
    tx.ownerAddress, tx.type, tx.network, tx.status,
    tx.amount ?? null, tx.token ?? null, tx.recipient ?? null,
    tx.txHash ?? null, tx.unlinkTxId ?? null, tx.paymentId ?? null,
    tx.metadata ?? null
  );
}

export function updateTransaction(id: number, updates: { status?: string; txHash?: string; unlinkTxId?: string }) {
  const sets: string[] = ["updated_at = datetime('now')"];
  const vals: unknown[] = [];
  if (updates.status) { sets.push("status = ?"); vals.push(updates.status); }
  if (updates.txHash) { sets.push("tx_hash = ?"); vals.push(updates.txHash); }
  if (updates.unlinkTxId) { sets.push("unlink_tx_id = ?"); vals.push(updates.unlinkTxId); }
  vals.push(id);
  getDb().prepare(`UPDATE transactions SET ${sets.join(", ")} WHERE id = ?`).run(...vals);
}

export function getTransactions(ownerAddress: string, limit = 50) {
  return getDb().prepare(
    "SELECT * FROM transactions WHERE owner_address = ? ORDER BY created_at DESC LIMIT ?"
  ).all(ownerAddress, limit) as Array<{
    id: number;
    type: string;
    network: string;
    status: string;
    amount: string | null;
    token: string | null;
    recipient: string | null;
    tx_hash: string | null;
    created_at: string;
  }>;
}
