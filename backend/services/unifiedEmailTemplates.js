/**
 * UNIFIED EMAIL TEMPLATE SERVICE
 * Single global email layout for all system-generated emails
 * 
 * Structure:
 * 1. Event image at top (fixed position)
 * 2. Editable text content block
 * 3. Context-specific CTA buttons
 * 4. For confirmations: Ticket details + QR codes
 */

// ============== GLOBAL STYLES ==============
const GLOBAL_STYLES = {
    fontFamily: "-apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif",
    containerBg: '#f5f5f5',
    cardBg: '#ffffff',
    primaryColor: '#00c9cc', // Teal - OpenTicket brand
    textDark: '#111827',
    textMuted: '#6b7280',
    borderColor: '#e5e7eb',
};

/**
 * Universal email wrapper - used by ALL email types
 */
const universalEmailWrapper = ({
    eventImageUrl,
    logoUrl,
    title,
    subtitle,
    content,
    ctaButtons = [],
    footer,
    ticketSection = null // Only for confirmation emails
}) => {
    const styles = GLOBAL_STYLES;
    
    return `
<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>${title}</title>
    <!--[if mso]>
    <noscript>
        <xml>
            <o:OfficeDocumentSettings>
                <o:PixelsPerInch>96</o:PixelsPerInch>
            </o:OfficeDocumentSettings>
        </xml>
    </noscript>
    <![endif]-->
</head>
<body style="margin: 0; padding: 0; font-family: ${styles.fontFamily}; background-color: ${styles.containerBg}; -webkit-font-smoothing: antialiased;">
    <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="background-color: ${styles.containerBg};">
        <tr>
            <td align="center" style="padding: 40px 20px;">
                <table role="presentation" width="100%" style="max-width: 600px; background-color: ${styles.cardBg}; border-radius: 16px; overflow: hidden; box-shadow: 0 4px 6px -1px rgba(0, 0, 0, 0.1);">
                    
                    <!-- EVENT IMAGE (Fixed Position at Top) -->
                    ${eventImageUrl ? `
                    <tr>
                        <td>
                            <img src="${eventImageUrl}" alt="Event" style="width: 100%; height: 200px; object-fit: cover; display: block;" />
                        </td>
                    </tr>
                    ` : ''}
                    
                    <!-- LOGO (Optional) -->
                    ${logoUrl ? `
                    <tr>
                        <td align="center" style="padding: 24px 24px 0 24px;">
                            <img src="${logoUrl}" alt="Logo" style="max-height: 60px; max-width: 200px; object-fit: contain;" />
                        </td>
                    </tr>
                    ` : ''}
                    
                    <!-- HEADER -->
                    <tr>
                        <td align="center" style="padding: 24px 24px 16px 24px;">
                            <h1 style="margin: 0; font-size: 28px; font-weight: 800; color: ${styles.textDark}; line-height: 1.2;">
                                ${title}
                            </h1>
                            ${subtitle ? `
                            <p style="margin: 8px 0 0 0; font-size: 16px; color: ${styles.textMuted};">
                                ${subtitle}
                            </p>
                            ` : ''}
                        </td>
                    </tr>
                    
                    <!-- MAIN CONTENT -->
                    <tr>
                        <td style="padding: 0 24px 24px 24px;">
                            ${content}
                        </td>
                    </tr>
                    
                    <!-- CTA BUTTONS -->
                    ${ctaButtons.length > 0 ? `
                    <tr>
                        <td align="center" style="padding: 0 24px 24px 24px;">
                            <table role="presentation" cellspacing="0" cellpadding="0">
                                <tr>
                                    ${ctaButtons.map((btn, i) => `
                                    <td style="padding: ${i > 0 ? '0 0 0 12px' : '0'};">
                                        <a href="${btn.url}" style="display: inline-block; padding: 14px 28px; background: ${btn.primary ? styles.primaryColor : 'transparent'}; color: ${btn.primary ? '#000000' : styles.textDark}; text-decoration: none; font-weight: 700; font-size: 14px; border-radius: 8px; border: 2px solid ${btn.primary ? styles.primaryColor : styles.borderColor};">
                                            ${btn.label}
                                        </a>
                                    </td>
                                    `).join('')}
                                </tr>
                            </table>
                        </td>
                    </tr>
                    ` : ''}
                    
                    <!-- TICKET SECTION (For Confirmation Emails Only) -->
                    ${ticketSection ? `
                    <tr>
                        <td style="padding: 0 24px 24px 24px;">
                            ${ticketSection}
                        </td>
                    </tr>
                    ` : ''}
                    
                    <!-- FOOTER -->
                    <tr>
                        <td style="padding: 24px; background-color: #f9fafb; border-top: 1px solid ${styles.borderColor};">
                            <p style="margin: 0; font-size: 12px; color: ${styles.textMuted}; text-align: center;">
                                ${footer || 'Powered by OpenTicket'}
                            </p>
                        </td>
                    </tr>
                    
                </table>
            </td>
        </tr>
    </table>
</body>
</html>
    `.trim();
};

/**
 * Generate event details box (reusable)
 */
const generateEventDetailsBox = (eventTitle, eventDate, eventTime, eventLocation) => {
    return `
        <table width="100%" style="background: #ffffff; border: 2px solid ${GLOBAL_STYLES.primaryColor}; border-radius: 12px; margin-bottom: 24px;">
            <tr>
                <td style="padding: 20px;">
                    <h2 style="color: #111827; font-size: 20px; font-weight: 700; margin: 0 0 12px 0;">${eventTitle}</h2>
                    <p style="color: #374151; font-size: 14px; margin: 0 0 6px 0;">📅 ${eventDate}</p>
                    <p style="color: #374151; font-size: 14px; margin: 0 0 6px 0;">🕐 ${eventTime}</p>
                    <p style="color: #374151; font-size: 14px; margin: 0;">📍 ${eventLocation}</p>
                </td>
            </tr>
        </table>
    `;
};

/**
 * Generate QR code section for tickets
 */
const generateQRCodeSection = (tickets, qrCodeBaseUrl) => {
    if (!tickets || tickets.length === 0) return '';
    
    return tickets.map((ticket, index) => `
        <table width="100%" style="background: #f9fafb; border: 1px solid #e5e7eb; border-radius: 12px; margin-bottom: 16px; overflow: hidden;">
            <tr>
                <td style="padding: 20px;">
                    <table width="100%">
                        <tr>
                            <td style="vertical-align: top; width: 60%;">
                                <h3 style="margin: 0 0 8px 0; color: #111827; font-size: 16px; font-weight: 700;">
                                    🎟️ ${ticket.name || 'Ticket'} ${tickets.length > 1 ? `#${index + 1}` : ''}
                                </h3>
                                ${ticket.attendeeName ? `<p style="margin: 0 0 4px 0; color: #374151; font-size: 14px;">Attendee: ${ticket.attendeeName}</p>` : ''}
                                <p style="margin: 0; color: #6b7280; font-size: 12px; font-family: monospace;">
                                    ${ticket.id ? ticket.id.substring(0, 8).toUpperCase() : ''}
                                </p>
                            </td>
                            <td style="vertical-align: top; text-align: right; width: 40%;">
                                ${qrCodeBaseUrl ? `
                                <img src="${qrCodeBaseUrl}?data=${encodeURIComponent(ticket.id || '')}" alt="QR Code" style="width: 80px; height: 80px; border-radius: 8px;" />
                                ` : `
                                <div style="width: 80px; height: 80px; background: #e5e7eb; border-radius: 8px; display: inline-block;"></div>
                                `}
                            </td>
                        </tr>
                    </table>
                </td>
            </tr>
        </table>
    `).join('');
};

// ============== EMAIL GENERATORS ==============

/**
 * Purchase Confirmation Email
 */
export const purchaseConfirmation = ({
    attendeeName,
    attendeeEmail,
    eventTitle,
    eventDate,
    eventTime,
    eventLocation,
    tickets,
    totalPaid,
    orderId,
    organizerName,
    eventImageUrl,
    logoUrl,
    currency = 'USD'
}) => {
    const eventDetails = generateEventDetailsBox(eventTitle, eventDate, eventTime, eventLocation);
    
    const ticketsList = (tickets || []).map(t => `
        <tr>
            <td style="padding: 12px; border-bottom: 1px solid #e5e7eb;">
                <span style="font-weight: 600; color: #111827;">🎫 ${t.name || 'Ticket'}</span>
            </td>
            <td style="padding: 12px; border-bottom: 1px solid #e5e7eb; text-align: center; color: #6b7280;">
                × ${t.quantity || 1}
            </td>
            <td style="padding: 12px; border-bottom: 1px solid #e5e7eb; text-align: right; font-weight: 600; color: #111827;">
                $${((t.price || 0) * (t.quantity || 1)).toFixed(2)}
            </td>
        </tr>
    `).join('');

    const content = `
        <p style="color: #111827; font-size: 16px; line-height: 1.6; margin: 0 0 24px 0;">
            Hi <strong>${attendeeName}</strong>,<br><br>
            Your purchase is confirmed! Here are your ticket details:
        </p>
        
        ${eventDetails}
        
        <!-- Tickets Table -->
        <table width="100%" style="border: 1px solid #e5e7eb; border-radius: 12px; overflow: hidden; margin-bottom: 24px;">
            <thead>
                <tr style="background: #f9fafb;">
                    <th style="padding: 12px; text-align: left; font-size: 12px; font-weight: 600; color: #6b7280; text-transform: uppercase;">Ticket</th>
                    <th style="padding: 12px; text-align: center; font-size: 12px; font-weight: 600; color: #6b7280; text-transform: uppercase;">Qty</th>
                    <th style="padding: 12px; text-align: right; font-size: 12px; font-weight: 600; color: #6b7280; text-transform: uppercase;">Price</th>
                </tr>
            </thead>
            <tbody>
                ${ticketsList}
                <tr style="background: #f9fafb;">
                    <td colspan="2" style="padding: 12px; font-weight: 700; color: #111827;">Total Paid</td>
                    <td style="padding: 12px; text-align: right; font-weight: 700; font-size: 18px; color: ${GLOBAL_STYLES.primaryColor};">
                        $${(totalPaid || 0).toFixed(2)}
                    </td>
                </tr>
            </tbody>
        </table>
        
        <p style="color: #6b7280; font-size: 13px; text-align: center; margin: 0;">
            Order ID: <strong style="font-family: monospace;">${orderId}</strong>
        </p>
        
        <!-- Account Reminder -->
        <div style="background-color: #f0fdfa; border: 1px solid #99f6e4; border-radius: 8px; padding: 16px; margin: 24px 0; text-align: center;">
            <p style="color: #0f766e; font-size: 13px; line-height: 1.5; margin: 0;">
                💡 <strong>Tip:</strong> To view your tickets online, make sure to sign up or log in using this email address${attendeeEmail ? ` (<strong>${attendeeEmail}</strong>)` : ''}.
            </p>
        </div>
    `;

    const ticketSection = generateQRCodeSection(tickets, null);

    return {
        subject: `🎟️ Your tickets for ${eventTitle}`,
        html: universalEmailWrapper({
            eventImageUrl,
            logoUrl,
            title: "You're In! 🎉",
            subtitle: 'Your purchase is confirmed',
            content,
            ctaButtons: [
                { label: 'View Your Tickets', url: `${process.env.FRONTEND_URL || 'https://www.openticket.events'}/#/my-tickets`, primary: true }
            ],
            footer: `Organized by ${organizerName} • Powered by OpenTicket`,
            ticketSection
        })
    };
};

/**
 * Presale Signup Confirmation Email
 * Design based on go.seated.com confirmation email
 */
export const presaleSignupConfirmation = ({
    attendeeName,
    eventTitle,
    eventDate,
    eventTime,
    eventLocation,
    presaleDate,
    presaleTime,
    eventImageUrl,
    logoUrl,
    eventUrl,
    timezone = ''
}) => {
    // Format presale date/time for display
    const presaleDateFormatted = presaleDate || 'TBD';
    const presaleTimeFormatted = presaleTime ? `${presaleTime}${timezone ? ` ${timezone}` : ''}` : '';
    
    const content = `
        <!-- Main Message -->
        <p style="color: #111827; font-size: 18px; line-height: 1.6; margin: 0 0 16px 0;">
            Tickets go on sale on <strong>${presaleDateFormatted}</strong>${presaleTimeFormatted ? ` at <strong>${presaleTimeFormatted}</strong>` : ''}.
        </p>
        
        <p style="color: #6b7280; font-size: 16px; line-height: 1.6; margin: 0 0 32px 0;">
            You will receive an email notification with your password at least 15 minutes before tickets go on sale.
        </p>
        
        <!-- Event Details Box - Clean minimal design matching screenshot -->
        <table width="100%" style="border-top: 1px solid #e5e7eb; margin-bottom: 24px;">
            <tr>
                <td style="padding: 20px 0;">
                    <!-- Event Icon + Title with highlight -->
                    <table width="100%" cellspacing="0" cellpadding="0">
                        <tr>
                            <td style="padding: 8px 0;">
                                <table cellspacing="0" cellpadding="0">
                                    <tr>
                                        <td style="width: 28px; vertical-align: middle;">
                                            <span style="font-size: 18px;">🎫</span>
                                        </td>
                                        <td style="vertical-align: middle; padding-left: 8px;">
                                            <span style="color: #111827; font-size: 16px; font-weight: 600;">${eventTitle}</span>
                                        </td>
                                    </tr>
                                </table>
                            </td>
                        </tr>
                        <tr>
                            <td style="padding: 8px 0;">
                                <table cellspacing="0" cellpadding="0">
                                    <tr>
                                        <td style="width: 28px; vertical-align: middle;">
                                            <span style="font-size: 18px;">📅</span>
                                        </td>
                                        <td style="vertical-align: middle; padding-left: 8px;">
                                            <span style="color: #374151; font-size: 15px;">${eventDate}</span>
                                        </td>
                                    </tr>
                                </table>
                            </td>
                        </tr>
                        <tr>
                            <td style="padding: 8px 0;">
                                <table cellspacing="0" cellpadding="0">
                                    <tr>
                                        <td style="width: 28px; vertical-align: middle;">
                                            <span style="font-size: 18px;">📍</span>
                                        </td>
                                        <td style="vertical-align: middle; padding-left: 8px;">
                                            <span style="color: #374151; font-size: 15px;">${eventLocation}</span>
                                        </td>
                                    </tr>
                                </table>
                            </td>
                        </tr>
                    </table>
                </td>
            </tr>
        </table>
        
        <!-- Disclaimer -->
        <p style="color: #9ca3af; font-size: 13px; text-align: left; margin: 0 0 24px 0; font-style: italic;">
            On sale date/time is subject to change.
        </p>
        
        <!-- Questions Section -->
        <table width="100%" style="border-top: 1px solid #e5e7eb;">
            <tr>
                <td style="padding: 20px 0 0 0;">
                    <p style="color: #111827; font-size: 14px; font-weight: 700; margin: 0 0 4px 0;">Have Questions?</p>
                    <a href="${eventUrl || '#'}" style="color: #111827; font-size: 14px; text-decoration: underline;">Click here</a>
                </td>
            </tr>
        </table>
    `;

    return {
        subject: `You're signed up for ${eventTitle}!`,
        html: universalEmailWrapper({
            eventImageUrl,
            logoUrl,
            title: "You're signed up!",
            subtitle: null,
            content,
            ctaButtons: [], // No CTA buttons - matches the screenshot design
            footer: 'Powered by OpenTicket'
        })
    };
};

/**
 * Presale Now Open Email
 * Sent 15 minutes before presale starts to all subscribers
 */
export const presaleNowOpen = ({
    attendeeName,
    eventTitle,
    eventDate,
    eventTime,
    eventLocation,
    eventImageUrl,
    logoUrl,
    eventUrl,
    presaleCode,
    presaleStartTime,
    presaleEndDate,
    presaleEndTime
}) => {
    const content = `
        <p style="color: #111827; font-size: 16px; line-height: 1.6; margin: 0 0 24px 0;">
            Hi <strong>${attendeeName || 'there'}</strong>,<br><br>
            The presale for <strong>${eventTitle}</strong> is about to start! Get ready to grab your tickets.
        </p>
        
        <!-- Presale Start Time Box -->
        <table width="100%" style="background: linear-gradient(135deg, #8b5cf6 0%, #6366f1 100%); border-radius: 12px; margin-bottom: 24px;">
            <tr>
                <td style="padding: 24px; text-align: center;">
                    <p style="color: rgba(255,255,255,0.9); font-size: 14px; margin: 0 0 8px 0; text-transform: uppercase; letter-spacing: 1px;">Presale Starts</p>
                    <h2 style="color: #ffffff; font-size: 28px; font-weight: 800; margin: 0;">${presaleStartTime || 'Soon!'}</h2>
                </td>
            </tr>
        </table>
        
        ${presaleCode ? `
        <!-- Presale Code Box -->
        <table width="100%" style="background: #f0fdf4; border: 2px solid #22c55e; border-radius: 12px; margin-bottom: 24px;">
            <tr>
                <td style="padding: 24px; text-align: center;">
                    <p style="color: #166534; font-size: 12px; font-weight: 600; margin: 0 0 8px 0; text-transform: uppercase; letter-spacing: 1px;">Your Presale Code</p>
                    <p style="color: #15803d; font-size: 28px; font-weight: 900; font-family: monospace; margin: 0; letter-spacing: 2px;">${presaleCode}</p>
                    <p style="color: #166534; font-size: 12px; margin: 8px 0 0 0;">Enter this code when prompted to access presale tickets</p>
                </td>
            </tr>
        </table>
        ` : ''}
        
        <!-- Event Details -->
        <table width="100%" style="background: #f9fafb; border: 1px solid #e5e7eb; border-radius: 12px; margin-bottom: 24px;">
            <tr>
                <td style="padding: 20px;">
                    <h3 style="color: #111827; font-size: 18px; font-weight: 700; margin: 0 0 12px 0;">${eventTitle}</h3>
                    ${eventDate ? `<p style="color: #374151; font-size: 14px; margin: 0 0 6px 0;">📅 ${eventDate}</p>` : ''}
                    ${eventTime ? `<p style="color: #374151; font-size: 14px; margin: 0 0 6px 0;">🕐 ${eventTime}</p>` : ''}
                    ${eventLocation ? `<p style="color: #374151; font-size: 14px; margin: 0;">📍 ${eventLocation}</p>` : ''}
                </td>
            </tr>
        </table>
        
        <p style="color: #6b7280; font-size: 14px; text-align: center; margin: 0;">
            Click the button below to purchase your tickets as soon as presale begins!
        </p>
    `;

    return {
        subject: `🎫 Your Presale Access for ${eventTitle} - Starting Soon!`,
        html: universalEmailWrapper({
            eventImageUrl,
            logoUrl,
            title: 'Presale Starting Soon! 🎉',
            subtitle: 'Your exclusive early access is here',
            content,
            ctaButtons: [
                { label: 'Get Your Tickets', url: eventUrl || '#', primary: true }
            ],
            footer: 'Powered by OpenTicket'
        })
    };
};

/**
 * Event Reminder Email
 */
export const eventReminder = ({
    attendeeName,
    eventTitle,
    eventDate,
    eventTime,
    eventLocation,
    eventImageUrl,
    logoUrl,
    ticketUrl,
    timeUntil // e.g., "24 hours", "1 hour"
}) => {
    const content = `
        <p style="color: #111827; font-size: 16px; line-height: 1.6; margin: 0 0 24px 0;">
            Hi <strong>${attendeeName}</strong>,<br><br>
            Just a friendly reminder that <strong>${eventTitle}</strong> starts in <strong>${timeUntil}</strong>!
        </p>
        
        ${generateEventDetailsBox(eventTitle, eventDate, eventTime, eventLocation)}
        
        <p style="color: #6b7280; font-size: 14px; text-align: center; margin: 0;">
            Make sure to have your ticket ready for check-in. See you there! 🎉
        </p>
    `;

    return {
        subject: `⏰ Reminder: ${eventTitle} starts in ${timeUntil}!`,
        html: universalEmailWrapper({
            eventImageUrl,
            logoUrl,
            title: 'Event Starting Soon! 📅',
            subtitle: `Starts in ${timeUntil}`,
            content,
            ctaButtons: [
                { label: 'View Your Ticket', url: ticketUrl || '#', primary: true }
            ],
            footer: 'Powered by OpenTicket'
        })
    };
};

/**
 * Refund Confirmation Email
 */
export const refundConfirmation = ({
    attendeeName,
    eventTitle,
    refundAmount,
    currency = 'USD',
    eventImageUrl,
    logoUrl
}) => {
    const content = `
        <p style="color: #111827; font-size: 16px; line-height: 1.6; margin: 0 0 24px 0;">
            Hi <strong>${attendeeName}</strong>,<br><br>
            Your refund has been processed. Here are the details:
        </p>
        
        <table width="100%" style="background: #f9fafb; border: 1px solid #e5e7eb; border-radius: 12px; margin-bottom: 24px;">
            <tr>
                <td style="padding: 20px;">
                    <p style="color: #6b7280; font-size: 14px; margin: 0 0 8px 0;">Event</p>
                    <p style="color: #111827; font-size: 16px; font-weight: 600; margin: 0 0 16px 0;">${eventTitle}</p>
                    <p style="color: #6b7280; font-size: 14px; margin: 0 0 8px 0;">Refund Amount</p>
                    <p style="color: #10b981; font-size: 24px; font-weight: 800; margin: 0;">$${(refundAmount || 0).toFixed(2)} ${currency}</p>
                </td>
            </tr>
        </table>
        
        <p style="color: #6b7280; font-size: 14px; text-align: center; margin: 0;">
            The refund will appear on your original payment method within 5-10 business days.
        </p>
    `;

    return {
        subject: `💰 Refund confirmed for ${eventTitle}`,
        html: universalEmailWrapper({
            eventImageUrl,
            logoUrl,
            title: 'Refund Processed',
            subtitle: 'Your refund is on its way',
            content,
            ctaButtons: [],
            footer: 'Powered by OpenTicket'
        })
    };
};

/**
 * Waitlist Notification Email
 */
export const waitlistNotification = ({
    attendeeName,
    eventTitle,
    eventImageUrl,
    logoUrl,
    eventUrl,
    message
}) => {
    const content = `
        <p style="color: #111827; font-size: 16px; line-height: 1.6; margin: 0 0 24px 0;">
            Hi <strong>${attendeeName || 'there'}</strong>,<br><br>
            ${message || `Great news! Tickets are now available for <strong>${eventTitle}</strong>.`}
        </p>
        
        <p style="color: #6b7280; font-size: 14px; text-align: center; margin: 0;">
            Act fast - tickets may sell out quickly!
        </p>
    `;

    return {
        subject: `🎟️ Tickets available for ${eventTitle}!`,
        html: universalEmailWrapper({
            eventImageUrl,
            logoUrl,
            title: 'Tickets Available!',
            subtitle: 'Your waitlist spot is ready',
            content,
            ctaButtons: [
                { label: 'Get Tickets Now', url: eventUrl || '#', primary: true }
            ],
            footer: 'Powered by OpenTicket'
        })
    };
};

/**
 * General Admission Now Open Email
 */
export const generalAdmissionOpen = ({
    attendeeName,
    eventTitle,
    eventDate,
    eventTime,
    eventLocation,
    eventImageUrl,
    logoUrl,
    eventUrl
}) => {
    const content = `
        <p style="color: #111827; font-size: 16px; line-height: 1.6; margin: 0 0 24px 0;">
            Hi <strong>${attendeeName || 'there'}</strong>,<br><br>
            General admission tickets for <strong>${eventTitle}</strong> are now available!
        </p>
        
        ${generateEventDetailsBox(eventTitle, eventDate, eventTime, eventLocation)}
        
        <p style="color: #6b7280; font-size: 14px; text-align: center; margin: 0;">
            Don't miss out - get your tickets today!
        </p>
    `;

    return {
        subject: `🎫 General admission now open for ${eventTitle}!`,
        html: universalEmailWrapper({
            eventImageUrl,
            logoUrl,
            title: 'Tickets On Sale Now!',
            subtitle: 'General admission is open',
            content,
            ctaButtons: [
                { label: 'Buy Tickets', url: eventUrl || '#', primary: true }
            ],
            footer: 'Powered by OpenTicket'
        })
    };
};

/**
 * Abandoned Cart Email
 */
export const abandonedCart = ({
    attendeeName,
    eventTitle,
    eventDate,
    eventLocation,
    eventImageUrl,
    logoUrl,
    checkoutUrl
}) => {
    const content = `
        <p style="color: #111827; font-size: 16px; line-height: 1.6; margin: 0 0 24px 0;">
            Hi <strong>${attendeeName || 'there'}</strong>,<br><br>
            You left some items in your cart! Don't miss out on <strong>${eventTitle}</strong>.
        </p>
        
        ${generateEventDetailsBox(eventTitle, eventDate, '', eventLocation)}
        
        <p style="color: #6b7280; font-size: 14px; text-align: center; margin: 0;">
            Complete your purchase before tickets sell out!
        </p>
    `;

    return {
        subject: `⏰ Don't forget your tickets for ${eventTitle}!`,
        html: universalEmailWrapper({
            eventImageUrl,
            logoUrl,
            title: 'You Left Something Behind!',
            subtitle: 'Complete your purchase',
            content,
            ctaButtons: [
                { label: 'Complete Purchase', url: checkoutUrl || '#', primary: true }
            ],
            footer: 'Powered by OpenTicket'
        })
    };
};

/**
 * Event Reminder - Primary (24 hours before)
 */
export const eventReminderPrimary = ({
    attendeeName,
    eventTitle,
    eventDate,
    eventTime,
    eventLocation,
    eventImageUrl,
    logoUrl,
    ticketUrl
}) => {
    return eventReminder({
        attendeeName,
        eventTitle,
        eventDate,
        eventTime,
        eventLocation,
        eventImageUrl,
        logoUrl,
        ticketUrl,
        timeUntil: '24 hours'
    });
};

/**
 * Event Reminder - Secondary (configurable time, e.g., 1 hour before)
 */
export const eventReminderSecondary = ({
    attendeeName,
    eventTitle,
    eventDate,
    eventTime,
    eventLocation,
    eventImageUrl,
    logoUrl,
    ticketUrl,
    timeUntilEvent
}) => {
    return eventReminder({
        attendeeName,
        eventTitle,
        eventDate,
        eventTime,
        eventLocation,
        eventImageUrl,
        logoUrl,
        ticketUrl,
        timeUntil: timeUntilEvent || '1 hour'
    });
};

/**
 * Post-Event Thank You Email
 */
export const postEventThankYou = ({
    attendeeName,
    eventTitle,
    eventDate,
    organizerName,
    eventImageUrl,
    logoUrl,
    feedbackUrl
}) => {
    const content = `
        <p style="color: #111827; font-size: 16px; line-height: 1.6; margin: 0 0 24px 0;">
            Hi <strong>${attendeeName}</strong>,<br><br>
            Thank you for attending <strong>${eventTitle}</strong>! We hope you had an amazing time.
        </p>
        
        <table width="100%" style="background: #f9fafb; border: 1px solid #e5e7eb; border-radius: 12px; margin-bottom: 24px;">
            <tr>
                <td style="padding: 20px; text-align: center;">
                    <p style="color: #111827; font-size: 18px; font-weight: 700; margin: 0 0 8px 0;">
                        How was your experience?
                    </p>
                    <p style="color: #6b7280; font-size: 14px; margin: 0;">
                        Your feedback helps us improve future events.
                    </p>
                </td>
            </tr>
        </table>
        
        <p style="color: #6b7280; font-size: 14px; text-align: center; margin: 0;">
            See you at the next one! 🎉
        </p>
    `;

    return {
        subject: `Thanks for attending ${eventTitle}! 🎉`,
        html: universalEmailWrapper({
            eventImageUrl,
            logoUrl,
            title: 'Thanks for Coming!',
            subtitle: `We loved having you at ${eventTitle}`,
            content,
            ctaButtons: feedbackUrl ? [
                { label: 'Leave Feedback', url: feedbackUrl, primary: true }
            ] : [],
            footer: `Organized by ${organizerName || 'Event Organizer'} • Powered by OpenTicket`
        })
    };
};

/**
 * Registration Approval Confirmation Email
 */
export const approvalConfirmation = ({
    attendeeName,
    eventTitle,
    eventDate,
    eventTime,
    eventLocation,
    eventImageUrl,
    logoUrl,
    ticketUrl,
    organizerName
}) => {
    const content = `
        <p style="color: #111827; font-size: 16px; line-height: 1.6; margin: 0 0 24px 0;">
            Hi <strong>${attendeeName}</strong>,<br><br>
            Great news! Your registration for <strong>${eventTitle}</strong> has been approved.
        </p>
        
        ${generateEventDetailsBox(eventTitle, eventDate, eventTime, eventLocation)}
        
        <p style="color: #6b7280; font-size: 14px; text-align: center; margin: 0;">
            We can't wait to see you there!
        </p>
    `;

    return {
        subject: `✅ You're approved for ${eventTitle}!`,
        html: universalEmailWrapper({
            eventImageUrl,
            logoUrl,
            title: "You're Approved! 🎉",
            subtitle: 'Your registration has been confirmed',
            content,
            ctaButtons: [
                { label: 'View Your Tickets', url: ticketUrl || '#', primary: true }
            ],
            footer: `Organized by ${organizerName || 'Event Organizer'} • Powered by OpenTicket`
        })
    };
};

export default {
    purchaseConfirmation,
    presaleSignupConfirmation,
    presaleNowOpen,
    eventReminder,
    eventReminderPrimary,
    eventReminderSecondary,
    refundConfirmation,
    waitlistNotification,
    generalAdmissionOpen,
    abandonedCart,
    postEventThankYou,
    approvalConfirmation,
    // Helper for custom emails using unified layout
    universalEmailWrapper
};
