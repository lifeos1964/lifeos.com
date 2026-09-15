import { state } from '../state.js';
import { showToast } from '../utils.js';

export function renderGoals(container) {
    const completedGoals = state.goals.filter(goal => Number(goal.progress) >= 100).length;

    container.innerHTML = `
        <div class="goals-shell">
            <div class="premium-card dashboard-hero">
                <div>
                    <h2>Personal Goals & Milestones</h2>
                    <p>Turn meaningful intentions into visible progress.</p>
                </div>
                <div class="dashboard-kpi">
                    <span>Completed</span>
                    <strong>${completedGoals}/${state.goals.length}</strong>
                </div>
                <div class="full-span" style="display: flex; justify-content: flex-end;">
                <button class="btn-primary" id="add-goal-btn"><i class="fa-solid fa-plus"></i> Add Goal</button>
                </div>
            </div>

            <div style="display: grid; gap: 14px;">
                ${state.goals.map(g => `
                    <div class="premium-card goal-card" data-id="${g.id}">
                        <div class="goal-card-header">
                            <h3>${escapeHtml(g.title)}</h3>
                            <span class="badge badge-success goal-progress-label">${g.progress}% Complete</span>
                        </div>
                        <div class="goal-progress-meter">
                            <span class="goal-progress-bar" style="width: ${Math.min(100, Math.max(0, Number(g.progress) || 0))}%"></span>
                        </div>
                        <div class="goal-card-footer">
                            <span>Category: ${escapeHtml(g.category || 'Personal')}</span>
                            <div class="goal-actions">
                                <label class="goal-progress-control">Progress
                                    <input class="goal-progress-range" type="range" min="0" max="100" value="${g.progress}" aria-label="${g.title} progress">
                                    <input class="goal-progress-number" type="number" min="0" max="100" value="${g.progress}" aria-label="${g.title} progress percentage">%
                                </label>
                                <button class="btn-secondary delete-goal" data-id="${g.id}" style="color: var(--color-danger); padding: 4px 8px;" title="Delete goal" aria-label="Delete ${escapeHtml(g.title)}"><i class="fa-solid fa-trash"></i></button>
                            </div>
                        </div>
                    </div>
                `).join('') || '<div class="empty-state">No goals yet. Add one to start tracking meaningful progress.</div>'}
            </div>
        </div>
    `;

    container.querySelector('#add-goal-btn').onclick = () => {
        openGoalDialog(container);
    };

    container.querySelectorAll('.delete-goal').forEach(btn => {
        btn.onclick = () => {
            state.deleteGoal(Number(btn.getAttribute('data-id')));
            showToast('Goal deleted');
            renderGoals(container);
        };
    });

    container.querySelectorAll('.goal-card').forEach(card => {
        const id = Number(card.dataset.id);
        const range = card.querySelector('.goal-progress-range');
        const number = card.querySelector('.goal-progress-number');
        const label = card.querySelector('.goal-progress-label');
        const bar = card.querySelector('.goal-progress-bar');

        const updateProgress = value => {
            const progress = Math.min(100, Math.max(0, Number(value) || 0));
            range.value = progress;
            number.value = progress;
            label.textContent = `${progress}% Complete`;
            bar.style.width = `${progress}%`;
            state.updateGoal(id, { progress, current: progress });
        };

        range.oninput = () => {
            const progress = Number(range.value);
            number.value = progress;
            label.textContent = `${progress}% Complete`;
            bar.style.width = `${progress}%`;
        };
        range.onchange = () => updateProgress(range.value);
        number.onchange = () => updateProgress(number.value);
    });
}

function openGoalDialog(container) {
    const overlay = document.createElement('div');
    overlay.className = 'modal-overlay';
    overlay.innerHTML = `
        <div class="modal-card">
            <div class="modal-header">
                <h3>Add Goal</h3>
                <button class="close-modal-btn" title="Close" aria-label="Close"><i class="fa-solid fa-xmark"></i></button>
            </div>
            <div class="modal-body">
                <form id="goal-form">
                    <div class="form-group"><label for="goal-title">Goal title</label><input id="goal-title" class="form-control" type="text" required placeholder="Build a consistent morning routine"></div>
                    <div class="form-group"><label for="goal-category">Category</label><input id="goal-category" class="form-control" type="text" value="Personal" required></div>
                    <div style="display: flex; justify-content: flex-end; gap: 10px; margin-top: 20px;"><button type="button" class="btn-secondary" id="cancel-goal-btn">Cancel</button><button type="submit" class="btn-primary">Save Goal</button></div>
                </form>
            </div>
        </div>
    `;
    document.body.appendChild(overlay);

    const close = () => overlay.remove();
    overlay.querySelector('.close-modal-btn').onclick = close;
    overlay.querySelector('#cancel-goal-btn').onclick = close;
    overlay.onclick = event => { if (event.target === overlay) close(); };
    overlay.querySelector('#goal-form').onsubmit = event => {
        event.preventDefault();
        const title = overlay.querySelector('#goal-title').value.trim();
        const category = overlay.querySelector('#goal-category').value.trim() || 'Personal';
        if (!title) return;
        state.addGoal({ title, target: 100, current: 0, category, progress: 0 });
        showToast('Goal added successfully!');
        close();
        renderGoals(container);
    };
}

function escapeHtml(value) {
    return String(value ?? '').replace(/[&<>'"]/g, character => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', "'": '&#39;', '"': '&quot;' })[character]);
}