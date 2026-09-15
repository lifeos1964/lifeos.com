import { renderDashboard } from './modules/dashboard.js';
import { renderCalendar } from './modules/calendar.js';
import { renderTasks } from './modules/tasks.js';
import { renderShopping } from './modules/shopping.js';
import { renderMoney } from './modules/money.js';
import { renderHome } from './modules/home.js';
import { renderFamily } from './modules/family.js';
import { renderGoals } from './modules/goals.js';
import { renderNotes } from './modules/notes.js';
import { renderAI } from './modules/ai.js';
import { renderSocial } from './modules/social.js';
import { renderWellness } from './modules/wellness.js';
import { renderTravel } from './modules/travel.js';
import { getAccount } from './auth.js';
import { localizePageContent } from './i18n.js';

const routes = {
    'dashboard': renderDashboard,
    'calendar': renderCalendar,
    'tasks': renderTasks,
    'shopping': renderShopping,
    'money': renderMoney,
    'home': renderHome,
    'wellness': renderWellness,
    'travel': renderTravel,
    'family': renderFamily,
    'goals': renderGoals,
    'notes': renderNotes,
    'ai': renderAI,
    'social': renderSocial
};

export function router() {
    const hash = window.location.hash.slice(2) || 'dashboard';
    const mainContent = document.getElementById('main-content');

    if (!mainContent) return;
    
    const account = getAccount();
    const familyActivities = account?.familyActivities;

    // Update active nav links and hide unshared activities
    document.querySelectorAll('.nav-item, .mobile-nav-item').forEach(el => {
        const route = el.getAttribute('data-route');
        if (!route) return; // e.g. for the mobile menu button

        if (route === hash) {
            el.classList.add('active');
        } else {
            el.classList.remove('active');
        }

        if (Array.isArray(familyActivities)) {
            const requiredActivity = route === 'calendar' ? 'calendar' : route;
            if (requiredActivity !== 'dashboard' && !familyActivities.includes(requiredActivity)) {
                el.style.display = 'none';
            } else {
                el.style.display = '';
            }
        } else {
            el.style.display = '';
        }
    });

    const routeActivity = hash === 'calendar' ? 'calendar' : hash;
    if (Array.isArray(familyActivities) && routeActivity !== 'dashboard' && !familyActivities.includes(routeActivity)) {
        mainContent.innerHTML = '<div class="empty-state"><h2>Activity not shared</h2><p>This family member does not have access to this activity.</p></div>';
        return;
    }

    const renderFn = routes[hash] || renderDashboard;
    mainContent.innerHTML = '';
    renderFn(mainContent);
    localizePageContent(mainContent);
}

window.addEventListener('lifeos:language-changed', router);
window.addEventListener('lifeos:permissions-changed', router);
window.addEventListener('lifeos:state-updated', router);