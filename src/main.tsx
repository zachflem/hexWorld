import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import './index.css'
import App from './App.tsx'
import { ConfirmProvider } from './ui/primitives/ConfirmProvider.tsx'

// Vite strips this branch in production — index.html title stays "Hex World".
if (import.meta.env.DEV) {
  document.title = '*DEV* hexWorld'
}

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <ConfirmProvider>
      <App />
    </ConfirmProvider>
  </StrictMode>,
)
