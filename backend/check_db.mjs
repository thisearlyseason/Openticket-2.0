import './services/supabase.js';
import supabase from './services/supabase.js';

const { data, error } = await supabase
  .from('events')
  .select('id, title, owner_id, kiosk_enabled')
  .order('created_at', { ascending: false })
  .limit(3);

if (error) console.error('Error:', error);
console.log('Recent Events:', JSON.stringify(data, null, 2));

const { data: tokens } = await supabase
  .from('kiosk_tokens')
  .select('*')
  .order('created_at', { ascending: false })
  .limit(3);

console.log('\nRecent Tokens:', JSON.stringify(tokens, null, 2));
