import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import './fonts/baseFonts'
import './index.css'
import App from './App.tsx'
import { SiteLanguageProvider, SITE_LANGUAGES, detectSiteLanguage } from './i18n/siteLanguage'
import { loadSystem } from './i18n/system'
void loadSystem(SITE_LANGUAGES[detectSiteLanguage()].code)

createRoot(document.getElementById('root')!).render(
  <StrictMode><SiteLanguageProvider><App /></SiteLanguageProvider></StrictMode>
)
