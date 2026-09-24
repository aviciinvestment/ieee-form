import {
    onAuthStateChanged,
    signOut
} from "https://www.gstatic.com/firebasejs/11.0.1/firebase-auth.js";
import { getFirebase } from "./portal-firebase.js";

function onReady(fn) {
    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', fn);
    } else {
        fn();
    }
}

onReady(async function() {
    const tableBody = document.getElementById('tableBody');
    const loadingMessage = document.getElementById('loadingMessage');
    const errorMessage = document.getElementById('errorMessage');
    const logoutBtn = document.getElementById('logoutBtn');

    // Mobile slide-down menu
    const menuToggle = document.getElementById('menuToggle');
    const dashboardMenu = document.getElementById('dashboardMenu');

    if (menuToggle && dashboardMenu) {
        menuToggle.addEventListener('click', () => {
            const open = dashboardMenu.classList.toggle('open');
            menuToggle.innerHTML = open ? "<i class='bx bx-x'></i>" : "<i class='bx bx-menu'></i>";
        });
    }

    // Admin Management UI Elements (only exist on admin.html)
    const adminSection = document.getElementById('adminSection');
    const addManagerBtn = document.getElementById('addManagerBtn');
    const newManagerEmail = document.getElementById('newManagerEmail');
    const newManagerTrack = document.getElementById('newManagerTrack');
    const managersList = document.getElementById('managersList');
    const managerCount = document.getElementById('managerCount');

    // Learning Tracks UI Elements (only exist on admin.html)
    const tracksList = document.getElementById('tracksList');
    const trackCount = document.getElementById('trackCount');
    const addTrackBtn = document.getElementById('addTrackBtn');
    const newTrackName = document.getElementById('newTrackName');
    const newTrackLink = document.getElementById('newTrackLink');

    // Community page label
    const communityTrackLabel = document.getElementById('communityTrackLabel');

    // Modal UI
    const customModal = document.getElementById('customModal');
    const modalMessage = document.getElementById('modalMessage');
    const modalCloseBtn = document.getElementById('modalCloseBtn');

    let fb = null;
    try {
        fb = await getFirebase();
    } catch (err) {
        console.error('Firebase init error:', err);
    }

    const portalEmail = localStorage.getItem('portal_email');
    let tracksCache = [];

    function showModal(message) {
        if (modalMessage) {
            modalMessage.innerText = message;
            customModal.style.display = 'flex';
        } else {
            alert(message);
        }
    }

    if (modalCloseBtn) {
        modalCloseBtn.addEventListener('click', () => {
            customModal.style.display = 'none';
        });
    }

    // Enforce session: no authorized email stored -> redirect to login
    // AND the Firebase account owning that Gmail must be signed in HERE in this
    // browser. Otherwise anyone who fakes the localStorage email is locked out.
    if (!portalEmail) {
        window.location.href = '/login.html';
        return;
    }

    if (!fb || !fb.auth) {
        localStorage.removeItem('portal_email');
        window.location.href = '/login.html';
        return;
    }

    onAuthStateChanged(fb.auth, (user) => {
        const authorized =
            user &&
            user.emailVerified !== false &&
            user.email &&
            user.email.toLowerCase() === portalEmail.toLowerCase();

        if (authorized) {
            initDashboard();
        } else {
            if (fb.auth.currentUser) {
                signOut(fb.auth).catch(() => {});
            }
            localStorage.removeItem('portal_email');
            localStorage.removeItem('portal_email_for_sign_in');
            window.location.href = '/login.html';
        }
    });

    // Everything below only runs after Firebase confirms the verified owner of
    // the stored Gmail is signed in.
    function initDashboard() {
        if (logoutBtn) {
            logoutBtn.addEventListener('click', () => {
                logoutBtn.disabled = true;
                localStorage.removeItem('portal_email');
                localStorage.removeItem('portal_email_for_sign_in');
                if (fb && fb.auth) {
                    signOut(fb.auth)
                        .catch(() => {})
                        .finally(() => {
                            window.location.href = '/login.html';
                        });
                } else {
                    window.location.href = '/login.html';
                }
            });
        }

        fetchRegistrations(portalEmail);

        if (adminSection) {
            initAdmin();
        }

        if (communityTrackLabel) {
            showCommunityTrack();
        }
    }

    // Load tracks, then managers, then render the manager track dropdowns
    function initAdmin() {
        fetch('/api/tracks', { headers: { 'X-User-Email': portalEmail } })
            .then(res => res.json())
            .then(result => {
                tracksCache = result.data || [];
                renderTrackList();
                populateManagerTrackSelect(newManagerTrack, '');
                return fetch('/api/managers', { headers: { 'X-User-Email': portalEmail } });
            })
            .then(res => res.json())
            .then(result => {
                renderManagers(result.data || []);
            })
            .catch(err => console.error('Error loading admin data:', err));
    }

    // --- Registration table ---
    function fetchRegistrations(userEmail) {
        loadingMessage.style.display = 'block';
        if (errorMessage) errorMessage.style.display = 'none';
        
        fetch('/api/registrations', {
            headers: {
                'X-User-Email': userEmail
            }
        })
        .then(response => {
            if (response.status === 401 || response.status === 403) {
                localStorage.removeItem('portal_email');
                return response.json().then(errData => {
                    throw new Error(errData.error || 'Access Denied');
                });
            }
            if (!response.ok) {
                throw new Error('Network response was not ok');
            }
            return response.json();
        })
        .then(result => {
            const data = result.data;
            loadingMessage.style.display = 'none';

            if (!data || data.length === 0) {
                if(errorMessage) {
                    errorMessage.innerText = "No registrations found.";
                    errorMessage.style.display = 'block';
                }
                return;
            }

            if(tableBody) {
                tableBody.innerHTML = '';
                data.forEach((participant, index) => {
                    const row = document.createElement('tr');
                    
                    const date = new Date(participant.createdAt);
                    const formattedDate = date.toLocaleDateString() + ' ' + date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });

                    row.innerHTML = `
                        <td>${index + 1}</td>
                        <td>${escapeHTML(participant.firstName)}</td>
                        <td>${escapeHTML(participant.lastName)}</td>
                        <td>${escapeHTML(participant.phone)}</td>
                        <td>${escapeHTML(participant.techSkill)}</td>
                        <td>${escapeHTML(participant.email)}</td>
                        <td>${formattedDate}</td>
                    `;
                    tableBody.appendChild(row);
                });
            }
        })
        .catch(error => {
            console.error('Error fetching data:', error);
            loadingMessage.style.display = 'none';
            showModal(error.message || "Failed to load data.");
        });
    }

    // --- Community manager display on the community page ---
    function showCommunityTrack() {
        fetch('/api/auth/role', {
            headers: { 'X-User-Email': portalEmail }
        })
        .then(res => res.json())
        .then(data => {
            if (data.track) {
                communityTrackLabel.innerText = `Viewing members of the ${data.track} community.`;
            } else {
                communityTrackLabel.innerText = 'No track assigned yet. Please contact the admin.';
            }
        })
        .catch(() => {});
    }

    // --- Admin Functions for Community Managers ---
    function renderManagers(managers) {
        if (!managersList) return;
        managersList.innerHTML = '';
        if (managerCount) managerCount.textContent = managers.length;

        managers
            .sort((a, b) => a.email.localeCompare(b.email, undefined, { sensitivity: 'base' }))
            .forEach(manager => {
                const li = document.createElement('li');
                li.className = 'manager-item';
                li.dataset.id = manager.id;
                li.innerHTML = `
                    <div class="manager-info">
                        <span>${escapeHTML(manager.email)}</span>
                        <select class="manager-track-select">${buildTrackOptions(manager.trackName)}</select>
                    </div>
                    <div class="manager-actions">
                        <button class="btn btn-save">Update</button>
                        <button class="btn btn-remove">Remove</button>
                    </div>
                `;
                managersList.appendChild(li);
            });

        managersList.querySelectorAll('.btn-save').forEach((btn, i) => {
            btn.addEventListener('click', () => updateManagerTrack(managers[i].id, managers[i].email));
        });
        managersList.querySelectorAll('.btn-remove').forEach((btn, i) => {
            btn.addEventListener('click', () => removeManager(managers[i].email));
        });
    }

    function buildTrackOptions(current) {
        let html = '<option value="">No track</option>';
        tracksCache.forEach(track => {
            const selected = track.name === current ? ' selected' : '';
            html += `<option value="${escapeHTML(track.name)}"${selected}>${escapeHTML(track.name)}</option>`;
        });
        return html;
    }

    function populateManagerTrackSelect(selectEl, current) {
        if (!selectEl) return;
        selectEl.innerHTML = '<option value="" disabled selected>Select Track</option>';
        tracksCache.forEach(track => {
            const opt = document.createElement('option');
            opt.value = track.name;
            opt.textContent = track.name;
            if (track.name === current) opt.selected = true;
            selectEl.appendChild(opt);
        });
    }

    function updateManagerTrack(id, email) {
        const select = managersList.querySelector(`li[data-id="${id}"] .manager-track-select`);
        const trackName = select.value;
        if (!trackName) return showModal('Select a track for this manager before saving.');

        fetch(`/api/managers/${id}`, {
            method: 'PUT',
            headers: {
                'Content-Type': 'application/json',
                'X-User-Email': portalEmail
            },
            body: JSON.stringify({ trackName })
        })
        .then(res => res.json())
        .then(data => {
            if (data.error) throw new Error(data.error);
            showModal(`Track updated for ${email}!`);
        })
        .catch(err => showModal(err.message));
    }

    function removeManager(email) {
        if (!confirm(`Are you sure you want to remove ${email}?`)) return;

        fetch(`/api/managers/${encodeURIComponent(email)}`, {
            method: 'DELETE',
            headers: {
                'X-User-Email': portalEmail
            }
        })
        .then(res => res.json())
        .then(data => {
            if (data.error) throw new Error(data.error);
            renderManagers(managersList ? getManagersList() : []);
            showModal('Manager removed successfully!');
        })
        .catch(err => showModal(err.message));
    }

    function getManagersList() {
        const items = [...managersList.querySelectorAll('.manager-item')];
        return items.map(li => ({
            id: li.dataset.id,
            email: li.querySelector('span').innerText,
            trackName: li.querySelector('.manager-track-select').value
        }));
    }

    if (addManagerBtn) {
        addManagerBtn.addEventListener('click', () => {
            const email = newManagerEmail.value.trim();
            const trackName = newManagerTrack.value;
            if (!email) return showModal('Please enter an email.');
            if (!trackName) return showModal('Select a track for this manager.');

            fetch('/api/managers', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'X-User-Email': portalEmail
                },
                body: JSON.stringify({ email, trackName })
            })
            .then(res => res.json())
            .then(data => {
                if (data.error) throw new Error(data.error);
                newManagerEmail.value = '';
                newManagerTrack.value = '';
                return fetch('/api/managers', { headers: { 'X-User-Email': portalEmail } });
            })
            .then(res => res.json())
            .then(result => {
                renderManagers(result.data || []);
                showModal('Manager added successfully!');
            })
            .catch(err => showModal(err.message));
        });
    }

    // --- Admin Functions for Learning Tracks ---
    function renderTrackList() {
        if (!tracksList) return;
        tracksList.innerHTML = '';
        if (trackCount) trackCount.textContent = tracksCache.length;

        tracksCache.forEach(track => {
            const li = document.createElement('li');
            li.className = 'track-item';
            li.dataset.id = track.id;
            li.innerHTML = `
                <div class="track-fields">
                    <input type="text" class="track-name-input" value="${escapeHTML(track.name)}">
                    <input type="url" class="track-link-input" value="${escapeHTML(track.whatsappLink)}">
                </div>
                <button class="btn btn-save">Update</button>
                <button class="btn btn-remove">Delete</button>
            `;
            tracksList.appendChild(li);
        });

        tracksList.querySelectorAll('.btn-save').forEach((btn, i) => {
            btn.addEventListener('click', () => updateTrack(tracksCache[i].id, tracksList.querySelectorAll('.track-item')[i]));
        });
        tracksList.querySelectorAll('.btn-remove').forEach((btn, i) => {
            btn.addEventListener('click', () => deleteTrack(tracksCache[i].id));
        });
    }

    function refreshAllAdminData() {
        fetch('/api/tracks', { headers: { 'X-User-Email': portalEmail } })
            .then(res => res.json())
            .then(result => {
                tracksCache = result.data || [];
                renderTrackList();
                populateManagerTrackSelect(newManagerTrack, '');
            })
            .catch(err => console.error(err));
    }

    function updateTrack(id, li) {
        const name = li.querySelector('.track-name-input').value.trim();
        const whatsappLink = li.querySelector('.track-link-input').value.trim();
        if (!name || !whatsappLink) return showModal('Track name and WhatsApp group link are required.');

        fetch(`/api/tracks/${id}`, {
            method: 'PUT',
            headers: {
                'Content-Type': 'application/json',
                'X-User-Email': portalEmail
            },
            body: JSON.stringify({ name, whatsappLink })
        })
        .then(res => res.json())
        .then(data => {
            if (data.error) throw new Error(data.error);
            refreshAllAdminData();
            showModal('Learning track updated successfully!');
        })
        .catch(err => showModal(err.message));
    }

    function deleteTrack(id) {
        if (!confirm('Are you sure you want to delete this learning track?')) return;

        fetch(`/api/tracks/${id}`, {
            method: 'DELETE',
            headers: {
                'X-User-Email': portalEmail
            }
        })
        .then(res => res.json())
        .then(data => {
            if (data.error) throw new Error(data.error);
            refreshAllAdminData();
            showModal('Learning track removed successfully!');
        })
        .catch(err => showModal(err.message));
    }

    if (addTrackBtn) {
        addTrackBtn.addEventListener('click', () => {
            const name = newTrackName.value.trim();
            const whatsappLink = newTrackLink.value.trim();
            if (!name || !whatsappLink) return showModal('Enter a track name and a WhatsApp group link.');

            fetch('/api/tracks', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'X-User-Email': portalEmail
                },
                body: JSON.stringify({ name, whatsappLink })
            })
            .then(res => res.json())
            .then(data => {
                if (data.error) throw new Error(data.error);
                newTrackName.value = '';
                newTrackLink.value = '';
                refreshAllAdminData();
                showModal('Learning track added successfully!');
            })
            .catch(err => showModal(err.message));
        });
    }

    function escapeHTML(str) {
        if (!str) return '';
        const div = document.createElement('div');
        div.innerText = str;
        return div.innerHTML;
    }
});