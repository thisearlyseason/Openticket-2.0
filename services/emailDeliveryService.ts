/**
 * Email Delivery Service - Unified email sending with provider selection
 * 
 * PROVIDERS:
 * 1. Gmail - Organizer's connected Gmail account (requires OAuth)
 * 2. OpenTicket Mailing Service - Platform's Mailerlite integration
 * 
 * RULES:
 * - Only one provider can be active at a time
 * - Gmail selection requires Gmail to be connected
 * - No automatic fallback between providers
 * - Display currency is UI-only and doesn't affect payments
 * 
 * LIMITS:
 * - Gmail (Standard): 500 emails/day
 * - Gmail (Google Workspace): 2,000 emails/day
 * - OpenTicket Mailing Service: Depends on Mailerlite plan
 */

import { EmailService } from './emailService';
import { mailerliteService } from './mailerliteService';
import { StorageService } from './storageService';

export type EmailProvider = 'gmail' | 'openticket_mailer';

export interface EmailDeliveryConfig {
    provider: EmailProvider;
    gmailConnected: boolean;
    gmailEmail?: string;
}

export interface SendEmailOptions {
    to: string;
    subject: string;
    htmlContent: string;
    textContent?: string;
    userId: string;
}

export interface EmailDeliveryResult {
    success: boolean;
    provider: EmailProvider;
    messageId?: string;
    error?: string;
}

// Gmail daily limits
export const GMAIL_LIMITS = {
    standard: {
        daily: 500,
        description: 'Standard Gmail accounts are limited to 500 emails per day'
    },
    workspace: {
        daily: 2000,
        description: 'Google Workspace accounts can send up to 2,000 emails per day'
    }
};

class EmailDeliveryService {
    /**
     * Get the current email provider configuration for a user
     */
    async getConfig(userId: string): Promise<EmailDeliveryConfig> {
        const user = await StorageService.getUserById(userId);
        
        return {
            provider: user?.emailProvider || 'openticket_mailer',
            gmailConnected: user?.gmailConfig?.connected || false,
            gmailEmail: user?.gmailConfig?.email
        };
    }

    /**
     * Set the email provider for a user
     * @throws Error if trying to set Gmail without connection
     */
    async setProvider(userId: string, provider: EmailProvider): Promise<boolean> {
        const user = await StorageService.getUserById(userId);
        
        if (!user) {
            throw new Error('User not found');
        }

        // Validate Gmail selection
        if (provider === 'gmail') {
            if (!user.gmailConfig?.connected) {
                throw new Error('Gmail must be connected before selecting it as email provider');
            }
        }

        // Update user's email provider
        await StorageService.updateUser(userId, {
            emailProvider: provider,
            gmailConnected: user.gmailConfig?.connected || false
        });

        return true;
    }

    /**
     * Send an email using the user's selected provider
     * NO FALLBACK - If selected provider fails, the send fails
     */
    async sendEmail(options: SendEmailOptions): Promise<EmailDeliveryResult> {
        const config = await this.getConfig(options.userId);
        
        // Route to the correct provider
        if (config.provider === 'gmail') {
            return this.sendViaGmail(options);
        } else {
            return this.sendViaOpenTicket(options);
        }
    }

    /**
     * Send email via Gmail (user's connected account)
     */
    private async sendViaGmail(options: SendEmailOptions): Promise<EmailDeliveryResult> {
        try {
            // Check if Gmail token exists in session
            const token = sessionStorage.getItem(`gmail_token_${options.userId}`);
            
            if (!token) {
                return {
                    success: false,
                    provider: 'gmail',
                    error: 'Gmail session expired. Please reconnect Gmail in Settings.'
                };
            }

            // Use the existing EmailService to send via Gmail
            const result = await EmailService.sendEmail(
                options.userId,
                options.to,
                options.subject,
                options.htmlContent
            );

            return {
                success: true,
                provider: 'gmail',
                messageId: result?.id
            };
        } catch (error: any) {
            return {
                success: false,
                provider: 'gmail',
                error: error.message || 'Failed to send via Gmail'
            };
        }
    }

    /**
     * Send email via OpenTicket Mailing Service (Mailerlite)
     */
    private async sendViaOpenTicket(options: SendEmailOptions): Promise<EmailDeliveryResult> {
        try {
            // Check if Mailerlite is configured
            const apiKey = localStorage.getItem('platform_mailerlite_key');
            
            if (!apiKey) {
                // Fallback to backend email service if Mailerlite not configured
                return this.sendViaBackend(options);
            }

            // Configure Mailerlite if not already done
            if (!mailerliteService.isReady()) {
                mailerliteService.configure(apiKey);
            }

            // For transactional emails, we'll use the backend service
            // Mailerlite is better suited for campaign emails
            return this.sendViaBackend(options);
        } catch (error: any) {
            return {
                success: false,
                provider: 'openticket_mailer',
                error: error.message || 'Failed to send via OpenTicket Mailing Service'
            };
        }
    }

    /**
     * Send via backend email service (Nodemailer)
     * This is used for transactional emails when using OpenTicket Mailing Service
     */
    private async sendViaBackend(options: SendEmailOptions): Promise<EmailDeliveryResult> {
        try {
            const response = await fetch('/api/email/send', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({
                    to: options.to,
                    subject: options.subject,
                    html: options.htmlContent,
                    text: options.textContent
                })
            });

            const result = await response.json();

            if (!response.ok) {
                return {
                    success: false,
                    provider: 'openticket_mailer',
                    error: result.error || 'Failed to send email'
                };
            }

            return {
                success: true,
                provider: 'openticket_mailer',
                messageId: result.messageId
            };
        } catch (error: any) {
            return {
                success: false,
                provider: 'openticket_mailer',
                error: error.message || 'Failed to send via OpenTicket backend'
            };
        }
    }

    /**
     * Check if user can send emails with current configuration
     */
    async canSendEmails(userId: string): Promise<{ canSend: boolean; reason?: string }> {
        const config = await this.getConfig(userId);

        if (config.provider === 'gmail') {
            // Check Gmail connection
            if (!config.gmailConnected) {
                return {
                    canSend: false,
                    reason: 'Gmail is selected but not connected. Please connect Gmail or switch to OpenTicket Mailing Service.'
                };
            }

            // Check session token
            const token = sessionStorage.getItem(`gmail_token_${userId}`);
            if (!token) {
                return {
                    canSend: false,
                    reason: 'Gmail session expired. Please reconnect Gmail in Settings.'
                };
            }

            return { canSend: true };
        }

        // OpenTicket Mailing Service is always available
        return { canSend: true };
    }

    /**
     * Get provider display info
     */
    getProviderInfo(provider: EmailProvider): { name: string; description: string; icon: string } {
        if (provider === 'gmail') {
            return {
                name: 'Gmail',
                description: 'Send emails from your connected Gmail account',
                icon: '📧'
            };
        }

        return {
            name: 'OpenTicket Mailing Service',
            description: 'Send emails via OpenTicket\'s reliable email infrastructure',
            icon: '🎟️'
        };
    }
}

// Export singleton instance
export const emailDeliveryService = new EmailDeliveryService();
export default emailDeliveryService;
