import { openDB, type IDBPDatabase } from "idb";

const DB_NAME = "hexworld";
const DB_VERSION = 1;
const STORE_NAME = "keyval";

let dbPromise: Promise<IDBPDatabase> | null = null;

function getDb(): Promise<IDBPDatabase> {
  if (!dbPromise) {
    dbPromise = openDB(DB_NAME, DB_VERSION, {
      upgrade(db, oldVersion) {
        if (oldVersion < 1) {
          db.createObjectStore(STORE_NAME);
        }
        // Future schema versions add their migrations here, keyed off oldVersion.
      },
    });
  }
  return dbPromise;
}

export async function get<T>(key: string): Promise<T | undefined> {
  const db = await getDb();
  return db.get(STORE_NAME, key);
}

export async function set<T>(key: string, value: T): Promise<void> {
  const db = await getDb();
  await db.put(STORE_NAME, value, key);
}

export async function del(key: string): Promise<void> {
  const db = await getDb();
  await db.delete(STORE_NAME, key);
}
