import { createClient } from '@supabase/supabase-js';

const viteEnv = import.meta.env || {};
const runtimeConfig = window.__LIFEOS_SUPABASE__ || {};
const supabaseUrl = viteEnv.VITE_SUPABASE_URL || runtimeConfig.url;
const supabasePublishableKey = viteEnv.VITE_SUPABASE_PUBLISHABLE_KEY || runtimeConfig.publishableKey;

export const supabaseConfigured = Boolean(supabaseUrl && supabasePublishableKey);

export const supabase = supabaseConfigured
    ? createClient(supabaseUrl, supabasePublishableKey)
    : null;

export async function checkSupabaseConnection() {
    if (!supabase) {
        return { connected: false, reason: 'missing-config' };
    }

    const { error } = await supabase.auth.getSession();
    return error
        ? { connected: false, reason: error.message }
        : { connected: true };
}
