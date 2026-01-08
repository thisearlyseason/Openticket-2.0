
import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useGlobalUI } from './GlobalUIProvider';
import { StorageService } from '../services/storageService';
import { EmailService } from '../services/emailService';
import { User, EmailTemplate, Socials, CustomFee } from '../types';
import { Button, Input, Card, Switch, FileDropZone, Badge, RichTextarea } from './UI';
import { User as UserIcon, Settings as SettingsIcon, LogOut, Camera, Bell, ChevronRight, Palette, CreditCard, Shield, Mail, CheckCircle, XCircle, Plus, Trash2, LayoutTemplate, Globe, Instagram, Facebook, Twitter, Youtube, Smartphone, Gift, DollarSign, AlertCircle, Eye, Send } from 'lucide-react';
import { NotificationSettings } from './NotificationSettings';

export const Settings = () => {
    const navigate = useNavigate();
    const [user, setUser] = useState<User | null>(null);
    const [activeTab, setActiveTab] = useState<'profile' | 'branding' | 'preferences' | 'organizer' | 'email' | 'page'>('profile');

    // Profile State
    const [name, setName] = useState('');
    const [email, setEmail] = useState('');
    const [businessName, setBusinessName] = useState('');
    const [businessEmail, setBusinessEmail] = useState('');
    const [organizerSubtitle, setOrganizerSubtitle] = useState('');
    const [useBusinessName, setUseBusinessName] = useState(false);
    const [logoUrl, setLogoUrl] = useState('');
    const [headerImageUrl, setHeaderImageUrl] = useState('');
    const [socials, setSocials] = useState<Socials>({});
    
    // New fields for organizer profile
    const [phone, setPhone] = useState('');
    const [businessPhone, setBusinessPhone] = useState('');
    const [showPhonePublicly, setShowPhonePublicly] = useState(false);
    const [bio, setBio] = useState('');

    // Branding State
    const [primaryColor, setPrimaryColor] = useState('#E0FF20');

    // Organizer Defaults
    const [defaultRefundPolicy, setDefaultRefundPolicy] = useState('');
    const [defaultRefundPolicyEnabled, setDefaultRefundPolicyEnabled] = useState(false);
    const [defaultWaiver, setDefaultWaiver] = useState<{ enabled?: boolean, text?: string, pdfUrl?: string, fileName?: string }>({});
    const [defaultTaxRate, setDefaultTaxRate] = useState<number>(0);
    const [defaultCustomFees, setDefaultCustomFees] = useState<CustomFee[]>([]);
    const [defaultCurrency, setDefaultCurrency] = useState<string>('USD');

    // Email Marketing State
    const [gmailConfig, setGmailConfig] = useState<{ connected: boolean, email?: string, lastSynced?: number }>({ connected: false });
    const [emailProvider, setEmailProvider] = useState<'gmail' | 'resend'>('resend');
    const [emailTemplates, setEmailTemplates] = useState<EmailTemplate[]>([]);
    const [editingTemplate, setEditingTemplate] = useState<EmailTemplate | null>(null);
    const [isConnectingGmail, setIsConnectingGmail] = useState(false);
    const [sendingTestId, setSendingTestId] = useState<string | null>(null);

    // Preferences State
    const [desktopCamera, setDesktopCamera] = useState(false);
    const [notifications, setNotifications] = useState({ newOrder: true, reminder: true });
    const [geminiApiKey, setGeminiApiKey] = useState('');
    const { showToast, showConfirm, showAlert } = useGlobalUI();

    const [isSaving, setIsSaving] = useState(false);

    // Password Change State
    const [showPasswordChange, setShowPasswordChange] = useState(false);
    const [currentPassword, setCurrentPassword] = useState('');
    const [newPassword, setNewPassword] = useState('');
    const [confirmPassword, setConfirmPassword] = useState('');
    const [isChangingPassword, setIsChangingPassword] = useState(false);
    const [showCurrentPw, setShowCurrentPw] = useState(false);
    const [showNewPw, setShowNewPw] = useState(false);

    useEffect(() => {
        const loadUserData = async () => {
            const currentUser = StorageService.getCurrentUser();
            if (currentUser) {
                // Fetch fresh user data from server to ensure we have latest templates
                try {
                    const freshUser = await StorageService.getUserById(currentUser.id);
                    if (freshUser) {
                        setUser(freshUser);
                        setName(freshUser.name || '');
                        setEmail(freshUser.email || '');
                        setLogoUrl(freshUser.logoUrl || '');
                        setHeaderImageUrl(freshUser.headerImageUrl || '');
                        setBusinessName(freshUser.businessName || '');
                        setBusinessEmail(freshUser.businessEmail || '');
                        setOrganizerSubtitle(freshUser.organizerSubtitle || '');
                        setUseBusinessName(freshUser.useBusinessName || false);
                        setSocials(freshUser.socials || {});
                        setPhone(freshUser.phone || '');
                        setBusinessPhone(freshUser.businessPhone || '');
                        setShowPhonePublicly(freshUser.showPhonePublicly || false);
                        setBio(freshUser.bio || '');
                        setPrimaryColor(freshUser.primaryColor || '#E0FF20');
                        setDefaultRefundPolicy(freshUser.defaultRefundPolicy || '');
                        setDefaultRefundPolicyEnabled(freshUser.defaultRefundPolicyEnabled || false);
                        setDefaultWaiver(freshUser.defaultWaiver || {});
                        setDefaultTaxRate(freshUser.defaultTaxRate || 0);
                        setDefaultCustomFees(freshUser.defaultCustomFees || []);
                        setDefaultCurrency(freshUser.defaultCurrency || 'USD');

                        // Email State - Load from fresh data
                        setGmailConfig(freshUser.gmailConfig || { connected: false });
                        setEmailProvider(freshUser.emailProvider || 'openticket_mailer');
                        setEmailTemplates(freshUser.emailTemplates || []);

                        // Load local preferences
                        const savedCamera = localStorage.getItem('openticket_desktop_camera') === 'true';
                        setDesktopCamera(savedCamera);

                        if (freshUser.notifications) {
                            setNotifications(freshUser.notifications);
                        }
                        setGeminiApiKey(freshUser.geminiApiKey || '');
                        return;
                    }
                } catch (e) {
                    console.warn("Failed to fetch fresh user data, using cached data:", e);
                }
                
                // Fallback to cached user if fetch fails
                setUser(currentUser);
                setName(currentUser.name || '');
                setEmail(currentUser.email || '');
                setLogoUrl(currentUser.logoUrl || '');
                setHeaderImageUrl(currentUser.headerImageUrl || '');
                setBusinessName(currentUser.businessName || '');
                setBusinessEmail(currentUser.businessEmail || '');
                setOrganizerSubtitle(currentUser.organizerSubtitle || '');
                setUseBusinessName(currentUser.useBusinessName || false);
                setSocials(currentUser.socials || {});
                setPhone(currentUser.phone || '');
                setBusinessPhone(currentUser.businessPhone || '');
                setShowPhonePublicly(currentUser.showPhonePublicly || false);
                setBio(currentUser.bio || '');
                setPrimaryColor(currentUser.primaryColor || '#E0FF20');
                setDefaultRefundPolicy(currentUser.defaultRefundPolicy || '');
                setDefaultRefundPolicyEnabled(currentUser.defaultRefundPolicyEnabled || false);
                setDefaultWaiver(currentUser.defaultWaiver || {});
                setDefaultTaxRate(currentUser.defaultTaxRate || 0);
                setDefaultCustomFees(currentUser.defaultCustomFees || []);
                setDefaultCurrency(currentUser.defaultCurrency || 'USD');

                // Email State
                setGmailConfig(currentUser.gmailConfig || { connected: false });
                setEmailProvider(currentUser.emailProvider || 'openticket_mailer');
                setEmailTemplates(currentUser.emailTemplates || []);

                // Load local preferences
                const savedCamera = localStorage.getItem('openticket_desktop_camera') === 'true';
                setDesktopCamera(savedCamera);

                if (currentUser.notifications) {
                    setNotifications(currentUser.notifications);
                }
                setGeminiApiKey(currentUser.geminiApiKey || '');
            }
        };
        
        loadUserData();
    }, []);

    const handleConnectGmail = async () => {
        if (!user) return;
        setIsConnectingGmail(true);
        try {
            const email = await EmailService.connectGmail(user.id);
            setGmailConfig({ connected: true, email: email, lastSynced: Date.now() });
            showToast("Gmail connected successfully!", "success");
        } catch (e: any) {
            showToast("Failed to connect Gmail: " + e.message, "error");
        } finally {
            setIsConnectingGmail(false);
        }
    };

    const handleDisconnectGmail = async () => {
        if (!user) return;
        showConfirm({
            title: "Disconnect Gmail",
            message: "Disconnect Gmail? You will no longer be able to send broadcasts.",
            confirmText: "Disconnect",
            variant: "danger",
            onConfirm: async () => {
                await EmailService.disconnectGmail(user.id);
                setGmailConfig({ connected: false });
                showToast("Gmail disconnected", "info");
            }
        });
    };

    const handleSaveTemplate = async (template: EmailTemplate) => {
        const updated = emailTemplates.some(t => t.id === template.id)
            ? emailTemplates.map(t => t.id === template.id ? template : t)
            : [...emailTemplates, template];

        setEmailTemplates(updated);
        setEditingTemplate(null);
        
        if (user) {
            try {
                await StorageService.updateUser(user.id, { emailTemplates: updated });
                // Update local user cache with new templates
                const updatedUser = { ...user, emailTemplates: updated };
                setUser(updatedUser);
                // Also update localStorage cache
                const cachedUser = StorageService.getCurrentUser();
                if (cachedUser) {
                    localStorage.setItem('openticket_user', JSON.stringify({ ...cachedUser, emailTemplates: updated }));
                }
                showToast("Template saved successfully!", "success");
            } catch (error: any) {
                console.error("Failed to save template:", error);
                showToast("Failed to save template. Please try again.", "error");
                // Revert on failure
                setEmailTemplates(emailTemplates);
            }
        }
    };

    const handleLoadDefaults = async () => {
        showConfirm({
            title: "Load Defaults",
            message: "Load default templates? This will add examples for Confirmation, Reminders, Follow-ups, and Abandoned Cart.",
            confirmText: "Load Templates",
            onConfirm: async () => {
                const defaults: EmailTemplate[] = [
                    {
                        id: `tmpl-def-1`,
                        type: 'confirmation',
                        name: 'Order Confirmation',
                        subject: '✅ Order Confirmed: {{event_title}}',
                        body: `<p>Hi {{attendee_name}},</p><p>Thank you for your order! We are excited to see you at <strong>{{event_title}}</strong>.</p><p><strong>Event Details:</strong><br>📅 Date: {{event_date}}<br>📍 Location: {{event_location}}</p><p>Your tickets are attached to this email. Please present the QR code at the entrance.</p><p>See you there! 🎉</p>`
                    },
                    {
                        id: `tmpl-def-2`,
                        type: 'reminder',
                        name: 'Pre-Event Reminder (24h)',
                        subject: '🎟️ Reminder: {{event_title}} is Tomorrow!',
                        body: `<p>Hi {{attendee_name}},</p><p>Just a quick reminder that <strong>{{event_title}}</strong> is happening tomorrow!</p><p><strong>When:</strong> {{event_date}}<br><strong>Where:</strong> {{event_location}}</p><p>Don't forget to bring your ticket (QR code) for smooth entry.</p><p>We look forward to hosting you! 🙌</p>`
                    },
                    {
                        id: `tmpl-def-3`,
                        type: 'reminder',
                        name: 'Pre-Event Reminder (1h)',
                        subject: '⏰ {{event_title}} starts in 1 hour!',
                        body: `<p>Hi {{attendee_name}},</p><p><strong>{{event_title}}</strong> is starting soon!</p><p>📍 <strong>Location:</strong> {{event_location}}</p><p>Make sure you have your QR code ready for entry. See you there!</p>`
                    },
                    {
                        id: `tmpl-def-4`,
                        type: 'broadcast',
                        name: 'Post-Event Thank You',
                        subject: '🙏 Thank you for attending {{event_title}}!',
                        body: `<p>Hi {{attendee_name}},</p><p>Thank you for joining us at <strong>{{event_title}}</strong>! We hope you had an amazing time.</p><p>We'd love to hear your feedback - it helps us improve future events.</p><p>Stay tuned for our upcoming events!</p><p>Best regards,<br>The Organizers</p>`
                    },
                    {
                        id: `tmpl-def-5`,
                        type: 'broadcast',
                        name: 'Abandoned Cart Recovery',
                        subject: '🎟️ You left something behind - {{event_title}}',
                        body: `<p>Hi there,</p><p>We noticed you started getting tickets for <strong>{{event_title}}</strong> but didn't complete your purchase.</p><p>Tickets are selling fast - don't miss out!</p><p>📅 {{event_date}}<br>📍 {{event_location}}</p><p><a href="#">Complete Your Purchase</a></p><p>Questions? Just reply to this email!</p>`
                    },
                    {
                        id: `tmpl-def-6`,
                        type: 'waitlist',
                        name: 'Waitlist Notification',
                        subject: '🎉 Tickets Available: {{event_title}}',
                        body: `<p>Great news, {{attendee_name}}!</p><p>Tickets are now available for <strong>{{event_title}}</strong>!</p><p>You were on the waitlist, so you get early access. Grab your tickets before they're gone!</p><p><a href="#">Get Tickets Now</a></p>`
                    }
                ];

                const updated = [...emailTemplates, ...defaults];
                setEmailTemplates(updated);
                if (user) {
                    try {
                        await StorageService.updateUser(user.id, { emailTemplates: updated });
                        // Update local cache
                        const cachedUser = StorageService.getCurrentUser();
                        if (cachedUser) {
                            localStorage.setItem('openticket_user', JSON.stringify({ ...cachedUser, emailTemplates: updated }));
                        }
                        showToast("Default templates loaded", "success");
                    } catch (error) {
                        console.error("Failed to load default templates:", error);
                        showToast("Failed to save default templates", "error");
                    }
                }
            }
        });
    };

    const handleDeleteTemplate = async (id: string) => {
        showConfirm({
            title: "Delete Template",
            message: "Are you sure you want to delete this template?",
            confirmText: "Delete",
            variant: "danger",
            onConfirm: async () => {
                const updated = emailTemplates.filter(t => t.id !== id);
                setEmailTemplates(updated);
                if (user) {
                    try {
                        await StorageService.updateUser(user.id, { emailTemplates: updated });
                        // Update local cache
                        const cachedUser = StorageService.getCurrentUser();
                        if (cachedUser) {
                            localStorage.setItem('openticket_user', JSON.stringify({ ...cachedUser, emailTemplates: updated }));
                        }
                        showToast("Template deleted", "info");
                    } catch (error) {
                        console.error("Failed to delete template:", error);
                        showToast("Failed to delete template", "error");
                        // Revert on failure
                        setEmailTemplates(emailTemplates);
                    }
                }
            }
        });
    };

    const handleSendTestEmail = async (template: EmailTemplate) => {
        if (!user?.email) {
            showToast("No email address found. Please update your profile.", "error");
            return;
        }

        setSendingTestId(template.id);
        try {
            // Use relative /api path which works with the proxy setup
            const response = await fetch(`/api/email/send-test`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({
                    to: user.email,
                    template: {
                        subject: template.subject,
                        body: template.body,
                        name: template.name,
                        type: template.type
                    }
                })
            });

            const data = await response.json();

            if (!response.ok) {
                throw new Error(data.error || 'Failed to send test email');
            }

            if (data.preview) {
                // Show preview mode message - email not actually sent
                showAlert({
                    title: "📧 Template Preview",
                    message: `Your template is ready! Here's how it will look:\n\n**To:** ${user.email}\n**Subject:** ${data.previewData?.subject || template.subject}\n\n✅ Template variables replaced with sample data\n✅ Ready to use in broadcasts and automated emails\n\nNote: Test emails require SMTP credentials to be configured. Your templates will work when sending real emails to attendees.`,
                    confirmText: "Got it!"
                });
            } else if (data.simulated) {
                showToast(`Email preview generated - ${data.message}`, "info");
            } else {
                showToast(`Test email sent to ${user.email}!`, "success");
            }
        } catch (error: any) {
            console.error("Failed to send test email:", error);
            showToast(error.message || "Failed to send test email", "error");
        } finally {
            setSendingTestId(null);
        }
    };

    const handleSave = async () => {
        if (!user) return;
        setIsSaving(true);
        try {
            // Helper to process uploads
            const processUpload = async (dataUrl: string | undefined, path: string) => {
                if (!dataUrl || !dataUrl.startsWith('data:')) return dataUrl;
                return await StorageService.uploadFile(dataUrl, path);
            };

            // Upload Logo
            const finalLogoUrl = await processUpload(logoUrl, `users/${user.id}/logo`);
            const finalHeaderImageUrl = await processUpload(headerImageUrl, `users/${user.id}/header`);

            // Upload Default Waiver PDF
            let finalDefaultWaiver = { ...defaultWaiver };
            if (defaultWaiver.pdfUrl?.startsWith('data:')) {
                const url = await processUpload(defaultWaiver.pdfUrl, `users/${user.id}/default_waiver.pdf`);
                finalDefaultWaiver.pdfUrl = url;
            }

            const updatedUser = await StorageService.updateUser(user.id, {
                name,
                businessName,
                businessEmail,
                organizerSubtitle,
                useBusinessName,
                phone,
                businessPhone,
                showPhonePublicly,
                bio,
                logoUrl: finalLogoUrl,
                primaryColor,
                notifications,
                defaultRefundPolicy,
                defaultRefundPolicyEnabled,
                defaultWaiver: finalDefaultWaiver,
                headerImageUrl: finalHeaderImageUrl,
                emailTemplates: emailTemplates,
                emailProvider: emailProvider,
                socials: socials,
                defaultTaxRate: Number(defaultTaxRate),
                defaultCustomFees: defaultCustomFees,
                defaultCurrency: defaultCurrency,
                geminiApiKey: geminiApiKey
            });

            if (updatedUser) {
                setUser(updatedUser);
                setLogoUrl(updatedUser.logoUrl || '');
                setHeaderImageUrl(updatedUser.headerImageUrl || '');
            }

            // Update CSS Variable immediately for preview
            document.documentElement.style.setProperty('--color-primary', primaryColor);

            // Save local preferences
            localStorage.setItem('openticket_desktop_camera', String(desktopCamera));

            showToast("Settings saved successfully!", "success");
        } catch (e: any) {
            console.error(e);
            showToast("Failed to save settings: " + e.message, "error");
        } finally {
            setIsSaving(false);
        }
    };

    // Password change handler
    const handleChangePassword = async () => {
        // Validation
        if (!currentPassword) {
            showToast("Please enter your current password", "error");
            return;
        }
        if (!newPassword) {
            showToast("Please enter a new password", "error");
            return;
        }
        if (newPassword !== confirmPassword) {
            showToast("New passwords don't match", "error");
            return;
        }
        
        // Password strength validation
        const passwordRegex = /^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[@$!%*?&])[A-Za-z\d@$!%*?&]{8,}$/;
        if (!passwordRegex.test(newPassword)) {
            showToast("Password must be at least 8 characters with uppercase, lowercase, number, and special character", "error");
            return;
        }

        setIsChangingPassword(true);
        try {
            // Import Firebase auth for re-authentication
            const { getAuth, reauthenticateWithCredential, EmailAuthProvider, updatePassword } = await import('firebase/auth');
            const auth = getAuth();
            const firebaseUser = auth.currentUser;

            if (!firebaseUser || !firebaseUser.email) {
                showToast("Not authenticated. Please log in again.", "error");
                return;
            }

            // Re-authenticate with current password
            const credential = EmailAuthProvider.credential(firebaseUser.email, currentPassword);
            await reauthenticateWithCredential(firebaseUser, credential);

            // Update password
            await updatePassword(firebaseUser, newPassword);

            // Clear form
            setCurrentPassword('');
            setNewPassword('');
            setConfirmPassword('');
            setShowPasswordChange(false);

            showToast("Password changed successfully!", "success");
        } catch (error: any) {
            console.error("Password change error:", error);
            if (error.code === 'auth/wrong-password' || error.code === 'auth/invalid-credential') {
                showToast("Current password is incorrect", "error");
            } else if (error.code === 'auth/weak-password') {
                showToast("New password is too weak", "error");
            } else if (error.code === 'auth/requires-recent-login') {
                showToast("Please log out and log back in before changing your password", "error");
            } else {
                showToast(error.message || "Failed to change password", "error");
            }
        } finally {
            setIsChangingPassword(false);
        }
    };

    const handleLogout = async () => {
        showConfirm({
            title: "Log Out",
            message: "Are you sure you want to log out?",
            confirmText: "Log Out",
            variant: "danger",
            onConfirm: async () => {
                try {
                    await StorageService.logout();
                } finally {
                    navigate('/');
                }
            }
        });
    };

    if (!user) return <div className="p-8 text-center text-zinc-500">Loading settings...</div>;

    const isPro = user.subscription?.plan === 'pro' || user.subscription?.plan === 'premium';

    const getAccountLabel = () => {
        if (!user) return null;
        if (user.isAdmin) return { label: 'Super Admin', color: 'red' };
        if (user.role === 'attendee') return { label: 'Attendee', color: 'gray' };
        if (user.role === 'affiliate') return { label: 'Affiliate', color: 'green' };
        if (user.role === 'organizer') {
            const plan = user.subscription?.plan || 'free';
            if (plan === 'premium') return { label: 'Organizer (PREMIUM)', color: 'purple' };
            if (plan === 'pro') return { label: 'Organizer (PRO)', color: 'blue' };
            return { label: 'Organizer (FREE PLAN)', color: 'gray' };
        }
        return { label: user.role, color: 'gray' };
    };

    const accountType = getAccountLabel();

    // Calculate profile completeness for organizers
    const getProfileCompleteness = () => {
        if (user?.role !== 'organizer') return null;
        
        const fields = [
            { name: 'Profile Image', filled: !!logoUrl },
            { name: 'Header Image', filled: !!headerImageUrl },
            { name: 'Business Name', filled: !!businessName?.trim() },
            { name: 'Organizer Subtitle', filled: !!organizerSubtitle?.trim() },
            { name: 'Bio', filled: !!bio?.trim() },
            { name: 'Phone Number', filled: !!phone?.trim() },
            { name: 'Social Links', filled: !!(socials?.instagram || socials?.facebook || socials?.twitter || socials?.website) },
        ];
        
        const filledCount = fields.filter(f => f.filled).length;
        const percentage = Math.round((filledCount / fields.length) * 100);
        const emptyFields = fields.filter(f => !f.filled).map(f => f.name);
        
        return { percentage, filledCount, total: fields.length, emptyFields };
    };

    const profileCompleteness = getProfileCompleteness();

    return (
        <div className="max-w-5xl mx-auto py-12 px-4 pb-24">
            <div className="flex justify-between items-end mb-8">
                <h1 className="text-3xl font-black text-zinc-900 dark:text-white uppercase tracking-tight">Settings</h1>
                {!isPro && (
                    <div>
                        <Button onClick={() => navigate('/pricing')} className="bg-gradient-to-r from-pink-500 to-purple-600 border-none text-white hover:opacity-90 shadow-lg">
                            Upgrade to Pro
                        </Button>
                    </div>
                )}
            </div>

            <div className="flex flex-col md:flex-row gap-8">
                {/* Sidebar */}
                <div className="w-full md:w-64 space-y-2 shrink-0">
                    <button
                        onClick={() => setActiveTab('profile')}
                        className={`w-full text-left px-4 py-3 rounded-xl font-bold flex items-center gap-3 transition-colors ${activeTab === 'profile' ? 'bg-zinc-900 dark:bg-white text-white dark:text-black' : 'text-zinc-500 hover:bg-zinc-100 dark:hover:bg-zinc-900'}`}
                    >
                        <UserIcon size={18} /> Profile
                    </button>
                    <button
                        onClick={() => setActiveTab('branding')}
                        className={`w-full text-left px-4 py-3 rounded-xl font-bold flex items-center gap-3 transition-colors ${activeTab === 'branding' ? 'bg-zinc-900 dark:bg-white text-white dark:text-black' : 'text-zinc-500 hover:bg-zinc-100 dark:hover:bg-zinc-900'}`}
                    >
                        <Palette size={18} /> Branding
                    </button>
                    <button
                        onClick={() => setActiveTab('email')}
                        className={`w-full text-left px-4 py-3 rounded-xl font-bold flex items-center gap-3 transition-colors ${activeTab === 'email' ? 'bg-zinc-900 dark:bg-white text-white dark:text-black' : 'text-zinc-500 hover:bg-zinc-100 dark:hover:bg-zinc-900'}`}
                    >
                        <Mail size={18} /> Email Marketing
                    </button>
                    <button
                        onClick={() => setActiveTab('organizer')}
                        className={`w-full text-left px-4 py-3 rounded-xl font-bold flex items-center gap-3 transition-colors ${activeTab === 'organizer' ? 'bg-zinc-900 dark:bg-white text-white dark:text-black' : 'text-zinc-500 hover:bg-zinc-100 dark:hover:bg-zinc-900'}`}
                    >
                        <Shield size={18} /> Organizer Defaults
                    </button>
                    <button
                        onClick={() => setActiveTab('page')}
                        className={`w-full text-left px-4 py-3 rounded-xl font-bold flex items-center gap-3 transition-colors ${activeTab === 'page' ? 'bg-zinc-900 dark:bg-white text-white dark:text-black' : 'text-zinc-500 hover:bg-zinc-100 dark:hover:bg-zinc-900'}`}
                    >
                        <LayoutTemplate size={18} /> Organizer Page
                    </button>
                    <button
                        onClick={() => setActiveTab('preferences')}
                        className={`w-full text-left px-4 py-3 rounded-xl font-bold flex items-center gap-3 transition-colors ${activeTab === 'preferences' ? 'bg-zinc-900 dark:bg-white text-white dark:text-black' : 'text-zinc-500 hover:bg-zinc-100 dark:hover:bg-zinc-900'}`}
                    >
                        <SettingsIcon size={18} /> Preferences
                    </button>

                    <div className="pt-4 mt-4 border-t border-zinc-200 dark:border-zinc-800">
                        <button
                            onClick={() => navigate('/billing')}
                            className="w-full text-left px-4 py-3 rounded-xl font-bold flex items-center gap-3 text-zinc-500 hover:bg-zinc-100 dark:hover:bg-zinc-900 transition-colors"
                        >
                            <CreditCard size={18} /> Billing & Plans
                        </button>
                        <button
                            onClick={handleLogout}
                            className="w-full text-left px-4 py-3 rounded-xl font-bold flex items-center gap-3 text-red-500 hover:bg-red-50 dark:hover:bg-red-900/10 transition-colors"
                        >
                            <LogOut size={18} /> Log Out
                        </button>
                    </div>
                </div>

                {/* Content */}
                <div className="flex-1 space-y-8">
                    <Card className="p-6 border-zinc-200 dark:border-zinc-800 relative overflow-hidden">

                        {activeTab === 'profile' && (
                            <div className="space-y-6 animate-in fade-in">
                                <div className="flex items-center gap-3 mb-4">
                                    <h2 className="text-xl font-bold text-zinc-900 dark:text-white">Profile Settings</h2>
                                    {accountType && (
                                        <Badge color={accountType.color as any}>{accountType.label}</Badge>
                                    )}
                                </div>

                                {/* Profile Completeness Card - Only for organizers */}
                                {profileCompleteness && (
                                    <div className={`p-4 rounded-xl border-2 mb-6 ${
                                        profileCompleteness.percentage === 100 
                                            ? 'bg-green-50 dark:bg-green-900/20 border-green-200 dark:border-green-800' 
                                            : profileCompleteness.percentage >= 60 
                                                ? 'bg-yellow-50 dark:bg-yellow-900/20 border-yellow-200 dark:border-yellow-800'
                                                : 'bg-pink-50 dark:bg-pink-900/20 border-pink-200 dark:border-pink-800'
                                    }`}>
                                        <div className="flex items-center justify-between mb-3">
                                            <span className="font-bold text-zinc-900 dark:text-white flex items-center gap-2">
                                                {profileCompleteness.percentage === 100 ? (
                                                    <CheckCircle size={18} className="text-green-500" />
                                                ) : (
                                                    <AlertCircle size={18} className={profileCompleteness.percentage >= 60 ? 'text-yellow-500' : 'text-pink-500'} />
                                                )}
                                                Profile Completeness
                                            </span>
                                            <span className="text-sm font-bold text-zinc-600 dark:text-zinc-400">
                                                {profileCompleteness.filledCount}/{profileCompleteness.total} fields
                                            </span>
                                        </div>
                                        
                                        {/* Progress Bar */}
                                        <div className="h-2 bg-zinc-200 dark:bg-zinc-700 rounded-full overflow-hidden mb-3">
                                            <div 
                                                className={`h-full transition-all duration-500 ${
                                                    profileCompleteness.percentage === 100 
                                                        ? 'bg-green-500' 
                                                        : profileCompleteness.percentage >= 60 
                                                            ? 'bg-yellow-500'
                                                            : 'bg-pink-500'
                                                }`}
                                                style={{ width: `${profileCompleteness.percentage}%` }}
                                            />
                                        </div>
                                        
                                        {profileCompleteness.percentage < 100 && (
                                            <p className="text-xs text-zinc-500 dark:text-zinc-400">
                                                <span className="font-bold">Complete your profile to attract more attendees!</span>
                                                {' '}Missing: {profileCompleteness.emptyFields.join(', ')}
                                            </p>
                                        )}
                                        {profileCompleteness.percentage === 100 && (
                                            <p className="text-xs text-green-600 dark:text-green-400 font-bold">
                                                Your profile is complete! Attendees will see all your information.
                                            </p>
                                        )}
                                    </div>
                                )}

                                <div className="flex flex-col items-center md:flex-row gap-6 mb-6">
                                    <div className="w-24 h-24 rounded-full overflow-hidden bg-zinc-100 dark:bg-zinc-800 relative group shrink-0 border-2 border-zinc-200 dark:border-zinc-700">
                                        {logoUrl ? (
                                            <img src={logoUrl} alt="Profile" className="w-full h-full object-cover" />
                                        ) : (
                                            <div className="w-full h-full flex items-center justify-center text-zinc-400">
                                                <UserIcon size={32} />
                                            </div>
                                        )}
                                        <div className="absolute inset-0 bg-black/50 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity cursor-pointer pointer-events-none">
                                            <Camera className="text-white" size={24} />
                                        </div>
                                    </div>
                                    <div className="flex-1 w-full">
                                        <FileDropZone
                                            label="Update Profile Picture"
                                            currentImage={null}
                                            onFileSelect={(b64) => setLogoUrl(b64 as string)}
                                            onClear={() => setLogoUrl('')}
                                        />
                                    </div>
                                </div>

                                <Input
                                    label="Full Name"
                                    value={name}
                                    onChange={e => setName(e.target.value)}
                                />
                                <Input
                                    label="Email Address"
                                    value={email}
                                    disabled
                                    className="opacity-60 cursor-not-allowed bg-zinc-100 dark:bg-zinc-800"
                                />

                                {/* Password Change Section */}
                                <div className="mt-6 pt-6 border-t border-zinc-200 dark:border-zinc-800">
                                    <div className="flex items-center justify-between mb-4">
                                        <div className="flex items-center gap-2">
                                            <Shield size={18} className="text-zinc-500" />
                                            <span className="font-bold text-zinc-900 dark:text-white">Password & Security</span>
                                        </div>
                                        <Button
                                            variant="outline"
                                            size="sm"
                                            onClick={() => setShowPasswordChange(!showPasswordChange)}
                                            className="text-sm"
                                        >
                                            {showPasswordChange ? 'Cancel' : 'Change Password'}
                                        </Button>
                                    </div>

                                    {showPasswordChange && (
                                        <div className="bg-zinc-50 dark:bg-zinc-800/50 rounded-xl p-4 space-y-4 animate-in fade-in slide-in-from-top-2">
                                            <div className="relative">
                                                <Input
                                                    label="Current Password"
                                                    type={showCurrentPw ? 'text' : 'password'}
                                                    value={currentPassword}
                                                    onChange={e => setCurrentPassword(e.target.value)}
                                                    placeholder="Enter your current password"
                                                />
                                                <button
                                                    type="button"
                                                    onClick={() => setShowCurrentPw(!showCurrentPw)}
                                                    className="absolute right-3 top-9 text-zinc-400 hover:text-zinc-600"
                                                >
                                                    <Eye size={18} />
                                                </button>
                                            </div>

                                            <div className="relative">
                                                <Input
                                                    label="New Password"
                                                    type={showNewPw ? 'text' : 'password'}
                                                    value={newPassword}
                                                    onChange={e => setNewPassword(e.target.value)}
                                                    placeholder="Enter new password"
                                                />
                                                <button
                                                    type="button"
                                                    onClick={() => setShowNewPw(!showNewPw)}
                                                    className="absolute right-3 top-9 text-zinc-400 hover:text-zinc-600"
                                                >
                                                    <Eye size={18} />
                                                </button>
                                            </div>

                                            <Input
                                                label="Confirm New Password"
                                                type={showNewPw ? 'text' : 'password'}
                                                value={confirmPassword}
                                                onChange={e => setConfirmPassword(e.target.value)}
                                                placeholder="Confirm new password"
                                            />

                                            <div className="text-xs text-zinc-500 dark:text-zinc-400 bg-zinc-100 dark:bg-zinc-700/50 rounded-lg p-3">
                                                <p className="font-bold mb-1">Password Requirements:</p>
                                                <ul className="list-disc list-inside space-y-1">
                                                    <li className={newPassword.length >= 8 ? 'text-green-600' : ''}>At least 8 characters</li>
                                                    <li className={/[A-Z]/.test(newPassword) ? 'text-green-600' : ''}>One uppercase letter</li>
                                                    <li className={/[a-z]/.test(newPassword) ? 'text-green-600' : ''}>One lowercase letter</li>
                                                    <li className={/\d/.test(newPassword) ? 'text-green-600' : ''}>One number</li>
                                                    <li className={/[@$!%*?&]/.test(newPassword) ? 'text-green-600' : ''}>One special character (@$!%*?&)</li>
                                                </ul>
                                            </div>

                                            <Button
                                                onClick={handleChangePassword}
                                                disabled={isChangingPassword || !currentPassword || !newPassword || newPassword !== confirmPassword}
                                                className="w-full"
                                            >
                                                {isChangingPassword ? 'Changing Password...' : 'Update Password'}
                                            </Button>
                                        </div>
                                    )}
                                </div>

                                {/* Organizer Upgrade */}
                                {user.role === 'attendee' && (
                                    <div className="mt-8 p-6 bg-gradient-to-br from-purple-50 to-indigo-50 dark:from-purple-900/20 dark:to-indigo-900/20 rounded-2xl border border-purple-100 dark:border-purple-800/30">
                                        <div className="flex items-start gap-4">
                                            <div className="p-3 bg-white dark:bg-purple-900/50 rounded-xl shadow-sm hidden sm:block">
                                                <LayoutTemplate className="text-purple-600 dark:text-purple-400" size={24} />
                                            </div>
                                            <div className="flex-1">
                                                <h3 className="text-lg font-bold text-purple-900 dark:text-purple-100">Start Organizing Events</h3>
                                                <p className="text-sm text-purple-700 dark:text-purple-300 mt-1 mb-4">
                                                    Upgrade your account to create events, sell tickets, and manage attendees. You can start for free!
                                                </p>
                                                <Button
                                                    onClick={() => navigate('/pricing')}
                                                    className="bg-purple-600 hover:bg-purple-700 border-none text-white shadow-lg shadow-purple-200 dark:shadow-none"
                                                >
                                                    View Organizer Plans
                                                </Button>
                                            </div>
                                        </div>
                                    </div>
                                )}

                                {/* Affiliate Upgrade */}
                                {user.role === 'attendee' && (
                                    <div className="mt-8 p-6 bg-gradient-to-br from-green-50 to-emerald-50 dark:from-green-900/20 dark:to-emerald-900/20 rounded-2xl border border-green-100 dark:border-green-800/30">
                                        <div className="flex items-start gap-4">
                                            <div className="p-3 bg-white dark:bg-green-900/50 rounded-xl shadow-sm hidden sm:block">
                                                <Shield className="text-green-600 dark:text-green-400" size={24} />
                                            </div>
                                            <div className="flex-1">
                                                <h3 className="text-lg font-bold text-green-900 dark:text-green-100">Become an Affiliate</h3>
                                                <p className="text-sm text-green-700 dark:text-green-300 mt-1 mb-4">
                                                    Join our affiliate program to earn commissions by promoting events. You'll get access to unique tracking links and a dashboard to monitor your earnings.
                                                </p>
                                                <Button
                                                    onClick={async () => {
                                                        showConfirm({
                                                            title: "Join Affiliate Program",
                                                            message: "Join the Affiliate Program and start earning commissions?",
                                                            confirmText: "Join Now",
                                                            onConfirm: async () => {
                                                                const updated = await StorageService.updateUser(user.id, { role: 'affiliate' });
                                                                if (updated) {
                                                                    setUser(updated);
                                                                    showToast("Welcome to the Affiliate Program!", "success");
                                                                } else {
                                                                    showToast("Failed to join Affiliate Program.", "error");
                                                                }
                                                            }
                                                        });
                                                    }}
                                                    className="bg-green-600 hover:bg-green-700 border-none text-white shadow-lg shadow-green-200 dark:shadow-none"
                                                >
                                                    Activate Affiliate Account
                                                </Button>
                                            </div>
                                        </div>
                                    </div>
                                )}

                                {/* Affiliate Dashboard Access for Organizers */}
                                {user.role === 'organizer' && (
                                    <div className="mt-8 p-6 bg-gradient-to-br from-purple-50 to-indigo-50 dark:from-purple-900/20 dark:to-indigo-900/20 rounded-2xl border border-purple-100 dark:border-purple-800/30">
                                        <div className="flex items-start gap-4">
                                            <div className="p-3 bg-white dark:bg-purple-900/50 rounded-xl shadow-sm hidden sm:block">
                                                <Gift className="text-purple-600 dark:text-purple-400" size={24} />
                                            </div>
                                            <div className="flex-1">
                                                <h3 className="text-lg font-bold text-purple-900 dark:text-purple-100">Affiliate Program</h3>
                                                {user.affiliateCode ? (
                                                    <>
                                                        <p className="text-sm text-purple-700 dark:text-purple-300 mt-1 mb-2">
                                                            Your affiliate code: <span className="font-mono font-bold bg-purple-100 dark:bg-purple-800/50 px-2 py-0.5 rounded">{user.affiliateCode}</span>
                                                        </p>
                                                        <p className="text-sm text-purple-600 dark:text-purple-400 mb-4">
                                                            Track your referrals, clicks, and earnings in your affiliate dashboard.
                                                        </p>
                                                        <Button
                                                            onClick={() => navigate('/affiliate')}
                                                            className="bg-purple-600 hover:bg-purple-700 border-none text-white shadow-lg shadow-purple-200 dark:shadow-none"
                                                        >
                                                            <Gift size={16} className="mr-2" />
                                                            Open Affiliate Dashboard
                                                        </Button>
                                                    </>
                                                ) : (
                                                    <>
                                                        <p className="text-sm text-purple-700 dark:text-purple-300 mt-1 mb-4">
                                                            Join our affiliate program to earn commissions by referring new organizers and promoting events.
                                                        </p>
                                                        <Button
                                                            onClick={() => navigate('/affiliate')}
                                                            className="bg-purple-600 hover:bg-purple-700 border-none text-white shadow-lg shadow-purple-200 dark:shadow-none"
                                                        >
                                                            <Gift size={16} className="mr-2" />
                                                            Join Affiliate Program
                                                        </Button>
                                                    </>
                                                )}
                                            </div>
                                        </div>
                                    </div>
                                )}
                            </div>
                        )}

                        {activeTab === 'branding' && (
                            <div className="space-y-6 animate-in fade-in relative">
                                <div className="flex justify-between items-start">
                                    <div>
                                        <h2 className="text-xl font-bold text-zinc-900 dark:text-white">Brand Customization</h2>
                                        <p className="text-sm text-zinc-500 mt-1">Customize the look of your event pages.</p>
                                    </div>
                                    {!isPro && <Badge color="purple">PRO Feature</Badge>}
                                </div>

                                <div className={`space-y-6 ${!isPro ? 'opacity-40 pointer-events-none filter blur-sm select-none' : ''}`}>
                                    <div>
                                        <label className="block text-xs font-bold text-zinc-500 uppercase mb-2">Primary Accent Color</label>
                                        <div className="flex items-center gap-4">
                                            <input
                                                type="color"
                                                value={primaryColor}
                                                onChange={(e) => setPrimaryColor(e.target.value)}
                                                className="w-12 h-12 rounded-lg border-2 border-zinc-200 dark:border-zinc-700 cursor-pointer p-0 bg-transparent"
                                            />
                                            <div className="flex-1">
                                                <Input
                                                    value={primaryColor}
                                                    onChange={(e) => setPrimaryColor(e.target.value)}
                                                    placeholder="#E0FF20"
                                                />
                                            </div>
                                        </div>
                                        <p className="text-xs text-zinc-500 mt-2">
                                            This color will be used for buttons, links, and highlights on your event pages.
                                        </p>
                                    </div>

                                    <div className="p-4 bg-zinc-50 dark:bg-zinc-900 rounded-xl border border-zinc-200 dark:border-zinc-800">
                                        <div className="text-xs font-bold text-zinc-400 uppercase mb-2">Preview</div>
                                        <div className="flex gap-2">
                                            <button style={{ backgroundColor: primaryColor, color: '#000' }} className="px-4 py-2 rounded-lg font-bold text-sm shadow-lg">Primary Button</button>
                                            <button style={{ borderColor: primaryColor, color: primaryColor }} className="px-4 py-2 rounded-lg font-bold text-sm border-2">Secondary</button>
                                        </div>
                                    </div>
                                </div>

                                {!isPro && (
                                    <div className="absolute inset-0 z-10 flex flex-col items-center justify-center text-center p-6">
                                        <div className="bg-gradient-to-br from-zinc-900 to-black text-white p-8 rounded-2xl shadow-2xl border border-zinc-800 max-w-sm">
                                            <Palette size={48} className="mx-auto mb-4 text-purple-400" />
                                            <h3 className="text-xl font-bold mb-2">Unlock Brand Customization</h3>
                                            <p className="text-zinc-400 mb-6 text-sm">Upgrade to Pro to customize your event page colors and remove Openticket branding.</p>
                                            <Button onClick={() => navigate('/pricing')} className="w-full bg-purple-600 hover:bg-purple-500 border-none text-white">
                                                Upgrade Now
                                            </Button>
                                        </div>
                                    </div>
                                )}
                            </div>
                        )}

                        {activeTab === 'email' && (
                            <div className="space-y-6 animate-in fade-in">
                                <h2 className="text-xl font-bold mb-4 text-zinc-900 dark:text-white">Email Marketing</h2>

                                <div className="p-6 bg-zinc-50 dark:bg-zinc-900/50 rounded-xl border border-zinc-200 dark:border-zinc-800">
                                    <div className="flex justify-between items-start mb-4">
                                        <div>
                                            <h3 className="font-bold flex items-center gap-2">
                                                Gmail Integration
                                                {gmailConfig.connected ? <CheckCircle className="text-green-500" size={16} /> : <XCircle className="text-zinc-400" size={16} />}
                                            </h3>
                                            <p className="text-sm text-zinc-500 mt-1">Connect your Gmail account to send broadcasts from your own address.</p>
                                        </div>
                                        {gmailConfig.connected ? (
                                            <Button variant="outline" onClick={handleDisconnectGmail} size="sm">Disconnect</Button>
                                        ) : (
                                            <Button onClick={handleConnectGmail} isLoading={isConnectingGmail} size="sm">Connect Gmail</Button>
                                        )}
                                    </div>
                                    {gmailConfig.connected && (
                                        <div className="text-xs bg-green-500/10 text-green-600 dark:text-green-400 p-3 rounded-lg border border-green-500/20">
                                            <strong>Connected as:</strong> {gmailConfig.email}
                                        </div>
                                    )}
                                </div>

                                {/* Email Provider Selection */}
                                <div className="p-6 bg-zinc-50 dark:bg-zinc-900/50 rounded-xl border border-zinc-200 dark:border-zinc-800">
                                    <h3 className="font-bold flex items-center gap-2 mb-2">
                                        <Mail size={18} /> Email Delivery Provider
                                    </h3>
                                    <p className="text-sm text-zinc-500 mb-4">
                                        Choose which service sends your event emails (confirmations, reminders, broadcasts).
                                    </p>

                                    <div className="space-y-3">
                                        {/* Resend Email Service Option */}
                                        <label 
                                            className={`flex items-start gap-4 p-4 rounded-xl border-2 cursor-pointer transition-all ${
                                                emailProvider === 'resend' 
                                                    ? 'border-primary bg-primary/5' 
                                                    : 'border-zinc-200 dark:border-zinc-700 hover:border-zinc-300 dark:hover:border-zinc-600'
                                            }`}
                                        >
                                            <input
                                                type="radio"
                                                name="emailProvider"
                                                value="resend"
                                                checked={emailProvider === 'resend'}
                                                onChange={() => setEmailProvider('resend')}
                                                className="mt-1"
                                            />
                                            <div className="flex-1">
                                                <div className="flex items-center gap-2 flex-wrap">
                                                    <span className="text-xl">📧</span>
                                                    <span className="font-bold">Resend Email Service</span>
                                                    <Badge variant="success">Recommended</Badge>
                                                </div>
                                                <p className="text-sm text-zinc-500 mt-1">
                                                    Send emails via Resend's reliable email infrastructure. No daily limits. Best deliverability.
                                                </p>
                                            </div>
                                        </label>

                                        {/* Gmail Option */}
                                        <label 
                                            className={`flex items-start gap-4 p-4 rounded-xl border-2 cursor-pointer transition-all ${
                                                !gmailConfig.connected ? 'opacity-60 cursor-not-allowed' : ''
                                            } ${
                                                emailProvider === 'gmail' 
                                                    ? 'border-primary bg-primary/5' 
                                                    : 'border-zinc-200 dark:border-zinc-700 hover:border-zinc-300 dark:hover:border-zinc-600'
                                            }`}
                                        >
                                            <input
                                                type="radio"
                                                name="emailProvider"
                                                value="gmail"
                                                checked={emailProvider === 'gmail'}
                                                disabled={!gmailConfig.connected}
                                                onChange={() => {
                                                    if (gmailConfig.connected) {
                                                        setEmailProvider('gmail');
                                                    } else {
                                                        showToast('Please connect Gmail first', 'error');
                                                    }
                                                }}
                                                className="mt-1"
                                            />
                                            <div className="flex-1">
                                                <div className="flex items-center gap-2">
                                                    <span className="text-xl">📧</span>
                                                    <span className="font-bold">Gmail</span>
                                                    {gmailConfig.connected && <CheckCircle className="text-green-500" size={14} />}
                                                    {!gmailConfig.connected && <span className="text-xs text-amber-500 font-medium">(Not Connected)</span>}
                                                </div>
                                                <p className="text-sm text-zinc-500 mt-1">
                                                    Send emails from your own Gmail address. Emails appear as sent by you.
                                                </p>
                                                {gmailConfig.connected && gmailConfig.email && (
                                                    <p className="text-xs text-green-600 dark:text-green-400 mt-1">
                                                        Will send as: {gmailConfig.email}
                                                    </p>
                                                )}
                                            </div>
                                        </label>
                                    </div>

                                    {/* Gmail Limits Disclaimer */}
                                    {emailProvider === 'gmail' && (
                                        <div className="mt-4 p-4 bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-800/50 rounded-xl overflow-hidden">
                                            <div className="flex items-start gap-2">
                                                <AlertCircle size={18} className="text-amber-500 flex-shrink-0 mt-0.5" />
                                                <div className="min-w-0 flex-1">
                                                    <h4 className="font-bold text-amber-700 dark:text-amber-400 text-sm">Gmail Daily Sending Limits</h4>
                                                    <ul className="text-xs text-amber-600 dark:text-amber-500 mt-2 space-y-1 list-disc list-inside break-words">
                                                        <li><strong>Standard Gmail:</strong> Up to 500 emails per day</li>
                                                        <li><strong>Google Workspace:</strong> Up to 2,000 emails per day</li>
                                                    </ul>
                                                    <p className="text-xs text-amber-600 dark:text-amber-500 mt-2 break-words">
                                                        ⚠️ If limits are exceeded, emails will fail. There is <strong>no automatic fallback</strong> to Resend.
                                                    </p>
                                                </div>
                                            </div>
                                        </div>
                                    )}

                                    {/* Current Status */}
                                    <div className="mt-4 flex items-center gap-2 text-sm flex-wrap">
                                        <span className="text-zinc-500">Currently sending via:</span>
                                        <Badge variant={emailProvider === 'gmail' ? 'default' : 'success'}>
                                            {emailProvider === 'gmail' ? '📫 Gmail' : '📧 Resend'}
                                        </Badge>
                                    </div>
                                </div>

                                <div className="space-y-4">
                                    <div className="flex justify-between items-center">
                                        <h3 className="font-bold text-lg">Email Templates</h3>
                                        {!editingTemplate && (
                                            <div className="flex gap-2">
                                                <Button size="sm" variant="outline" onClick={handleLoadDefaults}>
                                                    Load Defaults
                                                </Button>
                                                <Button size="sm" onClick={() => setEditingTemplate({ id: `tmpl-${Date.now()}`, type: 'broadcast', name: 'New Template', subject: '', body: '' })}>
                                                    <Plus size={16} className="mr-2" /> New Template
                                                </Button>
                                            </div>
                                        )}
                                    </div>

                                    {editingTemplate ? (
                                        <div className="bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-xl p-6 space-y-4 animate-in slide-in-from-right-4">
                                            <div className="flex justify-between items-center mb-2">
                                                <h4 className="font-bold">Edit Template</h4>
                                                <Button variant="ghost" size="sm" onClick={() => setEditingTemplate(null)}>Cancel</Button>
                                            </div>
                                            <Input label="Template Name" value={editingTemplate.name} onChange={e => setEditingTemplate({ ...editingTemplate, name: e.target.value })} placeholder="e.g. Monthly Newsletter" />
                                            <div className="grid grid-cols-2 gap-4">
                                                <div>
                                                    <label className="block text-xs font-bold text-zinc-500 uppercase mb-2">Type</label>
                                                    <select
                                                        className="w-full bg-zinc-100 dark:bg-zinc-800 border-none rounded-xl px-4 py-3 text-sm"
                                                        value={editingTemplate.type}
                                                        onChange={(e: any) => setEditingTemplate({ ...editingTemplate, type: e.target.value })}
                                                    >
                                                        <option value="broadcast">Broadcast / Newsletter</option>
                                                        <option value="confirmation">Order Confirmation (Default)</option>
                                                        <option value="reminder">Event Reminder</option>
                                                        <option value="waitlist">Waitlist Notification</option>
                                                    </select>
                                                </div>
                                            </div>
                                            <Input label="Subject Line" value={editingTemplate.subject} onChange={e => setEditingTemplate({ ...editingTemplate, subject: e.target.value })} placeholder="Get ready for {{event_title}}!" />
                                            <div>
                                                <RichTextarea
                                                    label="Body Content"
                                                    value={editingTemplate.body}
                                                    onChange={(e: any) => setEditingTemplate({ ...editingTemplate, body: e.target.value })}
                                                    className="min-h-[200px]"
                                                    placeholder="Hi {{attendee_name}}, ..."
                                                />
                                                <div className="mt-2 text-xs text-zinc-500 overflow-x-auto whitespace-nowrap p-2 bg-zinc-50 dark:bg-black rounded border border-zinc-200 dark:border-zinc-800">
                                                    <strong>Variables:</strong> {'{{event_title}}'}, {'{{attendee_name}}'}, {'{{ticket_type}}'}, {'{{event_date}}'}, {'{{event_location}}'}, {'{{qr_code_link}}'}
                                                </div>
                                            </div>
                                            <div className="flex justify-between items-center pt-4">
                                                <Button 
                                                    variant="outline"
                                                    onClick={() => handleSendTestEmail(editingTemplate)}
                                                    disabled={sendingTestId === editingTemplate.id}
                                                    className="flex items-center gap-2"
                                                >
                                                    {sendingTestId === editingTemplate.id ? (
                                                        <span className="w-4 h-4 border-2 border-current border-t-transparent rounded-full animate-spin" />
                                                    ) : (
                                                        <Send size={16} />
                                                    )}
                                                    Send Test Email
                                                </Button>
                                                <Button onClick={() => handleSaveTemplate(editingTemplate)}>Save Template</Button>
                                            </div>
                                        </div>
                                    ) : (
                                        <div className="space-y-3">
                                            {emailTemplates.length === 0 && (
                                                <div className="text-center p-8 text-zinc-500 bg-zinc-50 dark:bg-zinc-900/50 rounded-xl border border-dashed border-zinc-300 dark:border-zinc-700">
                                                    No templates found. Create one to get started.
                                                </div>
                                            )}
                                            {emailTemplates.map(t => (
                                                <div key={t.id} className="flex items-center justify-between p-4 bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-xl hover:bg-zinc-50 dark:hover:bg-zinc-800 transition-colors">
                                                    <div className="flex-1 min-w-0 mr-4">
                                                        <div className="font-bold flex items-center gap-2 flex-wrap">
                                                            <span className="truncate">{t.name}</span>
                                                            <Badge color={t.type === 'confirmation' ? 'green' : t.type === 'broadcast' ? 'blue' : 'gray'}>{t.type}</Badge>
                                                        </div>
                                                        <div className="text-xs text-zinc-500 mt-1 truncate">{t.subject}</div>
                                                    </div>
                                                    <div className="flex gap-2 shrink-0">
                                                        <Button 
                                                            size="sm" 
                                                            variant="outline" 
                                                            onClick={() => handleSendTestEmail(t)}
                                                            disabled={sendingTestId === t.id}
                                                            className="flex items-center gap-1.5"
                                                            title="Send test email to yourself"
                                                        >
                                                            {sendingTestId === t.id ? (
                                                                <span className="w-3.5 h-3.5 border-2 border-current border-t-transparent rounded-full animate-spin" />
                                                            ) : (
                                                                <Send size={14} />
                                                            )}
                                                            <span className="hidden sm:inline">Test</span>
                                                        </Button>
                                                        <Button size="sm" variant="outline" onClick={() => setEditingTemplate(t)}>Edit</Button>
                                                        <Button size="sm" variant="danger" onClick={() => handleDeleteTemplate(t.id)} className="w-8 h-8 p-0 flex items-center justify-center"><Trash2 size={14} /></Button>
                                                    </div>
                                                </div>
                                            ))}
                                        </div>
                                    )}
                                </div>
                            </div>
                        )}

                        {activeTab === 'preferences' && (
                            <div className="space-y-6 animate-in fade-in">
                                <h2 className="text-xl font-bold mb-4 text-zinc-900 dark:text-white">App Preferences</h2>

                                <div className="flex justify-between items-center p-4 bg-zinc-50 dark:bg-zinc-900/50 rounded-xl border border-zinc-200 dark:border-zinc-800">
                                    <div>
                                        <div className="font-bold text-sm text-zinc-900 dark:text-white">Desktop Camera</div>
                                        <div className="text-xs text-zinc-500">Enable webcam for ticket scanning on this device.</div>
                                    </div>
                                    <Switch checked={desktopCamera} onChange={setDesktopCamera} />
                                </div>

                                <div className="flex justify-between items-center p-4 bg-zinc-50 dark:bg-zinc-900/50 rounded-xl border border-zinc-200 dark:border-zinc-800">
                                    <div>
                                        <div className="font-bold text-sm text-zinc-900 dark:text-white">Email Notifications</div>
                                        <div className="text-xs text-zinc-500">Receive updates about new orders.</div>
                                    </div>
                                    <Switch checked={notifications.newOrder} onChange={c => setNotifications({ ...notifications, newOrder: c })} />
                                </div>

                                {/* Push Notifications Section */}
                                <NotificationSettings className="mt-4" />

                                <div className="pt-6 border-t border-zinc-200 dark:border-zinc-800">
                                    <h2 className="text-xl font-bold mb-4 text-zinc-900 dark:text-white flex items-center gap-2">
                                        <div className="w-8 h-8 rounded-full bg-gradient-to-tr from-blue-500 to-purple-500 flex items-center justify-center text-white">
                                            <Smartphone size={16} />
                                        </div>
                                        Gemini AI
                                    </h2>
                                    <div className="p-6 bg-zinc-900 rounded-2xl border border-zinc-800">
                                        <div className="mb-4">
                                            <label className="block text-xs font-bold text-zinc-400 uppercase mb-2">Google Gemini API Key</label>
                                            <Input
                                                value={geminiApiKey}
                                                onChange={e => setGeminiApiKey(e.target.value)}
                                                placeholder="AIzaSy..."
                                                className="bg-black border-zinc-800 text-white font-mono"
                                                type="password"
                                            />
                                            <p className="text-xs text-zinc-500 mt-2">
                                                Required for Magic Write and Marketing Lab features. <a href="https://aistudio.google.com/app/apikey" target="_blank" className="text-primary underline">Get a key here</a>.
                                            </p>
                                        </div>
                                    </div>
                                </div>
                            </div>
                        )}

                        {activeTab === 'organizer' && (
                            <div className="space-y-6 animate-in fade-in">
                                <h2 className="text-xl font-bold mb-4 text-zinc-900 dark:text-white">Organizer Defaults</h2>
                                <p className="text-sm text-zinc-500 mb-6">These settings will be used as default values for new events.</p>

                                <div className="space-y-6">
                                    {/* Default Currency Section */}
                                    <div className="p-6 bg-gradient-to-r from-blue-50 to-indigo-50 dark:from-blue-900/20 dark:to-indigo-900/20 rounded-2xl border border-blue-200 dark:border-blue-800/50">
                                        <div className="flex flex-col sm:flex-row gap-4 items-start sm:items-center justify-between">
                                            <div className="flex items-center gap-3">
                                                <div className="w-12 h-12 rounded-xl bg-blue-100 dark:bg-blue-900/50 flex items-center justify-center">
                                                    <DollarSign size={24} className="text-blue-600 dark:text-blue-400" />
                                                </div>
                                                <div>
                                                    <h3 className="font-bold text-zinc-900 dark:text-white">Default Event Currency</h3>
                                                    <p className="text-xs text-zinc-500 dark:text-zinc-400">All new events will use this currency for pricing</p>
                                                </div>
                                            </div>
                                            <select
                                                value={defaultCurrency}
                                                onChange={(e) => setDefaultCurrency(e.target.value)}
                                                className="px-4 py-3 rounded-xl border border-blue-300 dark:border-blue-700 bg-white dark:bg-zinc-800 text-zinc-900 dark:text-white font-bold text-sm focus:ring-2 focus:ring-blue-500 focus:outline-none min-w-[200px]"
                                            >
                                                <option value="USD">$ USD - US Dollar</option>
                                                <option value="EUR">€ EUR - Euro</option>
                                                <option value="GBP">£ GBP - British Pound</option>
                                                <option value="CAD">C$ CAD - Canadian Dollar</option>
                                                <option value="AUD">A$ AUD - Australian Dollar</option>
                                            </select>
                                        </div>
                                        <p className="mt-4 text-xs text-blue-600 dark:text-blue-300">
                                            💡 You can override this for individual events in the Event Builder. Buyers will be charged in the event's currency.
                                        </p>
                                    </div>

                                    <div className="pt-6 border-t border-zinc-200 dark:border-zinc-800">
                                        <div className="flex justify-between items-center mb-2">
                                            <h3 className="font-bold text-sm text-zinc-900 dark:text-white">Default Refund Policy</h3>
                                            <Switch checked={defaultRefundPolicyEnabled} onChange={(c) => setDefaultRefundPolicyEnabled(c)} />
                                        </div>
                                        {defaultRefundPolicyEnabled && (
                                            <RichTextarea
                                                value={defaultRefundPolicy}
                                                onChange={(e: any) => setDefaultRefundPolicy(e.target.value)}
                                                placeholder="Enter your standard refund policy..."
                                            />
                                        )}
                                    </div>

                                    <div className="pt-6 border-t border-zinc-200 dark:border-zinc-800">
                                        <div className="flex justify-between items-center mb-4">
                                            <div>
                                                <h3 className="font-bold text-sm text-zinc-900 dark:text-white">Default Waiver</h3>
                                                <p className="text-xs text-zinc-500">This waiver will be automatically applied to new events.</p>
                                            </div>
                                            <Switch checked={defaultWaiver.enabled || false} onChange={c => setDefaultWaiver({ ...defaultWaiver, enabled: c })} />
                                        </div>

                                        {defaultWaiver.enabled && (
                                            <>
                                                <RichTextarea
                                                    label="Waiver Text"
                                                    value={defaultWaiver.text || ''}
                                                    onChange={(e: any) => setDefaultWaiver({ ...defaultWaiver, text: e.target.value })}
                                                    className="min-h-[150px] mb-4"
                                                    placeholder="Standard waiver text..."
                                                />

                                                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                                    <div>
                                                        <label className="block text-xs font-bold text-zinc-600 dark:text-zinc-400 uppercase tracking-wider mb-2 ml-1">Default Waiver PDF</label>
                                                        <FileDropZone
                                                            currentImage={defaultWaiver.fileName ? 'PDF_UPLOADED' : ''}
                                                            label={defaultWaiver.fileName || "Drop Waiver PDF"}
                                                            onFileSelect={(b64, name) => setDefaultWaiver({ ...defaultWaiver, pdfUrl: b64 as string, fileName: name })}
                                                            onClear={() => setDefaultWaiver({ ...defaultWaiver, pdfUrl: '', fileName: '' })}
                                                            accept="application/pdf"
                                                        />
                                                    </div>
                                                </div>
                                            </>
                                        )}
                                    </div>

                                    <div className="pt-6 border-t border-zinc-200 dark:border-zinc-800">
                                        <h3 className="font-bold text-sm text-zinc-900 dark:text-white mb-4">Tax & Custom Fees</h3>
                                        <p className="text-xs text-zinc-500 mb-4">These fees will automatically apply to all new events you create.</p>

                                        <div className="space-y-4">
                                            <div>
                                                <label className="block text-xs font-bold text-zinc-500 uppercase mb-2">Default Tax Rate (%)</label>
                                                <Input
                                                    type="number"
                                                    value={defaultTaxRate}
                                                    onChange={e => setDefaultTaxRate(Number(e.target.value))}
                                                    placeholder="0.00"
                                                    className="max-w-[150px]"
                                                />
                                            </div>

                                            <div>
                                                <label className="block text-xs font-bold text-zinc-500 uppercase mb-2">Custom Fees (e.g. Facility Fee)</label>
                                                {defaultCustomFees.map((fee, index) => (
                                                    <div key={index} className="flex gap-2 mb-2">
                                                        <Input
                                                            placeholder="Name"
                                                            value={fee.name}
                                                            onChange={e => {
                                                                const newFees = [...defaultCustomFees];
                                                                newFees[index].name = e.target.value;
                                                                setDefaultCustomFees(newFees);
                                                            }}
                                                            className="flex-1"
                                                        />
                                                        <div className="w-24">
                                                            <Input
                                                                type="number"
                                                                placeholder="Amount"
                                                                value={fee.amount}
                                                                onChange={e => {
                                                                    const newFees = [...defaultCustomFees];
                                                                    newFees[index].amount = Number(e.target.value);
                                                                    setDefaultCustomFees(newFees);
                                                                }}
                                                            />
                                                        </div>
                                                        <select
                                                            className="bg-zinc-100 dark:bg-zinc-800 rounded-lg text-sm px-2 border-none cursor-pointer"
                                                            value={fee.type}
                                                            onChange={e => {
                                                                const newFees = [...defaultCustomFees];
                                                                newFees[index].type = e.target.value as 'fixed' | 'percent';
                                                                setDefaultCustomFees(newFees);
                                                            }}
                                                        >
                                                            <option value="fixed">$</option>
                                                            <option value="percent">%</option>
                                                        </select>
                                                        <Button variant="danger" onClick={() => setDefaultCustomFees(prev => prev.filter((_, i) => i !== index))}>
                                                            <Trash2 size={16} />
                                                        </Button>
                                                    </div>
                                                ))}
                                                <Button size="sm" variant="outline" onClick={() => setDefaultCustomFees([...defaultCustomFees, { name: '', amount: 0, type: 'fixed' }])}>
                                                    <Plus size={14} className="mr-1" /> Add Fee
                                                </Button>
                                            </div>
                                        </div>
                                    </div>
                                </div>
                            </div>
                        )}

                        {activeTab === 'page' && (
                            <div className="space-y-6 animate-in fade-in">
                                <div className="flex justify-between items-start">
                                    <div>
                                        <h2 className="text-xl font-bold text-zinc-900 dark:text-white">Organizer Page Editor</h2>
                                        <p className="text-sm text-zinc-500 mt-1">Customize your public profile page.</p>
                                    </div>
                                    <Button size="sm" variant="outline" onClick={() => window.open(`/#/organizer/${user.id}`, '_blank')}>
                                        View Live Page
                                    </Button>
                                </div>

                                <div>
                                    <label className="block text-xs font-bold text-zinc-500 uppercase mb-2">Header Image</label>
                                    <div className="h-48 rounded-xl overflow-hidden border-2 border-zinc-200 dark:border-zinc-800 bg-zinc-100 dark:bg-zinc-900 relative">
                                        {headerImageUrl ? (
                                            <img src={headerImageUrl} className="w-full h-full object-cover" />
                                        ) : (
                                            <div className="absolute inset-0 flex items-center justify-center text-zinc-400">
                                                <div className="text-center">
                                                    <LayoutTemplate size={32} className="mx-auto mb-2 opacity-50" />
                                                    <span className="text-xs font-bold uppercase">No Header Image</span>
                                                </div>
                                            </div>
                                        )}
                                        <div className="absolute bottom-4 right-4">
                                            <FileDropZone
                                                currentImage={null}
                                                label="Change Image"
                                                onFileSelect={(b64) => setHeaderImageUrl(b64 as string)}
                                                onClear={() => setHeaderImageUrl('')}
                                                accept="image/*"
                                            />
                                        </div>
                                    </div>
                                    <p className="text-xs text-zinc-500 mt-2">Recommended size: 1500x500px. This appears at the top of your organizer profile.</p>
                                </div>

                                <div className="grid grid-cols-1 md:grid-cols-2 gap-6 pt-6">
                                    <Input
                                        label="Organization/Business Name"
                                        value={businessName}
                                        onChange={e => setBusinessName(e.target.value)}
                                        placeholder="e.g. Acme Corporation"
                                    />
                                    <Input
                                        label="Organizer Subtitle"
                                        value={organizerSubtitle}
                                        onChange={e => setOrganizerSubtitle(e.target.value)}
                                        placeholder="e.g. Professional Event Planner"
                                    />
                                </div>

                                <div className="grid grid-cols-1 gap-6">
                                    <Input
                                        label="Business Email"
                                        type="email"
                                        value={businessEmail}
                                        onChange={e => setBusinessEmail(e.target.value)}
                                        placeholder="e.g. contact@acmecorp.com"
                                        hint="Used as contact email when 'Use Business Name publicly' is enabled"
                                    />
                                </div>

                                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                                    <Input
                                        label="Personal Phone"
                                        type="tel"
                                        value={phone}
                                        onChange={e => setPhone(e.target.value)}
                                        placeholder="e.g. +1 555-123-4567"
                                    />
                                    <Input
                                        label="Business Phone"
                                        type="tel"
                                        value={businessPhone}
                                        onChange={e => setBusinessPhone(e.target.value)}
                                        placeholder="e.g. +1 555-987-6543"
                                        hint="Shown when 'Use Business Name publicly' is enabled"
                                    />
                                </div>

                                <div className="p-4 bg-zinc-50 dark:bg-zinc-900 rounded-xl border border-zinc-200 dark:border-zinc-800 flex justify-between items-center">
                                    <div>
                                        <h3 className="font-bold text-sm text-zinc-900 dark:text-white">Show Phone on Public Profile</h3>
                                        <p className="text-xs text-zinc-500">Enable to display your phone number on your organizer profile page.</p>
                                    </div>
                                    <Switch checked={showPhonePublicly} onChange={setShowPhonePublicly} />
                                </div>

                                <div>
                                    <label className="block text-xs font-bold text-zinc-500 dark:text-zinc-400 uppercase tracking-wide mb-2">
                                        Bio / About
                                    </label>
                                    <textarea
                                        value={bio}
                                        onChange={e => setBio(e.target.value)}
                                        placeholder="Tell attendees about yourself or your organization..."
                                        rows={4}
                                        className="w-full px-4 py-3 bg-zinc-100 dark:bg-zinc-800 border border-zinc-200 dark:border-zinc-700 rounded-xl focus:ring-2 focus:ring-primary focus:border-transparent outline-none transition-all resize-none"
                                    />
                                    <p className="text-xs text-zinc-500 mt-1">This appears on your public organizer profile page.</p>
                                </div>

                                <div className="p-4 bg-zinc-50 dark:bg-zinc-900 rounded-xl border border-zinc-200 dark:border-zinc-800 flex justify-between items-center">
                                    <div>
                                        <h3 className="font-bold text-sm text-zinc-900 dark:text-white">Use Business Name publicly</h3>
                                        <p className="text-xs text-zinc-500">Enable to show your business name and email instead of personal info on event pages.</p>
                                    </div>
                                    <Switch checked={useBusinessName} onChange={setUseBusinessName} />
                                </div>

                                {/* Organizer Profile Preview */}
                                <div className="p-4 bg-gradient-to-br from-purple-50 to-indigo-50 dark:from-purple-900/20 dark:to-indigo-900/20 rounded-xl border border-purple-200 dark:border-purple-800/50">
                                    <h3 className="font-bold text-sm text-purple-900 dark:text-purple-100 mb-3 flex items-center gap-2">
                                        <Eye size={16} /> Profile Preview
                                    </h3>
                                    <p className="text-xs text-purple-600 dark:text-purple-300 mb-4">This is how your organizer profile appears on event pages:</p>
                                    
                                    <div className="bg-white dark:bg-zinc-900 rounded-xl p-4 border border-purple-200 dark:border-purple-800/30 shadow-sm">
                                        <div className="flex items-center gap-4">
                                            {/* Avatar/Logo */}
                                            <div className="w-16 h-16 rounded-full bg-gradient-to-br from-primary to-primary/60 flex items-center justify-center text-white text-xl font-black shadow-lg overflow-hidden flex-shrink-0">
                                                {logoUrl ? (
                                                    <img src={logoUrl} className="w-full h-full object-cover" alt="Profile" />
                                                ) : (
                                                    (useBusinessName && businessName ? businessName : name)?.charAt(0)?.toUpperCase() || 'O'
                                                )}
                                            </div>
                                            
                                            {/* Info */}
                                            <div className="flex-1 min-w-0">
                                                <div className="font-black text-lg text-zinc-900 dark:text-white truncate">
                                                    {useBusinessName && businessName ? businessName : name || 'Your Name'}
                                                </div>
                                                {useBusinessName && organizerSubtitle && (
                                                    <div className="text-sm text-zinc-600 dark:text-zinc-400 truncate">{organizerSubtitle}</div>
                                                )}
                                                <div className="text-xs text-zinc-500 mt-1 truncate">
                                                    {useBusinessName && businessEmail ? businessEmail : user?.email}
                                                </div>
                                            </div>
                                        </div>
                                        
                                        {/* Social Links Preview */}
                                        {(socials.website || socials.instagram || socials.facebook || socials.x) && (
                                            <div className="flex gap-2 mt-3 pt-3 border-t border-zinc-100 dark:border-zinc-800">
                                                {socials.website && <div className="w-8 h-8 rounded-full bg-zinc-100 dark:bg-zinc-800 flex items-center justify-center"><Globe size={14} className="text-zinc-500" /></div>}
                                                {socials.instagram && <div className="w-8 h-8 rounded-full bg-zinc-100 dark:bg-zinc-800 flex items-center justify-center"><Instagram size={14} className="text-zinc-500" /></div>}
                                                {socials.facebook && <div className="w-8 h-8 rounded-full bg-zinc-100 dark:bg-zinc-800 flex items-center justify-center"><Facebook size={14} className="text-zinc-500" /></div>}
                                                {socials.x && <div className="w-8 h-8 rounded-full bg-zinc-100 dark:bg-zinc-800 flex items-center justify-center"><Twitter size={14} className="text-zinc-500" /></div>}
                                            </div>
                                        )}
                                    </div>
                                    
                                    <p className="text-[10px] text-purple-500 mt-3">
                                        💡 Attendees see this on your event pages, tickets, and confirmation emails.
                                    </p>
                                </div>

                                <div className="pt-6 border-t border-zinc-200 dark:border-zinc-800">
                                    <h3 className="font-bold text-sm text-zinc-900 dark:text-white mb-4">Social Media Links</h3>
                                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                        <Input
                                            icon={Globe}
                                            placeholder="Website URL"
                                            value={socials.website || ''}
                                            onChange={e => setSocials({ ...socials, website: e.target.value })}
                                        />
                                        <Input
                                            icon={Instagram}
                                            placeholder="Instagram URL"
                                            value={socials.instagram || ''}
                                            onChange={e => setSocials({ ...socials, instagram: e.target.value })}
                                        />
                                        <Input
                                            icon={Facebook}
                                            placeholder="Facebook URL"
                                            value={socials.facebook || ''}
                                            onChange={e => setSocials({ ...socials, facebook: e.target.value })}
                                        />
                                        <Input
                                            icon={Twitter}
                                            placeholder="X / Twitter URL"
                                            value={socials.x || ''}
                                            onChange={e => setSocials({ ...socials, x: e.target.value })}
                                        />
                                        <Input
                                            icon={Smartphone}
                                            placeholder="TikTok URL"
                                            value={socials.tiktok || ''}
                                            onChange={e => setSocials({ ...socials, tiktok: e.target.value })}
                                        />
                                        <Input
                                            icon={Youtube}
                                            placeholder="YouTube URL"
                                            value={socials.youtube || ''}
                                            onChange={e => setSocials({ ...socials, youtube: e.target.value })}
                                        />
                                    </div>
                                </div>
                            </div>
                        )}

                        <div className="mt-8 pt-6 border-t border-zinc-200 dark:border-zinc-800 flex justify-end">
                            <Button onClick={handleSave} isLoading={isSaving}>Save Changes</Button>
                        </div>
                    </Card>

                    {/* Explicit Logout Button for Mobile */}
                    <div className="pt-4">
                        <Button
                            variant="danger"
                            onClick={handleLogout}
                            className="w-full py-4 text-lg font-bold bg-red-500/10 hover:bg-red-500 border-red-500/20 text-red-500 hover:text-white transition-colors"
                        >
                            <LogOut size={20} className="mr-2" /> Log Out
                        </Button>
                    </div>
                </div>
            </div>
        </div>
    );
};
