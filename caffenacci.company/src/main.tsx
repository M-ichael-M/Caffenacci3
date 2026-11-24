import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import './index.css'
import App from './App.tsx'
import { I18nProvider } from './i18n'
import { installSessionGuard, SESSION_TOKEN_UPDATED_EVENT } from './sessionGuard'
import { loadAuth, saveAuth, clearAuth } from './authStorage'

installSessionGuard({
  refreshPath: '/auth/refresh',
  load: loadAuth,
  setToken: token => {
    const auth = loadAuth()
    if (auth) {
      saveAuth({ ...auth, token })
      window.dispatchEvent(new Event(SESSION_TOKEN_UPDATED_EVENT))
    }
  },
  clear: clearAuth,
})

// Google Translate w Chrome opakowuje teksty w <font>, przez co React rzuca
// błędami removeChild/insertBefore. Znana łatka: ignorujemy operacje na
// węzłach, które nie są już dziećmi danego rodzica.
if (typeof Node === 'function' && Node.prototype) {
  const origRemoveChild = Node.prototype.removeChild
  Node.prototype.removeChild = function <T extends Node>(this: Node, child: T): T {
    if (child.parentNode !== this) return child
    return origRemoveChild.call(this, child) as T
  } as typeof origRemoveChild

  const origInsertBefore = Node.prototype.insertBefore
  Node.prototype.insertBefore = function <T extends Node>(this: Node, newNode: T, ref: Node | null): T {
    if (ref && ref.parentNode !== this) return newNode
    return origInsertBefore.call(this, newNode, ref) as T
  } as typeof origInsertBefore
}

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <I18nProvider>
      <App />
    </I18nProvider>
  </StrictMode>,
)
