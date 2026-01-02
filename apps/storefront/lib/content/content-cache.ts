/**
 * Content Cache - IndexedDB-based caching for offline support
 *
 * Uses IndexedDB for persistent storage that survives browser restarts
 * and works offline (PWA support)
 *
 * Handles SSR by checking if we're in browser before accessing IndexedDB
 */

const DB_NAME = "vcecom-content-cache";
const DB_VERSION = 1;
const STORE_NAME = "content";

interface CacheEntry {
  key: string;
  data: unknown;
  timestamp: number;
}

let dbPromise: Promise<IDBDatabase> | null = null;

/**
 * Check if we're in browser environment
 */
function isBrowser(): boolean {
  return typeof window !== "undefined" && typeof indexedDB !== "undefined";
}

/**
 * Open IndexedDB database
 */
function openDB(): Promise<IDBDatabase> {
  if (!isBrowser()) {
    return Promise.reject(new Error("IndexedDB is only available in browser"));
  }

  if (dbPromise) {
    return dbPromise;
  }

  dbPromise = new Promise((resolve, reject) => {
    const request = indexedDB.open(DB_NAME, DB_VERSION);

    request.onerror = () => {
      reject(new Error("Failed to open IndexedDB"));
    };

    request.onsuccess = () => {
      resolve(request.result);
    };

    request.onupgradeneeded = (event) => {
      const db = (event.target as IDBOpenDBRequest).result;
      if (!db.objectStoreNames.contains(STORE_NAME)) {
        db.createObjectStore(STORE_NAME, { keyPath: "key" });
      }
    };
  });

  return dbPromise;
}

/**
 * Save content to cache
 */
export async function saveContentToCache(
  key: string,
  data: unknown,
): Promise<void> {
  if (!isBrowser()) {
    return; // Skip caching on server
  }

  try {
    const db = await openDB();
    const transaction = db.transaction([STORE_NAME], "readwrite");
    const store = transaction.objectStore(STORE_NAME);

    await new Promise<void>((resolve, reject) => {
      const request = store.put({
        key,
        data,
        timestamp: Date.now(),
      } as CacheEntry);

      request.onsuccess = () => resolve();
      request.onerror = () => reject(request.error);
    });
  } catch (error) {
    console.error("Failed to save content to cache:", error);
    // Don't throw - caching failures shouldn't break the app
  }
}

/**
 * Get content from cache
 */
export async function getContentFromCache(
  key: string,
): Promise<unknown | null> {
  if (!isBrowser()) {
    return null; // No cache on server
  }

  try {
    const db = await openDB();
    const transaction = db.transaction([STORE_NAME], "readonly");
    const store = transaction.objectStore(STORE_NAME);

    return new Promise<unknown | null>((resolve, reject) => {
      const request = store.get(key);

      request.onsuccess = () => {
        const entry = request.result as CacheEntry | undefined;
        resolve(entry?.data || null);
      };

      request.onerror = () => reject(request.error);
    });
  } catch (error) {
    console.error("Failed to get content from cache:", error);
    return null;
  }
}

/**
 * Get all cached content
 */
export async function getAllContentFromCache(): Promise<
  Record<string, unknown>
> {
  if (!isBrowser()) {
    return {}; // No cache on server
  }

  try {
    const db = await openDB();
    const transaction = db.transaction([STORE_NAME], "readonly");
    const store = transaction.objectStore(STORE_NAME);

    return new Promise<Record<string, unknown>>((resolve, reject) => {
      const request = store.getAll();

      request.onsuccess = () => {
        const entries = request.result as CacheEntry[];
        const content: Record<string, unknown> = {};

        for (const entry of entries) {
          content[entry.key] = entry.data;
        }

        resolve(content);
      };

      request.onerror = () => reject(request.error);
    });
  } catch (error) {
    console.error("Failed to get all content from cache:", error);
    return {};
  }
}

/**
 * Clear content cache
 */
export async function clearContentCache(): Promise<void> {
  if (!isBrowser()) {
    return; // Skip on server
  }

  try {
    const db = await openDB();
    const transaction = db.transaction([STORE_NAME], "readwrite");
    const store = transaction.objectStore(STORE_NAME);

    await new Promise<void>((resolve, reject) => {
      const request = store.clear();

      request.onsuccess = () => resolve();
      request.onerror = () => reject(request.error);
    });
  } catch (error) {
    console.error("Failed to clear content cache:", error);
  }
}
