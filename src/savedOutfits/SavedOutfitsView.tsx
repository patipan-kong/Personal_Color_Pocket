import { useEffect, useMemo, useState } from 'react'
import { resolveInspirationColor } from '../domain/todayOutfitProduction/inspirationColors'
import { inspirationPieces } from '../domain/todayOutfitProduction/inspirationPresentation'
import { mapInspirationRecommendationToPreviewInput, mapOwnedRecommendationToPreviewInput } from '../domain/todayOutfitProduction/previewInput'
import { getGarmentDefinition } from '../domain/wardrobe/taxonomy'
import type { LocaleCopy } from '../i18n'
import { deleteSavedOutfitPreviewImage, loadSavedOutfitPreviewImage } from '../services/savedOutfitImages'
import { loadSavedOutfits, removeSavedOutfit } from '../services/savedOutfitPersistence'
import type { SavedOutfitV1 } from '../services/savedOutfitPersistence'
import { buildOutfitPreviewAlt } from '../dailyLuckyColor/OutfitPreview'

interface DisplayPiece {
  readonly key: string
  readonly garmentType: ReturnType<typeof getGarmentDefinition>['id']
  readonly hex: string
}

function savedOutfitPieces(outfit: SavedOutfitV1): readonly DisplayPiece[] {
  const production = outfit.look
  if (production.mode === 'owned') {
    const selection = production.result.recommendation.selection
    const ids = selection.kind === 'separates'
      ? [selection.topId, selection.bottomId, ...(selection.outerwearId ? [selection.outerwearId] : []), selection.shoesId]
      : [selection.onePieceId, ...(selection.outerwearId ? [selection.outerwearId] : []), selection.shoesId]
    return ids.flatMap((id) => {
      const fact = production.request.wardrobe.find((item) => item.id === id)
      return fact ? [{ key: id, garmentType: fact.garmentType, hex: fact.hex }] : []
    })
  }
  return inspirationPieces(production.result.recommendation).flatMap((piece, index) => {
    const color = resolveInspirationColor(piece.color, production.request)
    return color ? [{ key: `${piece.garmentType}-${index}`, garmentType: piece.garmentType, hex: color.hex }] : []
  })
}

function previewInput(outfit: SavedOutfitV1) {
  return outfit.look.mode === 'owned'
    ? mapOwnedRecommendationToPreviewInput(outfit.look.result.recommendation, outfit.look.request).value
    : mapInspirationRecommendationToPreviewInput(outfit.look.result.recommendation, outfit.look.request).value
}

function SavedPreview({ copy, outfit }: { copy: LocaleCopy; outfit: SavedOutfitV1 }) {
  const [objectUrl, setObjectUrl] = useState<string | null>(null)
  const input = useMemo(() => previewInput(outfit), [outfit])
  useEffect(() => {
    let active = true
    let createdUrl: string | null = null
    setObjectUrl(null)
    if (!outfit.previewImageId) { setObjectUrl(null); return () => { active = false } }
    void loadSavedOutfitPreviewImage(outfit.previewImageId).then((image) => {
      if (!active || !image || typeof URL.createObjectURL !== 'function') return
      try {
        createdUrl = URL.createObjectURL(image.blob)
        setObjectUrl(createdUrl)
      } catch { setObjectUrl(null) }
    })
    return () => {
      active = false
      if (createdUrl && typeof URL.revokeObjectURL === 'function') URL.revokeObjectURL(createdUrl)
    }
  }, [outfit.previewImageId])
  if (!objectUrl || !input) return null
  return <div className="saved-outfit-preview">
    <img src={objectUrl} alt={buildOutfitPreviewAlt(copy, input)} />
    <p>{copy.daily.previewHelper}</p>
  </div>
}

function SavedOutfitCard({ copy, outfit, onDelete }: { copy: LocaleCopy; outfit: SavedOutfitV1; onDelete: (outfit: SavedOutfitV1) => void }) {
  const pieces = savedOutfitPieces(outfit)
  return <article className="owned-outfit-result saved-outfit-card">
    <div className="owned-outfit-heading"><div><p className="eyebrow">{copy.savedOutfits.savedLabel}</p><h2>{copy.savedOutfits.outfitHeading}</h2></div><span>{outfit.look.mode === 'owned' ? copy.daily.sourceLabels.wardrobe : copy.daily.sourceLabels.inspiration}</span></div>
    <SavedPreview copy={copy} outfit={outfit} />
    <ul className="owned-outfit-pieces" aria-label={copy.savedOutfits.piecesLabel}>
      {pieces.map((piece) => <li key={piece.key}><i style={{ backgroundColor: piece.hex }} aria-hidden="true" /><div><strong>{getGarmentDefinition(piece.garmentType).label[copy.language]}</strong><span>{piece.hex}</span></div></li>)}
    </ul>
    <p className="saved-outfit-occasion">{copy.daily.occasionExplanations[outfit.look.request.occasion]}</p>
    <button type="button" className="text-button saved-outfit-delete" onClick={() => onDelete(outfit)}>{copy.savedOutfits.delete}</button>
  </article>
}

export function SavedOutfitsView({ copy, onBack }: { copy: LocaleCopy; onBack: () => void }) {
  const initial = loadSavedOutfits()
  const [outfits, setOutfits] = useState<readonly SavedOutfitV1[]>(initial.status === 'loaded' ? initial.outfits : [])
  const [message, setMessage] = useState(initial.status === 'loaded' ? '' : copy.savedOutfits.loadFailure)

  const remove = async (outfit: SavedOutfitV1) => {
    setMessage('')
    if (outfit.previewImageId && !await deleteSavedOutfitPreviewImage(outfit.previewImageId)) {
      setMessage(copy.savedOutfits.deleteFailure)
      return
    }
    const result = removeSavedOutfit(outfit.id)
    if (!result.ok) { setMessage(copy.savedOutfits.deleteFailure); return }
    setOutfits(result.outfits)
  }

  return <main className="saved-outfits-page page-enter">
    <header className="daily-hero saved-outfits-header">
      <button type="button" className="text-button" onClick={onBack}>← {copy.savedOutfits.back}</button>
      <p className="eyebrow">{copy.savedOutfits.eyebrow}</p>
      <h1>{copy.savedOutfits.title}</h1>
      <p>{copy.savedOutfits.intro}</p>
    </header>
    {message && <p className="owned-outfit-error" role="alert">{message}</p>}
    {outfits.length === 0
      ? <section className="daily-empty-result"><div><h2>{copy.savedOutfits.emptyTitle}</h2><p>{copy.savedOutfits.emptyBody}</p></div></section>
      : <div className="saved-outfit-list">{outfits.map((outfit) => <SavedOutfitCard key={outfit.id} copy={copy} outfit={outfit} onDelete={(target) => void remove(target)} />)}</div>}
  </main>
}
