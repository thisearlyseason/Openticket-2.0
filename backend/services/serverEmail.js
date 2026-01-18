import resendService from './resendService.js';

// Helper function to send email via Resend
const sendEmailViaResend = async (to, subject, html) => {
    try {
        console.log(`[EmailService] Attempting to send email to: ${to}`);
        const result = await resendService.sendEmail({ to, subject, html });
        if (result.success) {
            console.log(`[EmailService] ✅ Email sent via Resend: ${result.messageId} to ${to}`);
            return { sent: true, messageId: result.messageId };
        } else {
            console.error(`[EmailService] ❌ Resend failed for ${to}: ${result.error}`);
            // Check if it's a domain verification issue
            if (result.error && result.error.includes('can only send')) {
                console.error(`[EmailService] 💡 Resend test key limitation: Can only send to verified emails. Please verify domain at resend.com/domains`);
            }
            return { sent: false, error: result.error };
        }
    } catch (error) {
        console.error(`[EmailService] ❌ Exception sending to ${to}:`, error.message);
        return { sent: false, error: error.message };
    }
};

// Plan features for welcome emails
const PLAN_FEATURES = {
    free: {
        name: 'Free',
        features: ['50 Tickets per Event', '3 Events per Month', 'Standard Support', 'Offline Payments']
    },
    pro: {
        name: 'Pro',
        price: '$39/month',
        features: ['250 Tickets per Event', 'Unlimited Events', 'Priority Support', 'Advanced Analytics', 'Lower Fees (1.5% + $0.75)']
    },
    premium: {
        name: 'Premium',
        price: '$110/month',
        features: ['Unlimited Tickets', 'Unlimited Events', 'Dedicated Support', 'White Labeling', 'Custom Domain', 'Lowest Fees (0.75% + $0.30)']
    }
};

export const EmailService = {
    sendConfirmation: async (to, tickets, eventDetails) => {
        console.log(`[EmailService] sendConfirmation called for: ${to}`);
        console.log(`[EmailService] Event: ${eventDetails?.title}, Tickets: ${tickets?.length || 0}`);
        
        // Check if Resend is configured
        if (!resendService.isResendConfigured()) {
            console.warn("[EmailService] ❌ Resend not configured. Email simulation only.");
            console.log(`[SIMULATION] To: ${to}, Subject: Ticket Confirmation for ${eventDetails?.title}`);
            return false;
        }

        try {
            // Use new template system
            const { purchaseConfirmation } = await import('./emailTemplates.js');
            const emailAudit = await import('./emailAuditService.js');
            
            const eventDate = eventDetails?.date 
                ? new Date(eventDetails.date).toLocaleDateString('en-US', {
                    weekday: 'long', year: 'numeric', month: 'long', day: 'numeric'
                })
                : 'TBD';
            
            // Calculate total paid from tickets
            const totalPaid = tickets.reduce((sum, t) => sum + ((t.price || 0) * (t.quantity || 1)), 0);
            
            const { subject, html } = purchaseConfirmation({
                attendeeName: tickets[0]?.attendeeName || 'Guest',
                eventTitle: eventDetails?.title || 'Event',
                eventDate,
                eventTime: eventDetails?.time || 'TBD',
                eventLocation: eventDetails?.location || eventDetails?.venue_name || 'TBD',
                tickets: tickets.map(t => ({
                    name: t.name || 'Ticket',
                    quantity: t.quantity || 1,
                    price: t.price || 0
                })),
                totalPaid,
                orderId: tickets[0]?.id?.substring(0, 8).toUpperCase() || 'N/A',
                organizerName: eventDetails?.organizer || 'Event Organizer',
                ticketDesign: eventDetails?.ticket_design  // Pass event's visual design for themed emails
            });

            console.log(`[EmailService] Sending confirmation email to ${to}...`);
            const result = await sendEmailViaResend(to, subject, html);
            
            // Log to audit (registration ID from first ticket)
            const registrationId = tickets[0]?.registrationId || tickets[0]?.id;
            if (registrationId) {
                await emailAudit.logEmailSend({
                    triggerType: emailAudit.TRIGGER_TYPES.STRIPE_CHECKOUT_COMPLETED,
                    emailType: emailAudit.EMAIL_TYPES.PURCHASE_CONFIRMATION,
                    recipient: to,
                    registrationId,
                    eventId: eventDetails?.id,
                    success: result.sent,
                    messageId: result.messageId,
                    error: result.error
                });
            }
            
            console.log(`[EmailService] Confirmation email result: sent=${result.sent}, messageId=${result.messageId || 'N/A'}`);
            return result.sent;
        } catch (templateError) {
            console.error('[EmailService] Template error, using fallback:', templateError.message);
            
            // Fallback to basic template
            const subject = `🎟️ Your Tickets for ${eventDetails?.title || 'OpenTicket Event'}`;
            const ticketRows = tickets.map(t => `
                <div style="border: 1px solid #e5e7eb; padding: 16px; margin-bottom: 12px; border-radius: 12px; background: #f9fafb;">
                    <h3 style="margin: 0 0 8px 0; color: #111827;">${t.name || 'Ticket'}</h3>
                    <p style="margin: 0; color: #6b7280;">Attendee: <strong style="color: #111827;">${t.attendeeName || 'Guest'}</strong></p>
                    <p style="font-family: monospace; color: #9ca3af; font-size: 12px; margin-top: 8px;">ID: ${t.id || 'N/A'}</p>
                </div>
            `).join('');

            const htmlBody = `
                <div style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; max-width: 600px; margin: 0 auto; background: #ffffff;">
                    <div style="background: linear-gradient(135deg, #10b981 0%, #059669 100%); padding: 40px 30px; text-align: center; border-radius: 12px 12px 0 0;">
                        <h1 style="color: white; margin: 0; font-size: 28px;">🎉 Order Confirmed!</h1>
                    </div>
                    <div style="padding: 30px;">
                        <p style="color: #374151; font-size: 16px;">Thank you for your purchase!</p>
                        <div style="background: #f3f4f6; padding: 20px; border-radius: 12px; margin: 24px 0;">
                            <p style="margin: 0 0 8px 0; color: #6b7280;"><strong style="color: #111827;">Event:</strong> ${eventDetails?.title || 'N/A'}</p>
                            <p style="margin: 0 0 8px 0; color: #6b7280;"><strong style="color: #111827;">Date:</strong> ${eventDetails?.date ? new Date(eventDetails.date).toLocaleString() : 'N/A'}</p>
                            <p style="margin: 0; color: #6b7280;"><strong style="color: #111827;">Location:</strong> ${eventDetails?.location || 'Online'}</p>
                        </div>
                        <h2 style="color: #111827; font-size: 18px; margin-top: 24px;">Your Tickets</h2>
                        ${ticketRows}
                        <hr style="border: none; border-top: 1px solid #e5e7eb; margin: 24px 0;" />
                        <p style="color: #6b7280; font-size: 14px;">Please present these tickets at the entrance.</p>
                    </div>
                </div>
            `;

            const result = await sendEmailViaResend(to, subject, htmlBody);
            return result.sent;
        }
    },

    /**
     * Send subscription welcome email when user upgrades their plan
     */
    sendSubscriptionWelcome: async (to, planName, cycle, userName) => {
        if (!resendService.isResendConfigured()) {
            console.warn("[EmailService] Resend not configured. Simulation only.");
            console.log(`[SIMULATION] Subscription Welcome to: ${to}, Plan: ${planName}`);
            return { sent: false, simulated: true };
        }

        const plan = PLAN_FEATURES[planName.toLowerCase()] || PLAN_FEATURES.free;
        const displayName = userName || 'there';
        const cycleText = cycle === 'yearly' ? 'annual' : 'monthly';

        const featuresHtml = plan.features.map(f => `
            <li style="padding: 8px 0; border-bottom: 1px solid #f0f0f0;">
                <span style="color: #22c55e; font-weight: bold;">✓</span> ${f}
            </li>
        `).join('');

        const subject = `Welcome to OpenTicket ${plan.name}! 🎉`;

        const htmlBody = `
            <div style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; max-width: 600px; margin: 0 auto; background: #ffffff;">
                <!-- Header -->
                <div style="background: linear-gradient(135deg, #ec4899 0%, #8b5cf6 100%); padding: 40px 30px; text-align: center; border-radius: 12px 12px 0 0;">
                    <h1 style="color: white; margin: 0; font-size: 28px;">Welcome to ${plan.name}!</h1>
                    <p style="color: rgba(255,255,255,0.9); margin: 10px 0 0 0; font-size: 16px;">Your subscription is now active</p>
                </div>

                <!-- Body -->
                <div style="padding: 30px; background: #ffffff;">
                    <p style="font-size: 16px; color: #374151; line-height: 1.6;">
                        Hey ${displayName},
                    </p>
                    <p style="font-size: 16px; color: #374151; line-height: 1.6;">
                        Thank you for upgrading to <strong>OpenTicket ${plan.name}</strong>! 
                        Your ${cycleText} subscription is now active and you have full access to all ${plan.name} features.
                    </p>

                    <!-- Features Box -->
                    <div style="background: #f9fafb; border-radius: 12px; padding: 25px; margin: 25px 0;">
                        <h2 style="margin: 0 0 15px 0; font-size: 18px; color: #111827;">Your ${plan.name} Benefits</h2>
                        <ul style="list-style: none; padding: 0; margin: 0;">
                            ${featuresHtml}
                        </ul>
                    </div>

                    <!-- CTA -->
                    <div style="text-align: center; margin: 30px 0;">
                        <a href="#" style="display: inline-block; background: linear-gradient(135deg, #ec4899 0%, #8b5cf6 100%); color: white; padding: 14px 32px; border-radius: 50px; text-decoration: none; font-weight: bold; font-size: 16px;">
                            Go to Dashboard →
                        </a>
                    </div>

                    <!-- Quick Start -->
                    <div style="background: #fef3c7; border-left: 4px solid #f59e0b; padding: 15px 20px; border-radius: 0 8px 8px 0; margin: 25px 0;">
                        <h3 style="margin: 0 0 8px 0; font-size: 14px; color: #92400e;">🚀 Quick Start Tips</h3>
                        <ul style="margin: 0; padding-left: 20px; color: #92400e; font-size: 14px; line-height: 1.8;">
                            <li>Create your first event from the Dashboard</li>
                            <li>Set up your organizer profile</li>
                            <li>Connect your Stripe account for payouts</li>
                        </ul>
                    </div>

                    <p style="font-size: 14px; color: #6b7280; line-height: 1.6;">
                        Need help? Reply to this email or visit our support center. We're here for you!
                    </p>
                </div>

                <!-- Footer -->
                <div style="background: #f9fafb; padding: 20px 30px; text-align: center; border-radius: 0 0 12px 12px; border-top: 1px solid #e5e7eb;">
                    <p style="margin: 0; font-size: 12px; color: #9ca3af;">
                        OpenTicket · The boldest ticketing platform for creators
                    </p>
                    <p style="margin: 8px 0 0 0; font-size: 11px; color: #d1d5db;">
                        ${plan.price ? `Billed ${cycleText} at ${plan.price}` : 'Free Plan'}
                    </p>
                </div>
            </div>
        `;

        return await sendEmailViaResend(to, subject, htmlBody);
    },

    /**
     * Send subscription cancellation/downgrade email
     */
    sendSubscriptionCancellation: async (to, oldPlan, newPlan, userName, effectiveDate) => {
        if (!resendService.isResendConfigured()) {
            console.warn("[EmailService] Resend not configured. Simulation only.");
            console.log(`[SIMULATION] Subscription Change to: ${to}, ${oldPlan} → ${newPlan}`);
            return { sent: false, simulated: true };
        }

        const displayName = userName || 'there';
        const isDowngrade = newPlan && newPlan !== 'cancelled';
        const isCancellation = !newPlan || newPlan === 'cancelled';
        
        const subject = isCancellation 
            ? `Your OpenTicket subscription has been cancelled`
            : `Your OpenTicket plan has been changed`;

        const oldPlanDisplay = PLAN_FEATURES[oldPlan?.toLowerCase()]?.name || oldPlan || 'Previous';
        const newPlanDisplay = PLAN_FEATURES[newPlan?.toLowerCase()]?.name || newPlan || 'Free';

        const htmlBody = `
            <div style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; max-width: 600px; margin: 0 auto; background: #ffffff;">
                <!-- Header -->
                <div style="background: ${isCancellation ? '#ef4444' : '#f59e0b'}; padding: 40px 30px; text-align: center; border-radius: 12px 12px 0 0;">
                    <h1 style="color: white; margin: 0; font-size: 28px;">
                        ${isCancellation ? 'Subscription Cancelled' : 'Plan Changed'}
                    </h1>
                </div>

                <!-- Body -->
                <div style="padding: 30px; background: #ffffff;">
                    <p style="font-size: 16px; color: #374151; line-height: 1.6;">
                        Hey ${displayName},
                    </p>
                    
                    ${isCancellation ? `
                        <p style="font-size: 16px; color: #374151; line-height: 1.6;">
                            We're sorry to see you go! Your <strong>${oldPlanDisplay}</strong> subscription has been cancelled.
                        </p>
                        <p style="font-size: 16px; color: #374151; line-height: 1.6;">
                            ${effectiveDate ? `Your access to ${oldPlanDisplay} features will continue until <strong>${new Date(effectiveDate).toLocaleDateString()}</strong>.` : 'Your subscription has been cancelled effective immediately.'}
                        </p>
                    ` : `
                        <p style="font-size: 16px; color: #374151; line-height: 1.6;">
                            Your plan has been changed from <strong>${oldPlanDisplay}</strong> to <strong>${newPlanDisplay}</strong>.
                        </p>
                        <p style="font-size: 16px; color: #374151; line-height: 1.6;">
                            Your new plan features are now active.
                        </p>
                    `}

                    <!-- What's Next Box -->
                    <div style="background: #f9fafb; border-radius: 12px; padding: 25px; margin: 25px 0;">
                        <h2 style="margin: 0 0 15px 0; font-size: 18px; color: #111827;">What happens next?</h2>
                        ${isCancellation ? `
                            <ul style="margin: 0; padding-left: 20px; color: #374151; line-height: 2;">
                                <li>Your events will remain visible to attendees</li>
                                <li>You can still manage existing registrations</li>
                                <li>You'll keep access to your earnings and payout history</li>
                                <li>You can resubscribe anytime to unlock all features</li>
                            </ul>
                        ` : `
                            <ul style="margin: 0; padding-left: 20px; color: #374151; line-height: 2;">
                                <li>Your ${newPlanDisplay} features are now active</li>
                                <li>Check your dashboard for updated limits</li>
                                <li>Your billing will reflect the new plan</li>
                            </ul>
                        `}
                    </div>

                    <!-- CTA -->
                    <div style="text-align: center; margin: 30px 0;">
                        <a href="#" style="display: inline-block; background: ${isCancellation ? '#ec4899' : '#8b5cf6'}; color: white; padding: 14px 32px; border-radius: 50px; text-decoration: none; font-weight: bold; font-size: 16px;">
                            ${isCancellation ? 'Resubscribe Now' : 'View Dashboard'}
                        </a>
                    </div>

                    ${isCancellation ? `
                        <p style="font-size: 14px; color: #6b7280; line-height: 1.6; text-align: center;">
                            Changed your mind? You can resubscribe anytime from your Settings page.
                        </p>
                    ` : ''}
                </div>

                <!-- Footer -->
                <div style="background: #f9fafb; padding: 20px 30px; text-align: center; border-radius: 0 0 12px 12px; border-top: 1px solid #e5e7eb;">
                    <p style="margin: 0; font-size: 12px; color: #9ca3af;">
                        OpenTicket · The boldest ticketing platform for creators
                    </p>
                </div>
            </div>
        `;

        return await sendEmailViaResend(to, subject, htmlBody);
    },

    /**
     * Send affiliate conversion notification when someone signs up with their code
     */
    sendAffiliateConversionNotification: async (to, affiliateName, customerName, eventTitle, orderAmount, commission) => {
        if (!resendService.isResendConfigured()) {
            console.warn("[EmailService] Resend not configured. Simulation only.");
            console.log(`[SIMULATION] Affiliate Conversion to: ${to}, Commission: $${commission}`);
            return { sent: false, simulated: true };
        }

        const displayName = affiliateName || 'Partner';
        const commissionFormatted = typeof commission === 'number' ? commission.toFixed(2) : commission;

        const subject = `🎉 You earned $${commissionFormatted} commission!`;

        const htmlBody = `
            <div style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; max-width: 600px; margin: 0 auto; background: #ffffff;">
                <!-- Header -->
                <div style="background: linear-gradient(135deg, #22c55e 0%, #10b981 100%); padding: 40px 30px; text-align: center; border-radius: 12px 12px 0 0;">
                    <div style="font-size: 48px; margin-bottom: 10px;">💰</div>
                    <h1 style="color: white; margin: 0; font-size: 28px;">Commission Earned!</h1>
                    <p style="color: rgba(255,255,255,0.9); margin: 10px 0 0 0; font-size: 16px;">Someone used your affiliate link</p>
                </div>

                <!-- Body -->
                <div style="padding: 30px; background: #ffffff;">
                    <p style="font-size: 16px; color: #374151; line-height: 1.6;">
                        Hey ${displayName}! 🎊
                    </p>
                    <p style="font-size: 16px; color: #374151; line-height: 1.6;">
                        Great news! Someone just made a purchase using your affiliate link.
                    </p>

                    <!-- Commission Box -->
                    <div style="background: linear-gradient(135deg, #ecfdf5 0%, #d1fae5 100%); border: 2px solid #10b981; border-radius: 16px; padding: 30px; margin: 25px 0; text-align: center;">
                        <p style="margin: 0 0 5px 0; font-size: 14px; color: #059669; text-transform: uppercase; font-weight: bold;">Your Commission</p>
                        <p style="margin: 0; font-size: 48px; font-weight: 900; color: #047857;">$${commissionFormatted}</p>
                    </div>

                    <!-- Order Details -->
                    <div style="background: #f9fafb; border-radius: 12px; padding: 20px; margin: 25px 0;">
                        <h3 style="margin: 0 0 15px 0; font-size: 16px; color: #111827;">Order Details</h3>
                        <table style="width: 100%; font-size: 14px; color: #374151;">
                            <tr>
                                <td style="padding: 8px 0; border-bottom: 1px solid #e5e7eb;">Customer</td>
                                <td style="padding: 8px 0; border-bottom: 1px solid #e5e7eb; text-align: right; font-weight: bold;">${customerName || 'New Customer'}</td>
                            </tr>
                            <tr>
                                <td style="padding: 8px 0; border-bottom: 1px solid #e5e7eb;">Event</td>
                                <td style="padding: 8px 0; border-bottom: 1px solid #e5e7eb; text-align: right; font-weight: bold;">${eventTitle || 'Event Ticket'}</td>
                            </tr>
                            <tr>
                                <td style="padding: 8px 0; border-bottom: 1px solid #e5e7eb;">Order Total</td>
                                <td style="padding: 8px 0; border-bottom: 1px solid #e5e7eb; text-align: right; font-weight: bold;">$${orderAmount || '0.00'}</td>
                            </tr>
                            <tr>
                                <td style="padding: 8px 0; color: #059669; font-weight: bold;">Your Earnings</td>
                                <td style="padding: 8px 0; text-align: right; font-weight: 900; color: #059669;">$${commissionFormatted}</td>
                            </tr>
                        </table>
                    </div>

                    <!-- Tips -->
                    <div style="background: #fef3c7; border-left: 4px solid #f59e0b; padding: 15px 20px; border-radius: 0 8px 8px 0; margin: 25px 0;">
                        <h3 style="margin: 0 0 8px 0; font-size: 14px; color: #92400e;">💡 Pro Tip</h3>
                        <p style="margin: 0; color: #92400e; font-size: 14px; line-height: 1.6;">
                            Share your link on social media and in relevant communities to maximize your earnings!
                        </p>
                    </div>

                    <!-- CTA -->
                    <div style="text-align: center; margin: 30px 0;">
                        <a href="#" style="display: inline-block; background: linear-gradient(135deg, #22c55e 0%, #10b981 100%); color: white; padding: 14px 32px; border-radius: 50px; text-decoration: none; font-weight: bold; font-size: 16px;">
                            View Affiliate Dashboard →
                        </a>
                    </div>
                </div>

                <!-- Footer -->
                <div style="background: #f9fafb; padding: 20px 30px; text-align: center; border-radius: 0 0 12px 12px; border-top: 1px solid #e5e7eb;">
                    <p style="margin: 0; font-size: 12px; color: #9ca3af;">
                        OpenTicket Affiliate Program · Keep sharing, keep earning!
                    </p>
                    <p style="margin: 8px 0 0 0; font-size: 11px; color: #d1d5db;">
                        Commission pending payout. View your dashboard for payout schedule.
                    </p>
                </div>
            </div>
        `;

        return await sendEmailViaResend(to, subject, htmlBody);
    },

    /**
     * Send affiliate subscription commission notification
     * This is sent when a referred user subscribes or renews their subscription
     */
    sendAffiliateSubscriptionCommission: async (to, affiliateName, customerName, planName, subscriptionAmount, commission) => {
        if (!resendService.isResendConfigured()) {
            console.warn("[EmailService] Resend not configured. Simulation only.");
            console.log(`[SIMULATION] Subscription Commission to: ${to}, Commission: $${commission}`);
            return { sent: false, simulated: true };
        }

        const displayName = affiliateName || 'Partner';
        const commissionFormatted = typeof commission === 'number' ? commission.toFixed(2) : commission;
        const planDisplay = planName.charAt(0).toUpperCase() + planName.slice(1);

        const subject = `🎉 Subscription Commission: $${commissionFormatted} earned!`;

        const htmlBody = `
            <div style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; max-width: 600px; margin: 0 auto; background: #ffffff;">
                <!-- Header -->
                <div style="background: linear-gradient(135deg, #8b5cf6 0%, #7c3aed 100%); padding: 40px 30px; text-align: center; border-radius: 12px 12px 0 0;">
                    <div style="font-size: 48px; margin-bottom: 10px;">🔄</div>
                    <h1 style="color: white; margin: 0; font-size: 28px;">Subscription Commission!</h1>
                    <p style="color: rgba(255,255,255,0.9); margin: 10px 0 0 0; font-size: 16px;">Recurring revenue from your referral</p>
                </div>

                <!-- Body -->
                <div style="padding: 30px; background: #ffffff;">
                    <p style="font-size: 16px; color: #374151; line-height: 1.6;">
                        Hey ${displayName}! 🎊
                    </p>
                    <p style="font-size: 16px; color: #374151; line-height: 1.6;">
                        Great news! A user you referred just paid for their subscription, and you earned a commission!
                    </p>

                    <!-- Commission Box -->
                    <div style="background: linear-gradient(135deg, #f5f3ff 0%, #ede9fe 100%); border: 2px solid #8b5cf6; border-radius: 16px; padding: 30px; margin: 25px 0; text-align: center;">
                        <p style="margin: 0 0 5px 0; font-size: 14px; color: #7c3aed; text-transform: uppercase; font-weight: bold;">Your Commission (15%)</p>
                        <p style="margin: 0; font-size: 48px; font-weight: 900; color: #6d28d9;">$${commissionFormatted}</p>
                    </div>

                    <!-- Subscription Details -->
                    <div style="background: #f9fafb; border-radius: 12px; padding: 20px; margin: 25px 0;">
                        <h3 style="margin: 0 0 15px 0; font-size: 16px; color: #111827;">Subscription Details</h3>
                        <table style="width: 100%; font-size: 14px; color: #374151;">
                            <tr>
                                <td style="padding: 8px 0; border-bottom: 1px solid #e5e7eb;">Subscriber</td>
                                <td style="padding: 8px 0; border-bottom: 1px solid #e5e7eb; text-align: right; font-weight: bold;">${customerName || 'Referred User'}</td>
                            </tr>
                            <tr>
                                <td style="padding: 8px 0; border-bottom: 1px solid #e5e7eb;">Plan</td>
                                <td style="padding: 8px 0; border-bottom: 1px solid #e5e7eb; text-align: right; font-weight: bold;">${planDisplay} Plan</td>
                            </tr>
                            <tr>
                                <td style="padding: 8px 0; border-bottom: 1px solid #e5e7eb;">Subscription Amount</td>
                                <td style="padding: 8px 0; border-bottom: 1px solid #e5e7eb; text-align: right; font-weight: bold;">$${subscriptionAmount || '0.00'}</td>
                            </tr>
                            <tr>
                                <td style="padding: 8px 0; color: #7c3aed; font-weight: bold;">Your Earnings</td>
                                <td style="padding: 8px 0; text-align: right; font-weight: 900; color: #7c3aed;">$${commissionFormatted}</td>
                            </tr>
                        </table>
                    </div>

                    <!-- Recurring Info -->
                    <div style="background: #dbeafe; border-left: 4px solid #3b82f6; padding: 15px 20px; border-radius: 0 8px 8px 0; margin: 25px 0;">
                        <h3 style="margin: 0 0 8px 0; font-size: 14px; color: #1e40af;">🔄 Recurring Commission</h3>
                        <p style="margin: 0; color: #1e40af; font-size: 14px; line-height: 1.6;">
                            As long as this user stays subscribed, you'll earn 15% commission on every renewal. Keep referring more users to maximize your recurring income!
                        </p>
                    </div>

                    <!-- CTA -->
                    <div style="text-align: center; margin: 30px 0;">
                        <a href="#" style="display: inline-block; background: linear-gradient(135deg, #8b5cf6 0%, #7c3aed 100%); color: white; padding: 14px 32px; border-radius: 50px; text-decoration: none; font-weight: bold; font-size: 16px;">
                            View Affiliate Dashboard →
                        </a>
                    </div>
                </div>

                <!-- Footer -->
                <div style="background: #f9fafb; padding: 20px 30px; text-align: center; border-radius: 0 0 12px 12px; border-top: 1px solid #e5e7eb;">
                    <p style="margin: 0; font-size: 12px; color: #9ca3af;">
                        OpenTicket Affiliate Program · Subscription Referrals
                    </p>
                    <p style="margin: 8px 0 0 0; font-size: 11px; color: #d1d5db;">
                        Commission pending payout. View your dashboard for payout schedule.
                    </p>
                </div>
            </div>
        `;

        return await sendEmailViaResend(to, subject, htmlBody);
    },

    /**
     * Send weekly affiliate earnings summary email
     */
    sendAffiliateWeeklySummary: async (to, affiliateName, weeklyStats) => {
        if (!resendService.isResendConfigured()) {
            console.warn("[EmailService] Resend not configured. Simulation only.");
            console.log(`[SIMULATION] Weekly Summary to: ${to}`);
            return { sent: false, simulated: true };
        }

        const {
            totalEarnings = 0,
            totalClicks = 0,
            totalConversions = 0,
            conversionRate = 0,
            pendingPayout = 0,
            topEvents = [],
            weekStart,
            weekEnd
        } = weeklyStats;

        const displayName = affiliateName || 'Partner';
        const hasActivity = totalEarnings > 0 || totalClicks > 0;

        const subject = hasActivity 
            ? `📊 Your Weekly Earnings: $${totalEarnings.toFixed(2)}`
            : `📊 Your Weekly Affiliate Summary`;

        const topEventsHtml = topEvents.length > 0 
            ? topEvents.map((e, i) => `
                <tr>
                    <td style="padding: 10px; border-bottom: 1px solid #e5e7eb;">${i + 1}. ${e.eventName || 'Event'}</td>
                    <td style="padding: 10px; border-bottom: 1px solid #e5e7eb; text-align: center;">${e.conversions || 0}</td>
                    <td style="padding: 10px; border-bottom: 1px solid #e5e7eb; text-align: right; font-weight: bold; color: #059669;">$${(e.earnings || 0).toFixed(2)}</td>
                </tr>
            `).join('')
            : `<tr><td colspan="3" style="padding: 20px; text-align: center; color: #9ca3af;">No conversions this week</td></tr>`;

        const htmlBody = `
            <div style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; max-width: 600px; margin: 0 auto; background: #ffffff;">
                <!-- Header -->
                <div style="background: linear-gradient(135deg, #8b5cf6 0%, #6366f1 100%); padding: 40px 30px; text-align: center; border-radius: 12px 12px 0 0;">
                    <div style="font-size: 48px; margin-bottom: 10px;">📊</div>
                    <h1 style="color: white; margin: 0; font-size: 28px;">Weekly Earnings Summary</h1>
                    <p style="color: rgba(255,255,255,0.9); margin: 10px 0 0 0; font-size: 14px;">
                        ${weekStart || 'This Week'} - ${weekEnd || 'Today'}
                    </p>
                </div>

                <!-- Body -->
                <div style="padding: 30px; background: #ffffff;">
                    <p style="font-size: 16px; color: #374151; line-height: 1.6;">
                        Hey ${displayName}! 👋
                    </p>
                    <p style="font-size: 16px; color: #374151; line-height: 1.6;">
                        Here's your affiliate performance summary for this week.
                    </p>

                    <!-- Stats Grid -->
                    <div style="display: grid; grid-template-columns: repeat(2, 1fr); gap: 15px; margin: 25px 0;">
                        <div style="background: #f0fdf4; border: 2px solid #22c55e; border-radius: 12px; padding: 20px; text-align: center;">
                            <p style="margin: 0; font-size: 12px; color: #059669; text-transform: uppercase; font-weight: bold;">Weekly Earnings</p>
                            <p style="margin: 5px 0 0 0; font-size: 32px; font-weight: 900; color: #047857;">$${totalEarnings.toFixed(2)}</p>
                        </div>
                        <div style="background: #faf5ff; border: 2px solid #a855f7; border-radius: 12px; padding: 20px; text-align: center;">
                            <p style="margin: 0; font-size: 12px; color: #7c3aed; text-transform: uppercase; font-weight: bold;">Pending Payout</p>
                            <p style="margin: 5px 0 0 0; font-size: 32px; font-weight: 900; color: #6d28d9;">$${pendingPayout.toFixed(2)}</p>
                        </div>
                    </div>

                    <!-- Performance Metrics -->
                    <div style="background: #f9fafb; border-radius: 12px; padding: 20px; margin: 25px 0;">
                        <h3 style="margin: 0 0 15px 0; font-size: 16px; color: #111827;">Performance Metrics</h3>
                        <table style="width: 100%; font-size: 14px;">
                            <tr>
                                <td style="padding: 8px 0; color: #6b7280;">Link Clicks</td>
                                <td style="padding: 8px 0; text-align: right; font-weight: bold; color: #374151;">${totalClicks}</td>
                            </tr>
                            <tr>
                                <td style="padding: 8px 0; color: #6b7280;">Conversions</td>
                                <td style="padding: 8px 0; text-align: right; font-weight: bold; color: #374151;">${totalConversions}</td>
                            </tr>
                            <tr>
                                <td style="padding: 8px 0; color: #6b7280;">Conversion Rate</td>
                                <td style="padding: 8px 0; text-align: right; font-weight: bold; color: ${conversionRate > 5 ? '#059669' : '#374151'};">${conversionRate.toFixed(1)}%</td>
                            </tr>
                        </table>
                    </div>

                    <!-- Top Events -->
                    <div style="background: #ffffff; border: 1px solid #e5e7eb; border-radius: 12px; padding: 20px; margin: 25px 0;">
                        <h3 style="margin: 0 0 15px 0; font-size: 16px; color: #111827;">Top Performing Events</h3>
                        <table style="width: 100%; font-size: 14px;">
                            <thead>
                                <tr style="border-bottom: 2px solid #e5e7eb;">
                                    <th style="padding: 10px; text-align: left; color: #6b7280; font-weight: 600;">Event</th>
                                    <th style="padding: 10px; text-align: center; color: #6b7280; font-weight: 600;">Sales</th>
                                    <th style="padding: 10px; text-align: right; color: #6b7280; font-weight: 600;">Earnings</th>
                                </tr>
                            </thead>
                            <tbody>
                                ${topEventsHtml}
                            </tbody>
                        </table>
                    </div>

                    ${!hasActivity ? `
                        <div style="background: #fef3c7; border-left: 4px solid #f59e0b; padding: 15px 20px; border-radius: 0 8px 8px 0; margin: 25px 0;">
                            <h3 style="margin: 0 0 8px 0; font-size: 14px; color: #92400e;">💡 Boost Your Earnings</h3>
                            <p style="margin: 0; color: #92400e; font-size: 14px; line-height: 1.6;">
                                No activity this week? Share your affiliate link on social media, in event communities, or with friends who love events!
                            </p>
                        </div>
                    ` : ''}

                    <!-- CTA -->
                    <div style="text-align: center; margin: 30px 0;">
                        <a href="#" style="display: inline-block; background: linear-gradient(135deg, #8b5cf6 0%, #6366f1 100%); color: white; padding: 14px 32px; border-radius: 50px; text-decoration: none; font-weight: bold; font-size: 16px;">
                            View Full Dashboard →
                        </a>
                    </div>
                </div>

                <!-- Footer -->
                <div style="background: #f9fafb; padding: 20px 30px; text-align: center; border-radius: 0 0 12px 12px; border-top: 1px solid #e5e7eb;">
                    <p style="margin: 0; font-size: 12px; color: #9ca3af;">
                        OpenTicket Affiliate Program · Earnings update every Monday
                    </p>
                </div>
            </div>
        `;

        return await sendEmailViaResend(to, subject, htmlBody);
    },

    /**
     * Send payment failed notification email
     */
    sendPaymentFailedNotification: async (to, customerName, eventTitle, amount, failureReason) => {
        if (!resendService.isResendConfigured()) {
            console.warn("[EmailService] Resend not configured. Simulation only.");
            console.log(`[SIMULATION] Payment Failed to: ${to}, Event: ${eventTitle}`);
            return { sent: false, simulated: true };
        }

        const displayName = customerName || 'there';
        const formattedAmount = typeof amount === 'number' ? amount.toFixed(2) : amount || '0.00';
        const reason = failureReason || 'Your card was declined or there was an issue processing your payment.';

        const subject = `⚠️ Payment Failed - ${eventTitle || 'Event Registration'}`;

        const htmlBody = `
            <div style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; max-width: 600px; margin: 0 auto; background: #ffffff;">
                <!-- Header -->
                <div style="background: linear-gradient(135deg, #ef4444 0%, #dc2626 100%); padding: 40px 30px; text-align: center; border-radius: 12px 12px 0 0;">
                    <div style="font-size: 48px; margin-bottom: 10px;">⚠️</div>
                    <h1 style="color: white; margin: 0; font-size: 28px;">Payment Failed</h1>
                    <p style="color: rgba(255,255,255,0.9); margin: 10px 0 0 0; font-size: 16px;">We couldn't process your payment</p>
                </div>

                <!-- Body -->
                <div style="padding: 30px; background: #ffffff;">
                    <p style="font-size: 16px; color: #374151; line-height: 1.6;">
                        Hey ${displayName},
                    </p>
                    <p style="font-size: 16px; color: #374151; line-height: 1.6;">
                        Unfortunately, we were unable to process your payment for <strong>${eventTitle || 'your event registration'}</strong>.
                    </p>

                    <!-- Order Details -->
                    <div style="background: #fef2f2; border: 2px solid #fecaca; border-radius: 16px; padding: 25px; margin: 25px 0;">
                        <h3 style="margin: 0 0 15px 0; font-size: 16px; color: #991b1b;">Payment Details</h3>
                        <table style="width: 100%; font-size: 14px; color: #374151;">
                            <tr>
                                <td style="padding: 8px 0; border-bottom: 1px solid #fecaca;">Event</td>
                                <td style="padding: 8px 0; border-bottom: 1px solid #fecaca; text-align: right; font-weight: bold;">${eventTitle || 'N/A'}</td>
                            </tr>
                            <tr>
                                <td style="padding: 8px 0; border-bottom: 1px solid #fecaca;">Amount</td>
                                <td style="padding: 8px 0; border-bottom: 1px solid #fecaca; text-align: right; font-weight: bold;">$${formattedAmount}</td>
                            </tr>
                            <tr>
                                <td style="padding: 8px 0; color: #dc2626;">Issue</td>
                                <td style="padding: 8px 0; text-align: right; color: #dc2626; font-weight: bold;">${reason}</td>
                            </tr>
                        </table>
                    </div>

                    <!-- What to do -->
                    <div style="background: #f9fafb; border-radius: 12px; padding: 25px; margin: 25px 0;">
                        <h2 style="margin: 0 0 15px 0; font-size: 18px; color: #111827;">What can you do?</h2>
                        <ul style="list-style: none; padding: 0; margin: 0;">
                            <li style="padding: 10px 0; border-bottom: 1px solid #e5e7eb; display: flex; align-items: start; gap: 10px;">
                                <span style="color: #3b82f6; font-weight: bold;">1.</span> 
                                <span>Check that your card details are correct and up to date</span>
                            </li>
                            <li style="padding: 10px 0; border-bottom: 1px solid #e5e7eb; display: flex; align-items: start; gap: 10px;">
                                <span style="color: #3b82f6; font-weight: bold;">2.</span> 
                                <span>Ensure you have sufficient funds available</span>
                            </li>
                            <li style="padding: 10px 0; border-bottom: 1px solid #e5e7eb; display: flex; align-items: start; gap: 10px;">
                                <span style="color: #3b82f6; font-weight: bold;">3.</span> 
                                <span>Contact your bank if the issue persists</span>
                            </li>
                            <li style="padding: 10px 0; display: flex; align-items: start; gap: 10px;">
                                <span style="color: #3b82f6; font-weight: bold;">4.</span> 
                                <span>Try again with a different payment method</span>
                            </li>
                        </ul>
                    </div>

                    <!-- CTA -->
                    <div style="text-align: center; margin: 30px 0;">
                        <a href="#" style="display: inline-block; background: linear-gradient(135deg, #ec4899 0%, #8b5cf6 100%); color: white; padding: 14px 32px; border-radius: 50px; text-decoration: none; font-weight: bold; font-size: 16px;">
                            Try Again →
                        </a>
                    </div>

                    <p style="font-size: 14px; color: #6b7280; line-height: 1.6; text-align: center;">
                        Need help? Reply to this email and we'll assist you.
                    </p>
                </div>

                <!-- Footer -->
                <div style="background: #f9fafb; padding: 20px 30px; text-align: center; border-radius: 0 0 12px 12px; border-top: 1px solid #e5e7eb;">
                    <p style="margin: 0; font-size: 12px; color: #9ca3af;">
                        OpenTicket · The boldest ticketing platform for creators
                    </p>
                    <p style="margin: 8px 0 0 0; font-size: 11px; color: #d1d5db;">
                        This is an automated notification about your payment attempt.
                    </p>
                </div>
            </div>
        `;

        return await sendEmailViaResend(to, subject, htmlBody);
    },

    /**
     * Send attendee account credentials after auto-creation on ticket purchase
     */
    sendAttendeeCredentials: async (to, attendeeName, password, eventTitle, eventDate, eventLocation) => {
        if (!resendService.isResendConfigured()) {
            console.warn("[EmailService] Resend not configured. Simulation only.");
            console.log(`[SIMULATION] Attendee Credentials to: ${to}, Password: ${password}`);
            return { sent: false, simulated: true };
        }

        const displayName = attendeeName || 'there';
        const subject = `🎫 Your OpenTicket Account Has Been Created!`;

        const htmlBody = `
            <div style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; max-width: 600px; margin: 0 auto; background: #ffffff;">
                <!-- Header -->
                <div style="background: linear-gradient(135deg, #ec4899 0%, #8b5cf6 100%); padding: 40px 30px; text-align: center; border-radius: 12px 12px 0 0;">
                    <div style="font-size: 48px; margin-bottom: 10px;">🎉</div>
                    <h1 style="color: white; margin: 0; font-size: 28px;">Welcome to OpenTicket!</h1>
                    <p style="color: rgba(255,255,255,0.9); margin: 10px 0 0 0; font-size: 16px;">Your account has been created</p>
                </div>

                <!-- Body -->
                <div style="padding: 30px; background: #ffffff;">
                    <p style="font-size: 16px; color: #374151; line-height: 1.6;">
                        Hey ${displayName}! 👋
                    </p>
                    <p style="font-size: 16px; color: #374151; line-height: 1.6;">
                        Thanks for purchasing tickets for <strong>${eventTitle || 'an event'}</strong>! 
                        We've automatically created an account for you so you can easily access your tickets anytime.
                    </p>

                    <!-- Credentials Box -->
                    <div style="background: linear-gradient(135deg, #f0fdf4 0%, #dcfce7 100%); border: 2px solid #22c55e; border-radius: 16px; padding: 25px; margin: 25px 0;">
                        <h3 style="margin: 0 0 15px 0; font-size: 16px; color: #166534; text-align: center;">Your Login Credentials</h3>
                        <table style="width: 100%; font-size: 14px;">
                            <tr>
                                <td style="padding: 8px 0; color: #166534; font-weight: 600;">Email:</td>
                                <td style="padding: 8px 0; text-align: right; font-weight: bold; color: #047857; font-family: monospace;">${to}</td>
                            </tr>
                            <tr>
                                <td style="padding: 8px 0; color: #166534; font-weight: 600;">Password:</td>
                                <td style="padding: 8px 0; text-align: right; font-weight: bold; color: #047857; font-family: monospace; font-size: 18px;">${password}</td>
                            </tr>
                        </table>
                        <p style="margin: 15px 0 0 0; font-size: 12px; color: #15803d; text-align: center;">
                            ⚠️ Please save this password or change it after logging in
                        </p>
                    </div>

                    ${eventTitle ? `
                    <!-- Event Details -->
                    <div style="background: #f9fafb; border-radius: 12px; padding: 20px; margin: 25px 0;">
                        <h3 style="margin: 0 0 15px 0; font-size: 16px; color: #111827;">Event Details</h3>
                        <table style="width: 100%; font-size: 14px; color: #374151;">
                            <tr>
                                <td style="padding: 8px 0; border-bottom: 1px solid #e5e7eb;">Event</td>
                                <td style="padding: 8px 0; border-bottom: 1px solid #e5e7eb; text-align: right; font-weight: bold;">${eventTitle}</td>
                            </tr>
                            ${eventDate ? `
                            <tr>
                                <td style="padding: 8px 0; border-bottom: 1px solid #e5e7eb;">Date</td>
                                <td style="padding: 8px 0; border-bottom: 1px solid #e5e7eb; text-align: right;">${eventDate}</td>
                            </tr>
                            ` : ''}
                            ${eventLocation ? `
                            <tr>
                                <td style="padding: 8px 0;">Location</td>
                                <td style="padding: 8px 0; text-align: right;">${eventLocation}</td>
                            </tr>
                            ` : ''}
                        </table>
                    </div>
                    ` : ''}

                    <!-- What You Can Do -->
                    <div style="background: #fef3c7; border-left: 4px solid #f59e0b; padding: 15px 20px; border-radius: 0 8px 8px 0; margin: 25px 0;">
                        <h3 style="margin: 0 0 8px 0; font-size: 14px; color: #92400e;">🎫 With Your Account You Can:</h3>
                        <ul style="margin: 0; padding-left: 20px; color: #92400e; font-size: 14px; line-height: 1.8;">
                            <li>View and download your tickets</li>
                            <li>Explore upcoming events</li>
                            <li>Manage your profile</li>
                            <li>Get event reminders</li>
                        </ul>
                    </div>

                    <!-- CTA -->
                    <div style="text-align: center; margin: 30px 0;">
                        <a href="${process.env.FRONTEND_URL || 'https://openticket.events'}/#/auth" style="display: inline-block; background: linear-gradient(135deg, #ec4899 0%, #8b5cf6 100%); color: white; padding: 14px 32px; border-radius: 50px; text-decoration: none; font-weight: bold; font-size: 16px;">
                            Sign In to View Tickets →
                        </a>
                    </div>
                </div>

                <!-- Footer -->
                <div style="background: #f9fafb; padding: 20px 30px; text-align: center; border-radius: 0 0 12px 12px; border-top: 1px solid #e5e7eb;">
                    <p style="margin: 0; font-size: 12px; color: #9ca3af;">
                        OpenTicket · The boldest ticketing platform for creators
                    </p>
                    <p style="margin: 8px 0 0 0; font-size: 11px; color: #d1d5db;">
                        You received this email because you purchased tickets on OpenTicket.
                    </p>
                </div>
            </div>
        `;

        return await sendEmailViaResend(to, subject, htmlBody);
    },

    /**
     * Send non-profit approval email with magic link
     */
    sendNonprofitApprovalEmail: async (to, organizerName, organizationName, discountCode, magicLink) => {
        if (!resendService.isResendConfigured()) {
            console.warn("[EmailService] Resend not configured. Simulation only.");
            console.log(`[SIMULATION] Non-profit Approval to: ${to}, Code: ${discountCode}`);
            return { sent: false, simulated: true };
        }

        const displayName = organizerName || 'Organizer';
        const orgName = organizationName || 'Your Organization';

        const subject = `🎉 Non-Profit Status Approved - 20% Discount Inside!`;

        const htmlBody = `
            <div style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; max-width: 600px; margin: 0 auto; background: #ffffff;">
                <!-- Header -->
                <div style="background: linear-gradient(135deg, #10b981 0%, #059669 100%); padding: 40px 30px; text-align: center; border-radius: 12px 12px 0 0;">
                    <div style="font-size: 48px; margin-bottom: 10px;">✅</div>
                    <h1 style="color: white; margin: 0; font-size: 28px;">Non-Profit Approved!</h1>
                    <p style="color: rgba(255,255,255,0.9); margin: 10px 0 0 0; font-size: 16px;">${orgName}</p>
                </div>

                <!-- Body -->
                <div style="padding: 30px; background: #ffffff;">
                    <p style="font-size: 16px; color: #374151; line-height: 1.6;">
                        Hi ${displayName}! 🎊
                    </p>
                    <p style="font-size: 16px; color: #374151; line-height: 1.6;">
                        Great news! Your non-profit verification has been <strong>approved</strong>. As a thank you for the important work you do, we're giving you an exclusive <strong>20% discount</strong> on all subscription plans.
                    </p>

                    <!-- Discount Box -->
                    <div style="background: linear-gradient(135deg, #ecfdf5 0%, #d1fae5 100%); border: 2px solid #10b981; border-radius: 16px; padding: 30px; margin: 25px 0; text-align: center;">
                        <p style="margin: 0 0 5px 0; font-size: 14px; color: #059669; text-transform: uppercase; font-weight: bold;">Your Exclusive Code</p>
                        <p style="margin: 0; font-size: 32px; font-weight: 900; color: #047857; font-family: monospace; letter-spacing: 2px;">${discountCode}</p>
                        <p style="margin: 10px 0 0 0; font-size: 14px; color: #065f46;">20% off Pro or Premium plans</p>
                    </div>

                    <!-- Magic Link CTA -->
                    <div style="text-align: center; margin: 30px 0;">
                        <p style="font-size: 14px; color: #6b7280; margin-bottom: 15px;">Click below to upgrade with your discount automatically applied:</p>
                        <a href="${magicLink}" style="display: inline-block; background: linear-gradient(135deg, #10b981 0%, #059669 100%); color: white; padding: 16px 40px; border-radius: 50px; text-decoration: none; font-weight: bold; font-size: 18px; box-shadow: 0 4px 14px rgba(16, 185, 129, 0.4);">
                            Upgrade Now with 20% Off →
                        </a>
                    </div>

                    <!-- Benefits -->
                    <div style="background: #f9fafb; border-radius: 12px; padding: 20px; margin: 25px 0;">
                        <h3 style="margin: 0 0 15px 0; font-size: 16px; color: #111827;">🌟 What You Get with Pro/Premium:</h3>
                        <ul style="margin: 0; padding-left: 20px; color: #374151; font-size: 14px; line-height: 2;">
                            <li>Unlimited events</li>
                            <li>Lower platform fees</li>
                            <li>Priority support</li>
                            <li>Advanced analytics</li>
                            <li>Custom branding options</li>
                        </ul>
                    </div>
                </div>

                <!-- Footer -->
                <div style="background: #f9fafb; padding: 20px 30px; text-align: center; border-radius: 0 0 12px 12px; border-top: 1px solid #e5e7eb;">
                    <p style="margin: 0; font-size: 12px; color: #9ca3af;">
                        OpenTicket · Supporting non-profits since day one
                    </p>
                    <p style="margin: 8px 0 0 0; font-size: 11px; color: #d1d5db;">
                        This discount code is valid for one-time use on subscription upgrade.
                    </p>
                </div>
            </div>
        `;

        return await sendEmailViaResend(to, subject, htmlBody);
    },

    /**
     * Send non-profit rejection email
     */
    sendNonprofitRejectionEmail: async (to, organizerName, reason) => {
        if (!resendService.isResendConfigured()) {
            console.warn("[EmailService] Resend not configured. Simulation only.");
            console.log(`[SIMULATION] Non-profit Rejection to: ${to}`);
            return { sent: false, simulated: true };
        }

        const displayName = organizerName || 'Organizer';
        const rejectionReason = reason || 'Your application did not meet our verification requirements.';

        const subject = `Update on Your Non-Profit Application`;

        const htmlBody = `
            <div style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; max-width: 600px; margin: 0 auto; background: #ffffff;">
                <!-- Header -->
                <div style="background: linear-gradient(135deg, #6b7280 0%, #4b5563 100%); padding: 40px 30px; text-align: center; border-radius: 12px 12px 0 0;">
                    <div style="font-size: 48px; margin-bottom: 10px;">📋</div>
                    <h1 style="color: white; margin: 0; font-size: 28px;">Application Update</h1>
                </div>

                <!-- Body -->
                <div style="padding: 30px; background: #ffffff;">
                    <p style="font-size: 16px; color: #374151; line-height: 1.6;">
                        Hi ${displayName},
                    </p>
                    <p style="font-size: 16px; color: #374151; line-height: 1.6;">
                        Thank you for applying for non-profit status on OpenTicket. After careful review, we were unable to verify your organization at this time.
                    </p>

                    <!-- Reason Box -->
                    <div style="background: #fef2f2; border-left: 4px solid #ef4444; padding: 15px 20px; border-radius: 0 8px 8px 0; margin: 25px 0;">
                        <h3 style="margin: 0 0 8px 0; font-size: 14px; color: #991b1b;">Reason:</h3>
                        <p style="margin: 0; color: #991b1b; font-size: 14px; line-height: 1.6;">
                            ${rejectionReason}
                        </p>
                    </div>

                    <p style="font-size: 16px; color: #374151; line-height: 1.6;">
                        You can still use OpenTicket with our Free plan, or upgrade to Pro/Premium for additional features. If you believe this decision was made in error, please contact our support team with additional documentation.
                    </p>

                    <!-- CTA -->
                    <div style="text-align: center; margin: 30px 0;">
                        <a href="${process.env.FRONTEND_URL || 'https://openticket.events'}/#/pricing" style="display: inline-block; background: linear-gradient(135deg, #3b82f6 0%, #1d4ed8 100%); color: white; padding: 14px 32px; border-radius: 50px; text-decoration: none; font-weight: bold; font-size: 16px;">
                            View Plans →
                        </a>
                    </div>
                </div>

                <!-- Footer -->
                <div style="background: #f9fafb; padding: 20px 30px; text-align: center; border-radius: 0 0 12px 12px; border-top: 1px solid #e5e7eb;">
                    <p style="margin: 0; font-size: 12px; color: #9ca3af;">
                        OpenTicket · Here to help you succeed
                    </p>
                </div>
            </div>
        `;

        return await sendEmailViaResend(to, subject, htmlBody);
    },

    /**
     * Send magic link email for ticket retrieval
     * Allows users to access their tickets via email without logging in
     */
    sendTicketRetrievalLink: async (to, tickets, events) => {
        if (!resendService.isResendConfigured()) {
            console.warn("[EmailService] Resend not configured. Simulation only.");
            console.log(`[SIMULATION] Ticket Retrieval to: ${to}, Tickets: ${tickets?.length || 0}`);
            return { sent: false, simulated: true };
        }

        const subject = `🎟️ Your OpenTicket Orders`;

        // Generate ticket groups by event
        const ticketGroups = {};
        tickets.forEach(ticket => {
            const eventId = ticket.event_id;
            if (!ticketGroups[eventId]) {
                ticketGroups[eventId] = {
                    event: events.find(e => e.id === eventId),
                    tickets: []
                };
            }
            ticketGroups[eventId].tickets.push(ticket);
        });

        const ticketGroupsHtml = Object.values(ticketGroups).map(group => {
            const event = group.event || {};
            const eventTickets = group.tickets;
            
            return `
                <div style="background: #f9fafb; border-radius: 12px; padding: 20px; margin-bottom: 20px; border: 2px solid #e5e7eb;">
                    <h3 style="margin: 0 0 10px 0; color: #111827; font-size: 18px;">${event.title || 'Event'}</h3>
                    <p style="margin: 0 0 15px 0; color: #6b7280; font-size: 14px;">
                        📅 ${event.date ? new Date(event.date).toLocaleDateString('en-US', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' }) : 'Date TBA'}
                    </p>
                    ${eventTickets.map(t => `
                        <div style="border: 1px solid #e5e7eb; padding: 12px; margin-bottom: 8px; border-radius: 8px; background: white;">
                            <p style="margin: 0; color: #111827; font-weight: bold;">${t.attendee_name || 'Guest'}</p>
                            <p style="margin: 4px 0 0 0; font-family: monospace; color: #9ca3af; font-size: 12px;">Ticket ID: ${t.id}</p>
                        </div>
                    `).join('')}
                </div>
            `;
        }).join('');

        const htmlBody = `
            <div style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; max-width: 600px; margin: 0 auto; background: #ffffff;">
                <!-- Header -->
                <div style="background: linear-gradient(135deg, #ec4899 0%, #8b5cf6 100%); padding: 40px 30px; text-align: center; border-radius: 12px 12px 0 0;">
                    <div style="font-size: 48px; margin-bottom: 10px;">🎟️</div>
                    <h1 style="color: white; margin: 0; font-size: 28px;">Your Tickets</h1>
                </div>

                <!-- Body -->
                <div style="padding: 30px; background: #ffffff;">
                    <p style="font-size: 16px; color: #374151; line-height: 1.6;">
                        Hi there! 👋
                    </p>
                    <p style="font-size: 16px; color: #374151; line-height: 1.6;">
                        You requested access to your tickets. Here are all your upcoming events:
                    </p>

                    <!-- Tickets -->
                    ${ticketGroupsHtml}

                    <!-- CTA -->
                    <div style="text-align: center; margin: 30px 0;">
                        <a href="${process.env.FRONTEND_URL || 'https://openticket.events'}/#/my-tickets" style="display: inline-block; background: linear-gradient(135deg, #ec4899 0%, #8b5cf6 100%); color: white; padding: 14px 32px; border-radius: 50px; text-decoration: none; font-weight: bold; font-size: 16px;">
                            View All My Tickets →
                        </a>
                    </div>

                    <p style="font-size: 14px; color: #6b7280; line-height: 1.6; margin-top: 30px;">
                        💡 <strong>Tip:</strong> Save this email or take a screenshot of your ticket IDs. You can show them at the entrance!
                    </p>
                </div>

                <!-- Footer -->
                <div style="background: #f9fafb; padding: 20px 30px; text-align: center; border-radius: 0 0 12px 12px; border-top: 1px solid #e5e7eb;">
                    <p style="margin: 0; font-size: 12px; color: #9ca3af;">
                        OpenTicket · Your tickets, delivered
                    </p>
                </div>
            </div>
        `;

        return await sendEmailViaResend(to, subject, htmlBody);
    }
};
