import { useI18n } from '../i18n/I18nProvider'
import { cityPath } from '../utils/sitePaths'

/** Linki do stron miast. Dane wstrzykuje backend (window.__HOME__), więc po wyrenderowaniu
 *  SPA crawler nadal widzi te linki w DOM (SSR-owa treść jest zastępowana przez createRoot). */
export default function CityLinks() {
  const { t, language } = useI18n()
  const cities = window.__HOME__?.cities
  if (!cities?.length) return null
  return (
    <nav className="city-links" aria-label={t('home.cities')}>
      <h2 className="city-links__title">{t('home.cities')}</h2>
      <ul className="city-links__list">
        {cities.map(c => (
          <li key={c.slug}>
            <a className="link" href={cityPath(language.code, c.slug)}>{c.name}</a>
            <span className="city-links__count">{c.count}</span>
          </li>
        ))}
      </ul>
    </nav>
  )
}