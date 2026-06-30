import { initializeApp, type FirebaseApp } from 'firebase/app';
import { getAnalytics, isSupported, type Analytics } from 'firebase/analytics';

// Firebase web config is PUBLIC by design (it identifies the project; access is
// gated by Firebase Security Rules / App Check, not by key secrecy). We still read
// it from VITE_ env so it's swappable per environment.
const firebaseConfig = {
  apiKey: import.meta.env.VITE_FIREBASE_API_KEY,
  authDomain: import.meta.env.VITE_FIREBASE_AUTH_DOMAIN,
  projectId: import.meta.env.VITE_FIREBASE_PROJECT_ID,
  storageBucket: import.meta.env.VITE_FIREBASE_STORAGE_BUCKET,
  messagingSenderId: import.meta.env.VITE_FIREBASE_MESSAGING_SENDER_ID,
  appId: import.meta.env.VITE_FIREBASE_APP_ID,
  measurementId: import.meta.env.VITE_FIREBASE_MEASUREMENT_ID,
};

// Only init when the minimum config is present (avoids crashing local/dev builds
// that don't set Firebase env vars).
const isConfigured = Boolean(firebaseConfig.apiKey && firebaseConfig.projectId && firebaseConfig.appId);

export const firebaseApp: FirebaseApp | null = isConfigured ? initializeApp(firebaseConfig) : null;

let analytics: Analytics | null = null;

/**
 * Initialize Analytics lazily and safely:
 *  - only in the browser (isSupported guards SSR / unsupported environments)
 *  - only in production builds (no analytics noise from dev)
 */
export async function initAnalytics(): Promise<Analytics | null> {
  if (analytics || !firebaseApp || !import.meta.env.PROD) return analytics;
  try {
    if (await isSupported()) {
      analytics = getAnalytics(firebaseApp);
    }
  } catch {
    // Analytics unavailable (blocked / unsupported) non-fatal.
  }
  return analytics;
}
