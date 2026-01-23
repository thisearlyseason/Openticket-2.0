import express from 'express';
const router = express.Router();
import supabase from '../services/supabase.js';
import verifyFirebaseToken from '../middlewares/authMiddleware.js';

/**
 * Get global admin Gemini API key
 * GET /api/settings/admin-gemini-key
 * Returns the global Gemini key set by super admin (if available)
 * Searches ALL admin profiles for a non-null global_gemini_key
 */
router.get('/admin-gemini-key', async (req, res) => {
    try {
        // Fetch global settings from any super admin profile that has a key set
        const { data: adminProfiles, error } = await supabase
            .from('profiles')
            .select('global_gemini_key')
            .eq('is_admin', true)
            .not('global_gemini_key', 'is', null);

        if (error) {
            throw error;
        }

        // Find the first admin with a key set
        const adminWithKey = adminProfiles?.find(p => p.global_gemini_key);
        
        // Return key if exists, otherwise return null
        res.json({ 
            globalGeminiKey: adminWithKey?.global_gemini_key || null,
            hasGlobalKey: !!adminWithKey?.global_gemini_key
        });
    } catch (error) {
        console.error('Error fetching admin Gemini key:', error);
        res.status(500).json({ error: error.message, globalGeminiKey: null });
    }
});

/**
 * Set global admin Gemini API key (Super Admin only)
 * POST /api/settings/admin-gemini-key
 * Sets a global Gemini key that all users can use if they don't have their own
 */
router.post('/admin-gemini-key', verifyFirebaseToken, async (req, res) => {
    try {
        const { globalGeminiKey } = req.body;
        const userId = req.user.uid;

        // Verify user is super admin
        const { data: profile } = await supabase
            .from('profiles')
            .select('is_admin')
            .eq('id', userId)
            .single();

        if (!profile?.is_admin) {
            return res.status(403).json({ error: 'Unauthorized: Admin access required' });
        }

        // Update the admin's profile with global key
        const { error } = await supabase
            .from('profiles')
            .update({ global_gemini_key: globalGeminiKey || null })
            .eq('id', userId);

        if (error) throw error;

        res.json({ 
            success: true, 
            message: globalGeminiKey ? 'Global Gemini key updated' : 'Global Gemini key removed',
            hasGlobalKey: !!globalGeminiKey
        });
    } catch (error) {
        console.error('Error setting admin Gemini key:', error);
        res.status(500).json({ error: error.message });
    }
});

export default router;
