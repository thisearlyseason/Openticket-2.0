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

async function fixAuthSync() {
    try {
        console.log('🔧 Alternative approach: Delete auth user and recreate with profile ID...');
        
        // Get the existing profile
        const { data: profile, error: profileError } = await supabase
            .from('profiles')
            .select('*')
            .eq('email', 'tylerans@gmail.com')
            .single();
        
        if (profileError) {
            console.error('❌ Profile error:', profileError);
            return;
        }
        
        console.log('✅ Found profile:', {
            id: profile.id,
            email: profile.email,
            is_admin: profile.is_admin
        });
        
        // Get the auth user
        const { data: authUsers, error: authError } = await supabase.auth.admin.listUsers();
        if (authError) {
            console.error('❌ Error fetching auth users:', authError);
            return;
        }
        
        const authUser = authUsers.users.find(u => u.email === 'tylerans@gmail.com');
        if (authUser) {
            console.log('🗑️ Deleting existing auth user...');
            const { error: deleteAuthError } = await supabase.auth.admin.deleteUser(authUser.id);
            if (deleteAuthError) {
                console.error('❌ Error deleting auth user:', deleteAuthError);
                return;
            }
            console.log('✅ Auth user deleted');
        }
        
        // Create new auth user with the profile ID
        console.log('🔧 Creating new auth user with profile ID...');
        const { data: newAuthUser, error: createAuthError } = await supabase.auth.admin.createUser({
            user_id: profile.id, // Use the existing profile ID
            email: profile.email,
            password: 'password123',
            email_confirm: true,
            user_metadata: {
                name: profile.name,
                firstName: profile.name?.split(' ')[0] || 'Tyler',
                lastName: profile.name?.split(' ')[1] || 'A'
            }
        });
        
        if (createAuthError) {
            console.error('❌ Error creating auth user:', createAuthError);
            return;
        }
        
        console.log('✅ New auth user created:', {
            id: newAuthUser.user.id,
            email: newAuthUser.user.email
        });
        
        // Verify IDs match
        if (newAuthUser.user.id === profile.id) {
            console.log('✅ IDs match perfectly!');
        } else {
            console.log('❌ IDs still don\'t match');
            return;
        }
        
        // Test admin check
        console.log('🔍 Testing admin check...');
        const { data: adminCheck, error: adminError } = await supabase
            .from('profiles')
            .select('is_admin')
            .eq('id', newAuthUser.user.id)
            .single();
        
        if (adminError) {
            console.error('❌ Admin check failed:', adminError);
        } else {
            console.log('✅ Admin check result:', adminCheck);
            if (adminCheck.is_admin === true) {
                console.log('🎉 User now has admin access!');
                console.log('📝 Login credentials:');
                console.log('   Email: tylerans@gmail.com');
                console.log('   Password: password123');
            } else {
                console.log('❌ User still does not have admin access');
            }
        }
        
    } catch (error) {
        console.error('❌ Unexpected error:', error);
    }
}

// Run the fix
fixAuthSync().then(() => {
    console.log('✅ Auth sync fix completed');
    process.exit(0);
}).catch(error => {
    console.error('❌ Auth sync fix failed:', error);
    process.exit(1);
});