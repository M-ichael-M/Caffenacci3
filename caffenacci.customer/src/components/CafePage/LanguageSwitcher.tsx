import { useI18n } from '../../i18n/I18nProvider'

export default function LanguageSwitcher() {
  const { switcher, t } = useI18n()
  if (!switcher) return null            // brak aktualnego tłumaczenia → brak przełącznika
  const { primary, secondary, active, busy, select } = switcher
  return (
    <div className="cp-lang" role="group" aria-label={t('lang.label')} data-busy={busy}>
      {([['primary', primary], ['secondary', secondary]] as const).map(([which, l]) => (
        <button key={which} type="button" lang={l.locale} dir={l.dir}
                aria-pressed={active === which} onClick={() => select(which)}>
          {l.native_name}
        </button>
      ))}
    </div>
  )
}