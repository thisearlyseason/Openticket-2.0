import nodemailer from 'nodemailer';

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
    } else {
        console.warn("[EmailService] Missing credentials - Emails disabled.");
    }
} catch (e) {
    console.warn("[EmailService] Init Failed:", e.message);
}

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
    },

    /**
     * Send subscription welcome email when user upgrades their plan
     */
    sendSubscriptionWelcome: async (to, planName, cycle, userName) => {
        if (!process.env.EMAIL_USER || !process.env.EMAIL_APP_PASSWORD) {
            console.warn("[EmailService] Missing Credentials. Email simulation only.");
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

        try {
            const info = await transporter.sendMail({
                from: `"OpenTicket" <${process.env.EMAIL_USER}>`,
                to,
                subject,
                html: htmlBody
            });
            console.log(`[EmailService] Subscription Welcome Sent: ${info.messageId} to ${to}`);
            return { sent: true, messageId: info.messageId };
        } catch (error) {
            console.error("[EmailService] Subscription Welcome Failed:", error);
            return { sent: false, error: error.message };
        }
    },

    /**
     * Send subscription cancellation/downgrade email
     */
    sendSubscriptionCancellation: async (to, oldPlan, newPlan, userName, effectiveDate) => {
        if (!process.env.EMAIL_USER || !process.env.EMAIL_APP_PASSWORD) {
            console.warn("[EmailService] Missing Credentials. Email simulation only.");
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

        try {
            const info = await transporter.sendMail({
                from: `"OpenTicket" <${process.env.EMAIL_USER}>`,
                to,
                subject,
                html: htmlBody
            });
            console.log(`[EmailService] Subscription Cancellation Sent: ${info.messageId} to ${to}`);
            return { sent: true, messageId: info.messageId };
        } catch (error) {
            console.error("[EmailService] Subscription Cancellation Failed:", error);
            return { sent: false, error: error.message };
        }
    },

    /**
     * Send affiliate conversion notification when someone signs up with their code
     */
    sendAffiliateConversionNotification: async (to, affiliateName, customerName, eventTitle, orderAmount, commission) => {
        if (!process.env.EMAIL_USER || !process.env.EMAIL_APP_PASSWORD) {
            console.warn("[EmailService] Missing Credentials. Email simulation only.");
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

        try {
            const info = await transporter.sendMail({
                from: `"OpenTicket Affiliates" <${process.env.EMAIL_USER}>`,
                to,
                subject,
                html: htmlBody
            });
            console.log(`[EmailService] Affiliate Conversion Sent: ${info.messageId} to ${to}`);
            return { sent: true, messageId: info.messageId };
        } catch (error) {
            console.error("[EmailService] Affiliate Conversion Failed:", error);
            return { sent: false, error: error.message };
        }
    }
};
