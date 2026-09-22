export type PresentationPreference = 'women' | 'men'

const STORAGE_KEY = 'personal-color-pocket:presentation:v1'

export function loadPresentationPreference(): PresentationPreference | null {
  try {
    const raw = localStorage.getItem(STORAGE_KEY)
    return raw === 'women' || raw === 'men' ? raw : null
  } catch {
    return null
  }
}

export function savePresentationPreference(preference: PresentationPreference) {
  try {
    localStorage.setItem(STORAGE_KEY, preference)
  } catch {
    // Presentation styling still works for this session even if storage is blocked.
  }
}
