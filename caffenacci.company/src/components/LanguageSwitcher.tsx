import { LANGS, useI18n } from '../i18n'

export default function LanguageSwitcher({ variant = 'light' }: { variant?: 'light' | 'dark' }) {
  const { lang, setLang, t } = useI18n()
  return (
    <div className={`lang-switch lang-switch--${variant}`} role="group" aria-label={t('lang.label')} translate="no">
      {LANGS.map(l => (
        <button
          key={l}
          type="button"
          lang={l}
          className={`lang-switch__btn${lang === l ? ' lang-switch__btn--active' : ''}`}
          aria-pressed={lang === l}
          onClick={() => setLang(l)}
        >
          {l.toUpperCase()}
        </button>
      ))}
    </div>
  )
}