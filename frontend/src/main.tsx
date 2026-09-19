import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { BrowserRouter } from 'react-router-dom'

// Sous-ensemble latin uniquement : il couvre tous les caracteres du francais,
// oe compris, la ou les imports complets embarquent aussi le cyrillique et le
// grec, soit environ 400 Ko inutiles dans le cache hors ligne.
import '@fontsource/space-grotesk/latin-500.css'
import '@fontsource/space-grotesk/latin-600.css'
import '@fontsource/inter/latin-400.css'
import '@fontsource/inter/latin-500.css'
import '@fontsource/ibm-plex-mono/latin-500.css'

import './styles/theme.css'
import './styles/global.css'
import './styles/ui.css'
import './styles/spinner.css'

import App from './App'

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <BrowserRouter>
      <App />
    </BrowserRouter>
  </StrictMode>,
)
