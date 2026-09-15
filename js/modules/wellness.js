import { state } from '../state.js';
import { showToast } from '../utils.js';

const WELLNESS_TYPES = {
    hydration: { label: 'Hydration', icon: 'fa-droplet', unit: 'glasses', color: 'var(--color-primary)' },
    sleep: { label: 'Sleep', icon: 'fa-bed', unit: 'hours', color: 'var(--color-success)' },
    movement: { label: 'Movement', icon: 'fa-dumbbell', unit: 'minutes', color: 'var(--color-warning)' },
    nutrition: { label: 'Nutrition', icon: 'fa-utensils', unit: 'meals', color: 'var(--color-danger)' },
};

export function renderWellness(container) {
    const entries = state.wellness || [];
    const totalProgress = entries.length ? Math.round(entries.reduce((sum, item) => sum + getProgress(item), 0) / entries.length) : 0;

    container.innerHTML = `
        <div class="wellness-page">
            <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 24px; gap: 12px; flex-wrap: wrap;">
                <div>
                    <h2>Health & Wellness</h2>
                    <p style="color: var(--color-muted); margin-top: 6px;">Track your daily wellness goals and keep your routine balanced.</p>
                </div>
                <button class="btn-primary" id="add-wellness-btn"><i class="fa-solid fa-plus"></i> Add Check-in</button>
            </div>

            <div style="display: grid; grid-template-columns: repeat(auto-fit, minmax(240px, 1fr)); gap: 18px; margin-bottom: 24px;">
                ${entries.map(item => {
                    const progress = getProgress(item);
                    return `
                        <div style="background: var(--color-surface); border: 1px solid var(--color-border); border-radius: 12px; padding: 18px;">
                            <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 12px;">
                                <div style="display: flex; align-items: center; gap: 10px;">
                                    <div style="width: 38px; height: 38px; border-radius: 10px; background: color-mix(in srgb, ${getAccentColor(item.accent)} 18%, transparent); display: flex; align-items: center; justify-content: center; color: ${getAccentColor(item.accent)};">
                                        <i class="fa-solid ${item.icon || 'fa-heart-pulse'}"></i>
                                    </div>
                                    <strong>${escapeHtml(item.name)}</strong>
                                </div>
                                <button class="btn-secondary delete-wellness" data-id="${item.id}" style="padding: 4px 8px; color: var(--color-danger);"><i class="fa-solid fa-trash"></i></button>
                            </div>

                            <div style="display: flex; justify-content: space-between; align-items: end; margin-bottom: 10px;">
                                <div>
                                    <div style="font-size: 1.7rem; font-weight: 700;">${Number(item.current || 0)}</div>
                                    <small style="color: var(--color-muted);">/ ${Number(item.target || 0)} ${item.unit || 'units'}</small>
                                </div>
                                <span class="badge ${progress >= 100 ? 'badge-success' : 'badge-warning'}">${progress}%</span>
                            </div>

                            <div style="height: 8px; background: var(--color-background); border-radius: 999px; overflow: hidden;">
                                <div style="height: 100%; width: ${Math.min(progress, 100)}%; background: ${getAccentColor(item.accent)}; border-radius: 999px;"></div>
                            </div>

                            <div style="margin-top: 12px; display: flex; gap: 8px; align-items: center;">
                                <input type="number" class="form-control wellness-value" data-id="${item.id}" value="${Number(item.current || 0)}" min="0" style="width: 90px; padding: 6px 8px;" aria-label="${escapeHtml(item.name)} value">
                                <button class="btn-secondary update-wellness" data-id="${item.id}" style="padding: 6px 10px;">Save</button>
                            </div>
                        </div>
                    `;
                }).join('') || `<div style="grid-column: 1 / -1; background: var(--color-surface); border: 1px solid var(--color-border); border-radius: 12px; padding: 20px; color: var(--color-muted);">No wellness goals added yet. Start with a quick check-in.</div>`}
            </div>

            <div style="background: var(--color-surface); border: 1px solid var(--color-border); border-radius: 12px; padding: 20px;">
                <h3 style="margin-bottom: 12px;">Wellness summary</h3>
                <div style="display: flex; gap: 12px; flex-wrap: wrap; align-items: center; color: var(--color-muted);">
                    <span class="badge badge-success">Average progress: ${totalProgress}%</span>
                    <span class="badge badge-warning">Goals tracked: ${entries.length}</span>
                    <span class="badge badge-danger">Focus: ${entries.filter(item => getProgress(item) < 100).length} need attention</span>
                </div>
            </div>
        </div>
    `;

    container.querySelector('#add-wellness-btn').onclick = () => openWellnessDialog(container);

    container.querySelectorAll('.delete-wellness').forEach(button => {
        button.onclick = () => {
            state.deleteWellnessEntry(Number(button.dataset.id));
            showToast('Wellness goal removed');
            renderWellness(container);
        };
    });

    container.querySelectorAll('.update-wellness').forEach(button => {
        button.onclick = () => {
            const input = container.querySelector(`.wellness-value[data-id="${button.dataset.id}"]`);
            if (!input) return;
            const value = Number(input.value);
            state.updateWellnessEntry(Number(button.dataset.id), { current: Number.isFinite(value) ? value : 0 });
            showToast('Wellness updated');
            renderWellness(container);
        };
    });
}

function openWellnessDialog(container) {
    const overlay = document.createElement('div');
    overlay.className = 'modal-overlay';
    overlay.innerHTML = `
        <div class="modal-card">
            <div class="modal-header">
                <h3>Add Wellness Goal</h3>
                <button class="close-modal-btn" title="Close" aria-label="Close"><i class="fa-solid fa-xmark"></i></button>
            </div>
            <div class="modal-body">
                <form id="wellness-form">
                    <div class="form-group">
                        <label for="wellness-name">Goal</label>
                        <select id="wellness-name" class="form-control">
                            <option value="Hydration">Hydration</option>
                            <option value="Sleep">Sleep</option>
                            <option value="Movement">Movement</option>
                            <option value="Nutrition">Nutrition</option>
                        </select>
                    </div>
                    <div class="form-group">
                        <label for="wellness-target">Target</label>
                        <input id="wellness-target" class="form-control" type="number" min="1" value="8" required>
                    </div>
                    <div class="form-group">
                        <label for="wellness-current">Current</label>
                        <input id="wellness-current" class="form-control" type="number" min="0" value="0" required>
                    </div>
                    <div style="display: flex; justify-content: flex-end; gap: 10px; margin-top: 20px;">
                        <button type="button" class="btn-secondary" id="cancel-wellness-btn">Cancel</button>
                        <button type="submit" class="btn-primary">Save Goal</button>
                    </div>
                </form>
            </div>
        </div>
    `;

    document.body.appendChild(overlay);
    const close = () => overlay.remove();
    overlay.querySelector('.close-modal-btn').onclick = close;
    overlay.querySelector('#cancel-wellness-btn').onclick = close;
    overlay.onclick = event => { if (event.target === overlay) close(); };

    overlay.querySelector('#wellness-form').onsubmit = event => {
        event.preventDefault();
        const name = overlay.querySelector('#wellness-name').value;
        const target = Number(overlay.querySelector('#wellness-target').value);
        const current = Number(overlay.querySelector('#wellness-current').value);

        if (!name || !Number.isFinite(target) || target <= 0) return;

        const typeMap = {
            Hydration: { icon: 'fa-droplet', unit: 'glasses', accent: 'primary' },
            Sleep: { icon: 'fa-bed', unit: 'hours', accent: 'success' },
            Movement: { icon: 'fa-dumbbell', unit: 'minutes', accent: 'warning' },
            Nutrition: { icon: 'fa-utensils', unit: 'meals', accent: 'danger' },
        };

        state.addWellnessEntry({
            name,
            icon: typeMap[name].icon,
            unit: typeMap[name].unit,
            accent: typeMap[name].accent,
            current: Number.isFinite(current) ? current : 0,
            target: target,
        });

        showToast('Wellness goal added');
        close();
        renderWellness(container);
    };
}

function getProgress(item) {
    if (!item || !Number(item.target)) return 0;
    return Math.min(100, Math.round((Number(item.current || 0) / Number(item.target)) * 100));
}

function getAccentColor(accent) {
    const colors = {
        primary: 'var(--color-primary)',
        success: 'var(--color-success)',
        warning: 'var(--color-warning)',
        danger: 'var(--color-danger)'
    };
    return colors[accent] || 'var(--color-primary)';
}

function escapeHtml(value) {
    return String(value ?? '').replace(/[&<>'"]/g, character => ({
        '&': '&amp;',
        '<': '&lt;',
        '>': '&gt;',
        "'": '&#39;',
        '"': '&quot;'
    })[character]);
}
