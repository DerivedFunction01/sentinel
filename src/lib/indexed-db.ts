const DB_NAME = "sentinel-reports-cache";
const DB_VERSION = 1;
const STORE_SCANS_LIST = "scans-list";
const STORE_SCAN_DETAILS = "scan-details";

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
    };
  });
}

export async function getCachedScansList(userId: string): Promise<any[] | null> {
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

export async function setCachedScansList(userId: string, data: any[]): Promise<void> {
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

export async function getCachedScanDetail(reportId: string): Promise<any | null> {
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

export async function setCachedScanDetail(reportId: string, data: any): Promise<void> {
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

export async function clearCachedReports(): Promise<void> {
  try {
    const db = await getDB();
    return new Promise((resolve, reject) => {
      const transaction = db.transaction([STORE_SCANS_LIST, STORE_SCAN_DETAILS], "readwrite");
      transaction.objectStore(STORE_SCANS_LIST).clear();
      transaction.objectStore(STORE_SCAN_DETAILS).clear();
      transaction.oncomplete = () => resolve();
      transaction.onerror = () => reject(transaction.error);
    });
  } catch (error) {
    console.error("IndexedDB clearCachedReports error:", error);
  }
}
