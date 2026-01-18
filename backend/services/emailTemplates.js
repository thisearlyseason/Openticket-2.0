/**
 * EMAIL TEMPLATES SERVICE
 * Centralized, modern email templates with consistent styling
 * All emails use the same base design system
 */

// ============== BASE TEMPLATE SYSTEM ==============

const BASE_STYLES = {
    fontFamily: "-apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif",
    containerBg: '#f5f5f5',
    cardBg: '#ffffff',
    borderRadius: '12px',
    primaryGreen: '#10b981',
    primaryRed: '#dc2626',
    primaryBlue: '#3b82f6',
    primaryPurple: '#8b5cf6',
    textDark: '#111827',
    textMuted: '#6b7280',
    textLight: '#9ca3af',
    borderColor: '#e5e7eb',
};

/**
 * Base email wrapper - all emails use this
 */
const baseEmailWrapper = (headerColor, headerTitle, headerSubtitle, content, footerText = 'OpenTicket') => `
<!DOCTYPE html>
<html>
<head>
    <meta charset="utf-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
</head>
<body style="margin: 0; padding: 0; font-family: ${BASE_STYLES.fontFamily}; background-color: ${BASE_STYLES.containerBg};">
    <table width="100%" cellpadding="0" cellspacing="0" style="background-color: ${BASE_STYLES.containerBg}; padding: 40px 20px;">
        <tr>
            <td align="center">
                <table width="100%" style="max-width: 600px; background-color: ${BASE_STYLES.cardBg}; border-radius: ${BASE_STYLES.borderRadius}; overflow: hidden; box-shadow: 0 4px 6px rgba(0, 0, 0, 0.1);">
                    <!-- Header -->
                    <tr>
                        <td style="background: ${headerColor}; padding: 40px 30px; text-align: center;">
                            <h1 style="color: #ffffff; margin: 0; font-size: 28px; font-weight: 700;">${headerTitle}</h1>
                            ${headerSubtitle ? `<p style="color: rgba(255,255,255,0.9); margin: 10px 0 0 0; font-size: 16px;">${headerSubtitle}</p>` : ''}
                        </td>
                    </tr>
                    
                    <!-- Content -->
                    <tr>
                        <td style="padding: 40px 30px;">
                            ${content}
                        </td>
                    </tr>
                    
                    <!-- Footer -->
                    <tr>
                        <td style="background-color: #f9fafb; padding: 30px; text-align: center; border-top: 1px solid ${BASE_STYLES.borderColor};">
                            <p style="color: ${BASE_STYLES.textLight}; font-size: 12px; margin: 0;">
                                ${footerText}
                            </p>
                        </td>
                    </tr>
                </table>
            </td>
        </tr>
    </table>
</body>
</html>`;

/**
 * Helper: Event details box
 */
const eventDetailsBox = (title, date, time, location, bgColor = '#f0fdf4', borderColor = '#bbf7d0') => `
<table width="100%" style="background-color: ${bgColor}; border: 1px solid ${borderColor}; border-radius: 8px; margin-bottom: 30px;">
    <tr>
        <td style="padding: 20px;">
            <h2 style="color: ${BASE_STYLES.textDark}; font-size: 20px; font-weight: 700; margin: 0 0 15px 0;">${title}</h2>
            <p style="color: ${BASE_STYLES.textMuted}; font-size: 14px; margin: 0 0 5px 0;">📅 ${date}</p>
            <p style="color: ${BASE_STYLES.textMuted}; font-size: 14px; margin: 0 0 5px 0;">🕐 ${time}</p>
            <p style="color: ${BASE_STYLES.textMuted}; font-size: 14px; margin: 0;">📍 ${location}</p>
        </td>
    </tr>
</table>`;

/**
 * Helper: Info row
 */
const infoRow = (label, value, borderBottom = true) => `
<tr>
    <td style="padding: 8px 0; ${borderBottom ? `border-bottom: 1px solid ${BASE_STYLES.borderColor};` : ''}">
        <span style="color: ${BASE_STYLES.textMuted}; font-size: 14px;">${label}</span>
    </td>
    <td style="padding: 8px 0; ${borderBottom ? `border-bottom: 1px solid ${BASE_STYLES.borderColor};` : ''} text-align: right;">
        <strong style="color: ${BASE_STYLES.textDark};">${value}</strong>
    </td>
</tr>`;

// ============== EMAIL TEMPLATES ==============

/**
 * PURCHASE CONFIRMATION
 * Triggered by: payment_intent.succeeded (Stripe webhook)
 */
export const purchaseConfirmation = ({ attendeeName, eventTitle, eventDate, eventTime, eventLocation, tickets, totalPaid, orderId, organizerName }) => {
    const ticketList = tickets.map(t => `
        <div style="border: 1px solid ${BASE_STYLES.borderColor}; padding: 16px; margin-bottom: 12px; border-radius: 8px; background: #f9fafb;">
            <h4 style="margin: 0 0 8px 0; color: ${BASE_STYLES.textDark};">🎫 ${t.name || 'Ticket'}</h4>
            <p style="margin: 0; color: ${BASE_STYLES.textMuted}; font-size: 14px;">Qty: ${t.quantity || 1} × $${(t.price || 0).toFixed(2)}</p>
        </div>
    `).join('');

    const content = `
        <p style="color: ${BASE_STYLES.textDark}; font-size: 16px; line-height: 1.6; margin: 0 0 20px 0;">
            Hi <strong>${attendeeName}</strong>,
        </p>
        <p style="color: ${BASE_STYLES.textDark}; font-size: 16px; line-height: 1.6; margin: 0 0 30px 0;">
            Your purchase is confirmed! Here are your ticket details:
        </p>
        
        ${eventDetailsBox(eventTitle, eventDate, eventTime, eventLocation)}
        
        <h3 style="color: ${BASE_STYLES.textDark}; font-size: 16px; margin: 0 0 15px 0;">Your Tickets</h3>
        ${ticketList}
        
        <table width="100%" style="background-color: #f0fdf4; border-radius: 8px; margin: 20px 0;">
            <tr>
                <td style="padding: 15px;">
                    <table width="100%">
                        ${infoRow('Total Paid', `<span style="color: ${BASE_STYLES.primaryGreen}; font-size: 18px;">$${totalPaid.toFixed(2)}</span>`)}
                        ${infoRow('Order ID', `<span style="font-family: monospace;">${orderId}</span>`, false)}
                    </table>
                </td>
            </tr>
        </table>
        
        <p style="color: ${BASE_STYLES.textMuted}; font-size: 14px; line-height: 1.6; margin: 20px 0 0 0;">
            Save this email for your records. You may need to show it at check-in.
        </p>
    `;

    return {
        subject: `🎟️ Your Tickets for ${eventTitle}`,
        html: baseEmailWrapper(
            `linear-gradient(135deg, ${BASE_STYLES.primaryGreen} 0%, #059669 100%)`,
            "You're In! 🎉",
            "Your purchase is confirmed",
            content,
            `Organized by ${organizerName || 'Event Organizer'} • Powered by OpenTicket`
        )
    };
};

/**
 * REFUND CONFIRMATION
 * Triggered by: refund.succeeded (Stripe webhook)
 */
export const refundConfirmation = ({ attendeeName, eventTitle, eventDate, eventLocation, refundAmount, ticketsRefunded, orderId, refundReason, refundDate }) => {
    const content = `
        <p style="color: ${BASE_STYLES.textDark}; font-size: 16px; line-height: 1.6; margin: 0 0 20px 0;">
            Hi <strong>${attendeeName}</strong>,
        </p>
        <p style="color: ${BASE_STYLES.textDark}; font-size: 16px; line-height: 1.6; margin: 0 0 30px 0;">
            We've processed a refund for your ticket(s) to <strong>${eventTitle}</strong>.
        </p>
        
        <!-- Refund Details -->
        <table width="100%" style="background-color: #fef2f2; border: 1px solid #fecaca; border-radius: 8px; margin-bottom: 30px;">
            <tr>
                <td style="padding: 20px;">
                    <h3 style="color: ${BASE_STYLES.primaryRed}; font-size: 16px; margin: 0 0 15px 0;">Refund Details</h3>
                    <table width="100%">
                        ${infoRow('Refund Amount', `<span style="color: ${BASE_STYLES.primaryRed}; font-size: 18px;">$${refundAmount.toFixed(2)}</span>`)}
                        ${infoRow('Tickets Refunded', ticketsRefunded)}
                        ${infoRow('Order ID', `<span style="font-family: monospace;">${orderId}</span>`)}
                        ${infoRow('Refund Date', refundDate, false)}
                    </table>
                </td>
            </tr>
        </table>
        
        ${refundReason ? `
        <div style="background-color: #f9fafb; border-radius: 8px; padding: 15px; margin-bottom: 30px;">
            <p style="color: ${BASE_STYLES.textMuted}; font-size: 12px; text-transform: uppercase; margin: 0 0 5px 0;">Reason</p>
            <p style="color: ${BASE_STYLES.textDark}; font-size: 14px; margin: 0;">${refundReason}</p>
        </div>
        ` : ''}
        
        <div style="background-color: #f9fafb; border-radius: 8px; padding: 15px; margin-bottom: 20px;">
            <p style="color: ${BASE_STYLES.textMuted}; font-size: 12px; text-transform: uppercase; margin: 0 0 5px 0;">Original Event</p>
            <p style="color: ${BASE_STYLES.textDark}; font-size: 16px; font-weight: 600; margin: 0 0 5px 0;">${eventTitle}</p>
            <p style="color: ${BASE_STYLES.textMuted}; font-size: 14px; margin: 0;">📅 ${eventDate} • 📍 ${eventLocation}</p>
        </div>
        
        <p style="color: ${BASE_STYLES.textMuted}; font-size: 14px; line-height: 1.6; margin: 0;">
            Your refund should appear in your account within 5-10 business days, depending on your payment provider.
        </p>
    `;

    return {
        subject: `Refund Confirmation - ${eventTitle}`,
        html: baseEmailWrapper(
            `linear-gradient(135deg, ${BASE_STYLES.primaryRed} 0%, #b91c1c 100%)`,
            "Refund Processed",
            "Your tickets have been refunded",
            content,
            "This is an automated message from OpenTicket"
        )
    };
};

/**
 * ABANDONED CART REMINDER
 * Triggered by: cron job (24 hours after checkout started, no payment)
 */
export const abandonedCart = ({ attendeeName, eventTitle, eventDate, eventLocation, checkoutUrl }) => {
    const content = `
        <p style="color: ${BASE_STYLES.textDark}; font-size: 16px; line-height: 1.6; margin: 0 0 20px 0;">
            Hi ${attendeeName || 'there'},
        </p>
        <p style="color: ${BASE_STYLES.textDark}; font-size: 16px; line-height: 1.6; margin: 0 0 30px 0;">
            You started getting tickets for <strong>${eventTitle}</strong> but didn't complete your purchase.
        </p>
        
        ${eventDetailsBox(eventTitle, eventDate, 'See event page', eventLocation, '#fef3c7', '#fcd34d')}
        
        <div style="text-align: center; margin: 30px 0;">
            <a href="${checkoutUrl}" style="display: inline-block; background: linear-gradient(135deg, ${BASE_STYLES.primaryPurple} 0%, #7c3aed 100%); color: #ffffff; padding: 16px 32px; border-radius: 8px; text-decoration: none; font-weight: 600; font-size: 16px;">
                Complete Your Purchase →
            </a>
        </div>
        
        <p style="color: ${BASE_STYLES.textMuted}; font-size: 14px; line-height: 1.6; margin: 20px 0 0 0; text-align: center;">
            Tickets are selling fast. Don't miss out!
        </p>
    `;

    return {
        subject: `🎟️ You left something behind - ${eventTitle}`,
        html: baseEmailWrapper(
            `linear-gradient(135deg, ${BASE_STYLES.primaryPurple} 0%, #7c3aed 100%)`,
            "Complete Your Purchase",
            "Your tickets are waiting",
            content,
            "This is a reminder from OpenTicket"
        )
    };
};

/**
 * EVENT REMINDER (Primary - 24 hours before)
 * Triggered by: cron job (24 hours before event)
 */
export const eventReminderPrimary = ({ attendeeName, eventTitle, eventDate, eventTime, eventLocation, ticketUrl }) => {
    const content = `
        <p style="color: ${BASE_STYLES.textDark}; font-size: 16px; line-height: 1.6; margin: 0 0 20px 0;">
            Hi <strong>${attendeeName}</strong>,
        </p>
        <p style="color: ${BASE_STYLES.textDark}; font-size: 16px; line-height: 1.6; margin: 0 0 30px 0;">
            Just a friendly reminder that <strong>${eventTitle}</strong> is <strong>tomorrow</strong>! 🎉
        </p>
        
        ${eventDetailsBox(eventTitle, eventDate, eventTime, eventLocation)}
        
        <div style="text-align: center; margin: 30px 0;">
            <a href="${ticketUrl}" style="display: inline-block; background: linear-gradient(135deg, ${BASE_STYLES.primaryGreen} 0%, #059669 100%); color: #ffffff; padding: 16px 32px; border-radius: 8px; text-decoration: none; font-weight: 600; font-size: 16px;">
                View Your Ticket
            </a>
        </div>
        
        <p style="color: ${BASE_STYLES.textMuted}; font-size: 14px; line-height: 1.6; margin: 20px 0 0 0;">
            Make sure to have your ticket ready for check-in. See you there!
        </p>
    `;

    return {
        subject: `🎟️ Reminder: ${eventTitle} is Tomorrow!`,
        html: baseEmailWrapper(
            `linear-gradient(135deg, ${BASE_STYLES.primaryBlue} 0%, #2563eb 100%)`,
            "Event Tomorrow! 📅",
            "Don't forget about your event",
            content,
            "This is an automated reminder from OpenTicket"
        )
    };
};

/**
 * EVENT REMINDER (Secondary - configurable time)
 * Triggered by: cron job (organizer-configured time)
 */
export const eventReminderSecondary = ({ attendeeName, eventTitle, eventDate, eventTime, eventLocation, ticketUrl, timeUntilEvent }) => {
    const content = `
        <p style="color: ${BASE_STYLES.textDark}; font-size: 16px; line-height: 1.6; margin: 0 0 20px 0;">
            Hi <strong>${attendeeName}</strong>,
        </p>
        <p style="color: ${BASE_STYLES.textDark}; font-size: 16px; line-height: 1.6; margin: 0 0 30px 0;">
            <strong>${eventTitle}</strong> starts in <strong>${timeUntilEvent}</strong>! Get ready! 🎉
        </p>
        
        ${eventDetailsBox(eventTitle, eventDate, eventTime, eventLocation)}
        
        <div style="text-align: center; margin: 30px 0;">
            <a href="${ticketUrl}" style="display: inline-block; background: linear-gradient(135deg, ${BASE_STYLES.primaryGreen} 0%, #059669 100%); color: #ffffff; padding: 16px 32px; border-radius: 8px; text-decoration: none; font-weight: 600; font-size: 16px;">
                View Your Ticket
            </a>
        </div>
        
        <p style="color: ${BASE_STYLES.textMuted}; font-size: 14px; line-height: 1.6; margin: 20px 0 0 0;">
            Have your ticket ready for check-in. See you soon!
        </p>
    `;

    return {
        subject: `⏰ Starting Soon: ${eventTitle}`,
        html: baseEmailWrapper(
            `linear-gradient(135deg, #f59e0b 0%, #d97706 100%)`,
            `Starting in ${timeUntilEvent}!`,
            "Get ready for your event",
            content,
            "This is an automated reminder from OpenTicket"
        )
    };
};

/**
 * POST-EVENT THANK YOU
 * Triggered by: cron job (morning after event ends)
 */
export const postEventThankYou = ({ attendeeName, eventTitle, eventDate, organizerName, feedbackUrl }) => {
    const content = `
        <p style="color: ${BASE_STYLES.textDark}; font-size: 16px; line-height: 1.6; margin: 0 0 20px 0;">
            Hi <strong>${attendeeName}</strong>,
        </p>
        <p style="color: ${BASE_STYLES.textDark}; font-size: 16px; line-height: 1.6; margin: 0 0 30px 0;">
            Thank you for attending <strong>${eventTitle}</strong>! We hope you had an amazing experience.
        </p>
        
        <div style="background-color: #f0fdf4; border: 1px solid #bbf7d0; border-radius: 8px; padding: 20px; margin-bottom: 30px; text-align: center;">
            <p style="color: ${BASE_STYLES.textDark}; font-size: 18px; font-weight: 600; margin: 0 0 10px 0;">🙏 Thank You!</p>
            <p style="color: ${BASE_STYLES.textMuted}; font-size: 14px; margin: 0;">
                Your attendance made the event special.
            </p>
        </div>
        
        ${feedbackUrl ? `
        <div style="text-align: center; margin: 30px 0;">
            <p style="color: ${BASE_STYLES.textMuted}; font-size: 14px; margin: 0 0 15px 0;">
                Have a moment? We'd love to hear your thoughts.
            </p>
            <a href="${feedbackUrl}" style="display: inline-block; background: linear-gradient(135deg, ${BASE_STYLES.primaryPurple} 0%, #7c3aed 100%); color: #ffffff; padding: 14px 28px; border-radius: 8px; text-decoration: none; font-weight: 600; font-size: 14px;">
                Share Feedback
            </a>
        </div>
        ` : ''}
        
        <p style="color: ${BASE_STYLES.textMuted}; font-size: 14px; line-height: 1.6; margin: 20px 0 0 0;">
            Stay tuned for more events from ${organizerName || 'this organizer'}!
        </p>
    `;

    return {
        subject: `Thank you for attending ${eventTitle}! 🎉`,
        html: baseEmailWrapper(
            `linear-gradient(135deg, #10b981 0%, #059669 100%)`,
            "Thanks for Coming! 🙌",
            "We hope you had a great time",
            content,
            `From ${organizerName || 'Event Organizer'} • Powered by OpenTicket`
        )
    };
};

/**
 * APPROVAL CONFIRMATION
 * Triggered by: organizer approves registration (backend only)
 */
export const approvalConfirmation = ({ attendeeName, eventTitle, eventDate, eventTime, eventLocation, organizerName }) => {
    const content = `
        <p style="color: ${BASE_STYLES.textDark}; font-size: 16px; line-height: 1.6; margin: 0 0 20px 0;">
            Hi <strong>${attendeeName}</strong>,
        </p>
        <p style="color: ${BASE_STYLES.textDark}; font-size: 16px; line-height: 1.6; margin: 0 0 30px 0;">
            Great news! Your registration for <strong>${eventTitle}</strong> has been approved.
        </p>
        
        ${eventDetailsBox(eventTitle, eventDate, eventTime, eventLocation)}
        
        <p style="color: ${BASE_STYLES.textMuted}; font-size: 14px; line-height: 1.6; margin: 0;">
            We look forward to seeing you there!
        </p>
    `;

    return {
        subject: `🎉 Approved! Your Registration for ${eventTitle}`,
        html: baseEmailWrapper(
            `linear-gradient(135deg, ${BASE_STYLES.primaryGreen} 0%, #059669 100%)`,
            "You're Approved! 🎉",
            "Your registration is confirmed",
            content,
            `Organized by ${organizerName || 'Event Organizer'} • Powered by OpenTicket`
        )
    };
};

export default {
    purchaseConfirmation,
    refundConfirmation,
    abandonedCart,
    eventReminderPrimary,
    eventReminderSecondary,
    postEventThankYou,
    approvalConfirmation,
};
