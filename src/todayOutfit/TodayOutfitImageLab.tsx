import { useEffect, useMemo, useRef, useState } from 'react'
import { OUTFIT_IMAGE_CANDIDATES, OUTFIT_IMAGE_CANDIDATE_IDS } from '../domain/todayOutfitImage/catalog'
import type { OutfitImageCandidateId } from '../domain/todayOutfitImage/catalog'
import { deriveTodayOutfitImageRequest, outfitImageSourceKey } from '../domain/todayOutfitImage/contract'
import type { SuccessfulOutfitRecommendation, TodayOutfitInput } from '../domain/todayOutfit/contract'
import { callOutfitImageCandidate } from './outfitImageApi'
import { downloadOutfitImageLabExport, EMPTY_OUTFIT_IMAGE_REVIEW, IMAGE_REVIEW_VERDICTS } from './outfitImageExport'
import type { OutfitImageLabRun, OutfitImagePoReview } from './outfitImageExport'

interface Props {
  caseId: string
  input: TodayOutfitInput
  recommendation: SuccessfulOutfitRecommendation
  sourceLabel: string
}

const reviewLabel = (key: 'visualQuality' | 'garmentFidelity' | 'colorFidelity' | 'outfitReadability') => ({
  visualQuality: 'Visual quality', garmentFidelity: 'Garment fidelity', colorFidelity: 'Color fidelity', outfitReadability: 'Outfit readability',
})[key]

export function TodayOutfitImageLab({ caseId, input, recommendation, sourceLabel }: Props) {
  const [candidate, setCandidate] = useState<OutfitImageCandidateId>('gemini-image-lite')
  const [runs, setRuns] = useState<OutfitImageLabRun[]>([])
  const [loading, setLoading] = useState(false)
  const abortRef = useRef<AbortController | null>(null)
  const request = useMemo(() => deriveTodayOutfitImageRequest(input, recommendation, candidate), [input, recommendation, candidate])
  const sourceKey = useMemo(() => outfitImageSourceKey(request), [request])
  const currentRuns = runs.filter((run) => run.sourceKey === sourceKey)
  const latestByCandidate = OUTFIT_IMAGE_CANDIDATE_IDS.map((id) => [...currentRuns].reverse().find((run) => run.request.candidate === id)).filter((run): run is OutfitImageLabRun => Boolean(run))

  useEffect(() => {
    setLoading(false)
    return () => abortRef.current?.abort()
  }, [sourceKey])

  const generate = async () => {
    abortRef.current?.abort()
    const controller = new AbortController()
    abortRef.current = controller
    setLoading(true)
    const result = await callOutfitImageCandidate(request, controller.signal)
    if (controller.signal.aborted) return
    setLoading(false)
    setRuns((existing) => [...existing, {
      id: `${Date.now()}-${request.candidate}-${existing.length + 1}`,
      sourceKey,
      caseId,
      request,
      result,
      review: { ...EMPTY_OUTFIT_IMAGE_REVIEW },
      timestamp: new Date().toISOString(),
    }])
  }

  const setReview = <K extends keyof OutfitImagePoReview>(runId: string, key: K, value: OutfitImagePoReview[K]) => {
    setRuns((existing) => existing.map((run) => run.id === runId ? { ...run, review: { ...run.review, [key]: value } } : run))
  }

  const pieces = (['top', 'bottom', 'outerwear', 'shoes'] as const).flatMap((slot) => {
    const item = request.selectedItems[slot]
    return item ? [{ slot, item }] : []
  })

  return <section className="outfit-image-lab" aria-labelledby="outfit-image-lab-heading">
    <header><div><span className="outfit-lab-badge">Development only · generated images stay in memory</span><h2 id="outfit-image-lab-heading">AI Outfit Preview Lab</h2></div><p>Source: <b>{sourceLabel}</b>. The image model visualizes this validated selection; it does not choose an outfit.</p></header>
    <div className="outfit-image-facts" aria-label="Selected outfit facts">{pieces.map(({ slot, item }) => <article key={slot}><small>{slot}</small><strong>{item.name}</strong><span><i style={{ backgroundColor: item.color.hex }} aria-hidden="true" />{item.color.name} · {item.color.hex}</span></article>)}</div>
    <div className="outfit-image-actions">
      <label>Image candidate<select aria-label="Image candidate" value={candidate} onChange={(event) => setCandidate(event.target.value as OutfitImageCandidateId)}>{OUTFIT_IMAGE_CANDIDATE_IDS.map((id) => <option key={id} value={id}>{OUTFIT_IMAGE_CANDIDATES[id].label} · {OUTFIT_IMAGE_CANDIDATES[id].model}</option>)}</select></label>
      <button type="button" disabled={loading} onClick={() => void generate()}>{loading ? 'Generating preview…' : 'Generate outfit preview'}</button>
    </div>
    <p className="outfit-lab-intent">Generation is manual. Selecting a case, changing facts, receiving a text result, or switching candidates never calls an image model.</p>

    {latestByCandidate.length > 0 && <div className="outfit-image-comparison" role="region" aria-label="Image candidate previews">{latestByCandidate.map((run) => <article className="outfit-image-result" key={run.id}>
      <h3>{OUTFIT_IMAGE_CANDIDATES[run.request.candidate].label}</h3>
      {run.result.status === 'success' ? <>
        <img src={run.result.imageDataUrl} alt={`Generated flat-lay preview from ${OUTFIT_IMAGE_CANDIDATES[run.request.candidate].label}`} />
        <dl><div><dt>Model</dt><dd>{run.result.model}</dd></div><div><dt>Latency</dt><dd>{Math.round(run.result.latencyMs)} ms</dd></div><div><dt>MIME</dt><dd>{run.result.mimeType}</dd></div>{run.result.usage && <div><dt>Usage</dt><dd>{run.result.usage.totalTokens ?? 'Provider did not report total tokens'} tokens</dd></div>}</dl>
        <fieldset className="outfit-image-review"><legend>Independent PO review</legend>
          {(['visualQuality', 'garmentFidelity', 'colorFidelity', 'outfitReadability'] as const).map((key) => <label key={key}>{reviewLabel(key)}<select value={run.review[key]} onChange={(event) => setReview(run.id, key, event.target.value as OutfitImagePoReview[typeof key])}><option value="">Not reviewed</option>{IMAGE_REVIEW_VERDICTS.map((value) => <option key={value} value={value}>{value[0].toUpperCase() + value.slice(1)}</option>)}</select></label>)}
          <label>Constraint compliance<select value={run.review.constraintCompliance} onChange={(event) => setReview(run.id, 'constraintCompliance', event.target.value as OutfitImagePoReview['constraintCompliance'])}><option value="">Not reviewed</option><option value="pass">Pass</option><option value="fail">Fail</option></select></label>
          <label>Would this preview help?<select value={run.review.wouldHelp} onChange={(event) => setReview(run.id, 'wouldHelp', event.target.value as OutfitImagePoReview['wouldHelp'])}><option value="">Not reviewed</option><option value="yes">Yes</option><option value="maybe">Maybe</option><option value="no">No</option></select></label>
          <label className="outfit-lab-note">Optional note<textarea value={run.review.note} onChange={(event) => setReview(run.id, 'note', event.target.value)} /></label>
        </fieldset>
      </> : <div className="outfit-lab-error" role="alert"><b>{run.result.reason.kind}</b><p>{run.result.reason.message}</p><small>{run.result.model} · {Math.round(run.result.latencyMs)} ms</small></div>}
    </article>)}</div>}
    <footer><span>{runs.length} image run{runs.length === 1 ? '' : 's'} recorded this session.</span><button type="button" disabled={runs.length === 0} onClick={() => downloadOutfitImageLabExport(runs)}>Export image bakeoff (JSON)</button></footer>
  </section>
}
