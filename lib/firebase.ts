"use client";

import { initializeApp, getApps, type FirebaseApp } from "firebase/app";
import { getAuth, GoogleAuthProvider, type Auth } from "firebase/auth";

export type FirebaseBundle = {
  app: FirebaseApp;
  auth: Auth;
  provider: GoogleAuthProvider;
};

let bundle: FirebaseBundle | null = null;

function getEnvConfig(): Record<string, string> | null {
  if (process.env.NEXT_PUBLIC_FIREBASE_API_KEY) {
    return {
      apiKey: process.env.NEXT_PUBLIC_FIREBASE_API_KEY,
      authDomain: process.env.NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN || "",
      projectId: process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID || "",
      storageBucket: process.env.NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET || "",
      messagingSenderId: process.env.NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID || "",
      appId: process.env.NEXT_PUBLIC_FIREBASE_APP_ID || "",
      measurementId: process.env.NEXT_PUBLIC_FIREBASE_MEASUREMENT_ID || "",
    };
  }
  return null;
}

export async function getFirebase(): Promise<FirebaseBundle> {
  if (bundle) return bundle;

  let config: Record<string, string> | null = getEnvConfig();
  if (!config) {
    try {
      const res = await fetch("/api/config/firebase", { cache: "no-store" });
      if (res.ok) {
        const json = await res.json();
        if (json && json.apiKey) config = json;
      }
    } catch {
      config = null;
    }
  }

  if (!config) {
    throw new Error("Firebase configuration is unavailable");
  }

  const app = getApps().length ? getApps()[0] : initializeApp(config);
  const auth = getAuth(app);
  const provider = new GoogleAuthProvider();
  bundle = { app, auth, provider };
  return bundle;
}

/**
 * Retrieves the authenticated Firebase user's ID token and formats it as an Authorization header.
 * Waits briefly for auth resolution on initial page mounts so tokens are never dropped on refresh.
 */
export async function getAuthHeaders(): Promise<Record<string, string>> {
  try {
    const { auth } = await getFirebase();
    if (auth.currentUser) {
      const token = await auth.currentUser.getIdToken();
      return { Authorization: `Bearer ${token}` };
    }

    const token = await new Promise<string | null>((resolve) => {
      const unsubscribe = auth.onAuthStateChanged(async (user) => {
        unsubscribe();
        if (user) {
          try {
            resolve(await user.getIdToken());
          } catch {
            resolve(null);
          }
        } else {
          resolve(null);
        }
      });
      setTimeout(() => {
        unsubscribe();
        resolve(null);
      }, 3000);
    });

    if (token) {
      return { Authorization: `Bearer ${token}` };
    }
  } catch (error) {
    console.warn("Failed to retrieve Firebase auth token:", error);
  }
  return {};
}