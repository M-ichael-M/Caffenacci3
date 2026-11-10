import { useState, useRef, useEffect } from 'react'
import { Info } from 'lucide-react'
import { useI18n } from '../i18n'

interface Props {
  text: string
}

export default function InfoTooltip({ text }: Props) {
  const { t } = useI18n()
  const [open, setOpen] = useState(false)
  const wrapperRef = useRef<HTMLSpanElement>(null)

  useEffect(() => {
    if (!open) return
    function handleOutside(e: MouseEvent) {
      if (wrapperRef.current && !wrapperRef.current.contains(e.target as Node)) setOpen(false)
    }
    function handleEscape(e: KeyboardEvent) {
      if (e.key === 'Escape') setOpen(false)
    }
    document.addEventListener('mousedown', handleOutside)
    document.addEventListener('keydown', handleEscape)
    return () => {
      document.removeEventListener('mousedown', handleOutside)
      document.removeEventListener('keydown', handleEscape)
    }
  }, [open])

  return (
    <span
      ref={wrapperRef}
      className="info-tooltip"
      onMouseEnter={() => setOpen(true)}
      onMouseLeave={() => setOpen(false)}
    >
      <button
        type="button"
        className="info-tooltip__trigger"
        onClick={e => { e.stopPropagation(); setOpen(v => !v) }}
        aria-label={t('common.moreInfo')}
        aria-expanded={open}
      >
        <Info size={13} />
      </button>
      {open && (
        <span className="info-tooltip__bubble" role="tooltip">
          {text}
        </span>
      )}
    </span>
  )
}
