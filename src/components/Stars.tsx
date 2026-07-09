import { useI18n } from '../i18n'

const MAX = 5

/** Puntuació d'una ressenya, només de lectura. */
export function StarRating({
  value,
  label,
  small,
}: {
  value: number
  /** Text per als lectors de pantalla; per defecte, la puntuació general. */
  label?: string
  small?: boolean
}) {
  const { t } = useI18n()
  return (
    <span
      className={small ? 'stars stars-sm' : 'stars'}
      role="img"
      aria-label={label ?? t('review.stars', { n: value })}
    >
      {Array.from({ length: MAX }, (_, i) => (
        <span key={i} className={i < value ? 'star star-on' : 'star'} aria-hidden="true">
          ★
        </span>
      ))}
    </span>
  )
}

/** Selector de puntuació d'1 a 5 estrelles per al formulari. */
export function StarPicker({
  value,
  onChange,
  label,
  clearable,
}: {
  value: number
  onChange: (n: number) => void
  /** Nom del grup per als lectors de pantalla; per defecte, «Puntuació». */
  label?: string
  /** Si és cert, tornar a clicar l'estrella activa esborra la puntuació. */
  clearable?: boolean
}) {
  const { t } = useI18n()
  return (
    <div className="stars stars-pick" role="radiogroup" aria-label={label ?? t('review.rating')}>
      {Array.from({ length: MAX }, (_, i) => {
        const n = i + 1
        return (
          <button
            key={n}
            type="button"
            role="radio"
            aria-checked={n === value}
            aria-label={t('review.setRating', { n })}
            className={n <= value ? 'star-btn star-on' : 'star-btn'}
            onClick={() => onChange(clearable && n === value ? 0 : n)}
          >
            ★
          </button>
        )
      })}
    </div>
  )
}
