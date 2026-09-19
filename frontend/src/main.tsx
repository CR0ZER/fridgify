import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { BrowserRouter } from 'react-router-dom'

import './styles/theme.css'
import './styles/global.css'
import './styles/ui.css'

import App from './App'
import { appliquerTheme } from './utils/theme'

appliquerTheme()

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <BrowserRouter>
      <App />
    </BrowserRouter>
  </StrictMode>,
)
