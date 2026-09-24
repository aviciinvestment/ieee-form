"use client";

import { initializeApp, getApps, type FirebaseApp } from "firebase/app";
import { getAuth, GoogleAuthProvider, type Auth } from "firebase/auth";

export type FirebaseBundle = {
  app: FirebaseApp;
  auth: Auth;
  provider: GoogleAuthProvider;
};

let bundle: FirebaseBundle | null = null;

export async function getFirebase(): Promise<FirebaseBundle> {
  if (bundle) return bundle;

  let config: Record<string, string> | null = null;
  try {
    const res = await fetch("/api/config/firebase", { cache: "no-store" });
    if (res.ok) {
      const json = await res.json();
      if (json && json.apiKey) config = json;
    }
  } catch {
    config = null;
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