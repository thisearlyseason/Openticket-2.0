/**
 * Email Routes - API endpoints for email delivery
 * 
 * Supports two providers:
 * 1. Resend (default) - Transactional email service
 * 2. Gmail - User's connected Gmail account (via OAuth)
 */
import express from 'express';
import resendService from '../services/resendService.js';

const router = express.Router();

/**
 * POST /api/email/send
 * Send a single email via Resend (default provider)
 */
router.post('/send', async (req, res) => {
    try {
        const { to, subject, html, text, provider } = req.body;

        if (!to || !subject || !html) {
            return res.status(400).json({ error: 'Missing required fields: to, subject, html' });
        }

        // Use Resend as the default provider
        if (!resendService.isResendConfigured()) {
            console.warn("[EmailRoutes] Resend not configured - simulating send");
            return res.json({ 
                success: true, 
                simulated: true,
                messageId: `simulated-${Date.now()}`,
                message: 'Email simulated (Resend API key not configured)'
            });
        }

        const result = await resendService.sendEmail({ to, subject, html, text });

        if (!result.success) {
            return res.status(500).json({ error: result.error || 'Failed to send email' });
        }

        res.json({
            success: true,
            messageId: result.messageId,
            provider: 'resend'
        });
    } catch (error) {
        console.error("[EmailRoutes] Send failed:", error);
        res.status(500).json({ error: error.message || 'Failed to send email' });
    }
});

/**
 * POST /api/email/send-bulk
 * Send bulk emails via Resend
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

        if (!resendService.isResendConfigured()) {
            console.warn("[EmailRoutes] Resend not configured - simulating bulk send");
            return res.json({ 
                success: true, 
                simulated: true,
                sent: recipients.length,
                failed: 0,
                message: 'Bulk email simulated (Resend API key not configured)'
            });
        }

        const result = await resendService.sendBulkEmail({ recipients, subject, html, text });

        res.json({
            success: true,
            sent: result.sent,
            failed: result.failed,
            errors: result.errors,
            provider: 'resend'
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

        // Check if Resend is configured
        if (!resendService.isResendConfigured()) {
            console.log("[EmailRoutes] Resend not configured - returning preview");
            return res.json({ 
                success: true, 
                simulated: true,
                preview: true,
                messageId: `preview-${Date.now()}`,
                message: 'Email preview generated. Configure RESEND_API_KEY to send real test emails.',
                previewData: {
                    to,
                    subject: testSubject,
                    bodyPreview: body.substring(0, 500) + (body.length > 500 ? '...' : '')
                }
            });
        }

        // Send via Resend
        const result = await resendService.sendEmail({
            to,
            subject: testSubject,
            html: htmlBody
        });

        if (!result.success) {
            // Return preview on error
            return res.json({
                success: true,
                simulated: true,
                preview: true,
                messageId: `preview-${Date.now()}`,
                message: `Could not send: ${result.error}. Showing preview instead.`,
                previewData: {
                    to,
                    subject: testSubject,
                    bodyPreview: body.substring(0, 500) + (body.length > 500 ? '...' : '')
                }
            });
        }

        res.json({
            success: true,
            messageId: result.messageId,
            message: `Test email sent successfully to ${to}`,
            provider: 'resend'
        });
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
    const status = resendService.getStatus();
    res.json(status);
});

/**
 * GET /api/email/providers
 * Get available email providers
 */
router.get('/providers', async (req, res) => {
    res.json({
        providers: [
            {
                id: 'resend',
                name: 'Resend',
                description: 'Reliable transactional email service (recommended)',
                configured: resendService.isResendConfigured(),
                icon: '📧'
            },
            {
                id: 'gmail',
                name: 'Gmail',
                description: 'Send from your connected Gmail account',
                configured: false, // This will be set by frontend based on user's Gmail connection
                icon: '📫',
                requiresOAuth: true
            }
        ],
        defaultProvider: 'resend'
    });
});

export default router;
