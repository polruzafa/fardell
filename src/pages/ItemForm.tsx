import { useState, type FormEvent } from 'react'
import { Link, useLocation, useNavigate, useParams } from 'react-router-dom'
import { findCategoryFor, type ItemPrefill } from '../catalog'
import { useI18n } from '../i18n'
import { pickCategoryColor } from '../itemsImport'
import { BACKPACK_CATEGORY, itemOf, newId, useStore, type Category } from '../store'

export default function ItemForm() {
  const { id } = useParams()
  const { data, dispatch } = useStore()
  const { t } = useI18n()
  const navigate = useNavigate()
  const location = useLocation()

  const existing = id ? itemOf(data, id) : undefined
  const editing = Boolean(existing)

  // Fitxa preomplerta des del catàleg (només en mode nou). Viu a l'estat de
  // navegació: si es recarrega la pàgina, es perd i es torna a triar.
  const prefill = !id ? (location.state as { prefill?: ItemPrefill } | null)?.prefill : undefined
  const matched = prefill ? findCategoryFor(data.categories, prefill) : undefined
  // Si l'usuari no té la categoria de l'entrada triada, se'n prepara una que
  // només es crearà en desar (cancel·lar no deixa cap rastre).
  const [pendingCategory] = useState<Category | null>(() => {
    if (!prefill || matched) return null
    return {
      id: prefill.categoryId,
      name: prefill.categoryName,
      color: pickCategoryColor(new Set(data.categories.map((c) => c.color)), prefill.categoryName),
    }
  })

  const [name, setName] = useState(existing?.name ?? prefill?.name ?? '')
  const [categoryId, setCategoryId] = useState(
    existing?.categoryId ?? matched?.id ?? prefill?.categoryId ?? data.categories[0]?.id ?? '',
  )
  const [weight, setWeight] = useState(
    existing?.weightGrams?.toString() ?? prefill?.weightGrams?.toString() ?? '',
  )
  const [caseWeight, setCaseWeight] = useState(
    existing?.caseWeightGrams?.toString() ?? prefill?.caseWeightGrams?.toString() ?? '',
  )
  const [placement, setPlacement] = useState(existing?.placement ?? '')
  const initialMaxLoad = existing?.maxLoadGrams ?? prefill?.maxLoadGrams
  const [maxLoad, setMaxLoad] = useState(
    initialMaxLoad != null ? (initialMaxLoad / 1000).toString() : '',
  )
  const [tags, setTags] = useState(existing?.tags.join(', ') ?? prefill?.tags?.join(', ') ?? '')
  const [needs, setNeeds] = useState(existing?.needs?.join(', ') ?? '')
  const [notes, setNotes] = useState(existing?.notes ?? prefill?.notes ?? '')
  const [specs, setSpecs] = useState<{ label: string; value: string }[]>(
    (existing?.specs ?? prefill?.specs)?.map((s) => ({ ...s })) ?? [],
  )
  const [deprecated, setDeprecated] = useState(existing?.deprecated ?? false)
  const [deprecatedReason, setDeprecatedReason] = useState(existing?.deprecatedReason ?? '')

  // Sense categories (inventari acabat d'estrenar i taxonomia esborrada) no
  // es pot desar cap element: es demana crear-ne una als Ajustos.
  const noCategories = data.categories.length === 0 && !pendingCategory

  function setSpec(index: number, field: 'label' | 'value', text: string) {
    setSpecs(specs.map((s, i) => (i === index ? { ...s, [field]: text } : s)))
  }

  if (id && !existing) {
    return (
      <div className="empty">
        <p>{t('item.missing')}</p>
        <Link to="/" className="btn">
          {t('item.backToGear')}
        </Link>
      </div>
    )
  }

  function save(e: FormEvent) {
    e.preventDefault()
    const trimmed = name.trim()
    if (!trimmed || !categoryId) return
    const cleanNeeds = needs
      .split(',')
      .map((need) => need.trim())
      .filter(Boolean)
    const cleanSpecs = specs
      .map((s) => ({ label: s.label.trim(), value: s.value.trim() }))
      .filter((s) => s.label && s.value)
    const item = {
      id: existing?.id ?? newId(),
      name: trimmed,
      categoryId,
      tags: tags
        .split(',')
        .map((tag) => tag.trim())
        .filter(Boolean),
      weightGrams: weight.trim() === '' ? null : Math.max(0, Math.round(Number(weight))),
      caseWeightGrams:
        caseWeight.trim() === '' ? undefined : Math.max(0, Math.round(Number(caseWeight))),
      placement: placement.trim() || undefined,
      maxLoadGrams:
        categoryId !== BACKPACK_CATEGORY || maxLoad.trim() === ''
          ? undefined
          : Math.max(0, Math.round(Number(maxLoad.replace(',', '.')) * 1000)),
      needs: cleanNeeds.length > 0 ? cleanNeeds : undefined,
      specs: cleanSpecs.length > 0 ? cleanSpecs : undefined,
      deprecated: deprecated || undefined,
      deprecatedReason: deprecated ? deprecatedReason.trim() || undefined : undefined,
      notes: notes.trim(),
      photo: existing?.photo ?? null,
      catalogId: existing?.catalogId ?? prefill?.catalogId,
    }
    if (!editing && pendingCategory && categoryId === pendingCategory.id) {
      // La categoria de l'entrada triada no existia: es crea amb l'element,
      // atòmicament.
      dispatch({ type: 'items/addMany', items: [item], categories: [pendingCategory] })
    } else {
      dispatch({ type: editing ? 'item/update' : 'item/add', item })
    }
    navigate(`/element/${item.id}`, { replace: true })
  }

  return (
    <>
      <Link to={editing ? `/element/${id}` : '/'} className="backlink">
        ← {editing ? existing!.name : t('tabs.gear')}
      </Link>
      <h1>{editing ? t('form.editTitle') : t('form.newTitle')}</h1>

      <form className="form" onSubmit={save}>
        <label>
          {t('form.name')}
          <input
            value={name}
            onChange={(e) => setName(e.target.value)}
            required
            autoFocus={!editing}
            placeholder={t('form.namePlaceholder')}
          />
        </label>

        {noCategories ? (
          <p className="hint">{t('form.noCategories')}</p>
        ) : (
          <label>
            {t('item.category')}
            <select value={categoryId} onChange={(e) => setCategoryId(e.target.value)}>
              {pendingCategory && (
                <option value={pendingCategory.id}>{pendingCategory.name}</option>
              )}
              {data.categories.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.name}
                </option>
              ))}
            </select>
          </label>
        )}

        <label>
          {t('form.weight')}
          <input
            type="number"
            inputMode="numeric"
            min="0"
            value={weight}
            onChange={(e) => setWeight(e.target.value)}
            placeholder="0"
          />
        </label>

        <label>
          {t('form.caseWeight')} <span className="hint">{t('form.caseWeightHint')}</span>
          <input
            type="number"
            inputMode="numeric"
            min="0"
            value={caseWeight}
            onChange={(e) => setCaseWeight(e.target.value)}
            placeholder="0"
          />
        </label>

        {categoryId === BACKPACK_CATEGORY && (
          <label>
            {t('form.maxLoad')} <span className="hint">{t('form.maxLoadHint')}</span>
            <input
              type="number"
              inputMode="decimal"
              min="0"
              step="0.1"
              value={maxLoad}
              onChange={(e) => setMaxLoad(e.target.value)}
              placeholder="0"
            />
          </label>
        )}

        <label>
          {t('item.placement')} <span className="hint">{t('form.placementHint')}</span>
          <input
            value={placement}
            onChange={(e) => setPlacement(e.target.value)}
            placeholder={t('form.placementPlaceholder')}
          />
        </label>

        <label>
          {t('item.tags')} <span className="hint">{t('form.tagsHint')}</span>
          <input
            value={tags}
            onChange={(e) => setTags(e.target.value)}
            placeholder={t('form.tagsPlaceholder')}
          />
        </label>

        <label>
          {t('item.needs')} <span className="hint">{t('form.needsHint')}</span>
          <input
            value={needs}
            onChange={(e) => setNeeds(e.target.value)}
            placeholder={t('form.needsPlaceholder')}
          />
        </label>

        <fieldset className="specs-editor">
          <legend>{t('item.specs')}</legend>
          {specs.map((spec, i) => (
            <div key={i} className="spec-row">
              <input
                value={spec.label}
                onChange={(e) => setSpec(i, 'label', e.target.value)}
                placeholder={t('form.specLabelPlaceholder')}
                aria-label={t('form.specLabelPlaceholder')}
              />
              <input
                value={spec.value}
                onChange={(e) => setSpec(i, 'value', e.target.value)}
                placeholder={t('form.specValuePlaceholder')}
                aria-label={t('form.specValuePlaceholder')}
              />
              <button
                type="button"
                className="row-remove"
                aria-label={t('form.specRemove')}
                onClick={() => setSpecs(specs.filter((_, j) => j !== i))}
              >
                −
              </button>
            </div>
          ))}
          <button
            type="button"
            className="btn btn-small"
            onClick={() => setSpecs([...specs, { label: '', value: '' }])}
          >
            {t('form.specAdd')}
          </button>
        </fieldset>

        <label>
          {t('item.notes')}
          <textarea value={notes} onChange={(e) => setNotes(e.target.value)} rows={3} />
        </label>

        <label className="check-row">
          <input
            type="checkbox"
            checked={deprecated}
            onChange={(e) => setDeprecated(e.target.checked)}
          />
          {t('item.deprecated')} <span className="hint">{t('form.deprecatedHint')}</span>
        </label>

        {deprecated && (
          <label>
            {t('form.deprecatedReason')}
            <input
              value={deprecatedReason}
              onChange={(e) => setDeprecatedReason(e.target.value)}
              placeholder={t('form.deprecatedReasonPlaceholder')}
            />
          </label>
        )}

        <div className="actions">
          <button type="submit" className="btn btn-primary" disabled={!categoryId}>
            {t('common.save')}
          </button>
          <Link to={editing ? `/element/${id}` : '/'} className="btn">
            {t('common.cancel')}
          </Link>
        </div>
      </form>
    </>
  )
}
