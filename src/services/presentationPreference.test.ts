import { beforeEach, describe, expect, it } from 'vitest'
import { loadPresentationPreference, savePresentationPreference } from './presentationPreference'

describe('presentation preference persistence', () => {
  beforeEach(() => localStorage.clear())

  it('has no preference until one is chosen', () => {
    expect(loadPresentationPreference()).toBeNull()
  })

  it('persists and restores the chosen preference', () => {
    savePresentationPreference('men')
    expect(loadPresentationPreference()).toBe('men')
    savePresentationPreference('women')
    expect(loadPresentationPreference()).toBe('women')
  })

  it('ignores malformed stored values', () => {
    localStorage.setItem('personal-color-pocket:presentation:v1', 'nonbinary-garbage')
    expect(loadPresentationPreference()).toBeNull()
  })
})
