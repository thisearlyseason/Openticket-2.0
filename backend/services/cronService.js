import cron from 'node-cron';
import supabase from './supabase.js';
import { EmailService } from './serverEmail.js';
import PushService from './pushService.js';
import { createRequire } from 'module';

const require = createRequire(import.meta.url);
const Stripe = require('stripe');
const stripe = new Stripe(process.env.STRIPE_SECRET_KEY || '', { apiVersion: '2023-10-16' });

/**
 * Cron Service - Handles scheduled tasks for OpenTicket
 * 
 * Scheduled Jobs:
 * - Event Reminders: 24h before (primary), configurable secondary
 * - Abandoned Cart: Unpaid registrations > 24h old
 * - Post-Event Follow-up: Morning after event ends
 * - Weekly Affiliate Summary: Mondays 9 AM UTC
 * - Scheduled Affiliate Payouts: Daily at midnight UTC
 */

// Track if cron jobs are already initialized
let cronInitialized = false;

// ==================== EMAIL AUTOMATION HELPERS ====================

/**
 * Get organizer's preferred email provider settings
 */
const getOrganizerEmailSettings = async (organizerId) => {
    try {
        const { data } = await supabase
            .from('profiles')
            .select('email, name, subscription')
            .eq('id', organizerId)
            .single();
        
        const settings = data?.subscription?.settings || {};
        return {
            provider: settings.emailProvider || 'resend',
            gmailConfig: settings.gmail_config || null,
            organizerEmail: data?.email,
            organizerName: data?.name
        };
    } catch (e) {
        console.error('[CRON] Error fetching organizer settings:', e);
        return { provider: 'resend' };
    }
};

/**
 * Send email using Resend (platform email service)
 */
const sendEmailWithProvider = async (to, subject, htmlContent, organizerId) => {
    try {
        // Import resend service
        const resendService = (await import('./resendService.js')).default;
        
        if (!resendService.isResendConfigured()) {
            console.log(`[CRON] Email simulated to: ${to}, Subject: ${subject}`);
            return { sent: false, simulated: true };
        }
        
        const result = await resendService.sendEmail({
            to,
            subject,
            html: htmlContent
        });
        
        if (result.success) {
            console.log(`[CRON] ✅ Email sent via Resend: ${result.messageId} to ${to}`);
            return { sent: true, messageId: result.messageId };
        } else {
            console.error(`[CRON] ❌ Email failed to ${to}:`, result.error);
            return { sent: false, error: result.error };
        }
    } catch (error) {
        console.error(`[CRON] ❌ Email exception for ${to}:`, error.message);
        return { sent: false, error: error.message };
    }
};

// ==================== EVENT REMINDER EMAILS ====================

/**
 * Send event reminder emails (24h before - PRIMARY reminder)
 * Runs every hour to check for events starting in ~24h
 */
const sendEventReminders = async () => {
    console.log('[CRON] Starting event reminder job (primary - 24h before)...');
    
    try {
        const { eventReminderPrimary } = await import('./emailTemplates.js');
        const emailAudit = await import('./emailAuditService.js');
        
        // Find events starting in 23-25 hours (to catch within the hourly window)
        const now = new Date();
        const in23Hours = new Date(now.getTime() + 23 * 60 * 60 * 1000);
        const in25Hours = new Date(now.getTime() + 25 * 60 * 60 * 1000);
        
        const { data: upcomingEvents, error: eventsError } = await supabase
            .from('events')
            .select('id, title, date, time, location, owner_id, email_settings, ticket_design')
            .gte('date', in23Hours.toISOString().split('T')[0])
            .lte('date', in25Hours.toISOString().split('T')[0])
            .eq('is_draft', false)
            .eq('visibility', 'public');
        
        if (eventsError) {
            console.error('[CRON] Error fetching upcoming events:', eventsError);
            return;
        }
        
        if (!upcomingEvents?.length) {
            console.log('[CRON] No events in 24h window');
            return;
        }
        
        let sent = 0, failed = 0, skipped = 0;
        
        for (const event of upcomingEvents) {
            // Check if reminder emails are enabled for this event
            const emailSettings = event.email_settings || {};
            if (emailSettings.reminderEnabled === false) {
                console.log(`[CRON] Reminder emails disabled for: ${event.title}`);
                continue;
            }
            
            // Get registrations for this event - only non-refunded
            const { data: registrations } = await supabase
                .from('registrations')
                .select('attendee_email, attendee_name, id')
                .eq('event_id', event.id)
                .not('payment_status', 'eq', 'refunded');
            
            if (!registrations?.length) continue;
            
            const eventDate = new Date(event.date);
            const formattedDate = eventDate.toLocaleDateString('en-US', {
                weekday: 'long', year: 'numeric', month: 'long', day: 'numeric'
            });
            const formattedTime = event.time || 'TBA';
            
            console.log(`[CRON] Processing ${registrations.length} reminder(s) for event: ${event.title}`);
            
            // Process registrations in batches to avoid rate limits
            const BATCH_SIZE = 5;
            const DELAY_BETWEEN_BATCHES = 3000; // 3 seconds
            
            for (let i = 0; i < registrations.length; i += BATCH_SIZE) {
                const batch = registrations.slice(i, i + BATCH_SIZE);
                const batchNumber = Math.floor(i / BATCH_SIZE) + 1;
                const totalBatches = Math.ceil(registrations.length / BATCH_SIZE);
                
                console.log(`[CRON]   Batch ${batchNumber}/${totalBatches} (${batch.length} emails)`);
                
                const promises = batch.map(async (reg) => {
                    try {
                        // Check for duplicates
                        const alreadySent = await emailAudit.wasEmailSent(
                            emailAudit.TRIGGER_TYPES.CRON_REMINDER_PRIMARY,
                            emailAudit.EMAIL_TYPES.EVENT_REMINDER_PRIMARY,
                            reg.id
                        );
                        
                        if (alreadySent) {
                            skipped++;
                            return { success: false, reason: 'already_sent' };
                        }
                        
                        const ticketUrl = `${process.env.FRONTEND_URL || 'https://openticket.events'}/#/ticket/${reg.id}`;
                        
                        const { subject, html } = eventReminderPrimary({
                            attendeeName: reg.attendee_name || 'there',
                            eventTitle: event.title,
                            eventDate: formattedDate,
                            eventTime: formattedTime,
                            eventLocation: event.location || 'TBA',
                            ticketUrl,
                            ticketDesign: event.ticket_design  // Pass event's visual design
                        });
                        
                        const result = await sendEmailWithProvider(
                            reg.attendee_email,
                            subject,
                            html,
                            event.owner_id
                        );
                        
                        // Log to audit
                        await emailAudit.logEmailSend({
                            triggerType: emailAudit.TRIGGER_TYPES.CRON_REMINDER_PRIMARY,
                            emailType: emailAudit.EMAIL_TYPES.EVENT_REMINDER_PRIMARY,
                            recipient: reg.attendee_email,
                            registrationId: reg.id,
                            eventId: event.id,
                            success: result.sent || result.simulated,
                            messageId: result.messageId,
                            error: result.error
                        });
                        
                        if (result.sent || result.simulated) {
                            emailAudit.markEmailSent(
                                emailAudit.TRIGGER_TYPES.CRON_REMINDER_PRIMARY,
                                emailAudit.EMAIL_TYPES.EVENT_REMINDER_PRIMARY,
                                reg.id
                            );
                            // Also send push notification if subscribed
                            try {
                                const { data: user } = await supabase
                                    .from('profiles')
                                    .select('id')
                                    .eq('email', reg.attendee_email.toLowerCase())
                                    .single();
                                
                                if (user?.id) {
                                    await PushService.sendNotification(user.id, 
                                        PushService.NotificationTemplates.eventReminder(event.title, formattedDate, event.id)
                                    );
                                }
                            } catch (pushErr) {
                                // Push is optional, don't fail on error
                            }
                            return { success: true, email: reg.attendee_email };
                        } else {
                            return { success: false, email: reg.attendee_email, error: result.error };
                        }
                    } catch (e) {
                        console.error(`[CRON] Reminder failed for ${reg.attendee_email}:`, e.message);
                        return { success: false, email: reg.attendee_email, error: e.message };
                    }
                });
                
                const results = await Promise.all(promises);
                
                // Count successes and failures
                results.forEach(result => {
                    if (result.success) {
                        sent++;
                        console.log(`[CRON]   ✓ ${result.email}`);
                    } else {
                        failed++;
                        console.warn(`[CRON]   ✗ ${result.email}: ${result.error || 'failed'}`);
                    }
                });
                
                // Add delay between batches
                if (i + BATCH_SIZE < registrations.length) {
                    await new Promise(resolve => setTimeout(resolve, DELAY_BETWEEN_BATCHES));
                }
            }
        }
        
        console.log(`[CRON] Event reminders (primary) complete: ${sent} sent, ${failed} failed, ${skipped} skipped`);
    } catch (error) {
        console.error('[CRON] Event reminder job failed:', error);
    }
};

/**
 * Send secondary event reminder emails (configurable time before)
 * Runs every 15 minutes to check for events starting soon
 * Only sends if organizer has enabled secondary reminders
 */
const sendSecondaryEventReminders = async () => {
    console.log('[CRON] Starting event reminder job (secondary - configurable time)...');
    
    try {
        const { eventReminderSecondary } = await import('./emailTemplates.js');
        const emailAudit = await import('./emailAuditService.js');
        
        const now = new Date();
        
        // Get all events with secondary reminders enabled happening within the next week
        const oneWeekFromNow = new Date(now.getTime() + 7 * 24 * 60 * 60 * 1000);
        
        const { data: upcomingEvents, error: eventsError } = await supabase
            .from('events')
            .select('id, title, date, time, location, owner_id, email_settings, ticket_design')
            .gte('date', now.toISOString().split('T')[0])
            .lte('date', oneWeekFromNow.toISOString().split('T')[0])
            .eq('is_draft', false);
        
        if (eventsError) {
            console.error('[CRON] Error fetching upcoming events:', eventsError);
            return;
        }
        
        if (!upcomingEvents?.length) {
            console.log('[CRON] No upcoming events for secondary reminders');
            return;
        }
        
        let sent = 0, failed = 0, skipped = 0;
        
        // Time offset mapping (in milliseconds)
        const timeOffsets = {
            '1h': 60 * 60 * 1000,
            '2h': 2 * 60 * 60 * 1000,
            '3h': 3 * 60 * 60 * 1000,
            '6h': 6 * 60 * 60 * 1000,
            '12h': 12 * 60 * 60 * 1000,
            '48h': 48 * 60 * 60 * 1000,
            '72h': 72 * 60 * 60 * 1000,
            '168h': 168 * 60 * 60 * 1000,
        };
        
        for (const event of upcomingEvents) {
            // Check if secondary reminders are enabled for this event
            const reminderSettings = event.reminder_settings || {};
            if (!reminderSettings.secondaryEnabled) {
                continue;
            }
            
            // Get the configured time offset (default to 1h)
            const timeKey = reminderSettings.secondaryTime || '1h';
            const offsetMs = timeOffsets[timeKey] || timeOffsets['1h'];
            
            // Parse event datetime
            if (!event.time || !event.date) continue;
            const eventDateTime = new Date(`${event.date}T${convertTo24Hour(event.time)}:00`);
            
            // Calculate when the reminder should be sent
            const reminderTime = new Date(eventDateTime.getTime() - offsetMs);
            
            // Check if we're within the 15-minute window for this reminder
            const windowStart = new Date(reminderTime.getTime() - 7.5 * 60 * 1000);
            const windowEnd = new Date(reminderTime.getTime() + 7.5 * 60 * 1000);
            
            if (now < windowStart || now > windowEnd) {
                continue; // Not in the reminder window
            }
            
            console.log(`[CRON] Processing secondary reminder for: ${event.title} (${timeKey} before)`);
            
            // Get registrations - only non-refunded
            const { data: registrations } = await supabase
                .from('registrations')
                .select('attendee_email, attendee_name, id')
                .eq('event_id', event.id)
                .not('payment_status', 'eq', 'refunded');
            
            if (!registrations?.length) continue;
            
            const formattedDate = new Date(event.date).toLocaleDateString('en-US', {
                weekday: 'long', year: 'numeric', month: 'long', day: 'numeric'
            });
            
            // Human-readable time labels
            const timeLabels = {
                '1h': '1 hour',
                '2h': '2 hours',
                '3h': '3 hours',
                '6h': '6 hours',
                '12h': '12 hours',
                '48h': '2 days',
                '72h': '3 days',
                '168h': '1 week',
            };
            const timeUntilEvent = timeLabels[timeKey] || '1 hour';
            
            console.log(`[CRON] Processing ${registrations.length} secondary reminder(s) for: ${event.title}`);
            
            for (const reg of registrations) {
                try {
                    // Check for duplicates
                    const alreadySent = await emailAudit.wasEmailSent(
                        emailAudit.TRIGGER_TYPES.CRON_REMINDER_SECONDARY,
                        emailAudit.EMAIL_TYPES.EVENT_REMINDER_SECONDARY,
                        reg.id
                    );
                    
                    if (alreadySent) {
                        skipped++;
                        continue;
                    }
                    
                    const ticketUrl = `${process.env.FRONTEND_URL || 'https://openticket.events'}/#/ticket/${reg.id}`;
                    
                    const { subject, html } = eventReminderSecondary({
                        attendeeName: reg.attendee_name || 'there',
                        eventTitle: event.title,
                        eventDate: formattedDate,
                        eventTime: event.time,
                        eventLocation: event.location || 'TBA',
                        ticketUrl,
                        timeUntilEvent,
                        ticketDesign: event.ticket_design  // Pass event's visual design
                    });
                    
                    const result = await sendEmailWithProvider(
                        reg.attendee_email,
                        subject,
                        html,
                        event.owner_id
                    );
                    
                    // Log to audit
                    await emailAudit.logEmailSend({
                        triggerType: emailAudit.TRIGGER_TYPES.CRON_REMINDER_SECONDARY,
                        emailType: emailAudit.EMAIL_TYPES.EVENT_REMINDER_SECONDARY,
                        recipient: reg.attendee_email,
                        registrationId: reg.id,
                        eventId: event.id,
                        success: result.sent || result.simulated,
                        messageId: result.messageId,
                        error: result.error
                    });
                    
                    if (result.sent || result.simulated) {
                        emailAudit.markEmailSent(
                            emailAudit.TRIGGER_TYPES.CRON_REMINDER_SECONDARY,
                            emailAudit.EMAIL_TYPES.EVENT_REMINDER_SECONDARY,
                            reg.id
                        );
                        sent++;
                    } else {
                        failed++;
                    }
                } catch (e) {
                    console.error(`[CRON] Secondary reminder failed for ${reg.attendee_email}:`, e);
                    failed++;
                }
            }
        }
        
        console.log(`[CRON] Event reminders (secondary) complete: ${sent} sent, ${failed} failed, ${skipped} skipped`);
    } catch (error) {
        console.error('[CRON] Secondary event reminder job failed:', error);
    }
};

/**
 * Helper: Convert 12-hour time to 24-hour format
 */
const convertTo24Hour = (time12h) => {
    if (!time12h) return '00:00';
    
    // Already in 24h format
    if (!time12h.toLowerCase().includes('am') && !time12h.toLowerCase().includes('pm')) {
        return time12h;
    }
    
    const [time, modifier] = time12h.split(' ');
    let [hours, minutes] = time.split(':');
    hours = parseInt(hours, 10);
    
    if (modifier?.toLowerCase() === 'pm' && hours !== 12) {
        hours += 12;
    } else if (modifier?.toLowerCase() === 'am' && hours === 12) {
        hours = 0;
    }
    
    return `${hours.toString().padStart(2, '0')}:${minutes || '00'}`;
};

/**
 * Generate event reminder email HTML (legacy - kept for backwards compatibility)
 */
const generateEventReminderHtml = (eventTitle, date, time, location, attendeeName, ticketUrl) => `
<!DOCTYPE html>
<html>
<head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1.0"></head>
<body style="margin:0;padding:0;background:#f4f4f5;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif;">
<div style="max-width:600px;margin:0 auto;padding:40px 20px;">
    <div style="background:linear-gradient(135deg,#ec4899,#f472b6);border-radius:16px 16px 0 0;padding:40px;text-align:center;">
        <h1 style="color:white;margin:0;font-size:28px;">🎉 Get Ready!</h1>
        <p style="color:rgba(255,255,255,0.9);margin:10px 0 0 0;">Your event is tomorrow!</p>
    </div>
    <div style="background:white;padding:40px;border-radius:0 0 16px 16px;">
        <p style="font-size:16px;color:#374151;">Hey ${attendeeName || 'there'}!</p>
        <p style="font-size:18px;color:#18181b;margin-bottom:24px;"><strong>${eventTitle}</strong> is happening soon!</p>
        <div style="background:#f4f4f5;border-radius:12px;padding:24px;margin-bottom:24px;">
            <p style="margin:0 0 8px 0;color:#71717a;font-size:14px;">📅 Date & Time</p>
            <p style="margin:0 0 16px 0;color:#18181b;font-weight:600;">${date} at ${time}</p>
            <p style="margin:0 0 8px 0;color:#71717a;font-size:14px;">📍 Location</p>
            <p style="margin:0;color:#18181b;font-weight:600;">${location}</p>
        </div>
        <a href="${ticketUrl}" style="display:block;background:#ec4899;color:white;text-decoration:none;padding:16px 32px;border-radius:12px;font-weight:600;text-align:center;margin-bottom:24px;">View Your Ticket</a>
        <p style="color:#71717a;font-size:14px;text-align:center;">See you there! 🎟️</p>
    </div>
</div>
</body>
</html>`;

// ==================== ABANDONED CART EMAILS ====================

/**
 * Send abandoned cart emails
 * Targets: Unpaid registrations > 24h old (changed from 12h per requirements)
 */
const sendAbandonedCartEmails = async () => {
    console.log('[CRON] Starting abandoned cart job...');
    
    try {
        // 24 hour threshold as per requirements
        const twentyFourHoursAgo = new Date(Date.now() - 24 * 60 * 60 * 1000);
        
        // Find unpaid/pending registrations older than 24 hours
        const { data: abandonedRegs, error: regError } = await supabase
            .from('registrations')
            .select('id, attendee_email, attendee_name, event_id, created_at, event:events(title, owner_id, date, location, email_settings)')
            .in('payment_status', ['pending', 'incomplete', 'failed'])
            .lt('created_at', twentyFourHoursAgo.toISOString())
            .is('abandoned_email_sent', null); // Only send once
        
        if (regError) {
            console.error('[CRON] Error fetching abandoned carts:', regError);
            return;
        }
        
        if (!abandonedRegs?.length) {
            console.log('[CRON] No abandoned carts found');
            return;
        }
        
        console.log(`[CRON] Found ${abandonedRegs.length} abandoned cart(s) to process`);
        
        let sent = 0, failed = 0;
        
        // Process in batches to avoid Resend rate limits (2 req/sec)
        const BATCH_SIZE = 5;
        const DELAY_BETWEEN_BATCHES = 3000; // 3 seconds
        
        for (let i = 0; i < abandonedRegs.length; i += BATCH_SIZE) {
            const batch = abandonedRegs.slice(i, i + BATCH_SIZE);
            const batchNumber = Math.floor(i / BATCH_SIZE) + 1;
            const totalBatches = Math.ceil(abandonedRegs.length / BATCH_SIZE);
            
            console.log(`[CRON] Processing batch ${batchNumber}/${totalBatches} (${batch.length} emails)`);
            
            const promises = batch.map(async (reg) => {
                if (!reg.event?.title || !reg.attendee_email) {
                    return { success: false, reason: 'missing_data' };
                }
                
                // Check if abandoned cart emails are enabled for this event
                const emailSettings = reg.event?.email_settings || {};
                if (emailSettings.abandonedCartEnabled === false) {
                    return { success: false, reason: 'disabled' };
                }
                
                // Don't send for past events
                if (new Date(reg.event.date) < new Date()) {
                    return { success: false, reason: 'past_event' };
                }
                
                try {
                    // Use new email template system
                    const { abandonedCart } = await import('./emailTemplates.js');
                    const emailAudit = await import('./emailAuditService.js');
                    
                    // Check for duplicates
                    const alreadySent = await emailAudit.wasEmailSent(
                        emailAudit.TRIGGER_TYPES.CRON_ABANDONED_CART,
                        emailAudit.EMAIL_TYPES.ABANDONED_CART,
                        reg.id
                    );
                    
                    if (alreadySent) {
                        return { success: false, reason: 'already_sent' };
                    }
                    
                    const checkoutUrl = `${process.env.FRONTEND_URL || 'https://openticket.events'}/#/event/${reg.event_id}`;
                    const eventDate = reg.event.date 
                        ? new Date(reg.event.date).toLocaleDateString('en-US', {
                            weekday: 'long', year: 'numeric', month: 'long', day: 'numeric'
                        })
                        : 'TBD';
                    
                    const { subject, html } = abandonedCart({
                        attendeeName: reg.attendee_name || 'there',
                        eventTitle: reg.event.title,
                        eventDate,
                        eventLocation: reg.event.location || 'See event page',
                        checkoutUrl
                    });
                    
                    const result = await sendEmailWithProvider(
                        reg.attendee_email,
                        subject,
                        html,
                        reg.event.owner_id
                    );
                    
                    // Log to audit
                    await emailAudit.logEmailSend({
                        triggerType: emailAudit.TRIGGER_TYPES.CRON_ABANDONED_CART,
                        emailType: emailAudit.EMAIL_TYPES.ABANDONED_CART,
                        recipient: reg.attendee_email,
                        registrationId: reg.id,
                        eventId: reg.event_id,
                        success: result.sent || result.simulated,
                        messageId: result.messageId,
                        error: result.error
                    });
                    
                    if (result.sent || result.simulated) {
                        emailAudit.markEmailSent(
                            emailAudit.TRIGGER_TYPES.CRON_ABANDONED_CART,
                            emailAudit.EMAIL_TYPES.ABANDONED_CART,
                            reg.id
                        );
                        // Mark as sent to avoid duplicate emails
                        await supabase
                            .from('registrations')
                            .update({ abandoned_email_sent: new Date().toISOString() })
                            .eq('id', reg.id);
                        return { success: true, email: reg.attendee_email };
                    } else {
                        return { success: false, email: reg.attendee_email, error: result.error };
                    }
                } catch (e) {
                    console.error(`[CRON] Abandoned cart email failed for ${reg.attendee_email}:`, e.message);
                    return { success: false, email: reg.attendee_email, error: e.message };
                }
            });
            
            const results = await Promise.all(promises);
            
            // Count successes and failures
            results.forEach(result => {
                if (result.success) {
                    sent++;
                    console.log(`[CRON] ✓ Sent to ${result.email}`);
                } else {
                    failed++;
                    if (result.error) {
                        console.warn(`[CRON] ✗ Failed: ${result.email} - ${result.error}`);
                    }
                }
            });
            
            // Add delay between batches to respect rate limits
            if (i + BATCH_SIZE < abandonedRegs.length) {
                console.log(`[CRON] Waiting ${DELAY_BETWEEN_BATCHES}ms before next batch...`);
                await new Promise(resolve => setTimeout(resolve, DELAY_BETWEEN_BATCHES));
            }
        }
        
        console.log(`[CRON] Abandoned cart emails complete: ${sent} sent, ${failed} failed`);
    } catch (error) {
        console.error('[CRON] Abandoned cart job failed:', error);
    }
};

/**
 * Generate abandoned cart email HTML
 */
const generateAbandonedCartHtml = (eventTitle, attendeeName, checkoutUrl) => `
<!DOCTYPE html>
<html>
<head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1.0"></head>
<body style="margin:0;padding:0;background:#f4f4f5;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif;">
<div style="max-width:600px;margin:0 auto;padding:40px 20px;">
    <div style="background:linear-gradient(135deg,#f59e0b,#fbbf24);border-radius:16px 16px 0 0;padding:40px;text-align:center;">
        <h1 style="color:white;margin:0;font-size:28px;">Don't Miss Out! 🎟️</h1>
    </div>
    <div style="background:white;padding:40px;border-radius:0 0 16px 16px;">
        <p style="font-size:16px;color:#374151;">Hey ${attendeeName || 'there'}!</p>
        <p style="font-size:18px;color:#18181b;margin-bottom:24px;">Your tickets for <strong>${eventTitle}</strong> are waiting for you!</p>
        <p style="color:#52525b;margin-bottom:24px;">We noticed you didn't complete your purchase. Tickets are selling fast - secure yours before they're gone!</p>
        <a href="${checkoutUrl}" style="display:block;background:#f59e0b;color:white;text-decoration:none;padding:16px 32px;border-radius:12px;font-weight:600;text-align:center;margin-bottom:24px;">Complete Your Purchase</a>
        <p style="color:#71717a;font-size:14px;text-align:center;">Questions? Reply to this email and we'll help you out.</p>
    </div>
</div>
</body>
</html>`;

// ==================== POST-EVENT FOLLOW-UP EMAILS ====================

/**
 * Send post-event thank you emails
 * Runs every morning at 9 AM UTC to send thank-yous for events that ended yesterday
 * Only sends to non-refunded attendees
 */
const sendPostEventFollowups = async () => {
    console.log('[CRON] Starting post-event thank you job...');
    
    try {
        // Find events that ended yesterday (the previous calendar day)
        const now = new Date();
        const yesterday = new Date(now);
        yesterday.setDate(yesterday.getDate() - 1);
        const yesterdayStr = yesterday.toISOString().split('T')[0];
        
        const { data: pastEvents, error: eventsError } = await supabase
            .from('events')
            .select('id, title, owner_id, date, email_settings')
            .eq('date', yesterdayStr)
            .eq('is_draft', false);
        
        if (eventsError) {
            console.error('[CRON] Error fetching past events:', eventsError);
            return;
        }
        
        if (!pastEvents?.length) {
            console.log('[CRON] No events ended yesterday for thank you emails');
            return;
        }
        
        const { postEventThankYou } = await import('./emailTemplates.js');
        const emailAudit = await import('./emailAuditService.js');
        
        let sent = 0, failed = 0, skipped = 0;
        
        for (const event of pastEvents) {
            // Check if post-event emails are enabled for this event
            const emailSettings = event.email_settings || {};
            if (emailSettings.postEventEnabled === false) {
                console.log(`[CRON] Post-event emails disabled for: ${event.title}`);
                continue;
            }
            
            // Get organizer name
            const { data: organizer } = await supabase
                .from('profiles')
                .select('name')
                .eq('id', event.owner_id)
                .single();
            
            // Get attendees - only non-refunded
            const { data: registrations } = await supabase
                .from('registrations')
                .select('id, attendee_email, attendee_name, payment_status')
                .eq('event_id', event.id)
                .not('payment_status', 'eq', 'refunded');
            
            if (!registrations?.length) continue;
            
            for (const reg of registrations) {
                try {
                    // Check for duplicates
                    const alreadySent = await emailAudit.wasEmailSent(
                        emailAudit.TRIGGER_TYPES.CRON_POST_EVENT,
                        emailAudit.EMAIL_TYPES.POST_EVENT_THANK_YOU,
                        reg.id
                    );
                    
                    if (alreadySent) {
                        skipped++;
                        continue;
                    }
                    
                    const eventDate = new Date(event.date).toLocaleDateString('en-US', {
                        weekday: 'long', year: 'numeric', month: 'long', day: 'numeric'
                    });
                    
                    const { subject, html } = postEventThankYou({
                        attendeeName: reg.attendee_name || 'there',
                        eventTitle: event.title,
                        eventDate,
                        organizerName: organizer?.name || 'Event Organizer',
                        feedbackUrl: null // Could be configured per-event
                    });
                    
                    const result = await sendEmailWithProvider(
                        reg.attendee_email,
                        subject,
                        html,
                        event.owner_id
                    );
                    
                    // Log to audit
                    await emailAudit.logEmailSend({
                        triggerType: emailAudit.TRIGGER_TYPES.CRON_POST_EVENT,
                        emailType: emailAudit.EMAIL_TYPES.POST_EVENT_THANK_YOU,
                        recipient: reg.attendee_email,
                        registrationId: reg.id,
                        eventId: event.id,
                        success: result.sent || result.simulated,
                        messageId: result.messageId,
                        error: result.error
                    });
                    
                    if (result.sent || result.simulated) {
                        emailAudit.markEmailSent(
                            emailAudit.TRIGGER_TYPES.CRON_POST_EVENT,
                            emailAudit.EMAIL_TYPES.POST_EVENT_THANK_YOU,
                            reg.id
                        );
                        sent++;
                    } else {
                        failed++;
                    }
                } catch (e) {
                    console.error(`[CRON] Thank you email failed for ${reg.attendee_email}:`, e);
                    failed++;
                }
            }
        }
        
        console.log(`[CRON] Post-event thank yous complete: ${sent} sent, ${failed} failed, ${skipped} skipped (duplicates)`);
    } catch (error) {
        console.error('[CRON] Post-event thank you job failed:', error);
    }
};

/**
 * Generate post-event follow-up email HTML
 */
const generatePostEventHtml = (eventTitle, attendeeName) => `
<!DOCTYPE html>
<html>
<head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1.0"></head>
<body style="margin:0;padding:0;background:#f4f4f5;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif;">
<div style="max-width:600px;margin:0 auto;padding:40px 20px;">
    <div style="background:linear-gradient(135deg,#10b981,#34d399);border-radius:16px 16px 0 0;padding:40px;text-align:center;">
        <h1 style="color:white;margin:0;font-size:28px;">Thank You! 🎉</h1>
    </div>
    <div style="background:white;padding:40px;border-radius:0 0 16px 16px;">
        <p style="font-size:16px;color:#374151;">Hey ${attendeeName || 'there'}!</p>
        <p style="font-size:18px;color:#18181b;margin-bottom:24px;">We hope you had an amazing time at <strong>${eventTitle}</strong>!</p>
        <p style="color:#52525b;margin-bottom:24px;">Your support means the world to us. We'd love to hear about your experience.</p>
        <p style="color:#71717a;font-size:14px;text-align:center;">Hope to see you at our next event! 💫</p>
    </div>
</div>
</body>
</html>`;

/**
 * Send weekly affiliate summary emails
 * Runs every Monday at 9:00 AM UTC
 */
const sendWeeklyAffiliateSummaries = async () => {
    console.log('[CRON] Starting weekly affiliate summary job...');
    
    try {
        // Get all affiliates
        const { data: affiliates, error: affError } = await supabase
            .from('profiles')
            .select('id, name, email, affiliate_code, affiliate_clicks, total_paid_out')
            .not('affiliate_code', 'is', null);

        if (affError) {
            console.error('[CRON] Error fetching affiliates:', affError);
            return;
        }

        // Calculate date range for this week
        const now = new Date();
        const weekStart = new Date(now);
        weekStart.setDate(now.getDate() - 7);
        
        const weekStartStr = weekStart.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
        const weekEndStr = now.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });

        let sent = 0;
        let failed = 0;

        for (const aff of affiliates || []) {
            if (!aff.email) continue;

            try {
                // Get this week's transactions for this affiliate
                const { data: transactions } = await supabase
                    .from('financial_transactions')
                    .select('affiliate_commission, gross_amount, event:events(title)')
                    .eq('affiliate_code', aff.affiliate_code)
                    .gte('created_at', weekStart.toISOString())
                    .lte('created_at', now.toISOString());

                const weeklyEarnings = transactions?.reduce((sum, t) => sum + (Number(t.affiliate_commission) || 0), 0) || 0;
                const weeklyConversions = transactions?.length || 0;

                // Group by event for top performers
                const eventMap = {};
                transactions?.forEach(t => {
                    const eventName = t.event?.title || 'Unknown Event';
                    if (!eventMap[eventName]) {
                        eventMap[eventName] = { eventName, conversions: 0, earnings: 0 };
                    }
                    eventMap[eventName].conversions++;
                    eventMap[eventName].earnings += Number(t.affiliate_commission) || 0;
                });
                const topEvents = Object.values(eventMap)
                    .sort((a, b) => b.earnings - a.earnings)
                    .slice(0, 3);

                // Get pending payout (recent earnings not yet paid)
                const { data: allTx } = await supabase
                    .from('financial_transactions')
                    .select('affiliate_commission')
                    .eq('affiliate_code', aff.affiliate_code);

                const totalEarnings = allTx?.reduce((sum, t) => sum + (Number(t.affiliate_commission) || 0), 0) || 0;
                const pendingPayout = Math.max(0, totalEarnings - (aff.total_paid_out || 0));

                const weeklyStats = {
                    totalEarnings: weeklyEarnings,
                    totalClicks: aff.affiliate_clicks || 0,
                    totalConversions: weeklyConversions,
                    conversionRate: aff.affiliate_clicks > 0 ? (weeklyConversions / aff.affiliate_clicks) * 100 : 0,
                    pendingPayout,
                    topEvents,
                    weekStart: weekStartStr,
                    weekEnd: weekEndStr
                };

                const result = await EmailService.sendAffiliateWeeklySummary(
                    aff.email,
                    aff.name,
                    weeklyStats
                );

                if (result.sent) sent++;
                else failed++;
            } catch (e) {
                console.error(`[CRON] Error processing affiliate ${aff.email}:`, e);
                failed++;
            }
        }

        console.log(`[CRON] Weekly affiliate summary complete: ${sent} sent, ${failed} failed, ${affiliates?.length || 0} total affiliates`);
    } catch (error) {
        console.error('[CRON] Weekly affiliate summary job failed:', error);
    }
};

/**
 * Process Scheduled Affiliate Payouts
 * Runs daily at midnight to check for scheduled payouts that are due
 * Transfers funds via Stripe and updates status
 */
const processScheduledAffiliatePayouts = async () => {
    console.log('[CRON] Starting scheduled affiliate payout processing...');
    
    try {
        const today = new Date();
        today.setHours(23, 59, 59, 999); // End of today

        // Get all scheduled payouts due today or earlier
        const { data: payouts, error: fetchError } = await supabase
            .from('affiliate_payouts')
            .select(`
                *,
                affiliates:affiliate_id (
                    id,
                    code,
                    user_id,
                    stripe_account_id,
                    profiles:user_id (
                        email,
                        display_name,
                        name
                    )
                )
            `)
            .eq('status', 'scheduled')
            .lte('scheduled_for', today.toISOString());

        if (fetchError) {
            console.error('[CRON] Error fetching scheduled payouts:', fetchError);
            return;
        }

        if (!payouts || payouts.length === 0) {
            console.log('[CRON] No scheduled payouts due today');
            return;
        }

        console.log(`[CRON] Found ${payouts.length} scheduled payout(s) to process`);

        let processedCount = 0;
        let failedCount = 0;

        for (const payout of payouts) {
            try {
                console.log(`[CRON] Processing payout ${payout.id} for affiliate ${payout.affiliates.code}`);

                // Verify affiliate has Stripe account
                if (!payout.affiliates.stripe_account_id) {
                    console.error(`[CRON] Affiliate ${payout.affiliates.code} has no Stripe account`);
                    
                    await supabase
                        .from('affiliate_payouts')
                        .update({
                            status: 'failed',
                            notes: 'No Stripe account connected'
                        })
                        .eq('id', payout.id);
                    
                    failedCount++;
                    continue;
                }

                // Convert amount to cents
                const amountInCents = Math.round(payout.amount * 100);

                // Create Stripe transfer
                const transfer = await stripe.transfers.create({
                    amount: amountInCents,
                    currency: 'usd',
                    destination: payout.affiliates.stripe_account_id,
                    description: `Affiliate commission payout for ${payout.affiliates.code}`,
                    metadata: {
                        payout_id: payout.id,
                        affiliate_id: payout.affiliate_id,
                        affiliate_code: payout.affiliates.code,
                        payout_method: 'scheduled'
                    }
                });

                console.log(`[CRON] ✅ Stripe transfer created: ${transfer.id}`);

                // Update payout record to paid
                await supabase
                    .from('affiliate_payouts')
                    .update({
                        status: 'paid',
                        paid_at: new Date().toISOString(),
                        stripe_payout_id: transfer.id,
                        notes: `Automatically processed on ${new Date().toLocaleDateString()}`
                    })
                    .eq('id', payout.id);

                processedCount++;

                // Send email notification
                try {
                    const affiliateName = payout.affiliates.profiles.display_name || 
                                        payout.affiliates.profiles.name || 
                                        'Affiliate';
                    const affiliateEmail = payout.affiliates.profiles.email;

                    if (affiliateEmail) {
                        await sendEmailWithProvider(
                            affiliateEmail,
                            '💰 Your affiliate commission has been paid!',
                            `
                                <h2>Payment Processed!</h2>
                                <p>Hi ${affiliateName},</p>
                                <p>Great news! Your scheduled affiliate commission of <strong>$${payout.amount.toFixed(2)}</strong> has been successfully transferred to your Stripe account.</p>
                                <p><small>Transfer ID: ${transfer.id}</small></p>
                                <p>Thank you for being a valued affiliate partner!</p>
                            `,
                            payout.affiliates.user_id
                        );
                    }
                } catch (emailError) {
                    console.error('[CRON] Failed to send email notification:', emailError);
                }

            } catch (stripeError) {
                console.error(`[CRON] ❌ Stripe error for payout ${payout.id}:`, stripeError);
                
                await supabase
                    .from('affiliate_payouts')
                    .update({
                        status: 'failed',
                        notes: `Stripe error: ${stripeError.message}`
                    })
                    .eq('id', payout.id);
                
                failedCount++;
            }
        }

        console.log(`[CRON] Scheduled payout processing completed`);
        console.log(`[CRON] ✅ Success: ${processedCount}, ❌ Failed: ${failedCount}, Total: ${payouts.length}`);

    } catch (error) {
        console.error('[CRON] Unexpected error in processScheduledAffiliatePayouts:', error);
    }
};

/**
 * Initialize all cron jobs
 */
export const initCronJobs = () => {
    if (cronInitialized) {
        console.log('[CRON] Jobs already initialized, skipping...');
        return;
    }

    console.log('[CRON] Initializing scheduled jobs...');

    // Event Reminders (Primary - 24h) - Every hour at minute 0
    cron.schedule('0 * * * *', async () => {
        console.log('[CRON] Triggered: Event Reminders (Primary - 24h)');
        await sendEventReminders();
    }, { timezone: 'UTC' });
    console.log('[CRON] ✅ Event Reminders (Primary) scheduled (hourly)');

    // Event Reminders (Secondary - 1h) - Every 15 minutes
    cron.schedule('*/15 * * * *', async () => {
        console.log('[CRON] Triggered: Event Reminders (Secondary - 1h)');
        await sendSecondaryEventReminders();
    }, { timezone: 'UTC' });
    console.log('[CRON] ✅ Event Reminders (Secondary) scheduled (every 15 min)');

    // Abandoned Cart - Every 6 hours (threshold: 24h after checkout started)
    cron.schedule('0 */6 * * *', async () => {
        console.log('[CRON] Triggered: Abandoned Cart Emails (24h threshold)');
        await sendAbandonedCartEmails();
    }, { timezone: 'UTC' });
    console.log('[CRON] ✅ Abandoned Cart Emails scheduled (every 6 hours)');

    // Post-Event Thank You - Every day at 9 AM UTC (morning after event)
    cron.schedule('0 9 * * *', async () => {
        console.log('[CRON] Triggered: Post-Event Thank You Emails');
        await sendPostEventFollowups();
    }, { timezone: 'UTC' });
    console.log('[CRON] ✅ Post-Event Thank You scheduled (daily at 9 AM UTC)');

    // Weekly affiliate summary - Every Monday at 9:00 AM UTC
    cron.schedule('0 9 * * 1', async () => {
        console.log('[CRON] Triggered: Weekly Affiliate Summary');
        await sendWeeklyAffiliateSummaries();
    }, { timezone: 'UTC' });
    console.log('[CRON] ✅ Weekly Affiliate Summary scheduled (Mondays 9 AM UTC)');

    // Scheduled Affiliate Payouts - Daily at midnight UTC
    cron.schedule('0 0 * * *', async () => {
        console.log('[CRON] Triggered: Scheduled Affiliate Payouts');
        await processScheduledAffiliatePayouts();
    }, { timezone: 'UTC' });
    console.log('[CRON] ✅ Scheduled Affiliate Payouts scheduled (daily at midnight UTC)');

    // Analytics Cleanup - Weekly on Sunday at 4 AM UTC
    cron.schedule('0 4 * * 0', async () => {
        console.log('[CRON] Triggered: Analytics Cleanup (90 days retention)');
        try {
            const scanAnalyticsService = (await import('./scanAnalyticsService.js')).default;
            const result = await scanAnalyticsService.deleteOldAnalytics(90);
            console.log('[CRON] Analytics cleanup completed:', result);
        } catch (error) {
            console.error('[CRON] Analytics cleanup job failed:', error);
        }
    }, { timezone: 'UTC' });
    console.log('[CRON] ✅ Analytics Cleanup scheduled (Sunday 4 AM UTC)');

    cronInitialized = true;
    console.log('[CRON] All jobs initialized successfully');
};

/**
 * Manually trigger jobs (for testing or admin use)
 */
export const triggerWeeklySummary = async () => await sendWeeklyAffiliateSummaries();
export const triggerEventReminders = async () => await sendEventReminders();
export const triggerSecondaryReminders = async () => await sendSecondaryEventReminders();
export const triggerAbandonedCart = async () => await sendAbandonedCartEmails();
export const triggerPostEventFollowups = async () => await sendPostEventFollowups();
export const triggerScheduledPayouts = async () => await processScheduledAffiliatePayouts();

export default { 
    initCronJobs, 
    triggerWeeklySummary, 
    triggerEventReminders,
    triggerSecondaryReminders,
    triggerAbandonedCart, 
    triggerPostEventFollowups,
    triggerScheduledPayouts,
    sendEmailWithProvider
};
