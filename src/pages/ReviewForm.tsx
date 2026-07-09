import { useEffect, useMemo, useRef, useState, type FormEvent } from 'react'
import { Link, useNavigate, useParams } from 'react-router-dom'
import { StarPicker, StarRating } from '../components/Stars'
import { getLocale, useI18n } from '../i18n'
import { deletePhoto, downscale, savePhoto, usePhoto } from '../photos'
import {
  BACKPACK_CATEGORY,
  categoryOf,
  collectGroupItemIds,
  cookingKits,
  formatWeight,
  groupOf,
  groupWeight,
  itemOf,
  newId,
  useStore,
  type GearItem,
  type Group,
  type Review,
} from '../store'

/** Afegeix https:// si s'ha enganxat l'adreça sense esquema. */
function normalizeUrl(raw: string): string | undefined {
  const trimmed = raw.trim()
  if (!trimmed) return undefined
  return /^[a-z][a-z0-9+.-]*:/i.test(trimmed) ? trimmed : `https://${trimmed}`
}

export default function ReviewForm() {
  const { data, dispatch } = useStore()
  const { t } = useI18n()
  const navigate = useNavigate()
  const { id } = useParams()
  const existing = data.reviews.find((r) => r.id === id)

  const [name, setName] = useState(existing?.name ?? '')
  const [taste, setTaste] = useState(existing?.taste ?? 0)
  const [tasteNotes, setTasteNotes] = useState(existing?.tasteNotes ?? '')
  const [cleaning, setCleaning] = useState(existing?.cleaning ?? 0)
  const [cleaningNotes, setCleaningNotes] = useState(existing?.cleaningNotes ?? '')
  const [priceRating, setPriceRating] = useState(existing?.priceRating ?? 0)
  const [difficulty, setDifficulty] = useState(existing?.difficulty ?? 0)
  const [difficultyNotes, setDifficultyNotes] = useState(existing?.difficultyNotes ?? '')
  const [kitIds, setKitIds] = useState<string[]>(existing?.kitIds ?? [])
  const [itemIds, setItemIds] = useState<string[]>(existing?.itemIds ?? [])
  const [ingredients, setIngredients] = useState(existing?.extraIngredients?.join(', ') ?? '')
  const [price, setPrice] = useState(existing?.price != null ? String(existing.price) : '')
  const [notes, setNotes] = useState(existing?.notes ?? '')
  const [url, setUrl] = useState(existing?.url ?? '')

  const [picking, setPicking] = useState(false)
  const [pickQuery, setPickQuery] = useState('')

  // La fotografia triada no es desa fins que es desa la ressenya: així una
  // ressenya nova cancel·lada no deixa cap foto orfe a IndexedDB.
  const stored = usePhoto(existing?.id)
  const [pendingPhoto, setPendingPhoto] = useState<Blob | null>(null)
  const [pendingUrl, setPendingUrl] = useState<string | null>(null)
  const [photoRemoved, setPhotoRemoved] = useState(false)
  const [savingPhoto, setSavingPhoto] = useState(false)
  const fileInput = useRef<HTMLInputElement>(null)

  // En canviar de foto (o en desmuntar) es revoca l'URL d'objecte anterior.
  useEffect(
    () => () => {
      if (pendingUrl) URL.revokeObjectURL(pendingUrl)
    },
    [pendingUrl],
  )

  const q = pickQuery.trim().toLowerCase()

  // Kits oferts: els majoritàriament de cuina que encara no s'han triat.
  const kitCandidates = useMemo(
    () =>
      cookingKits(data)
        .filter((g) => !kitIds.includes(g.id))
        .filter((g) => !q || g.name.toLowerCase().includes(q))
        .sort((a, b) => a.name.localeCompare(b.name, 'ca')),
    [data, kitIds, q],
  )

  // Elements solts: tot el material menys motxilles, el ja triat i el que
  // ja arriba a través d'algun kit triat.
  const itemCandidates = useMemo(() => {
    const covered = new Set(itemIds)
    for (const kitId of kitIds) {
      const kit = groupOf(data, kitId)
      if (kit) for (const memberId of collectGroupItemIds(data, kit)) covered.add(memberId)
    }
    return data.items
      .filter((it) => it.categoryId !== BACKPACK_CATEGORY && !covered.has(it.id))
      .filter((it) => !q || `${it.name} ${it.tags.join(' ')}`.toLowerCase().includes(q))
      .sort((a, b) => a.name.localeCompare(b.name, 'ca'))
  }, [data, kitIds, itemIds, q])

  if (id && !existing) {
    return (
      <div className="empty">
        <p>{t('review.missing')}</p>
        <Link to="/menjar" className="btn">
          {t('review.backToReviews')}
        </Link>
      </div>
    )
  }

  const previewUrl = pendingUrl ?? (photoRemoved ? null : stored.url)
  const selectedKits = kitIds
    .map((kitId) => groupOf(data, kitId))
    .filter((g): g is Group => Boolean(g))
  const selectedItems = itemIds
    .map((itemId) => itemOf(data, itemId))
    .filter((it): it is GearItem => Boolean(it))
  const gearWeight =
    selectedKits.reduce((sum, kit) => sum + groupWeight(data, kit), 0) +
    selectedItems.reduce((sum, item) => sum + (item.weightGrams ?? 0), 0)

  // El total no es tria: és la mitjana de les puntuacions posades.
  const ratingParts = [taste, cleaning, priceRating, difficulty].filter((n) => n > 0)
  const score =
    ratingParts.length > 0
      ? ratingParts.reduce((sum, n) => sum + n, 0) / ratingParts.length
      : null

  async function onPhotoPicked(file: File) {
    setSavingPhoto(true)
    try {
      const blob = await downscale(file)
      setPendingPhoto(blob)
      setPendingUrl(URL.createObjectURL(blob))
      setPhotoRemoved(false)
    } catch {
      window.alert(t('item.photoError'))
    } finally {
      setSavingPhoto(false)
    }
  }

  function removePhoto() {
    setPendingPhoto(null)
    setPendingUrl(null)
    setPhotoRemoved(true)
  }

  async function save(e: FormEvent) {
    e.preventDefault()
    const trimmed = name.trim()
    if (!trimmed || score === null) return
    const parsedPrice = parseFloat(price.replace(',', '.'))
    const ingredientList = ingredients
      .split(',')
      .map((s) => s.trim())
      .filter(Boolean)
    const review: Review = {
      id: existing?.id ?? newId(),
      name: trimmed,
      taste: taste > 0 ? taste : undefined,
      tasteNotes: tasteNotes.trim() || undefined,
      cleaning: cleaning > 0 ? cleaning : undefined,
      cleaningNotes: cleaningNotes.trim() || undefined,
      priceRating: priceRating > 0 ? priceRating : undefined,
      difficulty: difficulty > 0 ? difficulty : undefined,
      difficultyNotes: difficultyNotes.trim() || undefined,
      kitIds,
      itemIds,
      extraIngredients: ingredientList.length > 0 ? ingredientList : undefined,
      price: Number.isFinite(parsedPrice) && parsedPrice >= 0 ? parsedPrice : undefined,
      notes: notes.trim(),
      url: normalizeUrl(url),
      date: existing?.date ?? new Date().toISOString().slice(0, 10),
    }
    try {
      if (pendingPhoto) await savePhoto(review.id, pendingPhoto)
      else if (photoRemoved && existing) await deletePhoto(existing.id)
    } catch {
      window.alert(t('item.photoError'))
    }
    dispatch({ type: existing ? 'review/update' : 'review/add', review })
    navigate('/menjar')
  }

  function remove() {
    if (!existing) return
    if (!window.confirm(t('review.confirmDelete', { name: existing.name }))) return
    void deletePhoto(existing.id)
    dispatch({ type: 'review/delete', id: existing.id })
    navigate('/menjar')
  }

  return (
    <>
      <h1>{existing ? t('review.editTitle') : t('review.newTitle')}</h1>
      <form className="form" onSubmit={save}>
        <label>
          {t('review.name')}
          <input
            value={name}
            onChange={(e) => setName(e.target.value)}
            required
            autoFocus={!existing}
            placeholder={t('review.namePlaceholder')}
          />
        </label>

        {/* ── Puntuació ── */}
        <div className="page-head">
          <h2>{t('review.rating')}</h2>
          <span className="review-score">
            <StarRating
              value={score !== null ? Math.round(score) : 0}
              label={t('review.stars', {
                n:
                  score !== null
                    ? score.toLocaleString(getLocale(), { maximumFractionDigits: 1 })
                    : 0,
              })}
            />
            <span className="mono review-score-num">
              {score !== null
                ? score.toLocaleString(getLocale(), { maximumFractionDigits: 1 })
                : '—'}
            </span>
          </span>
        </div>
        <p className="hint review-total-hint">
          {t('review.total')} {t('review.totalHint')}
        </p>

        <div className="form-field">
          <span className="form-field-label">{t('review.taste')}</span>
          <StarPicker value={taste} onChange={setTaste} label={t('review.taste')} clearable />
        </div>

        <label>
          {t('review.tasteNotes')}
          <textarea
            rows={2}
            value={tasteNotes}
            onChange={(e) => setTasteNotes(e.target.value)}
            placeholder={t('review.tasteNotesPlaceholder')}
          />
        </label>

        <div className="form-field">
          <span className="form-field-label">
            {t('review.cleaning')} <span className="hint">{t('review.cleaningHint')}</span>
          </span>
          <StarPicker
            value={cleaning}
            onChange={setCleaning}
            label={t('review.cleaning')}
            clearable
          />
        </div>

        <label>
          {t('review.cleaningNotes')}
          <textarea
            rows={2}
            value={cleaningNotes}
            onChange={(e) => setCleaningNotes(e.target.value)}
            placeholder={t('review.cleaningNotesPlaceholder')}
          />
        </label>

        <div className="form-field">
          <span className="form-field-label">
            {t('review.priceRating')} <span className="hint">{t('review.priceRatingHint')}</span>
          </span>
          <StarPicker
            value={priceRating}
            onChange={setPriceRating}
            label={t('review.priceRating')}
            clearable
          />
        </div>

        <label>
          <span>
            {t('review.price')} <span className="hint">{t('review.priceHint')}</span>
          </span>
          <input
            type="number"
            inputMode="decimal"
            min={0}
            step="0.01"
            value={price}
            onChange={(e) => setPrice(e.target.value)}
            placeholder="3,50"
          />
        </label>

        <div className="form-field">
          <span className="form-field-label">
            {t('review.difficulty')} <span className="hint">{t('review.difficultyHint')}</span>
          </span>
          <StarPicker
            value={difficulty}
            onChange={setDifficulty}
            label={t('review.difficulty')}
            clearable
          />
        </div>

        <label>
          {t('review.difficultyNotes')}
          <textarea
            rows={2}
            value={difficultyNotes}
            onChange={(e) => setDifficultyNotes(e.target.value)}
            placeholder={t('review.difficultyNotesPlaceholder')}
          />
        </label>

        {/* ── Material emprat ── */}
        <div className="form-field">
          <div className="page-head">
            <h2>{t('review.gear')}</h2>
            <button type="button" className="btn btn-primary" onClick={() => setPicking(!picking)}>
              {picking ? t('common.done') : t('pack.addItems')}
            </button>
          </div>

          {picking && (
            <div className="picker card">
              <input
                type="search"
                className="search"
                placeholder={t('pack.searchPlaceholder')}
                value={pickQuery}
                onChange={(e) => setPickQuery(e.target.value)}
                autoFocus
              />
              {kitCandidates.length === 0 && itemCandidates.length === 0 ? (
                <p className="hint">{t('pack.noCandidates')}</p>
              ) : (
                <>
                  {kitCandidates.length > 0 && (
                    <>
                      <h3 className="group-title">
                        {t('tabs.kits')} <span className="hint">{t('review.kitHint')}</span>
                      </h3>
                      <ul className="rows">
                        {kitCandidates.map((kit) => (
                          <li key={kit.id}>
                            <button
                              type="button"
                              className="row"
                              onClick={() => setKitIds([...kitIds, kit.id])}
                            >
                              <span className="row-bar row-bar-kit" />
                              <span className="row-main">
                                <span className="row-name">{kit.name}</span>
                              </span>
                              <span className="mono row-weight">
                                {formatWeight(groupWeight(data, kit))}
                              </span>
                              <span className="row-plus" aria-hidden="true">
                                +
                              </span>
                            </button>
                          </li>
                        ))}
                      </ul>
                    </>
                  )}
                  {itemCandidates.length > 0 && (
                    <ul className="rows">
                      {itemCandidates.map((item) => (
                        <li key={item.id}>
                          <button
                            type="button"
                            className="row"
                            onClick={() => setItemIds([...itemIds, item.id])}
                          >
                            <span
                              className="row-bar"
                              style={{ background: categoryOf(data, item.categoryId).color }}
                            />
                            <span className="row-main">
                              <span className="row-name">{item.name}</span>
                            </span>
                            <span className="mono row-weight">{formatWeight(item.weightGrams)}</span>
                            <span className="row-plus" aria-hidden="true">
                              +
                            </span>
                          </button>
                        </li>
                      ))}
                    </ul>
                  )}
                </>
              )}
            </div>
          )}

          {(selectedKits.length > 0 || selectedItems.length > 0) && (
            <ul className="rows">
              {selectedKits.map((kit) => (
                <li key={kit.id} className="row">
                  <span className="row-bar row-bar-kit" />
                  <span className="row-main">
                    <span className="row-name">{kit.name}</span>
                  </span>
                  <span className="mono row-weight">{formatWeight(groupWeight(data, kit))}</span>
                  <button
                    type="button"
                    className="row-remove"
                    aria-label={t('pack.removeItem', { name: kit.name })}
                    onClick={() => setKitIds(kitIds.filter((kid) => kid !== kit.id))}
                  >
                    −
                  </button>
                </li>
              ))}
              {selectedItems.map((item) => (
                <li key={item.id} className="row">
                  <span
                    className="row-bar"
                    style={{ background: categoryOf(data, item.categoryId).color }}
                  />
                  <span className="row-main">
                    <span className="row-name">{item.name}</span>
                  </span>
                  <span className="mono row-weight">{formatWeight(item.weightGrams)}</span>
                  <button
                    type="button"
                    className="row-remove"
                    aria-label={t('pack.removeItem', { name: item.name })}
                    onClick={() => setItemIds(itemIds.filter((iid) => iid !== item.id))}
                  >
                    −
                  </button>
                </li>
              ))}
            </ul>
          )}
          {selectedKits.length > 0 || selectedItems.length > 0 ? (
            <p className="hint mono">
              {t('weightbar.total', { weight: formatWeight(gearWeight) })}
            </p>
          ) : (
            !picking && <p className="hint">{t('review.gearEmpty')}</p>
          )}
        </div>

        {/* ── Notes i fotografia ── */}
        <div className="page-head">
          <h2>{t('review.other')}</h2>
        </div>

        <label>
          <span>
            {t('review.extraIngredients')}{' '}
            <span className="hint">{t('review.extraIngredientsHint')}</span>
          </span>
          <input
            value={ingredients}
            onChange={(e) => setIngredients(e.target.value)}
            placeholder={t('review.extraIngredientsPlaceholder')}
          />
        </label>

        <label>
          {t('review.notes')}
          <textarea
            rows={7}
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
            placeholder={t('review.notesPlaceholder')}
          />
        </label>

        <label>
          <span>
            {t('review.url')} <span className="hint">{t('review.urlHint')}</span>
          </span>
          <input
            type="text"
            inputMode="url"
            value={url}
            onChange={(e) => setUrl(e.target.value)}
            placeholder="https://…"
            spellCheck={false}
          />
        </label>

        <div className="form-field">
          <span className="form-field-label">{t('item.photo')}</span>
          <div className="photo-slot" aria-label={t('item.photo')}>
            {previewUrl ? (
              <img src={previewUrl} alt={name} />
            ) : (
              <button
                type="button"
                className="photo-add"
                disabled={savingPhoto}
                onClick={() => fileInput.current?.click()}
              >
                {savingPhoto ? '…' : t('item.addPhoto')}
              </button>
            )}
          </div>
          {previewUrl && (
            <div className="actions photo-actions">
              <button
                type="button"
                className="btn btn-small"
                disabled={savingPhoto}
                onClick={() => fileInput.current?.click()}
              >
                {t('item.changePhoto')}
              </button>
              <button type="button" className="btn btn-small" onClick={removePhoto}>
                {t('item.deletePhoto')}
              </button>
              <span className="hint">{t('item.photoLocalHint')}</span>
            </div>
          )}
          <input
            ref={fileInput}
            type="file"
            accept="image/*"
            hidden
            onChange={(e) => {
              const file = e.target.files?.[0]
              if (file) void onPhotoPicked(file)
              e.target.value = ''
            }}
          />
        </div>

        <div className="actions">
          <button type="submit" className="btn btn-primary" disabled={score === null}>
            {t('common.save')}
          </button>
          <button type="button" className="btn" onClick={() => navigate('/menjar')}>
            {t('common.cancel')}
          </button>
          {existing && (
            <button type="button" className="btn btn-danger" onClick={remove}>
              {t('common.delete')}
            </button>
          )}
        </div>
      </form>
    </>
  )
}
