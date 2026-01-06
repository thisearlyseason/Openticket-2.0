/**
 * Push Notification Service (Frontend)
 * Handles push notification subscription and management
 */

const API_BASE = import.meta.env.VITE_API_URL || '';

/**
 * Check if push notifications are supported
 */
export const isPushSupported = (): boolean => {
    return 'serviceWorker' in navigator && 
           'PushManager' in window && 
           'Notification' in window;
};

/**
 * Get current notification permission status
 */
export const getPermissionStatus = (): NotificationPermission => {
    if (!('Notification' in window)) return 'denied';
    return Notification.permission;
};

/**
 * Request notification permission
 */
export const requestPermission = async (): Promise<NotificationPermission> => {
    if (!('Notification' in window)) {
        console.warn('[PushNotification] Notifications not supported');
        return 'denied';
    }
    
    const permission = await Notification.requestPermission();
    console.log('[PushNotification] Permission:', permission);
    return permission;
};

/**
 * Get VAPID public key from server
 */
export const getVapidKey = async (): Promise<string | null> => {
    try {
        const response = await fetch(`${API_BASE}/api/push/vapid-key`);
        const data = await response.json();
        
        if (data.enabled && data.publicKey) {
            return data.publicKey;
        }
        return null;
    } catch (error) {
        console.error('[PushNotification] Error getting VAPID key:', error);
        return null;
    }
};

/**
 * Convert VAPID key to Uint8Array for subscription
 */
const urlBase64ToUint8Array = (base64String: string): Uint8Array => {
    const padding = '='.repeat((4 - base64String.length % 4) % 4);
    const base64 = (base64String + padding)
        .replace(/-/g, '+')
        .replace(/_/g, '/');
    
    const rawData = window.atob(base64);
    const outputArray = new Uint8Array(rawData.length);
    
    for (let i = 0; i < rawData.length; ++i) {
        outputArray[i] = rawData.charCodeAt(i);
    }
    return outputArray;
};

/**
 * Subscribe to push notifications
 */
export const subscribe = async (authToken: string): Promise<boolean> => {
    if (!isPushSupported()) {
        console.warn('[PushNotification] Push not supported');
        return false;
    }
    
    try {
        // Request permission first
        const permission = await requestPermission();
        if (permission !== 'granted') {
            console.log('[PushNotification] Permission not granted');
            return false;
        }
        
        // Get VAPID key
        const vapidKey = await getVapidKey();
        if (!vapidKey) {
            console.error('[PushNotification] Could not get VAPID key');
            return false;
        }
        
        // Get service worker registration
        const registration = await navigator.serviceWorker.ready;
        
        // Subscribe to push
        const subscription = await registration.pushManager.subscribe({
            userVisibleOnly: true,
            applicationServerKey: urlBase64ToUint8Array(vapidKey)
        });
        
        console.log('[PushNotification] Subscribed:', subscription);
        
        // Send subscription to server
        const response = await fetch(`${API_BASE}/api/push/subscribe`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${authToken}`
            },
            body: JSON.stringify({ subscription })
        });
        
        if (!response.ok) {
            throw new Error('Failed to save subscription on server');
        }
        
        const result = await response.json();
        console.log('[PushNotification] Subscription saved:', result);
        
        return true;
    } catch (error) {
        console.error('[PushNotification] Subscribe error:', error);
        return false;
    }
};

/**
 * Unsubscribe from push notifications
 */
export const unsubscribe = async (authToken: string): Promise<boolean> => {
    try {
        const registration = await navigator.serviceWorker.ready;
        const subscription = await registration.pushManager.getSubscription();
        
        if (subscription) {
            await subscription.unsubscribe();
        }
        
        // Notify server
        const response = await fetch(`${API_BASE}/api/push/unsubscribe`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${authToken}`
            }
        });
        
        return response.ok;
    } catch (error) {
        console.error('[PushNotification] Unsubscribe error:', error);
        return false;
    }
};

/**
 * Check if user is currently subscribed
 */
export const isSubscribed = async (): Promise<boolean> => {
    if (!isPushSupported()) return false;
    
    try {
        const registration = await navigator.serviceWorker.ready;
        const subscription = await registration.pushManager.getSubscription();
        return !!subscription;
    } catch {
        return false;
    }
};

/**
 * Send test notification
 */
export const sendTestNotification = async (authToken: string): Promise<boolean> => {
    try {
        const response = await fetch(`${API_BASE}/api/push/test`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${authToken}`
            }
        });
        
        return response.ok;
    } catch (error) {
        console.error('[PushNotification] Test notification error:', error);
        return false;
    }
};

/**
 * Show local notification (for testing/instant feedback)
 */
export const showLocalNotification = async (title: string, options?: NotificationOptions): Promise<void> => {
    if (Notification.permission !== 'granted') return;
    
    try {
        const registration = await navigator.serviceWorker.ready;
        await registration.showNotification(title, {
            icon: '/icons/icon-192.svg',
            badge: '/icons/icon-72.svg',
            ...options
        });
    } catch (error) {
        console.error('[PushNotification] Local notification error:', error);
    }
};

export default {
    isPushSupported,
    getPermissionStatus,
    requestPermission,
    getVapidKey,
    subscribe,
    unsubscribe,
    isSubscribed,
    sendTestNotification,
    showLocalNotification
};
