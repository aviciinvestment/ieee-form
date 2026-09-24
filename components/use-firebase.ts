"use client";

import { useEffect, useState } from "react";
import { getFirebase, type FirebaseBundle } from "@/lib/firebase";

export function useFirebaseAccount() {
  const [fb, setFb] = useState<FirebaseBundle | null>(null);
  const [loadError, setLoadError] = useState("");

  useEffect(() => {
    let active = true;
    getFirebase()
      .then((f) => {
        if (active) setFb(f);
      })
      .catch((err) => {
        if (active) setLoadError(err?.message ?? "Failed to load authentication.");
      });
    return () => {
      active = false;
    };
  }, []);

  return { fb, loadError };
}