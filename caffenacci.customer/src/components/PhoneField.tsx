import { useEffect, useMemo, useRef, useState } from 'react'
import { ChevronDown, Search } from 'lucide-react'
import 'flag-icons/css/flag-icons.min.css'
import { countryOptions, dialCode, parseInternational } from '../utils/phone'

export interface PhoneFieldLabels { country: string; search: string; noResults: string }

interface Props {
  id: string
  label: string
  country: string
  national: string
  onChange: (country: string, national: string) => void
  locale: string
  labels: PhoneFieldLabels
  error?: string
  placeholder?: string
}

export default function PhoneField({
  id, label, country, national, onChange, locale, labels, error, placeholder,
}: Props) {
  const options = useMemo(() => countryOptions(locale), [locale])
  const [open, setOpen] = useState(false)
  const [query, setQuery] = useState('')
  const wrapRef = useRef<HTMLDivElement>(null)
  const searchRef = useRef<HTMLInputElement>(null)

  useEffect(() => {
    if (!open) return
    searchRef.current?.focus()
    const onDown = (e: MouseEvent) => { if (!wrapRef.current?.contains(e.target as Node)) setOpen(false) }
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') setOpen(false) }
    document.addEventListener('mousedown', onDown)
    document.addEventListener('keydown', onKey)
    return () => {
      document.removeEventListener('mousedown', onDown)
      document.removeEventListener('keydown', onKey)
    }
  }, [open])

  const q = query.trim().toLowerCase().replace(/^\+/, '')
  const filtered = q
    ? options.filter(o => o.name.toLowerCase().includes(q) || o.dial.startsWith(q) || o.code.toLowerCase().startsWith(q))
    : options

  const handleNumber = (raw: string) => {
    if (raw.trim().startsWith('+')) {
      const parsed = parseInternational(raw)
      if (parsed) { onChange(parsed.country, parsed.national); return }
    }
    onChange(country, raw.replace(/\D/g, '').slice(0, 15))   // wyłącznie cyfry
  }

  return (
    <div className="field">
      <label className="field__label" htmlFor={id}>{label}</label>
      <div className="ph" ref={wrapRef}>
        <button
          type="button"
          className="field__input ph__trigger"
          aria-haspopup="listbox"
          aria-expanded={open}
          aria-label={labels.country}
          onClick={() => setOpen(o => !o)}
        >
          <span className={`fi fi-${country.toLowerCase()}`} aria-hidden="true" />
          <span className="ph__dial" dir="ltr">+{dialCode(country)}</span>
          <ChevronDown size={14} aria-hidden="true" />
        </button>

        <input
          id={id}
          type="tel"
          inputMode="numeric"
          autoComplete="tel-national"
          dir="ltr"
          className={`field__input ph__input${error ? ' field__input--error' : ''}`}
          value={national}
          onChange={e => handleNumber(e.target.value)}
          placeholder={placeholder}
        />

        {open && (
          <div className="ph__panel">
            <div className="ph__search">
              <Search size={14} aria-hidden="true" />
              <input
                ref={searchRef}
                type="search"
                value={query}
                onChange={e => setQuery(e.target.value)}
                placeholder={labels.search}
                aria-label={labels.search}
              />
            </div>
            <ul className="ph__list" role="listbox" aria-label={labels.country}>
              {filtered.length === 0 && <li className="ph__empty">{labels.noResults}</li>}
              {filtered.map(o => (
                <li key={o.code} role="presentation">
                  <button
                    type="button"
                    role="option"
                    aria-selected={o.code === country}
                    className="ph__item"
                    onClick={() => { onChange(o.code, national); setOpen(false); setQuery('') }}
                  >
                    <span className={`fi fi-${o.code.toLowerCase()}`} aria-hidden="true" />
                    <span className="ph__name">{o.name}</span>
                    <span className="ph__code" dir="ltr">+{o.dial}</span>
                  </button>
                </li>
              ))}
            </ul>
          </div>
        )}
      </div>
      {error && <span className="field__error">{error}</span>}
    </div>
  )
}