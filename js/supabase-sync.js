import { supabase, supabaseConfigured } from './supabase.js';

const TABLE = 'lifeos_state';
const STATE_COLLECTIONS = ['tasks', 'events', 'shopping', 'transactions', 'goals', 'notes', 'family', 'home', 'travel', 'wellness', 'salary'];
let syncTimer;
let syncInProgress = false;
let activeSubscription = null;
let pendingRemoteState = null;
let applyPendingRemoteState = null;
const dirtyCollections = new Set();

function getStateSnapshot(appState) {
    return {
        tasks: appState.tasks,
        events: appState.events,
        shopping: appState.shopping,
        transactions: appState.transactions,
        goals: appState.goals,
        notes: appState.notes,
        family: appState.family,
        home: appState.home,
        travel: appState.travel,
        wellness: appState.wellness,
        salary: appState.salary
    };
}

function getTargetUserId(user) {
    const familyOwnerId = user?.app_metadata?.family_owner_id;
    return (familyOwnerId && String(familyOwnerId).trim()) ? String(familyOwnerId).trim() : user.id;
}

export async function hydrateStateFromSupabase(appState) {
    if (!supabaseConfigured) return { synced: false, reason: 'missing-config' };

    const { data: userData, error: userError } = await supabase.auth.getUser();
    if (userError || !userData.user) return { synced: false, reason: userError?.message || 'not-authenticated' };

    const targetUserId = getTargetUserId(userData.user);
    const allowedActivities = userData.user.app_metadata?.family_activities;

    const { data, error } = await supabase
        .from(TABLE)
        .select('state')
        .eq('user_id', targetUserId)
        .maybeSingle();

    if (error) return { synced: false, reason: error.message };

    if (!data?.state) {
        applyFamilyPermissions(appState, allowedActivities);
        subscribeToFamilyStateChanges(appState, targetUserId, allowedActivities);
        return { synced: true, restored: false };
    }

    Object.assign(appState, data.state);
    applyFamilyPermissions(appState, allowedActivities);
    subscribeToFamilyStateChanges(appState, targetUserId, allowedActivities);
    window.dispatchEvent(new Event('lifeos:state-updated'));
    return { synced: true, restored: true };
}

function applyFamilyPermissions(appState, allowedActivities) {
    if (!Array.isArray(allowedActivities)) return;
    const collectionByActivity = {
        tasks: 'tasks', calendar: 'events', shopping: 'shopping', money: 'transactions',
        goals: 'goals', notes: 'notes', family: 'family', home: 'home', travel: 'travel', wellness: 'wellness'
    };
    const allowedCollections = new Set();
    allowedActivities.forEach(activity => {
        const mapped = collectionByActivity[activity];
        if (mapped) allowedCollections.add(mapped);
        if (activity === 'money') allowedCollections.add('salary');
    });
    STATE_COLLECTIONS.forEach(collection => {
        if (!allowedCollections.has(collection)) appState[collection] = collection === 'salary' ? 0 : [];
    });
}

function subscribeToFamilyStateChanges(appState, targetUserId, allowedActivities) {
    if (!supabaseConfigured || !targetUserId || activeSubscription) return;

    const applyIncomingState = (newState) => {
        if (!newState) return;
        Object.assign(appState, newState);
        applyFamilyPermissions(appState, allowedActivities);
        window.dispatchEvent(new Event('lifeos:state-updated'));
        window.dispatchEvent(new Event('lifeos:events-changed'));
    };
    applyPendingRemoteState = applyIncomingState;

    activeSubscription = supabase
        .channel(`lifeos_state_${targetUserId}`)
        .on(
            'postgres_changes',
            {
                event: '*',
                schema: 'public',
                table: TABLE,
                filter: `user_id=eq.${targetUserId}`
            },
            (payload) => {
                // Don't drop remote updates that arrive while our own write is in flight -
                // apply them right after our upsert completes instead of discarding them.
                if (syncInProgress) {
                    pendingRemoteState = payload.new?.state || pendingRemoteState;
                    return;
                }
                applyIncomingState(payload.new?.state);
            }
        )
        .subscribe();
}

export function queueStateSync(appState, key) {
    if (!supabaseConfigured) return;
    if (key) dirtyCollections.add(key);
    else STATE_COLLECTIONS.forEach(collection => dirtyCollections.add(collection));
    clearTimeout(syncTimer);
    syncTimer = setTimeout(() => syncStateToSupabase(appState), 250);
}

async function syncStateToSupabase(appState) {
    if (syncInProgress) return;
    syncInProgress = true;

    // Snapshot and clear the dirty set now so changes made during the network round-trip are re-queued.
    const changedCollections = new Set(dirtyCollections);
    dirtyCollections.clear();

    try {
        const { data: userData, error: userError } = await supabase.auth.getUser();
        if (userError || !userData.user) return;

        const targetUserId = getTargetUserId(userData.user);
        const allowedActivities = userData.user.app_metadata?.family_activities;
        const isFamilyMember = Boolean(userData.user.app_metadata?.family_owner_id);

        const collectionByActivity = {
            tasks: 'tasks', calendar: 'events', shopping: 'shopping', money: 'transactions',
            goals: 'goals', notes: 'notes', family: 'family', home: 'home', travel: 'travel', wellness: 'wellness'
        };

        // Always merge with the latest remote state before writing, so that a family member's
        // change made moments ago (which may not have arrived via realtime yet) is never clobbered
        // by another member's or the owner's write of a stale local snapshot.
        const { data: existing } = await supabase
            .from(TABLE)
            .select('state')
            .eq('user_id', targetUserId)
            .maybeSingle();

        const remoteState = existing?.state || {};
        const localSnapshot = getStateSnapshot(appState);

        let permittedCollections;
        if (isFamilyMember && Array.isArray(allowedActivities)) {
            permittedCollections = new Set();
            allowedActivities.forEach(act => {
                const mapped = collectionByActivity[act];
                if (mapped) permittedCollections.add(mapped);
                if (act === 'money') permittedCollections.add('salary');
            });
        } else {
            permittedCollections = new Set(STATE_COLLECTIONS);
        }

        changedCollections.forEach(collection => {
            if (permittedCollections.has(collection)) {
                remoteState[collection] = localSnapshot[collection];
            }
        });

        // Fill in any collections missing from the remote row (e.g. first sync) without touching untouched ones.
        permittedCollections.forEach(collection => {
            if (!(collection in remoteState)) remoteState[collection] = localSnapshot[collection];
        });

        const { error } = await supabase.from(TABLE).upsert({
            user_id: targetUserId,
            state: remoteState,
            updated_at: new Date().toISOString()
        }, { onConflict: 'user_id' });

        if (error) console.error('LifeOS data sync failed:', error.message);
    } finally {
        syncInProgress = false;
        if (pendingRemoteState && applyPendingRemoteState) {
            const stateToApply = pendingRemoteState;
            pendingRemoteState = null;
            applyPendingRemoteState(stateToApply);
        }
    }
}

export async function syncCurrentState(appState) {
    await syncStateToSupabase(appState);
}
