// Lekki, spójny zestaw ikon liniowych (stroke, currentColor) używany na
// publicznej stronie kawiarni zamiast emotek — dzięki `currentColor` każda
// ikona automatycznie dopasowuje się do koloru tekstu i motywu.

interface IconProps {
  size?: number
  className?: string
}

export function CoffeeIcon({ size = 22, className }: IconProps) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" className={className} aria-hidden="true">
      <path d="M4 9h13a1 1 0 0 1 1 1v5a5 5 0 0 1-5 5H9a5 5 0 0 1-5-5V9Z" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" />
      <path d="M18 10.5h1.3a2.3 2.3 0 1 1 0 4.6H18" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" />
      <path d="M7.5 4.25c-.55.65-.55 1.25 0 1.9s.55 1.25 0 1.9M11.5 4.25c-.55.65-.55 1.25 0 1.9s.55 1.25 0 1.9" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" />
    </svg>
  )
}

export function NewspaperIcon({ size = 22, className }: IconProps) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" className={className} aria-hidden="true">
      <path d="M4 5h12a2 2 0 0 1 2 2v11a1.5 1.5 0 0 0 1.5 1.5H6a2 2 0 0 1-2-2V5Z" stroke="currentColor" strokeWidth="1.6" strokeLinejoin="round" />
      <path d="M18 7v11.5a1.5 1.5 0 0 0 1.5 1.5" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" />
      <path d="M7 8.5h6M7 11.5h6M7 14.5h3.5" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
    </svg>
  )
}

export function CalendarIcon({ size = 20, className }: IconProps) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" className={className} aria-hidden="true">
      <rect x="3.5" y="5" width="17" height="15" rx="2.5" stroke="currentColor" strokeWidth="1.6" />
      <path d="M3.5 9.5h17M8 3v3.5M16 3v3.5" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" />
      <circle cx="8.25" cy="13.25" r="1" fill="currentColor" />
      <circle cx="12" cy="13.25" r="1" fill="currentColor" />
      <circle cx="15.75" cy="13.25" r="1" fill="currentColor" />
    </svg>
  )
}

export function CreditCardIcon({ size = 18, className }: IconProps) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" className={className} aria-hidden="true">
      <rect x="2.5" y="5.5" width="19" height="13" rx="2.25" stroke="currentColor" strokeWidth="1.6" />
      <path d="M2.5 9.75h19" stroke="currentColor" strokeWidth="1.6" />
      <path d="M5.5 14.25h4" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" />
    </svg>
  )
}

export function GiftIcon({ size = 18, className }: IconProps) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" className={className} aria-hidden="true">
      <rect x="3.5" y="9.5" width="17" height="10.5" rx="1.5" stroke="currentColor" strokeWidth="1.6" />
      <path d="M2.5 6.5h19v3h-19z" stroke="currentColor" strokeWidth="1.6" strokeLinejoin="round" />
      <path d="M12 6.5V20M12 6.5C10.5 3 6 3 6 6.5c0 1.4 1.2 1.9 3 1.9M12 6.5C13.5 3 18 3 18 6.5c0 1.4-1.2 1.9-3 1.9" stroke="currentColor" strokeWidth="1.5" strokeLinejoin="round" />
    </svg>
  )
}

export function StampIcon({ size = 18, className }: IconProps) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" className={className} aria-hidden="true">
      <path d="M8 3.5h8l1.5 5-3 2 3 2-1.5 5H8l-1.5-5 3-2-3-2Z" stroke="currentColor" strokeWidth="1.5" strokeLinejoin="round" />
      <path d="M4.5 20.5h15" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" />
    </svg>
  )
}

export function CoinIcon({ size = 18, className }: IconProps) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" className={className} aria-hidden="true">
      <circle cx="12" cy="12" r="8.5" stroke="currentColor" strokeWidth="1.6" />
      <path d="M12 7.5v9M9.5 9.75c0-1.24 1.12-2.25 2.5-2.25s2.5.9 2.5 2c0 2.25-5 1.5-5 3.75 0 1.1 1.12 2 2.5 2s2.5-1.01 2.5-2.25" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" />
    </svg>
  )
}

export function PhoneIcon({ size = 16, className }: IconProps) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" className={className} aria-hidden="true">
      <path d="M5.5 4.5h3l1.5 4-2 1.5a11 11 0 0 0 5.5 5.5l1.5-2 4 1.5v3a1.5 1.5 0 0 1-1.6 1.5A16 16 0 0 1 4 6.1a1.5 1.5 0 0 1 1.5-1.6Z" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  )
}

export function MailIcon({ size = 16, className }: IconProps) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" className={className} aria-hidden="true">
      <rect x="3" y="5.5" width="18" height="13" rx="2" stroke="currentColor" strokeWidth="1.6" />
      <path d="m4 7 8 6 8-6" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  )
}

export function LinkIcon({ size = 16, className }: IconProps) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" className={className} aria-hidden="true">
      <path d="M9.5 14.5 14.5 9.5" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" />
      <path d="M11 7.5l1.4-1.4a3.5 3.5 0 0 1 5 5L16 12.5M13 16.5l-1.4 1.4a3.5 3.5 0 0 1-5-5L8 11.5" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  )
}