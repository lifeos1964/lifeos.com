import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.116.0';

const corsHeaders = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
    'Access-Control-Allow-Methods': 'POST, OPTIONS'
};

Deno.serve(async request => {
    if (request.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders });

    try {
        const authorization = request.headers.get('Authorization');
        if (!authorization) return json({ error: 'Authentication required.' }, 401);

        const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
        const publishableKey = Deno.env.get('SUPABASE_ANON_KEY')!;
        const serviceRoleKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
        const userClient = createClient(supabaseUrl, publishableKey, { global: { headers: { Authorization: authorization } } });
        const adminClient = createClient(supabaseUrl, serviceRoleKey);
        const { data: userData, error: userError } = await userClient.auth.getUser();
        if (userError || !userData.user) return json({ error: 'Authentication required.' }, 401);

        const body = await request.json();
        const inviteCode = String(body.inviteCode || '').trim().toUpperCase();
        const activities = Array.isArray(body.activities) ? body.activities : [];
        if (!inviteCode) return json({ error: 'Invitation code is required.' }, 400);

        const { data: invitation, error: invitationError } = await adminClient
            .from('family_invitations')
            .select('id, invited_user_id, status')
            .eq('owner_id', userData.user.id)
            .eq('invite_code', inviteCode)
            .maybeSingle();
        if (invitationError || !invitation) return json({ error: 'Invitation was not found.' }, 404);
        if (!invitation.invited_user_id) return json({ error: 'This family member has not created an account yet.' }, 400);

        const { data: memberData, error: memberError } = await adminClient.auth.admin.getUserById(invitation.invited_user_id);
        if (memberError || !memberData.user) return json({ error: 'Family member account was not found.' }, 404);

        const existingMetadata = memberData.user.app_metadata || {};
        const { error: updateUserError } = await adminClient.auth.admin.updateUserById(invitation.invited_user_id, {
            app_metadata: { ...existingMetadata, family_owner_id: userData.user.id, family_activities: activities }
        });
        if (updateUserError) return json({ error: updateUserError.message }, 500);

        const { error: updateInvitationError } = await adminClient
            .from('family_invitations')
            .update({ activities, status: 'claimed', updated_at: new Date().toISOString() })
            .eq('id', invitation.id);
        if (updateInvitationError) return json({ error: updateInvitationError.message }, 500);

        return json({ success: true });
    } catch (error) {
        return json({ error: error instanceof Error ? error.message : 'Unable to update family permissions.' }, 500);
    }
});

function json(body: Record<string, unknown>, status = 200) {
    return new Response(JSON.stringify(body), {
        status,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    });
}
