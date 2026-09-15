import { state } from '../state.js';
import { formatDate, showToast } from '../utils.js';
import { openEventDialog } from './calendar.js';
import { getAccount } from '../auth.js';

export function renderDashboard(container) {
    const todayStr = new Date().toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric' });
    const completedTasks = state.tasks.filter(t => t.completed).length;
    const totalTasks = state.tasks.length;
    const taskPercent = totalTasks ? Math.round((completedTasks / totalTasks) * 100) : 0;
    const firstName = getAccount()?.name?.trim().split(/\s+/)[0] || 'there';
    const pendingShopping = state.shopping.filter(s => !s.purchased).length;
    const savingsGoal = state.goals[0]?.progress ?? 0;
    const upcomingEvents = state.events.slice(0, 3);

    container.innerHTML = `
        <div class="dashboard-shell">
            <div class="premium-card dashboard-hero">
                <div>
                    <h1>Good morning, ${escapeHtml(firstName).toUpperCase()}</h1>
                    <p>${todayStr} • Here's what's happening today.</p>
                </div>
                <div class="dashboard-kpi">
                    <span>Progress</span>
                    <strong>${taskPercent}%</strong>
                </div>
            </div>

            <div class="dashboard-grid">
                <div class="premium-card section-block">
                    <div class="inline-actions">
                        <h3>Today's Tasks</h3>
                        <span class="badge badge-success">${completedTasks}/${totalTasks} done</span>
                    </div>
                    <div class="dashboard-list">
                        ${state.tasks.slice(0, 4).map(t => `
                            <div class="dashboard-item">
                                <div class="dashboard-item-main">
                                    <input type="checkbox" ${t.completed ? 'checked' : ''} disabled>
                                    <span style="${t.completed ? 'text-decoration: line-through; color: var(--color-muted);' : ''}">${escapeHtml(t.title)}</span>
                                </div>
                                <div style="display: flex; align-items: center; gap: 8px;">
                                    <span class="badge ${t.completed ? 'badge-success' : 'badge-warning'}">${t.completed ? 'Done' : 'Open'}</span>
                                    <button class="btn-secondary delete-dash-task" data-id="${t.id}" title="Delete task" aria-label="Delete ${escapeHtml(t.title)}" style="padding: 4px 8px; color: var(--color-danger);"><i class="fa-solid fa-trash"></i></button>
                                </div>
                            </div>
                        `).join('')}
                    </div>
                </div>

                <div class="premium-card section-block">
                    <div class="inline-actions">
                        <h3>Upcoming Events</h3>
                        <span class="badge badge-warning">${state.events.length} total</span>
                    </div>
                    <div class="dashboard-list">
                        ${upcomingEvents.map(e => `
                            <div class="dashboard-item">
                                <div>
                                    <div style="font-weight: 600;">${escapeHtml(e.title)}</div>
                                    <div class="muted-text" style="font-size: 0.75rem; margin-top: 3px;">${escapeHtml(e.location || 'No location')}</div>
                                </div>
                                <div style="display: flex; align-items: center; gap: 8px;">
                                    <span class="badge badge-warning">${escapeHtml(e.time || 'TBD')}</span>
                                    <button class="btn-secondary edit-dash-ev" data-id="${e.id}" style="padding: 4px 8px;"><i class="fa-solid fa-pen"></i></button>
                                    <button class="btn-secondary delete-dash-ev" data-id="${e.id}" style="padding: 4px 8px; color: var(--color-danger);"><i class="fa-solid fa-trash"></i></button>
                                </div>
                            </div>
                        `).join('') || '<div class="muted-text">No upcoming events yet.</div>'}
                    </div>
                </div>
            </div>

            <div class="premium-card section-block">
                <div class="inline-actions">
                    <h3><i class="fa-solid fa-chart-line" style="color: var(--color-primary);"></i> Smart Life Insights</h3>
                </div>
                <div style="display: grid; gap: 14px;">
                    <div>
                        <div class="inline-actions" style="margin-bottom: 6px;">
                            <strong>Checklist completion</strong>
                            <span>${taskPercent}%</span>
                        </div>
                        <div class="metric-meter"><span style="width: ${taskPercent}%"></span></div>
                    </div>
                    <div>
                        <div class="inline-actions" style="margin-bottom: 6px;">
                            <strong>Shopping focus</strong>
                            <span>${pendingShopping} pending</span>
                        </div>
                        <div class="metric-meter"><span style="width: ${Math.min((pendingShopping / Math.max(state.shopping.length || 1, 1)) * 100, 100)}%"></span></div>
                    </div>
                    <div>
                        <div class="inline-actions" style="margin-bottom: 6px;">
                            <strong>Financial goal</strong>
                            <span>${savingsGoal}%</span>
                        </div>
                        <div class="metric-meter"><span style="width: ${Math.min(savingsGoal, 100)}%"></span></div>
                    </div>
                </div>
            </div>
        </div>
    `;

    container.querySelectorAll('.edit-dash-ev').forEach(btn => {
        btn.onclick = () => {
            const ev = state.events.find(x => x.id === Number(btn.getAttribute('data-id')));
            if (ev) openEventDialog(null, ev, () => renderDashboard(container));
        };
    });

    container.querySelectorAll('.delete-dash-ev').forEach(btn => {
        btn.onclick = () => {
            state.deleteEvent(Number(btn.getAttribute('data-id')));
            showToast('Event deleted');
            renderDashboard(container);
        };
    });

    container.querySelectorAll('.delete-dash-task').forEach(btn => {
        btn.onclick = () => {
            state.deleteTask(Number(btn.getAttribute('data-id')));
            showToast('Task deleted');
            renderDashboard(container);
        };
    });
}

function escapeHtml(value) {
    return String(value ?? '').replace(/[&<>'"]/g, character => ({
        '&': '&amp;',
        '<': '&lt;',
        '>': '&gt;',
        "'": '&#39;',
        '"': '&quot;',
    })[character]);
}