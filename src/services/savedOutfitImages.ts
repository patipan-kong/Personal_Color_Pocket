import { isPreviewImageMimeType } from '../domain/todayOutfitProduction/previewContract'
import type { PreviewImageMimeType } from '../domain/todayOutfitProduction/previewContract'

export const SAVED_OUTFIT_IMAGES_DB = 'personal-color-pocket-saved-outfits'
export const SAVED_OUTFIT_IMAGES_STORE = 'preview-images'
const DATABASE_VERSION = 1

export interface SavedOutfitPreviewImage {
  readonly id: string
  readonly mimeType: PreviewImageMimeType
  readonly blob: Blob
  readonly width?: number
  readonly height?: number
  readonly createdAt: number
}

export type SavedOutfitImageWriteResult = { readonly ok: true; readonly image: SavedOutfitPreviewImage } | { readonly ok: false }

function openDatabase(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    if (typeof indexedDB === 'undefined') { reject(new Error('IndexedDB unavailable')); return }
    const request = indexedDB.open(SAVED_OUTFIT_IMAGES_DB, DATABASE_VERSION)
    request.onupgradeneeded = () => {
      const database = request.result
      if (!database.objectStoreNames.contains(SAVED_OUTFIT_IMAGES_STORE)) database.createObjectStore(SAVED_OUTFIT_IMAGES_STORE, { keyPath: 'id' })
    }
    request.onsuccess = () => resolve(request.result)
    request.onerror = () => reject(request.error ?? new Error('IndexedDB open failed'))
    request.onblocked = () => reject(new Error('IndexedDB blocked'))
  })
}

function decodePreviewDataUrl(imageDataUrl: string): { readonly mimeType: PreviewImageMimeType; readonly blob: Blob } | null {
  const match = /^data:([^;,]+);base64,([a-z0-9+/=]+)$/i.exec(imageDataUrl)
  if (!match || !isPreviewImageMimeType(match[1])) return null
  try {
    const binary = atob(match[2])
    const bytes = new Uint8Array(binary.length)
    for (let index = 0; index < binary.length; index += 1) bytes[index] = binary.charCodeAt(index)
    return { mimeType: match[1], blob: new Blob([bytes], { type: match[1] }) }
  } catch { return null }
}

function runTransaction<T>(mode: IDBTransactionMode, operation: (store: IDBObjectStore, resolve: (value: T) => void, reject: () => void) => void): Promise<T> {
  return openDatabase().then((database) => new Promise<T>((resolve, rejectPromise) => {
    let settled = false
    let result: T | undefined
    let hasResult = false
    const capture = (value: T) => { result = value; hasResult = true }
    const fail = () => {
      database.close()
      if (!settled) { settled = true; rejectPromise(new Error('IndexedDB transaction failed')) }
    }
    const transaction = database.transaction(SAVED_OUTFIT_IMAGES_STORE, mode)
    transaction.onabort = fail
    transaction.onerror = fail
    transaction.oncomplete = () => {
      database.close()
      if (!settled && hasResult) { settled = true; resolve(result as T) }
      else if (!settled) fail()
    }
    try { operation(transaction.objectStore(SAVED_OUTFIT_IMAGES_STORE), capture, fail) } catch { fail() }
  }))
}

export async function persistSavedOutfitPreviewImage(id: string, imageDataUrl: string, dimensions?: { readonly width?: number; readonly height?: number }): Promise<SavedOutfitImageWriteResult> {
  const decoded = decodePreviewDataUrl(imageDataUrl)
  if (!decoded) return { ok: false }
  const image: SavedOutfitPreviewImage = {
    id,
    mimeType: decoded.mimeType,
    blob: decoded.blob,
    ...(dimensions?.width ? { width: dimensions.width } : {}),
    ...(dimensions?.height ? { height: dimensions.height } : {}),
    createdAt: Date.now(),
  }
  try {
    return await runTransaction<SavedOutfitImageWriteResult>('readwrite', (store, resolve, reject) => {
      const request = store.put(image)
      request.onsuccess = () => resolve({ ok: true, image })
      request.onerror = reject
    })
  } catch { return { ok: false } }
}

export async function loadSavedOutfitPreviewImage(id: string): Promise<SavedOutfitPreviewImage | null> {
  try {
    return await runTransaction<SavedOutfitPreviewImage | null>('readonly', (store, resolve, reject) => {
      const request = store.get(id)
      request.onsuccess = () => {
        const value = request.result as Partial<SavedOutfitPreviewImage> | undefined
        resolve(value && value.id === id && value.blob instanceof Blob && isPreviewImageMimeType(value.mimeType) ? value as SavedOutfitPreviewImage : null)
      }
      request.onerror = reject
    })
  } catch { return null }
}

export async function deleteSavedOutfitPreviewImage(id: string): Promise<boolean> {
  try {
    return await runTransaction<boolean>('readwrite', (store, resolve, reject) => {
      const request = store.delete(id)
      request.onsuccess = () => resolve(true)
      request.onerror = reject
    })
  } catch { return false }
}
