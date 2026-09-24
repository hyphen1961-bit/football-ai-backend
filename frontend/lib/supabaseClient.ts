import { createClient } from '@supabase/supabase-js';

// Diese zwei Werte findest du im Supabase-Dashboard unter
// Project Settings -> API. Als Vercel-Env-Variablen eintragen:
//   NEXT_PUBLIC_SUPABASE_URL
//   NEXT_PUBLIC_SUPABASE_ANON_KEY
const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;

export const supabase = createClient(supabaseUrl, supabaseAnonKey);
