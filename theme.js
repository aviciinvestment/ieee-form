// Theme system: toggles dark/light mode and persists the choice.
(function () {
    function currentTheme() {
        return document.documentElement.getAttribute('data-theme') || 'light';
    }

    function createToggle() {
        const btn = document.createElement('button');
        btn.type = 'button';
        btn.id = 'themeToggle';
        btn.className = 'theme-toggle';
        btn.setAttribute('aria-label', 'Toggle dark mode');

        function setIcon() {
            btn.innerHTML = currentTheme() === 'dark'
                ? "<i class='bx bx-sun'></i>"
                : "<i class='bx bx-moon'></i>";
        }

        setIcon();

        btn.addEventListener('click', function () {
            const next = currentTheme() === 'dark' ? 'light' : 'dark';
            document.documentElement.setAttribute('data-theme', next);
            try {
                localStorage.setItem('theme', next);
            } catch (e) { /* storage unavailable */ }
            setIcon();
        });

        document.body.appendChild(btn);
    }

    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', createToggle);
    } else {
        createToggle();
    }
})();