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

async function debugAuthIssue() {
    try {
        console.log('🔍 Debugging authentication issue for tylerans@gmail.com...');
        
        // Check Supabase auth users
        console.log('\n1. Checking Supabase auth users...');
        const { data: authUsers, error: authError } = await supabase.auth.admin.listUsers();
        
        if (authError) {
            console.error('❌ Error fetching auth users:', authError);
        } else {
            const targetUser = authUsers.users.find(u => u.email === 'tylerans@gmail.com');
            if (targetUser) {
                console.log('✅ Found auth user:', {
                    id: targetUser.id,
                    email: targetUser.email,
                    created_at: targetUser.created_at,
                    email_confirmed_at: targetUser.email_confirmed_at,
                    last_sign_in_at: targetUser.last_sign_in_at
                });
            } else {
                console.log('❌ Auth user not found');
            }
        }
        
        // Check profiles table
        console.log('\n2. Checking profiles table...');
        const { data: profiles, error: profileError } = await supabase
            .from('profiles')
            .select('*')
            .eq('email', 'tylerans@gmail.com');
        
        if (profileError) {
            console.error('❌ Error fetching profiles:', profileError);
        } else {
            console.log(`✅ Found ${profiles.length} profile(s):`);
            profiles.forEach(profile => {
                console.log({
                    id: profile.id,
                    email: profile.email,
                    name: profile.name,
                    role: profile.role,
                    is_admin: profile.is_admin,
                    created_at: profile.created_at
                });
            });
        }
        
        // Check if IDs match
        if (authUsers && profiles && profiles.length > 0) {
            const authUser = authUsers.users.find(u => u.email === 'tylerans@gmail.com');
            const profile = profiles[0];
            
            console.log('\n3. Checking ID consistency...');
            if (authUser && profile) {
                console.log(`Auth user ID: ${authUser.id}`);
                console.log(`Profile ID: ${profile.id}`);
                
                if (authUser.id === profile.id) {
                    console.log('✅ IDs match - authentication should work');
                } else {
                    console.log('❌ ID mismatch - this is the problem!');
                    console.log('🔧 Need to update profile ID to match auth user ID');
                    
                    // Fix the ID mismatch
                    console.log('\n4. Fixing ID mismatch...');
                    const { error: updateError } = await supabase
                        .from('profiles')
                        .update({ id: authUser.id })
                        .eq('email', 'tylerans@gmail.com');
                    
                    if (updateError) {
                        console.error('❌ Error updating profile ID:', updateError);
                    } else {
                        console.log('✅ Profile ID updated successfully');
                    }
                }
            }
        }
        
        // Test admin check query (simulate what the middleware does)
        console.log('\n5. Testing admin check query...');
        if (authUsers) {
            const authUser = authUsers.users.find(u => u.email === 'tylerans@gmail.com');
            if (authUser) {
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
                        console.log('✅ User should have admin access');
                    } else {
                        console.log('❌ User does not have admin access');
                    }
                }
            }
        }
        
    } catch (error) {
        console.error('❌ Unexpected error:', error);
    }
}

// Run the debug
debugAuthIssue().then(() => {
    console.log('\n✅ Debug completed');
    process.exit(0);
}).catch(error => {
    console.error('❌ Debug failed:', error);
    process.exit(1);
});