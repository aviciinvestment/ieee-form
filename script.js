import { initializeApp } from "https://www.gstatic.com/firebasejs/11.0.1/firebase-app.js";
import { 
    getAuth, 
    signInWithPopup, 
    GoogleAuthProvider, 
    sendSignInLinkToEmail, 
    isSignInWithEmailLink, 
    signInWithEmailLink, 
    onAuthStateChanged 
} from "https://www.gstatic.com/firebasejs/11.0.1/firebase-auth.js";

// Firebase config now comes from the backend (root .env file), which the
// browser reads via the /api/config/firebase endpoint. No secrets in JS.
let firebaseConfig = null;
try {
    const configRes = await fetch('/api/config/firebase');
    if (!configRes.ok) {
        throw new Error(`Firebase config request failed with status ${configRes.status}`);
    }
    firebaseConfig = await configRes.json();
} catch (err) {
    console.error('Failed to load Firebase config from environment:', err);
}

let app = null;
let auth = null;
let provider = null;

if (firebaseConfig) {
    app = initializeApp(firebaseConfig);
    auth = getAuth(app);
    provider = new GoogleAuthProvider();
}

// DOM Elements
const authStatusText = document.getElementById('authStatusText');
const submitBtn = document.getElementById('submitBtn');
const googleSignInBtn = document.getElementById('googleSignInBtn');
const magicLinkBtn = document.getElementById('magicLinkBtn');
const emailInput = document.getElementById('gmail');
const registrationForm = document.getElementById('registrationForm');
const formWrapper = document.querySelector('.form-wrapper');
const successMessage = document.getElementById('successMessage');
const techSkillSelect = document.getElementById('techSkill');

// Populate the tech track dropdown from the learning tracks configured by the admin
// Falls back to the hardcoded options if the API is unavailable or has no tracks.
fetch('/api/tracks')
    .then(res => res.json())
    .then(result => {
        if (result.data && result.data.length > 0) {
            techSkillSelect.innerHTML = '<option value="" disabled selected>Select Tech Track</option>';
            result.data.forEach(track => {
                const opt = document.createElement('option');
                opt.value = track.name;
                opt.textContent = track.name;
                techSkillSelect.appendChild(opt);
            });
        }
    })
    .catch(err => console.error('Error fetching learning tracks:', err));

// Modal Elements
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

// State
let verifiedEmail = null;

// Auth State Observer
if (auth) {
    onAuthStateChanged(auth, (user) => {
        if (user && user.emailVerified !== false) { // Google users and Magic Link users
            verifiedEmail = user.email;
            emailInput.value = verifiedEmail;
            emailInput.readOnly = true; // Prevent changing after verification
            authStatusText.innerText = `Verified as: ${verifiedEmail}`;
            authStatusText.style.color = '#004A75';
            submitBtn.disabled = false;
            if(googleSignInBtn) googleSignInBtn.style.display = 'none';
            if(magicLinkBtn) magicLinkBtn.style.display = 'none';
            document.querySelectorAll('.auth-text').forEach(el => {
                if (el.innerText === 'OR') el.style.display = 'none';
            });
        }
    });
} else {
    authStatusText.innerText = 'Firebase configuration could not be loaded. Please contact the admin.';
    authStatusText.style.color = 'red';
    if (submitBtn) submitBtn.disabled = true;
}

// Check if returning from Magic Link
if (auth && isSignInWithEmailLink(auth, window.location.href)) {
    let email = window.localStorage.getItem('emailForSignIn');
    if (!email) {
        email = window.prompt('Please provide your email for confirmation');
    }
    signInWithEmailLink(auth, email, window.location.href)
        .then((result) => {
            window.localStorage.removeItem('emailForSignIn');
            showModal('Email successfully verified!');
            // Page state updates via onAuthStateChanged
        })
        .catch((error) => {
            console.error(error);
            showModal('Error verifying email link. The link might be expired.');
        });
}

// Handle Google Sign-In
if(googleSignInBtn) {
    googleSignInBtn.addEventListener('click', () => {
        if (!auth || !provider) {
            showModal('Firebase configuration could not be loaded. Please contact the admin.');
            return;
        }
        signInWithPopup(auth, provider)
            .then((result) => {
                showModal('Successfully verified via Google!');
            })
            .catch((error) => {
                console.error('Google Auth Error:', error);
                showModal('Auth failed: ' + error.message);
            });
    });
}

// Handle Magic Link
if(magicLinkBtn) {
    magicLinkBtn.addEventListener('click', () => {
        const email = emailInput.value.trim();
        if (!email || !email.toLowerCase().endsWith('@gmail.com')) {
            showModal('Please enter a valid Gmail address first.');
            return;
        }

        if (!auth) {
            showModal('Firebase configuration could not be loaded. Please contact the admin.');
            return;
        }

        const actionCodeSettings = {
            url: window.location.href, // Redirects back to the same page
            handleCodeInApp: true,
        };

        const originalText = magicLinkBtn.innerText;
        magicLinkBtn.innerText = 'Sending...';
        magicLinkBtn.disabled = true;

        sendSignInLinkToEmail(auth, email, actionCodeSettings)
            .then(() => {
                window.localStorage.setItem('emailForSignIn', email);
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

// Form Submission
registrationForm.addEventListener('submit', function(e) {
    e.preventDefault();
    
    if (!verifiedEmail) {
        showModal('You must verify your email first!');
        return;
    }

    const firstName = document.getElementById('firstName').value.trim();
    const lastName = document.getElementById('lastName').value.trim();
    const phone = document.getElementById('phoneNumber').value.trim();
    const techSkill = document.getElementById('techSkill').value;
    
    if(!techSkill) {
        showModal('Please select a tech track.');
        return;
    }

    const originalBtnText = submitBtn.innerText;
    submitBtn.innerText = 'Submitting...';
    submitBtn.disabled = true;

    // Send data to backend
    fetch('/api/register', {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json'
        },
        body: JSON.stringify({
            firstName,
            lastName,
            phone,
            techSkill,
            email: verifiedEmail // Using the trusted verified email
        })
    })
    .then(response => response.json())
    .then(data => {
        if (data.error) {
            showModal(data.error);
        } else {
            // Hide the form and show success message
            formWrapper.style.display = 'none';
            successMessage.style.display = 'block';
            registrationForm.reset();

            // Redirect straight to the learning track's WhatsApp group
            // (no countdown timer, no intermediate request).
            if (data.whatsappLink) {
                window.location.href = data.whatsappLink;
            } else {
                const redirectInfo = document.getElementById('redirectInfo');
                if (redirectInfo) {
                    redirectInfo.innerText = 'Your learning track WhatsApp group is not set up yet. Please contact the admin.';
                }
            }
        }
    })
    .catch(error => {
        console.error('Error:', error);
        showModal('An error occurred during registration. Please make sure the server is running.');
    })
    .finally(() => {
        submitBtn.innerText = originalBtnText;
        submitBtn.disabled = false;
    });
});
