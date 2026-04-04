import { MongoClient, ObjectId, type Db, type Collection } from "mongodb";

const MONGODB_URI = process.env.MONGODB_URI!;

let client: MongoClient | null = null;
let db: Db | null = null;

async function getDb(): Promise<Db> {
  if (db) return db;
  client = new MongoClient(MONGODB_URI);
  await client.connect();
  db = client.db(); // uses DB name from connection string
  // Create indexes (idempotent)
  await db.collection("accounts").createIndex({ address: 1 }, { unique: true });
  await db.collection("burners").createIndex({ owner_address: 1, network: 1 });
  await db.collection("transactions").createIndex({ owner_address: 1 });
  return db;
}

function accounts(): Promise<Collection> {
  return getDb().then((d) => d.collection("accounts"));
}
function burners(): Promise<Collection> {
  return getDb().then((d) => d.collection("burners"));
}
function transactions(): Promise<Collection> {
  return getDb().then((d) => d.collection("transactions"));
}

// --- Account queries ---

export async function upsertAccount(address: string, username: string) {
  const col = await accounts();
  await col.updateOne(
    { address },
    { $set: { address, username }, $setOnInsert: { unlink_mnemonic: null, unlink_address: null, created_at: new Date().toISOString() } },
    { upsert: true }
  );
}

export async function getAccount(address: string) {
  const col = await accounts();
  const doc = await col.findOne({ address });
  if (!doc) return undefined;
  return {
    address: doc.address as string,
    username: doc.username as string,
    unlink_mnemonic: (doc.unlink_mnemonic as string) ?? null,
    unlink_address: (doc.unlink_address as string) ?? null,
  };
}

export async function setUnlinkMnemonic(address: string, mnemonic: string, unlinkAddress: string) {
  const col = await accounts();
  await col.updateOne({ address }, { $set: { unlink_mnemonic: mnemonic, unlink_address: unlinkAddress } });
}

// --- Burner queries ---

export async function insertBurner(
  ownerAddress: string,
  burnerAddress: string,
  privateKey: string,
  network: string,
  token: string,
  amount: string
) {
  const col = await burners();
  await col.insertOne({
    owner_address: ownerAddress,
    burner_address: burnerAddress,
    private_key: privateKey,
    network,
    status: "created",
    token,
    amount,
    created_at: new Date().toISOString(),
    disposed_at: null,
  });
}

export async function updateBurnerStatus(burnerAddress: string, status: string) {
  const col = await burners();
  const update: Record<string, unknown> = { status };
  if (status === "disposed") update.disposed_at = new Date().toISOString();
  await col.updateOne({ burner_address: burnerAddress }, { $set: update });
}

export async function getActiveBurner(ownerAddress: string, network: string) {
  const col = await burners();
  const doc = await col.findOne(
    { owner_address: ownerAddress, network, status: { $nin: ["disposed", "failed"] } },
    { sort: { created_at: -1 } }
  );
  if (!doc) return undefined;
  return {
    burner_address: doc.burner_address as string,
    private_key: doc.private_key as string,
    network: doc.network as string,
    status: doc.status as string,
    token: doc.token as string,
    amount: doc.amount as string,
  };
}

// --- Transaction queries ---

export async function insertTransaction(tx: {
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
  const col = await transactions();
  const result = await col.insertOne({
    owner_address: tx.ownerAddress,
    type: tx.type,
    network: tx.network,
    status: tx.status,
    amount: tx.amount ?? null,
    token: tx.token ?? null,
    recipient: tx.recipient ?? null,
    tx_hash: tx.txHash ?? null,
    unlink_tx_id: tx.unlinkTxId ?? null,
    payment_id: tx.paymentId ?? null,
    metadata: tx.metadata ?? null,
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
  });
  return { insertedId: result.insertedId };
}

export async function updateTransaction(id: ObjectId, updates: { status?: string; txHash?: string; unlinkTxId?: string }) {
  const col = await transactions();
  const set: Record<string, unknown> = { updated_at: new Date().toISOString() };
  if (updates.status) set.status = updates.status;
  if (updates.txHash) set.tx_hash = updates.txHash;
  if (updates.unlinkTxId) set.unlink_tx_id = updates.unlinkTxId;
  await col.updateOne({ _id: id }, { $set: set });
}

export async function getTransactions(ownerAddress: string, limit = 50) {
  const col = await transactions();
  const docs = await col.find({ owner_address: ownerAddress }).sort({ created_at: -1 }).limit(limit).toArray();
  return docs.map((d) => ({
    id: d._id.toString(),
    type: d.type as string,
    network: d.network as string,
    status: d.status as string,
    amount: (d.amount as string) ?? null,
    token: (d.token as string) ?? null,
    recipient: (d.recipient as string) ?? null,
    tx_hash: (d.tx_hash as string) ?? null,
    created_at: d.created_at as string,
  }));
}
