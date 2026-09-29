import { useEffect, useMemo, useRef, useState } from 'react'
import { CanonicalColorLabel } from '../CanonicalColorLabel'
import { describeColor } from '../domain/colorNames/colorNames'
import { normalizeHex } from '../domain/personalColor/colorUtils'
import { getPalette } from '../domain/personalColor/palettes'
import type { PersonalColorResult, PaletteColor } from '../domain/personalColor/types'
import {
  GARMENT_DEFINITIONS,
  WARDROBE_FORMALITIES,
  WARDROBE_SLOTS,
  createWardrobeId,
  getDefaultFormality,
  getGarmentDefinition,
  getRecordWardrobeSlot,
  getWardrobeSlot,
  getWardrobeDisplayName,
} from '../domain/wardrobe'
import type { GarmentType, WardrobeFormality, WardrobeRecordV1, WardrobeSlot } from '../domain/wardrobe'
import { colorDisplayName } from '../i18n'
import type { Language, LocaleCopy } from '../i18n'
import { loadWardrobe, saveWardrobe } from '../services/wardrobePersistence'
import type { WardrobeLoadResult } from '../services/wardrobePersistence'
import { BASIC_WARDROBE_COLORS } from './basicColors'
import './wardrobe.css'

type WardrobeFilter = 'all' | WardrobeSlot
type EditorMode = { kind: 'add' } | { kind: 'edit'; id: string }
type ColorSource = 'basic' | 'palette' | 'exact'

const SLOT_ICONS: Record<WardrobeSlot, string> = { top: '👕', bottom: '👖', 'one-piece': '👗', outerwear: '🧥', shoes: '👟' }
const PALETTE_GROUPS = ['best', 'neutrals', 'accents', 'harder'] as const

function paletteColors(result: PersonalColorResult | null): PaletteColor[] {
  if (!result) return []
  const palette = getPalette(result.subtype)
  return PALETTE_GROUPS.flatMap((group) => palette[group])
}

function loadMessage(copy: LocaleCopy, result: Exclude<WardrobeLoadResult, { status: 'loaded' }>) {
  if (result.status === 'unsupported-version') return copy.wardrobe.storage.unsupported
  if (result.status === 'unavailable') return copy.wardrobe.storage.unavailable
  return copy.wardrobe.storage.corrupt
}

function WardrobeDeleteDialog({ copy, name, onCancel, onConfirm }: { copy: LocaleCopy; name: string; onCancel: () => void; onConfirm: () => void }) {
  const cancelRef = useRef<HTMLButtonElement>(null)
  useEffect(() => { cancelRef.current?.focus() }, [])
  return <div className="dialog-backdrop" role="presentation">
    <section className="dialog wardrobe-delete-dialog" role="alertdialog" aria-modal="true" aria-labelledby="wardrobe-delete-title">
      <span className="wardrobe-delete-icon" aria-hidden="true">🗑️</span>
      <h2 id="wardrobe-delete-title">{copy.wardrobe.deleteTitle}</h2>
      <p>{copy.wardrobe.deleteBody(name)}</p>
      <div><button ref={cancelRef} type="button" className="text-button" onClick={onCancel}>{copy.wardrobe.cancel}</button><button type="button" className="primary-button compact danger-button" onClick={onConfirm}>{copy.wardrobe.confirmDelete}</button></div>
    </section>
  </div>
}

function WardrobeEditor({ copy, language, result, mode, item, retainedSlot, onCancel, onSave }: {
  copy: LocaleCopy
  language: Language
  result: PersonalColorResult | null
  mode: EditorMode
  item: WardrobeRecordV1 | null
  retainedSlot: WardrobeSlot
  onCancel: () => void
  onSave: (record: WardrobeRecordV1, addAnother: boolean, slot: WardrobeSlot) => void
}) {
  const availablePalette = useMemo(() => paletteColors(result), [result])
  const visibleCanonical = item?.color.canonicalColorId && availablePalette.some((color) => color.id === item.color.canonicalColorId)
  const [activeSlot, setActiveSlot] = useState<WardrobeSlot>(() => item ? getRecordWardrobeSlot(item) : retainedSlot)
  const [garmentType, setGarmentType] = useState<GarmentType | null>(item?.garmentType ?? null)
  const [formality, setFormality] = useState<WardrobeFormality>(item?.formality ?? 'casual')
  const [customName, setCustomName] = useState(item?.customName ?? '')
  const [colorSource, setColorSource] = useState<ColorSource>(() => visibleCanonical ? 'palette' : 'basic')
  const [colorHex, setColorHex] = useState<string | null>(item?.color.hex ?? null)
  const [canonicalColorId, setCanonicalColorId] = useState<string | undefined>(item?.color.canonicalColorId)
  const [colorTouched, setColorTouched] = useState(false)
  const [exactInput, setExactInput] = useState(item?.color.hex.replace('#', '') ?? '808080')
  const titleRef = useRef<HTMLHeadingElement>(null)
  useEffect(() => { titleRef.current?.focus() }, [])

  const selectType = (type: GarmentType) => {
    setGarmentType(type)
    if (mode.kind === 'add') setFormality(getDefaultFormality(type))
  }
  const switchColorSource = (source: ColorSource) => {
    setColorSource(source)
    setColorTouched(true)
    setCanonicalColorId(undefined)
    if (source === 'exact') {
      const preserved = colorHex ?? normalizeHex(exactInput)
      setColorHex(preserved)
      if (preserved) setExactInput(preserved.slice(1))
    } else setColorHex(null)
  }
  const chooseBasic = (hex: string) => { setColorTouched(true); setColorHex(hex); setCanonicalColorId(undefined) }
  const choosePalette = (color: PaletteColor) => { setColorTouched(true); setColorHex(color.hex); setCanonicalColorId(color.id) }
  const changeExact = (value: string) => {
    setExactInput(value.replace('#', '').slice(0, 6))
    setColorTouched(true)
    setCanonicalColorId(undefined)
    setColorHex(normalizeHex(value))
  }
  const resolvedColor = !colorTouched && item ? item.color : colorHex ? { hex: colorHex, ...(canonicalColorId ? { canonicalColorId } : {}) } : null
  const preview: WardrobeRecordV1 | null = garmentType && resolvedColor ? {
    id: item?.id ?? 'wardrobe-preview', garmentType, color: resolvedColor, formality, ...(customName.trim() ? { customName: customName.trim() } : {}),
  } : null

  const submit = (addAnother: boolean) => {
    if (!garmentType || !resolvedColor) return
    onSave({
      id: item?.id ?? createWardrobeId(),
      garmentType,
      color: resolvedColor,
      formality,
      ...(customName.trim() ? { customName: customName.trim() } : {}),
    }, addAnother, activeSlot)
  }

  return <section className="wardrobe-editor content-card" aria-labelledby="wardrobe-editor-title">
    <div className="wardrobe-editor-head"><div><p className="eyebrow">{mode.kind === 'add' ? copy.wardrobe.addEyebrow : copy.wardrobe.editEyebrow}</p><h2 id="wardrobe-editor-title" ref={titleRef} tabIndex={-1}>{mode.kind === 'add' ? copy.wardrobe.addTitle : copy.wardrobe.editTitle}</h2></div><button type="button" className="wardrobe-close" aria-label={copy.wardrobe.closeEditor} onClick={onCancel}>×</button></div>

    <fieldset className="wardrobe-fieldset"><legend><span>1</span>{copy.wardrobe.typeHeading}</legend>
      <div className="wardrobe-slot-tabs" role="group" aria-label={copy.wardrobe.slotGroupLabel}>{WARDROBE_SLOTS.map((slot) => <button type="button" key={slot} aria-pressed={activeSlot === slot} onClick={() => { setActiveSlot(slot); if (garmentType && getWardrobeSlot(garmentType) !== slot) setGarmentType(null) }}>{copy.wardrobe.slots[slot]}</button>)}</div>
      <div className="wardrobe-type-grid">{GARMENT_DEFINITIONS.filter((definition) => definition.slot === activeSlot).map((definition) => <button type="button" key={definition.id} aria-pressed={garmentType === definition.id} onClick={() => selectType(definition.id)}><span aria-hidden="true">{SLOT_ICONS[definition.slot]}</span>{definition.label[language]}</button>)}</div>
    </fieldset>

    <fieldset className="wardrobe-fieldset"><legend><span>2</span>{copy.wardrobe.colorHeading}</legend>
      <div className="wardrobe-color-tabs" role="tablist" aria-label={copy.wardrobe.colorSourceLabel}>
        {(['basic', 'palette', 'exact'] as const).map((source) => <button type="button" role="tab" key={source} aria-selected={colorSource === source} aria-controls={`wardrobe-color-${source}`} disabled={source === 'palette' && !result} onClick={() => switchColorSource(source)}>{copy.wardrobe.colorSources[source]}</button>)}
      </div>
      {colorSource === 'basic' && <div id="wardrobe-color-basic" role="tabpanel" className="wardrobe-color-grid">{BASIC_WARDROBE_COLORS.map((color) => {
        const name = describeColor(color.hex)!
        const label = name[language]
        return <button type="button" key={color.id} className="wardrobe-color-choice" aria-label={`${label} ${color.hex}`} aria-pressed={colorHex === color.hex && !canonicalColorId} onClick={() => chooseBasic(color.hex)}><i style={{ background: color.hex }} aria-hidden="true" /><span>{label}</span></button>
      })}</div>}
      {colorSource === 'palette' && result && <div id="wardrobe-color-palette" role="tabpanel" className="wardrobe-palette-grid">{availablePalette.map((color) => <button type="button" key={color.id} className="wardrobe-palette-choice" aria-label={copy.wardrobe.selectColor(colorDisplayName(language, color))} aria-pressed={canonicalColorId === color.id} onClick={() => choosePalette(color)}><i style={{ background: color.hex }} aria-hidden="true" /><CanonicalColorLabel color={color} language={language} mode="compact" /></button>)}</div>}
      {!result && <p className="wardrobe-palette-note">{copy.wardrobe.noPalette}</p>}
      {colorSource === 'exact' && <div id="wardrobe-color-exact" role="tabpanel" className="wardrobe-exact-color"><input type="color" aria-label={copy.wardrobe.colorPickerLabel} value={normalizeHex(exactInput) ?? '#808080'} onChange={(event) => changeExact(event.target.value)} /><label><span>{copy.wardrobe.hexLabel}</span><span className="wardrobe-hex-input"><b aria-hidden="true">#</b><input aria-label={copy.wardrobe.hexLabel} value={exactInput} onChange={(event) => changeExact(event.target.value)} inputMode="text" maxLength={6} aria-invalid={exactInput.length > 0 && !normalizeHex(exactInput)} /></span></label>{exactInput.length > 0 && !normalizeHex(exactInput) && <small className="error">{copy.wardrobe.hexError}</small>}</div>}
    </fieldset>

    {preview && <div className="wardrobe-name-preview" aria-live="polite"><span>{copy.wardrobe.namePreview}</span><strong>{getWardrobeDisplayName(preview, language)}</strong></div>}

    <details className="wardrobe-more"><summary>{copy.wardrobe.moreDetails}</summary><div className="wardrobe-more-fields"><label><span>{copy.wardrobe.customName}</span><input value={customName} onChange={(event) => setCustomName(event.target.value)} maxLength={80} placeholder={copy.wardrobe.customNamePlaceholder} /></label><fieldset><legend>{copy.wardrobe.formality}</legend><div className="wardrobe-formality-options">{WARDROBE_FORMALITIES.map((value) => <label key={value}><input type="radio" name="wardrobe-formality" checked={formality === value} onChange={() => setFormality(value)} />{copy.wardrobe.formalities[value]}</label>)}</div>{garmentType && <button type="button" className="text-button wardrobe-use-default" onClick={() => setFormality(getDefaultFormality(garmentType))}>{copy.wardrobe.useDefault(copy.wardrobe.formalities[getDefaultFormality(garmentType)])}</button>}</fieldset></div></details>

    <div className="wardrobe-editor-actions"><button type="button" className="text-button" onClick={onCancel}>{copy.wardrobe.cancel}</button>{mode.kind === 'add' && <button type="button" className="wardrobe-secondary-button" disabled={!garmentType || !resolvedColor} onClick={() => submit(true)}>{copy.wardrobe.saveAnother}</button>}<button type="button" className="primary-button compact" disabled={!garmentType || !resolvedColor} onClick={() => submit(false)}>{copy.wardrobe.save}</button></div>
  </section>
}

export function WardrobeView({ copy, language, result, onBack }: { copy: LocaleCopy; language: Language; result: PersonalColorResult | null; onBack: () => void }) {
  const initial = useMemo(loadWardrobe, [])
  const [loadResult, setLoadResult] = useState<WardrobeLoadResult>(initial)
  const [items, setItems] = useState<readonly WardrobeRecordV1[]>(initial.status === 'loaded' ? initial.items : [])
  const [filter, setFilter] = useState<WardrobeFilter>('all')
  const [editor, setEditor] = useState<EditorMode | null>(null)
  const [retainedSlot, setRetainedSlot] = useState<WardrobeSlot>('top')
  const [deleteId, setDeleteId] = useState<string | null>(null)
  const [saveState, setSaveState] = useState<'idle' | 'failed'>('idle')
  const addButtonRef = useRef<HTMLButtonElement>(null)

  const reload = () => {
    const next = loadWardrobe()
    setLoadResult(next)
    if (next.status === 'loaded') setItems(next.items)
  }
  const persist = (next: readonly WardrobeRecordV1[]) => {
    setItems(next)
    const saved = saveWardrobe(next)
    if (saved.ok) { setItems(saved.items); setSaveState('idle') } else setSaveState('failed')
    return saved.ok
  }
  const closeEditor = () => {
    setEditor(null)
    queueMicrotask(() => addButtonRef.current?.focus())
  }
  const saveItem = (record: WardrobeRecordV1, addAnother: boolean, slot: WardrobeSlot) => {
    const next = editor?.kind === 'edit' ? items.map((candidate) => candidate.id === editor.id ? record : candidate) : [...items, record]
    persist(next)
    if (addAnother) { setRetainedSlot(slot); setEditor(null); queueMicrotask(() => setEditor({ kind: 'add' })) } else closeEditor()
  }
  const confirmDelete = () => {
    if (!deleteId) return
    persist(items.filter((item) => item.id !== deleteId))
    setDeleteId(null)
    queueMicrotask(() => addButtonRef.current?.focus())
  }
  const cancelDelete = () => {
    const id = deleteId
    setDeleteId(null)
    if (id) queueMicrotask(() => document.querySelector<HTMLButtonElement>(`[data-wardrobe-delete-id="${id}"]`)?.focus())
  }
  const visibleItems = filter === 'all' ? items : items.filter((item) => getRecordWardrobeSlot(item) === filter)
  const editingItem = editor?.kind === 'edit' ? items.find((item) => item.id === editor.id) ?? null : null

  if (loadResult.status !== 'loaded') return <main className="wardrobe-page page-enter">
    <button type="button" className="wardrobe-back" onClick={onBack}>← {copy.wardrobe.back}</button>
    <section className="wardrobe-storage-block content-card" role="alert"><span aria-hidden="true">🛡️</span><h1>{copy.wardrobe.storage.title}</h1><p>{loadMessage(copy, loadResult)}</p><button type="button" className="primary-button compact" onClick={reload}>{copy.wardrobe.storage.retry}</button></section>
  </main>

  return <main className="wardrobe-page page-enter">
    <button type="button" className="wardrobe-back" onClick={onBack}>← {copy.wardrobe.back}</button>
    <header className="wardrobe-hero"><div><p className="eyebrow">{copy.wardrobe.eyebrow}</p><h1>{copy.wardrobe.title}</h1><p>{copy.wardrobe.itemCount(items.length)}</p></div><button ref={addButtonRef} type="button" className="primary-button compact" onClick={() => setEditor({ kind: 'add' })}>+ {copy.wardrobe.add}</button></header>

    {saveState === 'failed' && <div className="wardrobe-save-message is-error" role="alert"><div><strong>{copy.wardrobe.storage.notSavedTitle}</strong><p>{copy.wardrobe.storage.notSavedBody}</p></div><button type="button" onClick={() => persist(items)}>{copy.wardrobe.storage.retrySave}</button></div>}
    {editor && <WardrobeEditor key={`${editor.kind}-${editor.kind === 'edit' ? editor.id : retainedSlot}`} copy={copy} language={language} result={result} mode={editor} item={editingItem} retainedSlot={retainedSlot} onCancel={closeEditor} onSave={saveItem} />}

    {!editor && items.length === 0 ? <section className="wardrobe-empty content-card"><span className="wardrobe-empty-icon" aria-hidden="true">👕</span><h2>{copy.wardrobe.emptyTitle}</h2><p>{copy.wardrobe.emptyBody}</p><div className="wardrobe-coverage"><p><strong>{copy.wardrobe.coverageHeading}</strong></p><p>{copy.wardrobe.coverageSeparates}</p><span>{copy.wardrobe.coverageOr}</span><p>{copy.wardrobe.coverageOnePiece}</p><small>{copy.wardrobe.coverageOuterwear}</small></div><button type="button" className="primary-button compact" onClick={() => setEditor({ kind: 'add' })}>+ {copy.wardrobe.add}</button></section> : null}

    {!editor && items.length > 0 && <>
      <div className="wardrobe-filters" role="group" aria-label={copy.wardrobe.filterLabel}>{(['all', ...WARDROBE_SLOTS] as const).map((value) => <button type="button" key={value} aria-pressed={filter === value} onClick={() => setFilter(value)}>{value === 'all' ? copy.wardrobe.all : copy.wardrobe.slots[value]}</button>)}</div>
      {visibleItems.length === 0 ? <section className="wardrobe-filter-empty"><p>{copy.wardrobe.filterEmpty}</p><button type="button" className="text-button" onClick={() => { if (filter !== 'all') setRetainedSlot(filter); setEditor({ kind: 'add' }) }}>+ {copy.wardrobe.add}</button></section> : <div className="wardrobe-card-grid">{visibleItems.map((item) => {
        const definition = getGarmentDefinition(item.garmentType)
        const displayName = getWardrobeDisplayName(item, language)
        return <article className="wardrobe-card" key={item.id}><div className="wardrobe-card-visual"><span aria-hidden="true">{SLOT_ICONS[definition.slot]}</span><i style={{ background: item.color.hex }} aria-label={`${describeColor(item.color.hex)![language]} ${item.color.hex}`} /></div><div className="wardrobe-card-body"><h2 className="wardrobe-card-name">{displayName}</h2><p>{definition.label[language]}</p><span className="wardrobe-formality-badge">{copy.wardrobe.formalities[item.formality]}</span></div><div className="wardrobe-card-actions"><button type="button" aria-label={copy.wardrobe.editName(displayName)} onClick={() => setEditor({ kind: 'edit', id: item.id })}>{copy.wardrobe.edit}</button><button type="button" className="danger-text" aria-label={copy.wardrobe.deleteName(displayName)} data-wardrobe-delete-id={item.id} onClick={() => setDeleteId(item.id)}>{copy.wardrobe.delete}</button></div></article>
      })}</div>}
    </>}
    {deleteId && <WardrobeDeleteDialog copy={copy} name={getWardrobeDisplayName(items.find((item) => item.id === deleteId)!, language)} onCancel={cancelDelete} onConfirm={confirmDelete} />}
  </main>
}
