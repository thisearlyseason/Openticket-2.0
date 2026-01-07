/**
 * Resend Email Service
 * Handles transactional email delivery via Resend API
 */

import { Resend } from 'resend';

let resendClient = null;

/**
 * Initialize Resend client
 */
const initResend = () => {
    if (!resendClient && process.env.RESEND_API_KEY) {
        resendClient = new Resend(process.env.RESEND_API_KEY);
        console.log('[ResendService] Initialized successfully');
    }
    return resendClient;
};

/**
 * Check if Resend is configured
 */
export const isResendConfigured = () => {
    return !!process.env.RESEND_API_KEY;
};

/**
 * Get the sender email address
 */
export const getSenderEmail = () => {
    return process.env.SENDER_EMAIL || 'onboarding@resend.dev';
};

/**
 * Send a single email via Resend
 * @param {Object} options - Email options
 * @param {string} options.to - Recipient email
 * @param {string} options.subject - Email subject
 * @param {string} options.html - HTML content
 * @param {string} [options.text] - Plain text content (auto-generated if not provided)
 * @param {string} [options.from] - Sender email (uses default if not provided)
 * @returns {Promise<{success: boolean, messageId?: string, error?: string}>}
 */
export const sendEmail = async ({ to, subject, html, text, from }) => {
    const client = initResend();
    
    if (!client) {
        console.warn('[ResendService] Not configured - API key missing');
        return {
            success: false,
            error: 'Resend API key not configured'
        };
    }

    try {
        const senderEmail = from || getSenderEmail();
        const plainText = text || html.replace(/<[^>]*>/g, '');

        const { data, error } = await client.emails.send({
            from: `OpenTicket <${senderEmail}>`,
            to: [to],
            subject,
            html,
            text: plainText
        });

        if (error) {
            console.error('[ResendService] Send failed:', error);
            return {
                success: false,
                error: error.message || 'Failed to send email'
            };
        }

        console.log(`[ResendService] Email sent: ${data.id} to ${to}`);
        return {
            success: true,
            messageId: data.id
        };
    } catch (err) {
        console.error('[ResendService] Exception:', err);
        return {
            success: false,
            error: err.message || 'Failed to send email'
        };
    }
};

/**
 * Send bulk emails via Resend
 * @param {Object} options - Bulk email options
 * @param {Array<string|{email: string, name?: string}>} options.recipients - List of recipients
 * @param {string} options.subject - Email subject
 * @param {string} options.html - HTML content (can include {{name}} for personalization)
 * @param {string} [options.text] - Plain text content
 * @returns {Promise<{success: boolean, sent: number, failed: number, errors: Array}>}
 */
export const sendBulkEmail = async ({ recipients, subject, html, text }) => {
    const client = initResend();
    
    if (!client) {
        return {
            success: false,
            sent: 0,
            failed: recipients.length,
            errors: [{ error: 'Resend API key not configured' }]
        };
    }

    let sent = 0;
    let failed = 0;
    const errors = [];
    const senderEmail = getSenderEmail();

    // Process in batches to avoid rate limits
    const BATCH_SIZE = 10;
    const DELAY_BETWEEN_BATCHES = 500; // 500ms

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

                const { data, error } = await client.emails.send({
                    from: `OpenTicket <${senderEmail}>`,
                    to: [email],
                    subject,
                    html: personalizedHtml,
                    text: text || personalizedHtml.replace(/<[^>]*>/g, '')
                });

                if (error) {
                    failed++;
                    errors.push({ email, error: error.message });
                } else {
                    sent++;
                }
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

    console.log(`[ResendService] Bulk send complete: ${sent} sent, ${failed} failed`);

    return {
        success: true,
        sent,
        failed,
        errors: errors.slice(0, 10) // Return first 10 errors only
    };
};

/**
 * Get Resend service status
 */
export const getStatus = () => {
    const configured = isResendConfigured();
    return {
        configured,
        available: configured,
        provider: 'resend',
        senderEmail: getSenderEmail(),
        message: configured 
            ? 'Resend email service is ready'
            : 'Resend API key not configured'
    };
};

export default {
    isResendConfigured,
    getSenderEmail,
    sendEmail,
    sendBulkEmail,
    getStatus
};
