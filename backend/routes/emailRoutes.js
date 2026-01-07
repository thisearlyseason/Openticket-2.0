/**
 * Email Routes - API endpoints for email delivery
 */
import express from 'express';
import nodemailer from 'nodemailer';

const router = express.Router();

// Create transporter
let transporter;
try {
    if (process.env.EMAIL_USER && process.env.EMAIL_APP_PASSWORD) {
        transporter = nodemailer.createTransport({
            service: 'gmail',
            auth: {
                user: process.env.EMAIL_USER,
                pass: process.env.EMAIL_APP_PASSWORD
            }
        });
    }
} catch (e) {
    console.warn("[EmailRoutes] Transporter init failed:", e.message);
}

/**
 * POST /api/email/send
 * Send an email via OpenTicket Mailing Service (Nodemailer/Platform email)
 */
router.post('/send', async (req, res) => {
    try {
        const { to, subject, html, text } = req.body;

        if (!to || !subject || !html) {
            return res.status(400).json({ error: 'Missing required fields: to, subject, html' });
        }

        if (!process.env.EMAIL_USER || !process.env.EMAIL_APP_PASSWORD) {
            console.warn("[EmailRoutes] Email credentials not configured - simulating send");
            return res.json({ 
                success: true, 
                simulated: true,
                messageId: `simulated-${Date.now()}`,
                message: 'Email simulated (credentials not configured)'
            });
        }

        if (!transporter) {
            return res.status(503).json({ error: 'Email service not available' });
        }

        const info = await transporter.sendMail({
            from: `"OpenTicket" <${process.env.EMAIL_USER}>`,
            to,
            subject,
            html,
            text: text || html.replace(/<[^>]*>/g, '') // Strip HTML for text version
        });

        console.log(`[EmailRoutes] Email sent: ${info.messageId} to ${to}`);

        res.json({
            success: true,
            messageId: info.messageId
        });
    } catch (error) {
        console.error("[EmailRoutes] Send failed:", error);
        res.status(500).json({ error: error.message || 'Failed to send email' });
    }
});

/**
 * POST /api/email/send-bulk
 * Send bulk emails via OpenTicket Mailing Service
 * Used for campaigns and broadcasts
 */
router.post('/send-bulk', async (req, res) => {
    try {
        const { recipients, subject, html, text } = req.body;

        if (!recipients || !Array.isArray(recipients) || recipients.length === 0) {
            return res.status(400).json({ error: 'Recipients array required' });
        }

        if (!subject || !html) {
            return res.status(400).json({ error: 'Missing required fields: subject, html' });
        }

        if (!process.env.EMAIL_USER || !process.env.EMAIL_APP_PASSWORD) {
            console.warn("[EmailRoutes] Email credentials not configured - simulating bulk send");
            return res.json({ 
                success: true, 
                simulated: true,
                sent: recipients.length,
                failed: 0,
                message: 'Bulk email simulated (credentials not configured)'
            });
        }

        if (!transporter) {
            return res.status(503).json({ error: 'Email service not available' });
        }

        let sent = 0;
        let failed = 0;
        const errors = [];

        // Send emails in batches to avoid rate limits
        const BATCH_SIZE = 50;
        const DELAY_BETWEEN_BATCHES = 1000; // 1 second

        for (let i = 0; i < recipients.length; i += BATCH_SIZE) {
            const batch = recipients.slice(i, i + BATCH_SIZE);
            
            const promises = batch.map(async (recipient) => {
                try {
                    const email = typeof recipient === 'string' ? recipient : recipient.email;
                    const name = typeof recipient === 'object' ? recipient.name : undefined;
                    
                    // Personalize HTML if name provided
                    let personalizedHtml = html;
                    if (name) {
                        personalizedHtml = html.replace(/{{name}}/g, name);
                    }

                    await transporter.sendMail({
                        from: `"OpenTicket" <${process.env.EMAIL_USER}>`,
                        to: email,
                        subject,
                        html: personalizedHtml,
                        text: text || personalizedHtml.replace(/<[^>]*>/g, '')
                    });
                    
                    sent++;
                } catch (err) {
                    failed++;
                    errors.push({ email: recipient, error: err.message });
                }
            });

            await Promise.all(promises);

            // Add delay between batches
            if (i + BATCH_SIZE < recipients.length) {
                await new Promise(resolve => setTimeout(resolve, DELAY_BETWEEN_BATCHES));
            }
        }

        console.log(`[EmailRoutes] Bulk send complete: ${sent} sent, ${failed} failed`);

        res.json({
            success: true,
            sent,
            failed,
            errors: errors.slice(0, 10) // Return first 10 errors only
        });
    } catch (error) {
        console.error("[EmailRoutes] Bulk send failed:", error);
        res.status(500).json({ error: error.message || 'Failed to send bulk email' });
    }
});

/**
 * POST /api/email/send-test
 * Send a test email to the organizer using a template
 * Replaces template variables with sample data
 */
router.post('/send-test', async (req, res) => {
    try {
        const { to, template } = req.body;

        if (!to || !template) {
            return res.status(400).json({ error: 'Missing required fields: to, template' });
        }

        if (!template.subject || !template.body) {
            return res.status(400).json({ error: 'Template must have subject and body' });
        }

        // Sample data to replace template variables
        const sampleData = {
            attendee_name: 'John Doe',
            event_title: 'Sample Event - Test',
            event_date: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toLocaleDateString('en-US', {
                weekday: 'long',
                year: 'numeric',
                month: 'long',
                day: 'numeric',
                hour: '2-digit',
                minute: '2-digit'
            }),
            event_location: '123 Main Street, San Francisco, CA',
            ticket_type: 'General Admission',
            ticket_price: '$25.00',
            order_id: 'TEST-' + Date.now().toString(36).toUpperCase(),
            organizer_name: 'Test Organizer',
            venue_name: 'The Grand Venue'
        };

        // Replace template variables in subject and body
        let subject = template.subject;
        let body = template.body;

        Object.entries(sampleData).forEach(([key, value]) => {
            const regex = new RegExp(`{{${key}}}`, 'g');
            subject = subject.replace(regex, value);
            body = body.replace(regex, value);
        });

        // Remove any remaining unreplaced variables
        subject = subject.replace(/{{.*?}}/g, '[SAMPLE]');
        body = body.replace(/{{.*?}}/g, '[SAMPLE]');

        // Add test email banner
        const testBanner = `
            <div style="background: #FEF3C7; border: 2px solid #F59E0B; padding: 12px 16px; margin-bottom: 20px; border-radius: 8px; text-align: center;">
                <strong style="color: #92400E;">🧪 TEST EMAIL</strong>
                <p style="margin: 4px 0 0 0; font-size: 12px; color: #92400E;">
                    This is a test email. Template variables have been replaced with sample data.
                </p>
            </div>
        `;

        const htmlBody = testBanner + body;
        const testSubject = `[TEST] ${subject}`;

        // Check if email credentials are configured
        if (!process.env.EMAIL_USER || !process.env.EMAIL_APP_PASSWORD || !transporter) {
            console.log("[EmailRoutes] Email credentials not configured - returning preview");
            return res.json({ 
                success: true, 
                simulated: true,
                preview: true,
                messageId: `preview-${Date.now()}`,
                message: 'Email preview generated. To send real test emails, configure SMTP credentials in your environment.',
                previewData: {
                    to,
                    subject: testSubject,
                    bodyPreview: body.substring(0, 500) + (body.length > 500 ? '...' : '')
                }
            });
        }

        // Try to send the email
        try {
            const info = await transporter.sendMail({
                from: `"OpenTicket Test" <${process.env.EMAIL_USER}>`,
                to,
                subject: testSubject,
                html: htmlBody,
                text: htmlBody.replace(/<[^>]*>/g, '')
            });

            console.log(`[EmailRoutes] Test email sent: ${info.messageId} to ${to}`);

            res.json({
                success: true,
                messageId: info.messageId,
                message: `Test email sent successfully to ${to}`
            });
        } catch (sendError) {
            // Handle Gmail authentication errors gracefully
            console.error("[EmailRoutes] Email send failed:", sendError.message);
            
            // Check for common Gmail auth errors
            if (sendError.message && (
                sendError.message.includes('Username and Password not accepted') ||
                sendError.message.includes('Invalid login') ||
                sendError.message.includes('BadCredentials')
            )) {
                return res.json({
                    success: true,
                    simulated: true,
                    preview: true,
                    messageId: `preview-${Date.now()}`,
                    message: 'Gmail credentials are invalid or expired. Showing email preview instead. To fix: update EMAIL_USER and EMAIL_APP_PASSWORD in your environment, or use a different email provider.',
                    previewData: {
                        to,
                        subject: testSubject,
                        bodyPreview: body.substring(0, 500) + (body.length > 500 ? '...' : '')
                    }
                });
            }
            
            throw sendError;
        }
    } catch (error) {
        console.error("[EmailRoutes] Test send failed:", error);
        res.status(500).json({ error: error.message || 'Failed to send test email' });
    }
});

/**
 * GET /api/email/status
 * Check email service status
 */
router.get('/status', async (req, res) => {
    const configured = !!(process.env.EMAIL_USER && process.env.EMAIL_APP_PASSWORD);
    const available = configured && !!transporter;

    res.json({
        configured,
        available,
        provider: 'openticket_mailer',
        message: available 
            ? 'OpenTicket Mailing Service is ready'
            : configured 
                ? 'Email service error - transporter not initialized'
                : 'Email credentials not configured'
    });
});

export default router;
