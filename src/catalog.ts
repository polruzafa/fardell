// El catàleg de material: una llista curada d'elements per triar en lloc
// d'escriure la fitxa de zero. Es distribueix amb l'app (data/catalog.json)
// i ara mateix és BUIT: l'ompliran més endavant les eines d'extracció de les
// botigues de material europees. En triar-ne una entrada s'obre el formulari
// d'element preomplert; la fitxa desada és una còpia de l'usuari, amb
// catalogId com a rastre de procedència. brand, sourceUrl i price són només
// informatius al catàleg i no es copien mai a GearItem.
import catalog from './data/catalog.json'
import type { Category } from './store'

export type CatalogItem = {
  /** Estable i únic dins del catàleg (slug). */
  id: string
  name: string
  /** Id de la taxonomia inicial («cocina», «mochilas»…). Les motxilles han de
   * dur «mochilas» (BACKPACK_CATEGORY) perquè funcioni la càrrega màxima. */
  categoryId: string
  /** Nom per recrear la categoria si l'usuari l'ha suprimida. */
  categoryName: string
  brand?: string
  weightGrams?: number
  caseWeightGrams?: number
  maxLoadGrams?: number
  tags?: string[]
  specs?: { label: string; value: string }[]
  notes?: string
  /** D'on ve l'entrada (era de l'scraper). */
  sourceUrl?: string
  /** Preu orientatiu en euros; informatiu, mai no entra a la fitxa. */
  price?: number
}

export const catalogItems = (catalog as { version: number; items: CatalogItem[] }).items

/** El que passa del catàleg al formulari d'element (i d'allà, a la fitxa). */
export type ItemPrefill = Pick<
  CatalogItem,
  | 'name'
  | 'categoryId'
  | 'categoryName'
  | 'weightGrams'
  | 'caseWeightGrams'
  | 'maxLoadGrams'
  | 'tags'
  | 'specs'
  | 'notes'
> & { catalogId: string }

export function prefillFromCatalog(entry: CatalogItem): ItemPrefill {
  return {
    catalogId: entry.id,
    name: entry.name,
    categoryId: entry.categoryId,
    categoryName: entry.categoryName,
    weightGrams: entry.weightGrams,
    caseWeightGrams: entry.caseWeightGrams,
    maxLoadGrams: entry.maxLoadGrams,
    tags: entry.tags,
    specs: entry.specs,
    notes: entry.notes,
  }
}

/** La categoria de l'usuari que correspon a una entrada del catàleg, per id
 * o per nom (sense distingir majúscules), com fa la importació de JSON. */
export function findCategoryFor(
  categories: Category[],
  entry: { categoryId: string; categoryName: string },
): Category | undefined {
  const name = entry.categoryName.trim().toLowerCase()
  return categories.find((c) => c.id === entry.categoryId || c.name.trim().toLowerCase() === name)
}
