// Pronòstic del temps per a les sortides, amb l'API gratuïta d'Open-Meteo
// (https://open-meteo.com): sense clau ni compte, només el lloc i les dates.
// Les respostes es guarden en memòria cau (localStorage) durant una hora per
// no tornar a demanar el mateix a cada obertura de l'app.
import { useEffect, useState } from 'react'
import { todayISO, tripEndDate, type Trip } from './store'

export type ForecastDay = {
  /** Dia, en format ISO (aaaa-mm-dd). */
  date: string
  /** Codi de temps WMO (el `weather_code` d'Open-Meteo). */
  code: number
  tMax: number | null
  tMin: number | null
  /** Precipitació acumulada del dia, en mm. */
  precip: number | null
  /** Vent màxim a 10 m, en km/h. */
  wind: number | null
}

/** Grups de codis WMO, per no traduir els 30 codis un per un. */
export type WeatherKind =
  | 'clear'
  | 'partly'
  | 'cloudy'
  | 'fog'
  | 'drizzle'
  | 'rain'
  | 'snow'
  | 'storm'

export function weatherKind(code: number): WeatherKind {
  if (code === 0) return 'clear'
  if (code <= 2) return 'partly'
  if (code === 3) return 'cloudy'
  if (code === 45 || code === 48) return 'fog'
  if (code >= 51 && code <= 57) return 'drizzle'
  if ((code >= 61 && code <= 67) || (code >= 80 && code <= 82)) return 'rain'
  if ((code >= 71 && code <= 77) || code === 85 || code === 86) return 'snow'
  if (code >= 95) return 'storm'
  return 'cloudy'
}

/** Amb quants dies d'antelació comença a sortir el pronòstic. */
export const FORECAST_LEAD_DAYS = 7
/** Fins on arriba el pronòstic d'Open-Meteo. */
const MAX_HORIZON_DAYS = 15
const CACHE_TTL_MS = 60 * 60 * 1000
const CACHE_PREFIX = 'fardell:weather:'

function addDays(iso: string, days: number): string {
  // Migdia: a resguard dels canvis d'hora d'estiu i hivern.
  const d = new Date(`${iso}T12:00:00`)
  d.setDate(d.getDate() + days)
  const mm = String(d.getMonth() + 1).padStart(2, '0')
  const dd = String(d.getDate()).padStart(2, '0')
  return `${d.getFullYear()}-${mm}-${dd}`
}

/**
 * Tram de la sortida que cau dins l'horitzó del pronòstic, o null si la
 * sortida ja ha passat o encara és lluny (comença d'aquí a més de
 * FORECAST_LEAD_DAYS dies).
 */
export function forecastRange(trip: Trip): { from: string; to: string } | null {
  const today = todayISO()
  const end = tripEndDate(trip)
  if (end < today) return null
  if (trip.startDate > addDays(today, FORECAST_LEAD_DAYS)) return null
  const from = trip.startDate > today ? trip.startDate : today
  const horizon = addDays(today, MAX_HORIZON_DAYS)
  const to = end < horizon ? end : horizon
  return from <= to ? { from, to } : null
}

type CacheEntry = { at: number; days: ForecastDay[] }

function readCache(key: string): ForecastDay[] | null {
  try {
    const raw = localStorage.getItem(key)
    if (!raw) return null
    const entry = JSON.parse(raw) as CacheEntry
    if (!Array.isArray(entry.days) || Date.now() - entry.at > CACHE_TTL_MS) return null
    return entry.days
  } catch {
    return null
  }
}

/** Desa el pronòstic i escombra les entrades velles, que ja no serviran. */
function writeCache(key: string, days: ForecastDay[]): void {
  try {
    for (let i = localStorage.length - 1; i >= 0; i--) {
      const k = localStorage.key(i)
      if (!k || !k.startsWith(CACHE_PREFIX) || k === key) continue
      const raw = localStorage.getItem(k)
      let stale = true
      if (raw) {
        try {
          stale = Date.now() - (JSON.parse(raw) as CacheEntry).at > CACHE_TTL_MS
        } catch {
          // entrada corrupta: fora
        }
      }
      if (stale) localStorage.removeItem(k)
    }
    localStorage.setItem(key, JSON.stringify({ at: Date.now(), days } satisfies CacheEntry))
  } catch {
    // sense memòria cau no passa res: es tornarà a demanar
  }
}

type ApiDaily = {
  time?: string[]
  weather_code?: (number | null)[]
  temperature_2m_max?: (number | null)[]
  temperature_2m_min?: (number | null)[]
  precipitation_sum?: (number | null)[]
  wind_speed_10m_max?: (number | null)[]
}

async function fetchForecast(
  lat: number,
  lon: number,
  from: string,
  to: string,
): Promise<ForecastDay[]> {
  const cacheKey = `${CACHE_PREFIX}${lat.toFixed(3)},${lon.toFixed(3)}:${from}:${to}`
  const cached = readCache(cacheKey)
  if (cached) return cached

  const url = new URL('https://api.open-meteo.com/v1/forecast')
  url.searchParams.set('latitude', String(lat))
  url.searchParams.set('longitude', String(lon))
  url.searchParams.set(
    'daily',
    'weather_code,temperature_2m_max,temperature_2m_min,precipitation_sum,wind_speed_10m_max',
  )
  url.searchParams.set('timezone', 'auto')
  url.searchParams.set('start_date', from)
  url.searchParams.set('end_date', to)

  const res = await fetch(url)
  if (!res.ok) throw new Error(`Open-Meteo: ${res.status}`)
  const body = (await res.json()) as { daily?: ApiDaily }
  const daily = body.daily
  if (!daily?.time) throw new Error('Open-Meteo: resposta sense dades diàries')

  const days = daily.time.map(
    (date, i): ForecastDay => ({
      date,
      code: daily.weather_code?.[i] ?? 3,
      tMax: daily.temperature_2m_max?.[i] ?? null,
      tMin: daily.temperature_2m_min?.[i] ?? null,
      precip: daily.precipitation_sum?.[i] ?? null,
      wind: daily.wind_speed_10m_max?.[i] ?? null,
    }),
  )
  writeCache(cacheKey, days)
  return days
}

/**
 * Pronòstic dels dies de la sortida, o null mentre no toca (sense
 * coordenades, sortida passada o massa llunyana) o si la xarxa falla:
 * el pronòstic mai no és imprescindible i els errors es callen.
 */
export function useForecast(trip: Trip): ForecastDay[] | null {
  const { lat, lon } = trip
  const range = forecastRange(trip)
  const from = range?.from ?? null
  const to = range?.to ?? null
  const [days, setDays] = useState<ForecastDay[] | null>(null)

  useEffect(() => {
    if (lat == null || lon == null || !from || !to) {
      setDays(null)
      return
    }
    let cancelled = false
    fetchForecast(lat, lon, from, to)
      .then((result) => {
        if (!cancelled) setDays(result)
      })
      .catch(() => {
        if (!cancelled) setDays(null)
      })
    return () => {
      cancelled = true
    }
  }, [lat, lon, from, to])

  return days
}
