import React from 'react'
import ReactDOM from 'react-dom/client'
import { HashRouter } from 'react-router-dom'
import App from './App'
import './styles/globals.css'

// HashRouter, not BrowserRouter: the packaged app loads the renderer from a
// file:// path (loadFile in main), whose pathname matches none of our routes — so
// BrowserRouter rendered a blank <main> until the user clicked a nav item. The URL
// hash is immune to the file path, so "/" resolves correctly and redirects to /agent.
ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <HashRouter>
      <App />
    </HashRouter>
  </React.StrictMode>
)
