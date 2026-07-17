import { getLocale, useI18n, type TKey } from '../i18n'
import { useForecast, weatherKind, type ForecastDay, type WeatherKind } from '../weather'
import type { Trip } from '../store'

const KIND_LABEL: Record<WeatherKind, TKey> = {
  clear: 'weather.clear',
  partly: 'weather.partly',
  cloudy: 'weather.cloudy',
  fog: 'weather.fog',
  drizzle: 'weather.drizzle',
  rain: 'weather.rain',
  snow: 'weather.snow',
  storm: 'weather.storm',
}

/** Núvol compartit per tots els glifs que en duen (el traç fa 1.6, com les icones de l'app). */
const CLOUD = 'M7.5 15.5a3.5 3.5 0 1 1 .7-6.93A4.8 4.8 0 0 1 17.6 9.9h.2a2.8 2.8 0 0 1 0 5.6H7.5Z'

function WeatherGlyph({ kind }: { kind: WeatherKind }) {
  const parts: Record<WeatherKind, string[]> = {
    clear: [
      'M12 3.5v2M12 18.5v2M3.5 12h2M18.5 12h2M6 6l1.4 1.4M16.6 16.6 18 18M18 6l-1.4 1.4M7.4 16.6 6 18',
    ],
    partly: ['M17 3.2v1.6M20.9 7h1.6M19.7 4.3l-1.1 1.1', CLOUD],
    cloudy: [CLOUD],
    fog: ['M5 9h14M4 13h13M7 17h13'],
    drizzle: [CLOUD, 'M10 18.5v1.6M14 18.5v1.6'],
    rain: [CLOUD, 'M9.5 18.2 8.8 20.4M13 18.2l-.7 2.2M16.5 18.2l-.7 2.2'],
    snow: [CLOUD, 'M9.5 19h.01M12.5 21h.01M15.5 19h.01'],
    storm: [CLOUD, 'M12.7 15.5 10.8 19h2.8l-1.9 3.5'],
  }
  return (
    <svg viewBox="0 0 24 24" aria-hidden="true" className="forecast-icon">
      {kind === 'clear' && <circle cx="12" cy="12" r="3.6" fill="none" stroke="currentColor" strokeWidth="1.6" />}
      {kind === 'partly' && <circle cx="17" cy="7" r="2.4" fill="none" stroke="currentColor" strokeWidth="1.6" />}
      {parts[kind].map((d, i) => (
        <path
          key={i}
          d={d}
          fill="none"
          stroke="currentColor"
          strokeWidth="1.6"
          strokeLinecap="round"
          strokeLinejoin="round"
        />
      ))}
    </svg>
  )
}

function DayRow({ day }: { day: ForecastDay }) {
  const { t } = useI18n()
  const kind = weatherKind(day.code)
  const date = new Date(`${day.date}T12:00:00`).toLocaleDateString(getLocale(), {
    weekday: 'short',
    day: 'numeric',
  })
  const extras: string[] = []
  if (day.precip != null && day.precip >= 0.1) {
    extras.push(
      `${day.precip.toLocaleString(getLocale(), { maximumFractionDigits: 1 })} mm`,
    )
  }
  if (day.wind != null && day.wind >= 30) extras.push(`${Math.round(day.wind)} km/h`)
  return (
    <li className="forecast-day">
      <span className="forecast-date">{date}</span>
      <WeatherGlyph kind={kind} />
      <span className="forecast-label">{t(KIND_LABEL[kind])}</span>
      <span className="mono forecast-extra">{extras.join(' · ')}</span>
      <span className="mono forecast-temps">
        {day.tMin != null && day.tMax != null
          ? `${Math.round(day.tMin)}°/${Math.round(day.tMax)}°`
          : '—'}
      </span>
    </li>
  )
}

/** Pronòstic dels dies de la sortida; no pinta res mentre no toqui o si no arriba. */
export default function Forecast({ trip }: { trip: Trip }) {
  const { t } = useI18n()
  const days = useForecast(trip)
  if (!days || days.length === 0) return null
  return (
    <div className="forecast">
      <ul className="forecast-days">
        {days.map((day) => (
          <DayRow key={day.date} day={day} />
        ))}
      </ul>
      <p className="hint forecast-source">{t('weather.source')}</p>
    </div>
  )
}
