import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.116.0';

const corsHeaders = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
    'Access-Control-Allow-Methods': 'POST, OPTIONS'
};

Deno.serve(async request => {
    if (request.method === 'OPTIONS') {
        return new Response('ok', { headers: corsHeaders });
    }

    try {
        const authorization = request.headers.get('Authorization');
        if (!authorization) return json({ error: 'Authentication required.' }, 401);

        const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
        const publishableKey = Deno.env.get('SUPABASE_ANON_KEY')!;
        const serviceRoleKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
        const userClient = createClient(supabaseUrl, publishableKey, {
            global: { headers: { Authorization: authorization } }
        });
        const adminClient = createClient(supabaseUrl, serviceRoleKey);
        const { data: userData, error: userError } = await userClient.auth.getUser();
        if (userError || !userData.user) return json({ error: 'Authentication required.' }, 401);

        const body = await request.json();
        const email = String(body.email || '').trim().toLowerCase();
        const password = String(body.password || '');
        const name = String(body.name || '').trim();
        const relation = String(body.relation || 'Family').trim();
        const inviteCode = String(body.inviteCode || '').trim().toUpperCase();
        const activities = Array.isArray(body.activities) ? body.activities : [];

        if (!email || !name || !inviteCode || password.length < 6) {
            return json({ error: 'Name, email, invite code, and a password of at least 6 characters are required.' }, 400);
        }

        const { data: invitation, error: invitationError } = await adminClient
            .from('family_invitations')
            .select('id, owner_id, status')
            .eq('owner_id', userData.user.id)
            .eq('invite_code', inviteCode)
            .eq('status', 'pending')
            .maybeSingle();
        if (invitationError || !invitation) return json({ error: 'Family invitation was not found or is no longer pending.' }, 400);

        const { data: created, error: createError } = await adminClient.auth.admin.createUser({
            email,
            password,
            email_confirm: true,
            user_metadata: { name, relation, family_invite_code: inviteCode },
            app_metadata: { family_owner_id: userData.user.id, family_activities: activities }
        });
        if (createError) return json({ error: createError.message }, 400);

        const { error: updateError } = await adminClient
            .from('family_invitations')
            .update({ invited_email: email, member_name: name, relation, activities, invited_user_id: created.user.id, status: 'claimed', updated_at: new Date().toISOString() })
            .eq('id', invitation.id);
        if (updateError) return json({ error: updateError.message }, 500);

        return json({ success: true, userId: created.user.id });
    } catch (error) {
        return json({ error: error instanceof Error ? error.message : 'Unable to create family account.' }, 500);
    }
});

function json(body: Record<string, unknown>, status = 200) {
    return new Response(JSON.stringify(body), {
        status,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    });
}
