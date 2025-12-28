import { auth } from './firebaseConfig';
import { signInWithPopup, GoogleAuthProvider } from 'firebase/auth';
import { User, EmailTemplate } from '../types';
import { StorageService } from './storageService';

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

    // Send Email using Gmail API
    sendEmail: async (userId: string, to: string, subject: string, body: string) => {
        // Retrieve token
        const token = sessionStorage.getItem(`gmail_token_${userId}`);
        if (!token) {
            // If missing, we might need to re-auth.
            // For now, throw error.
            throw new Error("Gmail Disconnected or Session Expired. Please Re-connect Gmail in Settings.");
        }

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
            throw new Error(err.error?.message || "Failed to send email");
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
