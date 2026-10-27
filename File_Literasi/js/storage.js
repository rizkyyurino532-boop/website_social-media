/**
 * ==========================================================================
 * STORAGE.JS - LocalStorage & IndexedDB Persistence Layer
 * Handles CRUD operations, IndexedDB media store, image compression & XSS safety
 * ==========================================================================
 */

const STORAGE_KEYS = {
  USERS: "konekta_users",
  SESSION: "konekta_session",
  POSTS: "konekta_posts",
  STORIES: "konekta_stories",
  CONVERSATIONS: "konekta_conversations",
  NOTIFICATIONS: "konekta_notifications",
  REPORTS: "konekta_reports",
  THEME: "konekta_theme",
  SEEDED: "konekta_seeded_v1",
};

const IDB_CONFIG = {
  DB_NAME: "KonektaMediaDB",
  VERSION: 1,
  STORE_NAME: "media_files",
};

class StorageService {
  constructor() {
    this.dbPromise = null;
    this.mediaCache = new Map();
    this.initIndexedDB();
  }

  /**
   * Initialize IndexedDB for binary/base64 media storage
   * @returns {Promise<IDBDatabase|null>}
   */
  initIndexedDB() {
    if (this.dbPromise) return this.dbPromise;

    this.dbPromise = new Promise((resolve) => {
      if (!window.indexedDB) {
        resolve(null);
        return;
      }

      try {
        const request = window.indexedDB.open(
          IDB_CONFIG.DB_NAME,
          IDB_CONFIG.VERSION,
        );

        request.onupgradeneeded = (event) => {
          const db = event.target.result;
          if (!db.objectStoreNames.contains(IDB_CONFIG.STORE_NAME)) {
            db.createObjectStore(IDB_CONFIG.STORE_NAME, { keyPath: "id" });
          }
        };

        request.onsuccess = (event) => {
          const db = event.target.result;
          this.preloadMediaCache(db).then(() => resolve(db));
        };

        request.onerror = () => {
          console.warn(
            "IndexedDB unavailable, falling back to direct Base64 storage.",
          );
          resolve(null);
        };
      } catch (err) {
        console.warn("IndexedDB initialization error:", err);
        resolve(null);
      }
    });

    return this.dbPromise;
  }

  /**
   * Preload stored media from IndexedDB into memory map for fast rendering
   * @param {IDBDatabase} db
   */
  async preloadMediaCache(db) {
    if (!db) return;
    return new Promise((resolve) => {
      try {
        const tx = db.transaction(IDB_CONFIG.STORE_NAME, "readonly");
        const store = tx.objectStore(IDB_CONFIG.STORE_NAME);
        const req = store.getAll();
        req.onsuccess = () => {
          const items = req.result || [];
          items.forEach((item) => {
            if (item && item.id && item.dataUrl) {
              this.mediaCache.set(item.id, item.dataUrl);
            }
          });
          resolve();
        };
        req.onerror = () => resolve();
      } catch {
        resolve();
      }
    });
  }

  /**
   * Save media DataURL into IndexedDB and return reference key (or dataUrl fallback)
   * @param {string} dataUrl
   * @returns {Promise<string>} Media reference or dataUrl
   */
  async saveMedia(dataUrl) {
    if (!dataUrl || !dataUrl.startsWith("data:")) return dataUrl;

    const mediaId = `idb_media_${this.generateId("img")}`;
    this.mediaCache.set(mediaId, dataUrl);

    const db = await this.initIndexedDB();
    if (!db) return dataUrl;

    return new Promise((resolve) => {
      try {
        const tx = db.transaction(IDB_CONFIG.STORE_NAME, "readwrite");
        const store = tx.objectStore(IDB_CONFIG.STORE_NAME);
        store.put({
          id: mediaId,
          dataUrl,
          createdAt: Date.now(),
        });
        tx.oncomplete = () => resolve(`idb://${mediaId}`);
        tx.onerror = () => resolve(dataUrl);
      } catch {
        resolve(dataUrl);
      }
    });
  }

  /**
   * Resolve media URL (either external URL, direct dataUrl, or idb:// reference)
   * @param {string} urlOrRef
   * @returns {string}
   */
  resolveMedia(urlOrRef) {
    if (!urlOrRef) return "";
    if (urlOrRef.startsWith("idb://")) {
      const id = urlOrRef.replace("idb://", "");
      return this.mediaCache.get(id) || "";
    }
    return urlOrRef;
  }

  /**
   * Read and parse JSON data from localStorage safely
   * @param {string} key
   * @param {*} defaultValue
   * @returns {*}
   */
  get(key, defaultValue = null) {
    try {
      const raw = window.localStorage.getItem(key);
      if (raw === null || raw === undefined) return defaultValue;
      return JSON.parse(raw);
    } catch (error) {
      console.error(`Error reading localStorage key "${key}":`, error);
      return defaultValue;
    }
  }

  /**
   * Stringify and save data to localStorage with QuotaExceededError handling
   * @param {string} key
   * @param {*} value
   * @returns {boolean}
   */
  set(key, value) {
    try {
      const serialized = JSON.stringify(value);
      window.localStorage.setItem(key, serialized);
      return true;
    } catch (error) {
      console.error(`Error writing localStorage key "${key}":`, error);
      if (
        error.name === "QuotaExceededError" ||
        error.name === "NS_ERROR_DOM_QUOTA_REACHED" ||
        error.code === 22
      ) {
        if (window.UI && typeof window.UI.showToast === "function") {
          window.UI.showToast(
            "Penyimpanan browser hampir penuh! Hapus beberapa postingan atau gambar lama.",
            "error",
          );
        }
      }
      return false;
    }
  }

  /**
   * Remove key from localStorage
   * @param {string} key
   */
  remove(key) {
    try {
      window.localStorage.removeItem(key);
    } catch (error) {
      console.error(`Error removing key "${key}":`, error);
    }
  }

  /**
   * Clear all Konekta data from localStorage and IndexedDB
   * @returns {Promise<void>}
   */
  async clearAll() {
    try {
      Object.values(STORAGE_KEYS).forEach((key) => {
        window.localStorage.removeItem(key);
      });
      this.mediaCache.clear();

      const db = await this.initIndexedDB();
      if (db) {
        await new Promise((resolve) => {
          const tx = db.transaction(IDB_CONFIG.STORE_NAME, "readwrite");
          tx.objectStore(IDB_CONFIG.STORE_NAME).clear();
          tx.oncomplete = () => resolve();
          tx.onerror = () => resolve();
        });
      }
    } catch (error) {
      console.error("Failed to clear storage:", error);
    }
  }

  /**
   * Generate unique identifier with prefix
   * @param {string} prefix
   * @returns {string}
   */
  generateId(prefix = "id") {
    const randomPart = Math.random().toString(36).substring(2, 9);
    return `${prefix}_${Date.now().toString(36)}_${randomPart}`;
  }

  /**
   * Compress and resize an uploaded image File into an optimized DataURL
   * Prevents localStorage / IndexedDB bloat while keeping crisp quality
   * @param {File} file
   * @param {number} maxWidth
   * @param {number} quality
   * @returns {Promise<string>}
   */
  compressImage(file, maxWidth = 1080, quality = 0.82) {
    return new Promise((resolve, reject) => {
      if (!file || !file.type.startsWith("image/")) {
        reject(new Error("File harus berupa gambar (JPG, PNG, WEBP, GIF)."));
        return;
      }

      const reader = new FileReader();
      reader.onload = (event) => {
        const img = new Image();
        img.onload = () => {
          let { width, height } = img;
          if (width > maxWidth) {
            height = Math.round((height * maxWidth) / width);
            width = maxWidth;
          }

          const canvas = document.createElement("canvas");
          canvas.width = width;
          canvas.height = height;
          const ctx = canvas.getContext("2d");
          ctx.drawImage(img, 0, 0, width, height);

          const outputType =
            file.type === "image/png" ? "image/png" : "image/jpeg";
          const compressedDataUrl = canvas.toDataURL(outputType, quality);
          resolve(compressedDataUrl);
        };
        img.onerror = () => reject(new Error("Gagal memuat gambar."));
        img.src = event.target.result;
      };
      reader.onerror = () => reject(new Error("Gagal membaca file gambar."));
      reader.readAsDataURL(file);
    });
  }

  /**
   * Sanitize plain string to prevent XSS injection
   * @param {string} unsafeText
   * @returns {string}
   */
  escapeHtml(unsafeText) {
    if (unsafeText === null || unsafeText === undefined) return "";
    return String(unsafeText)
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;")
      .replace(/'/g, "&#039;");
  }

  /**
   * Calculate approximate storage usage in KB
   * @returns {number}
   */
  getStorageUsageKB() {
    let totalBytes = 0;
    try {
      for (let i = 0; i < window.localStorage.length; i++) {
        const key = window.localStorage.key(i);
        if (key && key.startsWith("konekta_")) {
          const val = window.localStorage.getItem(key) || "";
          totalBytes += (key.length + val.length) * 2;
        }
      }
    } catch {
      return 0;
    }
    return Math.round(totalBytes / 1024);
  }
}

window.STORAGE_KEYS = STORAGE_KEYS;
window.Storage = new StorageService();
