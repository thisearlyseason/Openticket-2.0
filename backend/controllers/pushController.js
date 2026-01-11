/**
 * Push Notification Controller
 * API endpoints for push notification management
 */

import PushService from '../services/pushService.js';
import supabase from '../services/supabase.js';

/**
 * Get VAPID public key for client
 * GET /api/push/vapid-key
 */
export const getVapidKey = (req, res) => {
    const publicKey = process.env.VAPID_PUBLIC_KEY;
    
    if (!publicKey) {
        return res.status(503).json({ 
            error: 'Push notifications not configured',
            enabled: false 
        });
    }
    
    res.json({ 
        publicKey,
        enabled: true 
    });
};

/**
 * Subscribe to push notifications
 * POST /api/push/subscribe
 * Body: { subscription: PushSubscription }
 */
export const subscribe = async (req, res) => {
    try {
        const { uid } = req.user;
        const { subscription } = req.body;
        
        if (!subscription || !subscription.endpoint) {
            return res.status(400).json({ error: 'Invalid subscription object' });
        }
        
        const result = await PushService.saveSubscription(uid, subscription);
        
        if (result) {
            res.json({ 
                success: true, 
                message: 'Subscribed to push notifications' 
            });
        } else {
            res.status(500).json({ 
                success: false, 
                error: 'Failed to save subscription' 
            });
        }
    } catch (error) {
        console.error('[PushController] Subscribe error:', error);
        res.status(500).json({ error: error.message });
    }
};

/**
 * Unsubscribe from push notifications
 * POST /api/push/unsubscribe
 */
export const unsubscribe = async (req, res) => {
    try {
        const { uid } = req.user;
        
        const result = await PushService.removeSubscription(uid);
        
        res.json({ 
            success: result, 
            message: result ? 'Unsubscribed from push notifications' : 'No subscription found' 
        });
    } catch (error) {
        console.error('[PushController] Unsubscribe error:', error);
        res.status(500).json({ error: error.message });
    }
};

/**
 * Send test notification to current user
 * POST /api/push/test
 */
export const sendTestNotification = async (req, res) => {
    try {
        const { uid } = req.user;
        
        // Send browser push notification
        const pushResult = await PushService.sendNotification(uid, {
            title: '🔔 Test Notification',
            body: 'Push notifications are working! You\'ll receive updates about your events here.',
            tag: 'test',
            data: {
                type: 'test',
                url: '/#/settings'
            }
        });
        
        // Also save to in-app notifications database
        try {
            await supabase
                .from('notifications')
                .insert({
                    user_id: uid,
                    type: 'test',
                    title: '🔔 Test Notification',
                    message: 'Push notifications are working! You\'ll receive updates about your events here.',
                    read: false,
                    data: { type: 'test' },
                    created_at: new Date().toISOString()
                });
            console.log('[PushController] Test notification saved to database');
        } catch (dbError) {
            console.warn('[PushController] Could not save to notifications table:', dbError.message);
        }
        
        res.json({ 
            success: true, 
            message: 'Test notification sent',
            pushDelivered: !!pushResult
        });
    } catch (error) {
        console.error('[PushController] Test notification error:', error);
        res.status(500).json({ error: error.message });
    }
};

/**
 * Send event reminder notification (organizer use)
 * POST /api/push/send-reminder
 * Body: { eventId, userIds, message }
 */
export const sendEventReminder = async (req, res) => {
    try {
        const { uid } = req.user;
        const { eventId, userIds, message, eventTitle } = req.body;
        
        if (!eventId || !userIds || !Array.isArray(userIds)) {
            return res.status(400).json({ error: 'eventId and userIds array required' });
        }
        
        // TODO: Verify the user is the organizer of the event
        
        const payload = message 
            ? { title: '📢 ' + eventTitle, body: message, tag: `reminder_${eventId}`, data: { eventId, url: `/#/event/${eventId}` } }
            : PushService.NotificationTemplates.eventReminder(eventTitle || 'Event', new Date(), eventId);
        
        const result = await PushService.sendBulkNotification(userIds, payload);
        
        res.json({ 
            success: true, 
            sent: result.sent, 
            total: result.total 
        });
    } catch (error) {
        console.error('[PushController] Send reminder error:', error);
        res.status(500).json({ error: error.message });
    }
};

/**
 * Get notification status for current user
 * GET /api/push/status
 */
export const getStatus = async (req, res) => {
    try {
        const { uid } = req.user;
        
        const subscription = await PushService.getSubscription(uid);
        
        res.json({
            subscribed: !!subscription,
            enabled: !!process.env.VAPID_PUBLIC_KEY
        });
    } catch (error) {
        console.error('[PushController] Status error:', error);
        res.status(500).json({ error: error.message });
    }
};

export default {
    getVapidKey,
    subscribe,
    unsubscribe,
    sendTestNotification,
    sendEventReminder,
    getStatus
};
