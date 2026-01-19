/**
 * KIOSK MODE CONTROLLER
 * Handles secure, event-scoped kiosk operations
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
        const userId = req.userId;

        if (!eventId) {
            return res.status(400).json({ error: 'Event ID is required' });
        }

        // Verify user owns this event
        const event = await db.collection('events').findOne({ id: eventId }, { projection: { _id: 0 } });
        if (!event) {
            return res.status(404).json({ error: 'Event not found' });
        }

        if (event.organizerId !== userId) {
            return res.status(403).json({ error: 'Unauthorized: You do not own this event' });
        }

        // Calculate expiration: event end time + 8 hours
        const eventEndDate = new Date(event.date);
        if (event.endTime) {
            const [hours, minutes] = event.endTime.split(':');
            eventEndDate.setHours(parseInt(hours), parseInt(minutes));
        } else if (event.time) {
            const [hours, minutes] = event.time.split(':');
            eventEndDate.setHours(parseInt(hours) + (event.duration || 2), parseInt(minutes));
        }
        const expiresAt = new Date(eventEndDate.getTime() + 8 * 60 * 60 * 1000); // +8 hours

        // Create kiosk token
        const token = {
            tokenId: uuidv4(),
            type: 'kiosk',
            eventId,
            permissions: permissions || ['scan_ticket', 'manual_checkin', 'door_payment'],
            paymentEnabled: paymentEnabled !== false,
            pinCode: pinCode || null, // PIN to exit kiosk (optional)
            expiresAt: expiresAt.toISOString(),
            revoked: false,
            createdBy: userId,
            createdAt: new Date().toISOString(),
            lastUsedAt: null
        };

        // Save to database
        await db.collection('kiosk_tokens').insertOne(token);

        // Update event to mark kiosk enabled
        await db.collection('events').updateOne(
            { id: eventId },
            { $set: { kioskEnabled: true, kioskTokenId: token.tokenId } }
        );

        res.json({
            success: true,
            token: token.tokenId,
            expiresAt: token.expiresAt,
            kioskUrl: `${process.env.FRONTEND_URL || 'http://localhost:3000'}/#/kiosk/${eventId}?token=${token.tokenId}`
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
        const token = await db.collection('kiosk_tokens').findOne(
            { tokenId, eventId },
            { projection: { _id: 0 } }
        );

        if (!token) {
            return res.status(404).json({ error: 'Invalid token' });
        }

        // Check if revoked
        if (token.revoked) {
            return res.status(403).json({ error: 'Token has been revoked' });
        }

        // Check if expired
        if (new Date(token.expiresAt) < new Date()) {
            return res.status(403).json({ error: 'Token has expired' });
        }

        // Update last used time
        await db.collection('kiosk_tokens').updateOne(
            { tokenId },
            { $set: { lastUsedAt: new Date().toISOString() } }
        );

        // Get event data
        const event = await db.collection('events').findOne({ id: eventId }, { projection: { _id: 0 } });
        if (!event) {
            return res.status(404).json({ error: 'Event not found' });
        }

        res.json({
            success: true,
            token: {
                tokenId: token.tokenId,
                permissions: token.permissions,
                paymentEnabled: token.paymentEnabled,
                expiresAt: token.expiresAt
            },
            event: {
                id: event.id,
                title: event.title,
                date: event.date,
                time: event.time,
                location: event.location,
                imageUrl: event.imageUrl,
                ticketTiers: event.ticketTiers,
                organizerId: event.organizerId,
                organizer: event.organizer
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
        const userId = req.userId;

        if (!tokenId || !eventId) {
            return res.status(400).json({ error: 'Token ID and Event ID are required' });
        }

        // Verify ownership
        const event = await db.collection('events').findOne({ id: eventId });
        if (!event || event.organizerId !== userId) {
            return res.status(403).json({ error: 'Unauthorized' });
        }

        // Revoke token
        const result = await db.collection('kiosk_tokens').updateOne(
            { tokenId, eventId },
            { $set: { revoked: true, revokedAt: new Date().toISOString() } }
        );

        if (result.matchedCount === 0) {
            return res.status(404).json({ error: 'Token not found' });
        }

        // Update event
        await db.collection('events').updateOne(
            { id: eventId },
            { $set: { kioskEnabled: false } }
        );

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
        const token = await db.collection('kiosk_tokens').findOne({ tokenId, eventId });
        if (!token || token.revoked || new Date(token.expiresAt) < new Date()) {
            return res.status(403).json({ error: 'Invalid or expired token' });
        }

        // Find registration by QR code (ticket ID)
        const registration = await db.collection('registrations').findOne(
            { ticketId: qrCode, eventId },
            { projection: { _id: 0 } }
        );

        if (!registration) {
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
        if (registration.checkedIn) {
            await logKioskAction(tokenId, eventId, 'scan_duplicate', {
                ticketId: registration.ticketId,
                attendeeName: registration.attendeeName,
                deviceId
            });

            return res.json({
                success: false,
                status: 'already_checked_in',
                message: 'Already checked in',
                attendeeName: registration.attendeeName,
                ticketType: registration.ticketType,
                checkedInAt: registration.checkedInAt
            });
        }

        // Check payment status
        if (registration.paymentStatus !== 'succeeded' && registration.price > 0) {
            return res.json({
                success: true,
                status: 'payment_required',
                message: 'Payment required',
                attendeeName: registration.attendeeName,
                ticketType: registration.ticketType,
                price: registration.price,
                registrationId: registration.id
            });
        }

        // Valid ticket, ready for check-in
        await logKioskAction(tokenId, eventId, 'scan_success', {
            ticketId: registration.ticketId,
            attendeeName: registration.attendeeName,
            ticketType: registration.ticketType,
            deviceId
        });

        res.json({
            success: true,
            status: 'valid',
            message: 'Valid ticket',
            attendeeName: registration.attendeeName,
            attendeeEmail: registration.attendeeEmail,
            ticketType: registration.ticketType,
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
        const token = await db.collection('kiosk_tokens').findOne({ tokenId, eventId });
        if (!token || token.revoked || new Date(token.expiresAt) < new Date()) {
            return res.status(403).json({ error: 'Invalid or expired token' });
        }

        // Search registrations
        const searchRegex = new RegExp(query, 'i');
        const registrations = await db.collection('registrations')
            .find({
                eventId,
                $or: [
                    { attendeeName: searchRegex },
                    { attendeeEmail: searchRegex },
                    { ticketId: searchRegex },
                    { id: searchRegex }
                ]
            })
            .limit(20)
            .toArray();

        const results = registrations.map(r => ({
            id: r.id,
            attendeeName: r.attendeeName,
            attendeeEmail: r.attendeeEmail,
            ticketType: r.ticketType,
            ticketId: r.ticketId,
            checkedIn: r.checkedIn || false,
            checkedInAt: r.checkedInAt || null,
            paymentStatus: r.paymentStatus,
            price: r.price || 0
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
        const token = await db.collection('kiosk_tokens').findOne({ tokenId, eventId });
        if (!token || token.revoked || new Date(token.expiresAt) < new Date()) {
            return res.status(403).json({ error: 'Invalid or expired token' });
        }

        // Find registration
        const registration = await db.collection('registrations').findOne({ id: registrationId, eventId });
        if (!registration) {
            return res.status(404).json({ error: 'Registration not found' });
        }

        // Check if already checked in
        if (registration.checkedIn) {
            return res.status(400).json({ 
                error: 'Already checked in',
                checkedInAt: registration.checkedInAt
            });
        }

        // Check payment if required
        if (registration.price > 0 && registration.paymentStatus !== 'succeeded') {
            return res.status(400).json({ error: 'Payment required before check-in' });
        }

        // Check in
        const checkedInAt = new Date().toISOString();
        await db.collection('registrations').updateOne(
            { id: registrationId },
            {
                $set: {
                    checkedIn: true,
                    checkedInAt,
                    checkedInMethod: 'kiosk',
                    checkedInDevice: deviceId || 'unknown'
                }
            }
        );

        // Log action
        await logKioskAction(tokenId, eventId, 'checkin', {
            registrationId,
            attendeeName: registration.attendeeName,
            ticketType: registration.ticketType,
            deviceId,
            timestamp: checkedInAt
        });

        res.json({
            success: true,
            message: 'Checked in successfully',
            attendeeName: registration.attendeeName,
            checkedInAt
        });
    } catch (error) {
        console.error('[Kiosk] Check-in error:', error);
        res.status(500).json({ error: 'Failed to check in guest' });
    }
};

/**
 * Process door payment (Stripe Payment Link)
 * POST /api/kiosk/payment
 */
const processPayment = async (req, res) => {
    try {
        const { registrationId, tokenId, eventId, paymentMethod, amount, deviceId } = req.body;

        if (!registrationId || !tokenId || !eventId || !paymentMethod) {
            return res.status(400).json({ error: 'Missing required fields' });
        }

        // Validate token
        const token = await db.collection('kiosk_tokens').findOne({ tokenId, eventId });
        if (!token || token.revoked || new Date(token.expiresAt) < new Date()) {
            return res.status(403).json({ error: 'Invalid or expired token' });
        }

        if (!token.paymentEnabled) {
            return res.status(403).json({ error: 'Payments are not enabled for this kiosk' });
        }

        // Find registration
        const registration = await db.collection('registrations').findOne({ id: registrationId, eventId });
        if (!registration) {
            return res.status(404).json({ error: 'Registration not found' });
        }

        // Check if already paid
        if (registration.paymentStatus === 'succeeded') {
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

            await db.collection('registrations').updateOne(
                { id: registrationId },
                {
                    $set: {
                        paymentStatus: 'succeeded',
                        paymentMethod: 'cash',
                        paidAt: new Date().toISOString(),
                        paymentSource: 'kiosk',
                        kioskDeviceId: deviceId
                    }
                }
            );
        } else if (paymentMethod === 'card') {
            // Generate Stripe Payment Link
            // This will be handled by returning a payment URL
            const event = await db.collection('events').findOne({ id: eventId });
            
            // For now, return payment link URL
            // In production, integrate with Stripe Payment Links API
            return res.json({
                success: true,
                requiresPayment: true,
                paymentUrl: `${process.env.FRONTEND_URL || 'http://localhost:3000'}/#/kiosk/${eventId}/payment/${registrationId}`,
                amount: registration.price
            });
        }

        // Log payment
        await logKioskAction(tokenId, eventId, 'payment', {
            registrationId,
            attendeeName: registration.attendeeName,
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
        const userId = req.userId;

        // Verify ownership
        const event = await db.collection('events').findOne({ id: eventId });
        if (!event || event.organizerId !== userId) {
            return res.status(403).json({ error: 'Unauthorized' });
        }

        // Get logs
        const logs = await db.collection('kiosk_logs')
            .find({ eventId })
            .sort({ timestamp: -1 })
            .limit(500)
            .toArray();

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
        const userId = req.userId;

        // Verify ownership
        const event = await db.collection('events').findOne({ id: eventId });
        if (!event || event.organizerId !== userId) {
            return res.status(403).json({ error: 'Unauthorized' });
        }

        // Get active token
        const token = await db.collection('kiosk_tokens').findOne(
            { eventId, revoked: false },
            { projection: { _id: 0 } }
        );

        if (!token) {
            return res.json({ success: true, token: null });
        }

        // Check if expired
        const isExpired = new Date(token.expiresAt) < new Date();

        res.json({
            success: true,
            token: {
                tokenId: token.tokenId,
                expiresAt: token.expiresAt,
                isExpired,
                createdAt: token.createdAt,
                lastUsedAt: token.lastUsedAt,
                paymentEnabled: token.paymentEnabled
            }
        });
    } catch (error) {
        console.error('[Kiosk] Get token error:', error);
        res.status(500).json({ error: 'Failed to fetch token' });
    }
};

/**
 * Helper: Log kiosk action
 */
async function logKioskAction(tokenId, eventId, action, details) {
    try {
        await db.collection('kiosk_logs').insertOne({
            id: uuidv4(),
            tokenId,
            eventId,
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
    getCurrentToken
};
