document.addEventListener('DOMContentLoaded', function() {
    const loginForm = document.getElementById('managerLoginForm');
    const managerEmail = document.getElementById('managerEmail');
    const authBtn = document.getElementById('authBtn');
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
        const email = managerEmail.value.trim().toLowerCase();

        if (!email.endsWith('@gmail.com')) {
            showModal('Please enter a valid Gmail address.');
            return;
        }

        authBtn.disabled = true;
        loadingMessage.style.display = 'block';

        fetch('/api/auth/role', {
            headers: { 'X-User-Email': email }
        })
        .then(res => res.json())
        .then(data => {
            if (data.role === 'manager') {
                localStorage.setItem('portal_email', email);
                window.location.href = '/community';
            } else {
                loadingMessage.style.display = 'none';
                authBtn.disabled = false;
                showModal('Access Denied: This Gmail is not authorized by the admin.');
            }
        })
        .catch(err => {
            console.error('Role Check Error:', err);
            loadingMessage.style.display = 'none';
            authBtn.disabled = false;
            showModal('An error occurred while verifying your role.');
        });
    });
});