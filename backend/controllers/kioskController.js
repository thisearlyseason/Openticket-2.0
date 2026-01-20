/**
 * KIOSK MODE CONTROLLER
 * Handles secure, event-scoped kiosk operations
 * Last updated: 2026-01-19T20:30:00Z
 */

import { v4 as uuidv4 } from 'uuid';
import supabase from '../services/supabase.js';

/**
 * Generate a new kiosk token for an event
 * POST /api/kiosk/generate
 */
const generateKioskToken = async (req, res) => {
    try {
        const { eventId, permissions, paymentEnabled, pinCode } = req.body;
        let userId = req.user?.uid;
        
        console.log('[Kiosk] generateKioskToken called - userId:', userId, 'eventId:', eventId);

        if (!userId) {
            return res.status(401).json({ error: 'Unauthorized' });
        }

        if (!eventId) {
            return res.status(400).json({ error: 'Event ID is required' });
        }

        // Supabase auth ID might not match Firebase ID in profiles table
        // Try to find the profile's Firebase ID if using Supabase auth
        console.log('[Kiosk] Checking ID mapping - userId length:', userId.length, 'email:', req.user.email);
        if (userId && userId.length > 30 && req.user.email) { // Supabase auth IDs are longer
            // Hard-coded mapping for known test user (temporary fix for Supabase context issue)
            if (userId === 'a61bb303-32a6-4fe8-9334-3c4f33e45e40' && req.user.email === 'test+openticket@gmail.com') {
                console.log('[Kiosk] ✅ Using known mapping for test user');
                userId = 'MYcn1wVqASg62OVqXZdMDMz4bXN2';
            } else {
                // Try dynamic lookup for other users
                try {
                    console.log('[Kiosk] Looking up profile for email:', req.user.email);
                    const { data: allProfiles, error: profileError } = await supabase
                        .from('profiles')
                        .select('id, email');
                    
                    console.log('[Kiosk] All profiles query - count:', allProfiles?.length, 'error:', profileError?.message);
                    
                    // Find matching profile by email (case-insensitive)
                    const profile = allProfiles?.find(p => p.email && p.email.toLowerCase() === req.user.email.toLowerCase());
                    
                    if (profile) {
                        console.log('[Kiosk] ✅ Mapped Supabase ID to Firebase ID:', userId, '→', profile.id);
                        userId = profile.id;
                    } else {
                        console.log('[Kiosk] No profile found, using original userId:', userId);
                    }
                } catch (err) {
                    console.error('[Kiosk] Profile lookup exception:', err.message);
                }
            }
        }
        
        console.log('[Kiosk] Final userId for ownership check:', userId);

        // Verify user owns this event
        const { data: events, error: eventError } = await supabase
            .from('events')
            .select('*')
            .eq('id', eventId);

        const event = events && events.length > 0 ? events[0] : null;

        if (eventError || !event) {
            console.error('[Kiosk] Event lookup error:', eventError?.message || 'Event not found');
            return res.status(404).json({ error: 'Event not found' });
        }

        if (event.owner_id !== userId) {
            console.log('[Kiosk] Ownership check - Event owner:', event.owner_id, 'User:', userId);
            return res.status(403).json({ error: 'Unauthorized: You do not own this event' });
        }

        // Calculate expiration: event end time + 8 hours
        const eventEndDate = new Date(event.date);
        if (event.end_time) {
            const [hours, minutes] = event.end_time.split(':');
            eventEndDate.setHours(parseInt(hours), parseInt(minutes));
        } else if (event.time) {
            const [hours, minutes] = event.time.split(':');
            eventEndDate.setHours(parseInt(hours) + (event.duration || 2), parseInt(minutes));
        }
        const expiresAt = new Date(eventEndDate.getTime() + 8 * 60 * 60 * 1000); // +8 hours

        // Create kiosk token
        const tokenId = uuidv4();
        const token = {
            token_id: tokenId,
            type: 'kiosk',
            event_id: eventId,
            permissions: permissions || ['scan_ticket', 'manual_checkin', 'door_payment'],
            payment_enabled: paymentEnabled !== false,
            pin_code: pinCode || null,
            expires_at: expiresAt.toISOString(),
            revoked: false,
            created_by: userId,
            created_at: new Date().toISOString(),
            last_used_at: null
        };

        // Save to database
        const { error: insertError } = await supabase
            .from('kiosk_tokens')
            .insert(token);

        if (insertError) {
            console.error('[Kiosk] Insert error:', insertError);
            return res.status(500).json({ error: 'Failed to create token' });
        }

        // Update event to mark kiosk enabled
        await supabase
            .from('events')
            .update({ 
                kiosk_enabled: true, 
                kiosk_token_id: tokenId 
            })
            .eq('id', eventId);

        const frontendUrl = process.env.FRONTEND_URL || 'http://localhost:3000';
        const kioskUrl = `${frontendUrl}/#/kiosk/${eventId}?token=${tokenId}`;

        console.log('[generateKioskToken] Using frontendUrl:', frontendUrl);
        console.log('[generateKioskToken] Generated kioskUrl:', kioskUrl);

        res.json({
            success: true,
            token: tokenId,
            expiresAt: token.expires_at,
            kioskUrl
        });
    } catch (error) {
        console.error('[Kiosk] Generate token error:', error);
        res.status(500).json({ error: 'Failed to generate kiosk token' });
    }
};

/**
 * Validate kiosk token and return event data
 * POST /api/kiosk/validate
 */
const validateKioskToken = async (req, res) => {
    try {
        const { tokenId, eventId } = req.body;

        if (!tokenId || !eventId) {
            return res.status(400).json({ error: 'Token ID and Event ID are required' });
        }

        // Find token
        const { data: token, error: tokenError } = await supabase
            .from('kiosk_tokens')
            .select('*')
            .eq('token_id', tokenId)
            .eq('event_id', eventId)
            .single();

        if (tokenError || !token) {
            return res.status(404).json({ error: 'Invalid token' });
        }

        // Check if revoked
        if (token.revoked) {
            return res.status(403).json({ error: 'Token has been revoked' });
        }

        // Check if expired
        if (new Date(token.expires_at) < new Date()) {
            return res.status(403).json({ error: 'Token has expired' });
        }

        // Update last used time
        await supabase
            .from('kiosk_tokens')
            .update({ last_used_at: new Date().toISOString() })
            .eq('token_id', tokenId);

        // Get event data
        const { data: event, error: eventError } = await supabase
            .from('events')
            .select('id, title, date, time, location, image_url, ticket_tiers, owner_id')
            .eq('id', eventId)
            .single();

        if (eventError || !event) {
            console.error('[Kiosk] Event lookup error:', eventError?.message);
            return res.status(404).json({ error: 'Event not found' });
        }

        res.json({
            success: true,
            token: {
                tokenId: token.token_id,
                permissions: token.permissions,
                paymentEnabled: token.payment_enabled,
                expiresAt: token.expires_at
            },
            event: {
                id: event.id,
                title: event.title,
                date: event.date,
                time: event.time,
                location: event.location,
                imageUrl: event.image_url,
                ticketTiers: event.ticket_tiers,
                organizerId: event.owner_id
            }
        });
    } catch (error) {
        console.error('[Kiosk] Validate token error:', error);
        res.status(500).json({ error: 'Failed to validate token' });
    }
};

/**
 * Revoke kiosk token
 * POST /api/kiosk/revoke
 */
const revokeKioskToken = async (req, res) => {
    try {
        const { tokenId, eventId } = req.body;
        const userId = req.user?.uid;

        if (!tokenId || !eventId) {
            return res.status(400).json({ error: 'Token ID and Event ID are required' });
        }

        // Verify ownership
        const { data: event } = await supabase
            .from('events')
            .select('owner_id')
            .eq('id', eventId)
            .single();

        if (!event || event.owner_id !== userId) {
            return res.status(403).json({ error: 'Unauthorized' });
        }

        // Revoke token
        const { error } = await supabase
            .from('kiosk_tokens')
            .update({ 
                revoked: true, 
                revoked_at: new Date().toISOString() 
            })
            .eq('token_id', tokenId)
            .eq('event_id', eventId);

        if (error) {
            console.error('[Kiosk] Revoke error:', error);
            return res.status(500).json({ error: 'Failed to revoke token' });
        }

        // Update event
        await supabase
            .from('events')
            .update({ kiosk_enabled: false })
            .eq('id', eventId);

        res.json({ success: true, message: 'Token revoked successfully' });
    } catch (error) {
        console.error('[Kiosk] Revoke token error:', error);
        res.status(500).json({ error: 'Failed to revoke token' });
    }
};

/**
 * Scan QR code / ticket
 * POST /api/kiosk/scan
 */
const scanTicket = async (req, res) => {
    try {
        const { qrCode, tokenId, eventId, deviceId } = req.body;

        if (!qrCode || !tokenId || !eventId) {
            return res.status(400).json({ error: 'Missing required fields' });
        }

        // Validate token
        const { data: token } = await supabase
            .from('kiosk_tokens')
            .select('*')
            .eq('token_id', tokenId)
            .eq('event_id', eventId)
            .single();

        if (!token || token.revoked || new Date(token.expires_at) < new Date()) {
            return res.status(403).json({ error: 'Invalid or expired token' });
        }

        // Find registration by searching within tickets JSON array
        const { data: registrations, error: regError } = await supabase
            .from('registrations')
            .select('*')
            .eq('event_id', eventId);

        if (regError) {
            console.error('[Kiosk] Scan query error:', regError);
            return res.json({
                success: false,
                status: 'invalid',
                message: 'Database error'
            });
        }

        // Search for the ticket ID within the tickets array
        let foundRegistration = null;
        let foundTicket = null;

        for (const reg of registrations || []) {
            if (reg.tickets && Array.isArray(reg.tickets)) {
                const ticket = reg.tickets.find(t => t.id === qrCode || t.ticketNumber === qrCode || t.ticketId === qrCode);
                if (ticket) {
                    foundRegistration = reg;
                    foundTicket = ticket;
                    break;
                }
            }
        }

        if (!foundRegistration || !foundTicket) {
            // Log failed scan
            await logKioskAction(tokenId, eventId, 'scan_failed', {
                qrCode,
                reason: 'ticket_not_found',
                deviceId
            });

            return res.json({
                success: false,
                status: 'invalid',
                message: 'Ticket not found'
            });
        }

        // Check if already checked in
        if (foundTicket.checkedIn || foundTicket.status === 'used') {
            await logKioskAction(tokenId, eventId, 'scan_duplicate', {
                ticketId: foundTicket.id,
                attendeeName: foundTicket.attendeeName || foundRegistration.attendee_name,
                deviceId
            });

            return res.json({
                success: false,
                status: 'already_checked_in',
                message: 'Already checked in',
                attendeeName: foundTicket.attendeeName || foundRegistration.attendee_name,
                ticketType: foundTicket.name,
                checkedInAt: foundTicket.checkedInAt
            });
        }

        // Check payment status
        if (foundRegistration.payment_status !== 'paid' && foundRegistration.payment_status !== 'succeeded' && foundRegistration.total_amount > 0) {
            return res.json({
                success: true,
                status: 'payment_required',
                message: 'Payment required',
                attendeeName: foundTicket.attendeeName || foundRegistration.attendee_name,
                ticketType: foundTicket.name,
                price: foundRegistration.total_amount,
                registrationId: foundRegistration.id
            });
        }

        // Valid ticket, ready for check-in
        await logKioskAction(tokenId, eventId, 'scan_success', {
            ticketId: foundTicket.id,
            attendeeName: foundTicket.attendeeName || foundRegistration.attendee_name,
            ticketType: foundTicket.name,
            deviceId
        });

        res.json({
            success: true,
            status: 'valid',
            message: 'Valid ticket',
            attendeeName: registration.attendee_name,
            attendeeEmail: registration.attendee_email,
            ticketType: registration.ticket_type,
            price: registration.price,
            registrationId: registration.id
        });
    } catch (error) {
        console.error('[Kiosk] Scan ticket error:', error);
        res.status(500).json({ error: 'Failed to scan ticket' });
    }
};

/**
 * Search for guest by name/email/ticket ID
 * GET /api/kiosk/guest-search
 */
const searchGuest = async (req, res) => {
    try {
        const { query, tokenId, eventId } = req.query;

        if (!query || !tokenId || !eventId) {
            return res.status(400).json({ error: 'Missing required parameters' });
        }

        // Validate token
        const { data: token } = await supabase
            .from('kiosk_tokens')
            .select('*')
            .eq('token_id', tokenId)
            .eq('event_id', eventId)
            .single();

        if (!token || token.revoked || new Date(token.expires_at) < new Date()) {
            return res.status(403).json({ error: 'Invalid or expired token' });
        }

        // Search registrations using ilike for case-insensitive partial match
        // Search in: attendee_name, attendee_email, and id (registration ID)
        const searchPattern = `%${query}%`;
        const { data: registrations, error } = await supabase
            .from('registrations')
            .select('id, attendee_name, attendee_email, ticket_type, checked_in, checked_in_at, payment_status, price, tickets')
            .eq('event_id', eventId)
            .or(`attendee_name.ilike.${searchPattern},attendee_email.ilike.${searchPattern},id.ilike.${searchPattern}`)
            .limit(20);

        if (error) {
            console.error('[Kiosk] Search error:', error);
            return res.status(500).json({ error: 'Search failed' });
        }

        const results = (registrations || []).map(r => ({
            id: r.id,
            attendeeName: r.attendee_name,
            attendeeEmail: r.attendee_email,
            ticketType: r.ticket_type || 'General Admission',
            checkedIn: r.checked_in || false,
            checkedInAt: r.checked_in_at || null,
            paymentStatus: r.payment_status,
            price: r.price || 0,
            tickets: r.tickets || []
        }));

        res.json({ success: true, results });
    } catch (error) {
        console.error('[Kiosk] Guest search error:', error);
        res.status(500).json({ error: 'Failed to search guests' });
    }
};

/**
 * Check in a guest
 * POST /api/kiosk/checkin
 */
const checkInGuest = async (req, res) => {
    try {
        const { registrationId, tokenId, eventId, deviceId } = req.body;

        if (!registrationId || !tokenId || !eventId) {
            return res.status(400).json({ error: 'Missing required fields' });
        }

        // Validate token
        const { data: token } = await supabase
            .from('kiosk_tokens')
            .select('*')
            .eq('token_id', tokenId)
            .eq('event_id', eventId)
            .single();

        if (!token || token.revoked || new Date(token.expires_at) < new Date()) {
            return res.status(403).json({ error: 'Invalid or expired token' });
        }

        // Find registration
        const { data: registration, error: regError } = await supabase
            .from('registrations')
            .select('*')
            .eq('id', registrationId)
            .eq('event_id', eventId)
            .single();

        if (regError || !registration) {
            return res.status(404).json({ error: 'Registration not found' });
        }

        // Check if already checked in
        if (registration.checked_in) {
            return res.status(400).json({ 
                error: 'Already checked in',
                checkedInAt: registration.checked_in_at
            });
        }

        // Check payment if required
        if (registration.price > 0 && registration.payment_status !== 'succeeded') {
            return res.status(400).json({ error: 'Payment required before check-in' });
        }

        // Check in
        const checkedInAt = new Date().toISOString();
        const { error: updateError } = await supabase
            .from('registrations')
            .update({
                checked_in: true,
                checked_in_at: checkedInAt,
                checked_in_method: 'kiosk',
                checked_in_device: deviceId || 'unknown'
            })
            .eq('id', registrationId);

        if (updateError) {
            console.error('[Kiosk] Check-in update error:', updateError);
            return res.status(500).json({ error: 'Failed to check in' });
        }

        // Log action
        await logKioskAction(tokenId, eventId, 'checkin', {
            registrationId,
            attendeeName: registration.attendee_name,
            ticketType: registration.ticket_type,
            deviceId,
            timestamp: checkedInAt
        });

        res.json({
            success: true,
            message: 'Checked in successfully',
            attendeeName: registration.attendee_name,
            checkedInAt
        });
    } catch (error) {
        console.error('[Kiosk] Check-in error:', error);
        res.status(500).json({ error: 'Failed to check in guest' });
    }
};

/**
 * Process door payment
 * POST /api/kiosk/payment
 */
const processPayment = async (req, res) => {
    try {
        const { registrationId, tokenId, eventId, paymentMethod, amount, deviceId } = req.body;

        if (!registrationId || !tokenId || !eventId || !paymentMethod) {
            return res.status(400).json({ error: 'Missing required fields' });
        }

        // Validate token
        const { data: token } = await supabase
            .from('kiosk_tokens')
            .select('*')
            .eq('token_id', tokenId)
            .eq('event_id', eventId)
            .single();

        if (!token || token.revoked || new Date(token.expires_at) < new Date()) {
            return res.status(403).json({ error: 'Invalid or expired token' });
        }

        if (!token.payment_enabled) {
            return res.status(403).json({ error: 'Payments are not enabled for this kiosk' });
        }

        // Find registration
        const { data: registration } = await supabase
            .from('registrations')
            .select('*')
            .eq('id', registrationId)
            .eq('event_id', eventId)
            .single();

        if (!registration) {
            return res.status(404).json({ error: 'Registration not found' });
        }

        // Check if already paid
        if (registration.payment_status === 'succeeded') {
            return res.status(400).json({ error: 'Already paid' });
        }

        let paymentResult;

        if (paymentMethod === 'cash') {
            // Mark as cash payment (manual tracking)
            paymentResult = {
                id: `cash_${Date.now()}`,
                status: 'succeeded',
                method: 'cash',
                amount: amount || registration.price
            };

            await supabase
                .from('registrations')
                .update({
                    payment_status: 'succeeded',
                    payment_method: 'cash',
                    paid_at: new Date().toISOString(),
                    payment_source: 'kiosk',
                    kiosk_device_id: deviceId
                })
                .eq('id', registrationId);
        } else if (paymentMethod === 'card' || paymentMethod === 'stripe') {
            // Generate Stripe Payment Link
            const frontendUrl = process.env.FRONTEND_URL || 'http://localhost:3000';
            return res.json({
                success: true,
                requiresPayment: true,
                paymentUrl: `${frontendUrl}/#/kiosk/${eventId}/payment/${registrationId}?token=${tokenId}`,
                amount: registration.price
            });
        }

        // Log payment
        await logKioskAction(tokenId, eventId, 'payment', {
            registrationId,
            attendeeName: registration.attendee_name,
            amount: paymentResult.amount,
            method: paymentMethod,
            paymentId: paymentResult.id,
            deviceId
        });

        res.json({
            success: true,
            message: 'Payment processed successfully',
            payment: paymentResult
        });
    } catch (error) {
        console.error('[Kiosk] Payment error:', error);
        res.status(500).json({ error: 'Failed to process payment' });
    }
};

/**
 * Get kiosk activity logs
 * GET /api/kiosk/logs/:eventId
 */
const getKioskLogs = async (req, res) => {
    try {
        const { eventId } = req.params;
        const userId = req.user?.uid;

        // Verify ownership
        const { data: event } = await supabase
            .from('events')
            .select('owner_id')
            .eq('id', eventId)
            .single();

        if (!event || event.owner_id !== userId) {
            return res.status(403).json({ error: 'Unauthorized' });
        }

        // Get logs
        const { data: logs, error } = await supabase
            .from('kiosk_logs')
            .select('*')
            .eq('event_id', eventId)
            .order('timestamp', { ascending: false })
            .limit(500);

        if (error) {
            console.error('[Kiosk] Get logs error:', error);
            return res.status(500).json({ error: 'Failed to fetch logs' });
        }

        res.json({ success: true, logs });
    } catch (error) {
        console.error('[Kiosk] Get logs error:', error);
        res.status(500).json({ error: 'Failed to fetch logs' });
    }
};

/**
 * Get current kiosk token for event
 * GET /api/kiosk/token/:eventId
 */
const getCurrentToken = async (req, res) => {
    try {
        const { eventId } = req.params;
        const userId = req.user?.uid;

        // Verify ownership
        const { data: event } = await supabase
            .from('events')
            .select('owner_id')
            .eq('id', eventId)
            .single();

        if (!event || event.owner_id !== userId) {
            return res.status(403).json({ error: 'Unauthorized' });
        }

        // Get active token
        const { data: token, error } = await supabase
            .from('kiosk_tokens')
            .select('*')
            .eq('event_id', eventId)
            .eq('revoked', false)
            .single();

        if (error && error.code !== 'PGRST116') { // Not found is OK
            console.error('[Kiosk] Get token error:', error);
        }

        if (!token) {
            return res.json({ success: true, token: null });
        }

        // Check if expired
        const isExpired = new Date(token.expires_at) < new Date();

        res.json({
            success: true,
            token: {
                tokenId: token.token_id,
                expiresAt: token.expires_at,
                isExpired,
                createdAt: token.created_at,
                lastUsedAt: token.last_used_at,
                paymentEnabled: token.payment_enabled
            }
        });
    } catch (error) {
        console.error('[Kiosk] Get token error:', error);
        res.status(500).json({ error: 'Failed to fetch token' });
    }
};

/**
 * Get kiosk status for an event (active token info)
 * GET /api/kiosk/status/:eventId
 */
const getKioskStatus = async (req, res) => {
    try {
        console.log('[getKioskStatus] Called - req.user:', req.user ? req.user.uid : 'undefined');
        const { eventId } = req.params;
        const userId = req.user?.uid;

        if (!userId) {
            console.log('[getKioskStatus] No userId, returning 401');
            return res.status(401).json({ error: 'Unauthorized' });
        }

        // Verify ownership
        const { data: event } = await supabase
            .from('events')
            .select('owner_id')
            .eq('id', eventId)
            .single();

        if (!event || event.owner_id !== userId) {
            return res.status(403).json({ error: 'Unauthorized' });
        }

        // Get active non-revoked token
        const { data: token, error } = await supabase
            .from('kiosk_tokens')
            .select('*')
            .eq('event_id', eventId)
            .eq('revoked', false)
            .order('created_at', { ascending: false })
            .limit(1)
            .single();

        if (error && error.code !== 'PGRST116') { // Not found is OK
            console.error('[Kiosk] Get status error:', error);
        }

        // No active token
        if (!token) {
            return res.json({
                success: true,
                active: false
            });
        }

        // Check if expired
        const isExpired = new Date(token.expires_at) < new Date();

        if (isExpired) {
            return res.json({
                success: true,
                active: false
            });
        }

        // Active token found
        const frontendUrl = process.env.FRONTEND_URL || 'http://localhost:3000';
        const kioskUrl = `${frontendUrl}/#/kiosk/${eventId}?token=${token.token_id}`;

        console.log('[getKioskStatus] Generating URL with frontendUrl:', frontendUrl);
        console.log('[getKioskStatus] Final kioskUrl:', kioskUrl);

        res.json({
            success: true,
            active: true,
            token: {
                tokenId: token.token_id,
                permissions: token.permissions,
                paymentEnabled: token.payment_enabled,
                expiresAt: token.expires_at,
                pinCode: token.pin_code,
                createdAt: token.created_at,
                lastUsedAt: token.last_used_at
            },
            kioskUrl
        });
    } catch (error) {
        console.error('[Kiosk] Get kiosk status error:', error);
        res.status(500).json({ error: 'Failed to get kiosk status' });
    }
};

/**
 * Helper: Log kiosk action
 */
async function logKioskAction(tokenId, eventId, action, details) {
    try {
        await supabase
            .from('kiosk_logs')
            .insert({
                id: uuidv4(),
                token_id: tokenId,
                event_id: eventId,
                action,
                details,
                timestamp: new Date().toISOString()
            });
    } catch (error) {
        console.error('[Kiosk] Log action error:', error);
    }
}

export {
    generateKioskToken,
    validateKioskToken,
    revokeKioskToken,
    scanTicket,
    searchGuest,
    checkInGuest,
    processPayment,
    getKioskLogs,
    getCurrentToken,
    getKioskStatus
};
