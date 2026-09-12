window.tetrisRecords = (() => {
  const highScoreKey = "tetris.highScore";
  const highLevelKey = "tetris.highestLevel";
  const databaseName = "tetris-records";
  const databaseVersion = 1;
  const storeName = "game-records";
  const recordKey = "best";

  let databasePromise = null;
  let persistenceRequested = false;

  function toNonNegativeInt(value, fallback) {
    const parsed = Number.parseInt(String(value ?? ""), 10);
    return Number.isSafeInteger(parsed) && parsed >= 0 ? parsed : fallback;
  }

  function normalize(record) {
    return {
      highestScore: toNonNegativeInt(record?.highestScore, 0),
      highestLevel: Math.max(1, toNonNegativeInt(record?.highestLevel, 1))
    };
  }

  function mergeRecords(...records) {
    return records.reduce((merged, record) => {
      const normalized = normalize(record);
      return {
        highestScore: Math.max(merged.highestScore, normalized.highestScore),
        highestLevel: Math.max(merged.highestLevel, normalized.highestLevel)
      };
    }, { highestScore: 0, highestLevel: 1 });
  }

  function readLocalRecord() {
    try {
      return normalize({
        highestScore: localStorage.getItem(highScoreKey),
        highestLevel: localStorage.getItem(highLevelKey)
      });
    } catch {
      return normalize(null);
    }
  }

  function mergeIntoLocalStorage(record) {
    const merged = mergeRecords(readLocalRecord(), record);
    try {
      localStorage.setItem(highScoreKey, String(merged.highestScore));
      localStorage.setItem(highLevelKey, String(merged.highestLevel));
    } catch {
      // localStorage が無効でも IndexedDB への保存を試みる。
    }
    return merged;
  }

  function getDatabase() {
    if (databasePromise) return databasePromise;

    databasePromise = new Promise((resolve, reject) => {
      if (!window.indexedDB) {
        reject(new Error("IndexedDB is unavailable."));
        return;
      }

      const request = indexedDB.open(databaseName, databaseVersion);
      request.onupgradeneeded = () => {
        const database = request.result;
        if (!database.objectStoreNames.contains(storeName)) {
          database.createObjectStore(storeName);
        }
      };
      request.onsuccess = () => resolve(request.result);
      request.onerror = () => reject(request.error);
    });

    return databasePromise;
  }

  async function readIndexedDbRecord() {
    try {
      const database = await getDatabase();
      return await new Promise((resolve, reject) => {
        const transaction = database.transaction(storeName, "readonly");
        const request = transaction.objectStore(storeName).get(recordKey);
        request.onsuccess = () => resolve(request.result ? normalize(request.result) : null);
        request.onerror = () => reject(request.error);
      });
    } catch {
      return null;
    }
  }

  async function mergeIntoIndexedDb(record) {
    try {
      const database = await getDatabase();
      return await new Promise((resolve, reject) => {
        const transaction = database.transaction(storeName, "readwrite");
        const store = transaction.objectStore(storeName);
        const request = store.get(recordKey);
        let merged = normalize(record);

        request.onsuccess = () => {
          merged = mergeRecords(request.result, record);
          store.put(merged, recordKey);
        };
        request.onerror = () => reject(request.error);
        transaction.oncomplete = () => resolve(merged);
        transaction.onerror = () => reject(transaction.error);
        transaction.onabort = () => reject(transaction.error);
      });
    } catch {
      return normalize(record);
    }
  }

  async function requestPersistentStorage() {
    if (persistenceRequested) return;
    persistenceRequested = true;

    try {
      if (!navigator.storage?.persist) return;
      const isPersistent = await navigator.storage.persisted?.();
      if (!isPersistent) {
        await navigator.storage.persist();
      }
    } catch {
      // 対応していないブラウザーでは通常の永続領域を使用する。
    }
  }

  return {
    async load() {
      await requestPersistentStorage();

      const localRecord = readLocalRecord();
      const indexedDbRecord = await readIndexedDbRecord();
      let merged = mergeRecords(localRecord, indexedDbRecord);

      merged = mergeIntoLocalStorage(merged);
      merged = await mergeIntoIndexedDb(merged);
      mergeIntoLocalStorage(merged);

      return [merged.highestScore, merged.highestLevel];
    },

    async save(highestScore, highestLevel) {
      await requestPersistentStorage();

      let merged = mergeIntoLocalStorage({ highestScore, highestLevel });
      merged = await mergeIntoIndexedDb(merged);
      mergeIntoLocalStorage(merged);
    }
  };
})();
