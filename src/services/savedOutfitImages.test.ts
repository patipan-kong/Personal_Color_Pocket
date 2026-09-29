import { afterEach, describe, expect, it, vi } from 'vitest'
import { deleteSavedOutfitPreviewImage, loadSavedOutfitPreviewImage, persistSavedOutfitPreviewImage } from './savedOutfitImages'

function installIndexedDbMemory() {
  const records = new Map<string, unknown>()
  let storeCreated = false
  const database = {
    objectStoreNames: { contains: () => storeCreated },
    createObjectStore: () => { storeCreated = true },
    close: vi.fn(),
    transaction: () => {
      const transaction: Record<string, unknown> = { onabort: null, onerror: null, oncomplete: null }
      const request = (action: () => unknown) => {
        const result: Record<string, unknown> = { result: undefined, error: null, onsuccess: null, onerror: null }
        queueMicrotask(() => {
          result.result = action()
          ;(result.onsuccess as (() => void) | null)?.()
          ;(transaction.oncomplete as (() => void) | null)?.()
        })
        return result
      }
      transaction.objectStore = () => ({
        put: (value: { id: string }) => request(() => { records.set(value.id, value); return value.id }),
        get: (id: string) => request(() => records.get(id)),
        delete: (id: string) => request(() => records.delete(id)),
      })
      return transaction
    },
  }
  const factory = {
    open: () => {
      const request: Record<string, unknown> = { result: database, error: null, onupgradeneeded: null, onsuccess: null, onerror: null, onblocked: null }
      queueMicrotask(() => {
        if (!storeCreated) (request.onupgradeneeded as (() => void) | null)?.()
        ;(request.onsuccess as (() => void) | null)?.()
      })
      return request
    },
  }
  vi.stubGlobal('indexedDB', factory)
  return records
}

describe('Saved Outfit IndexedDB preview repository', () => {
  afterEach(() => vi.unstubAllGlobals())

  it('stores binary Blob data that survives repository calls and can be deleted independently', async () => {
    const records = installIndexedDbMemory()
    const written = await persistSavedOutfitPreviewImage('preview-one', 'data:image/png;base64,aGVsbG8=')
    expect(written.ok).toBe(true)
    expect(records.get('preview-one')).toMatchObject({ id: 'preview-one', mimeType: 'image/png' })
    expect((records.get('preview-one') as { blob: Blob }).blob).toBeInstanceOf(Blob)

    const afterRemount = await loadSavedOutfitPreviewImage('preview-one')
    expect(afterRemount?.blob).toBeInstanceOf(Blob)
    expect(await deleteSavedOutfitPreviewImage('preview-one')).toBe(true)
    expect(await loadSavedOutfitPreviewImage('preview-one')).toBeNull()
  })

  it('rejects corrupt data and reports unavailable storage without throwing', async () => {
    installIndexedDbMemory()
    expect(await persistSavedOutfitPreviewImage('preview-bad', 'data:text/plain;base64,aGVsbG8=')).toEqual({ ok: false })
    vi.stubGlobal('indexedDB', undefined)
    expect(await persistSavedOutfitPreviewImage('preview-one', 'data:image/png;base64,aGVsbG8=')).toEqual({ ok: false })
  })
})
