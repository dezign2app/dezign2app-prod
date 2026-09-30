/**
 * In-Browser Checkpointer with IndexedDB persistence
 * Enables multi-turn LangGraph testing and session state recall in the browser.
 */

export interface BrowserCheckpoint {
  id: string;
  threadId: string;
  stepId: string;
  stepName: string;
  state: Record<string, unknown>;
  timestamp: number;
}

const DB_NAME = "dezign2app-langgraph-checkpoints";
const STORE_NAME = "checkpoints";
const DB_VERSION = 1;

// In-memory fallback if IndexedDB is unavailable
const memoryCheckpoints = new Map<string, BrowserCheckpoint[]>();

function openCheckpointerDB(): Promise<IDBDatabase | null> {
  if (typeof indexedDB === "undefined") return Promise.resolve(null);
  return new Promise((resolve, reject) => {
    const request = indexedDB.open(DB_NAME, DB_VERSION);
    request.onupgradeneeded = () => {
      const db = request.result;
      if (!db.objectStoreNames.contains(STORE_NAME)) {
        const store = db.createObjectStore(STORE_NAME, { keyPath: "id" });
        store.createIndex("threadId", "threadId", { unique: false });
        store.createIndex("timestamp", "timestamp", { unique: false });
      }
    };
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error ?? new Error("Failed to open checkpointer database"));
  });
}

export async function saveBrowserCheckpoint(checkpoint: BrowserCheckpoint): Promise<void> {
  // Update in-memory
  const list = memoryCheckpoints.get(checkpoint.threadId) || [];
  list.push(checkpoint);
  memoryCheckpoints.set(checkpoint.threadId, list);

  // Update IndexedDB
  const db = await openCheckpointerDB();
  if (!db) return;

  return new Promise((resolve, reject) => {
    const transaction = db.transaction(STORE_NAME, "readwrite");
    const store = transaction.objectStore(STORE_NAME);
    store.put(checkpoint);
    transaction.oncomplete = () => resolve();
    transaction.onerror = () => reject(transaction.error ?? new Error("Failed to save checkpoint"));
  });
}

export async function getBrowserCheckpoints(threadId: string): Promise<BrowserCheckpoint[]> {
  const db = await openCheckpointerDB();
  if (!db) {
    return memoryCheckpoints.get(threadId) || [];
  }

  return new Promise((resolve, reject) => {
    const transaction = db.transaction(STORE_NAME, "readonly");
    const store = transaction.objectStore(STORE_NAME);
    const index = store.index("threadId");
    const request = index.getAll(threadId);

    request.onsuccess = () => {
      const results = (request.result as BrowserCheckpoint[]) || [];
      results.sort((a, b) => a.timestamp - b.timestamp);
      resolve(results);
    };
    request.onerror = () => reject(request.error ?? new Error("Failed to read checkpoints"));
  });
}

export async function getLatestBrowserCheckpoint(threadId: string): Promise<BrowserCheckpoint | null> {
  const list = await getBrowserCheckpoints(threadId);
  const latest = list[list.length - 1];
  return latest ?? null;
}

export async function clearBrowserThread(threadId: string): Promise<void> {
  memoryCheckpoints.delete(threadId);

  const db = await openCheckpointerDB();
  if (!db) return;

  const checkpoints = await getBrowserCheckpoints(threadId);
  return new Promise((resolve, reject) => {
    const transaction = db.transaction(STORE_NAME, "readwrite");
    const store = transaction.objectStore(STORE_NAME);
    for (const cp of checkpoints) {
      store.delete(cp.id);
    }
    transaction.oncomplete = () => resolve();
    transaction.onerror = () => reject(transaction.error ?? new Error("Failed to clear thread checkpoints"));
  });
}

export async function listAllBrowserThreads(): Promise<string[]> {
  const db = await openCheckpointerDB();
  if (!db) {
    return Array.from(memoryCheckpoints.keys());
  }

  return new Promise((resolve, reject) => {
    const transaction = db.transaction(STORE_NAME, "readonly");
    const store = transaction.objectStore(STORE_NAME);
    const request = store.getAll();

    request.onsuccess = () => {
      const all = (request.result as BrowserCheckpoint[]) || [];
      const threadSet = new Set<string>();
      for (const cp of all) {
        if (cp.threadId) threadSet.add(cp.threadId);
      }
      resolve(Array.from(threadSet));
    };
    request.onerror = () => reject(request.error ?? new Error("Failed to list threads"));
  });
}
