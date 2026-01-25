/**
 * EMAIL TEMPLATES SERVICE
 * Centralized, modern email templates with consistent styling
 * Supports dynamic theming from event's ticketDesign settings
 */

// ============== PREDEFINED TEMPLATES ==============
// These MUST match the templates in EventBuilder.tsx for consistency

const TEMPLATE_THEMES = {
    modern: {
        headerGradient: 'linear-gradient(135deg, #8b5cf6 0%, #6366f1 100%)',
        accentColor: '#8b5cf6',
        bgColor: '#ffffff',
        textColor: '#111827',
        mutedColor: '#6b7280'
    },
    classic: {
        headerGradient: 'linear-gradient(135deg, #27272a 0%, #18181b 100%)',
        accentColor: '#fbbf24',
        bgColor: '#1a1a1a',
        textColor: '#ffffff',
        mutedColor: '#a1a1aa'
    },
    minimal: {
        headerGradient: 'linear-gradient(135deg, #f4f4f5 0%, #e4e4e7 100%)',
        accentColor: '#000000',
        bgColor: '#ffffff',
        textColor: '#000000',
        mutedColor: '#71717a'
    },
    festive: {
        headerGradient: 'linear-gradient(135deg, #ec4899 0%, #f97316 100%)',
        accentColor: '#ec4899',
        bgColor: '#fff5f5',
        textColor: '#111827',
        mutedColor: '#6b7280'
    },
    purple: {
        headerGradient: 'linear-gradient(135deg, #8b5cf6 0%, #7c3aed 100%)',
        accentColor: '#8b5cf6',
        bgColor: '#ffffff',
        textColor: '#1f2937',
        mutedColor: '#6b7280'
    },
    blue: {
        headerGradient: 'linear-gradient(135deg, #3b82f6 0%, #2563eb 100%)',
        accentColor: '#3b82f6',
        bgColor: '#ffffff',
        textColor: '#1f2937',
        mutedColor: '#6b7280'
    },
    orange: {
        headerGradient: 'linear-gradient(135deg, #f97316 0%, #ea580c 100%)',
        accentColor: '#f97316',
        bgColor: '#ffffff',
        textColor: '#1f2937',
        mutedColor: '#6b7280'
    }
};

/**
 * Get theme from ticketDesign settings
 * Falls back to 'modern' if no design specified
 */
const getThemeFromDesign = (ticketDesign) => {
    if (!ticketDesign) return TEMPLATE_THEMES.modern;
    
    // If using a predefined template
    const templateId = ticketDesign.template || 'modern';
    if (TEMPLATE_THEMES[templateId]) {
        const baseTheme = TEMPLATE_THEMES[templateId];
        
        // Allow custom accent color override
        if (ticketDesign.accentColor) {
            return {
                ...baseTheme,
                headerGradient: `linear-gradient(135deg, ${ticketDesign.accentColor} 0%, ${adjustBrightness(ticketDesign.accentColor, -20)} 100%)`,
                accentColor: ticketDesign.accentColor
            };
        }
        return baseTheme;
    }
    
    // Custom template with custom colors
    const accentColor = ticketDesign.accentColor || '#10b981';
    const bgColor = ticketDesign.backgroundColor || '#ffffff';
    const textColor = ticketDesign.textColor || '#111827';
    
    return {
        headerGradient: `linear-gradient(135deg, ${accentColor} 0%, ${adjustBrightness(accentColor, -20)} 100%)`,
        accentColor,
        bgColor,
        textColor,
        mutedColor: adjustBrightness(textColor, 40)
    };
};

/**
 * Adjust color brightness (simple hex color adjustment)
 */
const adjustBrightness = (hex, percent) => {
    // Remove # if present
    hex = hex.replace(/^#/, '');
    
    // Parse hex to RGB
    let r = parseInt(hex.substring(0, 2), 16);
    let g = parseInt(hex.substring(2, 4), 16);
    let b = parseInt(hex.substring(4, 6), 16);
    
    // Adjust brightness
    r = Math.max(0, Math.min(255, r + (r * percent / 100)));
    g = Math.max(0, Math.min(255, g + (g * percent / 100)));
    b = Math.max(0, Math.min(255, b + (b * percent / 100)));
    
    // Convert back to hex
    return '#' + [r, g, b].map(x => Math.round(x).toString(16).padStart(2, '0')).join('');
};

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
 * Supports custom theming from ticketDesign
 */
const baseEmailWrapper = (headerColor, headerTitle, headerSubtitle, content, footerText = 'OpenTicket', options = {}) => {
    const { logoUrl, customMessage, theme } = options;
    const textColor = theme?.textColor || BASE_STYLES.textDark;
    const mutedColor = theme?.mutedColor || BASE_STYLES.textMuted;
    
    // Logo section if provided
    const logoSection = logoUrl ? `
        <tr>
            <td style="padding: 20px 30px 0 30px; text-align: center;">
                <img src="${logoUrl}" alt="Event Logo" style="max-width: 150px; max-height: 80px; object-fit: contain;">
            </td>
        </tr>
    ` : '';
    
    // Custom message section if provided
    const customMessageSection = customMessage ? `
        <tr>
            <td style="padding: 20px 30px; background-color: #f9fafb; border-top: 1px solid ${BASE_STYLES.borderColor};">
                <p style="color: ${mutedColor}; font-size: 14px; font-style: italic; margin: 0; text-align: center;">
                    "${customMessage}"
                </p>
            </td>
        </tr>
    ` : '';
    
    return `
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
                    ${logoSection}
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
                    
                    ${customMessageSection}
                    
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
};

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
 * Supports custom theming from event's ticketDesign
 * 
 * Now includes:
 * - Full cost breakdown (subtotal, fees, taxes, donations)
 * - Currency display
 * - QR code for each ticket
 * - Platform donation line item
 * - Professional ticket design
 */
export const purchaseConfirmation = ({ 
    attendeeName, 
    eventTitle, 
    eventDate, 
    eventTime, 
    eventLocation, 
    tickets, 
    totalPaid, 
    orderId, 
    organizerName, 
    ticketDesign,
    // New fields for full breakdown
    currency = 'USD',
    subtotal = 0,
    serviceFee = 0,
    taxAmount = 0,
    platformDonation = 0,
    discountAmount = 0,
    promoCode = null,
    qrCodeBaseUrl = null
}) => {
    // Get theme from ticketDesign
    const theme = getThemeFromDesign(ticketDesign);
    
    // Currency formatter
    const formatCurrency = (amount, curr = currency) => {
        const symbols = { USD: '$', EUR: '€', GBP: '£', CAD: 'CA$', AUD: 'A$', INR: '₹', JPY: '¥' };
        const symbol = symbols[curr] || curr + ' ';
        return `${symbol}${(amount || 0).toFixed(2)}`;
    };
    
    // Generate Order ID if not provided (use registration ID prefix)
    const displayOrderId = orderId && orderId !== 'N/A' && orderId !== 'NA' 
        ? orderId.toUpperCase() 
        : `ORD-${Date.now().toString(36).toUpperCase()}`;
    
    // Calculate USD totals from stored amounts
    const usdTicketTotal = (tickets || []).reduce((sum, t) => sum + (t.pricePerTicket || t.price || 0), 0);
    const usdSubtotal = subtotal || usdTicketTotal;
    const usdTotal = usdSubtotal + serviceFee + taxAmount + platformDonation - discountAmount;
    
    // Calculate conversion ratio (e.g., if paid in CAD, totalPaid is CAD, usdTotal is USD)
    const conversionRatio = usdTotal > 0 ? totalPaid / usdTotal : 1;
    
    // Helper to convert amounts to charged currency
    const convertAmount = (amount) => Math.round(amount * conversionRatio * 100) / 100;
    
    // Each ticket is UNIQUE - display them individually with QR codes
    const ticketList = (tickets || []).map((t, idx) => {
        const ticketId = t.ticketNumber || t.ticketId || t.id || `TKT-${idx + 1}`;
        const qrCodeUrl = qrCodeBaseUrl 
            ? `${qrCodeBaseUrl}?data=${encodeURIComponent(ticketId)}` 
            : `https://api.qrserver.com/v1/create-qr-code/?size=120x120&data=${encodeURIComponent(ticketId)}`;
        
        // Convert ticket price to charged currency
        const convertedPrice = convertAmount(t.pricePerTicket || t.price || 0);
        
        return `
        <div style="border: 2px solid ${theme.accentColor}; padding: 20px; margin-bottom: 16px; border-radius: 12px; background: linear-gradient(135deg, #ffffff 0%, #f9fafb 100%);">
            <table width="100%" cellpadding="0" cellspacing="0">
                <tr>
                    <td style="vertical-align: top; width: 70%;">
                        <h4 style="margin: 0 0 8px 0; color: ${theme.textColor}; font-size: 18px; font-weight: 700;">
                            🎫 ${t.name || 'Ticket'} ${tickets.length > 1 ? `#${idx + 1}` : ''}
                        </h4>
                        <p style="margin: 0 0 6px 0; color: ${theme.mutedColor}; font-size: 14px;">
                            <strong style="color: ${theme.textColor};">Attendee:</strong> ${t.attendeeName || attendeeName}
                        </p>
                        <p style="margin: 0 0 6px 0; color: ${theme.mutedColor}; font-size: 14px;">
                            <strong style="color: ${theme.textColor};">Price:</strong> ${formatCurrency(convertedPrice)}
                        </p>
                        <p style="margin: 12px 0 0 0; font-family: 'Courier New', monospace; color: ${theme.accentColor}; font-size: 13px; background: ${adjustBrightness(theme.accentColor, 90)}; padding: 8px 12px; border-radius: 6px; display: inline-block;">
                            ${ticketId}
                        </p>
                    </td>
                    <td style="vertical-align: middle; text-align: right; width: 30%;">
                        <img src="${qrCodeUrl}" alt="QR Code" style="width: 100px; height: 100px; border-radius: 8px; border: 1px solid #e5e7eb;" />
                    </td>
                </tr>
            </table>
        </div>
    `}).join('');

    // Event details box with modern design
    const themedEventBox = `
    <table width="100%" style="background: linear-gradient(135deg, ${adjustBrightness(theme.accentColor, 85)} 0%, ${adjustBrightness(theme.accentColor, 95)} 100%); border: 1px solid ${adjustBrightness(theme.accentColor, 70)}; border-radius: 12px; margin-bottom: 30px;">
        <tr>
            <td style="padding: 24px;">
                <h2 style="color: ${theme.textColor}; font-size: 22px; font-weight: 700; margin: 0 0 16px 0;">${eventTitle}</h2>
                <p style="color: ${theme.mutedColor}; font-size: 15px; margin: 0 0 8px 0;">📅 ${eventDate}</p>
                <p style="color: ${theme.mutedColor}; font-size: 15px; margin: 0 0 8px 0;">🕐 ${eventTime}</p>
                <p style="color: ${theme.mutedColor}; font-size: 15px; margin: 0;">📍 ${eventLocation}</p>
            </td>
        </tr>
    </table>`;

    // Build cost breakdown rows - ALL amounts converted to charged currency
    let breakdownRows = '';
    
    // Subtotal (converted to charged currency)
    if (subtotal > 0 || (tickets && tickets.length > 0)) {
        const calcSubtotal = subtotal || tickets.reduce((sum, t) => sum + (t.pricePerTicket || t.price || 0), 0);
        const convertedSubtotal = convertAmount(calcSubtotal);
        breakdownRows += `
        <tr>
            <td style="padding: 10px 0; border-bottom: 1px solid ${BASE_STYLES.borderColor};">
                <span style="color: ${theme.textColor}; font-size: 14px;">Subtotal (${tickets?.length || 1} ticket${tickets?.length !== 1 ? 's' : ''})</span>
            </td>
            <td style="padding: 10px 0; border-bottom: 1px solid ${BASE_STYLES.borderColor}; text-align: right;">
                <span style="color: ${theme.textColor}; font-size: 14px;">${formatCurrency(convertedSubtotal)}</span>
            </td>
        </tr>`;
    }
    
    // Discount (converted to charged currency)
    if (discountAmount > 0) {
        const convertedDiscount = convertAmount(discountAmount);
        breakdownRows += `
        <tr>
            <td style="padding: 10px 0; border-bottom: 1px solid ${BASE_STYLES.borderColor};">
                <span style="color: #10b981; font-size: 14px;">🎟️ Discount${promoCode ? ` (${promoCode})` : ''}</span>
            </td>
            <td style="padding: 10px 0; border-bottom: 1px solid ${BASE_STYLES.borderColor}; text-align: right;">
                <span style="color: #10b981; font-size: 14px;">-${formatCurrency(convertedDiscount)}</span>
            </td>
        </tr>`;
    }
    
    // Service Fee (converted to charged currency)
    if (serviceFee > 0) {
        const convertedServiceFee = convertAmount(serviceFee);
        breakdownRows += `
        <tr>
            <td style="padding: 10px 0; border-bottom: 1px solid ${BASE_STYLES.borderColor};">
                <span style="color: ${theme.mutedColor}; font-size: 14px;">Service Fee</span>
            </td>
            <td style="padding: 10px 0; border-bottom: 1px solid ${BASE_STYLES.borderColor}; text-align: right;">
                <span style="color: ${theme.mutedColor}; font-size: 14px;">${formatCurrency(convertedServiceFee)}</span>
            </td>
        </tr>`;
    }
    
    // Tax (converted to charged currency)
    if (taxAmount > 0) {
        const convertedTax = convertAmount(taxAmount);
        breakdownRows += `
        <tr>
            <td style="padding: 10px 0; border-bottom: 1px solid ${BASE_STYLES.borderColor};">
                <span style="color: ${theme.mutedColor}; font-size: 14px;">Tax</span>
            </td>
            <td style="padding: 10px 0; border-bottom: 1px solid ${BASE_STYLES.borderColor}; text-align: right;">
                <span style="color: ${theme.mutedColor}; font-size: 14px;">${formatCurrency(convertedTax)}</span>
            </td>
        </tr>`;
    }
    
    // Platform Donation (converted to charged currency)
    if (platformDonation > 0) {
        const convertedPlatformDonation = convertAmount(platformDonation);
        breakdownRows += `
        <tr>
            <td style="padding: 10px 0; border-bottom: 1px solid ${BASE_STYLES.borderColor};">
                <span style="color: #3b82f6; font-size: 14px;">💙 Platform Support</span>
            </td>
            <td style="padding: 10px 0; border-bottom: 1px solid ${BASE_STYLES.borderColor}; text-align: right;">
                <span style="color: #3b82f6; font-size: 14px;">${formatCurrency(convertedPlatformDonation)}</span>
            </td>
        </tr>`;
    }

    const content = `
        <p style="color: ${theme.textColor}; font-size: 16px; line-height: 1.6; margin: 0 0 20px 0;">
            Hi <strong>${attendeeName}</strong>,
        </p>
        <p style="color: ${theme.textColor}; font-size: 16px; line-height: 1.6; margin: 0 0 30px 0;">
            Your purchase is confirmed! Here are your ticket details:
        </p>
        
        ${themedEventBox}
        
        <h3 style="color: ${theme.textColor}; font-size: 18px; font-weight: 700; margin: 0 0 20px 0; padding-bottom: 10px; border-bottom: 2px solid ${theme.accentColor};">Your Tickets</h3>
        ${ticketList || '<p style="color: ' + theme.mutedColor + ';">1x General Admission</p>'}
        
        <!-- Order Summary -->
        <table width="100%" style="background: linear-gradient(135deg, #f9fafb 0%, #ffffff 100%); border: 1px solid ${BASE_STYLES.borderColor}; border-radius: 12px; margin: 30px 0;">
            <tr>
                <td style="padding: 20px;">
                    <h4 style="margin: 0 0 16px 0; color: ${theme.textColor}; font-size: 16px; font-weight: 700;">Order Summary</h4>
                    <table width="100%">
                        ${breakdownRows}
                        <!-- Total -->
                        <tr>
                            <td style="padding: 16px 0 8px 0;">
                                <strong style="color: ${theme.textColor}; font-size: 18px;">Total Paid</strong>
                            </td>
                            <td style="padding: 16px 0 8px 0; text-align: right;">
                                <strong style="color: ${theme.accentColor}; font-size: 22px;">${formatCurrency(totalPaid)}</strong>
                            </td>
                        </tr>
                        <!-- Currency Note -->
                        <tr>
                            <td colspan="2" style="padding: 4px 0;">
                                <span style="color: ${theme.mutedColor}; font-size: 12px;">Charged in ${currency}</span>
                            </td>
                        </tr>
                    </table>
                </td>
            </tr>
        </table>
        
        <!-- Order ID Box -->
        <table width="100%" style="background: ${theme.accentColor}; border-radius: 12px; margin: 20px 0;">
            <tr>
                <td style="padding: 20px; text-align: center;">
                    <p style="margin: 0 0 8px 0; color: rgba(255,255,255,0.8); font-size: 12px; text-transform: uppercase; letter-spacing: 1px;">Order ID</p>
                    <p style="margin: 0; color: #ffffff; font-family: 'Courier New', monospace; font-size: 20px; font-weight: 700; letter-spacing: 2px;">${displayOrderId}</p>
                </td>
            </tr>
        </table>
        
        <p style="color: ${theme.mutedColor}; font-size: 14px; line-height: 1.6; margin: 20px 0; text-align: center;">
            📱 Save this email for check-in. Show your QR code at the event.
        </p>
    `;

    return {
        subject: `Your Tickets for ${eventTitle}`,
        html: baseEmailWrapper(
            theme.headerGradient,
            "Purchase Confirmed",
            "Your tickets are ready",
            content,
            `Organized by ${organizerName || 'Event Organizer'} • Powered by OpenTicket`,
            { 
                logoUrl: ticketDesign?.logoUrl, 
                customMessage: ticketDesign?.customMessage,
                theme 
            }
        )
    };
};

/**
 * REFUND CONFIRMATION
 * Triggered by: refund.succeeded (Stripe webhook)
 */
export const refundConfirmation = ({ attendeeName, eventTitle, eventDate, eventLocation, refundAmount, ticketsRefunded, orderId, refundReason, refundDate, ticketDesign, organizerName }) => {
    // Get theme (uses red tint for refund emails regardless of event theme)
    const theme = getThemeFromDesign(ticketDesign);
    
    const content = `
        <p style="color: ${theme.textColor}; font-size: 16px; line-height: 1.6; margin: 0 0 20px 0;">
            Hi <strong>${attendeeName}</strong>,
        </p>
        <p style="color: ${theme.textColor}; font-size: 16px; line-height: 1.6; margin: 0 0 30px 0;">
            We've processed a refund for your ticket(s) to <strong>${eventTitle}</strong>.
        </p>
        
        <!-- Refund Details -->
        <table width="100%" style="background-color: #fef2f2; border: 1px solid #fecaca; border-radius: 8px; margin-bottom: 30px;">
            <tr>
                <td style="padding: 20px;">
                    <h3 style="color: ${BASE_STYLES.primaryRed}; font-size: 16px; margin: 0 0 15px 0;">💸 Refund Details</h3>
                    <table width="100%">
                        ${infoRow('Refund Amount', `<span style="color: ${BASE_STYLES.primaryRed}; font-size: 18px; font-weight: bold;">$${(refundAmount || 0).toFixed(2)}</span>`)}
                        ${infoRow('Tickets Refunded', ticketsRefunded || 1)}
                        ${infoRow('Order ID', `<span style="font-family: monospace;">${orderId}</span>`)}
                        ${infoRow('Refund Date', refundDate, false)}
                    </table>
                </td>
            </tr>
        </table>
        
        ${refundReason ? `
        <div style="background-color: #f9fafb; border-radius: 8px; padding: 15px; margin-bottom: 30px;">
            <p style="color: ${theme.mutedColor}; font-size: 12px; text-transform: uppercase; margin: 0 0 5px 0;">Reason</p>
            <p style="color: ${theme.textColor}; font-size: 14px; margin: 0;">${refundReason}</p>
        </div>
        ` : ''}
        
        <div style="background-color: ${adjustBrightness(theme.accentColor, 90)}; border: 1px solid ${adjustBrightness(theme.accentColor, 70)}; border-radius: 8px; padding: 15px; margin-bottom: 20px;">
            <p style="color: ${theme.mutedColor}; font-size: 12px; text-transform: uppercase; margin: 0 0 5px 0;">Original Event</p>
            <p style="color: ${theme.textColor}; font-size: 16px; font-weight: 600; margin: 0 0 5px 0;">${eventTitle}</p>
            <p style="color: ${theme.mutedColor}; font-size: 14px; margin: 0;">📅 ${eventDate} • 📍 ${eventLocation}</p>
        </div>
        
        <p style="color: ${theme.mutedColor}; font-size: 14px; line-height: 1.6; margin: 0;">
            Your refund should appear in your account within 5-10 business days, depending on your payment provider.
        </p>
    `;

    return {
        subject: `💸 Refund Confirmation - ${eventTitle}`,
        html: baseEmailWrapper(
            `linear-gradient(135deg, ${BASE_STYLES.primaryRed} 0%, #b91c1c 100%)`,
            "Refund Processed 💸",
            "Your tickets have been refunded",
            content,
            `From ${organizerName || 'Event Organizer'} • Powered by OpenTicket`,
            { logoUrl: ticketDesign?.logoUrl, theme }
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
/**
 * EVENT REMINDER (Primary - 24 hours)
 * Triggered by: cron job (24h before event)
 * Supports custom theming from event's ticketDesign
 */
export const eventReminderPrimary = ({ attendeeName, eventTitle, eventDate, eventTime, eventLocation, ticketUrl, ticketDesign }) => {
    const theme = getThemeFromDesign(ticketDesign);
    
    const themedEventBox = `
    <table width="100%" style="background-color: ${adjustBrightness(theme.accentColor, 90)}; border: 1px solid ${adjustBrightness(theme.accentColor, 70)}; border-radius: 8px; margin-bottom: 30px;">
        <tr>
            <td style="padding: 20px;">
                <h2 style="color: ${theme.textColor}; font-size: 20px; font-weight: 700; margin: 0 0 15px 0;">${eventTitle}</h2>
                <p style="color: ${theme.mutedColor}; font-size: 14px; margin: 0 0 5px 0;">📅 ${eventDate}</p>
                <p style="color: ${theme.mutedColor}; font-size: 14px; margin: 0 0 5px 0;">🕐 ${eventTime}</p>
                <p style="color: ${theme.mutedColor}; font-size: 14px; margin: 0;">📍 ${eventLocation}</p>
            </td>
        </tr>
    </table>`;
    
    const content = `
        <p style="color: ${theme.textColor}; font-size: 16px; line-height: 1.6; margin: 0 0 20px 0;">
            Hi <strong>${attendeeName}</strong>,
        </p>
        <p style="color: ${theme.textColor}; font-size: 16px; line-height: 1.6; margin: 0 0 30px 0;">
            Just a friendly reminder that <strong>${eventTitle}</strong> is <strong>tomorrow</strong>! 🎉
        </p>
        
        ${themedEventBox}
        
        <div style="text-align: center; margin: 30px 0;">
            <a href="${ticketUrl}" style="display: inline-block; background: ${theme.headerGradient}; color: #ffffff; padding: 16px 32px; border-radius: 8px; text-decoration: none; font-weight: 600; font-size: 16px;">
                View Your Ticket
            </a>
        </div>
        
        <p style="color: ${theme.mutedColor}; font-size: 14px; line-height: 1.6; margin: 20px 0 0 0;">
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
            "This is an automated reminder from OpenTicket",
            { logoUrl: ticketDesign?.logoUrl, theme }
        )
    };
};

/**
 * EVENT REMINDER (Secondary - configurable time)
 * Triggered by: cron job (organizer-configured time)
 * Supports custom theming from event's ticketDesign
 */
export const eventReminderSecondary = ({ attendeeName, eventTitle, eventDate, eventTime, eventLocation, ticketUrl, timeUntilEvent, ticketDesign }) => {
    const theme = getThemeFromDesign(ticketDesign);
    
    const themedEventBox = `
    <table width="100%" style="background-color: ${adjustBrightness(theme.accentColor, 90)}; border: 1px solid ${adjustBrightness(theme.accentColor, 70)}; border-radius: 8px; margin-bottom: 30px;">
        <tr>
            <td style="padding: 20px;">
                <h2 style="color: ${theme.textColor}; font-size: 20px; font-weight: 700; margin: 0 0 15px 0;">${eventTitle}</h2>
                <p style="color: ${theme.mutedColor}; font-size: 14px; margin: 0 0 5px 0;">📅 ${eventDate}</p>
                <p style="color: ${theme.mutedColor}; font-size: 14px; margin: 0 0 5px 0;">🕐 ${eventTime}</p>
                <p style="color: ${theme.mutedColor}; font-size: 14px; margin: 0;">📍 ${eventLocation}</p>
            </td>
        </tr>
    </table>`;
    
    const content = `
        <p style="color: ${theme.textColor}; font-size: 16px; line-height: 1.6; margin: 0 0 20px 0;">
            Hi <strong>${attendeeName}</strong>,
        </p>
        <p style="color: ${theme.textColor}; font-size: 16px; line-height: 1.6; margin: 0 0 30px 0;">
            <strong>${eventTitle}</strong> starts in <strong>${timeUntilEvent}</strong>! Get ready! 🎉
        </p>
        
        ${themedEventBox}
        
        <div style="text-align: center; margin: 30px 0;">
            <a href="${ticketUrl}" style="display: inline-block; background: ${theme.headerGradient}; color: #ffffff; padding: 16px 32px; border-radius: 8px; text-decoration: none; font-weight: 600; font-size: 16px;">
                View Your Ticket
            </a>
        </div>
        
        <p style="color: ${theme.mutedColor}; font-size: 14px; line-height: 1.6; margin: 20px 0 0 0;">
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
            "This is an automated reminder from OpenTicket",
            { logoUrl: ticketDesign?.logoUrl, theme }
        )
    };
};

/**
 * POST-EVENT THANK YOU
 * Triggered by: cron job (morning after event ends)
 * Supports custom theming from event's ticketDesign
 */
export const postEventThankYou = ({ attendeeName, eventTitle, eventDate, organizerName, feedbackUrl, ticketDesign }) => {
    const theme = getThemeFromDesign(ticketDesign);
    
    const content = `
        <p style="color: ${theme.textColor}; font-size: 16px; line-height: 1.6; margin: 0 0 20px 0;">
            Hi <strong>${attendeeName}</strong>,
        </p>
        <p style="color: ${theme.textColor}; font-size: 16px; line-height: 1.6; margin: 0 0 30px 0;">
            Thank you for attending <strong>${eventTitle}</strong>! We hope you had an amazing experience.
        </p>
        
        <div style="background-color: ${adjustBrightness(theme.accentColor, 90)}; border: 1px solid ${adjustBrightness(theme.accentColor, 70)}; border-radius: 8px; padding: 20px; margin-bottom: 30px; text-align: center;">
            <p style="color: ${theme.textColor}; font-size: 18px; font-weight: 600; margin: 0 0 10px 0;">🙏 Thank You!</p>
            <p style="color: ${theme.mutedColor}; font-size: 14px; margin: 0;">
                Your attendance made the event special.
            </p>
        </div>
        
        ${feedbackUrl ? `
        <div style="text-align: center; margin: 30px 0;">
            <p style="color: ${theme.mutedColor}; font-size: 14px; margin: 0 0 15px 0;">
                Have a moment? We'd love to hear your thoughts.
            </p>
            <a href="${feedbackUrl}" style="display: inline-block; background: ${theme.headerGradient}; color: #ffffff; padding: 14px 28px; border-radius: 8px; text-decoration: none; font-weight: 600; font-size: 14px;">
                Share Feedback
            </a>
        </div>
        ` : ''}
        
        <p style="color: ${theme.mutedColor}; font-size: 14px; line-height: 1.6; margin: 20px 0 0 0;">
            Stay tuned for more events from ${organizerName || 'this organizer'}!
        </p>
    `;

    return {
        subject: `Thank you for attending ${eventTitle}! 🎉`,
        html: baseEmailWrapper(
            theme.headerGradient,
            "Thanks for Coming! 🙌",
            "We hope you had a great time",
            content,
            `From ${organizerName || 'Event Organizer'} • Powered by OpenTicket`,
            { logoUrl: ticketDesign?.logoUrl, theme }
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
