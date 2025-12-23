
import { UserNotification } from '../types';
import { StorageService } from './storageService';
import { getAuthToken } from './firebaseConfig';

const isOffline = StorageService.isOfflineMode();
const SUPABASE_API_BASE = import.meta.env.VITE_API_URL || '/api';

const fetchSupabase = async (endpoint: string, method: 'GET' | 'POST' | 'PUT' | 'DELETE' = 'GET', body?: any) => {
    const headers: any = { 'Content-Type': 'application/json' };
    const token = await getAuthToken();
    if (token) headers['Authorization'] = `Bearer ${token}`;

    const options: RequestInit = { method, headers };
    if (body) options.body = JSON.stringify(body);

    const res = await fetch(`${SUPABASE_API_BASE}${endpoint}`, options);
    // 204 No Content
    if (res.status === 204) return null;
    if (!res.ok) {
        if (res.status === 404) return null; // Handle not found gracefully
        throw new Error(`API Error: ${res.statusText}`);
    }
    return res.json();
};

export const NotificationService = {
    getNotifications: async (userId: string): Promise<UserNotification[]> => {
        try {
            if (isOffline) {
                const all = JSON.parse(localStorage.getItem('openticket_notifications') || '[]');
                return all.filter((n: any) => n.userId === userId).sort((a: any, b: any) => b.timestamp - a.timestamp);
            } else {
                // Fetch from backend
                const { notifications } = await fetchSupabase(`/notifications/${userId}`);
                return notifications || [];
            }
        } catch (e) {
            console.error("Error fetching notifications", e);
            return [];
        }
    },

    sendNotification: async (notification: UserNotification) => {
        if (isOffline) {
            const all = JSON.parse(localStorage.getItem('openticket_notifications') || '[]');
            all.push(notification);
            localStorage.setItem('openticket_notifications', JSON.stringify(all));
        } else {
            await fetchSupabase('/notifications', 'POST', notification);
        }
    },

    markAsRead: async (notifId: string) => {
        if (isOffline) {
            const all = JSON.parse(localStorage.getItem('openticket_notifications') || '[]');
            const idx = all.findIndex((n: any) => n.id === notifId);
            if (idx >= 0) {
                all[idx].read = true;
                localStorage.setItem('openticket_notifications', JSON.stringify(all));
            }
        } else {
            await fetchSupabase(`/notifications/${notifId}`, 'PUT', { read: true });
        }
    }
};
