import { useMemo, useRef, useState } from 'react'
import { AI_CANDIDATES, AI_CANDIDATE_IDS } from '../domain/ai/providerCatalog'
import type { AiCandidateId } from '../domain/ai/providerCatalog'
import { subtypeOrder } from '../domain/personalColor/seasons'
import { recommendDeterministicOutfit } from '../domain/todayOutfit/baseline'
import { OUTFIT_BAKEOFF_CASES } from '../domain/todayOutfit/cases'
import { OUTFIT_OCCASIONS, validateTodayOutfitInput } from '../domain/todayOutfit/contract'
import type { OutfitRecommendation, TodayOutfitInput } from '../domain/todayOutfit/contract'
import { callOutfitCandidate } from './outfitApi'
import { downloadOutfitLabExport, EMPTY_OUTFIT_REVIEW, REVIEW_VERDICTS } from './export'
import type { OutfitLabRun, OutfitPoReview } from './export'
import { TodayOutfitImageLab } from './TodayOutfitImageLab'
import './outfitLab.css'

const cloneWardrobe = (input: TodayOutfitInput) => JSON.stringify(input.wardrobe, null, 2)

function recommendationText(result: OutfitRecommendation, input: TodayOutfitInput) {
  if (result.status !== 'success') return `${result.status}: ${result.reason}`
  const name = (id: string | null) => id ? input.wardrobe.find((item) => item.id === id)?.name ?? id : 'None'
  const outfit = result.selectedItemIds
  return `${name(outfit.topId)} + ${name(outfit.bottomId)}${outfit.outerwearId ? ` + ${name(outfit.outerwearId)}` : ''} + ${name(outfit.shoesId)}`
}

function RecommendationPanel({ heading, result, input }: { heading: string; result: OutfitRecommendation; input: TodayOutfitInput }) {
  return <section className="outfit-lab-card"><h2>{heading}</h2><strong>{recommendationText(result, input)}</strong>
    {result.status === 'success' && <><p>{result.reasoning}</p><p><b>Personal Color:</b> {result.personalColorNotes}</p>{result.alternative && <p><b>Alternative:</b> {recommendationText({ ...result, selectedItemIds: result.alternative, alternative: null }, input)}</p>}</>}
    <details><summary>Structured result</summary><pre>{JSON.stringify(result, null, 2)}</pre></details>
  </section>
}

export function TodayOutfitLabView() {
  const first = OUTFIT_BAKEOFF_CASES[0]
  const [caseId, setCaseId] = useState(first.id)
  const [subtype, setSubtype] = useState(first.subtype)
  const [occasion, setOccasion] = useState(first.occasion)
  const [context, setContext] = useState(first.occasionContext ?? '')
  const [wardrobeJson, setWardrobeJson] = useState(cloneWardrobe(first))
  const [candidateId, setCandidateId] = useState<AiCandidateId>('gemini-flash-lite')
  const [runs, setRuns] = useState<OutfitLabRun[]>([])
  const [activeRunId, setActiveRunId] = useState<string | null>(null)
  const [loading, setLoading] = useState(false)
  const abortRef = useRef<AbortController | null>(null)
  const selectedCase = OUTFIT_BAKEOFF_CASES.find((item) => item.id === caseId) ?? first

  const parsed = useMemo(() => {
    try {
      const candidate = { subtype, occasion, ...(context.trim() ? { occasionContext: context.trim() } : {}), wardrobe: JSON.parse(wardrobeJson) }
      return validateTodayOutfitInput(candidate)
    } catch { return { ok: false as const, value: null, issues: ['wardrobe JSON is invalid'] } }
  }, [subtype, occasion, context, wardrobeJson])
  const input = parsed.value
  const baseline = useMemo(() => input ? recommendDeterministicOutfit(input) : null, [input])
  const activeRun = runs.find((run) => run.id === activeRunId) ?? null
  const imageSource = activeRun?.result?.status === 'success'
    ? { caseId: activeRun.caseId, input: activeRun.input, recommendation: activeRun.result, label: `${AI_CANDIDATES[activeRun.candidateId].label} structured result` }
    : input && baseline?.status === 'success'
      ? { caseId, input, recommendation: baseline, label: 'deterministic baseline result' }
      : null

  const chooseCase = (nextId: string) => {
    const next = OUTFIT_BAKEOFF_CASES.find((item) => item.id === nextId) ?? first
    abortRef.current?.abort(); setCaseId(next.id); setSubtype(next.subtype); setOccasion(next.occasion); setContext(next.occasionContext ?? '')
    setWardrobeJson(cloneWardrobe(next)); setActiveRunId(null); setLoading(false)
  }
  const run = async () => {
    if (!input || !baseline) return
    abortRef.current?.abort()
    const controller = new AbortController(); abortRef.current = controller; setLoading(true); setActiveRunId(null)
    const next = await callOutfitCandidate(candidateId, input, controller.signal)
    if (controller.signal.aborted) return
    setLoading(false)
    const id = `${Date.now()}-${candidateId}-${runs.length + 1}`
    const record: OutfitLabRun = {
      id, caseId, input, candidateId, latencyMs: next.latencyMs, result: next.ok ? next.result : null,
      error: next.ok ? null : next.error, validation: next.ok ? next.validation : (next.validation ?? { valid: false, issues: [next.error.message] }),
      baseline, usage: next.ok ? next.usage : null, review: { ...EMPTY_OUTFIT_REVIEW }, timestamp: new Date().toISOString(),
    }
    setRuns((current) => [...current, record]); setActiveRunId(id)
  }
  const setReview = <K extends keyof OutfitPoReview>(key: K, value: OutfitPoReview[K]) => {
    if (!activeRunId) return
    setRuns((current) => current.map((entry) => entry.id === activeRunId ? { ...entry, review: { ...entry.review, [key]: value } } : entry))
  }

  return <main className="outfit-lab-page">
    <span className="outfit-lab-badge">Development only · text data only</span>
    <h1>Today Outfit Recommendation Lab</h1>
    <p>Compare a reproducible app-owned baseline with one manually selected provider/model. No calls run automatically.</p>
    <section className="outfit-lab-controls" aria-label="Lab input">
      <label>Curated case<select value={caseId} onChange={(event) => chooseCase(event.target.value)}>{OUTFIT_BAKEOFF_CASES.map((item) => <option key={item.id} value={item.id}>{item.title}</option>)}</select></label>
      <p className="outfit-lab-intent"><b>Intended test:</b> {selectedCase.intendedTest}</p>
      <div className="outfit-lab-row">
        <label>Subtype<select value={subtype} onChange={(event) => setSubtype(event.target.value as typeof subtype)}>{subtypeOrder.map((value) => <option key={value}>{value}</option>)}</select></label>
        <label>Occasion<select value={occasion} onChange={(event) => setOccasion(event.target.value as typeof occasion)}>{OUTFIT_OCCASIONS.map((value) => <option key={value}>{value}</option>)}</select></label>
        <label>Candidate<select value={candidateId} onChange={(event) => setCandidateId(event.target.value as AiCandidateId)}>{AI_CANDIDATE_IDS.map((id) => <option key={id} value={id}>{AI_CANDIDATES[id].label} · {AI_CANDIDATES[id].model}</option>)}</select></label>
      </div>
      <label>Optional occasion context<input value={context} maxLength={300} onChange={(event) => setContext(event.target.value)} /></label>
      <label>Wardrobe JSON<textarea aria-label="Wardrobe JSON" value={wardrobeJson} rows={16} onChange={(event) => setWardrobeJson(event.target.value)} spellCheck={false} /></label>
      {!parsed.ok && <div role="alert" className="outfit-lab-error">{parsed.issues.join(' · ')}</div>}
      <button type="button" onClick={() => void run()} disabled={!parsed.ok || loading}>{loading ? 'Running…' : `Run ${AI_CANDIDATES[candidateId].label}`}</button>
    </section>

    {input && baseline && <div className="outfit-lab-results"><RecommendationPanel heading="Deterministic baseline" result={baseline} input={input} />
      {activeRun?.result && <RecommendationPanel heading={`${AI_CANDIDATES[activeRun.candidateId].label} · ${Math.round(activeRun.latencyMs)} ms`} result={activeRun.result} input={activeRun.input} />}
      {activeRun?.error != null && <section className="outfit-lab-card outfit-lab-error" role="alert"><h2>Provider result</h2><p>{String((activeRun.error as { kind?: unknown }).kind)}: {String((activeRun.error as { message?: unknown }).message)}</p><pre>{JSON.stringify(activeRun.validation, null, 2)}</pre></section>}
    </div>}

    {activeRun && <fieldset className="outfit-lab-review"><legend>PO review for this exact run</legend>
      {(['outfitQuality', 'personalColorReasoning', 'occasionFit'] as const).map((key) => <label key={key}>{key.replace(/[A-Z]/g, (letter) => ` ${letter.toLowerCase()}`)}<select value={activeRun.review[key]} onChange={(event) => setReview(key, event.target.value as OutfitPoReview[typeof key])}><option value="">Not reviewed</option>{REVIEW_VERDICTS.map((value) => <option key={value} value={value}>{value[0].toUpperCase() + value.slice(1)}</option>)}</select></label>)}
      <label>Constraint compliance<select value={activeRun.review.constraintCompliance} onChange={(event) => setReview('constraintCompliance', event.target.value as OutfitPoReview['constraintCompliance'])}><option value="">Not reviewed</option><option value="pass">Pass</option><option value="fail">Fail</option></select></label>
      <label>Comparison<select value={activeRun.review.comparison} onChange={(event) => setReview('comparison', event.target.value as OutfitPoReview['comparison'])}><option value="">Not reviewed</option><option value="ai-better">AI better</option><option value="baseline-better">Baseline better</option><option value="roughly-equal">Roughly equal</option></select></label>
      <label className="outfit-lab-note">Optional note<textarea value={activeRun.review.note} onChange={(event) => setReview('note', event.target.value)} /></label>
    </fieldset>}
    {imageSource && <TodayOutfitImageLab caseId={imageSource.caseId} input={imageSource.input} recommendation={imageSource.recommendation} sourceLabel={imageSource.label} />}
    <footer><span>{runs.length} recorded run{runs.length === 1 ? '' : 's'} this session.</span> <button type="button" disabled={runs.length === 0} onClick={() => downloadOutfitLabExport(runs)}>Export lab results (JSON)</button></footer>
  </main>
}
