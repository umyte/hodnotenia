// supabaseClient.js
console.log('supabaseClient loaded');

const SUPABASE_URL = 'https://iybzblzjubwhvtlmfejs.supabase.co';
const SUPABASE_ANON_KEY = 'sb_publishable_YcANu93t-r5_zA9Qflj-bQ_dd-x8m8m';

import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

export const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

