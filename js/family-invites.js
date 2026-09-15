import { supabase, supabaseConfigured } from './supabase.js';

export async function saveFamilyInvitation(member) {
    if (!supabaseConfigured || !member.email) return { synced: false, reason: 'missing-config-or-email' };

    const { data: userData, error: userError } = await supabase.auth.getUser();
    if (userError || !userData.user) return { synced: false, reason: userError?.message || 'not-authenticated' };

    const payload = {
        owner_id: userData.user.id,
        invited_email: member.email.toLowerCase(),
        member_name: member.name,
        relation: member.relation || 'Family',
        activities: member.activities || [],
        invite_code: member.inviteCode,
        status: 'pending',
        updated_at: new Date().toISOString()
    };

    const { data, error } = await supabase
        .from('family_invitations')
        .upsert(payload, { onConflict: 'invite_code' })
        .select('id, status')
        .single();

    if (error) return { synced: false, reason: error.message };
    return { synced: true, invitation: data };
}

export async function claimFamilyInvitation(inviteCode) {
    if (!supabaseConfigured || !inviteCode) return { claimed: false, reason: 'missing-code-or-config' };

    const normalizedCode = String(inviteCode).trim().toUpperCase();
    const { data, error } = await supabase.rpc('claim_family_invitation', { input_code: normalizedCode });
    if (error) return { claimed: false, reason: error.message };
    if (!data) return { claimed: false, reason: 'invite-not-found' };

    const { data: inviteData, error: inviteError } = await supabase
        .from('family_invitations')
        .select('activities')
        .eq('invite_code', normalizedCode)
        .maybeSingle();

    const activities = Array.isArray(inviteData?.activities) ? inviteData.activities : [];
    return inviteError ? { claimed: true, activities: [] } : { claimed: true, activities };
}

export async function createFamilyAccount(member, password) {
    if (!supabaseConfigured) return { created: false, reason: 'Supabase is not configured.' };
    const { data, error } = await supabase.functions.invoke('create-family-account', {
        body: {
            email: member.email,
            password,
            name: member.name,
            relation: member.relation,
            inviteCode: member.inviteCode,
            activities: member.activities
        }
    });
    return error ? { created: false, reason: error.message } : (data?.error ? { created: false, reason: data.error } : { created: true });
}

export async function updateFamilyPermissions(member) {
    if (!supabaseConfigured) return { updated: false, reason: 'Supabase is not configured.' };
    const { data, error } = await supabase.functions.invoke('update-family-permissions', {
        body: { inviteCode: member.inviteCode, activities: member.activities }
    });
    return error ? { updated: false, reason: error.message } : (data?.error ? { updated: false, reason: data.error } : { updated: true });
}
