import { getApp, getApps, initializeApp, type FirebaseOptions } from 'firebase/app';
import { getAnalytics, isSupported } from 'firebase/analytics';
import { getAuth } from 'firebase/auth';
import { getFirestore } from 'firebase/firestore';
import { getStorage } from 'firebase/storage';

const env = import.meta.env;

// Firebase web configuration is public client config. These defaults are the app values
// supplied by the project owner; optional VITE_ variables can select another Firebase app.
const firebaseConfig: FirebaseOptions = {
  apiKey: env.VITE_FIREBASE_API_KEY || 'AIzaSyA_3V1fG0u9x7imXneOvpSpty4Cm8lN0kU',
  authDomain: env.VITE_FIREBASE_AUTH_DOMAIN || 'lanchat-ccf2a.firebaseapp.com',
  projectId: env.VITE_FIREBASE_PROJECT_ID || 'lanchat-ccf2a',
  storageBucket: env.VITE_FIREBASE_STORAGE_BUCKET || 'lanchat-ccf2a.firebasestorage.app',
  messagingSenderId: env.VITE_FIREBASE_MESSAGING_SENDER_ID || '653346950054',
  appId: env.VITE_FIREBASE_APP_ID || '1:653346950054:web:127293d4cf85639bfd9d67',
  measurementId: env.VITE_FIREBASE_MEASUREMENT_ID || 'G-BWXSBRD99T',
};

export const firebaseConfigured = Boolean(
  firebaseConfig.apiKey && firebaseConfig.authDomain && firebaseConfig.projectId &&
  firebaseConfig.storageBucket && firebaseConfig.messagingSenderId && firebaseConfig.appId,
);

export const firebaseApp = firebaseConfigured
  ? (getApps().length ? getApp() : initializeApp(firebaseConfig))
  : null;

export const auth = firebaseApp ? getAuth(firebaseApp) : null;
export const db = firebaseApp ? getFirestore(firebaseApp) : null;
export const storage = firebaseApp ? getStorage(firebaseApp) : null;

if (firebaseApp && firebaseConfig.measurementId && typeof window !== 'undefined') {
  void isSupported()
    .then((supported) => {
      if (supported) getAnalytics(firebaseApp);
    })
    .catch(() => {
      // Analytics is optional; unsupported browsers should still be able to chat.
    });
}
