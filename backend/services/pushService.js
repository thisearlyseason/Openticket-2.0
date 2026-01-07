/**
 * Push Notification Service
 * Handles web push notifications for event reminders, check-ins, and updates
 */

import webPush from 'web-push';
import supabase from '../services/supabase.js';

// Initialize web-push with VAPID keys
const VAPID_PUBLIC_KEY = process.env.VAPID_PUBLIC_KEY;
const VAPID_PRIVATE_KEY = process.env.VAPID_PRIVATE_KEY;
const VAPID_SUBJECT = process.env.VAPID_SUBJECT || 'mailto:support@openticket.app';

if (VAPID_PUBLIC_KEY && VAPID_PRIVATE_KEY) {
    webPush.setVapidDetails(VAPID_SUBJECT, VAPID_PUBLIC_KEY, VAPID_PRIVATE_KEY);
    console.log('[PushService] Initialized with VAPID keys');
} else {
    console.warn('[PushService] VAPID keys not configured - push notifications disabled');
}

/**
 * Notification types
 */
export const NotificationTypes = {
    EVENT_REMINDER: 'event_reminder',
    TICKET_PURCHASED: 'ticket_purchased',
    CHECK_IN_SUCCESS: 'check_in_success',
    EVENT_UPDATE: 'event_update',
    EVENT_CANCELLED: 'event_cancelled',
    PAYMENT_RECEIVED: 'payment_received',
    NEW_REGISTRATION: 'new_registration'
};

// In-memory fallback storage when database table doesn't exist
const inMemorySubscriptions = new Map();

/**
 * Save push subscription for a user
 */
export const saveSubscription = async (userId, subscription) => {
    try {
        const { data, error } = await supabase
            .from('push_subscriptions')
            .upsert({
                user_id: userId,
                subscription: subscription,
                created_at: new Date().toISOString(),
                updated_at: new Date().toISOString()
            }, {
                onConflict: 'user_id'
            })
            .select();

        if (error) {
            // Table might not exist, use in-memory fallback
            if (error.code === '42P01' || error.code === 'PGRST205') {
                console.warn('[PushService] push_subscriptions table does not exist, using in-memory storage');
                inMemorySubscriptions.set(userId, subscription);
                return { user_id: userId, subscription };
            }
            throw error;
        }

        console.log('[PushService] Subscription saved for user:', userId);
        return data[0];
    } catch (err) {
        console.error('[PushService] Error saving subscription:', err);
        // Fallback to in-memory storage
        inMemorySubscriptions.set(userId, subscription);
        console.log('[PushService] Using in-memory fallback for user:', userId);
        return { user_id: userId, subscription };
    }
};

/**
 * Remove push subscription for a user
 */
export const removeSubscription = async (userId) => {
    try {
        const { error } = await supabase
            .from('push_subscriptions')
            .delete()
            .eq('user_id', userId);

        if (error && error.code !== '42P01' && error.code !== 'PGRST205') throw error;
        
        // Also remove from in-memory storage
        inMemorySubscriptions.delete(userId);
        
        console.log('[PushService] Subscription removed for user:', userId);
        return true;
    } catch (err) {
        console.error('[PushService] Error removing subscription:', err);
        // Still remove from in-memory
        inMemorySubscriptions.delete(userId);
        return true;
    }
};

/**
 * Get subscription for a user
 */
export const getSubscription = async (userId) => {
    try {
        const { data, error } = await supabase
            .from('push_subscriptions')
            .select('subscription')
            .eq('user_id', userId)
            .single();

        if (error) {
            if (error.code === 'PGRST116' || error.code === '42P01' || error.code === 'PGRST205') {
                // Check in-memory fallback
                const inMemorySub = inMemorySubscriptions.get(userId);
                if (inMemorySub) {
                    console.log('[PushService] Using in-memory subscription for user:', userId);
                    return inMemorySub;
                }
                return null;
            }
            throw error;
        }

        return data?.subscription;
    } catch (err) {
        console.error('[PushService] Error getting subscription:', err);
        // Check in-memory fallback
        return inMemorySubscriptions.get(userId) || null;
    }
};

/**
 * Send push notification to a user
 */
export const sendNotification = async (userId, payload) => {
    if (!VAPID_PUBLIC_KEY || !VAPID_PRIVATE_KEY) {
        console.warn('[PushService] VAPID keys not configured');
        return false;
    }

    try {
        const subscription = await getSubscription(userId);
        if (!subscription) {
            console.log('[PushService] No subscription found for user:', userId);
            return false;
        }

        const notificationPayload = JSON.stringify({
            title: payload.title || 'OpenTicket',
            body: payload.body || '',
            icon: payload.icon || '/icons/icon-192.svg',
            badge: '/icons/icon-72.svg',
            tag: payload.tag || 'openticket',
            data: payload.data || {},
            actions: payload.actions || [],
            requireInteraction: payload.requireInteraction || false,
            timestamp: Date.now()
        });

        await webPush.sendNotification(subscription, notificationPayload);
        console.log('[PushService] Notification sent to user:', userId);
        return true;
    } catch (err) {
        console.error('[PushService] Error sending notification:', err);
        
        // If subscription is invalid, remove it
        if (err.statusCode === 410 || err.statusCode === 404) {
            console.log('[PushService] Subscription expired, removing...');
            await removeSubscription(userId);
        }
        
        return false;
    }
};

/**
 * Send notification to multiple users
 */
export const sendBulkNotification = async (userIds, payload) => {
    const results = await Promise.allSettled(
        userIds.map(userId => sendNotification(userId, payload))
    );
    
    const successful = results.filter(r => r.status === 'fulfilled' && r.value).length;
    console.log(`[PushService] Bulk notification: ${successful}/${userIds.length} sent`);
    
    return { sent: successful, total: userIds.length };
};

/**
 * Pre-built notification templates
 */
export const NotificationTemplates = {
    eventReminder: (eventTitle, eventDate, eventId) => ({
        title: '🎟️ Event Reminder',
        body: `${eventTitle} is starting soon!`,
        tag: `reminder_${eventId}`,
        data: {
            type: NotificationTypes.EVENT_REMINDER,
            eventId,
            url: `/#/event/${eventId}`
        },
        actions: [
            { action: 'view', title: 'View Event' },
            { action: 'dismiss', title: 'Dismiss' }
        ]
    }),

    ticketPurchased: (eventTitle, ticketCount, registrationId) => ({
        title: '✅ Tickets Confirmed!',
        body: `${ticketCount} ticket${ticketCount > 1 ? 's' : ''} for ${eventTitle}`,
        tag: `purchase_${registrationId}`,
        data: {
            type: NotificationTypes.TICKET_PURCHASED,
            registrationId,
            url: `/#/ticket/${registrationId}`
        },
        actions: [
            { action: 'view', title: 'View Tickets' }
        ]
    }),

    checkInSuccess: (eventTitle, attendeeName) => ({
        title: '🎉 Checked In!',
        body: `${attendeeName} is now checked in to ${eventTitle}`,
        tag: 'checkin',
        data: {
            type: NotificationTypes.CHECK_IN_SUCCESS
        }
    }),

    eventUpdate: (eventTitle, updateMessage, eventId) => ({
        title: '📢 Event Update',
        body: `${eventTitle}: ${updateMessage}`,
        tag: `update_${eventId}`,
        data: {
            type: NotificationTypes.EVENT_UPDATE,
            eventId,
            url: `/#/event/${eventId}`
        },
        requireInteraction: true
    }),

    eventCancelled: (eventTitle, eventId) => ({
        title: '⚠️ Event Cancelled',
        body: `${eventTitle} has been cancelled. Refunds will be processed.`,
        tag: `cancelled_${eventId}`,
        data: {
            type: NotificationTypes.EVENT_CANCELLED,
            eventId
        },
        requireInteraction: true
    }),

    newRegistration: (eventTitle, attendeeName, eventId) => ({
        title: '🎟️ New Registration',
        body: `${attendeeName} just registered for ${eventTitle}`,
        tag: `reg_${Date.now()}`,
        data: {
            type: NotificationTypes.NEW_REGISTRATION,
            eventId,
            url: `/#/manage/${eventId}/attendees`
        }
    }),

    paymentReceived: (amount, currency, eventTitle) => ({
        title: '💰 Payment Received',
        body: `${currency} ${amount} received for ${eventTitle}`,
        tag: `payment_${Date.now()}`,
        data: {
            type: NotificationTypes.PAYMENT_RECEIVED
        }
    })
};

export default {
    saveSubscription,
    removeSubscription,
    getSubscription,
    sendNotification,
    sendBulkNotification,
    NotificationTypes,
    NotificationTemplates
};
