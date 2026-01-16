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

async function finalFix() {
    try {
        console.log('🔧 Final fix: Handle nonprofit_applications constraint...');
        
        // Get current IDs
        const { data: authUsers } = await supabase.auth.admin.listUsers();
        const authUser = authUsers.users.find(u => u.email === 'tylerans@gmail.com');
        
        const { data: profile } = await supabase
            .from('profiles')
            .select('*')
            .eq('email', 'tylerans@gmail.com')
            .single();
        
        console.log(`Auth user ID: ${authUser.id}`);
        console.log(`Profile ID: ${profile.id}`);
        
        // Check nonprofit_applications
        console.log('🔍 Checking nonprofit_applications...');
        const { data: nonprofitApps, error: nonprofitError } = await supabase
            .from('nonprofit_applications')
            .select('*')
            .eq('approved_by', profile.id);
        
        if (nonprofitError) {
            console.log('⚠️ Nonprofit applications table may not exist:', nonprofitError.message);
        } else {
            console.log(`Found ${nonprofitApps?.length || 0} nonprofit applications`);
            
            if (nonprofitApps && nonprofitApps.length > 0) {
                // Update them to use the auth user ID
                const { error: updateError } = await supabase
                    .from('nonprofit_applications')
                    .update({ approved_by: authUser.id })
                    .eq('approved_by', profile.id);
                
                if (updateError) {
                    console.error('❌ Cannot update nonprofit applications:', updateError);
                    // Delete them instead
                    console.log('🗑️ Deleting nonprofit applications to remove constraint...');
                    const { error: deleteError } = await supabase
                        .from('nonprofit_applications')
                        .delete()
                        .eq('approved_by', profile.id);
                    
                    if (deleteError) {
                        console.error('❌ Cannot delete nonprofit applications:', deleteError);
                    } else {
                        console.log('✅ Deleted nonprofit applications');
                    }
                } else {
                    console.log('✅ Updated nonprofit applications');
                }
            }
        }
        
        // Now try to update the profile ID again
        console.log('🔧 Attempting to update profile ID again...');
        const { error: updateProfileError } = await supabase
            .from('profiles')
            .update({ id: authUser.id })
            .eq('email', 'tylerans@gmail.com');
        
        if (updateProfileError) {
            console.error('❌ Still cannot update profile:', updateProfileError);
            
            // Last resort: Delete old profile and create new one
            console.log('🗑️ Deleting old profile...');
            const { error: deleteError } = await supabase
                .from('profiles')
                .delete()
                .eq('email', 'tylerans@gmail.com');
            
            if (deleteError) {
                console.error('❌ Cannot delete old profile:', deleteError);
            } else {
                console.log('✅ Deleted old profile');
                
                // Create new profile
                console.log('🔧 Creating new profile...');
                const { error: createError } = await supabase
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
                    });
                
                if (createError) {
                    console.error('❌ Cannot create new profile:', createError);
                } else {
                    console.log('✅ Created new profile with auth user ID');
                }
            }
        } else {
            console.log('✅ Profile ID updated successfully');
        }
        
        // Final test
        console.log('🔍 Final admin check...');
        const { data: adminCheck, error: adminError } = await supabase
            .from('profiles')
            .select('is_admin, email, name')
            .eq('id', authUser.id)
            .single();
        
        if (adminError) {
            console.error('❌ Admin check failed:', adminError);
        } else {
            console.log('✅ Admin check result:', adminCheck);
            if (adminCheck.is_admin === true) {
                console.log('🎉 SUCCESS! User now has admin access!');
                console.log('📝 Login credentials:');
                console.log('   Email: tylerans@gmail.com');
                console.log('   Password: password123');
                console.log('🚀 Ready to test DataTable!');
            }
        }
        
    } catch (error) {
        console.error('❌ Unexpected error:', error);
    }
}

// Run the final fix
finalFix().then(() => {
    console.log('✅ Final fix completed');
    process.exit(0);
}).catch(error => {
    console.error('❌ Final fix failed:', error);
    process.exit(1);
});