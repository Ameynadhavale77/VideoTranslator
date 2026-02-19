import { createClient } from '@supabase/supabase-js';

// Lazy initialization to avoid build-time errors when env vars are missing
export const getSupabaseClient = () => {
    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
    const supabaseKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;
    if (!supabaseUrl || !supabaseKey) {
        throw new Error("Missing Supabase Keys");
    }
    return createClient(supabaseUrl, supabaseKey);
};

// --- Admin Client ---
// Only available on the server (because it uses the secret key)
export const getSupabaseAdmin = () => {
    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
    const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

    if (!supabaseUrl || !serviceRoleKey) {
        throw new Error("Missing SUPABASE_SERVICE_ROLE_KEY or URL");
    }
    return createClient(supabaseUrl, serviceRoleKey, {
        auth: {
            autoRefreshToken: false,
            persistSession: false
        }
    });
};
