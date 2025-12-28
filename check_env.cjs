
const dotenv = require('dotenv');
dotenv.config();
console.log('URL:', process.env.SUPABASE_URL);
console.log('KEY:', process.env.SUPABASE_SERVICE_ROLE_KEY ? 'Set' : 'Not Set');
console.log('DB_URL:', process.env.DATABASE_URL ? 'Set' : 'Not Set');
