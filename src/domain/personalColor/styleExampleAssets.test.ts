import { describe, expect, it } from 'vitest'
import { subtypeOrder } from './seasons'
import { styleExampleAssets } from './styleExampleAssets'
import scoringSource from './scoring.ts?raw'
import diagnosticsSource from './diagnostics.ts?raw'
import auditSource from './scoringAudit.ts?raw'
import registrySource from './styleExampleAssets.ts?raw'

// Vite's built-in ?raw import (typed via the project's existing "vite/client" tsconfig
// types) lets these tests read real source/asset files without adding a node:fs
// dependency to the project just for test tooling.
const publicAssets = import.meta.glob('../../../public/img/personal-color/*/*.webp')

describe('style example asset registry', () => {
  it('has exactly the 12 subtypes, no duplicates, no missing entries', () => {
    const keys = Object.keys(styleExampleAssets)
    expect(keys).toHaveLength(12)
    expect(new Set(keys).size).toBe(12)
    expect(keys.sort()).toEqual([...subtypeOrder].sort())
  })

  it('gives every subtype both a men and a women asset path', () => {
    subtypeOrder.forEach((subtype) => {
      const entry = styleExampleAssets[subtype]
      expect(entry.men).toMatch(new RegExp(`^/img/personal-color/${subtype}/men\\.webp$`))
      expect(entry.women).toMatch(new RegExp(`^/img/personal-color/${subtype}/women\\.webp$`))
    })
  })

  it('every registered path resolves to a real file under public/', () => {
    const foundFiles = Object.keys(publicAssets)
    expect(foundFiles).toHaveLength(24)
    subtypeOrder.forEach((subtype) => {
      ;(['men', 'women'] as const).forEach((preference) => {
        expect(foundFiles.some((path) => path.endsWith(`/${subtype}/${preference}.webp`))).toBe(true)
      })
    })
  })

  it('scoring modules never import style-example asset data (presentation stays out of the classifier)', () => {
    expect(scoringSource).not.toMatch(/styleExample/)
    expect(diagnosticsSource).not.toMatch(/styleExample/)
    expect(auditSource).not.toMatch(/styleExample/)
  })

  it('the asset registry module never imports scoring internals (no path for it to mutate scoring)', () => {
    expect(registrySource).not.toMatch(/from '\.\/scoring'/)
    expect(registrySource).not.toMatch(/from '\.\/diagnostics'/)
    expect(registrySource).not.toMatch(/from '\.\/scoringAudit'/)
  })
})
