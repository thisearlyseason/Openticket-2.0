import supabase from '../services/supabase.js';

/**
 * Link guest purchases to user account by email
 * Called after signup or first login to attach orphaned tickets
 */
const linkGuestPurchasesToUser = async (userId, email) => {
    try {
        const normalizedEmail = email.toLowerCase().trim();
        console.log(`[Auth] Linking guest purchases for ${normalizedEmail} to user ${userId}`);
        
        // Find all registrations with matching email but no user_id
        const { data: guestRegs, error: fetchError } = await supabase
            .from('registrations')
            .select('id')
            .ilike('attendee_email', normalizedEmail)
            .is('user_id', null);
        
        if (fetchError) {
            console.error('[Auth] Error fetching guest registrations:', fetchError);
            return { linked: 0 };
        }
        
        if (!guestRegs || guestRegs.length === 0) {
            console.log('[Auth] No guest purchases found to link');
            return { linked: 0 };
        }
        
        // Update all found registrations to link to this user
        const regIds = guestRegs.map(r => r.id);
        const { error: updateError } = await supabase
            .from('registrations')
            .update({ user_id: userId })
            .in('id', regIds);
        
        if (updateError) {
            console.error('[Auth] Error linking registrations:', updateError);
            return { linked: 0, error: updateError.message };
        }
        
        console.log(`[Auth] ✅ Linked ${guestRegs.length} guest purchase(s) to user ${userId}`);
        return { linked: guestRegs.length };
    } catch (err) {
        console.error('[Auth] Link guest purchases error:', err);
        return { linked: 0, error: err.message };
    }
};

export const signup = async (req, res) => {
    try {
        const { email, password, firstName, lastName } = req.body;
        const { data, error } = await supabase.auth.admin.createUser({
            email,
            password,
            user_metadata: { firstName, lastName },
            email_confirm: true
        });

        if (error) throw error;
        
        // Link any existing guest purchases to the new account
        if (data.user) {
            const linkResult = await linkGuestPurchasesToUser(data.user.id, email);
            console.log(`[Auth] Signup complete. Linked ${linkResult.linked} existing tickets.`);
        }
        
        res.status(201).json({ user: data.user });
    } catch (error) {
        res.status(400).json({ error: error.message });
    }
};

export const login = async (req, res) => {
    try {
        const { email, password } = req.body;
        const { data, error } = await supabase.auth.signInWithPassword({ email, password });
        if (error) throw error;
        
        // Link any guest purchases on login (in case they bought tickets before creating account)
        if (data.user) {
            const linkResult = await linkGuestPurchasesToUser(data.user.id, email);
            if (linkResult.linked > 0) {
                console.log(`[Auth] Login: Linked ${linkResult.linked} guest ticket(s) to account`);
            }
        }
        
        // Return both session and token for compatibility
        res.json({ 
            session: data.session,
            user: data.user,
            token: data.session.access_token  // Add access_token as token field
        });
    } catch (error) {
        res.status(401).json({ error: error.message });
    }
};
