"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { onAuthStateChanged, signOut } from "firebase/auth";
import { useFirebaseAccount } from "@/components/use-firebase";

export function usePortalSession(requiredEmail: string) {
  const router = useRouter();
  const { fb, loadError } = useFirebaseAccount();
  const [state, setState] = useState<"loading" | "granted" | "denied">("loading");

  useEffect(() => {
    if (!requiredEmail || loadError || !fb) {
      if (!requiredEmail || loadError) setState("denied");
      return;
    }
    let disposed = false;
    const unsub = onAuthStateChanged(fb.auth, async (user) => {
      const ok = user?.email?.toLowerCase() === requiredEmail.toLowerCase();
      if (ok) {
        if (!disposed) setState("granted");
        return;
      }
      if (user) {
        try {
          await signOut(fb.auth);
        } catch {
          /* noop */
        }
      }
      try {
        window.localStorage.removeItem("portal_email");
        window.localStorage.removeItem("portal_role");
      } catch {
        /* noop */
      }
      window.location.href = "/login";
    });
    return () => {
      disposed = true;
      unsub();
    };
  }, [fb, loadError, requiredEmail, router]);

  async function logout() {
    if (fb?.auth) {
      try {
        await signOut(fb.auth);
      } catch {
        /* noop */
      }
    }
    try {
      window.localStorage.removeItem("portal_email");
      window.localStorage.removeItem("portal_role");
    } catch {
      /* noop */
    }
    window.location.href = "/login";
  }

  return { state, logout };
}

export function usePortalEmail(): string {
  const [email, setEmail] = useState("");
  useEffect(() => {
    try {
      setEmail(window.localStorage.getItem("portal_email") || "");
    } catch {
      setEmail("");
    }
  }, []);
  return email;
}