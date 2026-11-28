import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import './index.css'
import App from './App.tsx'
import { AuthDebugPanel } from './debug/AuthDebugPanel' // TEMPORARY

const showAuthDebug = new URLSearchParams(location.search).has('authdebug') // TEMPORARY

createRoot(document.getElementById('root')!).render(
  <StrictMode>{showAuthDebug ? <AuthDebugPanel /> : <App />}</StrictMode>,
)
