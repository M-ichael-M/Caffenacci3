import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import './fonts/baseFonts'
import { loadSiteFonts } from './fonts/themeFonts'
if (!/^\/(kawiarnia|cafe|preview)\//.test(window.location.pathname)) void loadSiteFonts()
import './index.css'
import App from './App.tsx'
import { SiteLanguageProvider, SITE_LANGUAGES, detectSiteLanguage } from './i18n/siteLanguage'
import { loadSystem } from './i18n/system'
import { installSessionGuard, SESSION_TOKEN_UPDATED_EVENT } from './sessionGuard'
import { loadClientAuth, saveClientAuth, clearClientAuth } from './authStorage'

installSessionGuard({
  refreshPath: '/client-auth/refresh',
  load: loadClientAuth,
  setToken: token => {
    const auth = loadClientAuth()
    if (auth) {
      saveClientAuth({ ...auth, token })
      window.dispatchEvent(new Event(SESSION_TOKEN_UPDATED_EVENT))
    }
  },
  clear: clearClientAuth,
})
void loadSystem(SITE_LANGUAGES[detectSiteLanguage()].code)

createRoot(document.getElementById('root')!).render(
  <StrictMode><SiteLanguageProvider><App /></SiteLanguageProvider></StrictMode>
)
