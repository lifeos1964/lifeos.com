import { state } from '../state.js';
import { formatCurrency, formatDate, showToast } from '../utils.js';
import { openHistoricalStatement } from '../history.js';

function escapeHtml(value = '') {
    return String(value)
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;')
        .replace(/'/g, '&#039;');
}

function getCountdownLabel(targetDate) {
    if (!targetDate) return 'No date set';
    const today = new Date();
    const tripDate = new Date(targetDate);
    const diffMs = tripDate.getTime() - today.setHours(0, 0, 0, 0);
    const diffDays = Math.ceil(diffMs / (1000 * 60 * 60 * 24));

    if (diffDays < 0) return `${Math.abs(diffDays)} day${Math.abs(diffDays) === 1 ? '' : 's'} since trip`;
    if (diffDays === 0) return 'Trip is today';
    return `${diffDays} day${diffDays === 1 ? '' : 's'} left`;
}

export function renderTravel(container) {
    const items = state.travel || [];
    const totalBudget = items.reduce((sum, trip) => sum + (Number(trip.budget) || 0), 0);
    const totalSaved = items.reduce((sum, trip) => sum + (Number(trip.saved) || 0), 0);
    const upcomingTrips = items.filter(trip => !trip.visited).sort((a, b) => new Date(a.targetDate || 0) - new Date(b.targetDate || 0));

    container.innerHTML = `
        <div class="page-shell">
            <div class="page-header">
                <div>
                    <h2>Travel Bucket List</h2>
                    <p class="page-subtitle">Places to visit, trips to plan, savings for travel, and your countdown checklist.</p>
                </div>
                <button class="btn-secondary" id="travel-history-btn"><i class="fa-solid fa-clock-rotate-left"></i> History</button>
            </div>

            <form id="travel-form" class="premium-card travel-form">
                <label class="field-block">
                    <span>Trip name</span>
                    <input id="travel-title" class="form-control" type="text" required placeholder="Bali escape" />
                </label>
                <label class="field-block">
                    <span>Destination</span>
                    <input id="travel-destination" class="form-control" type="text" required placeholder="Ubud, Indonesia" />
                </label>
                <label class="field-block">
                    <span>Target date</span>
                    <input id="travel-date" class="form-control" type="date" />
                </label>
                <label class="field-block">
                    <span>Finished date <small>(optional)</small></span>
                    <input id="travel-finished-date" class="form-control" type="date" />
                </label>
                <label class="field-block">
                    <span>Budget</span>
                    <input id="travel-budget" class="form-control" type="number" min="0" step="0.01" value="0" />
                </label>
                <label class="field-block">
                    <span>Saved so far</span>
                    <input id="travel-saved" class="form-control" type="number" min="0" step="0.01" value="0" />
                </label>
                <label class="field-block full-span">
                    <span>Notes</span>
                    <textarea id="travel-notes" class="form-control" rows="2" placeholder="Food, activities, or ideas for the trip"></textarea>
                </label>
                <div class="full-span inline-actions" style="justify-content: flex-end;">
                    <button type="submit" class="btn-primary"><i class="fa-solid fa-plus"></i> Add trip</button>
                </div>
            </form>

            <div class="stats-grid">
                <div class="stat-card premium-card">
                    <p>Trips planned</p>
                    <h3>${items.length}</h3>
                </div>
                <div class="stat-card premium-card">
                    <p>Budget goal</p>
                    <h3 style="color: var(--color-warning);">${formatCurrency(totalBudget)}</h3>
                </div>
                <div class="stat-card premium-card">
                    <p>Saved</p>
                    <h3 style="color: var(--color-success);">${formatCurrency(totalSaved)}</h3>
                </div>
                <div class="stat-card premium-card">
                    <p>Next trip</p>
                    <h3>${upcomingTrips[0] ? upcomingTrips[0].title : 'No upcoming trip'}</h3>
                </div>
            </div>

            <div style="display: grid; gap: 16px;">
                ${items.length ? items.map(trip => {
                    const checklistItems = trip.checklist || [];
                    const completedCount = checklistItems.filter(item => item.done).length;
                    const checklist = checklistItems.map((item, index) => `
                        <div class="travel-checklist-row">
                            <label>
                                <input type="checkbox" class="travel-checklist-toggle" data-id="${trip.id}" data-index="${index}" ${item.done ? 'checked' : ''}>
                                <span style="text-decoration: ${item.done ? 'line-through' : 'none'}; color: ${item.done ? 'var(--color-muted)' : 'var(--color-text)'};">${escapeHtml(item.text)}</span>
                            </label>
                            <button class="btn-secondary remove-travel-checklist" data-id="${trip.id}" data-index="${index}" style="padding: 7px 10px; color: var(--color-danger); flex-shrink: 0;"><i class="fa-solid fa-xmark"></i></button>
                        </div>
                    `).join('') || '<div class="muted-text">No checklist items yet.</div>';

                    return `
                        <article class="premium-card travel-card">
                            <div class="travel-card-header">
                                <div>
                                    <span class="pill">${escapeHtml(trip.category || 'Travel')}</span>
                                    <h3 style="margin: 10px 0 0; font-size: 24px;">${escapeHtml(trip.title)}</h3>
                                    <p class="page-subtitle" style="margin-top: 6px;">${escapeHtml(trip.destination || 'Destination not set')}</p>
                                </div>
                                <div style="display: flex; gap: 8px; flex-wrap: wrap;">
                                    <button class="btn-secondary mark-travel" data-id="${trip.id}" style="padding: 8px 12px;">
                                        ${trip.visited ? 'Visited' : 'Mark visited'}
                                    </button>
                                    <button class="btn-secondary delete-travel" data-id="${trip.id}" style="padding: 8px 12px; color: var(--color-danger);">
                                        <i class="fa-solid fa-trash"></i>
                                    </button>
                                </div>
                            </div>

                            <div class="travel-meta">
                                <div><strong>Target:</strong> ${trip.targetDate ? formatDate(trip.targetDate) : 'Not set'}</div>
                                <div><strong>Finished:</strong> ${trip.finishedDate ? formatDate(trip.finishedDate) : 'Not finished'}</div>
                                <div><strong>Budget:</strong> ${formatCurrency(trip.budget || 0)}</div>
                                <div><strong>Saved:</strong> ${formatCurrency(trip.saved || 0)}</div>
                                <div><strong>Countdown:</strong> ${getCountdownLabel(trip.targetDate)}</div>
                            </div>

                            ${trip.notes ? `<p class="muted-text" style="margin: 0;">${escapeHtml(trip.notes)}</p>` : ''}

                            <div style="display: grid; gap: 12px;">
                                <div style="display: flex; justify-content: space-between; align-items: center; gap: 12px; flex-wrap: wrap;">
                                    <h4 style="margin: 0;">Trip checklist</h4>
                                    <span class="muted-text" style="font-size: 0.8rem;">${completedCount}/${checklistItems.length || 0} done</span>
                                </div>
                                <div style="display: grid; gap: 10px;">${checklist}</div>
                                <form class="travel-checklist-form" data-id="${trip.id}">
                                    <input type="text" class="form-control travel-checklist-input" data-id="${trip.id}" placeholder="Add checklist item" />
                                    <button type="submit" class="btn-primary">Add</button>
                                </form>
                            </div>
                        </article>
                    `;
                }).join('') : `<div class="empty-state">No travel plans yet. Add your first destination or bucket-list idea.</div>`}
            </div>
        </div>
    `;

    const form = container.querySelector('#travel-form');
    container.querySelector('#travel-history-btn').onclick = () => openHistoricalStatement({
        title: 'Travel statement',
        description: 'Review planned and completed trips for a selected period.',
        records: items,
        getRecordDate: trip => trip.finishedDate || trip.targetDate,
        getColumns: () => ['Date', 'Trip', 'Destination', 'Status', 'Budget'],
        getRow: trip => [new Date(trip.finishedDate || trip.targetDate).toLocaleDateString(), trip.title, trip.destination, trip.visited ? 'Finished' : 'Planned', formatCurrency(trip.budget || 0)],
        getSummary: selected => `<strong>${selected.length}</strong> trip${selected.length === 1 ? '' : 's'} in this period.`
    });
    form.onsubmit = (event) => {
        event.preventDefault();
        const title = container.querySelector('#travel-title').value.trim();
        const destination = container.querySelector('#travel-destination').value.trim();
        const targetDate = container.querySelector('#travel-date').value;
        const finishedDate = container.querySelector('#travel-finished-date').value;
        const budget = Number(container.querySelector('#travel-budget').value || 0);
        const saved = Number(container.querySelector('#travel-saved').value || 0);
        const notes = container.querySelector('#travel-notes').value.trim();

        if (!title || !destination) return;

        state.addTravelItem({
            title,
            destination,
            targetDate,
            finishedDate,
            budget,
            saved,
            notes,
            category: 'Bucket list',
            visited: Boolean(finishedDate),
            checklist: []
        });

        showToast('Travel plan added!');
        renderTravel(container);
    };

    container.querySelectorAll('.delete-travel').forEach(button => {
        button.onclick = () => {
            state.deleteTravelItem(Number(button.dataset.id));
            renderTravel(container);
        };
    });

    container.querySelectorAll('.mark-travel').forEach(button => {
        button.onclick = () => {
            state.toggleTravelVisited(Number(button.dataset.id));
            renderTravel(container);
        };
    });

    container.querySelectorAll('.travel-checklist-toggle').forEach(input => {
        input.onchange = () => {
            state.updateTravelChecklist(Number(input.dataset.id), Number(input.dataset.index), input.checked);
            renderTravel(container);
        };
    });

    container.querySelectorAll('.remove-travel-checklist').forEach(button => {
        button.onclick = () => {
            state.removeTravelChecklistItem(Number(button.dataset.id), Number(button.dataset.index));
            renderTravel(container);
        };
    });

    container.querySelectorAll('.travel-checklist-form').forEach(formEl => {
        formEl.onsubmit = (event) => {
            event.preventDefault();
            const id = Number(formEl.dataset.id);
            const input = formEl.querySelector('.travel-checklist-input');
            if (!input) return;
            state.addTravelChecklistItem(id, input.value);
            renderTravel(container);
        };
    });
}
