import { LANGUAGES, applyLanguage, getLanguage, t } from './i18n.js';
import { supabase, supabaseConfigured } from './supabase.js';
import { claimFamilyInvitation } from './family-invites.js';
import iconUrl from '../icon.png';

const STORAGE_KEY = 'lifeos_account';

function normalizeAccount(account) {
    if (!account || typeof account !== 'object') return null;
    const name = String(account.name || '').trim();
    const email = String(account.email || '').trim().toLowerCase();
    const password = String(account.password || '');
    const address = String(account.address || '').trim();
    const country = String(account.country || '').trim();
    const phone = String(account.phone || '').trim();
    const photo = String(account.photo || '').trim();
    const familyOwnerId = account.familyOwnerId ? String(account.familyOwnerId).trim() : null;
    const familyActivities = Array.isArray(account.familyActivities) ? account.familyActivities : null;

    if (!name || !email || (password && password.length < 4)) {
        return null;
    }

    return {
        name,
        email,
        password,
        address,
        country,
        phone,
        photo,
        familyOwnerId,
        familyActivities,
    };
}

export function getAccount() {
    try {
        const raw = localStorage.getItem(STORAGE_KEY);
        if (!raw) return null;
        const account = JSON.parse(raw);
        return normalizeAccount(account);
    } catch (error) {
        return null;
    }
}

function saveAccount(account) {
    const normalized = normalizeAccount(account);
    if (!normalized) return false;
    localStorage.setItem(STORAGE_KEY, JSON.stringify(normalized));
    return true;
}

export function initAuth(onReady) {
    const ready = account => {
        document.body.classList.remove('auth-gate');
        onReady(account);
    };
    const account = getAccount();
    if (supabaseConfigured) {
        supabase.auth.onAuthStateChange((event) => {
            if (event === 'PASSWORD_RECOVERY') {
                const redirectUrl = new URL(window.location.href);
                redirectUrl.hash = '';
                redirectUrl.search = '';
                window.history.replaceState({}, document.title, redirectUrl.pathname);
                window.setTimeout(() => openChangePasswordDialog(), 0);
            }
        });
        supabase.auth.refreshSession().catch(() => null).then(() => supabase.auth.getSession()).then(({ data }) => {
            const user = data.session?.user;
            if (user) {
                const supabaseAccount = accountFromSupabaseUser(user);
                saveAccount(supabaseAccount);
                updateProfileHeader(supabaseAccount);
                ready(supabaseAccount);
                return;
            }
            document.body.classList.add('auth-gate');
            renderWelcomePage(ready);
        });
        return;
    }
    if (account) {
        updateProfileHeader(account);
        ready(account);
        return;
    }
    document.body.classList.add('auth-gate');
    renderWelcomePage(ready);
}

function renderWelcomePage(onReady) {
    const mainContent = document.getElementById('main-content');
    if (!mainContent) return;
    mainContent.innerHTML = `
        <section class="welcome-page" aria-labelledby="welcome-title">
            <div class="welcome-content">
                <div class="welcome-brand"><img src="${iconUrl}" alt="LifeOS app icon" width="112" height="112"><span>LifeOS</span></div>
                <p class="welcome-kicker">${t('welcomeKicker')}</p>
                <h1 id="welcome-title">${t('welcomeTitle')}</h1>
                <p class="welcome-copy">${t('welcomeCopy')}</p>
                <div class="welcome-actions">
                    <button type="button" class="btn-primary" id="welcome-register-btn">${t('create')}</button>
                    <button type="button" class="btn-secondary" id="welcome-signin-btn">${t('signIn')}</button>
                </div>
                <label class="welcome-language" for="welcome-language-select">${t('language')}
                    <select id="welcome-language-select" class="form-control">
                        ${Object.entries(LANGUAGES).map(([key, language]) => `<option value="${key}" ${key === getLanguage() ? 'selected' : ''}>${language.name}</option>`).join('')}
                    </select>
                </label>
            </div>
        </section>
    `;
    mainContent.querySelector('#welcome-register-btn').onclick = () => openAuthDialog(false, onReady, 'register');
    mainContent.querySelector('#welcome-signin-btn').onclick = () => openAuthDialog(false, onReady, 'signin');
    mainContent.querySelector('#welcome-language-select').onchange = event => {
        applyLanguage(event.target.value);
        renderWelcomePage(onReady);
    };
}

function updateProfileHeader(account) {
    const username = document.querySelector('.username');
    const avatar = document.querySelector('.avatar');
    const name = account.name.trim() || 'User';
    if (username) username.textContent = name;
    if (avatar) {
        if (account.photo) {
            avatar.innerHTML = `<img src="${escapeHtml(account.photo)}" alt="User" style="width: 100%; height: 100%; object-fit: cover; border-radius: 50%;">`;
        } else {
            avatar.textContent = name.split(/\s+/).map(part => part[0]).join('').slice(0, 2).toUpperCase();
        }
    }
}

function openAuthDialog(forced, onReady, initialMode = 'register') {
    const overlay = document.createElement('div');
    overlay.className = 'modal-overlay';
    overlay.innerHTML = `
        <div class="modal-card auth-modal-card">
            <div class="modal-header">
                <h3>${t('welcome')}</h3>
                ${forced ? '' : '<button class="close-modal-btn" title="Close" aria-label="Close"><i class="fa-solid fa-xmark"></i></button>'}
            </div>
            <div class="modal-body">
                <div class="auth-tabs" role="tablist">
                    <button type="button" class="auth-tab active" data-mode="register">Create Account</button>
                    <button type="button" class="auth-tab" data-mode="signin">Sign In</button>
                </div>
                <form id="auth-form">
                    <div class="form-group auth-register-field">
                        <label for="auth-name">${t('name')}</label>
                        <input type="text" id="auth-name" class="form-control" autocomplete="name" required>
                    </div>
                    <div class="form-group">
                        <label for="auth-email" data-auth-label="email">${t('email')}</label>
                        <input type="email" id="auth-email" class="form-control" autocomplete="email" lang="en" dir="ltr" required>
                    </div>
                    <div class="form-group">
                        <label for="auth-password" data-auth-label="password">${t('password')}</label>
                        <input type="password" id="auth-password" class="form-control" autocomplete="new-password" lang="en" dir="ltr" minlength="4" required>
                    </div>
                    <div class="form-group auth-register-field">
                        <label for="auth-invite-code">Family invite code (optional)</label>
                        <input type="text" id="auth-invite-code" class="form-control" autocomplete="off" placeholder="LIFE-ABC123">
                        <small class="form-help">Use the code from the family invitation to join on this device.</small>
                    </div>
                    <div class="auth-register-field">
                        <div class="form-group">
                            <label for="auth-address">${t('address')}</label>
                            <input type="text" id="auth-address" class="form-control" autocomplete="street-address" required>
                        </div>
                        <div class="form-group">
                            <label for="auth-country">${t('country')}</label>
                            <select id="auth-country" class="form-control" required>
                                ${COUNTRIES.map(country => `<option value="${country}">${country}</option>`).join('')}
                            </select>
                        </div>
                    </div>
                    <p class="auth-error" aria-live="polite"></p>
                    <button type="submit" class="btn-primary auth-submit">${t('createAccount')}</button>
                    <button type="button" class="auth-forgot-password" hidden>Forgot password?</button>
                </form>
            </div>
        </div>
    `;
    document.body.appendChild(overlay);

    let mode = 'register';
    const form = overlay.querySelector('#auth-form');
    const error = overlay.querySelector('.auth-error');
    const nameField = overlay.querySelector('#auth-name');
    const registerFields = overlay.querySelectorAll('.auth-register-field');
    const registerControls = overlay.querySelectorAll('.auth-register-field input, .auth-register-field select');
    const submit = overlay.querySelector('.auth-submit');
    const forgotPassword = overlay.querySelector('.auth-forgot-password');

    const setMode = nextMode => {
        mode = nextMode;
        overlay.querySelectorAll('.auth-tab').forEach(tab => tab.classList.toggle('active', tab.dataset.mode === mode));
        registerFields.forEach(field => { field.hidden = mode === 'signin'; });
        registerControls.forEach(control => { control.required = mode === 'register'; });
        submit.textContent = mode === 'register' ? 'Create Account' : 'Sign In';
        overlay.querySelector('#auth-password').autocomplete = mode === 'register' ? 'new-password' : 'current-password';
        overlay.querySelectorAll('[data-auth-label]').forEach(label => {
            label.textContent = mode === 'signin' ? {
                email: 'Email address',
                password: 'Password',
            }[label.dataset.authLabel] : t(label.dataset.authLabel);
        });
        forgotPassword.hidden = mode !== 'signin';
        error.textContent = '';
    };

    overlay.querySelectorAll('.auth-tab').forEach(tab => { tab.onclick = () => setMode(tab.dataset.mode); });
    setMode(initialMode);
    if (!forced) {
        const close = () => overlay.remove();
        overlay.querySelector('.close-modal-btn').onclick = close;
        overlay.onclick = event => { if (event.target === overlay) close(); };
    }

    forgotPassword.onclick = async () => {
        const email = overlay.querySelector('#auth-email').value.trim().toLowerCase();
        if (!email) {
            error.textContent = 'Enter your email address first.';
            return;
        }
        if (!supabaseConfigured) {
            error.textContent = 'Password recovery requires a connected email service.';
            return;
        }
        forgotPassword.disabled = true;
        const { error: resetError } = await supabase.auth.resetPasswordForEmail(email, {
            redirectTo: window.location.origin + '/',
        });
        forgotPassword.disabled = false;
        error.textContent = resetError
            ? resetError.message
            : 'Password reset instructions have been sent to your email.';
    };

    form.onsubmit = async event => {
        event.preventDefault();
        const email = overlay.querySelector('#auth-email').value.trim().toLowerCase();
        const password = overlay.querySelector('#auth-password').value.trim();
        const existing = getAccount();

        if (!email || !password || password.length < 4) {
            error.textContent = 'Please enter a valid email and password with at least 4 characters.';
            return;
        }

        if (mode === 'signin') {
            if (supabaseConfigured) {
                const { data, error: signInError } = await supabase.auth.signInWithPassword({ email, password });
                if (signInError) {
                    error.textContent = signInError.message;
                    return;
                }
                const signedInAccount = accountFromSupabaseUser(data.user);
                const claimedAccount = await claimPendingFamilyInvitation() || signedInAccount;
                saveAccount(claimedAccount);
                overlay.remove();
                updateProfileHeader(claimedAccount);
                onReady(claimedAccount);
                return;
            }
            if (!existing || existing.email !== email || existing.password !== password) {
                error.textContent = 'Email or password is not correct.';
                return;
            }
            overlay.remove();
            updateProfileHeader(existing);
            onReady(existing);
            return;
        }

        if (!supabaseConfigured && existing && existing.email === email) {
            error.textContent = 'An account with this email already exists. Sign in instead.';
            return;
        }

        const account = {
            name: nameField.value.trim(),
            email,
            password,
            address: overlay.querySelector('#auth-address').value.trim(),
            country: overlay.querySelector('#auth-country').value,
            phone: '',
        };

        const normalized = normalizeAccount(account);
        if (!normalized) {
            error.textContent = 'Please fill in all required account details.';
            return;
        }

        if (supabaseConfigured) {
            const { data, error: signUpError } = await supabase.auth.signUp({
                email,
                password,
                options: {
                    emailRedirectTo: 'com.lifeos.app://',
                    data: {
                        name: normalized.name,
                        address: normalized.address,
                        country: normalized.country,
                        phone: normalized.phone,
                    }
                }
            });
            if (signUpError) {
                error.textContent = signUpError.message;
                return;
            }
            if (!data.user) {
                error.textContent = 'Supabase did not return a user. Please try again.';
                return;
            }
            const supabaseAccount = accountFromSupabaseUser(data.user, normalized);
            saveAccount(supabaseAccount);
            const inviteCode = overlay.querySelector('#auth-invite-code')?.value.trim();
            if (inviteCode) localStorage.setItem('lifeos_pending_family_invite', inviteCode);
            if (data.session) {
                const claimedAccount = await claimPendingFamilyInvitation() || supabaseAccount;
                saveAccount(claimedAccount);
                overlay.remove();
                updateProfileHeader(claimedAccount);
                onReady(claimedAccount);
                return;
            }
            if (!data.session) {
                error.textContent = 'Account created. Check your email to confirm the account, then sign in.';
                return;
            }
            overlay.remove();
            updateProfileHeader(supabaseAccount);
            onReady(supabaseAccount);
            return;
        }

        if (!saveAccount(normalized)) {
            error.textContent = 'Unable to save account details. Please try again.';
            return;
        }

        overlay.remove();
        updateProfileHeader(normalized);
        onReady(normalized);
    };
}

async function claimPendingFamilyInvitation() {
    const inviteCode = localStorage.getItem('lifeos_pending_family_invite');
    if (!inviteCode) return null;

    const result = await claimFamilyInvitation(inviteCode);
    if (!result.claimed) return null;

    localStorage.removeItem('lifeos_pending_family_invite');

    const { data: userData, error } = await supabase.auth.getUser();
    if (error || !userData.user) return null;

    const refreshedAccount = accountFromSupabaseUser(userData.user);
    const activities = Array.isArray(result.activities) ? result.activities : [];
    if (activities.length) {
        refreshedAccount.familyActivities = activities;
    }
    saveAccount(refreshedAccount);
    return refreshedAccount;
}

function accountFromSupabaseUser(user, fallback = {}) {
    const metadata = user.user_metadata || {};
    const appMetadata = user.app_metadata || {};
    return {
        name: metadata.name || fallback.name || user.email?.split('@')[0] || 'User',
        email: user.email || fallback.email || '',
        address: metadata.address || fallback.address || '',
        country: metadata.country || fallback.country || '',
        phone: metadata.phone || fallback.phone || '',
        photo: metadata.photo || fallback.photo || '',
        familyOwnerId: appMetadata.family_owner_id || fallback.familyOwnerId || null,
        familyActivities: Array.isArray(appMetadata.family_activities) ? appMetadata.family_activities : (fallback.familyActivities || null),
    };
}

export function openProfileDialog() {
    const account = getAccount();
    if (!account) return;
    const overlay = document.createElement('div');
    overlay.className = 'modal-overlay';
    overlay.innerHTML = `
        <div class="modal-card">
            <div class="modal-header">
                <h3>Account Profile</h3>
                <button class="close-modal-btn" title="Close" aria-label="Close"><i class="fa-solid fa-xmark"></i></button>
            </div>
            <div class="modal-body">
                <div style="display: flex; gap: 20px; align-items: flex-start; margin-bottom: 20px;">
                    <div style="display: flex; flex-direction: column; align-items: center; gap: 10px;">
                        <div id="profile-dialog-avatar" style="width: 80px; height: 80px; border-radius: 50%; background: var(--color-primary); color: #fff; display: flex; align-items: center; justify-content: center; font-size: 24px; font-weight: bold; overflow: hidden; box-shadow: var(--shadow-sm);">
                            ${account.photo ? `<img src="${escapeHtml(account.photo)}" style="width: 100%; height: 100%; object-fit: cover;">` : escapeHtml(account.name.split(/\\s+/).map(p => p[0]).join('').slice(0, 2).toUpperCase())}
                        </div>
                        <label class="btn-secondary" style="font-size: 0.75rem; padding: 4px 8px; cursor: pointer;">
                            Change Photo
                            <input type="file" id="profile-photo-upload" accept="image/*" style="display: none;">
                        </label>
                    </div>
                    <div class="profile-summary" style="flex: 1;">
                        <strong>${escapeHtml(account.name)}</strong>
                        <span>${escapeHtml(account.email)}</span>
                        <span>${escapeHtml(account.phone)}</span>
                        <span>${escapeHtml(account.address)}, ${escapeHtml(account.country)}</span>
                    </div>
                </div>
                <div style="display: flex; justify-content: flex-end; gap: 10px; margin-top: 20px;"><button type="button" class="btn-secondary" id="change-password-btn">Change Password</button><button type="button" class="btn-secondary" id="sign-out-btn">Sign Out</button><button type="button" class="btn-primary" id="close-profile-btn">Close</button></div>
            </div>
        </div>
    `;
    document.body.appendChild(overlay);

    const photoUpload = overlay.querySelector('#profile-photo-upload');
    const dialogAvatar = overlay.querySelector('#profile-dialog-avatar');

    photoUpload.onchange = (e) => {
        const file = e.target.files[0];
        if (!file) return;
        const reader = new FileReader();
        reader.onload = async (event) => {
            const base64 = event.target.result;
            dialogAvatar.innerHTML = `<img src="${base64}" style="width: 100%; height: 100%; object-fit: cover;">`;
            const currentAccount = getAccount();
            currentAccount.photo = base64;
            saveAccount(currentAccount);

            if (supabaseConfigured) {
                await supabase.auth.updateUser({
                    data: { photo: base64 }
                });
            }
            updateProfileHeader(currentAccount);
        };
        reader.readAsDataURL(file);
    };

    const close = () => overlay.remove();
    overlay.querySelector('.close-modal-btn').onclick = close;
    overlay.querySelector('#close-profile-btn').onclick = close;
    overlay.querySelector('#change-password-btn').onclick = () => {
        close();
        openChangePasswordDialog();
    };
    overlay.querySelector('#sign-out-btn').onclick = async () => {
        if (supabaseConfigured) await supabase.auth.signOut();
        localStorage.removeItem(STORAGE_KEY);
        window.location.reload();
    };
}

function openChangePasswordDialog() {
    const overlay = document.createElement('div');
    overlay.className = 'modal-overlay';
    overlay.innerHTML = `
        <div class="modal-card">
            <div class="modal-header">
                <h3>Change Password</h3>
                <button class="close-modal-btn" title="Close" aria-label="Close"><i class="fa-solid fa-xmark"></i></button>
            </div>
            <div class="modal-body">
                <form id="change-password-form">
                    <div class="form-group">
                        <label for="new-password">New password</label>
                        <input type="password" id="new-password" class="form-control" autocomplete="new-password" minlength="4" required>
                    </div>
                    <div class="form-group">
                        <label for="confirm-password">Confirm new password</label>
                        <input type="password" id="confirm-password" class="form-control" autocomplete="new-password" minlength="4" required>
                    </div>
                    <p class="auth-error" aria-live="polite"></p>
                    <button type="submit" class="btn-primary">Update Password</button>
                </form>
            </div>
        </div>
    `;
    document.body.appendChild(overlay);

    const close = () => overlay.remove();
    const form = overlay.querySelector('#change-password-form');
    const error = overlay.querySelector('.auth-error');
    overlay.querySelector('.close-modal-btn').onclick = close;
    overlay.onclick = event => { if (event.target === overlay) close(); };
    form.onsubmit = async event => {
        event.preventDefault();
        const password = overlay.querySelector('#new-password').value;
        const confirmation = overlay.querySelector('#confirm-password').value;
        if (password.length < 4 || password !== confirmation) {
            error.textContent = password.length < 4
                ? 'Password must be at least 4 characters.'
                : 'Passwords do not match.';
            return;
        }
        if (supabaseConfigured) {
            const { error: updateError } = await supabase.auth.updateUser({ password });
            if (updateError) {
                error.textContent = updateError.message;
                return;
            }
        } else {
            const account = getAccount();
            if (!account) {
                error.textContent = 'No local account is available.';
                return;
            }
            account.password = password;
            saveAccount(account);
        }
        close();
    };
}

export function getContactPhone(fallback = '') {
    return getAccount()?.phone || fallback;
}

const COUNTRIES = [
    'United Arab Emirates', 'United States', 'Canada', 'United Kingdom', 'Australia', 'New Zealand', 'Ireland', 'France', 'Germany', 'Italy', 'Spain', 'Portugal', 'Netherlands', 'Belgium', 'Switzerland', 'Austria', 'Sweden', 'Norway', 'Denmark', 'Finland', 'Poland', 'Greece', 'Turkey', 'Russia', 'Ukraine', 'Saudi Arabia', 'Qatar', 'Kuwait', 'Bahrain', 'Oman', 'Jordan', 'Egypt', 'Morocco', 'South Africa', 'Nigeria', 'Kenya', 'India', 'Pakistan', 'Bangladesh', 'Sri Lanka', 'Nepal', 'China', 'Japan', 'South Korea', 'Singapore', 'Malaysia', 'Indonesia', 'Thailand', 'Philippines', 'Vietnam', 'Brazil', 'Mexico', 'Argentina', 'Chile', 'Colombia', 'Peru'
];

function escapeHtml(value) {
    return String(value ?? '').replace(/[&<>'"]/g, character => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', "'": '&#39;', '"': '&quot;' })[character]);
}
