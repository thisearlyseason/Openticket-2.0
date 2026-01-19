/**
 * Kiosk Mode Service
 * Handles all kiosk-related API calls
 */

const API_URL = process.env.REACT_APP_BACKEND_URL || 'http://localhost:8001';

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
    async checkIn(registrationId: string): Promise<{ success: boolean; attendeeName: string; checkedInAt: string }> {
        if (!this.tokenId || !this.eventId) {
            throw new Error('Kiosk not initialized');
        }

        try {
            const response = await fetch(`${API_URL}/api/kiosk/checkin`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    registrationId,
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
}

export const kioskService = new KioskService();
