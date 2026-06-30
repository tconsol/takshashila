import React from 'react';
import ReactDOM from 'react-dom/client';
import { App } from './app/App';
import { initAnalytics } from './lib/firebase';
import './styles/globals.css';

// Fire-and-forget: safe no-op in dev / when Firebase env isn't configured.
void initAnalytics();

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>,
);
