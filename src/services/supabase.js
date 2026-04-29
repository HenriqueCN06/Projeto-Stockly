import 'react-native-url-polyfill/auto';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { createClient } from '@supabase/supabase-js';

// Substitua pela sua URL base
const supabaseUrl = 'https://wrdgwzkepfewyjfvyjiy.supabase.co';

// Substitua pela sua chave pública (Publishable key)
const supabaseAnonKey = 'sb_publishable_C3CdBEToLOgOVRe2rdC4Kw_YtcyAZx5';

export const supabase = createClient(supabaseUrl, supabaseAnonKey, {
  auth: {
    storage: AsyncStorage,
    autoRefreshToken: true,
    persistSession: true,
    detectSessionInUrl: false,
  },
});