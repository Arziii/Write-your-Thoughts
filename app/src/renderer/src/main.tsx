import React from 'react'
import ReactDOM from 'react-dom/client'
import { HashRouter } from 'react-router-dom'
import App from './App'
import { setupBrowserApiMock } from './services/browserApiMock'
import { ErrorBoundary } from './components/ui/ErrorBoundary'
import './index.css'

// Install browser fallback if running outside of Electron
setupBrowserApiMock()

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <ErrorBoundary>
      <HashRouter future={{ v7_startTransition: true, v7_relativeSplatPath: true }}>
        <App />
      </HashRouter>
    </ErrorBoundary>
  </React.StrictMode>
)
