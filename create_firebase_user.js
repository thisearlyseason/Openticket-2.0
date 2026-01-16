import admin from 'firebase-admin';
import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';

// Load environment variables
dotenv.config({ path: '/app/backend/.env' });

// Initialize Firebase Admin
const serviceAccount = {
    type: "service_account",
    project_id: process.env.FIREBASE_PROJECT_ID,
    client_email: process.env.FIREBASE_CLIENT_EMAIL,
    private_key: process.env.FIREBASE_PRIVATE_KEY?.replace(/\\n/g, '\n')
};

if (!admin.apps.length) {
    admin.initializeApp({
        credential: admin.credential.cert(serviceAccount),
        projectId: process.env.FIREBASE_PROJECT_ID
    });
}

// Initialize Supabase
const supabaseUrl = process.env.SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
const supabase = createClient(supabaseUrl, supabaseKey);

async function createFirebaseUser() {
    try {
        console.log('🔧 Creating Firebase user for tylerans@gmail.com...');
        
        // Get the existing profile from Supabase
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
            name: profile.name,
            is_admin: profile.is_admin
        });
        
        // Check if Firebase user already exists
        try {
            const existingUser = await admin.auth().getUserByEmail('tylerans@gmail.com');
            console.log('🗑️ Deleting existing Firebase user...');
            await admin.auth().deleteUser(existingUser.uid);
            console.log('✅ Existing Firebase user deleted');
        } catch (e) {
            console.log('ℹ️ No existing Firebase user found');
        }
        
        // Create Firebase user with the same ID as the Supabase profile
        console.log('🔧 Creating Firebase user...');
        const firebaseUser = await admin.auth().createUser({
            uid: profile.id, // Use the Supabase profile ID
            email: profile.email,
            password: 'password123',
            displayName: profile.name,
            emailVerified: true
        });
        
        console.log('✅ Firebase user created:', {
            uid: firebaseUser.uid,
            email: firebaseUser.email,
            displayName: firebaseUser.displayName
        });
        
        // Verify the IDs match
        if (firebaseUser.uid === profile.id) {
            console.log('✅ Firebase UID matches Supabase profile ID!');
        } else {
            console.log('❌ ID mismatch - this should not happen');
            return;
        }
        
        // Test the admin check with Firebase UID
        console.log('🔍 Testing admin check with Firebase UID...');
        const { data: adminCheck, error: adminError } = await supabase
            .from('profiles')
            .select('is_admin, email, name')
            .eq('id', firebaseUser.uid)
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
                console.log('🚀 Ready to test DataTable with Firebase authentication!');
            }
        }
        
        // Delete the Supabase auth user we created earlier (not needed)
        try {
            const { data: supabaseUsers } = await supabase.auth.admin.listUsers();
            const supabaseUser = supabaseUsers.users.find(u => u.email === 'tylerans@gmail.com');
            if (supabaseUser) {
                await supabase.auth.admin.deleteUser(supabaseUser.id);
                console.log('✅ Cleaned up Supabase auth user');
            }
        } catch (e) {
            console.log('ℹ️ No Supabase auth user to clean up');
        }
        
    } catch (error) {
        console.error('❌ Unexpected error:', error);
    }
}

// Run the Firebase user creation
createFirebaseUser().then(() => {
    console.log('✅ Firebase user creation completed');
    process.exit(0);
}).catch(error => {
    console.error('❌ Firebase user creation failed:', error);
    process.exit(1);
});