import { cleanup, fireEvent, render } from '@testing-library/react'
import { afterEach, describe, expect, it } from 'vitest'
import { en } from '../i18n/en'
import { th } from '../i18n/th'
import photoCheckerPanelSource from '../photoChecker/PhotoCheckerPanel.tsx?raw'
import { AdvisoryPreview } from './AdvisoryPreview'
import previewSource from './AdvisoryPreview.tsx?raw'

afterEach(cleanup)

const $ = (selector: string) => document.querySelector<HTMLElement>(selector)
const text = (selector: string) => $(selector)?.textContent ?? ''
const press = (label: string) => fireEvent.click([...document.querySelectorAll('button')].find((node) => node.textContent === label)!)

describe('AdvisoryPreview (Slice 0.4B, dev-only visual QA)', () => {
  it('renders the real production result path: verdict, category and placement all present', () => {
    render(<AdvisoryPreview />)
    expect($('.check-verdict')).not.toBeNull()
    expect($('.check-category')).not.toBeNull()
    expect($('.check-placement')).not.toBeNull()
  })

  it('defaults to "None": no advisory block renders', () => {
    render(<AdvisoryPreview />)
    expect($('.check-advisory')).toBeNull()
  })

  it.each([
    ['Lighting', 'lighting-cast-corroborated'],
    ['Sample', 'sample-unusable'],
    ['Target', 'target-mismatch'],
  ] as const)('%s selects the %s advisory, using the existing Slice 0.4 copy verbatim', (label, reason) => {
    render(<AdvisoryPreview />)
    press(label)
    expect(text('.check-advisory-title')).toContain(en.photoChecker.aiAdvisory[reason].title)
    expect(text('.check-advisory-body')).toBe(en.photoChecker.aiAdvisory[reason].body)
  })

  it('switching back to "None" clears the advisory block again', () => {
    render(<AdvisoryPreview />)
    press('Lighting')
    expect($('.check-advisory')).not.toBeNull()
    press('None')
    expect($('.check-advisory')).toBeNull()
  })

  it('the TH toggle switches the whole card to Thai copy, including the advisory', () => {
    render(<AdvisoryPreview />)
    press('Sample')
    press('TH')
    expect(text('.check-advisory-title')).toContain(th.photoChecker.aiAdvisory['sample-unusable'].title)
    expect(text('.check-advisory-body')).toBe(th.photoChecker.aiAdvisory['sample-unusable'].body)
    expect(text('.check-verdict')).toMatch(/[ก-๙]/)
  })

  it('uses the real PhotoFeedback / ColorResultCard components, not a duplicated mock', () => {
    expect(previewSource).toMatch(/import \{ PhotoFeedback \} from '\.\.\/photoChecker\/PhotoResultCard'/)
    // No hand-rolled markup standing in for the result card, and no duplicated advisory copy.
    for (const forbidden of ['check-verdict', 'check-category', 'check-advisory-title', "'Check the selected", "'This area contains"]) {
      expect(previewSource, forbidden).not.toContain(forbidden)
    }
  })

  it('never calls an AI API and never fakes advisory data into the real Photo Checker', () => {
    for (const forbidden of ['fetch', 'XMLHttpRequest', 'aiColorLabApi', 'callAiColorCandidate']) expect(previewSource, forbidden).not.toMatch(new RegExp(forbidden))
    // The real production panel never imports this dev-only preview.
    expect(photoCheckerPanelSource).not.toMatch(/AdvisoryPreview/)
  })
})
