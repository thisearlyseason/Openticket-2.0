/**
 * Presale Routes
 * Handles presale validation, code management, and access control
 */
import express from 'express';
const router = express.Router();
import supabase from '../services/supabase.js';
import verifyToken from '../middlewares/authMiddleware.js';
import crypto from 'crypto';

/**
 * Validate presale access for an event
 * POST /api/presale/:eventId/validate
 * Body: { code?: string, token?: string }
 * Returns: { hasAccess: boolean, reason: string, method?: string }
 */
router.post('/:eventId/validate', async (req, res) => {
    try {
        const { eventId } = req.params;
        const { code, token } = req.body;
        
        // Get user ID from token if authenticated
        let userId = null;
        const authHeader = req.headers.authorization;
        if (authHeader && authHeader.startsWith('Bearer ')) {
            try {
                const admin = (await import('firebase-admin')).default;
                const idToken = authHeader.split('Bearer ')[1];
                const decodedToken = await admin.auth().verifyIdToken(idToken);
                userId = decodedToken.uid;
            } catch (e) {
                // Not authenticated, continue without user
            }
        }
        
        // Get event with presale config
        const { data: event, error: eventError } = await supabase
            .from('events')
            .select('id, title, presale, created_by')
            .eq('id', eventId)
            .single();
        
        if (eventError || !event) {
            return res.status(404).json({ error: 'Event not found' });
        }
        
        // Check if presale is enabled and active
        const presale = event.presale;
        if (!presale || !presale.enabled) {
            return res.json({
                hasAccess: true,
                reason: 'Presale not enabled - general sale active',
                presaleActive: false
            });
        }
        
        const now = new Date();
        const presaleStart = new Date(presale.startDate);
        const presaleEnd = new Date(presale.endDate);
        
        // Check if we're in the presale window
        if (now < presaleStart) {
            return res.json({
                hasAccess: false,
                reason: 'Presale has not started yet',
                presaleActive: false,
                presaleStartDate: presale.startDate
            });
        }
        
        if (now > presaleEnd) {
            return res.json({
                hasAccess: true,
                reason: 'Presale has ended - general sale active',
                presaleActive: false
            });
        }
        
        // We're in the presale window - check access methods
        const accessMethods = presale.accessMethods || {};
        
        // 1. Check private link token
        if (accessMethods.privateLink && token && presale.privateToken) {
            if (token === presale.privateToken) {
                return res.json({
                    hasAccess: true,
                    reason: 'Access granted via private link',
                    method: 'privateLink',
                    presaleActive: true
                });
            }
        }
        
        // 2. Check presale code
        if (accessMethods.codes && code) {
            const { data: presaleCode, error: codeError } = await supabase
                .from('presale_codes')
                .select('*')
                .eq('event_id', eventId)
                .eq('code', code.toUpperCase())
                .single();
            
            if (!codeError && presaleCode) {
                // Check if code is expired
                if (presaleCode.expires_at && new Date(presaleCode.expires_at) < now) {
                    return res.json({
                        hasAccess: false,
                        reason: 'Presale code has expired',
                        presaleActive: true
                    });
                }
                
                // Check usage limits
                if (presaleCode.limit_type === 'single' && presaleCode.current_uses >= 1) {
                    return res.json({
                        hasAccess: false,
                        reason: 'Presale code has already been used',
                        presaleActive: true
                    });
                }
                
                if (presaleCode.limit_type === 'multi' && presaleCode.max_uses && presaleCode.current_uses >= presaleCode.max_uses) {
                    return res.json({
                        hasAccess: false,
                        reason: 'Presale code has reached its usage limit',
                        presaleActive: true
                    });
                }
                
                // Code is valid
                return res.json({
                    hasAccess: true,
                    reason: 'Access granted via presale code',
                    method: 'code',
                    codeId: presaleCode.id,
                    presaleActive: true
                });
            }
        }
        
        // 3. Check account-based eligibility
        if (accessMethods.accountFlag && userId) {
            const { data: profile, error: profileError } = await supabase
                .from('profiles')
                .select('presale_eligible')
                .eq('id', userId)
                .single();
            
            if (!profileError && profile?.presale_eligible) {
                return res.json({
                    hasAccess: true,
                    reason: 'Access granted via account eligibility',
                    method: 'account',
                    presaleActive: true
                });
            }
        }
        
        // No valid access method
        return res.json({
            hasAccess: false,
            reason: presale.generalSaleMessage || 'Presale in progress. General sale starts soon.',
            presaleActive: true,
            presaleEndDate: presale.endDate
        });
        
    } catch (error) {
        console.error('[Presale] Validation error:', error);
        res.status(500).json({ error: 'Failed to validate presale access' });
    }
});

/**
 * Get presale codes for an event (organizer only)
 * GET /api/presale/:eventId/codes
 */
router.get('/:eventId/codes', verifyToken, async (req, res) => {
    try {
        const { eventId } = req.params;
        const userId = req.user.uid;
        
        // Verify user owns this event
        const { data: event, error: eventError } = await supabase
            .from('events')
            .select('id, created_by')
            .eq('id', eventId)
            .single();
        
        if (eventError || !event) {
            return res.status(404).json({ error: 'Event not found' });
        }
        
        if (event.created_by !== userId) {
            return res.status(403).json({ error: 'Not authorized to view presale codes for this event' });
        }
        
        // Get presale codes
        const { data: codes, error: codesError } = await supabase
            .from('presale_codes')
            .select('*')
            .eq('event_id', eventId)
            .order('created_at', { ascending: false });
        
        if (codesError) {
            throw codesError;
        }
        
        res.json({ codes: codes || [] });
        
    } catch (error) {
        console.error('[Presale] Get codes error:', error);
        res.status(500).json({ error: 'Failed to get presale codes' });
    }
});

/**
 * Create presale codes (organizer only)
 * POST /api/presale/:eventId/codes
 * Body: { codes: [{ code, limitType, maxUses?, name?, expiresAt? }] }
 */
router.post('/:eventId/codes', verifyToken, async (req, res) => {
    try {
        const { eventId } = req.params;
        const userId = req.user.uid;
        const { codes } = req.body;
        
        if (!codes || !Array.isArray(codes) || codes.length === 0) {
            return res.status(400).json({ error: 'No codes provided' });
        }
        
        // Verify user owns this event
        const { data: event, error: eventError } = await supabase
            .from('events')
            .select('id, created_by')
            .eq('id', eventId)
            .single();
        
        if (eventError || !event) {
            return res.status(404).json({ error: 'Event not found' });
        }
        
        if (event.created_by !== userId) {
            return res.status(403).json({ error: 'Not authorized to create presale codes for this event' });
        }
        
        // Prepare codes for insertion
        const codesToInsert = codes.map(c => ({
            event_id: eventId,
            code: (c.code || '').toUpperCase().trim(),
            limit_type: c.limitType || 'single',
            max_uses: c.maxUses || null,
            current_uses: 0,
            created_by: userId,
            created_at: new Date().toISOString(),
            expires_at: c.expiresAt || null,
            name: c.name || null
        }));
        
        // Validate codes
        for (const code of codesToInsert) {
            if (!code.code || code.code.length < 3) {
                return res.status(400).json({ error: 'Code must be at least 3 characters' });
            }
        }
        
        // Insert codes
        const { data: insertedCodes, error: insertError } = await supabase
            .from('presale_codes')
            .insert(codesToInsert)
            .select();
        
        if (insertError) {
            if (insertError.code === '23505') {
                return res.status(400).json({ error: 'One or more codes already exist for this event' });
            }
            throw insertError;
        }
        
        res.json({ codes: insertedCodes });
        
    } catch (error) {
        console.error('[Presale] Create codes error:', error);
        res.status(500).json({ error: 'Failed to create presale codes' });
    }
});

/**
 * Auto-generate presale codes (organizer only)
 * POST /api/presale/:eventId/codes/generate
 * Body: { count: number, limitType: string, maxUses?: number, prefix?: string }
 */
router.post('/:eventId/codes/generate', verifyToken, async (req, res) => {
    try {
        const { eventId } = req.params;
        const userId = req.user.uid;
        const { count = 10, limitType = 'single', maxUses, prefix = '' } = req.body;
        
        if (count < 1 || count > 100) {
            return res.status(400).json({ error: 'Count must be between 1 and 100' });
        }
        
        // Verify user owns this event
        const { data: event, error: eventError } = await supabase
            .from('events')
            .select('id, created_by')
            .eq('id', eventId)
            .single();
        
        if (eventError || !event) {
            return res.status(404).json({ error: 'Event not found' });
        }
        
        if (event.created_by !== userId) {
            return res.status(403).json({ error: 'Not authorized to generate presale codes for this event' });
        }
        
        // Generate unique codes
        const generatedCodes = [];
        const usedCodes = new Set();
        
        for (let i = 0; i < count; i++) {
            let code;
            do {
                const randomPart = crypto.randomBytes(4).toString('hex').toUpperCase();
                code = prefix ? `${prefix.toUpperCase()}-${randomPart}` : randomPart;
            } while (usedCodes.has(code));
            
            usedCodes.add(code);
            generatedCodes.push({
                event_id: eventId,
                code,
                limit_type: limitType,
                max_uses: maxUses || null,
                current_uses: 0,
                created_by: userId,
                created_at: new Date().toISOString(),
                name: `Auto-generated #${i + 1}`
            });
        }
        
        // Insert codes
        const { data: insertedCodes, error: insertError } = await supabase
            .from('presale_codes')
            .insert(generatedCodes)
            .select();
        
        if (insertError) {
            throw insertError;
        }
        
        res.json({ codes: insertedCodes });
        
    } catch (error) {
        console.error('[Presale] Generate codes error:', error);
        res.status(500).json({ error: 'Failed to generate presale codes' });
    }
});

/**
 * Delete a presale code (organizer only)
 * DELETE /api/presale/:eventId/codes/:codeId
 */
router.delete('/:eventId/codes/:codeId', verifyToken, async (req, res) => {
    try {
        const { eventId, codeId } = req.params;
        const userId = req.user.uid;
        
        // Verify user owns this event
        const { data: event, error: eventError } = await supabase
            .from('events')
            .select('id, created_by')
            .eq('id', eventId)
            .single();
        
        if (eventError || !event) {
            return res.status(404).json({ error: 'Event not found' });
        }
        
        if (event.created_by !== userId) {
            return res.status(403).json({ error: 'Not authorized to delete presale codes for this event' });
        }
        
        // Delete the code
        const { error: deleteError } = await supabase
            .from('presale_codes')
            .delete()
            .eq('id', codeId)
            .eq('event_id', eventId);
        
        if (deleteError) {
            throw deleteError;
        }
        
        res.json({ success: true });
        
    } catch (error) {
        console.error('[Presale] Delete code error:', error);
        res.status(500).json({ error: 'Failed to delete presale code' });
    }
});

/**
 * Increment presale code usage (called during purchase)
 * POST /api/presale/:eventId/codes/:codeId/use
 */
router.post('/:eventId/codes/:codeId/use', async (req, res) => {
    try {
        const { eventId, codeId } = req.params;
        
        // Increment usage count
        const { data: code, error } = await supabase.rpc('increment_presale_code_usage', {
            p_code_id: codeId,
            p_event_id: eventId
        });
        
        if (error) {
            // Fallback to manual increment if RPC doesn't exist
            const { data: existingCode, error: fetchError } = await supabase
                .from('presale_codes')
                .select('*')
                .eq('id', codeId)
                .eq('event_id', eventId)
                .single();
            
            if (fetchError || !existingCode) {
                return res.status(404).json({ error: 'Presale code not found' });
            }
            
            // Update usage
            const { error: updateError } = await supabase
                .from('presale_codes')
                .update({ current_uses: (existingCode.current_uses || 0) + 1 })
                .eq('id', codeId);
            
            if (updateError) {
                throw updateError;
            }
        }
        
        res.json({ success: true });
        
    } catch (error) {
        console.error('[Presale] Use code error:', error);
        res.status(500).json({ error: 'Failed to record code usage' });
    }
});

export default router;
