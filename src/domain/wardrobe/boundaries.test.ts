import { beforeEach, describe, expect, it } from 'vitest'
import wardrobeSource from './wardrobe.ts?raw'
import taxonomySource from './taxonomy.ts?raw'
import persistenceSource from '../../services/wardrobePersistence.ts?raw'
import { clearState, saveState } from '../../services/persistence'
import { savePresentationPreference } from '../../services/presentationPreference'
import { saveDailyLuckyColorGoals } from '../../services/dailyLuckyColorGoal'
import { loadWardrobe, saveWardrobe, WARDROBE_STORAGE_KEY } from '../../services/wardrobePersistence'

describe('production wardrobe boundaries', () => {
  beforeEach(() => localStorage.clear())

  it('has no reverse dependency on the Lab, Today Outfit, AI/provider, network, photo, or base64 code', () => {
    const production = [wardrobeSource, taxonomySource, persistenceSource].join('\n')
    expect(production).not.toMatch(/todayOutfit|\baiLab\b|\bprovider\b|outfitImage|\bfetch\b|XMLHttpRequest|WebSocket|EventSource|sendBeacon|indexedDB|photoColor|imageData|base64/i)
  })

  it('uses a dedicated storage key independent from profile, presentation, and Lucky Color state', () => {
    saveState({ answers: {}, result: null, quizStep: 0 })
    savePresentationPreference('women')
    saveDailyLuckyColorGoals(['money'])
    const record = { id: 'owned-dress', garmentType: 'dress', color: { hex: '#C51F3A' }, formality: 'formal' } as const
    expect(saveWardrobe([record]).ok).toBe(true)

    clearState()
    savePresentationPreference('men')
    saveDailyLuckyColorGoals(['luck'])

    expect(WARDROBE_STORAGE_KEY).toBe('personal-color-pocket:wardrobe:v1')
    expect(loadWardrobe()).toMatchObject({ status: 'loaded', items: [record] })
  })

  it('persists metadata only: no derived slot, names, compatibility, photos, or profile facts', () => {
    const record = { id: 'owned-dress', garmentType: 'dress', color: { hex: '#C51F3A' }, formality: 'formal' } as const
    saveWardrobe([record])
    const raw = localStorage.getItem(WARDROBE_STORAGE_KEY)!
    expect(JSON.parse(raw)).toEqual({ version: 1, items: [record] })
    expect(raw).not.toMatch(/slot|displayName|generic|compatib|suitability|subtype|presentation|lucky|photo|image|base64/i)
  })
})
