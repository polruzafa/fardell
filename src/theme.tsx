// Temes de color. Cada tema redefineix les variables CSS de :root (vegeu
// styles.css) i té variant clara i fosca. La variant es resol aquí (i a
// l'script inicial d'index.html) i s'escriu a l'atribut data-scheme de <html>:
// per defecte segueix el sistema, però es pot forçar des dels Ajustos.
// Les paletes venen de l'app bitácora; «pedra» és l'original.
import { createContext, useContext, useEffect, useState, type ReactNode } from 'react'
import type { TKey } from './i18n'

export type ThemeId = 'pedra' | 'estandard' | 'mediterrania' | 'highperformance' | 'minimalista'
export type SchemeMode = 'system' | 'light' | 'dark'

/** Mostres del selector: quatre colors representatius de cada variant
 * (l'accent, dos de secundaris i el paper), trets de styles.css. */
export const THEMES: {
  id: ThemeId
  labelKey: TKey
  swatches: { light: string[]; dark: string[] }
}[] = [
  {
    id: 'pedra',
    labelKey: 'theme.pedra',
    swatches: {
      light: ['#e8541d', '#5e7d4f', '#8a6a1f', '#eef0ea'],
      dark: ['#f2622a', '#86a874', '#d8b25e', '#171c16'],
    },
  },
  {
    id: 'estandard',
    labelKey: 'theme.estandard',
    swatches: {
      light: ['#006be0', '#248a3d', '#a05a00', '#ffffff'],
      dark: ['#0a84ff', '#30d158', '#ff9f0a', '#000000'],
    },
  },
  {
    id: 'mediterrania',
    labelKey: 'theme.mediterrania',
    swatches: {
      light: ['#2f5d50', '#4d7a52', '#b05e14', '#f4f1ea'],
      dark: ['#7bae7f', '#e89b5a', '#e06060', '#1f1d17'],
    },
  },
  {
    id: 'highperformance',
    labelKey: 'theme.highperformance',
    swatches: {
      light: ['#0e7c66', '#1e8a4c', '#8f7412', '#f8f8f8'],
      dark: ['#1fa38c', '#2fb36f', '#f4c430', '#0f1614'],
    },
  },
  {
    id: 'minimalista',
    labelKey: 'theme.minimalista',
    swatches: {
      light: ['#1f3d2b', '#2e7d52', '#a37b1e', '#ffffff'],
      dark: ['#8fb297', '#e8c57f', '#e06969', '#1a2820'],
    },
  },
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

/* La barra del sistema (PWA instal·lada) segueix el color del paper del tema
 * actiu. Es llegeix la variable CSS ja resolta, així no es dupliquen valors. */
function updateThemeColorMeta() {
  const meta = document.querySelector('meta[name="theme-color"]')
  const paper = getComputedStyle(document.documentElement).getPropertyValue('--paper').trim()
  if (meta && paper) meta.setAttribute('content', paper)
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
    updateThemeColorMeta()
  }, [theme])

  useEffect(() => {
    localStorage.setItem(SCHEME_KEY, mode)
    const media = window.matchMedia('(prefers-color-scheme: dark)')
    const apply = () => {
      document.documentElement.dataset.scheme =
        mode === 'system' ? (media.matches ? 'dark' : 'light') : mode
      updateThemeColorMeta()
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
