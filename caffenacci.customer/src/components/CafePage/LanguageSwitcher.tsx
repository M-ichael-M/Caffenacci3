import type { ReactNode } from 'react'
import { useI18n } from '../../i18n/I18nProvider'

// Flagi są rysowane jako SVG, więc nie zależą od obsługi emoji w systemie.
const flagArtwork: Record<string, ReactNode> = {
    pl: <><path fill="#fff" d="M0 0h24v6H0z"/><path fill="#dc143c" d="M0 6h24v6H0z"/></>,
    en: <><path fill="#012169" d="M0 0h24v12H0z"/><path stroke="#fff" strokeWidth="3" d="m0 0 24 12M24 0 0 12"/><path stroke="#c8102e" strokeWidth="1.2" d="m0 0 24 12M24 0 0 12"/><path stroke="#fff" strokeWidth="4" d="M12 0v12M0 6h24"/><path stroke="#c8102e" strokeWidth="2" d="M12 0v12M0 6h24"/></>,
    de: <><path fill="#000" d="M0 0h24v4H0z"/><path fill="#dd0000" d="M0 4h24v4H0z"/><path fill="#ffce00" d="M0 8h24v4H0z"/></>,
    fr: <><path fill="#0055a4" d="M0 0h8v12H0z"/><path fill="#fff" d="M8 0h8v12H8z"/><path fill="#ef4135" d="M16 0h8v12h-8z"/></>,
    es: <><path fill="#aa151b" d="M0 0h24v3H0zM0 9h24v3H0z"/><path fill="#f1bf00" d="M0 3h24v6H0z"/></>,
    it: <><path fill="#009246" d="M0 0h8v12H0z"/><path fill="#fff" d="M8 0h8v12H8z"/><path fill="#ce2b37" d="M16 0h8v12h-8z"/></>,
    uk: <><path fill="#012169" d="M0 0h24v12H0z"/><path stroke="#fff" strokeWidth="3" d="m0 0 24 12M24 0 0 12"/><path stroke="#c8102e" strokeWidth="1.2" d="m0 0 24 12M24 0 0 12"/><path stroke="#fff" strokeWidth="4" d="M12 0v12M0 6h24"/><path stroke="#c8102e" strokeWidth="2" d="M12 0v12M0 6h24"/></>,
  // Dodatkowe proste flagi używane dla wariantów i języków wielonarodowych.
  us: <><path fill="#fff" d="M0 0h24v12H0z"/><path fill="#b22234" d="M0 0h24v1H0zM0 2h24v1H0zM0 4h24v1H0zM0 6h24v1H0zM0 8h24v1H0zM0 10h24v1H0z"/><path fill="#3c3b6e" d="M0 0h11v6H0z"/></>,
  ca: <><path fill="#d80621" d="M0 0h6v12H0zM18 0h6v12h-6z"/><path fill="#fff" d="M6 0h12v12H6z"/><path fill="#d80621" d="M11 3h2v6h-2z"/></>,
  au: <><path fill="#012169" d="M0 0h24v12H0z"/><path stroke="#fff" strokeWidth="2" d="m0 0 12 6M12 0 0 6"/><path stroke="#c8102e" strokeWidth=".8" d="m0 0 12 6M12 0 0 6"/><path stroke="#fff" strokeWidth="2.5" d="M6 0v6M0 3h12"/><path stroke="#c8102e" strokeWidth="1.2" d="M6 0v6M0 3h12"/><circle cx="18" cy="6" r="1" fill="#fff"/></>,
  ie: <><path fill="#169b62" d="M0 0h8v12H0z"/><path fill="#fff" d="M8 0h8v12H8z"/><path fill="#ff883e" d="M16 0h8v12h-8z"/></>,
  nz: <><path fill="#00247d" d="M0 0h24v12H0z"/><path stroke="#fff" strokeWidth="2" d="m0 0 11 5.5M11 0 0 5.5"/><path stroke="#c8102e" strokeWidth=".8" d="m0 0 11 5.5M11 0 0 5.5"/><path stroke="#fff" strokeWidth="2.5" d="M5.5 0v5.5M0 2.75h11"/><path stroke="#c8102e" strokeWidth="1.2" d="M5.5 0v5.5M0 2.75h11"/><path fill="#cc142b" d="m18 1 1 2h2l-1.5 1.5.5 2-2-1-2 1 .5-2L15 3h2zM15 8l.6 1.2h1.2l-.9.8.3 1.2-1.2-.6-1.2.6.3-1.2-.9-.8h1.2z"/></>,
  mx: <><path fill="#006847" d="M0 0h8v12H0z"/><path fill="#fff" d="M8 0h8v12H8z"/><path fill="#ce1126" d="M16 0h8v12h-8z"/><circle cx="12" cy="6" r="1" fill="#795548"/></>,
  br: <><path fill="#009739" d="M0 0h24v12H0z"/><path fill="#ffdf00" d="m12 1 10 5-10 5L2 6z"/><circle cx="12" cy="6" r="3" fill="#002776"/></>,
  ar: <><path fill="#75aadb" d="M0 0h24v4H0zM0 8h24v4H0z"/><path fill="#fff" d="M0 4h24v4H0z"/><path fill="#fff" d="m12 4 .6 1.3 1.4.2-1 .9.3 1.4-1.3-.7-1.3.7.3-1.4-1-.9 1.4-.2z"/></>,
  eg: <><path fill="#ce1126" d="M0 0h24v4H0z"/><path fill="#fff" d="M0 4h24v4H0z"/><path fill="#000" d="M0 8h24v4H0z"/><circle cx="12" cy="6" r=".7" fill="#c09300"/></>,
  cn: <><path fill="#de2910" d="M0 0h24v12H0z"/><path fill="#ffde00" d="m4 1 .5 1.3 1.4.1-1.1.9.4 1.4L4 4l-1.2.7.4-1.4-1.1-.9 1.4-.1z"/></>,
  in: <><path fill="#ff9933" d="M0 0h24v4H0z"/><path fill="#fff" d="M0 4h24v4H0z"/><path fill="#138808" d="M0 8h24v4H0z"/><circle cx="12" cy="6" r="1.5" fill="none" stroke="#000080" strokeWidth=".4"/></>,
  za: <><path fill="#de3831" d="M0 0h24v5H0z"/><path fill="#002395" d="M0 7h24v5H0z"/><path fill="#007a4d" d="m0 0 12 6L0 12z"/><path stroke="#ffb81c" strokeWidth="3" d="M0 1.5 9 6 0 10.5"/><path stroke="#fff" strokeWidth="1.5" d="M0 3 6 6 0 9"/></>,
  be: <><path fill="#000" d="M0 0h8v12H0z"/><path fill="#fae042" d="M8 0h8v12H8z"/><path fill="#ed2939" d="M16 0h8v12h-8z"/></>,
  ch: <><path fill="#d52b1e" d="M0 0h24v12H0z"/><path fill="#fff" d="M10 2h4v8h-4zM8 4h8v4H8z"/></>,
  at: <><path fill="#ed2939" d="M0 0h24v4H0zM0 8h24v4H0z"/><path fill="#fff" d="M0 4h24v4H0z"/></>,
  pt: <><path fill="#046a38" d="M0 0h10v12H0z"/><path fill="#da291c" d="M10 0h14v12H10z"/><circle cx="10" cy="6" r="2" fill="#ffcd00"/></>,
  nl: <><path fill="#ae1c28" d="M0 0h24v4H0z"/><path fill="#fff" d="M0 4h24v4H0z"/><path fill="#21468b" d="M0 8h24v4H0z"/></>,
  ru: <><path fill="#fff" d="M0 0h24v4H0z"/><path fill="#0039a6" d="M0 4h24v4H0z"/><path fill="#d52b1e" d="M0 8h24v4H0z"/></>,
  jp: <><path fill="#fff" d="M0 0h24v12H0z"/><circle cx="12" cy="6" r="3" fill="#bc002d"/></>,
  kr: <><path fill="#fff" d="M0 0h24v12H0z"/><path fill="#cd2e3a" d="M12 3a3 3 0 0 0 0 6 1.5 1.5 0 0 0 0-3 1.5 1.5 0 0 1 0-3"/><path fill="#0047a0" d="M12 9a3 3 0 0 0 0-6 1.5 1.5 0 0 0 0 3 1.5 1.5 0 0 1 0 3"/></>,
  gb: <><path fill="#012169" d="M0 0h24v12H0z"/><path stroke="#fff" strokeWidth="3" d="m0 0 24 12M24 0 0 12"/><path stroke="#c8102e" strokeWidth="1.2" d="m0 0 24 12M24 0 0 12"/><path stroke="#fff" strokeWidth="4" d="M12 0v12M0 6h24"/><path stroke="#c8102e" strokeWidth="2" d="M12 0v12M0 6h24"/></>,
  sa: <><path fill="#006c35" d="M0 0h24v12H0z"/><path fill="#fff" d="M4 5h16v1H4zM8 7h9v.6H8z"/></>,
  ma: <><path fill="#c1272d" d="M0 0h24v12H0z"/><path d="m12 3 1 2.3h2.5l-2 1.5.8 2.4-2.3-1.5-2.3 1.5.8-2.4-2-1.5H11z" fill="none" stroke="#006233" strokeWidth=".6"/></>,
  tw: <><path fill="#fe0000" d="M0 0h24v12H0z"/><path fill="#000095" d="M0 0h11v6H0z"/><circle cx="5.5" cy="3" r="1.5" fill="#fff"/></>,
  sg: <><path fill="#ed2939" d="M0 0h24v6H0z"/><path fill="#fff" d="M0 6h24v6H0z"/><circle cx="5" cy="3" r="1.5" fill="#fff"/><circle cx="5.5" cy="3" r="1.2" fill="#ed2939"/></>,
  by: <><path fill="#c8313e" d="M0 0h24v8H0z"/><path fill="#4aa657" d="M0 8h24v4H0z"/><path fill="#fff" d="M0 0h3v12H0z"/><path fill="#c8313e" d="m.5 1 .7.6-.7.6-.7-.6zM2 3l.7.6-.7.6-.7-.6zM.5 5l.7.6-.7.6-.7-.6zM2 7l.7.6-.7.6-.7-.6zM.5 9l.7.6-.7.6-.7-.6z"/></>,
  co: <><path fill="#fcd116" d="M0 0h24v6H0z"/><path fill="#003893" d="M0 6h24v3H0z"/><path fill="#ce1126" d="M0 9h24v3H0z"/></>,
  ua: <><path fill="#0057b7" d="M0 0h24v6H0z"/><path fill="#ffd700" d="M0 6h24v6H0z"/></>,
}

// Jedna reprezentatywna flaga na język; kody bez własnej grafiki dostają globus.
const languageCountry: Record<string, string> = {
  af: 'za', ar: 'eg', be: 'by', ca: 'es', cy: 'gb', de: 'de', en: 'gb',
  es: 'es', eu: 'es', fr: 'fr', fy: 'nl', ga: 'ie', gd: 'gb', gl: 'es',
  it: 'it', ja: 'jp', ko: 'kr', mi: 'nz', nl: 'nl', pl: 'pl', pt: 'pt',
  ru: 'ru', uk: 'ua', xh: 'za', zh: 'cn', zu: 'za',
}

function LanguageFlag({ code }: { code: string }) {
  const normalized = code.toLowerCase().replace('_', '-')
  const [language, region] = normalized.split('-')
  const country = region && flagArtwork[region] ? region : (languageCountry[language] ?? language)
  const art = flagArtwork[country]
  return <svg className="cp-lang__flag" viewBox="0 0 24 12" aria-hidden="true" focusable="false">
    {art ?? <><circle cx="12" cy="6" r="4.5" fill="none" stroke="currentColor" strokeWidth="1.3"/><path d="M7.5 6h9M12 1.5c2.2 2.6 2.2 6.4 0 9M12 1.5c-2.2 2.6-2.2 6.4 0 9" fill="none" stroke="currentColor" strokeWidth=".8"/></>}
  </svg>
}

export default function LanguageSwitcher() {
  const { switcher, t } = useI18n()
  if (!switcher) return null            // brak aktualnego tłumaczenia → brak przełącznika
  const { primary, secondary, active, busy, select } = switcher
  return (
    <div className="cp-lang" role="group" aria-label={t('lang.label')} data-busy={busy}>
      {([['primary', primary], ['secondary', secondary]] as const).map(([which, l]) => (
        <button key={which} type="button" lang={l.locale} dir={l.dir}
                aria-pressed={active === which} onClick={() => select(which)}>
          <LanguageFlag code={l.code} /> {l.native_name}
        </button>
      ))}
    </div>
  )
}
