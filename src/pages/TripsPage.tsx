import { Link } from 'react-router-dom'
import Forecast from '../components/Forecast'
import { getLocale, useI18n } from '../i18n'
import {
  BACKPACK_CATEGORY,
  categoryOf,
  formatWeight,
  groupOf,
  groupWeight,
  todayISO,
  tripDays,
  tripEndDate,
  useStore,
  type GearData,
  type Group,
  type Trip,
} from '../store'

function fmtDay(iso: string): string {
  const thisYear = iso.slice(0, 4) === todayISO().slice(0, 4)
  return new Date(`${iso}T12:00:00`).toLocaleDateString(getLocale(), {
    day: 'numeric',
    month: 'short',
    ...(thisYear ? {} : { year: 'numeric' }),
  })
}

function formatDates(trip: Trip): string {
  const end = tripEndDate(trip)
  return end === trip.startDate ? fmtDay(trip.startDate) : `${fmtDay(trip.startDate)} – ${fmtDay(end)}`
}

function TripCard({ data, trip, upcoming }: { data: GearData; trip: Trip; upcoming: boolean }) {
  const { t } = useI18n()
  const packs = trip.groupIds
    .map((id) => groupOf(data, id))
    .filter((g): g is Group => Boolean(g))
  const total = packs.reduce((sum, pack) => sum + groupWeight(data, pack), 0)
  const days = tripDays(trip)

  const sub: string[] = [formatDates(trip), days === 1 ? t('trip.oneDay') : t('trip.days', { n: days })]
  if (trip.place) sub.push(trip.place)

  return (
    <div className="card card-link trip-card">
      <div className="card-head">
        <Link to={`/sortides/${trip.id}`} className="card-title card-title-link">
          {trip.name}
        </Link>
        {packs.length > 0 && <span className="mono">{formatWeight(total)}</span>}
      </div>
      <p className="card-sub">{sub.join(' · ')}</p>
      {packs.length > 0 && (
        <div className="trip-packs">
          {packs.map((pack) => (
            <span key={pack.id} className="tag">
              <span
                className="dot"
                style={{ background: categoryOf(data, BACKPACK_CATEGORY).color }}
              />
              {pack.name}
              <span className="mono"> {formatWeight(groupWeight(data, pack))}</span>
            </span>
          ))}
        </div>
      )}
      {trip.notes && <p className="trip-notes">{trip.notes}</p>}
      {upcoming && <Forecast trip={trip} />}
    </div>
  )
}

export default function TripsPage() {
  const { data } = useStore()
  const { t } = useI18n()

  const today = todayISO()
  // Una sortida és «propera» fins que acaba el seu últim dia.
  const upcoming = data.trips
    .filter((trip) => tripEndDate(trip) >= today)
    .sort((a, b) => a.startDate.localeCompare(b.startDate))
  const past = data.trips
    .filter((trip) => tripEndDate(trip) < today)
    .sort((a, b) => b.startDate.localeCompare(a.startDate))

  return (
    <>
      <div className="page-head">
        <h1>{t('tabs.trips')}</h1>
        <Link to="/sortides/nova" className="btn btn-primary">
          {t('trips.new')}
        </Link>
      </div>

      {data.trips.length === 0 && (
        <div className="empty">
          <p>{t('trips.empty')}</p>
        </div>
      )}

      {upcoming.length > 0 && (
        <>
          <h2 className="group-title">{t('trips.upcoming')}</h2>
          <ul className="cards">
            {upcoming.map((trip) => (
              <li key={trip.id}>
                <TripCard data={data} trip={trip} upcoming />
              </li>
            ))}
          </ul>
        </>
      )}

      {past.length > 0 && (
        <>
          <h2 className="group-title">{t('trips.past')}</h2>
          <ul className="cards">
            {past.map((trip) => (
              <li key={trip.id}>
                <TripCard data={data} trip={trip} upcoming={false} />
              </li>
            ))}
          </ul>
        </>
      )}
    </>
  )
}
