import { createClient } from '@supabase/supabase-js';

const supabaseUrl = 'https://dotghtrkxarpkvbvkyve.supabase.co';
const supabaseAnonKey = 'sb_publishable_JG0rr9qneVo1INowBRFhw_TsqkMCYp'; 

export const supabase = createClient(supabaseUrl, supabaseAnonKey);