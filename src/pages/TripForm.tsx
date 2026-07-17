import { useMemo, useState, type FormEvent } from 'react'
import { Link, useNavigate, useParams } from 'react-router-dom'
import { useI18n } from '../i18n'
import {
  BACKPACK_CATEGORY,
  categoryOf,
  formatWeight,
  groupOf,
  groupWeight,
  newId,
  todayISO,
  useStore,
  type Group,
  type Trip,
} from '../store'

/**
 * Llegeix «latitud, longitud» en graus decimals, tal com ho copia qualsevol
 * mapa (p. ex. «42.39871, 1.46297»); també s'accepta la coma decimal si el
 * separador és un espai o un punt i coma.
 */
function parseCoords(raw: string): { lat: number; lon: number } | null {
  const s = raw.trim()
  let m = s.match(/^(-?\d{1,2}(?:\.\d+)?)\s*[,;\s]\s*(-?\d{1,3}(?:\.\d+)?)$/)
  if (!m) m = s.match(/^(-?\d{1,2}(?:,\d+)?)\s*[;\s]\s*(-?\d{1,3}(?:,\d+)?)$/)
  if (!m) return null
  const lat = parseFloat(m[1].replace(',', '.'))
  const lon = parseFloat(m[2].replace(',', '.'))
  if (!Number.isFinite(lat) || !Number.isFinite(lon)) return null
  if (Math.abs(lat) > 90 || Math.abs(lon) > 180) return null
  return { lat, lon }
}

export default function TripForm() {
  const { data, dispatch } = useStore()
  const { t } = useI18n()
  const navigate = useNavigate()
  const { id } = useParams()
  const existing = data.trips.find((trip) => trip.id === id)

  const [name, setName] = useState(existing?.name ?? '')
  const [place, setPlace] = useState(existing?.place ?? '')
  const [startDate, setStartDate] = useState(existing?.startDate ?? todayISO())
  const [endDate, setEndDate] = useState(existing?.endDate ?? '')
  const [coordsText, setCoordsText] = useState(
    existing?.lat != null && existing?.lon != null ? `${existing.lat}, ${existing.lon}` : '',
  )
  const [groupIds, setGroupIds] = useState<string[]>(existing?.groupIds ?? [])
  const [notes, setNotes] = useState(existing?.notes ?? '')
  const [picking, setPicking] = useState(false)

  const coords = useMemo(() => parseCoords(coordsText), [coordsText])
  const coordsBad = coordsText.trim() !== '' && coords === null

  const backpackColor = categoryOf(data, BACKPACK_CATEGORY).color
  const selectedPacks = groupIds
    .map((gid) => groupOf(data, gid))
    .filter((g): g is Group => Boolean(g))
  const candidates = data.groups
    .filter((g) => g.backpackId != null && !groupIds.includes(g.id))
    .sort((a, b) => a.name.localeCompare(b.name, 'ca'))
  const anyPacks = data.groups.some((g) => g.backpackId != null)

  if (id && !existing) {
    return (
      <div className="empty">
        <p>{t('trip.missing')}</p>
        <Link to="/sortides" className="btn">
          {t('trip.backToTrips')}
        </Link>
      </div>
    )
  }

  function save(e: FormEvent) {
    e.preventDefault()
    const trimmed = name.trim()
    if (!trimmed || !startDate || coordsBad) return
    // Si l'últim dia queda abans del primer, s'entén que és d'un sol dia.
    const end = endDate && endDate > startDate ? endDate : undefined
    const trip: Trip = {
      id: existing?.id ?? newId(),
      name: trimmed,
      startDate,
      endDate: end,
      place: place.trim() || undefined,
      lat: coords?.lat,
      lon: coords?.lon,
      groupIds,
      notes: notes.trim(),
    }
    dispatch({ type: existing ? 'trip/update' : 'trip/add', trip })
    navigate('/sortides')
  }

  function remove() {
    if (!existing) return
    if (!window.confirm(t('trip.confirmDelete', { name: existing.name }))) return
    dispatch({ type: 'trip/delete', id: existing.id })
    navigate('/sortides')
  }

  return (
    <>
      <h1>{existing ? t('trip.editTitle') : t('trip.newTitle')}</h1>
      <form className="form" onSubmit={save}>
        <label>
          {t('trip.name')}
          <input
            value={name}
            onChange={(e) => setName(e.target.value)}
            required
            autoFocus={!existing}
            placeholder={t('trip.namePlaceholder')}
          />
        </label>

        <label>
          {t('trip.start')}
          <input
            type="date"
            value={startDate}
            onChange={(e) => setStartDate(e.target.value)}
            required
          />
        </label>

        <label>
          <span>
            {t('trip.end')} <span className="hint">{t('trip.endHint')}</span>
          </span>
          <input
            type="date"
            value={endDate}
            min={startDate}
            onChange={(e) => setEndDate(e.target.value)}
          />
        </label>

        <label>
          {t('trip.place')}
          <input
            value={place}
            onChange={(e) => setPlace(e.target.value)}
            placeholder={t('trip.placePlaceholder')}
          />
        </label>

        <label>
          <span>
            {t('trip.coords')} <span className="hint">{t('trip.coordsHint')}</span>
          </span>
          <input
            inputMode="decimal"
            value={coordsText}
            onChange={(e) => setCoordsText(e.target.value)}
            placeholder="42.39871, 1.46297"
            spellCheck={false}
          />
        </label>
        {coordsBad && <p className="field-error">{t('trip.coordsError')}</p>}

        {/* ── Motxilles ── */}
        <div className="form-field">
          <div className="page-head">
            <h2>{t('trip.packs')}</h2>
            {candidates.length > 0 && (
              <button type="button" className="btn btn-primary" onClick={() => setPicking(!picking)}>
                {picking ? t('common.done') : t('trip.addPacks')}
              </button>
            )}
          </div>

          {picking && candidates.length > 0 && (
            <div className="picker card">
              <ul className="rows">
                {candidates.map((pack) => (
                  <li key={pack.id}>
                    <button
                      type="button"
                      className="row"
                      onClick={() => setGroupIds([...groupIds, pack.id])}
                    >
                      <span className="row-bar" style={{ background: backpackColor }} />
                      <span className="row-main">
                        <span className="row-name">{pack.name}</span>
                      </span>
                      <span className="mono row-weight">{formatWeight(groupWeight(data, pack))}</span>
                      <span className="row-plus" aria-hidden="true">
                        +
                      </span>
                    </button>
                  </li>
                ))}
              </ul>
            </div>
          )}

          {selectedPacks.length > 0 ? (
            <ul className="rows">
              {selectedPacks.map((pack) => (
                <li key={pack.id} className="row">
                  <span className="row-bar" style={{ background: backpackColor }} />
                  <span className="row-main">
                    <span className="row-name">{pack.name}</span>
                  </span>
                  <span className="mono row-weight">{formatWeight(groupWeight(data, pack))}</span>
                  <button
                    type="button"
                    className="row-remove"
                    aria-label={t('trip.removePack', { name: pack.name })}
                    onClick={() => setGroupIds(groupIds.filter((gid) => gid !== pack.id))}
                  >
                    −
                  </button>
                </li>
              ))}
            </ul>
          ) : (
            !picking &&
            (anyPacks ? (
              <p className="hint">{t('trip.packsEmpty')}</p>
            ) : (
              <p className="hint">
                {t('trip.noPacks')} <Link to="/motxilles">{t('tabs.packs')}</Link>
              </p>
            ))
          )}
        </div>

        <label>
          {t('trip.notes')}
          <textarea
            rows={7}
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
            placeholder={t('trip.notesPlaceholder')}
          />
        </label>

        <div className="actions">
          <button type="submit" className="btn btn-primary" disabled={!name.trim() || coordsBad}>
            {t('common.save')}
          </button>
          <button type="button" className="btn" onClick={() => navigate('/sortides')}>
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
