
import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { StorageService } from '../services/storageService';
import { EmailService } from '../services/emailService';
import { User, EmailTemplate, Socials } from '../types';
import { Button, Input, Card, Switch, FileDropZone, Badge, RichTextarea } from './UI';
import { User as UserIcon, Settings as SettingsIcon, LogOut, Camera, Bell, ChevronRight, Palette, CreditCard, Shield, Mail, CheckCircle, XCircle, Plus, Trash2, LayoutTemplate, Globe, Instagram, Facebook, Twitter, Youtube, Smartphone } from 'lucide-react';

export const Settings = () => {
    const navigate = useNavigate();
    const [user, setUser] = useState<User | null>(null);
    const [activeTab, setActiveTab] = useState<'profile' | 'branding' | 'preferences' | 'organizer' | 'email' | 'page'>('profile');

    // Profile State
    const [name, setName] = useState('');
    const [email, setEmail] = useState('');
    const [businessName, setBusinessName] = useState('');
    const [organizerSubtitle, setOrganizerSubtitle] = useState('');
    const [useBusinessName, setUseBusinessName] = useState(false);
    const [logoUrl, setLogoUrl] = useState('');
    const [headerImageUrl, setHeaderImageUrl] = useState('');
    const [socials, setSocials] = useState<Socials>({});

    // Branding State
    const [primaryColor, setPrimaryColor] = useState('#E0FF20');

    // Organizer Defaults
    const [defaultRefundPolicy, setDefaultRefundPolicy] = useState('');
    const [defaultRefundPolicyEnabled, setDefaultRefundPolicyEnabled] = useState(false);
    const [defaultWaiver, setDefaultWaiver] = useState<{ enabled?: boolean, text?: string, pdfUrl?: string, fileName?: string }>({});

    // Email Marketing State
    const [gmailConfig, setGmailConfig] = useState<{ connected: boolean, email?: string, lastSynced?: number }>({ connected: false });
    const [emailTemplates, setEmailTemplates] = useState<EmailTemplate[]>([]);
    const [editingTemplate, setEditingTemplate] = useState<EmailTemplate | null>(null);
    const [isConnectingGmail, setIsConnectingGmail] = useState(false);

    // Preferences State
    const [desktopCamera, setDesktopCamera] = useState(false);
    const [notifications, setNotifications] = useState({ newOrder: true, reminder: true });

    const [isSaving, setIsSaving] = useState(false);

    useEffect(() => {
        const currentUser = StorageService.getCurrentUser();
        if (currentUser) {
            setUser(currentUser);
            setName(currentUser.name || '');
            setEmail(currentUser.email || '');
            setLogoUrl(currentUser.logoUrl || '');
            setHeaderImageUrl(currentUser.headerImageUrl || '');
            setBusinessName(currentUser.businessName || '');
            setOrganizerSubtitle(currentUser.organizerSubtitle || '');
            setUseBusinessName(currentUser.useBusinessName || false);
            setSocials(currentUser.socials || {});
            setPrimaryColor(currentUser.primaryColor || '#E0FF20');
            setDefaultRefundPolicy(currentUser.defaultRefundPolicy || '');
            setDefaultRefundPolicyEnabled(currentUser.defaultRefundPolicyEnabled || false);
            setDefaultWaiver(currentUser.defaultWaiver || {});

            // Email State
            setGmailConfig(currentUser.gmailConfig || { connected: false });
            setEmailTemplates(currentUser.emailTemplates || []);

            // Load local preferences
            const savedCamera = localStorage.getItem('openticket_desktop_camera') === 'true';
            setDesktopCamera(savedCamera);

            if (currentUser.notifications) {
                setNotifications(currentUser.notifications);
            }
        }
    }, []);

    const handleConnectGmail = async () => {
        if (!user) return;
        setIsConnectingGmail(true);
        try {
            const email = await EmailService.connectGmail(user.id);
            setGmailConfig({ connected: true, email: email, lastSynced: Date.now() });
            alert("Gmail connected successfully!");
        } catch (e: any) {
            alert("Failed to connect Gmail: " + e.message);
        } finally {
            setIsConnectingGmail(false);
        }
    };

    const handleDisconnectGmail = async () => {
        if (!user) return;
        if (confirm("Disconnect Gmail? You will no longer be able to send broadcasts.")) {
            await EmailService.disconnectGmail(user.id);
            setGmailConfig({ connected: false });
        }
    };

    const handleSaveTemplate = async (template: EmailTemplate) => {
        const updated = emailTemplates.some(t => t.id === template.id)
            ? emailTemplates.map(t => t.id === template.id ? template : t)
            : [...emailTemplates, template];

        setEmailTemplates(updated);
        setEditingTemplate(null);
        if (user) await StorageService.updateUser(user.id, { emailTemplates: updated });
    };

    const handleLoadDefaults = async () => {
        if (!confirm("Load default templates? This will add examples for Confirmation, Reminder, and Broadcast.")) return;
        const defaults: EmailTemplate[] = [
            {
                id: `tmpl-def-1`,
                type: 'confirmation',
                name: 'Default Confirmation',
                subject: 'Order Confirmation: {{event_title}}',
                body: `<p>Hi {{attendee_name}},</p><p>Thank you for your order! We are excited to see you at <strong>{{event_title}}</strong>.</p><p><strong>Event Details:</strong><br>Date: {{event_date}}<br>Location: {{event_location}}</p><p>Your tickets are attached to this email. Please present the QR code at the entrance.</p><p>See you there!</p>`
            },
            {
                id: `tmpl-def-2`,
                type: 'reminder',
                name: 'Standard Reminder',
                subject: 'Reminder: {{event_title}} is coming up!',
                body: `<p>Hi {{attendee_name}},</p><p>Just a quick reminder that <strong>{{event_title}}</strong> is happening soon!</p><p><strong>When:</strong> {{event_date}}<br><strong>Where:</strong> {{event_location}}</p><p>Don't forget to bring your ticket (QR code) for smooth entry.</p><p>We look forward to hosting you!</p>`
            },
            {
                id: `tmpl-def-3`,
                type: 'broadcast',
                name: 'Thank You Message',
                subject: 'Thank you for attending {{event_title}}',
                body: `<p>Hi {{attendee_name}},</p><p>Thank you for joining us at <strong>{{event_title}}</strong>! We hope you had a great time.</p><p>Stay tuned for our upcoming events.</p><p>Best regards,<br>The Organizers</p>`
            }
        ];

        const updated = [...emailTemplates, ...defaults];
        setEmailTemplates(updated);
        if (user) await StorageService.updateUser(user.id, { emailTemplates: updated });
    };

    const handleDeleteTemplate = async (id: string) => {
        if (confirm("Delete this template?")) {
            const updated = emailTemplates.filter(t => t.id !== id);
            setEmailTemplates(updated);
            if (user) await StorageService.updateUser(user.id, { emailTemplates: updated });
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
                organizerSubtitle,
                useBusinessName,
                logoUrl: finalLogoUrl,
                primaryColor,
                notifications,
                defaultRefundPolicy,
                defaultRefundPolicyEnabled,
                defaultWaiver: finalDefaultWaiver,
                emailTemplates: emailTemplates,
                headerImageUrl: finalHeaderImageUrl,
                socials: socials
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

            alert("Settings saved successfully!");
        } catch (e) {
            console.error(e);
            alert("Failed to save settings.");
        } finally {
            setIsSaving(false);
        }
    };

    const handleLogout = async () => {
        if (confirm("Are you sure you want to log out?")) {
            try {
                await StorageService.logout();
            } finally {
                navigate('/');
            }
        }
    };

    if (!user) return <div className="p-8 text-center text-zinc-500">Loading settings...</div>;

    const isPro = user.subscription?.plan === 'pro' || user.subscription?.plan === 'premium';

    return (
        <div className="max-w-5xl mx-auto py-12 px-4 pb-24">
            <div className="flex justify-between items-end mb-8">
                <h1 className="text-3xl font-black text-zinc-900 dark:text-white uppercase tracking-tight">Settings</h1>
                {!isPro && (
                    <div className="hidden md:block">
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
                                <h2 className="text-xl font-bold mb-4 text-zinc-900 dark:text-white">Profile Settings</h2>

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
                                            <div className="flex justify-end pt-4">
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
                                                    <div>
                                                        <div className="font-bold flex items-center gap-2">
                                                            {t.name}
                                                            <Badge color={t.type === 'confirmation' ? 'green' : t.type === 'broadcast' ? 'blue' : 'gray'}>{t.type}</Badge>
                                                        </div>
                                                        <div className="text-xs text-zinc-500 mt-1">{t.subject}</div>
                                                    </div>
                                                    <div className="flex gap-2">
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
                            </div>
                        )}

                        {activeTab === 'organizer' && (
                            <div className="space-y-6 animate-in fade-in">
                                <h2 className="text-xl font-bold mb-4 text-zinc-900 dark:text-white">Organizer Defaults</h2>
                                <p className="text-sm text-zinc-500 mb-6">These settings will be used as default values for new events.</p>

                                <div className="space-y-6">
                                    <div>
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

                                <div className="p-4 bg-zinc-50 dark:bg-zinc-900 rounded-xl border border-zinc-200 dark:border-zinc-800 flex justify-between items-center">
                                    <div>
                                        <h3 className="font-bold text-sm text-zinc-900 dark:text-white">Use Business Name publicly</h3>
                                        <p className="text-xs text-zinc-500">Enable to show your business name instead of your personal name on event pages.</p>
                                    </div>
                                    <Switch checked={useBusinessName} onChange={setUseBusinessName} />
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
