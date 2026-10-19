"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { onAuthStateChanged, signOut } from "firebase/auth";
import { useFirebaseAccount } from "@/components/use-firebase";

export function usePortalSession(requiredEmail?: string) {
  const router = useRouter();
  const { fb, loadError } = useFirebaseAccount();
  const [state, setState] = useState<"loading" | "granted" | "denied">("loading");

  useEffect(() => {
    if (loadError) {
      setState("denied");
      return;
    }
    if (!fb) return;

    let disposed = false;
    const unsub = onAuthStateChanged(fb.auth, async (user) => {
      if (!user || !user.email) {
        if (!disposed) setState("denied");
        return;
      }

      if (requiredEmail && user.email.toLowerCase() !== requiredEmail.toLowerCase()) {
        try {
          await signOut(fb.auth);
        } catch {
          /* noop */
        }
        try {
          window.localStorage.removeItem("portal_email");
          window.localStorage.removeItem("portal_role");
        } catch {
          /* noop */
        }
        if (!disposed) {
          setState("denied");
          window.location.href = "/login";
        }
        return;
      }

      try {
        window.localStorage.setItem("portal_email", user.email.toLowerCase());
      } catch {
        /* noop */
      }

      if (!disposed) setState("granted");
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
  const { fb } = useFirebaseAccount();

  useEffect(() => {
    try {
      const stored = window.localStorage.getItem("portal_email") || "";
      if (stored) setEmail(stored);
    } catch {
      /* noop */
    }

    if (fb?.auth) {
      const unsub = onAuthStateChanged(fb.auth, (user) => {
        if (user?.email) {
          const lower = user.email.toLowerCase();
          setEmail(lower);
          try {
            window.localStorage.setItem("portal_email", lower);
          } catch {
            /* noop */
          }
        }
      });
      return () => unsub();
    }
  }, [fb]);

  return email;
}