import { openDB, type IDBPDatabase } from 'idb';
import type { RedactionProfile } from '@redact/shared';

const DB_NAME = 'redact-local';
const DB_VERSION = 1;
const PROFILES_STORE = 'profiles';

let dbPromise: Promise<IDBPDatabase> | null = null;

function getDb(): Promise<IDBPDatabase> {
  if (!dbPromise) {
    dbPromise = openDB(DB_NAME, DB_VERSION, {
      upgrade(db) {
        if (!db.objectStoreNames.contains(PROFILES_STORE)) {
          db.createObjectStore(PROFILES_STORE, { keyPath: 'id' });
        }
      },
    });
  }
  return dbPromise;
}

export async function getLocalProfiles(): Promise<RedactionProfile[]> {
  const db = await getDb();
  return db.getAll(PROFILES_STORE);
}

export async function saveLocalProfile(profile: RedactionProfile): Promise<void> {
  const db = await getDb();
  await db.put(PROFILES_STORE, profile);
}

export async function deleteLocalProfile(id: string): Promise<void> {
  const db = await getDb();
  await db.delete(PROFILES_STORE, id);
}
