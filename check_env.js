
require('dotenv').config();
console.log('URL:', process.env.SUPABASE_URL);
console.log('KEY:', process.env.SUPABASE_SERVICE_ROLE_KEY ? 'Set' : 'Not Set');
