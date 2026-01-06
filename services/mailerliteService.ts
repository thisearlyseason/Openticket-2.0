/**
 * Mailerlite Email Marketing Service
 * Handles email campaigns, subscribers, and automations via Mailerlite API
 */

const MAILERLITE_API_BASE = 'https://connect.mailerlite.com/api';

/**
 * Campaign types for email marketing
 */
export const CampaignTypes = {
    PRE_EVENT_REMINDER: 'pre_event_reminder',
    POST_EVENT_FOLLOWUP: 'post_event_followup',
    ABANDONED_CART: 'abandoned_cart',
    NEWSLETTER: 'newsletter',
    ANNOUNCEMENT: 'announcement'
};

/**
 * Email template interface
 */
interface EmailTemplate {
    subject: string;
    htmlContent: string;
    textContent?: string;
}

/**
 * Subscriber interface
 */
interface Subscriber {
    email: string;
    name?: string;
    fields?: Record<string, string>;
    groups?: string[];
}

/**
 * Campaign interface
 */
interface Campaign {
    name: string;
    type: string;
    subject: string;
    content: {
        html: string;
        plain?: string;
    };
    groups?: string[];
}

class MailerliteService {
    private apiKey: string | null = null;
    private isConfigured: boolean = false;

    /**
     * Configure the service with API key
     */
    configure(apiKey: string) {
        this.apiKey = apiKey;
        this.isConfigured = !!apiKey;
        console.log('[Mailerlite] Service configured');
    }

    /**
     * Check if service is configured
     */
    isReady(): boolean {
        return this.isConfigured && !!this.apiKey;
    }

    /**
     * Make API request to Mailerlite
     */
    private async request<T>(
        endpoint: string,
        method: 'GET' | 'POST' | 'PUT' | 'DELETE' = 'GET',
        data?: any
    ): Promise<T> {
        if (!this.apiKey) {
            throw new Error('Mailerlite API key not configured');
        }

        const response = await fetch(`${MAILERLITE_API_BASE}${endpoint}`, {
            method,
            headers: {
                'Authorization': `Bearer ${this.apiKey}`,
                'Content-Type': 'application/json',
                'Accept': 'application/json'
            },
            body: data ? JSON.stringify(data) : undefined
        });

        if (!response.ok) {
            const error = await response.json().catch(() => ({ message: 'Unknown error' }));
            throw new Error(error.message || `Mailerlite API error: ${response.status}`);
        }

        return response.json();
    }

    /**
     * Test API connection
     */
    async testConnection(): Promise<boolean> {
        try {
            await this.request('/subscribers?limit=1');
            return true;
        } catch (error) {
            console.error('[Mailerlite] Connection test failed:', error);
            return false;
        }
    }

    // ==================== SUBSCRIBERS ====================

    /**
     * Add a subscriber
     */
    async addSubscriber(subscriber: Subscriber): Promise<any> {
        return this.request('/subscribers', 'POST', {
            email: subscriber.email,
            fields: {
                name: subscriber.name || '',
                ...subscriber.fields
            },
            groups: subscriber.groups || []
        });
    }

    /**
     * Update a subscriber
     */
    async updateSubscriber(email: string, data: Partial<Subscriber>): Promise<any> {
        return this.request(`/subscribers/${email}`, 'PUT', {
            fields: data.fields,
            groups: data.groups
        });
    }

    /**
     * Get subscriber by email
     */
    async getSubscriber(email: string): Promise<any> {
        try {
            return await this.request(`/subscribers/${email}`);
        } catch {
            return null;
        }
    }

    /**
     * Remove subscriber from all lists
     */
    async removeSubscriber(email: string): Promise<void> {
        await this.request(`/subscribers/${email}`, 'DELETE');
    }

    /**
     * Bulk add subscribers
     */
    async bulkAddSubscribers(subscribers: Subscriber[], groupId?: string): Promise<any> {
        const data = {
            subscribers: subscribers.map(s => ({
                email: s.email,
                fields: { name: s.name || '', ...s.fields }
            })),
            groups: groupId ? [groupId] : []
        };

        return this.request('/subscribers/import', 'POST', data);
    }

    // ==================== GROUPS ====================

    /**
     * Create a group (list)
     */
    async createGroup(name: string): Promise<any> {
        return this.request('/groups', 'POST', { name });
    }

    /**
     * Get all groups
     */
    async getGroups(): Promise<any> {
        return this.request('/groups?limit=100');
    }

    /**
     * Get group by ID
     */
    async getGroup(groupId: string): Promise<any> {
        return this.request(`/groups/${groupId}`);
    }

    /**
     * Add subscribers to a group
     */
    async addToGroup(groupId: string, emails: string[]): Promise<any> {
        return this.request(`/groups/${groupId}/subscribers`, 'POST', {
            subscribers: emails.map(email => ({ email }))
        });
    }

    // ==================== CAMPAIGNS ====================

    /**
     * Create a campaign
     */
    async createCampaign(campaign: Campaign): Promise<any> {
        return this.request('/campaigns', 'POST', {
            name: campaign.name,
            type: 'regular',
            emails: [{
                subject: campaign.subject,
                from_name: 'OpenTicket',
                content: campaign.content.html
            }],
            groups: campaign.groups || []
        });
    }

    /**
     * Send a campaign immediately
     */
    async sendCampaign(campaignId: string): Promise<any> {
        return this.request(`/campaigns/${campaignId}/actions/send`, 'POST');
    }

    /**
     * Schedule a campaign
     */
    async scheduleCampaign(campaignId: string, scheduledAt: Date): Promise<any> {
        return this.request(`/campaigns/${campaignId}/actions/schedule`, 'POST', {
            delivery: 'scheduled',
            scheduled_for: scheduledAt.toISOString()
        });
    }

    /**
     * Get campaign statistics
     */
    async getCampaignStats(campaignId: string): Promise<any> {
        return this.request(`/campaigns/${campaignId}`);
    }

    // ==================== EMAIL TEMPLATES ====================

    /**
     * Pre-event reminder email template
     */
    getPreEventReminderTemplate(eventTitle: string, eventDate: string, eventLocation: string, ticketUrl: string): EmailTemplate {
        return {
            subject: `🎟️ Reminder: ${eventTitle} is coming up!`,
            htmlContent: `
<!DOCTYPE html>
<html>
<head>
    <meta charset="utf-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
</head>
<body style="margin: 0; padding: 0; background-color: #f4f4f5; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;">
    <div style="max-width: 600px; margin: 0 auto; padding: 40px 20px;">
        <div style="background: linear-gradient(135deg, #ec4899, #f472b6); border-radius: 16px 16px 0 0; padding: 40px; text-align: center;">
            <h1 style="color: white; margin: 0; font-size: 28px;">🎉 Get Ready!</h1>
        </div>
        <div style="background: white; padding: 40px; border-radius: 0 0 16px 16px;">
            <p style="font-size: 18px; color: #18181b; margin-bottom: 24px;">
                <strong>${eventTitle}</strong> is happening soon!
            </p>
            <div style="background: #f4f4f5; border-radius: 12px; padding: 24px; margin-bottom: 24px;">
                <p style="margin: 0 0 8px 0; color: #71717a; font-size: 14px;">📅 Date & Time</p>
                <p style="margin: 0 0 16px 0; color: #18181b; font-weight: 600;">${eventDate}</p>
                <p style="margin: 0 0 8px 0; color: #71717a; font-size: 14px;">📍 Location</p>
                <p style="margin: 0; color: #18181b; font-weight: 600;">${eventLocation}</p>
            </div>
            <a href="${ticketUrl}" style="display: block; background: #ec4899; color: white; text-decoration: none; padding: 16px 32px; border-radius: 12px; font-weight: 600; text-align: center; margin-bottom: 24px;">
                View Your Ticket
            </a>
            <p style="color: #71717a; font-size: 14px; text-align: center;">
                See you there! 🎟️
            </p>
        </div>
    </div>
</body>
</html>`,
            textContent: `Get Ready! ${eventTitle} is happening on ${eventDate} at ${eventLocation}. View your ticket: ${ticketUrl}`
        };
    }

    /**
     * Post-event follow-up email template
     */
    getPostEventFollowupTemplate(eventTitle: string, feedbackUrl?: string): EmailTemplate {
        return {
            subject: `Thank you for attending ${eventTitle}! 🙏`,
            htmlContent: `
<!DOCTYPE html>
<html>
<head>
    <meta charset="utf-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
</head>
<body style="margin: 0; padding: 0; background-color: #f4f4f5; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;">
    <div style="max-width: 600px; margin: 0 auto; padding: 40px 20px;">
        <div style="background: linear-gradient(135deg, #10b981, #34d399); border-radius: 16px 16px 0 0; padding: 40px; text-align: center;">
            <h1 style="color: white; margin: 0; font-size: 28px;">Thank You! 🎉</h1>
        </div>
        <div style="background: white; padding: 40px; border-radius: 0 0 16px 16px;">
            <p style="font-size: 18px; color: #18181b; margin-bottom: 24px;">
                We hope you had an amazing time at <strong>${eventTitle}</strong>!
            </p>
            <p style="color: #52525b; margin-bottom: 24px;">
                Your support means the world to us. We'd love to hear about your experience.
            </p>
            ${feedbackUrl ? `
            <a href="${feedbackUrl}" style="display: block; background: #10b981; color: white; text-decoration: none; padding: 16px 32px; border-radius: 12px; font-weight: 600; text-align: center; margin-bottom: 24px;">
                Share Your Feedback
            </a>
            ` : ''}
            <p style="color: #71717a; font-size: 14px; text-align: center;">
                Hope to see you at our next event! 💫
            </p>
        </div>
    </div>
</body>
</html>`,
            textContent: `Thank you for attending ${eventTitle}! We hope you had an amazing time.`
        };
    }

    /**
     * Abandoned cart email template
     */
    getAbandonedCartTemplate(eventTitle: string, checkoutUrl: string): EmailTemplate {
        return {
            subject: `🎟️ You left something behind - ${eventTitle}`,
            htmlContent: `
<!DOCTYPE html>
<html>
<head>
    <meta charset="utf-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
</head>
<body style="margin: 0; padding: 0; background-color: #f4f4f5; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;">
    <div style="max-width: 600px; margin: 0 auto; padding: 40px 20px;">
        <div style="background: linear-gradient(135deg, #f59e0b, #fbbf24); border-radius: 16px 16px 0 0; padding: 40px; text-align: center;">
            <h1 style="color: white; margin: 0; font-size: 28px;">Don't Miss Out! 🎟️</h1>
        </div>
        <div style="background: white; padding: 40px; border-radius: 0 0 16px 16px;">
            <p style="font-size: 18px; color: #18181b; margin-bottom: 24px;">
                Your tickets for <strong>${eventTitle}</strong> are waiting for you!
            </p>
            <p style="color: #52525b; margin-bottom: 24px;">
                We noticed you didn't complete your purchase. Tickets are selling fast - secure yours before they're gone!
            </p>
            <a href="${checkoutUrl}" style="display: block; background: #f59e0b; color: white; text-decoration: none; padding: 16px 32px; border-radius: 12px; font-weight: 600; text-align: center; margin-bottom: 24px;">
                Complete Your Purchase
            </a>
            <p style="color: #71717a; font-size: 14px; text-align: center;">
                Questions? Reply to this email and we'll help you out.
            </p>
        </div>
    </div>
</body>
</html>`,
            textContent: `Don't miss out! Your tickets for ${eventTitle} are waiting. Complete your purchase: ${checkoutUrl}`
        };
    }

    /**
     * Newsletter/announcement email template
     */
    getNewsletterTemplate(title: string, content: string, ctaText?: string, ctaUrl?: string): EmailTemplate {
        return {
            subject: title,
            htmlContent: `
<!DOCTYPE html>
<html>
<head>
    <meta charset="utf-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
</head>
<body style="margin: 0; padding: 0; background-color: #f4f4f5; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;">
    <div style="max-width: 600px; margin: 0 auto; padding: 40px 20px;">
        <div style="background: linear-gradient(135deg, #ec4899, #8b5cf6); border-radius: 16px 16px 0 0; padding: 40px; text-align: center;">
            <h1 style="color: white; margin: 0; font-size: 24px;">${title}</h1>
        </div>
        <div style="background: white; padding: 40px; border-radius: 0 0 16px 16px;">
            <div style="color: #18181b; font-size: 16px; line-height: 1.6;">
                ${content}
            </div>
            ${ctaText && ctaUrl ? `
            <a href="${ctaUrl}" style="display: block; background: #ec4899; color: white; text-decoration: none; padding: 16px 32px; border-radius: 12px; font-weight: 600; text-align: center; margin-top: 24px;">
                ${ctaText}
            </a>
            ` : ''}
        </div>
    </div>
</body>
</html>`,
            textContent: content.replace(/<[^>]*>/g, '')
        };
    }
}

// Export singleton instance
export const mailerliteService = new MailerliteService();
export default mailerliteService;
