import { getSupabaseClient } from './supabase';
import { logger } from './logger';

const DB_NAME = 'debpth_file_store';
const STORE_NAME = 'documents';

interface StoredFileRecord {
  id: string;
  name: string;
  type: string;
  data: ArrayBuffer;
  updatedAt: number;
}

function openDatabase(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    if (typeof window === 'undefined' || typeof indexedDB === 'undefined') {
      return reject(new Error('IndexedDB not supported in this runtime environment'));
    }
    const request = indexedDB.open(DB_NAME, 1);
    request.onupgradeneeded = () => {
      const db = request.result;
      if (!db.objectStoreNames.contains(STORE_NAME)) {
        db.createObjectStore(STORE_NAME, { keyPath: 'id' });
      }
    };
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
}

/**
 * Stores a binary file locally in IndexedDB for reliable offline and instant retrieval
 */
export async function storeLocalFile(docId: string, file: File): Promise<void> {
  try {
    const buffer = await file.arrayBuffer();
    const db = await openDatabase();
    await new Promise<void>((resolve, reject) => {
      const tx = db.transaction(STORE_NAME, 'readwrite');
      const store = tx.objectStore(STORE_NAME);
      const record: StoredFileRecord = {
        id: docId,
        name: file.name,
        type: file.type,
        data: buffer,
        updatedAt: Date.now(),
      };
      const req = store.put(record);
      req.onsuccess = () => resolve();
      req.onerror = () => reject(req.error);
    });
    logger.info('FileStorage', `Stored file ${file.name} (${buffer.byteLength} bytes) locally for doc ${docId}`);
  } catch (err) {
    logger.warn('FileStorage', `Failed to store file in IndexedDB: ${err}`);
  }
}

/**
 * Retrieves a binary file from local IndexedDB
 */
export async function getLocalFile(docId: string): Promise<StoredFileRecord | null> {
  try {
    const db = await openDatabase();
    return await new Promise<StoredFileRecord | null>((resolve, reject) => {
      const tx = db.transaction(STORE_NAME, 'readonly');
      const store = tx.objectStore(STORE_NAME);
      const req = store.get(docId);
      req.onsuccess = () => resolve((req.result as StoredFileRecord) || null);
      req.onerror = () => reject(req.error);
    });
  } catch (err) {
    logger.warn('FileStorage', `Could not read file from IndexedDB: ${err}`);
    return null;
  }
}

/**
 * Uploads a document to Supabase Storage 'project-documents' bucket if configured
 */
export async function uploadToStorage(
  storagePath: string,
  file: File
): Promise<{ success: boolean; path?: string; error?: string }> {
  const client = getSupabaseClient();
  if (!client) {
    // Local / offline mode: IndexedDB handles persistence
    logger.info('FileStorage', 'Supabase client not configured; file stored in local IndexedDB only');
    return { success: true, path: storagePath };
  }

  try {
    const { data, error } = await client.storage
      .from('project-documents')
      .upload(storagePath, file, {
        upsert: true,
        cacheControl: '3600',
      });

    if (error) {
      logger.warn('FileStorage', `Remote Supabase upload error: ${error.message}`);
      return { success: false, error: error.message };
    }

    logger.info('FileStorage', `Uploaded ${file.name} to project-documents/${storagePath}`);
    return { success: true, path: data?.path };
  } catch (err: any) {
    logger.warn('FileStorage', `Upload exception: ${err.message || err}`);
    return { success: false, error: err.message || 'Upload failed' };
  }
}

/**
 * Downloads a document by checking local IndexedDB cache first, then falling back to Supabase Storage.
 * Triggers an authentic browser file download.
 */
export async function downloadDocumentFile(
  docId: string,
  storagePath?: string,
  fileName?: string,
  mimeType?: string
): Promise<{ success: boolean; message?: string }> {
  const targetFileName = fileName || 'document.bin';

  // 1. Check local IndexedDB first
  try {
    const local = await getLocalFile(docId);
    if (local && local.data && local.data.byteLength > 0) {
      triggerBrowserDownload(
        new Blob([local.data], { type: local.type || mimeType || 'application/octet-stream' }),
        targetFileName
      );
      return { success: true };
    }
  } catch (err) {
    logger.warn('FileStorage', `IndexedDB lookup error: ${err}`);
  }

  // 2. Fall back to Supabase Storage
  const client = getSupabaseClient();
  if (client && storagePath) {
    try {
      const { data, error } = await client.storage
        .from('project-documents')
        .download(storagePath);

      if (!error && data) {
        triggerBrowserDownload(data, targetFileName);
        return { success: true };
      }
      if (error) {
        return { success: false, message: `Storage access error: ${error.message}` };
      }
    } catch (err: any) {
      return { success: false, message: `Remote download failed: ${err.message || err}` };
    }
  }

  return {
    success: false,
    message: 'File binary unavailable. Ensure file was uploaded or storage is connected.',
  };
}

function triggerBrowserDownload(blob: Blob, filename: string) {
  if (typeof window === 'undefined' || typeof document === 'undefined') return;
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  setTimeout(() => URL.revokeObjectURL(url), 2000);
}
