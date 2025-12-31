/**
 * IndexedDB utility untuk menyimpan file sementara
 * Mengurangi penggunaan RAM dengan menyimpan file di disk browser
 */

const DB_NAME = 'ultra-pdf-storage';
const DB_VERSION = 1;
const STORE_NAME = 'files';

interface FileRecord {
  id: string;
  arrayBuffer: ArrayBuffer;
  fileName: string;
  fileSize: number;
  timestamp: number;
}

class IndexedDBManager {
  private db: IDBDatabase | null = null;
  private initPromise: Promise<void> | null = null;

  private async init(): Promise<void> {
    if (this.db) return;
    if (this.initPromise) return this.initPromise;

    this.initPromise = new Promise((resolve, reject) => {
      const request = indexedDB.open(DB_NAME, DB_VERSION);

      request.onerror = () => reject(request.error);
      request.onsuccess = () => {
        this.db = request.result;
        resolve();
      };

      request.onupgradeneeded = (event) => {
        const db = (event.target as IDBOpenDBRequest).result;
        if (!db.objectStoreNames.contains(STORE_NAME)) {
          const objectStore = db.createObjectStore(STORE_NAME, { keyPath: 'id' });
          objectStore.createIndex('timestamp', 'timestamp', { unique: false });
        }
      };
    });

    return this.initPromise;
  }

  /**
   * Menyimpan file ke IndexedDB
   */
  async saveFile(id: string, file: File): Promise<void> {
    await this.init();
    if (!this.db) throw new Error('Database not initialized');

    const arrayBuffer = await file.arrayBuffer();
    const record: FileRecord = {
      id,
      arrayBuffer,
      fileName: file.name,
      fileSize: file.size,
      timestamp: Date.now(),
    };

    return new Promise((resolve, reject) => {
      const transaction = this.db!.transaction([STORE_NAME], 'readwrite');
      const store = transaction.objectStore(STORE_NAME);
      const request = store.put(record);

      request.onerror = () => reject(request.error);
      request.onsuccess = () => resolve();
    });
  }

  /**
   * Mengambil file dari IndexedDB
   */
  async getFile(id: string): Promise<ArrayBuffer> {
    await this.init();
    if (!this.db) throw new Error('Database not initialized');

    return new Promise((resolve, reject) => {
      const transaction = this.db!.transaction([STORE_NAME], 'readonly');
      const store = transaction.objectStore(STORE_NAME);
      const request = store.get(id);

      request.onerror = () => reject(request.error);
      request.onsuccess = () => {
        const record = request.result as FileRecord | undefined;
        if (!record) {
          reject(new Error(`File with id ${id} not found`));
          return;
        }
        resolve(record.arrayBuffer);
      };
    });
  }

  /**
   * Menghapus file dari IndexedDB
   */
  async deleteFile(id: string): Promise<void> {
    await this.init();
    if (!this.db) throw new Error('Database not initialized');

    return new Promise((resolve, reject) => {
      const transaction = this.db!.transaction([STORE_NAME], 'readwrite');
      const store = transaction.objectStore(STORE_NAME);
      const request = store.delete(id);

      request.onerror = () => reject(request.error);
      request.onsuccess = () => resolve();
    });
  }

  /**
   * Menghapus semua file dari IndexedDB
   */
  async clearAll(): Promise<void> {
    await this.init();
    if (!this.db) throw new Error('Database not initialized');

    return new Promise((resolve, reject) => {
      const transaction = this.db!.transaction([STORE_NAME], 'readwrite');
      const store = transaction.objectStore(STORE_NAME);
      const request = store.clear();

      request.onerror = () => reject(request.error);
      request.onsuccess = () => resolve();
    });
  }

  /**
   * Menghapus file lama (lebih dari 1 jam)
   */
  async cleanupOldFiles(): Promise<void> {
    await this.init();
    if (!this.db) throw new Error('Database not initialized');

    const oneHourAgo = Date.now() - 60 * 60 * 1000;

    return new Promise((resolve, reject) => {
      const transaction = this.db!.transaction([STORE_NAME], 'readwrite');
      const store = transaction.objectStore(STORE_NAME);
      const index = store.index('timestamp');
      const request = index.openCursor(IDBKeyRange.upperBound(oneHourAgo));

      request.onerror = () => reject(request.error);
      request.onsuccess = (event) => {
        const cursor = (event.target as IDBRequest<IDBCursorWithValue>).result;
        if (cursor) {
          cursor.delete();
          cursor.continue();
        } else {
          resolve();
        }
      };
    });
  }

  /**
   * Mendapatkan informasi file tanpa mengambil ArrayBuffer
   */
  async getFileInfo(id: string): Promise<{ fileName: string; fileSize: number } | null> {
    await this.init();
    if (!this.db) throw new Error('Database not initialized');

    return new Promise((resolve, reject) => {
      const transaction = this.db!.transaction([STORE_NAME], 'readonly');
      const store = transaction.objectStore(STORE_NAME);
      const request = store.get(id);

      request.onerror = () => reject(request.error);
      request.onsuccess = () => {
        const record = request.result as FileRecord | undefined;
        if (!record) {
          resolve(null);
          return;
        }
        resolve({
          fileName: record.fileName,
          fileSize: record.fileSize,
        });
      };
    });
  }
}

// Singleton instance
export const indexedDBManager = new IndexedDBManager();

// Cleanup old files on load
if (typeof window !== 'undefined') {
  indexedDBManager.cleanupOldFiles().catch(console.error);
}

