import express from 'express';
import supabase from '../services/supabase.js';
import { EmailService } from '../services/serverEmail.js';

const router = express.Router();

/**
 * Find tickets by email and send retrieval email
 * POST /api/tickets/find-by-email
 */
router.post('/find-by-email', async (req, res) => {
    try {
        const { email } = req.body;

        if (!email) {
            return res.status(400).json({ error: 'Email is required' });
        }

        console.log(`[TicketLookup] Finding tickets for email: ${email}`);

        // Normalize email for case-insensitive search
        const normalizedEmail = email.toLowerCase().trim();

        // Find all registrations (tickets) associated with this email
        // Select only needed event fields to avoid issues with missing columns
        const { data: registrations, error: registrationsError } = await supabase
            .from('registrations')
            .select('*, events!inner(id, title, date, location, venue_name, owner_id)')
            .ilike('attendee_email', normalizedEmail)
            .order('created_at', { ascending: false });

        if (registrationsError) {
            console.error('[TicketLookup] Error fetching registrations:', registrationsError);
            throw registrationsError;
        }

        if (!registrations || registrations.length === 0) {
            console.log(`[TicketLookup] No tickets found for ${email}`);
            // Still return success to avoid revealing whether email exists in database
            return res.json({ 
                success: true, 
                message: 'If tickets are found for this email, you will receive them shortly.',
                sent: false 
            });
        }

        console.log(`[TicketLookup] Found ${registrations.length} ticket(s) for ${email}`);

        // Extract unique events
        const events = [];
        const eventIds = new Set();
        
        registrations.forEach(registration => {
            if (registration.events && !eventIds.has(registration.events.id)) {
                eventIds.add(registration.events.id);
                events.push(registration.events);
            }
        });

        // Format tickets for email (remove events object, keep event_id)
        const formattedTickets = registrations.map(r => ({
            id: r.id,
            event_id: r.event_id,
            attendee_name: r.attendee_name,
            attendee_email: r.attendee_email,
            tier_name: r.tier_name || 'General Admission',
            created_at: r.created_at
        }));

        // Send email with tickets
        console.log(`[TicketLookup] Sending ticket retrieval email to ${email}`);
        const emailResult = await EmailService.sendTicketRetrievalLink(email, formattedTickets, events);

        if (emailResult.sent) {
            console.log(`[TicketLookup] ✅ Email sent successfully`);
            return res.json({ 
                success: true, 
                message: 'Your tickets have been sent to your email!',
                sent: true,
                ticketCount: registrations.length
            });
        } else {
            console.error(`[TicketLookup] ❌ Email failed to send:`, emailResult.error);
            return res.json({ 
                success: true, 
                message: 'If tickets are found for this email, you will receive them shortly.',
                sent: false 
            });
        }
    } catch (error) {
        console.error('[TicketLookup] Error:', error);
        console.log('[TicketLookup] Error stack:', error.stack);
        console.log('[TicketLookup] Error message:', error.message);
        res.status(500).json({ error: 'An error occurred while finding your tickets' });
    }
});

export default router;
