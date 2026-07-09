// Temes de color. Cada tema redefineix les variables CSS de :root (vegeu
// styles.css) i té variant clara i fosca. La variant es resol aquí (i a
// l'script inicial d'index.html) i s'escriu a l'atribut data-scheme de <html>:
// per defecte segueix el sistema, però es pot forçar des dels Ajustos.
// Les paletes venen de l'app bitácora; «pedra» és l'original.
import { createContext, useContext, useEffect, useState, type ReactNode } from 'react'
import type { TKey } from './i18n'

export type ThemeId = 'pedra' | 'estandard' | 'mediterrania' | 'highperformance' | 'minimalista'
export type SchemeMode = 'system' | 'light' | 'dark'

/** El color de mostra del selector: l'accent de la variant clara del tema. */
export const THEMES: { id: ThemeId; labelKey: TKey; swatch: string }[] = [
  { id: 'pedra', labelKey: 'theme.pedra', swatch: '#e8541d' },
  { id: 'estandard', labelKey: 'theme.estandard', swatch: '#007aff' },
  { id: 'mediterrania', labelKey: 'theme.mediterrania', swatch: '#2f5d50' },
  { id: 'highperformance', labelKey: 'theme.highperformance', swatch: '#0e7c66' },
  { id: 'minimalista', labelKey: 'theme.minimalista', swatch: '#1f3d2b' },
]

export const SCHEME_MODES: { id: SchemeMode; labelKey: TKey }[] = [
  { id: 'system', labelKey: 'scheme.system' },
  { id: 'light', labelKey: 'scheme.light' },
  { id: 'dark', labelKey: 'scheme.dark' },
]

const THEME_KEY = 'fardell:theme'
const SCHEME_KEY = 'fardell:scheme'
const DEFAULT_THEME: ThemeId = 'pedra'

function isThemeId(value: unknown): value is ThemeId {
  return THEMES.some((t) => t.id === value)
}

function loadTheme(): ThemeId {
  const saved = localStorage.getItem(THEME_KEY)
  return isThemeId(saved) ? saved : DEFAULT_THEME
}

function loadMode(): SchemeMode {
  const saved = localStorage.getItem(SCHEME_KEY)
  return saved === 'light' || saved === 'dark' ? saved : 'system'
}

type ThemeContextValue = {
  theme: ThemeId
  setTheme: (theme: ThemeId) => void
  mode: SchemeMode
  setMode: (mode: SchemeMode) => void
}

const ThemeContext = createContext<ThemeContextValue | null>(null)

export function ThemeProvider({ children }: { children: ReactNode }) {
  const [theme, setTheme] = useState<ThemeId>(loadTheme)
  const [mode, setMode] = useState<SchemeMode>(loadMode)

  useEffect(() => {
    document.documentElement.dataset.theme = theme
    localStorage.setItem(THEME_KEY, theme)
  }, [theme])

  useEffect(() => {
    localStorage.setItem(SCHEME_KEY, mode)
    const media = window.matchMedia('(prefers-color-scheme: dark)')
    const apply = () => {
      document.documentElement.dataset.scheme =
        mode === 'system' ? (media.matches ? 'dark' : 'light') : mode
    }
    apply()
    // En mode «sistema», segueix els canvis del sistema en calent.
    if (mode === 'system') {
      media.addEventListener('change', apply)
      return () => media.removeEventListener('change', apply)
    }
  }, [mode])

  return (
    <ThemeContext.Provider value={{ theme, setTheme, mode, setMode }}>
      {children}
    </ThemeContext.Provider>
  )
}

export function useTheme(): ThemeContextValue {
  const ctx = useContext(ThemeContext)
  if (!ctx) throw new Error('useTheme s’ha de fer servir dins de ThemeProvider')
  return ctx
}
