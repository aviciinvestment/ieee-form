import { initializeApp } from "https://www.gstatic.com/firebasejs/11.0.1/firebase-app.js";
import { getAuth, GoogleAuthProvider } from "https://www.gstatic.com/firebasejs/11.0.1/firebase-auth.js";

// Shared Firebase initializer for the portal pages (admin / community login and
// dashboards). Reads the config from the backend (root .env) so no secrets are
// hardcoded in JS. Returns { app, auth, provider } or null if unavailable.
let cached = null;

export async function getFirebase() {
    if (cached) return cached;

    let firebaseConfig = null;
    try {
        const res = await fetch('/api/config/firebase');
        if (!res.ok) {
            throw new Error(`Firebase config request failed with status ${res.status}`);
        }
        firebaseConfig = await res.json();
    } catch (err) {
        console.error('Failed to load Firebase config from environment:', err);
    }

    if (!firebaseConfig) return null;

    const app = initializeApp(firebaseConfig);
    const auth = getAuth(app);
    const provider = new GoogleAuthProvider();

    cached = { app, auth, provider };
    return cached;
}