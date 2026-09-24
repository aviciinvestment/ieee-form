import {
    signInWithPopup,
    signInWithEmailLink,
    sendSignInLinkToEmail,
    isSignInWithEmailLink,
    onAuthStateChanged
} from "https://www.gstatic.com/firebasejs/11.0.1/firebase-auth.js";
import { getFirebase } from "./portal-firebase.js";

const fb = await getFirebase();

const REQUIRED_ROLE = 'manager';
const REDIRECT_PATH = '/community';

document.addEventListener('DOMContentLoaded', function() {
    const loginForm = document.getElementById('managerLoginForm');
    const managerEmail = document.getElementById('managerEmail');
    const googleSignInBtn = document.getElementById('googleSignInBtn');
    const magicLinkBtn = document.getElementById('magicLinkBtn');
    const authStatusText = document.getElementById('authStatusText');
    const loadingMessage = document.getElementById('loadingMessage');
    const customModal = document.getElementById('customModal');
    const modalMessage = document.getElementById('modalMessage');
    const modalCloseBtn = document.getElementById('modalCloseBtn');

    function showModal(message) {
        modalMessage.innerText = message;
        customModal.style.display = 'flex';
    }

    modalCloseBtn.addEventListener('click', () => {
        customModal.style.display = 'none';
    });

    loginForm.addEventListener('submit', (e) => {
        e.preventDefault();
        if (magicLinkBtn) magicLinkBtn.click();
    });

    function setStatus(text, isError) {
        if (!authStatusText) return;
        authStatusText.innerText = text;
        authStatusText.style.color = isError ? 'red' : '#004A75';
    }

    function setLoading(show) {
        if (loadingMessage) loadingMessage.style.display = show ? 'block' : 'none';
    }

    // Only the verified owner of the Gmail may proceed; the backend double-checks
    // the role. A mere X-User-Email claim is no longer enough.
    function verifyRoleAndRedirect(userEmail) {
        setLoading(true);
        setStatus('Checking authorization...');
        fetch('/api/auth/role', {
            headers: { 'X-User-Email': userEmail }
        })
        .then(res => res.json())
        .then(data => {
            setLoading(false);
            if (data.role === REQUIRED_ROLE) {
                localStorage.setItem('portal_email', userEmail.toLowerCase());
                localStorage.setItem('portal_role', data.role);
                setStatus(`Verified as: ${userEmail}`);
                window.location.href = REDIRECT_PATH;
            } else {
                setStatus(`Signed in as ${userEmail}, but this Gmail is not authorized by the admin.`, true);
                showModal('Access Denied: This verified Gmail is not an authorized community manager.');
            }
        })
        .catch(err => {
            console.error('Role Check Error:', err);
            setLoading(false);
            showModal('An error occurred while verifying your role.');
        });
    }

    function handleUser(user) {
        if (user && user.emailVerified !== false) {
            verifyRoleAndRedirect(user.email);
        } else if (user) {
            setStatus('Please verify your email first.', true);
        }
    }

    if (!fb || !fb.auth) {
        setStatus('Firebase configuration could not be loaded. Please contact the admin.', true);
        return;
    }

    const { auth, provider } = fb;

    // Automatic sign-in: if the manager Gmail is already signed in with Google
    // (or a magic link), this fires immediately and logs the user in.
    onAuthStateChanged(auth, handleUser);

    // Check if the visitor returned from an email magic link
    if (isSignInWithEmailLink(auth, window.location.href)) {
        let email = window.localStorage.getItem('portal_email_for_sign_in');
        if (!email) {
            email = window.prompt('Please provide your Gmail for confirmation');
        }
        signInWithEmailLink(auth, email, window.location.href)
            .then(() => {
                window.localStorage.removeItem('portal_email_for_sign_in');
            })
            .catch(() => {
                showModal('Error verifying email link. The link might be expired.');
            });
    }

    if (googleSignInBtn) {
        googleSignInBtn.addEventListener('click', () => {
            signInWithPopup(auth, provider)
                .catch((error) => {
                    console.error('Google Auth Error:', error);
                    showModal('Auth failed: ' + error.message);
                });
        });
    }

    if (magicLinkBtn) {
        magicLinkBtn.addEventListener('click', () => {
            const email = managerEmail.value.trim();
            if (!email || !email.toLowerCase().endsWith('@gmail.com')) {
                showModal('Please enter a valid Gmail address first.');
                return;
            }

            const actionCodeSettings = {
                url: window.location.href,
                handleCodeInApp: true,
            };

            const originalText = magicLinkBtn.innerText;
            magicLinkBtn.innerText = 'Sending...';
            magicLinkBtn.disabled = true;

            sendSignInLinkToEmail(auth, email, actionCodeSettings)
                .then(() => {
                    window.localStorage.setItem('portal_email_for_sign_in', email);
                    setStatus(`Verification link sent to ${email}. Click the link in your email to finish signing in.`);
                    showModal('Verification link sent! Check your email (and spam folder) and click the link to verify.');
                })
                .catch((error) => {
                    console.error('Magic Link Error:', error);
                    showModal('Failed to send verification link.');
                })
                .finally(() => {
                    magicLinkBtn.innerText = originalText;
                    magicLinkBtn.disabled = false;
                });
        });
    }
});