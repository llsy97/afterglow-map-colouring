import countries from 'i18n-iso-countries'
import koLocale from 'i18n-iso-countries/langs/ko.json'
import enLocale from 'i18n-iso-countries/langs/en.json'

countries.registerLocale(koLocale)
countries.registerLocale(enLocale)

/** ISO3 of the device's region setting (e.g. 'ko-KR' -> 'KOR'), if it can be read. */
export function deviceCountry(): string | undefined {
  const tags = typeof navigator !== 'undefined' ? (navigator.languages?.length ? navigator.languages : [navigator.language]) : []
  for (const tag of tags) {
    const region = tag.split('-')[1]?.toUpperCase()
    const iso3 = region && countries.alpha2ToAlpha3(region)
    if (iso3) return iso3
  }
  return undefined
}

export default countries
