const DB_NAME = "sentinel-reports-cache";
const DB_VERSION = 5;
const STORE_SCANS_LIST = "scans-list";
const STORE_SCAN_DETAILS = "scan-details";
const STORE_TOOL_EXAMPLES = "tool-examples";
const STORE_USER_TAGS = "user-tags";
const STORE_MODELS = "models";

function getDB(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    if (typeof window === "undefined") {
      reject(new Error("IndexedDB is only available in the browser"));
      return;
    }
    const request = window.indexedDB.open(DB_NAME, DB_VERSION);

    request.onerror = () => reject(request.error);
    request.onsuccess = () => resolve(request.result);

    request.onupgradeneeded = () => {
      const db = request.result;
      if (!db.objectStoreNames.contains(STORE_SCANS_LIST)) {
        db.createObjectStore(STORE_SCANS_LIST);
      }
      if (!db.objectStoreNames.contains(STORE_SCAN_DETAILS)) {
        db.createObjectStore(STORE_SCAN_DETAILS);
      }
      if (!db.objectStoreNames.contains(STORE_TOOL_EXAMPLES)) {
        db.createObjectStore(STORE_TOOL_EXAMPLES);
      }
      if (!db.objectStoreNames.contains(STORE_USER_TAGS)) {
        db.createObjectStore(STORE_USER_TAGS);
      }
      if (!db.objectStoreNames.contains(STORE_MODELS)) {
        db.createObjectStore(STORE_MODELS);
      }
    };
  });
}

export async function getCachedScansList(
  userId: string,
): Promise<any[] | null> {
  try {
    const db = await getDB();
    return new Promise((resolve, reject) => {
      const transaction = db.transaction(STORE_SCANS_LIST, "readonly");
      const store = transaction.objectStore(STORE_SCANS_LIST);
      const request = store.get(userId);
      request.onsuccess = () => resolve(request.result || null);
      request.onerror = () => reject(request.error);
    });
  } catch (error) {
    console.error("IndexedDB getCachedScansList error:", error);
    return null;
  }
}

export async function setCachedScansList(
  userId: string,
  data: any[],
): Promise<void> {
  try {
    const db = await getDB();
    return new Promise((resolve, reject) => {
      const transaction = db.transaction(STORE_SCANS_LIST, "readwrite");
      const store = transaction.objectStore(STORE_SCANS_LIST);
      const request = store.put(data, userId);
      request.onsuccess = () => resolve();
      request.onerror = () => reject(request.error);
    });
  } catch (error) {
    console.error("IndexedDB setCachedScansList error:", error);
  }
}

export async function getCachedScanDetail(
  reportId: string,
): Promise<any | null> {
  try {
    const db = await getDB();
    return new Promise((resolve, reject) => {
      const transaction = db.transaction(STORE_SCAN_DETAILS, "readonly");
      const store = transaction.objectStore(STORE_SCAN_DETAILS);
      const request = store.get(reportId);
      request.onsuccess = () => resolve(request.result || null);
      request.onerror = () => reject(request.error);
    });
  } catch (error) {
    console.error("IndexedDB getCachedScanDetail error:", error);
    return null;
  }
}

export async function setCachedScanDetail(
  reportId: string,
  data: any,
): Promise<void> {
  try {
    const db = await getDB();
    return new Promise((resolve, reject) => {
      const transaction = db.transaction(STORE_SCAN_DETAILS, "readwrite");
      const store = transaction.objectStore(STORE_SCAN_DETAILS);
      const request = store.put(data, reportId);
      request.onsuccess = () => resolve();
      request.onerror = () => reject(request.error);
    });
  } catch (error) {
    console.error("IndexedDB setCachedScanDetail error:", error);
  }
}

export async function getCachedToolExamples(): Promise<any[] | null> {
  try {
    const db = await getDB();
    return new Promise((resolve, reject) => {
      const transaction = db.transaction(STORE_TOOL_EXAMPLES, "readonly");
      const store = transaction.objectStore(STORE_TOOL_EXAMPLES);
      const request = store.get("all-examples");
      request.onsuccess = () => resolve(request.result || null);
      request.onerror = () => reject(request.error);
    });
  } catch (error) {
    console.error("IndexedDB getCachedToolExamples error:", error);
    return null;
  }
}

export async function setCachedToolExamples(data: any[]): Promise<void> {
  try {
    const db = await getDB();
    return new Promise((resolve, reject) => {
      const transaction = db.transaction(STORE_TOOL_EXAMPLES, "readwrite");
      const store = transaction.objectStore(STORE_TOOL_EXAMPLES);
      const request = store.put(data, "all-examples");
      request.onsuccess = () => resolve();
      request.onerror = () => reject(request.error);
    });
  } catch (error) {
    console.error("IndexedDB setCachedToolExamples error:", error);
  }
}

export async function clearCachedReports(): Promise<void> {
  try {
    const db = await getDB();
    return new Promise((resolve, reject) => {
      const transaction = db.transaction(
        [STORE_SCANS_LIST, STORE_SCAN_DETAILS, STORE_TOOL_EXAMPLES],
        "readwrite",
      );
      transaction.objectStore(STORE_SCANS_LIST).clear();
      transaction.objectStore(STORE_SCAN_DETAILS).clear();
      transaction.objectStore(STORE_TOOL_EXAMPLES).clear();
      transaction.oncomplete = () => resolve();
      transaction.onerror = () => reject(transaction.error);
    });
  } catch (error) {
    console.error("IndexedDB clearCachedReports error:", error);
  }
}

export async function deleteCachedScanDetail(reportId: string): Promise<void> {
  try {
    const db = await getDB();
    return new Promise((resolve, reject) => {
      const transaction = db.transaction(STORE_SCAN_DETAILS, "readwrite");
      const store = transaction.objectStore(STORE_SCAN_DETAILS);
      const request = store.delete(reportId);
      request.onsuccess = () => resolve();
      request.onerror = () => reject(request.error);
    });
  } catch (error) {
    console.error("IndexedDB deleteCachedScanDetail error:", error);
  }
}

export async function getCachedUserTags(userId: string): Promise<any[] | null> {
  try {
    const db = await getDB();
    return new Promise((resolve, reject) => {
      const transaction = db.transaction(STORE_USER_TAGS, "readonly");
      const store = transaction.objectStore(STORE_USER_TAGS);
      const request = store.get(userId);
      request.onsuccess = () => resolve(request.result || null);
      request.onerror = () => reject(request.error);
    });
  } catch (error: any) {
    if (error?.name === "NotFoundError") {
      return null;
    }
    console.error("IndexedDB getCachedUserTags error:", error);
    return null;
  }
}

export async function setCachedUserTags(
  userId: string,
  data: any[],
): Promise<void> {
  try {
    const db = await getDB();
    return new Promise((resolve, reject) => {
      const transaction = db.transaction(STORE_USER_TAGS, "readwrite");
      const store = transaction.objectStore(STORE_USER_TAGS);
      const request = store.put(data, userId);
      request.onsuccess = () => resolve();
      request.onerror = () => reject(request.error);
    });
  } catch (error) {
    console.error("IndexedDB setCachedUserTags error:", error);
  }
}

export interface CachedModelsEntry {
  lastUpdated: number;
  data: Array<{
    id: string;
    name: string;
    description?: string | null;
    contextLength?: number | null;
    modality?: string | null;
    promptPrice?: string | null;
    completionPrice?: string | null;
    isRecommended: boolean;
    aiSuggest: boolean;
    popularityRank: number;
    supportsTools: boolean;
    isLowCost: boolean;
    isFree: boolean;
  }>;
}

const MODELS_CACHE_KEY = "all-models";

export async function getCachedModels(): Promise<CachedModelsEntry | null> {
  try {
    const db = await getDB();
    return new Promise((resolve, reject) => {
      const transaction = db.transaction(STORE_MODELS, "readonly");
      const store = transaction.objectStore(STORE_MODELS);
      const request = store.get(MODELS_CACHE_KEY);
      request.onsuccess = () => resolve(request.result || null);
      request.onerror = () => reject(request.error);
    });
  } catch (error) {
    console.error("IndexedDB getCachedModels error:", error);
    return null;
  }
}

export async function setCachedModels(entry: CachedModelsEntry): Promise<void> {
  try {
    const db = await getDB();
    return new Promise((resolve, reject) => {
      const transaction = db.transaction(STORE_MODELS, "readwrite");
      const store = transaction.objectStore(STORE_MODELS);
      const request = store.put(entry, MODELS_CACHE_KEY);
      request.onsuccess = () => resolve();
      request.onerror = () => reject(request.error);
    });
  } catch (error) {
    console.error("IndexedDB setCachedModels error:", error);
  }
}

export async function clearCachedModels(): Promise<void> {
  try {
    const db = await getDB();
    return new Promise((resolve, reject) => {
      const transaction = db.transaction(STORE_MODELS, "readwrite");
      const store = transaction.objectStore(STORE_MODELS);
      const request = store.clear();
      request.onsuccess = () => resolve();
      request.onerror = () => reject(request.error);
    });
  } catch (error) {
    console.error("IndexedDB clearCachedModels error:", error);
  }
}
