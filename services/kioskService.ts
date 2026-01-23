/**
 * Kiosk Mode Service
 * Handles all kiosk-related API calls
 */

const API_URL = import.meta.env.VITE_BACKEND_URL || import.meta.env.REACT_APP_BACKEND_URL || 'https://www.openticket.events';

export interface KioskToken {
    tokenId: string;
    permissions: string[];
    paymentEnabled: boolean;
    expiresAt: string;
}

export interface KioskEvent {
    id: string;
    title: string;
    date: string;
    time: string;
    location: string;
    imageUrl?: string;
    ticketTiers: any[];
    organizerId: string;
    organizer: string;
}

export interface ScanResult {
    success: boolean;
    status: 'valid' | 'invalid' | 'already_checked_in' | 'payment_required';
    message: string;
    attendeeName?: string;
    attendeeEmail?: string;
    ticketType?: string;
    price?: number;
    registrationId?: string;
    checkedInAt?: string;
}

export interface GuestSearchResult {
    id: string;
    attendeeName: string;
    attendeeEmail: string;
    ticketType: string;
    ticketId: string;
    checkedIn: boolean;
    checkedInAt: string | null;
    paymentStatus: string;
    price: number;
}

class KioskService {
    private tokenId: string | null = null;
    private eventId: string | null = null;
    private deviceId: string = this.getOrCreateDeviceId();

    /**
     * Initialize kiosk mode with token
     */
    async initialize(eventId: string, tokenId: string): Promise<{ token: KioskToken; event: KioskEvent }> {
        try {
            const response = await fetch(`${API_URL}/api/kiosk/validate`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ tokenId, eventId })
            });

            if (!response.ok) {
                const error = await response.json();
                throw new Error(error.error || 'Failed to validate token');
            }

            const data = await response.json();
            this.tokenId = tokenId;
            this.eventId = eventId;

            // Store in localStorage for persistence
            localStorage.setItem('kiosk_token', tokenId);
            localStorage.setItem('kiosk_event_id', eventId);

            return data;
        } catch (error) {
            console.error('[KioskService] Initialize error:', error);
            throw error;
        }
    }

    /**
     * Scan QR code
     */
    async scanTicket(qrCode: string): Promise<ScanResult> {
        if (!this.tokenId || !this.eventId) {
            throw new Error('Kiosk not initialized');
        }

        try {
            const response = await fetch(`${API_URL}/api/kiosk/scan`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    qrCode,
                    tokenId: this.tokenId,
                    eventId: this.eventId,
                    deviceId: this.deviceId
                })
            });

            const data = await response.json();
            return data;
        } catch (error) {
            console.error('[KioskService] Scan error:', error);
            throw error;
        }
    }

    /**
     * Search for guest
     */
    async searchGuest(query: string): Promise<GuestSearchResult[]> {
        if (!this.tokenId || !this.eventId) {
            throw new Error('Kiosk not initialized');
        }

        try {
            const params = new URLSearchParams({
                query,
                tokenId: this.tokenId,
                eventId: this.eventId
            });

            const response = await fetch(`${API_URL}/api/kiosk/guest-search?${params}`);

            if (!response.ok) {
                throw new Error('Search failed');
            }

            const data = await response.json();
            return data.results || [];
        } catch (error) {
            console.error('[KioskService] Search error:', error);
            throw error;
        }
    }

    /**
     * Check in a guest
     */
    /**
     * Check in a guest
     */
    async checkIn(registrationId: string, ticketId?: string): Promise<{ success: boolean; attendeeName: string; checkedInAt: string }> {
        if (!this.tokenId || !this.eventId) {
            throw new Error('Kiosk not initialized');
        }

        try {
            const response = await fetch(`${API_URL}/api/kiosk/checkin`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    registrationId,
                    ticketId,  // Pass specific ticket ID for individual ticket check-in
                    tokenId: this.tokenId,
                    eventId: this.eventId,
                    deviceId: this.deviceId
                })
            });

            if (!response.ok) {
                const error = await response.json();
                throw new Error(error.error || 'Check-in failed');
            }

            return await response.json();
        } catch (error) {
            console.error('[KioskService] Check-in error:', error);
            throw error;
        }
    }

    /**
     * Process payment
     */
    async processPayment(registrationId: string, paymentMethod: 'cash' | 'card', amount?: number): Promise<any> {
        if (!this.tokenId || !this.eventId) {
            throw new Error('Kiosk not initialized');
        }

        try {
            const response = await fetch(`${API_URL}/api/kiosk/payment`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    registrationId,
                    tokenId: this.tokenId,
                    eventId: this.eventId,
                    paymentMethod,
                    amount,
                    deviceId: this.deviceId
                })
            });

            if (!response.ok) {
                const error = await response.json();
                throw new Error(error.error || 'Payment failed');
            }

            return await response.json();
        } catch (error) {
            console.error('[KioskService] Payment error:', error);
            throw error;
        }
    }

    /**
     * Get or create device ID
     */
    private getOrCreateDeviceId(): string {
        let deviceId = localStorage.getItem('kiosk_device_id');
        if (!deviceId) {
            deviceId = `device_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
            localStorage.setItem('kiosk_device_id', deviceId);
        }
        return deviceId;
    }

    /**
     * Get current token and event
     */
    getSession(): { tokenId: string | null; eventId: string | null } {
        return {
            tokenId: this.tokenId || localStorage.getItem('kiosk_token'),
            eventId: this.eventId || localStorage.getItem('kiosk_event_id')
        };
    }

    /**
     * Clear session (logout)
     */
    clearSession(): void {
        this.tokenId = null;
        this.eventId = null;
        localStorage.removeItem('kiosk_token');
        localStorage.removeItem('kiosk_event_id');
    }

    /**
     * Check if in kiosk mode
     */
    isKioskMode(): boolean {
        return !!(this.tokenId || localStorage.getItem('kiosk_token'));
    }

    /**
     * Get kiosk status for an event (organizer view)
     */
    async getKioskStatus(eventId: string): Promise<{
        active: boolean;
        token?: KioskToken;
        kioskUrl?: string;
    }> {
        try {
            // Get Firebase auth token
            const { getAuthToken } = await import('./firebaseConfig');
            const authToken = await getAuthToken();
            
            if (!authToken) {
                console.error('[KioskService] No auth token available - user may not be logged in');
                throw new Error('Not authenticated. Please log in and try again.');
            }
            
            const response = await fetch(`${API_URL}/api/kiosk/status/${eventId}`, {
                headers: {
                    'Authorization': `Bearer ${authToken}`
                }
            });

            if (!response.ok) {
                const error = await response.json();
                throw new Error(error.error || 'Failed to get kiosk status');
            }

            const result = await response.json();
            console.log('[KioskService] Status result:', result);
            return result;
        } catch (error) {
            console.error('[KioskService] Get status error:', error);
            throw error;
        }
    }

    /**
     * Generate a new kiosk token (organizer only)
     */
    async generateToken(eventId: string, options?: {
        paymentEnabled?: boolean;
        pinCode?: string;
    }): Promise<{
        token: KioskToken;
        kioskUrl: string;
    }> {
        try {
            // Get Firebase auth token
            const { getAuthToken } = await import('./firebaseConfig');
            const authToken = await getAuthToken();
            
            if (!authToken) {
                throw new Error('Not authenticated');
            }
            
            const response = await fetch(`${API_URL}/api/kiosk/generate`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${authToken}`
                },
                body: JSON.stringify({
                    eventId,
                    paymentEnabled: options?.paymentEnabled !== false,
                    pinCode: options?.pinCode
                })
            });

            if (!response.ok) {
                const error = await response.json();
                throw new Error(error.error || 'Token is missing');
            }

            const data = await response.json();
            return {
                token: {
                    tokenId: data.token,
                    permissions: ['scan_ticket', 'manual_checkin', 'door_payment'],
                    paymentEnabled: options?.paymentEnabled !== false,
                    expiresAt: data.expiresAt,
                    pinCode: options?.pinCode
                } as any,
                kioskUrl: data.kioskUrl
            };
        } catch (error) {
            console.error('[KioskService] Generate token error:', error);
            throw error;
        }
    }

    /**
     * Revoke kiosk token (organizer only)
     */
    async revokeToken(eventId: string, tokenId?: string): Promise<{ success: boolean }> {
        try {
            // Get Firebase auth token
            const { getAuthToken } = await import('./firebaseConfig');
            const authToken = await getAuthToken();
            
            if (!authToken) {
                throw new Error('Not authenticated');
            }
            
            const response = await fetch(`${API_URL}/api/kiosk/revoke`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${authToken}`
                },
                body: JSON.stringify({ 
                    eventId,
                    tokenId: tokenId || this.tokenId // Use provided tokenId or stored one
                })
            });

            if (!response.ok) {
                const error = await response.json();
                throw new Error(error.error || 'Failed to revoke token');
            }

            return await response.json();
        } catch (error) {
            console.error('[KioskService] Revoke token error:', error);
            throw error;
        }
    }
}

export const kioskService = new KioskService();
