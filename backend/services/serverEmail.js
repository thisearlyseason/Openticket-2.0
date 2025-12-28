import nodemailer from 'nodemailer';

const transporter = nodemailer.createTransport({
    service: 'gmail',
    auth: {
        user: process.env.EMAIL_USER,
        pass: process.env.EMAIL_APP_PASSWORD
    }
});

export const EmailService = {
    sendConfirmation: async (to, tickets, eventDetails) => {
        if (!process.env.EMAIL_USER || !process.env.EMAIL_APP_PASSWORD) {
            console.warn("[EmailService] Parsing Missing Credentials. Email simulation only.");
            console.log(`[SIMULATION] To: ${to}, Subject: Ticket Confirmation`);
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
                <h1>Order Confirmation</h1>
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
            const info = await transporter.sendMail({
                from: process.env.EMAIL_USER,
                to,
                subject,
                html: htmlBody
            });
            console.log(`[EmailService] Sent: ${info.messageId}`);
            return true;
        } catch (error) {
            console.error("[EmailService] Send Failed:", error);
            return false;
        }
    }
};
