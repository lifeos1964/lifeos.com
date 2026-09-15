import { router } from './router.js';
import { state } from './state.js';
import { initReminders } from './reminders.js';
import { initCurrencySelector } from './currency.js';
import { applyAccent, getAccent, initAccentSelector } from './theme.js';
import { initAuth, openProfileDialog } from './auth.js';
import { initLanguageSelector, t } from './i18n.js';
import { initPlans } from './plans.js';
import { checkSupabaseConnection, supabaseConfigured, supabase } from './supabase.js';
import { hydrateStateFromSupabase, syncCurrentState } from './supabase-sync.js';

if (window.Capacitor?.isNativePlatform?.()) {
    import('@capacitor/app').then(({ App }) => {
        App.addListener('appUrlOpen', event => {
            const url = new URL(event.url);
            if (url.hash && url.hash.includes('access_token=')) {
                window.location.hash = url.hash;
            }
        });
    }).catch(error => {
        console.warn('Native deep-link support is unavailable:', error);
    });
}

window.addEventListener('DOMContentLoaded', () => {
    // Theme Management
    const themeToggleBtn = document.getElementById('theme-toggle');
    const htmlElement = document.documentElement;
    const savedTheme = localStorage.getItem('lifeos_theme') || 'light';
    htmlElement.setAttribute('data-theme', savedTheme);
    initLanguageSelector();
    updateThemeButtonText(savedTheme);
    initAccentSelector();
    const profileButton = document.getElementById('profile-button');
    if (profileButton) profileButton.onclick = openProfileDialog;

    themeToggleBtn.onclick = () => {
        const currentTheme = htmlElement.getAttribute('data-theme');
        const newTheme = currentTheme === 'dark' ? 'light' : 'dark';
        htmlElement.setAttribute('data-theme', newTheme);
        localStorage.setItem('lifeos_theme', newTheme);
        applyAccent(getAccent());
        updateThemeButtonText(newTheme);
    };

    function updateThemeButtonText(theme) {
        themeToggleBtn.innerHTML = theme === 'dark' ? `<i class="fa-solid fa-sun"></i> <span>${t('lightMode')}</span>` : `<i class="fa-solid fa-moon"></i> <span>${t('darkMode')}</span>`;
    }

    // Account, currency, and app startup
    initAuth(() => {
        window.__lifeos_appState = state;
        initCurrencySelector();
        initPlans();
        window.addEventListener('hashchange', router);
        checkSupabaseConnection().then(async result => {
            if (!result.connected && result.reason !== 'missing-config') {
                console.warn('Supabase connection failed:', result.reason);
            }
            if (!supabaseConfigured) {
                console.info('Supabase is not fully configured. LifeOS is using local storage.');
            }
            if (result.connected) {
                const syncResult = await hydrateStateFromSupabase(state);
                if (!syncResult.synced) console.warn('LifeOS data restore failed:', syncResult.reason);
                if (syncResult.synced && !syncResult.restored) await syncCurrentState(state);
            }
            initReminders();
            router();
        });
    });

    // Global Search Live Filtering
    const searchInput = document.getElementById('global-search-input');
    const searchDropdown = document.getElementById('search-results-dropdown');

    if (!searchInput || !searchDropdown) return;

    searchInput.oninput = (e) => {
        const query = e.target.value.toLowerCase().trim();
        if (!query) {
            searchDropdown.classList.add('hidden');
            searchDropdown.innerHTML = '';
            return;
        }

        const taskMatches = state.tasks.filter(t => t.title.toLowerCase().includes(query));
        const noteMatches = state.notes.filter(n => n.title.toLowerCase().includes(query));

        let html = '';
        taskMatches.forEach(t => {
            html += `<div class="search-result-item" onclick="window.location.hash='#/tasks'">Task: ${t.title}</div>`;
        });
        noteMatches.forEach(n => {
            html += `<div class="search-result-item" onclick="window.location.hash='#/notes'">Note: ${n.title}</div>`;
        });

        if (!html) {
            html = `<div class="search-result-item" style="color: var(--color-muted);">No matches found</div>`;
        }

        searchDropdown.innerHTML = html;
        searchDropdown.classList.remove('hidden');
    };

    document.addEventListener('click', (e) => {
        if (!searchInput.contains(e.target) && !searchDropdown.contains(e.target)) {
            searchDropdown.classList.add('hidden');
        }
    });

    // Mobile Sidebar Toggle
    const mobileMenuBtn = document.getElementById('mobile-menu-btn');
    const sidebar = document.getElementById('sidebar');

    if (mobileMenuBtn && sidebar) {
        mobileMenuBtn.addEventListener('click', (e) => {
            e.stopPropagation();
            sidebar.classList.toggle('open');
            mobileMenuBtn.classList.toggle('active');
        });

        document.addEventListener('click', (e) => {
            if (sidebar.classList.contains('open')) {
                // If clicked outside the sidebar or on a nav link inside the sidebar
                if (!sidebar.contains(e.target) || e.target.closest('.nav-item')) {
                    sidebar.classList.remove('open');
                    mobileMenuBtn.classList.remove('active');
                }
            }
        });
    }
});