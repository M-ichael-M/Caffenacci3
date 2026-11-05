import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import './fonts/baseFonts'
import './index.css'
import App from './App.tsx'
import { SystemI18nProvider, DEFAULT_LANGUAGE } from './i18n/I18nProvider'
import { loadSystem } from './i18n/system'
void loadSystem(DEFAULT_LANGUAGE.code)

createRoot(document.getElementById('root')!).render(
  <StrictMode><SystemI18nProvider language={DEFAULT_LANGUAGE}><App /></SystemI18nProvider></StrictMode>
)
