import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';

// Load environment variables
dotenv.config({ path: '/app/backend/.env' });

const supabaseUrl = process.env.SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl || !supabaseKey) {
    console.error('❌ Missing Supabase credentials');
    process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseKey);

async function createAuthUser() {
    try {
        console.log('🔧 Creating auth user for tylerans@gmail.com...');
        
        // Get the existing profile
        const { data: profile, error: profileError } = await supabase
            .from('profiles')
            .select('*')
            .eq('email', 'tylerans@gmail.com')
            .single();
        
        if (profileError || !profile) {
            console.error('❌ Profile not found:', profileError);
            return;
        }
        
        console.log('✅ Found existing profile:', {
            id: profile.id,
            email: profile.email,
            name: profile.name,
            is_admin: profile.is_admin
        });
        
        // Create the auth user with the same ID as the profile
        console.log('🔧 Creating Supabase auth user...');
        const { data: authUser, error: authError } = await supabase.auth.admin.createUser({
            user_id: profile.id, // Use the existing profile ID
            email: profile.email,
            password: 'password123', // Set a default password
            email_confirm: true, // Auto-confirm email
            user_metadata: {
                name: profile.name,
                firstName: profile.name?.split(' ')[0] || 'Tyler',
                lastName: profile.name?.split(' ')[1] || 'A'
            }
        });
        
        if (authError) {
            console.error('❌ Error creating auth user:', authError);
            return;
        }
        
        console.log('✅ Auth user created successfully:', {
            id: authUser.user.id,
            email: authUser.user.email,
            email_confirmed_at: authUser.user.email_confirmed_at
        });
        
        // Verify the admin check now works
        console.log('🔍 Testing admin check...');
        const { data: adminCheck, error: adminError } = await supabase
            .from('profiles')
            .select('is_admin')
            .eq('id', authUser.user.id)
            .single();
        
        if (adminError) {
            console.error('❌ Admin check failed:', adminError);
        } else {
            console.log('✅ Admin check result:', adminCheck);
            if (adminCheck.is_admin === true) {
                console.log('🎉 User now has admin access!');
            } else {
                console.log('❌ User still does not have admin access');
            }
        }
        
    } catch (error) {
        console.error('❌ Unexpected error:', error);
    }
}

// Run the fix
createAuthUser().then(() => {
    console.log('✅ Auth user creation completed');
    process.exit(0);
}).catch(error => {
    console.error('❌ Auth user creation failed:', error);
    process.exit(1);
});