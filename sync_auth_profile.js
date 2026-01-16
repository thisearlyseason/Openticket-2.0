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

async function syncAuthAndProfile() {
    try {
        console.log('🔧 Syncing auth user and profile for tylerans@gmail.com...');
        
        // Get the auth user
        const { data: authUsers, error: authError } = await supabase.auth.admin.listUsers();
        if (authError) {
            console.error('❌ Error fetching auth users:', authError);
            return;
        }
        
        const authUser = authUsers.users.find(u => u.email === 'tylerans@gmail.com');
        if (!authUser) {
            console.error('❌ Auth user not found');
            return;
        }
        
        console.log('✅ Found auth user:', {
            id: authUser.id,
            email: authUser.email
        });
        
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
        
        // Delete the old profile and create a new one with the auth user ID
        console.log('🔧 Updating profile to match auth user ID...');
        
        // First, delete the old profile
        const { error: deleteError } = await supabase
            .from('profiles')
            .delete()
            .eq('email', 'tylerans@gmail.com');
        
        if (deleteError) {
            console.error('❌ Error deleting old profile:', deleteError);
            return;
        }
        
        // Create new profile with auth user ID
        const { data: newProfile, error: insertError } = await supabase
            .from('profiles')
            .insert({
                id: authUser.id,
                email: profile.email,
                name: profile.name,
                role: 'admin',
                is_admin: true,
                business_name: profile.business_name,
                business_type: profile.business_type,
                created_at: new Date().toISOString()
            })
            .select()
            .single();
        
        if (insertError) {
            console.error('❌ Error creating new profile:', insertError);
            return;
        }
        
        console.log('✅ New profile created:', {
            id: newProfile.id,
            email: newProfile.email,
            is_admin: newProfile.is_admin
        });
        
        // Test admin check
        console.log('🔍 Testing admin check...');
        const { data: adminCheck, error: adminError } = await supabase
            .from('profiles')
            .select('is_admin')
            .eq('id', authUser.id)
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

// Run the sync
syncAuthAndProfile().then(() => {
    console.log('✅ Sync completed');
    process.exit(0);
}).catch(error => {
    console.error('❌ Sync failed:', error);
    process.exit(1);
});