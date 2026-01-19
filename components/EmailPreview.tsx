import React, { useState, useEffect, useCallback } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { StorageService } from '../services/storageService';
import { Event } from '../types';
import { Button, Card } from './UI';
import { ArrowLeft, Mail, DollarSign, Clock, Heart, Target, CheckCircle2, Loader2, Eye } from 'lucide-react';

type EmailType = 'purchase' | 'refund' | 'reminder24h' | 'reminderSecondary' | 'postEvent' | 'abandonedCart';

interface EmailPreviewProps {
    event?: Event;
    embedded?: boolean;
}

export const EmailPreview: React.FC<EmailPreviewProps> = ({ event: propEvent, embedded = false }) => {
    const { id } = useParams<{ id: string }>();
    const navigate = useNavigate();
    const [event, setEvent] = useState<Event | null>(propEvent || null);
    const [selectedType, setSelectedType] = useState<EmailType>('purchase');
    const [previewHtml, setPreviewHtml] = useState<string>('');
    const [isLoading, setIsLoading] = useState(!propEvent);

    const loadEvent = async () => {
        setIsLoading(true);
        try {
            if (id) {
                const e = await StorageService.getEventFull(id);
                if (e) {
                    console.log('EmailPreview: Event loaded:', e.id);
                    setEvent(e);
                }
            }
        } catch (error) {
            console.error('Error loading event:', error);
        } finally {
            setIsLoading(false);
        }
    };

    useEffect(() => {
        console.log('EmailPreview: Initial mount, id:', id, 'propEvent:', !!propEvent);
        if (!propEvent && id) {
            loadEvent();
        } else if (propEvent) {
            console.log('EmailPreview: Using propEvent');
            setEvent(propEvent);
        }
    }, [id, propEvent]);

    useEffect(() => {
        console.log('EmailPreview: Event/selectedType changed, event:', !!event, 'type:', selectedType);
        if (event) {
            console.log('EmailPreview: Generating preview for event:', event.id, 'Type:', selectedType);
            // Use setTimeout to ensure state updates are processed
            setTimeout(() => {
                try {
                    generatePreview();
                    console.log('EmailPreview: Preview generation completed');
                } catch (error) {
                    console.error('EmailPreview: Error generating preview:', error);
                }
            }, 0);
        } else {
            console.log('EmailPreview: No event available for preview');
        }
    }, [event, selectedType]);

    const generatePreview = () => {
        console.log('generatePreview called, event:', event?.id);
        if (!event) {
            console.log('generatePreview: No event, returning');
            return;
        }

        try {
            const ticketDesign = event.ticketDesign || {};
            const theme = getThemeFromDesign(ticketDesign);

            // Sample data for preview
            const sampleData = {
                attendeeName: 'John Doe',
                eventTitle: event.title || 'Sample Event',
                eventDate: event.date || 'TBD',
                eventTime: event.time || 'TBD',
                eventLocation: event.location || 'TBD',
                organizerName: event.organizer || 'Event Organizer',
                totalPaid: event.ticketTiers?.[0]?.price || 50,
                orderId: 'ORD-123456',
                tickets: event.ticketTiers?.slice(0, 2).map(t => ({
                    name: t.name,
                    quantity: 1,
                    price: t.price
                })) || [{ name: 'General Admission', quantity: 1, price: 50 }],
                refundAmount: 50,
                ticketsRefunded: 1,
                refundDate: new Date().toLocaleDateString(),
                refundReason: 'Customer request',
                timeUntilEvent: event.reminderSettings?.secondaryTime === '1h' ? '1 hour' : '2 hours',
                checkoutUrl: `${window.location.origin}/#/event/${event.id}`,
                ticketUrl: `${window.location.origin}/#/ticket/sample`,
                feedbackUrl: event.organizerWebsite || ''
            };

            let html = '';

            console.log('generatePreview: Generating for type:', selectedType);

            try {
                switch (selectedType) {
                    case 'purchase':
                        html = generatePurchaseEmail(sampleData, theme, ticketDesign);
                        break;
                    case 'refund':
                        html = generateRefundEmail(sampleData, theme, ticketDesign);
                        break;
                    case 'reminder24h':
                        html = generateReminderEmail(sampleData, theme, ticketDesign, '24 hours');
                        break;
                    case 'reminderSecondary':
                        html = generateReminderEmail(sampleData, theme, ticketDesign, sampleData.timeUntilEvent);
                        break;
                    case 'postEvent':
                        html = generatePostEventEmail(sampleData, theme, ticketDesign);
                        break;
                    case 'abandonedCart':
                        html = generateAbandonedCartEmail(sampleData);
                        break;
                    default:
                        html = generatePurchaseEmail(sampleData, theme, ticketDesign);
                }
            } catch (emailError) {
                console.error('generatePreview: Error generating email HTML:', emailError);
                // Fallback to simple HTML
                html = `
                    <!DOCTYPE html>
                    <html>
                    <head><meta charset="utf-8"></head>
                    <body style="font-family: Arial, sans-serif; padding: 40px; background: #f5f5f5;">
                        <div style="background: white; padding: 30px; border-radius: 8px; max-width: 600px; margin: 0 auto;">
                            <h1 style="color: #dc2626;">Preview Error</h1>
                            <p>Unable to generate ${selectedType} email preview.</p>
                            <p style="color: #666; font-size: 14px;">Error: ${emailError instanceof Error ? emailError.message : 'Unknown error'}</p>
                        </div>
                    </body>
                    </html>
                `;
            }

            console.log('generatePreview: HTML generated, length:', html.length);
            if (html && html.length > 0) {
                setPreviewHtml(html);
                console.log('generatePreview: previewHtml state updated');
            } else {
                console.error('generatePreview: Generated HTML is empty!');
            }
        } catch (error) {
            console.error('generatePreview: Error occurred:', error);
            // Set error HTML
            const errorHtml = `
                <!DOCTYPE html>
                <html>
                <head><meta charset="utf-8"></head>
                <body style="font-family: Arial, sans-serif; padding: 40px; background: #f5f5f5;">
                    <div style="background: white; padding: 30px; border-radius: 8px; max-width: 600px; margin: 0 auto;">
                        <h1 style="color: #dc2626;">Error</h1>
                        <p>Failed to generate email preview</p>
                        <p style="color: #666; font-size: 14px;">${error instanceof Error ? error.message : 'Unknown error'}</p>
                    </div>
                </body>
                </html>
            `;
            setPreviewHtml(errorHtml);
        }
    };

    // Theme helper (matches backend logic)
    const getThemeFromDesign = (ticketDesign: any) => {
        const TEMPLATE_THEMES: any = {
            modern: { headerGradient: 'linear-gradient(135deg, #10b981 0%, #059669 100%)', accentColor: '#10b981', textColor: '#111827', mutedColor: '#6b7280' },
            classic: { headerGradient: 'linear-gradient(135deg, #1e3a5f 0%, #0f172a 100%)', accentColor: '#1e3a5f', textColor: '#0f172a', mutedColor: '#475569' },
            minimal: { headerGradient: 'linear-gradient(135deg, #18181b 0%, #27272a 100%)', accentColor: '#18181b', textColor: '#18181b', mutedColor: '#71717a' },
            festive: { headerGradient: 'linear-gradient(135deg, #dc2626 0%, #b91c1c 100%)', accentColor: '#dc2626', textColor: '#1f2937', mutedColor: '#6b7280' },
            purple: { headerGradient: 'linear-gradient(135deg, #8b5cf6 0%, #7c3aed 100%)', accentColor: '#8b5cf6', textColor: '#1f2937', mutedColor: '#6b7280' },
            blue: { headerGradient: 'linear-gradient(135deg, #3b82f6 0%, #2563eb 100%)', accentColor: '#3b82f6', textColor: '#1f2937', mutedColor: '#6b7280' },
            orange: { headerGradient: 'linear-gradient(135deg, #f97316 0%, #ea580c 100%)', accentColor: '#f97316', textColor: '#1f2937', mutedColor: '#6b7280' }
        };

        const templateId = ticketDesign.template || 'modern';
        let theme = TEMPLATE_THEMES[templateId] || TEMPLATE_THEMES.modern;

        // Apply custom accent color override
        if (ticketDesign.accentColor) {
            theme = {
                ...theme,
                headerGradient: `linear-gradient(135deg, ${ticketDesign.accentColor} 0%, ${adjustBrightness(ticketDesign.accentColor, -20)} 100%)`,
                accentColor: ticketDesign.accentColor
            };
        }

        return theme;
    };

    const adjustBrightness = (hex: string, percent: number) => {
        hex = hex.replace(/^#/, '');
        let r = parseInt(hex.substring(0, 2), 16);
        let g = parseInt(hex.substring(2, 4), 16);
        let b = parseInt(hex.substring(4, 6), 16);

        r = Math.max(0, Math.min(255, r + (r * percent / 100)));
        g = Math.max(0, Math.min(255, g + (g * percent / 100)));
        b = Math.max(0, Math.min(255, b + (b * percent / 100)));

        return '#' + [r, g, b].map(x => Math.round(x).toString(16).padStart(2, '0')).join('');
    };

    // Email generation functions (simplified versions matching backend templates)
    const baseWrapper = (headerGradient: string, headerTitle: string, headerSubtitle: string, content: string, footer: string, logoUrl?: string, customMessage?: string) => {
        const logoSection = logoUrl ? `
            <tr>
                <td style="padding: 20px 30px 0 30px; text-align: center;">
                    <img src="${logoUrl}" alt="Logo" style="max-width: 150px; max-height: 80px; object-fit: contain;">
                </td>
            </tr>
        ` : '';

        const customMsgSection = customMessage ? `
            <tr>
                <td style="padding: 20px 30px; background-color: #f9fafb; border-top: 1px solid #e5e7eb;">
                    <p style="color: #6b7280; font-size: 14px; font-style: italic; margin: 0; text-align: center;">
                        "${customMessage}"
                    </p>
                </td>
            </tr>
        ` : '';

        return `
<!DOCTYPE html>
<html>
<head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1.0"></head>
<body style="margin: 0; padding: 0; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; background-color: #f5f5f5;">
    <table width="100%" cellpadding="0" cellspacing="0" style="background-color: #f5f5f5; padding: 40px 20px;">
        <tr>
            <td align="center">
                <table width="100%" style="max-width: 600px; background-color: #ffffff; border-radius: 12px; overflow: hidden; box-shadow: 0 4px 6px rgba(0, 0, 0, 0.1);">
                    ${logoSection}
                    <tr>
                        <td style="background: ${headerGradient}; padding: 40px 30px; text-align: center;">
                            <h1 style="color: #ffffff; margin: 0; font-size: 28px; font-weight: 700;">${headerTitle}</h1>
                            ${headerSubtitle ? `<p style="color: rgba(255,255,255,0.9); margin: 10px 0 0 0; font-size: 16px;">${headerSubtitle}</p>` : ''}
                        </td>
                    </tr>
                    <tr>
                        <td style="padding: 40px 30px;">${content}</td>
                    </tr>
                    ${customMsgSection}
                    <tr>
                        <td style="background-color: #f9fafb; padding: 30px; text-align: center; border-top: 1px solid #e5e7eb;">
                            <p style="color: #9ca3af; font-size: 12px; margin: 0;">${footer}</p>
                        </td>
                    </tr>
                </table>
            </td>
        </tr>
    </table>
</body>
</html>`;
    };

    const generatePurchaseEmail = (data: any, theme: any, ticketDesign: any) => {
        const ticketList = data.tickets.map((t: any) => `
            <div style="border: 1px solid #e5e7eb; padding: 16px; margin-bottom: 12px; border-radius: 8px; background: #f9fafb;">
                <h4 style="margin: 0 0 8px 0; color: ${theme.textColor};">🎫 ${t.name}</h4>
                <p style="margin: 0; color: ${theme.mutedColor}; font-size: 14px;">Qty: ${t.quantity} × $${t.price.toFixed(2)}</p>
            </div>
        `).join('');

        const eventBox = `
            <table width="100%" style="background-color: ${adjustBrightness(theme.accentColor, 90)}; border: 1px solid ${adjustBrightness(theme.accentColor, 70)}; border-radius: 8px; margin-bottom: 30px;">
                <tr>
                    <td style="padding: 20px;">
                        <h2 style="color: ${theme.textColor}; font-size: 20px; font-weight: 700; margin: 0 0 15px 0;">${data.eventTitle}</h2>
                        <p style="color: ${theme.mutedColor}; font-size: 14px; margin: 0 0 5px 0;">📅 ${data.eventDate}</p>
                        <p style="color: ${theme.mutedColor}; font-size: 14px; margin: 0 0 5px 0;">🕐 ${data.eventTime}</p>
                        <p style="color: ${theme.mutedColor}; font-size: 14px; margin: 0;">📍 ${data.eventLocation}</p>
                    </td>
                </tr>
            </table>`;

        const content = `
            <p style="color: ${theme.textColor}; font-size: 16px; line-height: 1.6; margin: 0 0 20px 0;">
                Hi <strong>${data.attendeeName}</strong>,
            </p>
            <p style="color: ${theme.textColor}; font-size: 16px; line-height: 1.6; margin: 0 0 30px 0;">
                Your purchase is confirmed! Here are your ticket details:
            </p>
            ${eventBox}
            <h3 style="color: ${theme.textColor}; font-size: 16px; margin: 0 0 15px 0;">Your Tickets</h3>
            ${ticketList}
            <table width="100%" style="background-color: ${adjustBrightness(theme.accentColor, 90)}; border-radius: 8px; margin: 20px 0;">
                <tr>
                    <td style="padding: 15px;">
                        <table width="100%">
                            <tr>
                                <td style="padding: 8px 0; border-bottom: 1px solid #e5e7eb;">
                                    <span style="color: ${theme.mutedColor}; font-size: 14px;">Total Paid</span>
                                </td>
                                <td style="padding: 8px 0; border-bottom: 1px solid #e5e7eb; text-align: right;">
                                    <strong style="color: ${theme.accentColor}; font-size: 18px;">$${data.totalPaid.toFixed(2)}</strong>
                                </td>
                            </tr>
                            <tr>
                                <td style="padding: 8px 0;">
                                    <span style="color: ${theme.mutedColor}; font-size: 14px;">Order ID</span>
                                </td>
                                <td style="padding: 8px 0; text-align: right;">
                                    <strong style="color: ${theme.textColor}; font-family: monospace;">${data.orderId}</strong>
                                </td>
                            </tr>
                        </table>
                    </td>
                </tr>
            </table>
            <p style="color: ${theme.mutedColor}; font-size: 14px; line-height: 1.6; margin: 20px 0 0 0;">
                Save this email for your records. You may need to show it at check-in.
            </p>
        `;

        return baseWrapper(
            theme.headerGradient,
            "You're In! 🎉",
            "Your purchase is confirmed",
            content,
            `Organized by ${data.organizerName} • Powered by OpenTicket`,
            ticketDesign.logoUrl,
            ticketDesign.customMessage
        );
    };

    const generateRefundEmail = (data: any, theme: any, ticketDesign: any) => {
        const content = `
            <p style="color: ${theme.textColor}; font-size: 16px; line-height: 1.6; margin: 0 0 20px 0;">
                Hi <strong>${data.attendeeName}</strong>,
            </p>
            <p style="color: ${theme.textColor}; font-size: 16px; line-height: 1.6; margin: 0 0 30px 0;">
                We've processed a refund for your ticket(s) to <strong>${data.eventTitle}</strong>.
            </p>
            <table width="100%" style="background-color: #fef2f2; border: 1px solid #fecaca; border-radius: 8px; margin-bottom: 30px;">
                <tr>
                    <td style="padding: 20px;">
                        <h3 style="color: #dc2626; font-size: 16px; margin: 0 0 15px 0;">💸 Refund Details</h3>
                        <p style="color: ${theme.textColor}; font-size: 14px; margin: 5px 0;"><strong>Refund Amount:</strong> <span style="color: #dc2626; font-size: 18px; font-weight: bold;">$${data.refundAmount.toFixed(2)}</span></p>
                        <p style="color: ${theme.textColor}; font-size: 14px; margin: 5px 0;"><strong>Order ID:</strong> ${data.orderId}</p>
                        <p style="color: ${theme.textColor}; font-size: 14px; margin: 5px 0;"><strong>Refund Date:</strong> ${data.refundDate}</p>
                    </td>
                </tr>
            </table>
            <p style="color: ${theme.mutedColor}; font-size: 14px; line-height: 1.6; margin: 0;">
                Your refund should appear in your account within 5-10 business days.
            </p>
        `;

        return baseWrapper(
            'linear-gradient(135deg, #dc2626 0%, #b91c1c 100%)',
            "Refund Processed 💸",
            "Your tickets have been refunded",
            content,
            `From ${data.organizerName} • Powered by OpenTicket`,
            ticketDesign.logoUrl
        );
    };

    const generateReminderEmail = (data: any, theme: any, ticketDesign: any, timeLabel: string) => {
        const eventBox = `
            <table width="100%" style="background-color: ${adjustBrightness(theme.accentColor, 90)}; border: 1px solid ${adjustBrightness(theme.accentColor, 70)}; border-radius: 8px; margin-bottom: 30px;">
                <tr>
                    <td style="padding: 20px;">
                        <h2 style="color: ${theme.textColor}; font-size: 20px; font-weight: 700; margin: 0 0 15px 0;">${data.eventTitle}</h2>
                        <p style="color: ${theme.mutedColor}; font-size: 14px; margin: 0 0 5px 0;">📅 ${data.eventDate}</p>
                        <p style="color: ${theme.mutedColor}; font-size: 14px; margin: 0 0 5px 0;">🕐 ${data.eventTime}</p>
                        <p style="color: ${theme.mutedColor}; font-size: 14px; margin: 0;">📍 ${data.eventLocation}</p>
                    </td>
                </tr>
            </table>`;

        const content = `
            <p style="color: ${theme.textColor}; font-size: 16px; line-height: 1.6; margin: 0 0 20px 0;">
                Hi <strong>${data.attendeeName}</strong>,
            </p>
            <p style="color: ${theme.textColor}; font-size: 16px; line-height: 1.6; margin: 0 0 30px 0;">
                Just a friendly reminder that <strong>${data.eventTitle}</strong> starts in <strong>${timeLabel}</strong>! 🎉
            </p>
            ${eventBox}
            <div style="text-align: center; margin: 30px 0;">
                <a href="${data.ticketUrl}" style="display: inline-block; background: ${theme.headerGradient}; color: #ffffff; padding: 16px 32px; border-radius: 8px; text-decoration: none; font-weight: 600; font-size: 16px;">
                    View Your Ticket
                </a>
            </div>
            <p style="color: ${theme.mutedColor}; font-size: 14px; line-height: 1.6; margin: 20px 0 0 0;">
                Make sure to have your ticket ready for check-in. See you there!
            </p>
        `;

        return baseWrapper(
            'linear-gradient(135deg, #3b82f6 0%, #2563eb 100%)',
            `Event Starting Soon! 📅`,
            `Don't forget about your event`,
            content,
            "This is an automated reminder from OpenTicket",
            ticketDesign.logoUrl
        );
    };

    const generatePostEventEmail = (data: any, theme: any, ticketDesign: any) => {
        const content = `
            <p style="color: ${theme.textColor}; font-size: 16px; line-height: 1.6; margin: 0 0 20px 0;">
                Hi <strong>${data.attendeeName}</strong>,
            </p>
            <p style="color: ${theme.textColor}; font-size: 16px; line-height: 1.6; margin: 0 0 30px 0;">
                Thank you for attending <strong>${data.eventTitle}</strong>! We hope you had an amazing experience.
            </p>
            <div style="background-color: ${adjustBrightness(theme.accentColor, 90)}; border: 1px solid ${adjustBrightness(theme.accentColor, 70)}; border-radius: 8px; padding: 20px; margin-bottom: 30px; text-align: center;">
                <p style="color: ${theme.textColor}; font-size: 18px; font-weight: 600; margin: 0 0 10px 0;">🙏 Thank You!</p>
                <p style="color: ${theme.mutedColor}; font-size: 14px; margin: 0;">
                    Your attendance made the event special.
                </p>
            </div>
            ${data.feedbackUrl ? `
            <div style="text-align: center; margin: 30px 0;">
                <p style="color: ${theme.mutedColor}; font-size: 14px; margin: 0 0 15px 0;">
                    Have a moment? We'd love to hear your thoughts.
                </p>
                <a href="${data.feedbackUrl}" style="display: inline-block; background: ${theme.headerGradient}; color: #ffffff; padding: 14px 28px; border-radius: 8px; text-decoration: none; font-weight: 600; font-size: 14px;">
                    Share Feedback
                </a>
            </div>
            ` : ''}
            <p style="color: ${theme.mutedColor}; font-size: 14px; line-height: 1.6; margin: 20px 0 0 0;">
                Stay tuned for more events from ${data.organizerName}!
            </p>
        `;

        return baseWrapper(
            theme.headerGradient,
            "Thanks for Coming! 🙌",
            "We hope you had a great time",
            content,
            `From ${data.organizerName} • Powered by OpenTicket`,
            ticketDesign.logoUrl,
            ticketDesign.customMessage
        );
    };

    const generateAbandonedCartEmail = (data: any) => {
        const content = `
            <p style="color: #111827; font-size: 16px; line-height: 1.6; margin: 0 0 20px 0;">
                Hi ${data.attendeeName},
            </p>
            <p style="color: #111827; font-size: 16px; line-height: 1.6; margin: 0 0 30px 0;">
                You started getting tickets for <strong>${data.eventTitle}</strong> but didn't complete your purchase.
            </p>
            <table width="100%" style="background-color: #fef3c7; border: 1px solid #fcd34d; border-radius: 8px; margin-bottom: 30px;">
                <tr>
                    <td style="padding: 20px;">
                        <h2 style="color: #111827; font-size: 20px; font-weight: 700; margin: 0 0 15px 0;">${data.eventTitle}</h2>
                        <p style="color: #6b7280; font-size: 14px; margin: 0 0 5px 0;">📅 ${data.eventDate}</p>
                        <p style="color: #6b7280; font-size: 14px; margin: 0;">📍 ${data.eventLocation}</p>
                    </td>
                </tr>
            </table>
            <div style="text-align: center; margin: 30px 0;">
                <a href="${data.checkoutUrl}" style="display: inline-block; background: linear-gradient(135deg, #8b5cf6 0%, #7c3aed 100%); color: #ffffff; padding: 16px 32px; border-radius: 8px; text-decoration: none; font-weight: 600; font-size: 16px;">
                    Complete Your Purchase →
                </a>
            </div>
            <p style="color: #6b7280; font-size: 14px; line-height: 1.6; margin: 20px 0 0 0; text-align: center;">
                Tickets are selling fast. Don't miss out!
            </p>
        `;

        return baseWrapper(
            'linear-gradient(135deg, #8b5cf6 0%, #7c3aed 100%)',
            "Complete Your Purchase",
            "Your tickets are waiting",
            content,
            "This is a reminder from OpenTicket"
        );
    };

    const emailTypes = [
        { id: 'purchase' as EmailType, label: 'Purchase Confirmation', icon: CheckCircle2, color: 'green' },
        { id: 'refund' as EmailType, label: 'Refund Confirmation', icon: DollarSign, color: 'red' },
        { id: 'reminder24h' as EmailType, label: 'Event Reminder (24h)', icon: Clock, color: 'blue' },
        { id: 'reminderSecondary' as EmailType, label: 'Secondary Reminder', icon: Clock, color: 'orange' },
        { id: 'postEvent' as EmailType, label: 'Post-Event Thank You', icon: Heart, color: 'purple' },
        { id: 'abandonedCart' as EmailType, label: 'Abandoned Cart', icon: Target, color: 'amber' }
    ];

    if (isLoading) {
        return (
            <div className="min-h-screen flex items-center justify-center">
                <Loader2 className="animate-spin text-primary" size={32} />
            </div>
        );
    }

    const content = (
        <div className={embedded ? '' : 'min-h-screen bg-zinc-50 dark:bg-zinc-950 p-6'}>
            <div className="max-w-7xl mx-auto space-y-6">
                {/* Header */}
                {!embedded && (
                    <div className="flex items-center justify-between">
                        <div className="flex items-center gap-4">
                            <Button
                                variant="ghost"
                                onClick={() => navigate(`/dashboard/events/${id}`)}
                                className="flex items-center gap-2"
                            >
                                <ArrowLeft size={20} />
                                Back
                            </Button>
                            <div>
                                <h1 className="text-3xl font-bold text-gray-900 dark:text-white flex items-center gap-2">
                                    <Eye className="text-primary" />
                                    Email Preview
                                </h1>
                                <p className="text-sm text-zinc-500">Preview how your themed emails will look to attendees</p>
                            </div>
                        </div>
                    </div>
                )}

                {embedded && (
                    <div className="mb-4">
                        <h3 className="text-lg font-bold text-gray-900 dark:text-white mb-2">Email Preview</h3>
                        <p className="text-sm text-zinc-500">See how your emails will look with the current ticket design</p>
                    </div>
                )}

                <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                    {/* Email Type Selector */}
                    <Card className="p-6 h-fit">
                        <h3 className="text-sm font-bold uppercase text-zinc-500 mb-4 flex items-center gap-2">
                            <Mail size={16} />
                            Select Email Type
                        </h3>
                        <div className="space-y-2">
                            {emailTypes.map((type) => {
                                const Icon = type.icon;
                                const isSelected = selectedType === type.id;
                                const colorClasses = {
                                    green: 'bg-green-100 dark:bg-green-900/30 text-green-600 dark:text-green-400 border-green-200 dark:border-green-800',
                                    red: 'bg-red-100 dark:bg-red-900/30 text-red-600 dark:text-red-400 border-red-200 dark:border-red-800',
                                    blue: 'bg-blue-100 dark:bg-blue-900/30 text-blue-600 dark:text-blue-400 border-blue-200 dark:border-blue-800',
                                    orange: 'bg-orange-100 dark:bg-orange-900/30 text-orange-600 dark:text-orange-400 border-orange-200 dark:border-orange-800',
                                    purple: 'bg-purple-100 dark:bg-purple-900/30 text-purple-600 dark:text-purple-400 border-purple-200 dark:border-purple-800',
                                    amber: 'bg-amber-100 dark:bg-amber-900/30 text-amber-600 dark:text-amber-400 border-amber-200 dark:border-amber-800'
                                };

                                return (
                                    <button
                                        key={type.id}
                                        onClick={() => setSelectedType(type.id)}
                                        className={`w-full p-3 rounded-lg border-2 transition-all text-left flex items-center gap-3 ${
                                            isSelected
                                                ? 'border-primary bg-primary/10'
                                                : 'border-zinc-200 dark:border-zinc-700 hover:border-zinc-300 dark:hover:border-zinc-600'
                                        }`}
                                    >
                                        <div className={`w-8 h-8 rounded-lg flex items-center justify-center ${colorClasses[type.color as keyof typeof colorClasses]}`}>
                                            <Icon size={16} />
                                        </div>
                                        <span className="font-semibold text-sm">{type.label}</span>
                                    </button>
                                );
                            })}
                        </div>

                        <div className="mt-6 p-3 bg-blue-50 dark:bg-blue-900/20 rounded-lg border border-blue-200 dark:border-blue-800">
                            <p className="text-xs text-blue-700 dark:text-blue-300">
                                <strong>Note:</strong> Previews use sample data. Actual emails will include real attendee and event information.
                            </p>
                        </div>
                    </Card>

                    {/* Email Preview */}
                    <Card className="p-6 lg:col-span-2">
                        <h3 className="text-sm font-bold uppercase text-zinc-500 mb-4">Live Preview</h3>
                        <div className="bg-zinc-100 dark:bg-zinc-900 rounded-lg p-4 border border-zinc-200 dark:border-zinc-800">
                            {previewHtml ? (
                                <iframe
                                    srcDoc={previewHtml}
                                    sandbox="allow-same-origin"
                                    className="w-full bg-white rounded"
                                    style={{ height: '600px', border: 'none' }}
                                    title="Email Preview"
                                />
                            ) : (
                                <div className="w-full bg-white rounded flex items-center justify-center" style={{ height: '600px' }}>
                                    <div className="text-center">
                                        <Loader2 className="animate-spin text-primary mx-auto mb-4" size={32} />
                                        <p className="text-sm text-zinc-500">Loading preview...</p>
                                    </div>
                                </div>
                            )}
                        </div>
                    </Card>
                </div>
            </div>
        </div>
    );

    return content;
};
