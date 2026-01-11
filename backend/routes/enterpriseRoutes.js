import express from 'express';
import { verifyToken } from '../middlewares/authMiddleware.js';
import supabase from '../config/supabaseClient.js';
import { v4 as uuidv4 } from 'uuid';

const router = express.Router();

/**
 * POST /api/enterprise/contact
 * Submit enterprise contact request
 */
router.post('/contact', verifyToken, async (req, res) => {
    try {
        const userId = req.user.uid;
        const {
            name,
            email,
            company,
            phone,
            expectedTickets,
            expectedEvents,
            message,
            source
        } = req.body;

        console.log('[Enterprise] Contact request received from:', email);

        // Validate required fields
        if (!name || !email || !company) {
            return res.status(400).json({ 
                error: 'Name, email, and company are required' 
            });
        }

        // Store in database
        const requestId = uuidv4();
        const { data, error } = await supabase
            .from('enterprise_requests')
            .insert({
                id: requestId,
                user_id: userId,
                name,
                email,
                company,
                phone: phone || null,
                expected_monthly_tickets: expectedTickets ? parseInt(expected Tickets) : null,
                expected_monthly_events: expectedEvents ? parseInt(expectedEvents) : null,
                message: message || null,
                source: source || 'manual',
                status: 'pending',
                created_at: new Date().toISOString()
            })
            .select()
            .single();

        if (error) {
            console.error('[Enterprise] Database error:', error);
            throw error;
        }

        console.log('[Enterprise] Request stored:', requestId);

        // TODO: Send notification email to sales team
        // await sendEnterpriseNotification(data);

        res.json({
            success: true,
            requestId,
            message: 'Enterprise request submitted successfully'
        });

    } catch (error) {
        console.error('[Enterprise] Error:', error);
        res.status(500).json({ error: error.message });
    }
});

/**
 * GET /api/enterprise/requests
 * Get all enterprise requests (admin only)
 */
router.get('/requests', verifyToken, async (req, res) => {
    try {
        const userId = req.user.uid;

        // Check if user is admin
        const { data: profile } = await supabase
            .from('profiles')
            .select('is_admin, role')
            .eq('id', userId)
            .single();

        if (!profile?.is_admin && profile?.role !== 'admin') {
            return res.status(403).json({ error: 'Admin access required' });
        }

        // Get all enterprise requests
        const { data: requests, error } = await supabase
            .from('enterprise_requests')
            .select('*')
            .order('created_at', { ascending: false });

        if (error) throw error;

        res.json({ requests });

    } catch (error) {
        console.error('[Enterprise] Error fetching requests:', error);
        res.status(500).json({ error: error.message });
    }
});

/**
 * PUT /api/enterprise/requests/:id/status
 * Update enterprise request status (admin only)
 */
router.put('/requests/:id/status', verifyToken, async (req, res) => {
    try {
        const userId = req.user.uid;
        const { id } = req.params;
        const { status, notes } = req.body;

        // Check if user is admin
        const { data: profile } = await supabase
            .from('profiles')
            .select('is_admin, role')
            .eq('id', userId)
            .single();

        if (!profile?.is_admin && profile?.role !== 'admin') {
            return res.status(403).json({ error: 'Admin access required' });
        }

        // Update request status
        const { data, error } = await supabase
            .from('enterprise_requests')
            .update({
                status,
                admin_notes: notes || null,
                updated_at: new Date().toISOString(),
                reviewed_by: userId
            })
            .eq('id', id)
            .select()
            .single();

        if (error) throw error;

        res.json({ success: true, request: data });

    } catch (error) {
        console.error('[Enterprise] Error updating request:', error);
        res.status(500).json({ error: error.message });
    }
});

export default router;
