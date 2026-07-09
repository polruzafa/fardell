import { useMemo, useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { catalogItems, findCategoryFor, prefillFromCatalog, type CatalogItem } from '../catalog'
import { useI18n } from '../i18n'
import { formatWeight, useStore } from '../store'

/** Color de les categories del catàleg que l'usuari no té (el mateix gris
 * neutre que categoryOf fa servir per a categories desconegudes). */
const FALLBACK_COLOR = '#6e6a5e'

export default function CatalogPage() {
  const { data } = useStore()
  const { t } = useI18n()
  const navigate = useNavigate()
  const [query, setQuery] = useState('')
  const [categoryFilter, setCategoryFilter] = useState<string | null>(null)

  // Nom i color de cada categoria del catàleg: si l'usuari en té una
  // d'equivalent (per id o per nom), es mostra la seva.
  const categories = useMemo(() => {
    const seen = new Map<string, { id: string; name: string; color: string }>()
    for (const entry of catalogItems) {
      if (seen.has(entry.categoryId)) continue
      const own = findCategoryFor(data.categories, entry)
      seen.set(entry.categoryId, {
        id: entry.categoryId,
        name: own?.name ?? entry.categoryName,
        color: own?.color ?? FALLBACK_COLOR,
      })
    }
    return [...seen.values()]
  }, [data.categories])

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase()
    return catalogItems.filter((entry) => {
      if (categoryFilter && entry.categoryId !== categoryFilter) return false
      if (!q) return true
      const haystack = `${entry.name} ${entry.brand ?? ''} ${(entry.tags ?? []).join(' ')} ${
        entry.notes ?? ''
      }`.toLowerCase()
      return haystack.includes(q)
    })
  }, [query, categoryFilter])

  const grouped = useMemo(() => {
    const groups = new Map<string, CatalogItem[]>()
    for (const entry of filtered) {
      const list = groups.get(entry.categoryId) ?? []
      list.push(entry)
      groups.set(entry.categoryId, list)
    }
    for (const list of groups.values()) list.sort((a, b) => a.name.localeCompare(b.name, 'ca'))
    const nameOf = (id: string) => categories.find((c) => c.id === id)?.name ?? id
    return [...groups.entries()].sort((a, b) => nameOf(a[0]).localeCompare(nameOf(b[0]), 'ca'))
  }, [filtered, categories])

  // En triar: al formulari d'element nou, preomplert i a punt de personalitzar.
  function pick(entry: CatalogItem) {
    navigate('/element/nou', { state: { prefill: prefillFromCatalog(entry) } })
  }

  return (
    <>
      <Link to="/" className="backlink">
        ← {t('tabs.gear')}
      </Link>
      <h1>{t('catalog.title')}</h1>

      {catalogItems.length === 0 ? (
        <div className="empty">
          <p>{t('catalog.empty')}</p>
        </div>
      ) : (
        <>
          <p className="hint">{t('catalog.hint')}</p>

          <input
            type="search"
            className="search"
            placeholder={t('catalog.searchPlaceholder')}
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            aria-label={t('catalog.searchLabel')}
          />

          {categories.length > 1 && (
            <div className="chips" role="group" aria-label={t('gear.filterByCategory')}>
              <button
                className={`chip${categoryFilter === null ? ' chip-on' : ''}`}
                aria-pressed={categoryFilter === null}
                onClick={() => setCategoryFilter(null)}
              >
                {t('gear.all')}
              </button>
              {categories.map((c) => (
                <button
                  key={c.id}
                  className={`chip${categoryFilter === c.id ? ' chip-on' : ''}`}
                  aria-pressed={categoryFilter === c.id}
                  onClick={() => setCategoryFilter(categoryFilter === c.id ? null : c.id)}
                >
                  <span className="dot" style={{ background: c.color }} />
                  {c.name}
                </button>
              ))}
            </div>
          )}

          {filtered.length === 0 ? (
            <div className="empty">
              <p>{t('catalog.emptyFiltered')}</p>
            </div>
          ) : (
            grouped.map(([categoryId, entries]) => {
              const category = categories.find((c) => c.id === categoryId)
              return (
                <section key={categoryId} className="group">
                  <h2 className="group-title">
                    <span className="dot" style={{ background: category?.color ?? FALLBACK_COLOR }} />
                    {category?.name ?? categoryId}
                  </h2>
                  <ul className="rows">
                    {entries.map((entry) => {
                      const owned = data.items.some((it) => it.catalogId === entry.id)
                      const tagsLine = [
                        entry.brand,
                        owned ? t('catalog.owned') : null,
                        ...(entry.tags ?? []),
                      ]
                        .filter(Boolean)
                        .join(' · ')
                      return (
                        <li key={entry.id}>
                          <button type="button" className="row" onClick={() => pick(entry)}>
                            <span
                              className="row-bar"
                              style={{ background: category?.color ?? FALLBACK_COLOR }}
                            />
                            <span className="row-main">
                              <span className="row-name">{entry.name}</span>
                              {tagsLine && <span className="row-tags">{tagsLine}</span>}
                            </span>
                            <span className="mono row-weight">
                              {formatWeight(entry.weightGrams ?? null)}
                            </span>
                          </button>
                        </li>
                      )
                    })}
                  </ul>
                </section>
              )
            })
          )}
        </>
      )}
    </>
  )
}
