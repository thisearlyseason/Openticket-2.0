import { auth } from './firebaseConfig';
import { signInWithPopup, GoogleAuthProvider } from 'firebase/auth';
import { User, EmailTemplate } from '../types';
import { StorageService } from './storageService';

// Backend API base - use relative path for production
const isProduction = import.meta.env.PROD || window.location.hostname !== 'localhost' && window.location.hostname !== '127.0.0.1';
const API_BASE = isProduction ? '/api' : (import.meta.env.VITE_API_URL || '/api');

// Specific provider for Gmail Scopes
const gmailProvider = new GoogleAuthProvider();
gmailProvider.addScope('https://www.googleapis.com/auth/gmail.send');
gmailProvider.addScope('https://www.googleapis.com/auth/userinfo.email');

export const EmailService = {
    // Authenticate with Gmail and store status (and token in memory/sessionStorage for this audit)
    connectGmail: async (userId: string): Promise<string> => {
        try {
            // Force re-consent to ensure we get a refresh token if needed (though client-side we mostly use access token)
            gmailProvider.setCustomParameters({
                prompt: 'consent',
                access_type: 'offline'
            });

            const result = await signInWithPopup(auth, gmailProvider);
            const credential = GoogleAuthProvider.credentialFromResult(result);
            const token = credential?.accessToken;
            const user = result.user;

            if (!token) throw new Error("No access token returned");

            // Store token in Session Storage for immediate usage (Security: Cleared on tab close)
            // In production, you'd send the authorizationCode to a backend to exchange for a Refresh Token and store encrypted.
            sessionStorage.setItem(`gmail_token_${userId}`, token);

            // Update User Profile via StorageService (Backend)
            await StorageService.updateUser(userId, {
                gmailConfig: {
                    connected: true,
                    email: user.email || 'connected',
                    lastSynced: Date.now()
                }
            });

            return user.email || 'Connected';
        } catch (error: any) {
            console.error("Gmail Connect Error:", error);
            throw error;
        }
    },

    disconnectGmail: async (userId: string) => {
        await StorageService.updateUser(userId, {
            gmailConfig: {
                connected: false,
                email: null,
                lastSynced: Date.now()
            }
        });
        sessionStorage.removeItem(`gmail_token_${userId}`);
    },

    // Check if Gmail is connected and has a valid token
    isGmailConnected: (userId: string): boolean => {
        const token = sessionStorage.getItem(`gmail_token_${userId}`);
        return !!token;
    },

    // Send Email - tries Gmail first if connected, falls back to Resend
    sendEmail: async (userId: string, to: string, subject: string, body: string) => {
        // Check if Gmail is connected
        const gmailToken = sessionStorage.getItem(`gmail_token_${userId}`);
        
        if (gmailToken) {
            // Try Gmail first
            try {
                return await EmailService.sendViaGmail(gmailToken, to, subject, body);
            } catch (gmailError: any) {
                console.warn("[EmailService] Gmail send failed, falling back to Resend:", gmailError.message);
                // If Gmail fails (token expired, etc.), fall back to Resend
            }
        }
        
        // Use Resend (backend) as fallback or default
        return await EmailService.sendViaResend(to, subject, body);
    },

    // Send via Gmail API (requires connected Gmail)
    sendViaGmail: async (token: string, to: string, subject: string, body: string) => {
        // Construct raw email
        const utf8Subject = `=?utf-8?B?${btoa(subject)}?=`;
        const messageParts = [
            `From: me`,
            `To: ${to}`,
            `Subject: ${utf8Subject}`,
            `Content-Type: text/html; charset=utf-8`,
            `MIME-Version: 1.0`,
            ``,
            body
        ];
        const message = messageParts.join('\n');
        const encodedMessage = btoa(message).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');

        // Call Gmail API
        const response = await fetch('https://gmail.googleapis.com/gmail/v1/users/me/messages/send', {
            method: 'POST',
            headers: {
                'Authorization': `Bearer ${token}`,
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({
                raw: encodedMessage
            })
        });

        if (!response.ok) {
            const err = await response.json();
            throw new Error(err.error?.message || "Failed to send via Gmail");
        }

        return await response.json();
    },

    // Send via Resend (backend service)
    sendViaResend: async (to: string, subject: string, body: string) => {
        const response = await fetch(`${API_BASE}/email/send`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({
                to,
                subject,
                html: body,
                provider: 'resend'
            })
        });

        if (!response.ok) {
            const err = await response.json();
            throw new Error(err.error || "Failed to send email via Resend");
        }

        return await response.json();
    },

    // Template Management
    saveTemplate: async (userId: string, template: EmailTemplate) => {
        const user = await StorageService.getUserById(userId);
        if (user) {
            const templates = user.emailTemplates || [];
            const existingIdx = templates.findIndex(t => t.id === template.id);

            let newTemplates = [...templates];
            if (existingIdx >= 0) {
                newTemplates[existingIdx] = template;
            } else {
                newTemplates.push(template);
            }

            await StorageService.updateUser(userId, { emailTemplates: newTemplates });
        }
    },

    deleteTemplate: async (userId: string, templateId: string) => {
        const user = await StorageService.getUserById(userId);
        if (user) {
            const templates = user.emailTemplates || [];
            const newTemplates = templates.filter(t => t.id !== templateId);
            await StorageService.updateUser(userId, { emailTemplates: newTemplates });
        }
    },

    // Helper to replace tokens and clean up unused ones
    renderTemplate: (body: string, data: Record<string, string>) => {
        let result = body;
        // Replace known keys
        Object.keys(data).forEach(key => {
            const regex = new RegExp(`{{${key}}}`, 'g');
            result = result.replace(regex, data[key]);
        });
        // Remove remaining tokens (e.g. {{price}} if not provided)
        result = result.replace(/{{.*?}}/g, '');
        return result;
    }
};
