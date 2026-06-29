import { initializeApp } from 'firebase/app';
import { getAuth } from 'firebase/auth';
import { getFirestore } from 'firebase/firestore';
import { getStorage } from 'firebase/storage';
import { getFunctions } from 'firebase/functions';
import {
  initializeAppCheck,
  ReCaptchaV3Provider,
  CustomProvider,
} from 'firebase/app-check';

const firebaseConfig = {
  apiKey: import.meta.env.VITE_FIREBASE_API_KEY,
  authDomain: import.meta.env.VITE_FIREBASE_AUTH_DOMAIN,
  projectId: import.meta.env.VITE_FIREBASE_PROJECT_ID,
  storageBucket: import.meta.env.VITE_FIREBASE_STORAGE_BUCKET,
  messagingSenderId: import.meta.env.VITE_FIREBASE_MESSAGING_SENDER_ID,
  appId: import.meta.env.VITE_FIREBASE_APP_ID,
};

export const app = initializeApp(firebaseConfig);
export const auth = getAuth(app);
export const db = getFirestore(app);
export const storage = getStorage(app);
export const functions = getFunctions(app, 'asia-south1');

// ── App Check ────────────────────────────────────────────────────────────────
// Set VITE_APPCHECK_DEBUG_TOKEN for local dev (copy from Firebase console).
// Set VITE_APPCHECK_SITE_KEY (reCAPTCHA v3) for deployed environments.
// Enforcement is enabled in the Firebase console per-service (Firestore/Functions/Storage).
// TODO: once VITE_APPCHECK_SITE_KEY is provisioned, flip enforceAppCheck:true on Functions.
const appCheckDebugToken = import.meta.env.VITE_APPCHECK_DEBUG_TOKEN as string | undefined;
const appCheckSiteKey    = import.meta.env.VITE_APPCHECK_SITE_KEY    as string | undefined;

if (appCheckDebugToken) {
  // @ts-expect-error — global debug token for local development
  self.FIREBASE_APPCHECK_DEBUG_TOKEN = appCheckDebugToken;
}

if (appCheckSiteKey) {
  initializeAppCheck(app, {
    provider: new ReCaptchaV3Provider(appCheckSiteKey),
    isTokenAutoRefreshEnabled: true,
  });
} else if (appCheckDebugToken) {
  initializeAppCheck(app, {
    provider: new CustomProvider({ getToken: async () => ({ token: appCheckDebugToken, expireTimeMillis: Date.now() + 3_600_000 }) }),
    isTokenAutoRefreshEnabled: true,
  });
}

export const firebaseReady = { projectId: firebaseConfig.projectId };
