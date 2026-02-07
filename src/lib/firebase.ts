import { initializeApp, getApps } from "firebase/app";
import { getAnalytics, logEvent, type Analytics } from "firebase/analytics";

const firebaseConfig = {
  apiKey: "AIzaSyBGA_AkY1ukCvuGNaA-iIvP1o2J5dmC2zA",
  authDomain: "nantestudio-7d35c.firebaseapp.com",
  projectId: "nantestudio-7d35c",
  storageBucket: "nantestudio-7d35c.firebasestorage.app",
  messagingSenderId: "956895943857",
  appId: "1:956895943857:web:341eb7ecfa187b4bab9690",
  measurementId: "G-99NC9EE3KV",
};

let analytics: Analytics | null = null;

/** Returns the Analytics instance, or null on the server / if blocked by ad blockers. */
export function getFirebaseAnalytics(): Analytics | null {
  if (typeof window === "undefined") return null;
  if (analytics) return analytics;

  try {
    const app = getApps().length === 0 ? initializeApp(firebaseConfig) : getApps()[0];
    analytics = getAnalytics(app);
    return analytics;
  } catch {
    // Analytics blocked (ad blocker, privacy extension, etc.)
    return null;
  }
}

/** Fire-and-forget analytics event with null guard. */
export function trackEvent(name: string, params?: Record<string, string | number | boolean>) {
  const a = getFirebaseAnalytics();
  if (a) logEvent(a, name, params);
}
