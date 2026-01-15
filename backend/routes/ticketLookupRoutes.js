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

        // Find all tickets associated with this email
        const { data: tickets, error: ticketsError } = await supabase
            .from('tickets')
            .select('*, events!inner(*)')
            .eq('attendee_email', email)
            .order('created_at', { ascending: false });

        if (ticketsError) {
            console.error('[TicketLookup] Error fetching tickets:', ticketsError);
            throw ticketsError;
        }

        if (!tickets || tickets.length === 0) {
            console.log(`[TicketLookup] No tickets found for ${email}`);
            // Still return success to avoid revealing whether email exists in database
            return res.json({ 
                success: true, 
                message: 'If tickets are found for this email, you will receive them shortly.',
                sent: false 
            });
        }

        console.log(`[TicketLookup] Found ${tickets.length} ticket(s) for ${email}`);

        // Extract unique events
        const events = [];
        const eventIds = new Set();
        
        tickets.forEach(ticket => {
            if (ticket.events && !eventIds.has(ticket.events.id)) {
                eventIds.add(ticket.events.id);
                events.push(ticket.events);
            }
        });

        // Format tickets for email (remove events object, keep event_id)
        const formattedTickets = tickets.map(t => ({
            id: t.id,
            event_id: t.event_id,
            attendee_name: t.attendee_name,
            attendee_email: t.attendee_email,
            tier_name: t.tier_name,
            created_at: t.created_at
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
                ticketCount: tickets.length
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
        res.status(500).json({ error: 'An error occurred while finding your tickets' });
    }
});

export default router;
