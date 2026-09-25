import { useMemo, useState } from 'react'
import type { SampleAdvisory, SampleAdvisoryReason } from '../domain/photoColor/aiNormalization'
import { realMatchFor } from '../domain/photoColor/realMatchFixtures'
import { getCopy } from '../i18n'
import type { Language } from '../i18n'
import { PhotoFeedback } from '../photoChecker/PhotoResultCard'
import type { PhotoSelection } from '../photoChecker/photoPanelState'
import './aiLab.css'

// V2.0 Slice 0.4B: a dev-only visual QA preview for the Slice 0.4 advisory presentation --
// nothing here is a second implementation of the result card. It renders the exact same
// PhotoFeedback used by the real Photo Checker (src/photoChecker/PhotoResultCard.tsx), with a
// real deterministic match from realMatchFor (the same TEST-ONLY fixture helper the Slice 0.4
// tests use -- a real palette colour through the unchanged sampler + matcher, not a hand-built
// category) and a hand-picked SampleAdvisory for each of the four states. Reached only via
// ?debug=advisory in a dev build, same DEV + explicit-query-param gate as ?debug=ai / ?debug=color
// (see App.tsx) -- never part of normal navigation, and this whole module (plus its import chain)
// is compiled out of a production build by that DEV check.

type PreviewState = 'none' | 'lighting' | 'sample' | 'target'

const STATE_LABELS: Record<PreviewState, string> = { none: 'None', lighting: 'Lighting', sample: 'Sample', target: 'Target' }
const STATE_REASONS: Record<PreviewState, SampleAdvisoryReason[]> = {
  none: [],
  lighting: ['lighting-cast-corroborated'],
  sample: ['sample-unusable'],
  target: ['target-mismatch'],
}

// A stable, real (not hand-built) match: a curated palette colour run through the unchanged
// sampler + matcher, landing in the "related" category -- a middling verdict, so the preview
// shows placement/pairing guidance (not just the shortest "near-face" render).
const PREVIEW_MATCH = realMatchFor('warm-spring', 'related')!
const PREVIEW_SELECTION: PhotoSelection = { point: PREVIEW_MATCH.point, inspection: PREVIEW_MATCH }

export function AdvisoryPreview() {
  const [state, setState] = useState<PreviewState>('none')
  const [language, setLanguage] = useState<Language>('en')
  const copy = getCopy(language)
  const advisory = useMemo<SampleAdvisory | null>(() => (state === 'none' ? null : { caveat: true, reasons: STATE_REASONS[state] }), [state])

  return <main className="ai-lab-page">
    <p className="ai-lab-badge">Dev only — AI Advisory Preview</p>
    <h1>AI Advisory Preview</h1>
    <p>Slice 0.4B visual QA: the real Photo Checker result card (PhotoFeedback), with a fixed real match and each of the four SampleAdvisory states from Slice 0.4. Not a production feature, and it never calls an AI API -- the advisory below is a hand-picked prop, the same shape deriveSampleAdvisory() returns.</p>

    <div className="ai-lab-picker-row">
      <div className="ai-lab-toggle-group" role="group" aria-label="Advisory preview state">
        {(Object.keys(STATE_LABELS) as PreviewState[]).map((option) => (
          <button key={option} type="button" className="ai-lab-toggle" aria-pressed={state === option} onClick={() => setState(option)}>
            {STATE_LABELS[option]}
          </button>
        ))}
      </div>
      <div className="ai-lab-toggle-group" role="group" aria-label="Preview language">
        {(['en', 'th'] as const).map((option) => (
          <button key={option} type="button" className="ai-lab-toggle" aria-pressed={language === option} onClick={() => setLanguage(option)}>
            {option.toUpperCase()}
          </button>
        ))}
      </div>
    </div>

    <div className="advisory-preview-card">
      <PhotoFeedback
        copy={copy.photoChecker}
        resultCopy={copy.colorResult}
        garments={copy.styleExamples.garments}
        language={language}
        presentation="women"
        selection={PREVIEW_SELECTION}
        advisory={advisory}
      />
    </div>
  </main>
}
