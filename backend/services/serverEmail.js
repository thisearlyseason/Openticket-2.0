import { createClient } from '@supabase/supabase-js';
import { Resend } from 'resend';

const resend = process.env.RESEND_API_KEY ? new Resend(process.env.RESEND_API_KEY) : null;

const sendEmailViaResend = async (to, subject, html) => {
    if (!resend || !process.env.SENDER_EMAIL) {
        console.warn('[Resend] Missing API key or sender email');
        return { sent: false, error: 'Resend not configured' };
    }

    try {
        const { data, error } = await resend.emails.send({
            from: process.env.SENDER_EMAIL,
            to,
            subject,
            html
        });

        if (error) {
            console.error('[Resend] Send error:', error);
            return { sent: false, error: error.message };
        }

        console.log('[Resend] Email sent successfully. ID:', data.id);
        return { sent: true, messageId: data.id };
    } catch (err) {
        console.error('[Resend] Exception:', err);
        return { sent: false, error: err.message };
    }
};

class EmailService {
    /**
     * Send ticket confirmation email
     * @param {string} to - Recipient email
     * @param {Array} tickets - Array of UNIQUE ticket objects with individual IDs
     * @param {Object} eventDetails - Event information
     */
    static async sendTicketConfirmation(to, tickets, eventDetails) {
        if (!to || !tickets || !Array.isArray(tickets) || tickets.length === 0) {
            console.error("[EmailService] Invalid parameters", { to, ticketsCount: tickets?.length });
            return false;
        }

        if (!resend) {
            console.warn("[EmailService] ❌ Resend not configured. Email simulation only.");
            console.log(`[SIMULATION] To: ${to}, Subject: Ticket Confirmation for ${eventDetails?.title}`);
            return false;
        }

        try {
            // Use new template system
            const { purchaseConfirmation } = await import('./emailTemplates.js');
            const emailAudit = await import('./emailAuditService.js');
            
            const eventDate = eventDetails?.date 
                ? new Date(eventDetails.date).toLocaleDateString('en-US', {
                    weekday: 'long', year: 'numeric', month: 'long', day: 'numeric'
                })
                : 'TBD';
            
            // Calculate total paid from ALL individual tickets
            const totalPaid = tickets.reduce((sum, t) => sum + (t.pricePerTicket || t.price || 0), 0);
            
            // CRITICAL: Pass tickets as-is (each ticket is already unique)
            // DO NOT transform or group them!
            const { subject, html } = purchaseConfirmation({
                attendeeName: tickets[0]?.attendeeName || 'Guest',
                eventTitle: eventDetails?.title || 'Event',
                eventDate,
                eventTime: eventDetails?.time || 'TBD',
                eventLocation: eventDetails?.location || eventDetails?.venue_name || 'TBD',
                tickets: tickets, // Pass unique tickets directly
                totalPaid,
                orderId: tickets[0]?.registrationId?.substring(0, 8).toUpperCase() || 'N/A',
                organizerName: eventDetails?.organizer || 'Event Organizer',
                ticketDesign: eventDetails?.ticket_design
            });

            console.log(`[EmailService] Sending confirmation email to ${to} with ${tickets.length} unique ticket(s)...`);
            const result = await sendEmailViaResend(to, subject, html);
            
            // Log to audit (registration ID from first ticket)
            const registrationId = tickets[0]?.registrationId || tickets[0]?.id;
            if (registrationId) {
                await emailAudit.logEmailSend({
                    triggerType: emailAudit.TRIGGER_TYPES.STRIPE_CHECKOUT_COMPLETED,
                    emailType: emailAudit.EMAIL_TYPES.PURCHASE_CONFIRMATION,
                    recipient: to,
                    registrationId,
                    eventId: eventDetails?.id,
                    success: result.sent,
                    messageId: result.messageId,
                    error: result.error
                });
            }
            
            console.log(`[EmailService] Confirmation email result: sent=${result.sent}, messageId=${result.messageId || 'N/A'}`);
            return result.sent;
        } catch (templateError) {
            console.error('[EmailService] Template error, using fallback:', templateError.message);
            
            // Fallback to basic template - each ticket individually
            const subject = `🎟️ Your Tickets for ${eventDetails?.title || 'OpenTicket Event'}`;
            const ticketRows = tickets.map(t => `
                <div style="border: 1px solid #e5e7eb; padding: 16px; margin-bottom: 12px; border-radius: 12px; background: #f9fafb;">
                    <h3 style="margin: 0 0 8px 0; color: #111827;">${t.name || 'Ticket'}</h3>
                    <p style="margin: 0; color: #6b7280;">Attendee: <strong style="color: #111827;">${t.attendeeName || 'Guest'}</strong></p>
                    <p style="font-family: monospace; color: #9ca3af; font-size: 12px; margin-top: 8px;">Ticket ID: ${t.ticketNumber || t.id || 'N/A'}</p>
                </div>
            `).join('');

            const htmlBody = `
                <div style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; max-width: 600px; margin: 0 auto; background: #ffffff;">
                    <div style="background: linear-gradient(135deg, #10b981 0%, #059669 100%); padding: 30px; text-align: center;">
                        <h1 style="color: #ffffff; margin: 0; font-size: 28px; font-weight: bold;">🎉 Your Tickets Are Ready!</h1>
                    </div>
                    <div style="padding: 30px; color: #111827;">
                        <p style="font-size: 16px; line-height: 1.6;">Hi <strong>${tickets[0]?.attendeeName || 'there'}</strong>,</p>
                        <p style="font-size: 16px; line-height: 1.6; color: #6b7280;">Your purchase for <strong>${eventDetails?.title}</strong> is confirmed!</p>
                        <h2 style="font-size: 18px; color: #111827; margin-top: 30px;">Your ${tickets.length} Ticket${tickets.length > 1 ? 's' : ''}</h2>
                        ${ticketRows}
                        <div style="background: #f9fafb; border: 1px solid #e5e7eb; border-radius: 8px; padding: 15px; margin-top: 20px;">
                            <p style="margin: 0; color: #6b7280; font-size: 14px;">Order ID: <strong style="font-family: monospace; color: #111827;">${tickets[0]?.id?.substring(0, 8).toUpperCase() || 'N/A'}</strong></p>
                        </div>
                        <p style="margin-top: 20px; color: #6b7280; font-size: 14px;">Save this email for check-in at the event.</p>
                    </div>
                </div>
            `;

            try {
                const result = await sendEmailViaResend(to, subject, htmlBody);
                return result.sent;
            } catch (fallbackError) {
                console.error('[EmailService] Fallback send failed:', fallbackError.message);
                return false;
            }
        }
    }

    /**
     * Send event update notification email
     * @param {string} to - Recipient email
     * @param {Object} eventDetails - Event details
     * @param {string} updateMessage - Update message
     */
    static async sendEventUpdate(to, eventDetails, updateMessage) {
        if (!resend) {
            console.warn("[EmailService] ❌ Resend not configured");
            return false;
        }

        const subject = `🔔 Update: ${eventDetails.title}`;
        const html = `
            <div style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; max-width: 600px; margin: 0 auto;">
                <div style="background: linear-gradient(135deg, #3b82f6 0%, #2563eb 100%); padding: 30px; text-align: center;">
                    <h1 style="color: #ffffff; margin: 0; font-size: 24px; font-weight: bold;">Event Update</h1>
                </div>
                <div style="padding: 30px; background: #ffffff; color: #111827;">
                    <h2 style="font-size: 20px; margin: 0 0 15px 0;">${eventDetails.title}</h2>
                    <p style="font-size: 16px; line-height: 1.6; color: #6b7280;">${updateMessage}</p>
                    <div style="margin-top: 20px; padding-top: 20px; border-top: 1px solid #e5e7eb;">
                        <p style="margin: 0; color: #9ca3af; font-size: 12px;">If you have questions, contact the event organizer.</p>
                    </div>
                </div>
            </div>
        `;

        try {
            const result = await sendEmailViaResend(to, subject, html);
            return result.sent;
        } catch (error) {
            console.error('[EmailService] Failed to send event update:', error.message);
            return false;
        }
    }
}

export { EmailService };
export default EmailService;
