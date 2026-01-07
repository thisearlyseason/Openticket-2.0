/**
 * Waitlist Routes - Handles event waitlist management
 */

import express from 'express';
import supabase from '../services/supabase.js';
import verifyToken from '../middlewares/authMiddleware.js';

const router = express.Router();

/**
 * GET /api/waitlist/:eventId
 * Get waitlist entries for an event
 */
router.get('/:eventId', verifyToken, async (req, res) => {
    try {
        const { eventId } = req.params;
        
        const { data, error } = await supabase
            .from('waitlist')
            .select('*')
            .eq('event_id', eventId)
            .order('created_at', { ascending: true });

        if (error) {
            // Table might not exist
            if (error.code === '42P01' || error.code === 'PGRST205') {
                return res.json({ waitlist: [] });
            }
            throw error;
        }

        res.json({ waitlist: data || [] });
    } catch (error) {
        console.error('[Waitlist] Get error:', error);
        res.status(500).json({ error: 'Failed to get waitlist' });
    }
});

/**
 * POST /api/waitlist
 * Add entry to waitlist
 */
router.post('/', async (req, res) => {
    try {
        const { event_id, name, email } = req.body;

        if (!event_id || !name || !email) {
            return res.status(400).json({ error: 'event_id, name, and email are required' });
        }

        const { data, error } = await supabase
            .from('waitlist')
            .insert({
                event_id,
                name,
                email,
                status: 'pending',
                created_at: new Date().toISOString()
            })
            .select()
            .single();

        if (error) {
            // Table might not exist - create gracefully
            if (error.code === '42P01') {
                console.warn('[Waitlist] Table does not exist');
                return res.json({ success: true, message: 'Waitlist feature not configured' });
            }
            throw error;
        }

        res.json({ success: true, entry: data });
    } catch (error) {
        console.error('[Waitlist] Add error:', error);
        res.status(500).json({ error: 'Failed to add to waitlist' });
    }
});

/**
 * PUT /api/waitlist/:id
 * Update waitlist entry status
 */
router.put('/:id', verifyToken, async (req, res) => {
    try {
        const { id } = req.params;
        const { status } = req.body;

        if (!['pending', 'promoted', 'expired'].includes(status)) {
            return res.status(400).json({ error: 'Invalid status' });
        }

        const { error } = await supabase
            .from('waitlist')
            .update({ status, updated_at: new Date().toISOString() })
            .eq('id', id);

        if (error && error.code !== '42P01') throw error;

        res.json({ success: true });
    } catch (error) {
        console.error('[Waitlist] Update error:', error);
        res.status(500).json({ error: 'Failed to update waitlist entry' });
    }
});

/**
 * DELETE /api/waitlist/:id
 * Remove entry from waitlist
 */
router.delete('/:id', verifyToken, async (req, res) => {
    try {
        const { id } = req.params;

        const { error } = await supabase
            .from('waitlist')
            .delete()
            .eq('id', id);

        if (error && error.code !== '42P01') throw error;

        res.json({ success: true });
    } catch (error) {
        console.error('[Waitlist] Delete error:', error);
        res.status(500).json({ error: 'Failed to delete waitlist entry' });
    }
});

export default router;
