import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.116.0';

const corsHeaders = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
    'Access-Control-Allow-Methods': 'POST, OPTIONS'
};

const PLANS = {
    plus: { monthly: 6, yearly: 57.6 },
    pro: { monthly: 12, yearly: 115.2 }
} as const;

Deno.serve(async request => {
    if (request.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders });

    try {
        const authorization = request.headers.get('Authorization');
        if (!authorization) return json({ error: 'Authentication required.' }, 401);

        const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
        const publishableKey = Deno.env.get('SUPABASE_PUBLISHABLE_KEY') || Deno.env.get('SUPABASE_ANON_KEY')!;
        const userClient = createClient(supabaseUrl, publishableKey, {
            global: { headers: { Authorization: authorization } }
        });
        const { data: userData, error: userError } = await userClient.auth.getUser();
        if (userError || !userData.user) return json({ error: 'Authentication required.' }, 401);

        const body = await request.json();
        const orderId = String(body.orderId || '').trim();
        if (!orderId) return json({ error: 'PayPal order ID is required.' }, 400);

        const paypalClientId = Deno.env.get('PAYPAL_CLIENT_ID');
        const paypalClientSecret = Deno.env.get('PAYPAL_CLIENT_SECRET');
        if (!paypalClientId || !paypalClientSecret) return json({ error: 'PayPal is not configured on the server.' }, 503);

        const paypalBaseUrl = 'https://api-m.paypal.com';
        const tokenResponse = await fetch(`${paypalBaseUrl}/v1/oauth2/token`, {
            method: 'POST',
            headers: {
                Authorization: `Basic ${btoa(`${paypalClientId}:${paypalClientSecret}`)}`,
                'Content-Type': 'application/x-www-form-urlencoded'
            },
            body: 'grant_type=client_credentials'
        });
        if (!tokenResponse.ok) return json({ error: 'PayPal authentication failed.' }, 502);
        const { access_token: accessToken } = await tokenResponse.json();

        const captureResponse = await fetch(`${paypalBaseUrl}/v2/checkout/orders/${encodeURIComponent(orderId)}/capture`, {
            method: 'POST',
            headers: {
                Authorization: `Bearer ${accessToken}`,
                'Content-Type': 'application/json',
                'PayPal-Request-Id': crypto.randomUUID()
            }
        });
        const capture = await captureResponse.json();
        if (!captureResponse.ok) return json({ error: capture.message || 'Unable to capture PayPal payment.' }, 502);

        const purchaseUnit = capture.purchase_units?.[0];
        const customId = String(purchaseUnit?.payments?.captures?.[0]?.custom_id || purchaseUnit?.custom_id || '');
        const [userId, plan, billingCycle] = customId.split(':');
        const expectedAmount = PLANS[plan as keyof typeof PLANS]?.[billingCycle as 'monthly' | 'yearly'];
        const paidAmount = Number(purchaseUnit?.payments?.captures?.[0]?.amount?.value);
        const status = purchaseUnit?.payments?.captures?.[0]?.status;

        if (userId !== userData.user.id || !expectedAmount || paidAmount !== expectedAmount || status !== 'COMPLETED') {
            return json({ error: 'PayPal payment verification failed.' }, 400);
        }

        return json({ plan, billingCycle, status });
    } catch (error) {
        return json({ error: error instanceof Error ? error.message : 'Unable to capture PayPal payment.' }, 500);
    }
});

function json(body: Record<string, unknown>, status = 200) {
    return new Response(JSON.stringify(body), {
        status,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    });
}
