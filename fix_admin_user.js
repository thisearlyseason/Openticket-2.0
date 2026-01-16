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

async function fixAdminUser() {
    try {
        console.log('🔍 Checking current user status for tylerans@gmail.com...');
        
        // First, check if user exists
        const { data: existingUser, error: checkError } = await supabase
            .from('profiles')
            .select('id, email, name, role, is_admin')
            .eq('email', 'tylerans@gmail.com')
            .single();
        
        if (checkError) {
            console.error('❌ Error checking user:', checkError);
            return;
        }
        
        if (!existingUser) {
            console.log('❌ User tylerans@gmail.com not found in database');
            return;
        }
        
        console.log('✅ User found:', {
            id: existingUser.id,
            email: existingUser.email,
            name: existingUser.name,
            role: existingUser.role,
            is_admin: existingUser.is_admin
        });
        
        if (existingUser.is_admin === true) {
            console.log('✅ User already has admin privileges');
            return;
        }
        
        console.log('🔧 Updating user to admin...');
        
        // Update user to admin
        const { data: updatedUser, error: updateError } = await supabase
            .from('profiles')
            .update({
                role: 'admin',
                is_admin: true
            })
            .eq('email', 'tylerans@gmail.com')
            .select()
            .single();
        
        if (updateError) {
            console.error('❌ Error updating user:', updateError);
            return;
        }
        
        console.log('✅ User successfully updated to admin:', {
            id: updatedUser.id,
            email: updatedUser.email,
            name: updatedUser.name,
            role: updatedUser.role,
            is_admin: updatedUser.is_admin
        });
        
        console.log('🎉 Admin privileges granted successfully!');
        
    } catch (error) {
        console.error('❌ Unexpected error:', error);
    }
}

// Run the fix
fixAdminUser().then(() => {
    console.log('✅ Script completed');
    process.exit(0);
}).catch(error => {
    console.error('❌ Script failed:', error);
    process.exit(1);
});