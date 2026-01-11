import express from 'express';
import supabase from '../services/supabase.js';
import verifyToken from '../middlewares/authMiddleware.js';

const router = express.Router();

/**
 * GET /api/notifications/:userId
 * Get all notifications for a user
 */
router.get('/:userId', verifyToken, async (req, res) => {
    try {
        const { userId } = req.params;
        const requestingUserId = req.user.uid;
        
        // Users can only fetch their own notifications (or admin can fetch any)
        const { data: profile } = await supabase
            .from('profiles')
            .select('is_admin')
            .eq('id', requestingUserId)
            .single();
        
        if (userId !== requestingUserId && !profile?.is_admin) {
            return res.status(403).json({ error: 'Not authorized to view these notifications' });
        }
        
        const { data: notifications, error } = await supabase
            .from('notifications')
            .select('*')
            .eq('user_id', userId)
            .order('created_at', { ascending: false })
            .limit(50);
        
        if (error) {
            console.error('[Notifications] Fetch error:', error);
            // If table doesn't exist, return empty array
            if (error.code === '42P01') {
                return res.json({ notifications: [] });
            }
            throw error;
        }
        
        // Transform to frontend format
        const transformed = (notifications || []).map(n => ({
            id: n.id,
            userId: n.user_id,
            type: n.type,
            title: n.title,
            message: n.message,
            read: n.read,
            timestamp: new Date(n.created_at).getTime(),
            data: n.data || {}
        }));
        
        res.json({ notifications: transformed });
    } catch (error) {
        console.error('[Notifications] Error:', error);
        res.status(500).json({ error: error.message });
    }
});

/**
 * POST /api/notifications
 * Create a new notification
 */
router.post('/', verifyToken, async (req, res) => {
    try {
        const { userId, type, title, message, data } = req.body;
        
        if (!userId || !message) {
            return res.status(400).json({ error: 'userId and message are required' });
        }
        
        const { data: notification, error } = await supabase
            .from('notifications')
            .insert({
                user_id: userId,
                type: type || 'info',
                title: title || 'Notification',
                message,
                read: false,
                data: data || {},
                created_at: new Date().toISOString()
            })
            .select()
            .single();
        
        if (error) {
            console.error('[Notifications] Insert error:', error);
            throw error;
        }
        
        res.json({ success: true, notification });
    } catch (error) {
        console.error('[Notifications] Create error:', error);
        res.status(500).json({ error: error.message });
    }
});

/**
 * POST /api/notifications/broadcast
 * Send notification to multiple users (admin only)
 */
router.post('/broadcast', verifyToken, async (req, res) => {
    try {
        const { uid } = req.user;
        const { message, title, target, type } = req.body;
        
        // Verify admin
        const { data: profile } = await supabase
            .from('profiles')
            .select('is_admin')
            .eq('id', uid)
            .single();
        
        if (!profile?.is_admin) {
            return res.status(403).json({ error: 'Admin access required' });
        }
        
        if (!message) {
            return res.status(400).json({ error: 'message is required' });
        }
        
        // Get target users based on audience
        let query = supabase.from('profiles').select('id, role');
        
        if (target === 'organizers') {
            query = query.eq('role', 'organizer');
        } else if (target === 'affiliates') {
            query = query.eq('role', 'affiliate');
        }
        // 'all' = no filter
        
        const { data: users, error: usersError } = await query;
        
        if (usersError) throw usersError;
        
        if (!users || users.length === 0) {
            return res.json({ success: true, sent: 0, message: 'No users found for target audience' });
        }
        
        // Create notifications for all target users
        const notifications = users.map(user => ({
            user_id: user.id,
            type: type || 'broadcast',
            title: title || '📢 Announcement',
            message,
            read: false,
            data: { target, from: 'admin' },
            created_at: new Date().toISOString()
        }));
        
        const { error: insertError } = await supabase
            .from('notifications')
            .insert(notifications);
        
        if (insertError) {
            console.error('[Notifications] Broadcast insert error:', insertError);
            throw insertError;
        }
        
        console.log(`[Notifications] Broadcast sent to ${users.length} users (target: ${target})`);
        
        res.json({ 
            success: true, 
            sent: users.length,
            target 
        });
    } catch (error) {
        console.error('[Notifications] Broadcast error:', error);
        res.status(500).json({ error: error.message });
    }
});

/**
 * PUT /api/notifications/:notifId
 * Mark notification as read
 */
router.put('/:notifId', verifyToken, async (req, res) => {
    try {
        const { notifId } = req.params;
        const { read } = req.body;
        const { uid } = req.user;
        
        // Verify ownership
        const { data: notification } = await supabase
            .from('notifications')
            .select('user_id')
            .eq('id', notifId)
            .single();
        
        if (!notification || notification.user_id !== uid) {
            return res.status(403).json({ error: 'Not authorized' });
        }
        
        const { error } = await supabase
            .from('notifications')
            .update({ read: read !== undefined ? read : true })
            .eq('id', notifId);
        
        if (error) throw error;
        
        res.json({ success: true });
    } catch (error) {
        console.error('[Notifications] Update error:', error);
        res.status(500).json({ error: error.message });
    }
});

/**
 * DELETE /api/notifications/:notifId
 * Delete a notification
 */
router.delete('/:notifId', verifyToken, async (req, res) => {
    try {
        const { notifId } = req.params;
        const { uid } = req.user;
        
        // Verify ownership
        const { data: notification } = await supabase
            .from('notifications')
            .select('user_id')
            .eq('id', notifId)
            .single();
        
        if (!notification || notification.user_id !== uid) {
            return res.status(403).json({ error: 'Not authorized' });
        }
        
        const { error } = await supabase
            .from('notifications')
            .delete()
            .eq('id', notifId);
        
        if (error) throw error;
        
        res.status(204).send();
    } catch (error) {
        console.error('[Notifications] Delete error:', error);
        res.status(500).json({ error: error.message });
    }
});

export default router;
