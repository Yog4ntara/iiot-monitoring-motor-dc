// public/js/darkMode.js

/**
 * Dark Mode Manager
 * Mengelola toggle dark mode, menyimpan preferensi user, dan mengaplikasikan theme
 */

class DarkModeManager {
    constructor() {
        this.darkModeToggle = document.getElementById('dark-mode-toggle');
        this.darkModeIcon = document.getElementById('dark-mode-icon');
        this.body = document.body;
        this.storageKey = 'dashboard-dark-mode';
        
        // Initialize dark mode on page load
        this.init();
    }

    /**
     * Initialize dark mode berdasarkan preferensi yang tersimpan atau sistem
     */
    init() {
        // Check for saved theme preference or default to auto
        const savedTheme = localStorage.getItem(this.storageKey);
        
        if (savedTheme) {
            // User pernah set manual preference
            this.applyTheme(savedTheme);
        } else {
            // Auto detect dari sistem
            const prefersDark = window.matchMedia('(prefers-color-scheme: dark)').matches;
            this.applyTheme(prefersDark ? 'dark' : 'light', false); // false = don't save to localStorage yet
        }

        // Setup event listeners
        this.setupEventListeners();
        
        // Listen untuk perubahan sistem theme
        this.watchSystemTheme();
    }

    /**
     * Setup event listeners untuk toggle button dan keyboard shortcuts
     */
    setupEventListeners() {
        // Toggle button click
        if (this.darkModeToggle) {
            this.darkModeToggle.addEventListener('click', () => {
                this.toggleTheme();
            });
        }

        // Keyboard shortcut: Ctrl/Cmd + Shift + D
        document.addEventListener('keydown', (e) => {
            if ((e.ctrlKey || e.metaKey) && e.shiftKey && e.key === 'D') {
                e.preventDefault();
                this.toggleTheme();
            }
        });
    }

    /**
     * Watch untuk perubahan sistem theme (auto dark mode)
     */
    watchSystemTheme() {
        const mediaQuery = window.matchMedia('(prefers-color-scheme: dark)');
        mediaQuery.addEventListener('change', (e) => {
            // Hanya apply auto theme jika user belum set manual preference
            if (!localStorage.getItem(this.storageKey)) {
                this.applyTheme(e.matches ? 'dark' : 'light', false);
            }
        });
    }

    /**
     * Toggle antara light dan dark mode
     */
    toggleTheme() {
        const currentTheme = this.getCurrentTheme();
        const newTheme = currentTheme === 'dark' ? 'light' : 'dark';
        this.applyTheme(newTheme, true);
    }

    /**
     * Apply theme ke halaman
     * @param {string} theme - 'light' atau 'dark'
     * @param {boolean} saveToStorage - apakah save ke localStorage
     */
    applyTheme(theme, saveToStorage = true) {
        // Remove existing theme classes
        this.body.classList.remove('light-mode', 'dark-mode');
        
        // Add new theme class
        this.body.classList.add(theme === 'dark' ? 'dark-mode' : 'light-mode');
        
        // Update icon
        this.updateIcon(theme);
        
        // Save preference jika diminta
        if (saveToStorage) {
            localStorage.setItem(this.storageKey, theme);
        }        // Dispatch custom event untuk komponen lain yang mungkin perlu tahu
        window.dispatchEvent(new CustomEvent('themeChanged', {
            detail: { theme }
        }));
        
        // Update chart themes jika ada
        this.updateChartThemes(theme);
        
        // Force update modal styling jika sedang terbuka
        this.updateOpenModals();
    }

    /**
     * Update icon toggle button berdasarkan theme
     * @param {string} theme - current theme
     */
    updateIcon(theme) {
        if (this.darkModeIcon) {
            this.darkModeIcon.textContent = theme === 'dark' ? '☀️' : '🌙';
            this.darkModeToggle.title = theme === 'dark' ? 'Switch to Light Mode' : 'Switch to Dark Mode';
        }
    }    /**
     * Get current theme
     * @returns {string} 'light' atau 'dark'
     */
    getCurrentTheme() {
        return this.body.classList.contains('dark-mode') ? 'dark' : 'light';
    }

    /**
     * Update Chart.js themes untuk konsistensi dengan dark mode
     * @param {string} theme - current theme
     */
    updateChartThemes(theme) {
        // Trigger custom event yang akan dihandle oleh uiHandler.js
        // Ini lebih baik daripada langsung manipulasi Chart.js di sini
        window.dispatchEvent(new CustomEvent('themeChanged', {
            detail: { theme }
        }));
    }

    /**
     * Force update styling untuk modal yang sedang terbuka
     * Ini memastikan modal langsung update saat theme berubah
     */
    updateOpenModals() {
        const openModals = document.querySelectorAll('.modal[style*="display: flex"], .modal[style*="display: block"]');
        openModals.forEach(modal => {
            // Force reflow untuk memastikan CSS variables diterapkan ulang
            modal.style.display = modal.style.display;
            
            const modalContent = modal.querySelector('.modal-content');
            if (modalContent) {
                // Trigger reflow untuk modal content
                modalContent.offsetHeight; // Trigger reflow
            }
        });
        
        // Update gemini modal khususnya jika terbuka
        const geminiModal = document.getElementById('gemini-analysis-modal');
        if (geminiModal && (geminiModal.style.display === 'flex' || geminiModal.style.display === 'block')) {
            // Force reflow
            geminiModal.offsetHeight;
            const geminiContent = geminiModal.querySelector('.modal-content');
            if (geminiContent) {
                geminiContent.offsetHeight;
            }
        }
    }

    /**
     * Get theme preference untuk debugging
     * @returns {object} info tentang theme saat ini
     */
    getThemeInfo() {
        return {
            current: this.getCurrentTheme(),
            saved: localStorage.getItem(this.storageKey),
            systemPreference: window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light'
        };
    }

    /**
     * Reset theme preference ke auto (mengikuti sistem)
     */
    resetToAuto() {
        localStorage.removeItem(this.storageKey);
        const prefersDark = window.matchMedia('(prefers-color-scheme: dark)').matches;
        this.applyTheme(prefersDark ? 'dark' : 'light', false);
        
        // Show notification
        if (typeof showUINotification === 'function') {
            showUINotification('Theme di-reset ke preferensi sistem', 'info');
        }
    }
}

// Initialize dark mode manager saat DOM ready
document.addEventListener('DOMContentLoaded', () => {
    window.darkModeManager = new DarkModeManager();
});

// Expose untuk debugging di console
window.getDarkModeInfo = () => window.darkModeManager?.getThemeInfo();
window.resetThemeToAuto = () => window.darkModeManager?.resetToAuto();
