/**
 * Email Service - Lightweight wrapper for sending emails via Resend
 * This provides a simpler interface for basic email needs
 */

import resendService from './resendService.js';

export const EmailService = {
    sendConfirmation: async (to, tickets, eventDetails) => {
        if (!resendService.isResendConfigured()) {
            console.warn("[EmailService] Resend not configured. Email simulation only.");
            console.log(`[SIMULATION] To: ${to}, Subject: Ticket Confirmation for ${eventDetails?.title}`);
            return false;
        }

        const subject = `Your Tickets for ${eventDetails?.title || 'OpenTicket Event'}`;

        const ticketRows = tickets.map(t => `
            <div style="border: 1px solid #ccc; padding: 10px; margin-bottom: 10px; border-radius: 8px;">
                <h3 style="margin: 0 0 5px 0;">${t.name} (Tier: ${t.tierId})</h3>
                <p style="margin: 0;">Attendee: <strong>${t.attendeeName}</strong></p>
                <p style="font-family: monospace; color: #666;">ID: ${t.id}</p>
            </div>
        `).join('');

        const htmlBody = `
            <div style="font-family: sans-serif; max-width: 600px; margin: 0 auto;">
                <h1 style="color: #ec4899;">Order Confirmation</h1>
                <p>Thank you for your purchase!</p>
                <div style="background: #f9f9f9; padding: 15px; border-radius: 8px; margin: 20px 0;">
                    <p><strong>Event:</strong> ${eventDetails?.title || 'N/A'}</p>
                    <p><strong>Date:</strong> ${eventDetails?.date ? new Date(eventDetails.date).toLocaleString() : 'N/A'}</p>
                    <p><strong>Location:</strong> ${eventDetails?.location || 'Online'}</p>
                </div>
                <h2>Your Tickets</h2>
                ${ticketRows}
                <hr style="border: none; border-top: 1px solid #eee; margin: 20px 0;" />
                <p>Please present these tickets at the entrance.</p>
                <p style="font-size: 12px; color: #999;">Order ID: ${tickets[0]?.id || 'N/A'}</p>
            </div>
        `;

        try {
            const result = await resendService.sendEmail({
                to,
                subject,
                html: htmlBody
            });
            
            if (result.success) {
                console.log(`[EmailService] Sent via Resend: ${result.messageId}`);
                return true;
            } else {
                console.error("[EmailService] Send Failed:", result.error);
                return false;
            }
        } catch (error) {
            console.error("[EmailService] Send Failed:", error);
            return false;
        }
    }
};
