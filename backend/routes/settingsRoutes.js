import express from 'express';
const router = express.Router();
import supabase from '../services/supabase.js';
import { verifyAuthToken } from '../middlewares/authMiddleware.js';

/**
 * Get global admin Gemini API key
 * GET /api/settings/admin-gemini-key
 * Returns the global Gemini key set by super admin (if available)
 */
router.get('/admin-gemini-key', async (req, res) => {
    try {
        // Fetch global settings from super admin profile
        const { data: adminProfile, error } = await supabase
            .from('profiles')
            .select('global_gemini_key')
            .eq('is_admin', true)
            .single();

        if (error && error.code !== 'PGRST116') { // PGRST116 = no rows returned
            throw error;
        }

        // Return key if exists, otherwise return null
        res.json({ 
            globalGeminiKey: adminProfile?.global_gemini_key || null,
            hasGlobalKey: !!adminProfile?.global_gemini_key
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
router.post('/admin-gemini-key', verifyAuthToken, async (req, res) => {
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
