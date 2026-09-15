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

type PlanId = keyof typeof PLANS;
type BillingCycle = 'monthly' | 'yearly';

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
        const plan = String(body.plan || '') as PlanId;
        const billingCycle = String(body.billingCycle || 'monthly') as BillingCycle;
        const amount = PLANS[plan]?.[billingCycle];
        if (!amount) return json({ error: 'Invalid paid plan or billing cycle.' }, 400);

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

        const orderResponse = await fetch(`${paypalBaseUrl}/v2/checkout/orders`, {
            method: 'POST',
            headers: {
                Authorization: `Bearer ${accessToken}`,
                'Content-Type': 'application/json',
                'PayPal-Request-Id': crypto.randomUUID()
            },
            body: JSON.stringify({
                intent: 'CAPTURE',
                purchase_units: [{
                    custom_id: `${userData.user.id}:${plan}:${billingCycle}`,
                    description: `LifeOS ${plan === 'pro' ? 'Family Pro' : 'Plus'} (${billingCycle})`,
                    amount: { currency_code: 'USD', value: amount.toFixed(2) }
                }]
            })
        });
        const order = await orderResponse.json();
        if (!orderResponse.ok || !order.id) return json({ error: order.message || 'Unable to create PayPal order.' }, 502);

        return json({ orderId: order.id });
    } catch (error) {
        return json({ error: error instanceof Error ? error.message : 'Unable to create PayPal order.' }, 500);
    }
});

function json(body: Record<string, unknown>, status = 200) {
    return new Response(JSON.stringify(body), {
        status,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    });
}
