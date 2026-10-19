import crypto from "node:crypto";

const GOOGLE_CERTS_URL =
  "https://www.googleapis.com/robot/v1/metadata/x509/securetoken@system.gserviceaccount.com";

let cachedCerts: Record<string, string> | null = null;
let cacheExpiresAt = 0;

async function getGooglePublicKeys(): Promise<Record<string, string>> {
  const now = Date.now();
  if (cachedCerts && now < cacheExpiresAt) {
    return cachedCerts;
  }

  try {
    const res = await fetch(GOOGLE_CERTS_URL, {
      headers: { Accept: "application/json" },
      next: { revalidate: 3600 },
    });
    if (!res.ok) {
      throw new Error(`Failed to fetch Google public certs: ${res.status} ${res.statusText}`);
    }

    const cacheControl = res.headers.get("cache-control") || "";
    const match = cacheControl.match(/max-age=(\d+)/i);
    const maxAgeSeconds = match ? parseInt(match[1], 10) : 3600;

    const certs = (await res.json()) as Record<string, string>;
    cachedCerts = certs;
    cacheExpiresAt = now + Math.max(maxAgeSeconds - 60, 60) * 1000;
    return certs;
  } catch (err) {
    if (cachedCerts) {
      console.warn("Using stale cached Google public certs due to fetch failure:", err);
      return cachedCerts;
    }
    throw err;
  }
}

export interface DecodedFirebaseToken {
  iss: string;
  aud: string;
  auth_time: number;
  user_id: string;
  sub: string;
  iat: number;
  exp: number;
  email?: string;
  email_verified?: boolean;
  name?: string;
  picture?: string;
  [key: string]: unknown;
}

/**
 * Verifies a Firebase ID token using Google's public x509 certificates and Node.js built-in crypto.
 * Completely eliminates the heavy firebase-admin SDK and its broken CommonJS/ESM transitive dependencies.
 */
export async function verifyFirebaseIdToken(token: string): Promise<DecodedFirebaseToken | null> {
  if (!token || typeof token !== "string") return null;

  try {
    const parts = token.trim().split(".");
    if (parts.length !== 3) {
      return null;
    }

    const [headerB64, payloadB64, signatureB64] = parts;

    // Decode header
    const headerJson = Buffer.from(headerB64, "base64url").toString("utf-8");
    const header = JSON.parse(headerJson) as { alg?: string; kid?: string };

    if (header.alg !== "RS256" || !header.kid) {
      console.warn("Invalid Firebase token header:", header);
      return null;
    }

    let certs = await getGooglePublicKeys();
    let cert = certs[header.kid];

    // If key not found in cache, force fresh fetch in case Google rotated keys
    if (!cert) {
      cachedCerts = null;
      cacheExpiresAt = 0;
      certs = await getGooglePublicKeys();
      cert = certs[header.kid];
    }

    if (!cert) {
      console.warn("Unknown kid in Firebase token:", header.kid);
      return null;
    }

    // Verify RS256 signature
    const verifier = crypto.createVerify("RSA-SHA256");
    verifier.update(`${headerB64}.${payloadB64}`);
    const isValid = verifier.verify(cert, signatureB64, "base64url");
    if (!isValid) {
      console.warn("Firebase token signature verification failed.");
      return null;
    }

    // Decode and validate payload
    const payloadJson = Buffer.from(payloadB64, "base64url").toString("utf-8");
    const payload = JSON.parse(payloadJson) as DecodedFirebaseToken;

    const projectId = process.env.FIREBASE_PROJECT_ID || "global-standard-474515-c2";
    const now = Math.floor(Date.now() / 1000);

    // Allow 120 seconds of clock skew
    if (typeof payload.exp !== "number" || payload.exp < now - 120) {
      console.warn("Firebase token has expired:", { exp: payload.exp, now });
      return null;
    }

    if (typeof payload.iat !== "number" || payload.iat > now + 120) {
      console.warn("Firebase token issued in future:", { iat: payload.iat, now });
      return null;
    }

    if (payload.aud !== projectId) {
      console.warn("Firebase token audience mismatch:", { aud: payload.aud, expected: projectId });
      return null;
    }

    const expectedIssuer = `https://securetoken.google.com/${projectId}`;
    if (payload.iss !== expectedIssuer) {
      console.warn("Firebase token issuer mismatch:", { iss: payload.iss, expected: expectedIssuer });
      return null;
    }

    if (typeof payload.sub !== "string" || !payload.sub.trim()) {
      console.warn("Firebase token subject is invalid:", payload.sub);
      return null;
    }

    return payload;
  } catch (error) {
    console.warn("Firebase token verification exception:", error);
    return null;
  }
}
