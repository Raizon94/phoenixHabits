import { es, type Dictionary } from './es'

const dictionaries: Record<string, Dictionary> = { es }

let current: Dictionary = es

export function setLocale(locale: string) {
  current = dictionaries[locale] ?? es
}

/** Acceso tipado a los textos: t().nav.dashboard */
export function t(): Dictionary {
  return current
}

export const availableLocales = Object.keys(dictionaries)
