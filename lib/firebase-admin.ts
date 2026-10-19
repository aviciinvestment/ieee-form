import { getApps, initializeApp, cert, type App } from "firebase-admin/app";
import { getAuth, type Auth, type DecodedIdToken } from "firebase-admin/auth";

let adminApp: App | null = null;
let adminAuth: Auth | null = null;

export function getFirebaseAdminAuth(): Auth {
  if (adminAuth) return adminAuth;

  const projectId = process.env.FIREBASE_PROJECT_ID;
  if (!projectId) {
    throw new Error("FIREBASE_PROJECT_ID is not configured in environment variables.");
  }

  if (!getApps().length) {
    const serviceAccountKey = process.env.FIREBASE_SERVICE_ACCOUNT_KEY;
    if (serviceAccountKey) {
      try {
        const credentials = JSON.parse(serviceAccountKey);
        adminApp = initializeApp({
          credential: cert(credentials),
          projectId,
        });
      } catch (err) {
        console.warn("Failed to parse FIREBASE_SERVICE_ACCOUNT_KEY, using projectId initialization:", err);
        adminApp = initializeApp({ projectId });
      }
    } else {
      adminApp = initializeApp({ projectId });
    }
  } else {
    adminApp = getApps()[0];
  }

  adminAuth = getAuth(adminApp);
  return adminAuth;
}

export async function verifyFirebaseIdToken(token: string): Promise<DecodedIdToken | null> {
  if (!token || typeof token !== "string") return null;

  try {
    const auth = getFirebaseAdminAuth();
    return await auth.verifyIdToken(token.trim());
  } catch (error) {
    console.warn("Firebase ID token verification failed:", error);
    return null;
  }
}
