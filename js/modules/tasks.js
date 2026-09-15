import { state } from '../state.js';
import { showToast } from '../utils.js';
import { getContactPhone } from '../auth.js';

export function renderTasks(container) {
    const completedTasks = state.tasks.filter(task => task.completed).length;
    const totalTasks = state.tasks.length;
    const taskPercent = totalTasks ? Math.round((completedTasks / totalTasks) * 100) : 0;

    container.innerHTML = `
        <div class="tasks-shell">
            <div class="premium-card tasks-summary">
                <div>
                    <h2>Task Management</h2>
                    <p>Keep today focused and make steady progress on what matters.</p>
                </div>
                <div class="tasks-progress">
                    <div class="tasks-progress-label"><span>${completedTasks} of ${totalTasks} complete</span><strong>${taskPercent}%</strong></div>
                    <div class="metric-meter"><span style="width: ${taskPercent}%"></span></div>
                </div>
                <div class="full-span" style="display: flex; justify-content: flex-end;">
                <button class="btn-primary" id="add-task-btn"><i class="fa-solid fa-plus"></i> Add Task</button>
                </div>
            </div>

            <div class="premium-card section-block">
                <div class="task-list">
                    ${state.tasks.map(t => `
                        <div class="task-row">
                            <div class="task-row-main">
                                <input type="checkbox" class="toggle-task" data-id="${t.id}" ${t.completed ? 'checked' : ''} aria-label="Mark ${escapeHtml(t.title)} complete">
                                <div class="task-title-line">
                                    <span style="${t.completed ? 'text-decoration: line-through; color: var(--color-muted);' : 'font-weight: 500;'}">${escapeHtml(t.title)}</span>
                                    <small class="task-due-date"><i class="fa-solid fa-calendar-day"></i> ${formatTaskDate(t.dueDate)}</small>
                                </div>
                            </div>
                            <div class="task-row-actions">
                                <span class="badge ${t.completed ? 'badge-success' : 'badge-warning'}">${escapeHtml(t.category)}</span>
                                ${t.contactPhone ? `<a class="call-action" href="tel:${encodeURIComponent(t.contactPhone)}" title="Call task contact" aria-label="Call task contact"><i class="fa-solid fa-phone"></i></a>` : ''}
                                <button class="btn-secondary edit-task" data-id="${t.id}" title="Edit task" aria-label="Edit ${escapeHtml(t.title)}" style="padding: 4px 8px;"><i class="fa-solid fa-pen"></i></button>
                                <button class="btn-secondary delete-task" data-id="${t.id}" style="color: var(--color-danger); padding: 4px 8px;"><i class="fa-solid fa-trash"></i></button>
                            </div>
                        </div>
                    `).join('') || '<div class="empty-state">No tasks yet. Add your first task to get started.</div>'}
                </div>
            </div>
        </div>
    `;

    container.querySelector('#add-task-btn').onclick = () => openTaskDialog(container);

    container.querySelectorAll('.edit-task').forEach(btn => {
        btn.onclick = () => {
            const task = state.tasks.find(item => item.id === Number(btn.dataset.id));
            if (task) openTaskDialog(container, task);
        };
    });

    container.querySelectorAll('.toggle-task').forEach(box => {
        box.onchange = () => {
            state.toggleTask(Number(box.getAttribute('data-id')));
            showToast('Task status updated');
            renderTasks(container);
        };
    });

    container.querySelectorAll('.delete-task').forEach(btn => {
        btn.onclick = () => {
            state.deleteTask(Number(btn.getAttribute('data-id')));
            showToast('Task deleted');
            renderTasks(container);
        };
    });
}

function openTaskDialog(container, existingTask) {
    const isEdit = Boolean(existingTask);
    const overlay = document.createElement('div');
    overlay.className = 'modal-overlay';
    overlay.innerHTML = `
        <div class="modal-card">
            <div class="modal-header">
                <h3>${isEdit ? 'Edit Task' : 'Add Task'}</h3>
                <button class="close-modal-btn" title="Close" aria-label="Close"><i class="fa-solid fa-xmark"></i></button>
            </div>
            <div class="modal-body">
                <form id="task-form">
                    <div class="form-group"><label for="task-title">Task Name</label><input id="task-title" class="form-control" type="text" required></div>
                    <div class="form-group"><label for="task-date">Date to complete</label><input id="task-date" class="form-control" type="date" required></div>
                    <div class="form-group"><label for="task-category">Category</label><input id="task-category" class="form-control" type="text" required></div>
                    <div class="form-group"><label for="task-priority">Priority</label><select id="task-priority" class="form-control"><option>Low</option><option>Medium</option><option>High</option></select></div>
                    <div class="form-group"><label for="task-phone">Contact phone (optional)</label><input id="task-phone" class="form-control" type="tel" placeholder="+971 50 123 4567"></div>
                    <div style="display: flex; justify-content: flex-end; gap: 10px; margin-top: 20px;"><button type="button" class="btn-secondary" id="cancel-task-btn">Cancel</button><button type="submit" class="btn-primary">${isEdit ? 'Save Changes' : 'Save Task'}</button></div>
                </form>
            </div>
        </div>
    `;
    document.body.appendChild(overlay);
    overlay.querySelector('#task-title').value = existingTask?.title || '';
    overlay.querySelector('#task-date').value = existingTask?.dueDate || new Date().toISOString().slice(0, 10);
    overlay.querySelector('#task-category').value = existingTask?.category || 'Personal';
    overlay.querySelector('#task-priority').value = existingTask?.priority || 'Medium';
    overlay.querySelector('#task-phone').value = existingTask?.contactPhone || getContactPhone();

    const close = () => overlay.remove();
    overlay.querySelector('.close-modal-btn').onclick = close;
    overlay.querySelector('#cancel-task-btn').onclick = close;
    overlay.onclick = event => { if (event.target === overlay) close(); };
    overlay.querySelector('#task-form').onsubmit = event => {
        event.preventDefault();
        const changes = {
            title: overlay.querySelector('#task-title').value.trim(),
            dueDate: overlay.querySelector('#task-date').value,
            category: overlay.querySelector('#task-category').value.trim() || 'Personal',
            priority: overlay.querySelector('#task-priority').value,
            contactPhone: overlay.querySelector('#task-phone').value.trim(),
        };
        if (!changes.title || !changes.dueDate) return;
        if (isEdit) {
            state.updateTask(existingTask.id, changes);
            showToast('Task updated successfully!');
        } else {
            state.addTask({ ...changes, completed: false });
            showToast('Task added successfully!');
        }
        close();
        renderTasks(container);
    };
}

function formatTaskDate(dateString) {
    if (!dateString) return 'No date';
    return new Date(`${dateString}T00:00:00`).toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' });
}

function escapeHtml(value) {
    return String(value ?? '').replace(/[&<>'"]/g, character => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', "'": '&#39;', '"': '&quot;' })[character]);
}