import { createClient } from '@supabase/supabase-js';

// These environment variables will be filled in .env.local
const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;

if (!supabaseUrl || !supabaseKey) {
    console.warn("Supabase Keys missing! Make sure to set NEXT_PUBLIC_SUPABASE_URL and NEXT_PUBLIC_SUPABASE_ANON_KEY in .env.local");
}

export const supabase = createClient(supabaseUrl, supabaseKey);

// --- NEW: Admin Client ---
// Only available on the server (because it uses the secret key)
export const getSupabaseAdmin = () => {
    const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
    if (!serviceRoleKey) {
        throw new Error("Missing SUPABASE_SERVICE_ROLE_KEY");
    }
    return createClient(supabaseUrl, serviceRoleKey, {
        auth: {
            autoRefreshToken: false,
            persistSession: false
        }
    });
};
