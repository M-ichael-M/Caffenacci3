import { X } from 'lucide-react'
import LoginForm from '../LoginForm'
import RegisterForm from '../RegisterForm'

interface Props {
  mode: 'login' | 'register'
  onClose: () => void
  onSwitch: (m: 'login' | 'register') => void
  onLoginSuccess: (d: { access_token: string; user_id: string; nick: string; full_name: string }) => void
}

export default function AuthModal({ mode, onClose, onSwitch, onLoginSuccess }: Props) {
  return (
    <div className="menu-editor-overlay" onClick={e => { if (e.target === e.currentTarget) onClose() }}>
      <div className="menu-editor" style={{ maxWidth: 460, height: 'auto', maxHeight: '90vh' }}>
        <div className="me-header">
          <div>
            <div className="me-eyebrow">Konto gościa</div>
            <h2 className="me-title">{mode === 'login' ? 'Zaloguj się' : 'Załóż konto'}</h2>
          </div>
          <button className="me-close" type="button" onClick={onClose}><X size={16} /></button>
        </div>
        <div className="me-body">
          <p style={{ fontSize: '0.8125rem', color: 'var(--text-muted)', marginBottom: '1.25rem' }}>
            Rezerwacje, zamówienia i opinie są dostępne wyłącznie dla zalogowanych gości.
          </p>
          {mode === 'login'
            ? <LoginForm onSuccess={onLoginSuccess} onSwitchToRegister={() => onSwitch('register')} />
            : <RegisterForm onSuccess={() => onSwitch('login')} onSwitchToLogin={() => onSwitch('login')} />}
        </div>
      </div>
    </div>
  )
}