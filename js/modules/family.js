import { state } from '../state.js';
import { showToast } from '../utils.js';
import { getFamilyLimit } from '../plans.js';
import { createFamilyAccount, saveFamilyInvitation, updateFamilyPermissions } from '../family-invites.js';

const FAMILY_ACTIVITIES = [
    { id: 'dashboard', label: 'Dashboard' },
    { id: 'calendar', label: 'Calendar' },
    { id: 'tasks', label: 'Tasks' },
    { id: 'shopping', label: 'Shopping' },
    { id: 'money', label: 'Money' },
    { id: 'home', label: 'Home' },
    { id: 'wellness', label: 'Wellness' },
    { id: 'travel', label: 'Travel' },
    { id: 'goals', label: 'Goals' },
    { id: 'notes', label: 'Notes' }
];

const ALL_ACTIVITIES = FAMILY_ACTIVITIES.map(activity => activity.id);

function escapeHtml(value = '') {
    return String(value).replace(/[&<>'"]/g, character => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', "'": '&#39;', '"': '&quot;' })[character]);
}

function getMemberActivities(member) {
    if (!Array.isArray(member.activities)) return [...ALL_ACTIVITIES];
    return member.activities.filter(activity => ALL_ACTIVITIES.includes(activity));
}

function getActivitySummary(member) {
    const activities = getMemberActivities(member);
    return activities.length === ALL_ACTIVITIES.length ? 'All activities' : `${activities.length} activities shared`;
}

function createInviteCode() {
    return `LIFE-${Math.random().toString(36).slice(2, 8).toUpperCase()}`;
}

function getInviteSubject(member) {
    return encodeURIComponent(`Join my LifeOS family workspace`);
}

function getInviteBody(member) {
    const access = getActivitySummary(member);
    return encodeURIComponent(`Hi ${member.name},\n\nYou have been invited to join our LifeOS family workspace.\n\nJoin code: ${member.inviteCode}\nShared access: ${access}\n\nOpen LifeOS on your device, create or sign in to your account, then enter this invite code in the Family workspace.\n\nThis invitation was created from LifeOS.`);
}

export function renderFamily(container) {
    const familyLimit = getFamilyLimit();

    if (familyLimit === 0) {
        container.innerHTML = `
            <div class="family-page">
                <div class="family-panel family-locked-panel">
                    <span class="eyebrow">Family workspace</span>
                    <h2>Family planning is part of Family Pro</h2>
                    <p>Upgrade to Family Pro to organize up to 4 family members, birthdays, and important dates together.</p>
                    <button class="btn-primary" id="open-family-upgrade"><i class="fa-solid fa-users"></i> Upgrade to Family Pro</button>
                </div>
            </div>
        `;
        container.querySelector('#open-family-upgrade').onclick = () => document.getElementById('plans-trigger')?.click();
        return;
    }

    const hasReachedLimit = state.family.length >= familyLimit;

    container.innerHTML = `
        <div class="family-page">
            <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 24px;">
                <h2>Family Organization</h2>
                <div style="display: flex; align-items: center; gap: 12px; flex-wrap: wrap; justify-content: flex-end;">
                    <span class="badge ${hasReachedLimit ? 'badge-warning' : 'badge-success'}">${state.family.length}/${familyLimit} members</span>
                    <button class="btn-primary" id="add-family-btn"><i class="fa-solid fa-plus"></i> Add Member</button>
                </div>
            </div>
            <div class="family-panel family-join-guide">
                <div>
                    <span class="eyebrow">Multi-device access</span>
                    <h3>Invite family members to LifeOS</h3>
                    <p>1. Add their email and choose activities. 2. Send the invitation. 3. They open LifeOS on their device, create their own password, and use the join code from the email.</p>
                </div>
                <span class="badge badge-success"><i class="fa-solid fa-envelope"></i> Email invitations</span>
            </div>
            <div class="family-panel">
                <h3 style="margin-bottom: 16px;">Family Members & Important Dates</h3>
                <div style="display: flex; flex-direction: column; gap: 12px;">
                    ${state.family.map(f => `
                        <div style="display: flex; justify-content: space-between; align-items: center; padding: 12px; background: var(--color-background); border-radius: 8px; gap: 12px; flex-wrap: wrap;">
                            <div style="display: flex; align-items: center; gap: 12px;">
                                <div>
                                    <strong>${escapeHtml(f.name)}</strong>
                                    <div class="muted-text" style="font-size: 0.8rem; margin-top: 4px;">${escapeHtml(f.relation || 'Family')} · ${getActivitySummary(f)}</div>
                                    <div class="muted-text" style="font-size: 0.75rem; margin-top: 3px;">${escapeHtml(f.email || 'No email added')} · Code: ${escapeHtml(f.inviteCode || 'Not generated')}</div>
                                </div>
                            </div>
                            <div style="display: flex; align-items: center; gap: 8px;">
                                <span class="muted-text" style="font-size: 0.8rem;">Birthday: ${f.birthday || 'Not set'}</span>
                                <button class="btn-secondary edit-family" data-id="${f.id}" title="Edit member access" aria-label="Edit ${escapeHtml(f.name)}"><i class="fa-solid fa-pen"></i></button>
                                ${f.email ? `<a class="btn-secondary family-invite-link" href="mailto:${encodeURIComponent(f.email)}?subject=${getInviteSubject(f)}&body=${getInviteBody(f)}" data-id="${f.id}" title="Send invitation" aria-label="Send invitation to ${escapeHtml(f.name)}"><i class="fa-solid fa-envelope"></i></a>` : ''}
                                <button class="btn-secondary delete-family" data-id="${f.id}" style="color: var(--color-danger); padding: 4px 8px;"><i class="fa-solid fa-trash"></i></button>
                            </div>
                        </div>
                    `).join('')}
                </div>
            </div>
        </div>
    `;

    container.querySelector('#add-family-btn').onclick = () => {
        if (hasReachedLimit) {
            showToast(`Your plan supports up to ${familyLimit} family members. Upgrade to add more.`);
            document.getElementById('plans-trigger')?.click();
            return;
        }
        openFamilyMemberDialog(container);
    };

    container.querySelectorAll('.edit-family').forEach(button => {
        button.onclick = () => {
            const member = state.family.find(item => item.id === Number(button.dataset.id));
            if (member) openFamilyMemberDialog(container, member);
        };
    });

    container.querySelectorAll('.delete-family').forEach(btn => {
        btn.onclick = () => {
            state.deleteFamilyMember(Number(btn.getAttribute('data-id')));
            showToast('Family member removed');
            renderFamily(container);
        };
    });

    container.querySelectorAll('.family-invite-link').forEach(link => {
        link.onclick = () => {
            const member = state.family.find(item => item.id === Number(link.dataset.id));
            if (!member) return;
            state.updateFamilyMember(member.id, { inviteStatus: 'sent' });
            showToast(`Invitation ready for ${member.name}`);
        };
    });
}

function openFamilyMemberDialog(container, existingMember = null) {
    const isEdit = Boolean(existingMember);
    const selectedActivities = getMemberActivities(existingMember || { activities: ALL_ACTIVITIES });
    const overlay = document.createElement('div');
    overlay.className = 'modal-overlay';
    overlay.innerHTML = `
        <div class="modal-card family-member-modal">
            <div class="modal-header">
                <div>
                    <span class="eyebrow">Family Pro sharing</span>
                    <h3>${isEdit ? 'Update family member' : 'Add family member'}</h3>
                </div>
                <button class="close-modal-btn" title="Close" aria-label="Close"><i class="fa-solid fa-xmark"></i></button>
            </div>
            <div class="modal-body">
                <form id="family-member-form">
                    <div class="form-group"><label for="family-member-name">Name</label><input id="family-member-name" class="form-control" type="text" required placeholder="Family member name" value="${escapeHtml(existingMember?.name || '')}"></div>
                    <div class="form-group"><label for="family-member-relation">Relation</label><input id="family-member-relation" class="form-control" type="text" required placeholder="Spouse, child, parent" value="${escapeHtml(existingMember?.relation || 'Family')}"></div>
                    <div class="form-group"><label for="family-member-email">Email for joining on another device</label><input id="family-member-email" class="form-control" type="email" required placeholder="member@example.com" value="${escapeHtml(existingMember?.email || '')}"><small class="form-help">The member will use this email to sign in on another device.</small></div>
                    ${!isEdit ? `<div class="form-group"><label for="family-member-password">Temporary password</label><input id="family-member-password" class="form-control" type="password" minlength="6" required autocomplete="new-password"><small class="form-help">Give this password to the family member securely. It is used only to create their Supabase account and is never stored in LifeOS.</small></div><div class="form-group"><label for="family-member-password-confirm">Confirm temporary password</label><input id="family-member-password-confirm" class="form-control" type="password" minlength="6" required autocomplete="new-password"></div>` : ''}
                    <div class="form-group"><label for="family-member-birthday">Birthday</label><input id="family-member-birthday" class="form-control" type="date" value="${escapeHtml(existingMember?.birthday || '')}"></div>
                    <fieldset class="family-permissions">
                        <legend>Activities this member can use</legend>
                        <label class="permission-option permission-all"><input id="family-all-activities" type="checkbox" ${selectedActivities.length === ALL_ACTIVITIES.length ? 'checked' : ''}><span><strong>All activities</strong><small>Give access to the full LifeOS workspace</small></span></label>
                        <div class="permission-grid">
                            ${FAMILY_ACTIVITIES.map(activity => `<label class="permission-option"><input type="checkbox" class="family-activity" value="${activity.id}" ${selectedActivities.includes(activity.id) ? 'checked' : ''}><span>${activity.label}</span></label>`).join('')}
                        </div>
                    </fieldset>
                    <div style="display: flex; justify-content: flex-end; gap: 10px; margin-top: 20px;"><button type="button" class="btn-secondary" id="cancel-family-btn">Cancel</button><button type="submit" class="btn-primary">${isEdit ? 'Save changes' : 'Add member'}</button></div>
                </form>
            </div>
        </div>
    `;
    document.body.appendChild(overlay);

    const allActivities = overlay.querySelector('#family-all-activities');
    const activityInputs = [...overlay.querySelectorAll('.family-activity')];
    const syncAllCheckbox = () => { allActivities.checked = activityInputs.every(input => input.checked); };
    allActivities.onchange = () => activityInputs.forEach(input => { input.checked = allActivities.checked; });
    activityInputs.forEach(input => { input.onchange = syncAllCheckbox; });

    const close = () => overlay.remove();
    overlay.querySelector('.close-modal-btn').onclick = close;
    overlay.querySelector('#cancel-family-btn').onclick = close;
    overlay.onclick = event => { if (event.target === overlay) close(); };
    overlay.querySelector('#family-member-form').onsubmit = async event => {
        event.preventDefault();
        const changes = {
            name: overlay.querySelector('#family-member-name').value.trim(),
            relation: overlay.querySelector('#family-member-relation').value.trim() || 'Family',
            email: overlay.querySelector('#family-member-email').value.trim().toLowerCase(),
            birthday: overlay.querySelector('#family-member-birthday').value,
            inviteCode: existingMember?.inviteCode || createInviteCode(),
            inviteStatus: overlay.querySelector('#family-member-email').value.trim() ? 'ready' : 'not-invited',
            activities: allActivities.checked ? [...ALL_ACTIVITIES] : activityInputs.filter(input => input.checked).map(input => input.value)
        };
        if (!changes.name) return;
        if (!isEdit) {
            const password = overlay.querySelector('#family-member-password').value;
            const passwordConfirm = overlay.querySelector('#family-member-password-confirm').value;
            if (password.length < 6 || password !== passwordConfirm) {
                showToast('Passwords must match and contain at least 6 characters.');
                return;
            }
            const invitationResult = await saveFamilyInvitation({ ...changes, inviteCode: changes.inviteCode });
            if (!invitationResult.synced) {
                showToast(`Invitation was not saved: ${invitationResult.reason}`);
                return;
            }
            const accountResult = await createFamilyAccount(changes, password);
            if (!accountResult.created) {
                showToast(`Family account was not created: ${accountResult.reason}`);
                return;
            }
        }
        if (isEdit) {
            const permissionResult = await updateFamilyPermissions(changes);
            if (!permissionResult.updated) {
                showToast(`Permissions were not updated in Supabase: ${permissionResult.reason}`);
                return;
            }
        }
        if (isEdit) state.updateFamilyMember(existingMember.id, changes);
        else state.addFamilyMember(changes);
        showToast(isEdit ? 'Family access updated!' : 'Family member added!');
        close();
        renderFamily(container);
    };
}