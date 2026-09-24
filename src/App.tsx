import { useEffect, useMemo, useRef, useState } from 'react'
import { checkColor } from './domain/personalColor/colorMatch'
import { normalizeHex, readableTextColor } from './domain/personalColor/colorUtils'
import { getPalette } from './domain/personalColor/palettes'
import { quizQuestions } from './domain/personalColor/quiz'
import { getQuizVisualAsset, quizVisuals } from './domain/personalColor/quizVisuals'
import type { QuizVisual, QuizVisualVariant } from './domain/personalColor/quizVisuals'
import { analyzeQuiz } from './domain/personalColor/scoring'
import { buildDiagnosticReport } from './domain/personalColor/diagnostics'
import type { DiagnosticReport } from './domain/personalColor/diagnostics'
import { getStyleExampleAsset } from './domain/personalColor/styleExampleAssets'
import { getStyleGuide } from './domain/personalColor/styleGuide'
import type { PaletteColor, PersonalColorResult, QuizAnswers, Subtype } from './domain/personalColor/types'
import { colorDisplayName, detectLanguage, getCopy, metalDisplayNote, persistLanguage } from './i18n'
import type { Language, LocaleCopy } from './i18n'
import { ColorResultCard } from './colorChecker/ColorResultCard'
import { toManualResultView } from './colorChecker/manualResult'
import { PhotoCheckerPanel } from './photoChecker/PhotoCheckerPanel'
import { DailyView } from './dailyLuckyColor/DailyView'
import { LearnView } from './learn/ui/LearnView'
import { adService } from './services/ads'
import { clearState, loadState, saveState } from './services/persistence'
import { loadPresentationPreference, savePresentationPreference } from './services/presentationPreference'
import type { PresentationPreference } from './services/presentationPreference'

type View = 'home' | 'presentation' | 'quiz' | 'result' | 'palette' | 'checker' | 'daily' | 'learn'
type CheckerMode = 'manual' | 'photo'

const Icon = ({ name }: { name: 'daily' | 'colors' | 'palette' | 'checker' | 'learn' }) => {
  if (name === 'learn') return <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M3.5 5.5c2.9-1.1 5.8-.9 8.5 1 2.7-1.9 5.6-2.1 8.5-1v13c-2.9-1.1-5.8-.9-8.5 1-2.7-1.9-5.6-2.1-8.5-1v-13Z"/><path d="M12 6.5v13"/></svg>
  if (name === 'daily') return <svg viewBox="0 0 24 24" aria-hidden="true"><path d="m12 3 1.8 4.8L19 9.5l-4 3.2 1.3 5.1-4.3-2.7-4.3 2.7 1.3-5.1-4-3.2 5.2-1.7L12 3Z"/></svg>
  if (name === 'colors') return <svg viewBox="0 0 24 24" aria-hidden="true"><circle cx="12" cy="12" r="8"/><path d="M12 4v16M4 12h16"/></svg>
  if (name === 'palette') return <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M12 3a9 9 0 1 0 0 18h1.2a1.8 1.8 0 0 0 1.4-3c-.7-.9-.1-2.2 1-2.2H18A3 3 0 0 0 21 13c.3-5.5-3.7-10-9-10Z"/><circle cx="7.5" cy="11" r=".8"/><circle cx="10" cy="7" r=".8"/><circle cx="15" cy="7.5" r=".8"/></svg>
  return <svg viewBox="0 0 24 24" aria-hidden="true"><path d="m12 3 2.2 5.4L20 10.6l-5.8 2.2L12 18.5l-2.2-5.7L4 10.6l5.8-2.2L12 3Z"/><path d="m18.5 16 .8 2 .2.5.5.2 2 .8-2 .8-.5.2-.2.5-.8 2-.8-2-.2-.5-.5-.2-2-.8 2-.8.5-.2.2-.5.8-2Z"/></svg>
}

function Brand() {
  return <span className="brand"><span className="brand-mark" aria-hidden="true"><i /><i /><i /></span><span>Personal Color Pocket</span></span>
}

function LanguageSwitcher({ language, copy, onChange }: { language: Language; copy: LocaleCopy; onChange: (language: Language) => void }) {
  return <div className="language-switcher" role="group" aria-label={copy.switcherLabel}>
    <button type="button" aria-label="ไทย" aria-pressed={language === 'th'} onClick={() => onChange('th')}>TH</button>
    <span aria-hidden="true">|</span>
    <button type="button" aria-label="English" aria-pressed={language === 'en'} onClick={() => onChange('en')}>EN</button>
  </div>
}

function PresentationSwitcher({ preference, copy, onChange }: { preference: PresentationPreference; copy: LocaleCopy; onChange: (preference: PresentationPreference) => void }) {
  return <div className="language-switcher presentation-switcher" role="group" aria-label={copy.header.presentationSwitcherLabel}>
    <button type="button" aria-pressed={preference === 'women'} onClick={() => onChange('women')}>{copy.presentation.women}</button>
    <span aria-hidden="true">|</span>
    <button type="button" aria-pressed={preference === 'men'} onClick={() => onChange('men')}>{copy.presentation.men}</button>
  </div>
}

function AppHeader({ copy, language, onLanguage, onHome, presentationPreference, onPresentation }: {
  copy: LocaleCopy
  language: Language
  onLanguage: (language: Language) => void
  onHome: () => void
  presentationPreference: PresentationPreference | null
  onPresentation: (preference: PresentationPreference) => void
}) {
  return <header className="brand-bar">
    <button className="brand-button" onClick={onHome} aria-label={copy.header.homeLabel}><Brand /></button>
    <div className="header-actions">
      <span className="edition">{copy.header.edition}</span>
      {presentationPreference && <PresentationSwitcher preference={presentationPreference} copy={copy} onChange={onPresentation} />}
      <LanguageSwitcher language={language} copy={copy} onChange={onLanguage} />
    </div>
  </header>
}

function PresentationOnboarding({ copy, onChoose }: { copy: LocaleCopy; onChoose: (preference: PresentationPreference) => void }) {
  const options = [
    { id: 'women' as const, label: copy.presentation.women, alt: copy.presentation.womenImageAlt, src: '/img/presentation/women.webp' },
    { id: 'men' as const, label: copy.presentation.men, alt: copy.presentation.menImageAlt, src: '/img/presentation/men.webp' },
  ]
  return <main className="presentation-page page-enter">
    <section className="presentation-card">
      <p className="eyebrow">{copy.presentation.eyebrow}</p>
      <h1>{copy.presentation.title}</h1>
      <p className="question-helper">{copy.presentation.helper}</p>
      <div className="presentation-options">
        {options.map((option) => <button type="button" className="presentation-option" key={option.id} data-presentation-choice={option.id} aria-label={option.label} onClick={() => onChoose(option.id)}>
          <PresentationOptionImage src={option.src} alt={option.alt} fallback={option.label} />
          <span className="presentation-option-label"><strong>{option.label}</strong><span aria-hidden="true">→</span></span>
        </button>)}
      </div>
      <p className="privacy-note">{copy.presentation.note}<br />{copy.presentation.changeLater}</p>
    </section>
  </main>
}

function PresentationOptionImage({ src, alt, fallback }: { src: string; alt: string; fallback: string }) {
  const [failed, setFailed] = useState(false)
  return failed
    ? <span className="presentation-option-fallback" role="img" aria-label={alt}>{fallback}</span>
    : <img className="presentation-option-image" src={src} alt={alt} loading="eager" onError={() => setFailed(true)} />
}

function Welcome({ copy, hasProgress, onStart, onDaily, onLearn }: { copy: LocaleCopy; hasProgress: boolean; onStart: () => void; onDaily: () => void; onLearn: () => void }) {
  return <main className="welcome-page">
    <section className="welcome" id="top">
      <div className="welcome-copy">
        <p className="eyebrow">{copy.welcome.eyebrow}</p>
        <h1>{copy.welcome.titleBefore} <em>{copy.welcome.titleEmphasis}</em></h1>
        <p className="lede">{copy.welcome.lede}</p>
        <button className="primary-button" type="button" onClick={onStart}>{hasProgress ? copy.welcome.continue : copy.welcome.start} <span aria-hidden="true">→</span></button>
        <button className="text-button welcome-daily-link" type="button" onClick={onDaily}>{copy.daily.entryCta}</button>
        <button className="text-button welcome-learn-link" type="button" onClick={onLearn}>{copy.welcome.learnCta}</button>
        <p className="privacy-note">{copy.welcome.privacy}</p>
      </div>
      <figure className="welcome-art">
        <img src="/color-draping.png" alt={copy.welcome.imageAlt} />
        <figcaption><span>12</span>{copy.welcome.profileCount}</figcaption>
      </figure>
    </section>
    <section className="promise-strip" aria-label={copy.welcome.howItWorks}>
      {copy.welcome.steps.map((step, index) => <p key={step}><strong>{String(index + 1).padStart(2, '0')}</strong><span>{step}</span></p>)}
    </section>
  </main>
}

function QuizVisualFallback({ variant }: { variant: QuizVisualVariant }) {
  return <span className={`quiz-visual-fallback fallback-${variant.fallbackKind}`} aria-hidden="true">
    {variant.fallbackSwatches.map((hex, index) => <i key={`${hex}-${index}`} style={{ background: hex }} data-quiz-visual-hex={hex} />)}
  </span>
}

function QuizVisualComparison({ copy, visual, localized, selected, presentationPreference, onSelect }: {
  copy: LocaleCopy
  visual: QuizVisual
  localized: { prompt: string; helper: string; options: Record<string, { label: string; hint: string }> }
  selected: string | undefined
  presentationPreference: PresentationPreference
  onSelect: (answerId: string) => void
}) {
  const [failedAssets, setFailedAssets] = useState<Set<string>>(() => new Set())
  const [viewer, setViewer] = useState<{ src: string; alt: string } | null>(null)
  const moveSelection = (event: React.KeyboardEvent<HTMLButtonElement>, index: number) => {
    if (!['ArrowLeft', 'ArrowRight', 'ArrowUp', 'ArrowDown'].includes(event.key)) return
    event.preventDefault()
    const delta = event.key === 'ArrowLeft' || event.key === 'ArrowUp' ? -1 : 1
    const nextIndex = (index + delta + visual.variants.length) % visual.variants.length
    const next = visual.variants[nextIndex]
    onSelect(next.answerId)
    const group = event.currentTarget.closest('[role="radiogroup"]')
    ;(group?.querySelector(`[data-visual-answer="${next.answerId}"]`) as HTMLButtonElement | null)?.focus()
  }

  return <>
    <section className={`quiz-visual quiz-visual-${visual.visualType}`} data-quiz-question={visual.questionId} aria-label={copy.quiz.visualGuideLabel}>
      <p className="quiz-visual-instruction">{copy.quiz.visualInstruction}</p>
      <div className="quiz-visual-grid" role="radiogroup" aria-label={localized.prompt}>
        {visual.variants.map((variant, index) => {
          const optionCopy = localized.options[variant.answerId]
          const asset = getQuizVisualAsset(variant, presentationPreference)
          const showAsset = asset && !failedAssets.has(asset)
          const alt = copy.quiz.visualImageAlt(optionCopy.label)
          return <div className={`quiz-visual-choice ${selected === variant.answerId ? 'selected' : ''}`} key={variant.answerId} data-visual-id={visual.id}>
            <button type="button" role="radio" aria-checked={selected === variant.answerId} className="quiz-visual-select" data-visual-answer={variant.answerId}
              onClick={() => onSelect(variant.answerId)} onKeyDown={(event) => moveSelection(event, index)}>
              {showAsset
                ? <img src={asset} alt={alt} loading="lazy" onError={() => setFailedAssets((current) => new Set(current).add(asset))} />
                : <QuizVisualFallback variant={variant} />}
              <span className="quiz-visual-label">{optionCopy.label}</span>
              <span className="quiz-visual-check" aria-hidden="true">✓</span>
            </button>
            {showAsset && <button type="button" className="quiz-visual-enlarge" aria-label={copy.quiz.enlargeVisual(optionCopy.label)} onClick={() => setViewer({ src: asset, alt })}>⤢</button>}
          </div>
        })}
      </div>
      <p className="quiz-visual-note">{copy.quiz.visualExampleNote}</p>
    </section>
    <ImageViewerDialog open={viewer !== null} onClose={() => setViewer(null)} src={viewer?.src ?? null} alt={viewer?.alt ?? ''} label={viewer?.alt ?? copy.quiz.visualGuideLabel} closeLabel={copy.styleExamples.viewerClose} />
  </>
}

function Quiz({ copy, answers, step, presentationPreference, onAnswer, onStep, onComplete }: {
  copy: LocaleCopy
  answers: QuizAnswers
  step: number
  presentationPreference: PresentationPreference
  onAnswer: (questionId: string, answerId: string) => void
  onStep: (step: number) => void
  onComplete: () => void
}) {
  const question = quizQuestions[step]
  const localized = copy.quizQuestions[question.id] as { prompt: string; helper: string; options: Record<string, { label: string; hint: string }> }
  const selected = answers[question.id]
  const visual = question.visualId ? quizVisuals[question.visualId] : null
  return <main className="quiz-page page-enter">
    <section className="quiz-progress" aria-label={copy.quiz.progressAria(step + 1, quizQuestions.length)}>
      <div className="progress-label"><span>{copy.quiz.progressLabel}</span><span>{String(step + 1).padStart(2, '0')} / {String(quizQuestions.length).padStart(2, '0')}</span></div>
      <div className="progress-track"><span style={{ width: `${((step + 1) / quizQuestions.length) * 100}%` }} /></div>
    </section>
    <section className="quiz-card" key={question.id}>
      <p className="question-kicker">{copy.quiz.questionLabel(step + 1)}</p>
      <h2>{localized.prompt}</h2>
      <p className="question-helper">{localized.helper}</p>
      {visual && <QuizVisualComparison copy={copy} visual={visual} localized={localized} selected={selected} presentationPreference={presentationPreference} onSelect={(answerId) => onAnswer(question.id, answerId)} />}
      <div className="answer-list" role="radiogroup" aria-label={localized.prompt}>
        {question.options.map((option, index) => {
          const optionCopy = localized.options[option.id]
          return <button
            type="button"
            role="radio"
            aria-checked={selected === option.id}
            className={`answer-option ${selected === option.id ? 'selected' : ''}`}
            onClick={() => onAnswer(question.id, option.id)}
            key={option.id}
          ><span className="answer-key" aria-hidden="true">{String.fromCharCode(65 + index)}</span><span><strong>{optionCopy.label}</strong><small>{optionCopy.hint}</small></span><span className="answer-check" aria-hidden="true">✓</span></button>
        })}
      </div>
    </section>
    <div className="quiz-actions">
      <button className="text-button" type="button" onClick={() => onStep(step - 1)} disabled={step === 0}>← {copy.quiz.back}</button>
      {step < quizQuestions.length - 1
        ? <button className="primary-button compact" type="button" disabled={!selected} onClick={() => onStep(step + 1)}>{copy.quiz.next} <span aria-hidden="true">→</span></button>
        : <button className="primary-button compact" type="button" disabled={!selected} onClick={onComplete}>{copy.quiz.finish} <span aria-hidden="true">✦</span></button>}
    </div>
    <p className="quiz-reassurance">{copy.quiz.reassurance}</p>
  </main>
}

function ColorDots({ copy, language, colors, limit = 8 }: { copy: LocaleCopy; language: Language; colors: PaletteColor[]; limit?: number }) {
  return <div className="color-dots" aria-label={copy.result.previewAria}>{colors.slice(0, limit).map((color) => <span key={color.id} title={`${colorDisplayName(language, color)} ${color.hex}`} style={{ background: color.hex }} />)}</div>
}

// The generated subtype/presentation photos are visual inspiration only (see
// styleExampleAssets.ts / styleGuide.ts) -- they are public/ paths, never imported into the
// JS bundle, and loaded lazily so switching Men/Women or opening Examples fetches on demand
// rather than preloading all 24 assets. A load failure (missing file, offline, etc.) falls
// back to a plain palette-colored panel so Result/Examples never break.
function StyleExampleFrame({ src, alt, subtypeName, accentHex, onEnlarge, enlargeLabel, className = '' }: {
  src: string
  alt: string
  subtypeName: string
  accentHex: string
  onEnlarge: () => void
  enlargeLabel: string
  className?: string
}) {
  const [failed, setFailed] = useState(false)
  return <button type="button" className={`style-image-frame ${className}`} onClick={onEnlarge} aria-label={enlargeLabel}>
    {failed
      ? <span className="style-image-fallback" style={{ background: `linear-gradient(160deg, ${accentHex}, #24181e)` }}><strong>{subtypeName}</strong></span>
      : <img src={src} alt={alt} loading="lazy" onError={() => setFailed(true)} />}
    <span className="style-image-zoom" aria-hidden="true">⤢</span>
  </button>
}

function ImageViewerDialog({ open, onClose, src, alt, label, closeLabel }: {
  open: boolean
  onClose: () => void
  src: string | null
  alt: string
  label: string
  closeLabel: string
}) {
  const dialogRef = useRef<HTMLDialogElement>(null)

  useEffect(() => {
    const dialog = dialogRef.current
    if (!dialog) return
    // Real browsers use the native modal (focus trap + background-interaction block +
    // Escape-to-close all come for free). jsdom's <dialog> does not implement showModal,
    // so we fall back to the plain `open` attribute there -- the onKeyDown handler below
    // covers Escape in that case, keeping the behavior testable without a dependency.
    if (open && !dialog.open) {
      if (typeof dialog.showModal === 'function') dialog.showModal()
      else dialog.setAttribute('open', '')
      // Focus the dialog itself so a subsequent Escape keydown bubbles through it (real
      // showModal() already moves focus inside; this keeps the fallback path consistent).
      dialog.focus()
    } else if (!open && dialog.open) {
      if (typeof dialog.close === 'function') dialog.close()
      else dialog.removeAttribute('open')
    }
  }, [open])

  return <dialog ref={dialogRef} className="image-viewer" aria-label={label} tabIndex={-1} onClose={onClose} onCancel={onClose}
    onKeyDown={(event) => { if (event.key === 'Escape') onClose() }}
    onClick={(event) => { if (event.target === dialogRef.current) onClose() }}>
    {src && <>
      <img src={src} alt={alt} />
      <button type="button" className="image-viewer-close" onClick={onClose}>{closeLabel}</button>
    </>}
  </dialog>
}

function ColorChip({ language, color }: { language: Language; color: PaletteColor }) {
  return <span className="color-chip" title={`${colorDisplayName(language, color)} ${color.hex}`}>
    <i style={{ background: color.hex }} aria-hidden="true" />{colorDisplayName(language, color)}
  </span>
}

function StyleGuideSection({ copy, language, subtype, preference }: { copy: LocaleCopy; language: Language; subtype: Subtype; preference: PresentationPreference }) {
  const guide = getStyleGuide(subtype, preference)
  return <section className="style-guide">
    <h3 className="style-guide-heading">{copy.styleExamples.categoriesHeading}</h3>
    <div className="style-category-grid">
      {guide.categories.map((category) => <article className="style-category" key={category.key}>
        <h4>{copy.styleExamples.categories[category.key]}</h4>
        <div className="style-category-colors">{category.colors.map((color) => <ColorChip key={color.id} language={language} color={color} />)}</div>
      </article>)}
    </div>
    <h3 className="style-guide-heading">{copy.styleExamples.combinationsHeading}</h3>
    <div className="outfit-combo-grid">
      {guide.combinations.map((combo) => <article className="outfit-combo" key={combo.id}>
        <div className="outfit-combo-dots" aria-hidden="true">{combo.pieces.map((piece) => <span key={piece.garmentNounKey} style={{ background: piece.color.hex }} />)}</div>
        <p>{combo.pieces.map((piece) => `${copy.styleExamples.garments[piece.garmentNounKey]} (${colorDisplayName(language, piece.color)})`).join(' + ')}</p>
      </article>)}
    </div>
  </section>
}

// DEV-only diagnostic panel for investigating scoring results (see diagnostics.ts). Never
// rendered in a production build -- gated in App() by import.meta.env.DEV AND an explicit
// ?debug=color query param, so it cannot appear by accident even in a dev build.
const fmt = (value: number) => value.toFixed(4)

function DiagnosticPanel({ answers }: { answers: QuizAnswers }) {
  const report = useMemo<DiagnosticReport>(() => buildDiagnosticReport(answers), [answers])
  const [copied, setCopied] = useState(false)
  const copyJson = async () => {
    try {
      await navigator.clipboard.writeText(JSON.stringify(report, null, 2))
      setCopied(true)
      setTimeout(() => setCopied(false), 1500)
    } catch { /* clipboard may be unavailable (e.g. insecure context) -- non-fatal for a dev tool */ }
  }

  return <section className="diagnostic-panel">
    <div className="diagnostic-panel-head">
      <h2>DEV diagnostic -- personal color scoring</h2>
      <button type="button" onClick={() => void copyJson()}>{copied ? 'Copied!' : 'Copy diagnostic JSON'}</button>
    </div>
    <p>Not shown in production builds. Canonical answer IDs throughout; all values from the live production scoring functions.</p>

    <details open>
      <summary>1. Answer trace ({Object.keys(answers).length}/{report.answerTrace.length} answered)</summary>
      <table>
        <thead><tr><th>Question</th><th>Answer</th><th>temperature</th><th>value</th><th>chroma</th><th>contrast</th></tr></thead>
        <tbody>{report.answerTrace.map((entry) => <tr key={entry.questionId}>
          <td>{entry.questionId}</td><td>{entry.answerId ?? '—'}</td>
          <td>{entry.contribution ? fmt(entry.contribution.temperature) : '—'}</td>
          <td>{entry.contribution ? fmt(entry.contribution.value) : '—'}</td>
          <td>{entry.contribution ? fmt(entry.contribution.chroma) : '—'}</td>
          <td>{entry.contribution ? fmt(entry.contribution.contrast) : '—'}</td>
        </tr>)}</tbody>
      </table>
    </details>

    <details>
      <summary>2. Dimension trace: raw totals to normalized profile</summary>
      <table>
        <thead><tr><th></th><th>temperature</th><th>value</th><th>chroma</th><th>contrast</th></tr></thead>
        <tbody>
          <tr><td>raw total</td><td>{fmt(report.rawTotals.temperature)}</td><td>{fmt(report.rawTotals.value)}</td><td>{fmt(report.rawTotals.chroma)}</td><td>{fmt(report.rawTotals.contrast)}</td></tr>
          <tr><td>possible range (±max)</td><td>{fmt(report.maximums.temperature)}</td><td>{fmt(report.maximums.value)}</td><td>{fmt(report.maximums.chroma)}</td><td>{fmt(report.maximums.contrast)}</td></tr>
          <tr><td>normalized = .5 + total/(2*max)</td><td>{fmt(report.normalizedDimensions.temperature)}</td><td>{fmt(report.normalizedDimensions.value)}</td><td>{fmt(report.normalizedDimensions.chroma)}</td><td>{fmt(report.normalizedDimensions.contrast)}</td></tr>
        </tbody>
      </table>
    </details>

    <details>
      <summary>3. Subtype distance table (weighted, sorted nearest-first)</summary>
      <p>Classification weights: temperature {report.classificationWeights.temperature}, value {report.classificationWeights.value}, chroma {report.classificationWeights.chroma}, contrast {report.classificationWeights.contrast}</p>
      <table>
        <thead><tr><th>#</th><th>Subtype</th><th>Season</th><th>Distance</th><th>target (t/v/c/c)</th></tr></thead>
        <tbody>{report.rankings.map((entry, index) => <tr key={entry.subtype}>
          <td>{index + 1}</td><td>{entry.subtype}</td><td>{entry.season}</td><td>{fmt(entry.distance)}</td>
          <td>{fmt(entry.target.temperature)} / {fmt(entry.target.value)} / {fmt(entry.target.chroma)} / {fmt(entry.target.contrast)}</td>
        </tr>)}</tbody>
      </table>
    </details>

    <details open>
      <summary>4. Top 3 distance decomposition (weighted-squared contribution per dimension)</summary>
      <table>
        <thead><tr><th>Subtype</th><th>temperature</th><th>value</th><th>chroma</th><th>contrast</th><th>sum (dist²)</th><th>distance (√)</th></tr></thead>
        <tbody>{report.top3.map((candidate) => <tr key={candidate.subtype}>
          <td>{candidate.subtype}</td>
          <td>{fmt(candidate.perDimension.temperature)}</td><td>{fmt(candidate.perDimension.value)}</td>
          <td>{fmt(candidate.perDimension.chroma)}</td><td>{fmt(candidate.perDimension.contrast)}</td>
          <td>{fmt(candidate.distanceSquared)}</td><td>{fmt(candidate.distance)}</td>
        </tr>)}</tbody>
      </table>
    </details>

    <details open>
      <summary>5. Warm Spring vs Warm Autumn</summary>
      <table>
        <thead><tr><th></th><th>temperature</th><th>value</th><th>chroma</th><th>contrast</th></tr></thead>
        <tbody>
          <tr><td>user (normalized)</td><td>{fmt(report.warmSpringVsWarmAutumn.user.temperature)}</td><td>{fmt(report.warmSpringVsWarmAutumn.user.value)}</td><td>{fmt(report.warmSpringVsWarmAutumn.user.chroma)}</td><td>{fmt(report.warmSpringVsWarmAutumn.user.contrast)}</td></tr>
          <tr><td>warm-spring target</td><td>{fmt(report.warmSpringVsWarmAutumn.spring.target.temperature)}</td><td>{fmt(report.warmSpringVsWarmAutumn.spring.target.value)}</td><td>{fmt(report.warmSpringVsWarmAutumn.spring.target.chroma)}</td><td>{fmt(report.warmSpringVsWarmAutumn.spring.target.contrast)}</td></tr>
          <tr><td>warm-autumn target</td><td>{fmt(report.warmSpringVsWarmAutumn.autumn.target.temperature)}</td><td>{fmt(report.warmSpringVsWarmAutumn.autumn.target.value)}</td><td>{fmt(report.warmSpringVsWarmAutumn.autumn.target.chroma)}</td><td>{fmt(report.warmSpringVsWarmAutumn.autumn.target.contrast)}</td></tr>
          <tr><td>spring term (weighted²)</td><td>{fmt(report.warmSpringVsWarmAutumn.spring.perDimension.temperature)}</td><td>{fmt(report.warmSpringVsWarmAutumn.spring.perDimension.value)}</td><td>{fmt(report.warmSpringVsWarmAutumn.spring.perDimension.chroma)}</td><td>{fmt(report.warmSpringVsWarmAutumn.spring.perDimension.contrast)}</td></tr>
          <tr><td>autumn term (weighted²)</td><td>{fmt(report.warmSpringVsWarmAutumn.autumn.perDimension.temperature)}</td><td>{fmt(report.warmSpringVsWarmAutumn.autumn.perDimension.value)}</td><td>{fmt(report.warmSpringVsWarmAutumn.autumn.perDimension.chroma)}</td><td>{fmt(report.warmSpringVsWarmAutumn.autumn.perDimension.contrast)}</td></tr>
          <tr><td>favors</td><td>{report.warmSpringVsWarmAutumn.favors.temperature}</td><td>{report.warmSpringVsWarmAutumn.favors.value}</td><td>{report.warmSpringVsWarmAutumn.favors.chroma}</td><td>{report.warmSpringVsWarmAutumn.favors.contrast}</td></tr>
        </tbody>
      </table>
      <p>spring distance {fmt(report.warmSpringVsWarmAutumn.spring.distance)} vs autumn distance {fmt(report.warmSpringVsWarmAutumn.autumn.distance)} -- lower wins.</p>
    </details>

    <details>
      <summary>6. Confidence trace</summary>
      <table>
        <tbody>
          <tr><td>signalStrength</td><td>{fmt(report.confidence.signalStrength)}</td></tr>
          <tr><td>separation</td><td>{fmt(report.confidence.separation)}</td></tr>
          <tr><td>consistency</td><td>{fmt(report.confidence.consistency)}</td></tr>
          <tr><td>answeredRatio</td><td>{fmt(report.confidence.answeredRatio)}</td></tr>
          <tr><td><strong>final confidence</strong></td><td><strong>{fmt(report.confidence.final)}</strong></td></tr>
          <tr><td>label</td><td>{report.confidence.label}</td></tr>
        </tbody>
      </table>
    </details>

    <details>
      <summary>7. Per-answer influence (each question, each alternative, other 8 fixed) -- {report.answerSensitivity.length} probes</summary>
      <table>
        <thead><tr><th>Question</th><th>Current</th><th>If instead</th><th>Resulting subtype</th><th>Confidence</th><th>Top distance</th></tr></thead>
        <tbody>{report.answerSensitivity.map((entry) => <tr key={`${entry.questionId}-${entry.alternativeAnswerId}`}>
          <td>{entry.questionId}</td><td>{entry.currentAnswerId ?? '—'}</td><td>{entry.alternativeAnswerId}</td>
          <td>{entry.subtype}</td><td>{fmt(entry.confidence)}</td><td>{fmt(entry.topDistance)}</td>
        </tr>)}</tbody>
      </table>
    </details>

    <details>
      <summary>8. Leave-one-question-out (reclassified from a genuinely shorter quiz, not a zeroed answer)</summary>
      <table>
        <thead><tr><th>Question removed</th><th>Its answer</th><th>Resulting subtype</th><th>Confidence</th></tr></thead>
        <tbody>{report.leaveOneOut.map((entry) => <tr key={entry.questionId}>
          <td>{entry.questionId}</td><td>{entry.removedAnswerId ?? '—'}</td><td>{entry.subtype ?? entry.note}</td><td>{entry.confidence != null ? fmt(entry.confidence) : '—'}</td>
        </tr>)}</tbody>
      </table>
    </details>
  </section>
}

function ResultView({ copy, language, result, answers, showDiagnostics, presentationPreference, onPresentation, onPalette, onRetake }: {
  copy: LocaleCopy
  language: Language
  result: PersonalColorResult
  answers: QuizAnswers
  showDiagnostics: boolean
  presentationPreference: PresentationPreference
  onPresentation: (preference: PresentationPreference) => void
  onPalette: () => void
  onRetake: () => void
}) {
  const definition = copy.subtypes[result.subtype]
  const palette = getPalette(result.subtype)
  const [viewerOpen, setViewerOpen] = useState(false)
  const imageSrc = getStyleExampleAsset(result.subtype, presentationPreference)
  const imageAlt = copy.styleExamples.imageAlt(definition.name, presentationPreference)
  return <main className={`result-page season-${result.season} page-enter`}>
    <section className="result-hero">
      <div className="result-copy">
        <p className="eyebrow light">{copy.result.eyebrow}</p>
        <h1>{definition.name}</h1>
        {definition.secondaryName && <p className="subtype-secondary"><span>{copy.result.secondaryNameLabel}</span>{definition.secondaryName}</p>}
        <p className="traits">{definition.characteristics.join(' · ')}</p>
        <div className="match-pill"><span>✦</span> {copy.confidence[result.confidenceLabel]}</div>
        <p className="result-summary">{definition.summary}</p>
      </div>
      <div className="result-fan" aria-hidden="true">{palette.best.slice(0, 6).map((color, index) => <span key={color.id} style={{ background: color.hex, transform: `rotate(${(index - 2.5) * 8}deg)`, transformOrigin: '50% 100%' }} />)}</div>
    </section>
    <section className="result-visual content-card">
      <div className="result-visual-head">
        <div><p className="section-number">{copy.result.visualLabel}</p><h2>{copy.result.visualHeading}</h2></div>
        <PresentationSwitcher preference={presentationPreference} copy={copy} onChange={onPresentation} />
      </div>
      <StyleExampleFrame
        src={imageSrc} alt={imageAlt} subtypeName={definition.name} accentHex={palette.best[0].hex}
        onEnlarge={() => setViewerOpen(true)} enlargeLabel={copy.styleExamples.viewLarger} className="result-visual-frame"
      />
      <p className="result-visual-caption">{copy.styleExamples.inspirationBody}</p>
    </section>
    <ImageViewerDialog open={viewerOpen} onClose={() => setViewerOpen(false)} src={viewerOpen ? imageSrc : null} alt={imageAlt} label={copy.styleExamples.viewerLabel(definition.name)} closeLabel={copy.styleExamples.viewerClose} />
    <section className="result-details content-card">
      <div><p className="section-number">{copy.result.whyLabel}</p><h2>{copy.result.whyHeading}</h2></div>
      <ul className="reason-list">{result.reasons.map((reason) => <li key={`${reason.dimension}-${reason.tendency}`}><span>✓</span>{copy.reasonText[reason.dimension][reason.tendency][reason.strength]}</li>)}</ul>
    </section>
    <section className="palette-preview content-card">
      <div><p className="section-number">{copy.result.previewLabel}</p><h2>{copy.result.previewHeading}</h2><p>{copy.result.previewCopy}</p></div>
      <ColorDots copy={copy} language={language} colors={palette.best} />
    </section>
    <div className="result-actions"><button className="primary-button" onClick={onPalette}>{copy.result.paletteCta} <span>→</span></button><button className="text-button" onClick={onRetake}>{copy.result.retake}</button></div>
    <p className="disclaimer">{copy.result.disclaimer}</p>
    {/* The compile-time DEV check lets the production build drop the panel code (V1.2 Slice 8). */}
    {import.meta.env.DEV && showDiagnostics && <DiagnosticPanel answers={answers} />}
  </main>
}

function Swatch({ copy, language, color, selected, onSelect }: { copy: LocaleCopy; language: Language; color: PaletteColor; selected: boolean; onSelect: () => void }) {
  const name = colorDisplayName(language, color)
  return <button className={`swatch ${selected ? 'selected' : ''}`} onClick={onSelect} type="button" aria-pressed={selected} title={copy.palette.selectAria(name)}>
    <span className="swatch-color" style={{ background: color.hex }}><i style={{ color: readableTextColor(color.hex) }}>✓</i></span>
    <strong title={name}>{name}</strong><small>{color.hex}</small>
  </button>
}

function PaletteTabPanel({ copy, language, definition, palette }: { copy: LocaleCopy; language: Language; definition: LocaleCopy['subtypes'][Subtype]; palette: ReturnType<typeof getPalette> }) {
  const [selected, setSelected] = useState<PaletteColor | null>(palette.best[0])
  const sections = [
    ['best', copy.palette.sections.best],
    ['neutrals', copy.palette.sections.neutrals],
    ['accents', copy.palette.sections.accents],
    ['harder', copy.palette.sections.harder],
  ] as const
  return <div id="palette-tabpanel-palette" role="tabpanel" aria-labelledby="palette-tab-palette">
    {selected && <aside className="selected-color" style={{ background: selected.hex, color: readableTextColor(selected.hex) }} aria-live="polite"><span>{copy.palette.selected}</span><strong>{colorDisplayName(language, selected)}</strong><code>{selected.hex}</code></aside>}
    {sections.map(([key, section], index) => <section className="palette-section" key={key}>
      <div className="palette-section-heading"><span>{String(index + 1).padStart(2, '0')}</span><div><h2>{section.title}</h2><p>{section.description}</p></div></div>
      <div className="swatch-grid">{palette[key].map((color) => <Swatch copy={copy} language={language} key={color.id} color={color} selected={selected?.id === color.id} onSelect={() => setSelected(color)} />)}</div>
      {key === 'harder' && <ul className="harder-tips">{copy.palette.harderTips.map((tip) => <li key={tip}>{tip}</li>)}</ul>}
    </section>)}
    <section className="palette-section metals-section"><div className="palette-section-heading"><span>05</span><div><h2>{copy.palette.sections.metals.title}</h2><p>{copy.palette.sections.metals.description}</p></div></div><div className="metal-grid">{palette.metals.map((metal) => <article key={metal.id}><span className="metal-swatch" style={{ background: `linear-gradient(135deg, ${metal.hex}, #fff6 40%, ${metal.hex})` }} /><div><h3>{colorDisplayName(language, metal)}</h3><p>{metalDisplayNote(language, metal)}</p></div></article>)}</div></section>
  </div>
}

function ExamplesTabPanel({ copy, language, result, definition, palette, presentationPreference, onPresentation }: {
  copy: LocaleCopy
  language: Language
  result: PersonalColorResult
  definition: LocaleCopy['subtypes'][Subtype]
  palette: ReturnType<typeof getPalette>
  presentationPreference: PresentationPreference
  onPresentation: (preference: PresentationPreference) => void
}) {
  const [viewerOpen, setViewerOpen] = useState(false)
  const imageSrc = getStyleExampleAsset(result.subtype, presentationPreference)
  const imageAlt = copy.styleExamples.imageAlt(definition.name, presentationPreference)
  return <div id="palette-tabpanel-examples" role="tabpanel" aria-labelledby="palette-tab-examples">
    <div className="examples-head">
      <div><h2>{copy.styleExamples.heading}</h2><p>{copy.styleExamples.intro}</p></div>
      <PresentationSwitcher preference={presentationPreference} copy={copy} onChange={onPresentation} />
    </div>
    <StyleExampleFrame
      src={imageSrc} alt={imageAlt} subtypeName={definition.name} accentHex={palette.best[0].hex}
      onEnlarge={() => setViewerOpen(true)} enlargeLabel={copy.styleExamples.viewLarger} className="examples-frame"
    />
    <ImageViewerDialog open={viewerOpen} onClose={() => setViewerOpen(false)} src={viewerOpen ? imageSrc : null} alt={imageAlt} label={copy.styleExamples.viewerLabel(definition.name)} closeLabel={copy.styleExamples.viewerClose} />
    <div className="inspiration-note">
      <h3>{copy.styleExamples.inspirationHeading}</h3>
      <p>{copy.styleExamples.inspirationBody}</p>
    </div>
    <StyleGuideSection copy={copy} language={language} subtype={result.subtype} preference={presentationPreference} />
    <p className="teaser-strip"><span>{copy.styleExamples.teaserTitle}</span><em>{copy.styleExamples.teaserBadge}</em></p>
  </div>
}

function PaletteView({ copy, language, result, presentationPreference, onPresentation }: {
  copy: LocaleCopy
  language: Language
  result: PersonalColorResult
  presentationPreference: PresentationPreference
  onPresentation: (preference: PresentationPreference) => void
}) {
  const definition = copy.subtypes[result.subtype]
  const palette = getPalette(result.subtype)
  const [tab, setTab] = useState<'palette' | 'examples'>('palette')
  const tabs = [
    ['palette', copy.palette.tabs.palette] as const,
    ['examples', copy.palette.tabs.examples] as const,
  ]
  return <main className="palette-page page-enter">
    <section className="page-heading"><p className="eyebrow">{copy.palette.eyebrow(definition.name)}</p><h1>{copy.palette.title}</h1><p>{copy.palette.intro}</p></section>
    <section className="palette-summary-strip">
      <span>{copy.palette.summaryHeading}</span>
      <strong>{definition.characteristics.join(' • ')}</strong>
    </section>
    <div className="palette-tabs" role="tablist" aria-label={copy.palette.tabsAria}>
      {tabs.map(([key, label]) => <button key={key} type="button" role="tab" id={`palette-tab-${key}`} aria-selected={tab === key} aria-controls={`palette-tabpanel-${key}`} className={tab === key ? 'active' : ''} onClick={() => setTab(key)}>{label}</button>)}
    </div>
    {tab === 'palette'
      ? <PaletteTabPanel copy={copy} language={language} definition={definition} palette={palette} />
      : <ExamplesTabPanel copy={copy} language={language} result={result} definition={definition} palette={palette} presentationPreference={presentationPreference} onPresentation={onPresentation} />}
  </main>
}

function CheckerView({ copy, language, result, presentationPreference }: { copy: LocaleCopy; language: Language; result: PersonalColorResult; presentationPreference: PresentationPreference }) {
  const definition = copy.subtypes[result.subtype]
  const [picker, setPicker] = useState(getPalette(result.subtype).best[0].hex)
  const [input, setInput] = useState(picker)
  const [submitted, setSubmitted] = useState(picker)
  const normalized = normalizeHex(input)
  const match = useMemo(() => checkColor(submitted, result.subtype), [submitted, result.subtype])
  const submit = (event: React.FormEvent) => { event.preventDefault(); if (normalized) { setInput(normalized); setPicker(normalized); setSubmitted(normalized) } }
  // Slice 5d: the same result card as Photo, adapted from the unchanged checkColor() result.
  const view = useMemo(() => match ? toManualResultView(match, copy, presentationPreference) : null, [match, copy, presentationPreference])
  // Manual is the default every time the checker opens. Photo state lives only inside the photo
  // panel, so switching back to Manual discards it and never touches the manual color above.
  const [mode, setMode] = useState<CheckerMode>('manual')
  const modes = [['manual', copy.photoChecker.modes.manual], ['photo', copy.photoChecker.modes.photo]] as const
  return <main className="checker-page page-enter">
    <section className="page-heading"><p className="eyebrow">{copy.checker.eyebrow(definition.name)}</p><h1>{copy.checker.title}</h1><p>{copy.checker.intro}</p></section>
    <div className="palette-tabs checker-modes" role="tablist" aria-label={copy.photoChecker.modeAria}>
      {modes.map(([key, label]) => <button key={key} type="button" role="tab" id={`checker-tab-${key}`} aria-selected={mode === key} aria-controls={`checker-tabpanel-${key}`} className={mode === key ? 'active' : ''} onClick={() => setMode(key)}>{label}</button>)}
    </div>
    {mode === 'photo' && <div id="checker-tabpanel-photo" role="tabpanel" aria-labelledby="checker-tab-photo"><PhotoCheckerPanel copy={copy.photoChecker} resultCopy={copy.colorResult} garments={copy.styleExamples.garments} language={language} presentation={presentationPreference} subtype={result.subtype} /></div>}
    {mode === 'manual' && <div id="checker-tabpanel-manual" role="tabpanel" aria-labelledby="checker-tab-manual">
    <section className="checker-workspace">
      <form className="color-form" onSubmit={submit}>
        <label className="picker-field" style={{ background: picker }}><span>{copy.checker.choose}</span><input type="color" value={picker} onChange={(event) => { const value = event.target.value.toUpperCase(); setPicker(value); setInput(value) }} aria-label={copy.checker.choose} /></label>
        <label className="hex-field"><span>{copy.checker.hexLabel}</span><div><span>#</span><input aria-label={copy.checker.hexLabel} value={input.replace('#', '')} onChange={(event) => setInput(event.target.value)} inputMode="text" maxLength={6} aria-describedby="hex-help" /><button type="submit" disabled={!normalized}>{copy.checker.check}</button></div><small id="hex-help" className={!normalized && input.length > 0 ? 'error' : ''}>{!normalized && input.length > 0 ? copy.checker.hexError : copy.checker.hexExample}</small></label>
      </form>
      {view && <div className="manual-result"><ColorResultCard copy={copy.colorResult} garments={copy.styleExamples.garments} language={language} view={view} /></div>}
    </section>
    </div>}
  </main>
}

function BottomNav({ copy, view, onView }: { copy: LocaleCopy; view: View; onView: (view: View) => void }) {
  const items = [
    ['daily', 'daily', copy.nav.daily], ['result', 'colors', copy.nav.colors], ['palette', 'palette', copy.nav.palette], ['checker', 'checker', copy.nav.checker], ['learn', 'learn', copy.nav.learn],
  ] as const
  return <nav className="bottom-nav" aria-label={copy.nav.aria}>{items.map(([target, icon, label]) => <button key={target} type="button" className={view === target ? 'active' : ''} aria-current={view === target ? 'page' : undefined} onClick={() => onView(target)}><Icon name={icon} /><span>{label}</span></button>)}</nav>
}

function RetakeDialog({ copy, onCancel, onConfirm }: { copy: LocaleCopy; onCancel: () => void; onConfirm: () => void }) {
  return <div className="dialog-backdrop" role="presentation"><section className="dialog" role="alertdialog" aria-modal="true" aria-labelledby="retake-title"><span className="dialog-swatch" aria-hidden="true" /><h2 id="retake-title">{copy.dialog.title}</h2><p>{copy.dialog.body}</p><div><button className="text-button" onClick={onCancel}>{copy.dialog.cancel}</button><button className="primary-button compact" onClick={onConfirm}>{copy.dialog.confirm}</button></div></section></div>
}

export default function App() {
  const initial = useMemo(loadState, [])
  const [language, setLanguage] = useState<Language>(() => detectLanguage())
  const [answers, setAnswers] = useState<QuizAnswers>(initial.answers)
  const [result, setResult] = useState<PersonalColorResult | null>(initial.result)
  const [quizStep, setQuizStep] = useState(initial.quizStep)
  const [presentationPreference, setPresentationPreference] = useState<PresentationPreference | null>(() => loadPresentationPreference())
  const [view, setView] = useState<View>(initial.result ? 'result' : 'home')
  const [confirmRetake, setConfirmRetake] = useState(false)
  const copy = getCopy(language)
  // DEV-only diagnostic gate: never true in a production build (import.meta.env.DEV is
  // compiled out to false), and even in dev it requires an explicit query param so the
  // panel never appears by accident. See diagnostics.ts for the underlying tooling.
  const showDiagnostics = useMemo(
    () => import.meta.env.DEV && new URLSearchParams(window.location.search).get('debug') === 'color',
    [],
  )

  useEffect(() => { saveState({ answers, result, quizStep }) }, [answers, result, quizStep])
  useEffect(() => { document.documentElement.lang = language }, [language])

  const changeLanguage = (next: Language) => { setLanguage(next); persistLanguage(next) }
  const changePresentation = (next: PresentationPreference) => { setPresentationPreference(next); savePresentationPreference(next) }
  const changeView = async (next: View) => {
    if (view === 'result' && next === 'palette') await adService.showInterstitial('palette_open')
    setView(next)
    window.scrollTo({ top: 0, behavior: 'smooth' })
  }
  const completeQuiz = () => { const nextResult = analyzeQuiz(answers); setResult(nextResult); setView('result'); window.scrollTo(0, 0) }
  const startQuiz = () => { setView(presentationPreference ? 'quiz' : 'presentation'); window.scrollTo(0, 0) }
  const choosePresentation = (next: PresentationPreference) => { changePresentation(next); setView('quiz'); window.scrollTo(0, 0) }
  const goHome = () => { setView(result ? 'result' : 'home'); window.scrollTo(0, 0) }
  const retake = () => { clearState(); setAnswers({}); setResult(null); setQuizStep(0); setConfirmRetake(false); setView('quiz'); window.scrollTo(0, 0) }

  return <div className={`app-shell language-${language} ${result ? `has-profile season-${result.season}` : ''}`}>
    <AppHeader copy={copy} language={language} onLanguage={changeLanguage} onHome={goHome} presentationPreference={presentationPreference} onPresentation={changePresentation} />
    {view === 'home' && <Welcome copy={copy} hasProgress={Object.keys(answers).length > 0} onStart={startQuiz} onDaily={() => void changeView('daily')} onLearn={() => void changeView('learn')} />}
    {view === 'presentation' && <PresentationOnboarding copy={copy} onChoose={choosePresentation} />}
    {view === 'quiz' && <Quiz copy={copy} answers={answers} step={quizStep} presentationPreference={presentationPreference ?? 'women'} onAnswer={(questionId, answerId) => setAnswers((current) => ({ ...current, [questionId]: answerId }))} onStep={(next) => setQuizStep(Math.max(0, Math.min(quizQuestions.length - 1, next)))} onComplete={completeQuiz} />}
    {view === 'result' && result && <ResultView copy={copy} language={language} result={result} answers={answers} showDiagnostics={showDiagnostics} presentationPreference={presentationPreference ?? 'women'} onPresentation={changePresentation} onPalette={() => void changeView('palette')} onRetake={() => setConfirmRetake(true)} />}
    {view === 'palette' && result && <PaletteView copy={copy} language={language} result={result} presentationPreference={presentationPreference ?? 'women'} onPresentation={changePresentation} />}
    {view === 'checker' && result && <CheckerView copy={copy} language={language} result={result} presentationPreference={presentationPreference ?? 'women'} />}
    {view === 'daily' && <DailyView copy={copy} result={result} onQuiz={startQuiz} />}
    {view === 'learn' && <LearnView copy={copy} language={language} result={result} onQuiz={startQuiz} onPalette={() => void changeView('palette')} />}
    {result && view !== 'quiz' && view !== 'presentation' && <BottomNav copy={copy} view={view} onView={(next) => void changeView(next)} />}
    {confirmRetake && <RetakeDialog copy={copy} onCancel={() => setConfirmRetake(false)} onConfirm={retake} />}
  </div>
}
