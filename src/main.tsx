import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { registerSW } from 'virtual:pwa-register'
import App from './App'
import { migrateOldStorage } from './migrateStorage'
import './styles.css'

registerSW({ immediate: true })

// Demana emmagatzematge persistent perquè el navegador no esborri les
// fotografies (IndexedDB) sota pressió de disc. És una petició, no una ordre.
void navigator.storage?.persist?.()

// Migració del canvi de nom, ABANS de llegir cap dada (l'store llegeix
// localStorage en el primer render).
await migrateOldStorage()

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
  </StrictMode>,
)
