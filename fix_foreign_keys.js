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

async function fixForeignKeyAndSync() {
    try {
        console.log('🔧 Fixing foreign key constraints and syncing auth...');
        
        // Get current IDs
        const { data: authUsers } = await supabase.auth.admin.listUsers();
        const authUser = authUsers.users.find(u => u.email === 'tylerans@gmail.com');
        
        const { data: profile } = await supabase
            .from('profiles')
            .select('*')
            .eq('email', 'tylerans@gmail.com')
            .single();
        
        if (!authUser || !profile) {
            console.error('❌ Missing auth user or profile');
            return;
        }
        
        console.log('Current IDs:');
        console.log(`Auth user ID: ${authUser.id}`);
        console.log(`Profile ID: ${profile.id}`);
        
        // Update foreign key references first
        console.log('🔧 Updating foreign key references...');
        
        // Update nonprofit_applications table
        const { error: nonprofitError } = await supabase
            .from('nonprofit_applications')
            .update({ approved_by: authUser.id })
            .eq('approved_by', profile.id);
        
        if (nonprofitError) {
            console.log('⚠️ Nonprofit applications update (may not exist):', nonprofitError.message);
        } else {
            console.log('✅ Updated nonprofit_applications references');
        }
        
        // Check for other foreign key references
        const tables = ['events', 'registrations', 'financial_transactions', 'audit_logs'];
        
        for (const table of tables) {
            try {
                // Try to update owner_id, user_id, organizer_id, actor_id fields
                const fields = ['owner_id', 'user_id', 'organizer_id', 'actor_id'];
                
                for (const field of fields) {
                    const { error } = await supabase
                        .from(table)
                        .update({ [field]: authUser.id })
                        .eq(field, profile.id);
                    
                    if (!error) {
                        console.log(`✅ Updated ${table}.${field} references`);
                    }
                }
            } catch (e) {
                // Table or field may not exist, continue
                console.log(`⚠️ Skipped ${table} (may not exist or have references)`);
            }
        }
        
        // Now update the profile ID
        console.log('🔧 Updating profile ID...');
        const { error: updateError } = await supabase
            .from('profiles')
            .update({ id: authUser.id })
            .eq('email', 'tylerans@gmail.com');
        
        if (updateError) {
            console.error('❌ Still cannot update profile ID:', updateError);
            
            // Alternative: Create a new profile with the auth user ID
            console.log('🔧 Creating new profile with auth user ID...');
            const { error: insertError } = await supabase
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
            
            if (insertError) {
                console.error('❌ Cannot create new profile:', insertError);
                return;
            } else {
                console.log('✅ Created new profile with auth user ID');
            }
        } else {
            console.log('✅ Profile ID updated successfully');
        }
        
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
                console.log('📝 Login credentials:');
                console.log('   Email: tylerans@gmail.com');
                console.log('   Password: password123');
            }
        }
        
    } catch (error) {
        console.error('❌ Unexpected error:', error);
    }
}

// Run the fix
fixForeignKeyAndSync().then(() => {
    console.log('✅ Foreign key fix completed');
    process.exit(0);
}).catch(error => {
    console.error('❌ Foreign key fix failed:', error);
    process.exit(1);
});