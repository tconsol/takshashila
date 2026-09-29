import React from 'react';
import ReactDOM from 'react-dom/client';
import { GoogleOAuthProvider } from '@react-oauth/google';
import { App } from './app/App';
import { initAnalytics } from './lib/firebase';
import './styles/globals.css';

// Fire-and-forget: safe no-op in dev / when Firebase env isn't configured.
void initAnalytics();

const GOOGLE_CLIENT_ID = (import.meta.env.VITE_GOOGLE_CLIENT_ID as string | undefined) ?? '';

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    {/* With no client ID the Google provider throws ("Missing required parameter
        client_id") and takes the whole login page down with it. Skip it: the
        Google button hides itself and password sign-in keeps working. */}
    {GOOGLE_CLIENT_ID ? (
      <GoogleOAuthProvider clientId={GOOGLE_CLIENT_ID}>
        <App />
      </GoogleOAuthProvider>
    ) : (
      <App />
    )}
  </React.StrictMode>,
);
