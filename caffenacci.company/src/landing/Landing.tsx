import { useEffect } from 'react'
import {
  ArrowRight, BarChart3, CalendarDays, Check, Coffee, Gift, Languages,
  Palette, ShoppingCart, Smartphone,
} from 'lucide-react'
import logoCircle from '../assets/logo/logo_circle.png'
import { COMPANY_URL, CUSTOMER_URL } from '../config'
import { useI18n } from '../i18n'
import { COPY, PRICES, PROMO_CODE, TRIAL_UNTIL, type FeatureIcon, type LandingCopy, type LandingLang } from './landingCopy'
import './landing.css'

const ICONS: Record<FeatureIcon, React.ComponentType<{ size?: number }>> = {
  palette: Palette, menu: Coffee, orders: ShoppingCart, reservations: CalendarDays,
  loyalty: Gift, stats: BarChart3, languages: Languages, app: Smartphone,
}

const pageUrl = (l: LandingLang) => `${COMPANY_URL}${l === 'en' ? '/en' : '/'}`

function setMeta(attr: 'name' | 'property', key: string, value: string) {
  let el = document.head.querySelector<HTMLMetaElement>(`meta[${attr}="${key}"]`)
  if (!el) { el = document.createElement('meta'); el.setAttribute(attr, key); document.head.appendChild(el) }
  el.setAttribute('content', value)
}

function setLink(rel: string, href: string, hreflang?: string) {
  const sel = `link[rel="${rel}"]${hreflang ? `[hreflang="${hreflang}"]` : ':not([hreflang])'}`
  let el = document.head.querySelector<HTMLLinkElement>(sel)
  if (!el) {
    el = document.createElement('link'); el.rel = rel
    if (hreflang) el.hreflang = hreflang
    document.head.appendChild(el)
  }
  el.href = href
}

/** Aktualizuje <head> pod aktualny język landingu (statyczny index.html ma wersję PL dla botów bez JS). */
function useSeo(lang: LandingLang, c: LandingCopy) {
  useEffect(() => {
    document.title = c.meta.title
    setMeta('name', 'description', c.meta.description)
    setMeta('name', 'robots', 'index,follow,max-image-preview:large')
    setMeta('property', 'og:title', c.meta.title)
    setMeta('property', 'og:description', c.meta.description)
    setMeta('property', 'og:url', pageUrl(lang))
    setMeta('property', 'og:locale', c.meta.ogLocale)
    setMeta('name', 'twitter:title', c.meta.title)
    setMeta('name', 'twitter:description', c.meta.description)
    setLink('canonical', pageUrl(lang))
    setLink('alternate', pageUrl('pl'), 'pl')
    setLink('alternate', pageUrl('en'), 'en')
    setLink('alternate', pageUrl('pl'), 'x-default')
    return () => {                       // wracamy do ustawień panelu
      document.title = 'Caffenacci Business'
      setMeta('name', 'robots', 'noindex, nofollow')
    }
  }, [lang, c])
}

const money = (v: number, cur: string, locale: string) =>
  new Intl.NumberFormat(locale, { style: 'currency', currency: cur, maximumFractionDigits: 0 }).format(v)

export default function Landing({ lang }: { lang: LandingLang }) {
  const { setLang } = useI18n()
  const c = COPY[lang]
  const locale = lang === 'pl' ? 'pl-PL' : 'en-GB'

  useEffect(() => { setLang(lang) }, [lang, setLang])   // rejestracja/logowanie w tym samym języku
  useSeo(lang, c)

  const trialOn = Date.now() <= TRIAL_UNTIL.getTime()
  const trialText = c.trial
    .replace('{date}', TRIAL_UNTIL.toLocaleDateString(locale, { day: 'numeric', month: 'long', year: 'numeric' }))
    .replace('{code}', PROMO_CODE)

  const order = lang === 'pl' ? (['PLN', 'EUR', 'USD'] as const) : (['EUR', 'USD', 'PLN'] as const)
  const mainPrice = money(PRICES[order[0]], order[0], locale)
  const otherPrices = order.slice(1).map(cur => money(PRICES[cur], cur, locale)).join(' / ')

  const jsonLd = {
    '@context': 'https://schema.org',
    '@graph': [
      { '@type': 'Organization', '@id': `${COMPANY_URL}/#org`, name: 'Caffenacci', url: pageUrl('pl'), logo: `${COMPANY_URL}/og-landing.png` },
      { '@type': 'WebSite', '@id': `${COMPANY_URL}/#site`, url: pageUrl(lang), name: 'Caffenacci', inLanguage: lang, publisher: { '@id': `${COMPANY_URL}/#org` } },
      {
        '@type': 'SoftwareApplication', name: 'Caffenacci', applicationCategory: 'BusinessApplication',
        operatingSystem: 'Web', description: c.meta.description, inLanguage: lang, url: pageUrl(lang),
        offers: (Object.keys(PRICES) as (keyof typeof PRICES)[]).map(cur => ({
          '@type': 'Offer', price: PRICES[cur], priceCurrency: cur, url: pageUrl(lang),
        })),
      },
      {
        '@type': 'FAQPage',
        mainEntity: c.faq.items.map(i => ({ '@type': 'Question', name: i.q, acceptedAnswer: { '@type': 'Answer', text: i.a } })),
      },
    ],
  }

  return (
    <div className="lp">
      <script type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd).replace(/</g, '\\u003c') }} />

      <header className="lp-header">
        <div className="lp-wrap lp-header__in">
          <a href={lang === 'en' ? '/en' : '/'} className="lp-brand" aria-label="Caffenacci">
            <img src={logoCircle} alt="" width={34} height={34} />
            <span translate="no">Caffenacci</span>
          </a>
          <nav className="lp-nav" aria-label="Menu">
            <a href="#features">{c.nav.features}</a>
            <a href="#pricing">{c.nav.pricing}</a>
            <a href="#faq">{c.nav.faq}</a>
            <a href={CUSTOMER_URL}>{c.nav.customer}</a>
          </nav>
          <div className="lp-header__actions">
            <a href={lang === 'pl' ? '/en' : '/'} hrefLang={lang === 'pl' ? 'en' : 'pl'}
               className="lp-lang" translate="no">{lang === 'pl' ? 'EN' : 'PL'}</a>
            <a href="#logowanie" className="lp-link">{c.nav.login}</a>
            <a href="#rejestracja" className="lp-btn lp-btn--primary lp-btn--sm">{c.nav.register}</a>
          </div>
        </div>
      </header>

      <main>
        <section className="lp-hero" aria-labelledby="lp-h1">
          <div className="lp-wrap lp-hero__in">
            <p className="lp-eyebrow">{c.hero.eyebrow}</p>
            <h1 id="lp-h1" className="lp-h1">{c.hero.h1}</h1>
            <p className="lp-lead">{c.hero.lead}</p>
            <div className="lp-cta-row">
              <a href="#rejestracja" className="lp-btn lp-btn--primary">{c.hero.cta} <ArrowRight size={18} /></a>
              <a href="#logowanie" className="lp-btn lp-btn--ghost">{c.hero.ctaSecondary}</a>
            </div>
            <ul className="lp-points">
              {c.hero.points.map(p => <li key={p}><Check size={16} /> {p}</li>)}
            </ul>
            {trialOn && <p className="lp-trial" role="note">{trialText}</p>}
          </div>
        </section>

        <section className="lp-section" aria-labelledby="lp-benefits">
          <div className="lp-wrap">
            <h2 id="lp-benefits" className="lp-h2">{c.benefits.title}</h2>
            <div className="lp-grid lp-grid--3">
              {c.benefits.items.map(i => (
                <article key={i.title} className="lp-card">
                  <h3>{i.title}</h3><p>{i.text}</p>
                </article>
              ))}
            </div>
          </div>
        </section>

        <section id="features" className="lp-section lp-section--alt" aria-labelledby="lp-features">
          <div className="lp-wrap">
            <h2 id="lp-features" className="lp-h2">{c.features.title}</h2>
            <p className="lp-sub">{c.features.intro}</p>
            <div className="lp-grid lp-grid--4">
              {c.features.items.map(f => {
                const Icon = ICONS[f.icon]
                return (
                  <article key={f.title} className="lp-card lp-card--feature">
                    <span className="lp-icon" aria-hidden="true"><Icon size={22} /></span>
                    <h3>{f.title}</h3><p>{f.text}</p>
                  </article>
                )
              })}
            </div>
            <p className="lp-bonus">{c.features.bonus} <a href={CUSTOMER_URL}>{c.features.bonusLink} →</a></p>
          </div>
        </section>

        <section className="lp-section" aria-labelledby="lp-seo">
          <div className="lp-wrap lp-narrow">
            <h2 id="lp-seo" className="lp-h2">{c.seo.title}</h2>
            <p className="lp-sub">{c.seo.intro}</p>
            <ul className="lp-checks">
              {c.seo.items.map(i => <li key={i}><Check size={18} /> {i}</li>)}
            </ul>
            <p className="lp-note">{c.seo.note}</p>
          </div>
        </section>

        <section className="lp-section lp-section--alt" aria-labelledby="lp-steps">
          <div className="lp-wrap">
            <h2 id="lp-steps" className="lp-h2">{c.steps.title}</h2>
            <ol className="lp-grid lp-grid--3 lp-steps">
              {c.steps.items.map((s, n) => (
                <li key={s.title} className="lp-card">
                  <span className="lp-step-n" aria-hidden="true">{n + 1}</span>
                  <h3>{s.title}</h3><p>{s.text}</p>
                </li>
              ))}
            </ol>
          </div>
        </section>

        <section id="pricing" className="lp-section" aria-labelledby="lp-pricing">
          <div className="lp-wrap lp-narrow">
            <h2 id="lp-pricing" className="lp-h2">{c.pricing.title}</h2>
            <p className="lp-sub">{c.pricing.intro}</p>
            <div className="lp-price">
              <div className="lp-price__amount">
                <strong>{mainPrice}</strong> <span>{c.pricing.perMonth}</span>
              </div>
              <p className="lp-price__alt">{c.pricing.others} {otherPrices}</p>
              {trialOn && <p className="lp-trial lp-trial--card">{trialText}</p>}
              <ul className="lp-checks">
                {c.pricing.includes.map(i => <li key={i}><Check size={18} /> {i}</li>)}
              </ul>
              <a href="#rejestracja" className="lp-btn lp-btn--primary lp-btn--block">{c.pricing.cta}</a>
              {c.pricing.notes.map(n => <p key={n} className="lp-fine">{n}</p>)}
            </div>
          </div>
        </section>

        <section id="faq" className="lp-section lp-section--alt" aria-labelledby="lp-faq">
          <div className="lp-wrap lp-narrow">
            <h2 id="lp-faq" className="lp-h2">{c.faq.title}</h2>
            {c.faq.items.map(i => (
              <details key={i.q} className="lp-faq">
                <summary>{i.q}</summary>
                <p>{i.a}</p>
              </details>
            ))}
          </div>
        </section>

        <section className="lp-final" aria-labelledby="lp-final">
          <div className="lp-wrap lp-narrow">
            <h2 id="lp-final" className="lp-h2">{c.final.title}</h2>
            <p className="lp-lead">{c.final.text}</p>
            <a href="#rejestracja" className="lp-btn lp-btn--primary">{c.final.cta} <ArrowRight size={18} /></a>
          </div>
        </section>
      </main>

      <footer className="lp-footer">
        <div className="lp-wrap lp-footer__in">
          <span><strong translate="no">Caffenacci</strong> · {c.footer.tagline}</span>
          <span className="lp-footer__links">
            <a href={CUSTOMER_URL}>{c.footer.customer}</a>
            <a href="#logowanie">{c.nav.login}</a>
            <a href={lang === 'pl' ? '/en' : '/'} hrefLang={lang === 'pl' ? 'en' : 'pl'}>{lang === 'pl' ? 'English' : 'Polski'}</a>
          </span>
        </div>
      </footer>
    </div>
  )
}