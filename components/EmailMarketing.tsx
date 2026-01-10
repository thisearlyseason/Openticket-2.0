import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { StorageService } from '../services/storageService';
import { Event } from '../types';
import { Button, Card, Input, Badge, RichTextarea } from './UI';
import { useConfirm } from './ConfirmContext';
import { 
    ArrowLeft, Mail, Send, Users, Clock, CheckCircle2, AlertCircle,
    Loader2, Plus, Calendar, Bell, ShoppingCart, Megaphone, 
    Settings, Eye, Trash2, Copy, ExternalLink, MailPlus, Target, Zap
} from 'lucide-react';

// Campaign types
export const CampaignTypes = {
    PRE_EVENT_REMINDER: 'pre_event_reminder',
    POST_EVENT_FOLLOWUP: 'post_event_followup',
    ABANDONED_CART: 'abandoned_cart',
    NEWSLETTER: 'newsletter',
    ANNOUNCEMENT: 'announcement'
};

interface EmailCampaign {
    id: string;
    name: string;
    type: string;
    subject: string;
    status: 'draft' | 'scheduled' | 'sent';
    recipients: number;
    openRate?: number;
    clickRate?: number;
    createdAt: Date;
    scheduledAt?: Date;
}

// Email template generators
const getPreEventReminderTemplate = (eventTitle: string, eventDate: string, location: string, eventUrl: string) => ({
    subject: `🎟️ Reminder: ${eventTitle} is coming up!`,
    htmlContent: `
        <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
            <h1 style="color: #ec4899;">Event Reminder</h1>
            <p>Hi there!</p>
            <p>Just a friendly reminder that <strong>${eventTitle}</strong> is coming up soon!</p>
            <div style="background: #f3f4f6; padding: 20px; border-radius: 8px; margin: 20px 0;">
                <p><strong>📅 Date:</strong> ${eventDate}</p>
                <p><strong>📍 Location:</strong> ${location}</p>
            </div>
            <p>Don't forget to bring your ticket!</p>
            <a href="${eventUrl}" style="display: inline-block; background: #ec4899; color: white; padding: 12px 24px; border-radius: 8px; text-decoration: none;">View Event Details</a>
        </div>
    `,
    textContent: `Reminder: ${eventTitle} is on ${eventDate} at ${location}. View details: ${eventUrl}`
});

const getPostEventFollowupTemplate = (eventTitle: string) => ({
    subject: `🙏 Thank you for attending ${eventTitle}!`,
    htmlContent: `
        <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
            <h1 style="color: #ec4899;">Thank You!</h1>
            <p>Hi there!</p>
            <p>Thank you for attending <strong>${eventTitle}</strong>! We hope you had a great time.</p>
            <p>We'd love to hear your feedback. Please take a moment to let us know how we did.</p>
            <p>Hope to see you at our next event!</p>
        </div>
    `,
    textContent: `Thank you for attending ${eventTitle}! We hope you had a great time.`
});

const getAbandonedCartTemplate = (eventTitle: string, eventUrl: string) => ({
    subject: `🎫 Don't miss out on ${eventTitle}!`,
    htmlContent: `
        <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
            <h1 style="color: #ec4899;">Complete Your Purchase</h1>
            <p>Hi there!</p>
            <p>We noticed you didn't complete your ticket purchase for <strong>${eventTitle}</strong>.</p>
            <p>Tickets are selling fast - don't miss your chance to attend!</p>
            <a href="${eventUrl}" style="display: inline-block; background: #ec4899; color: white; padding: 12px 24px; border-radius: 8px; text-decoration: none;">Get Your Tickets Now</a>
        </div>
    `,
    textContent: `Complete your ticket purchase for ${eventTitle}. Get tickets: ${eventUrl}`
});

const getNewsletterTemplate = (title: string, content: string) => ({
    subject: title,
    htmlContent: `
        <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
            <h1 style="color: #ec4899;">${title}</h1>
            ${content}
        </div>
    `,
    textContent: content.replace(/<[^>]*>/g, '')
});

export const EmailMarketing = () => {
    const navigate = useNavigate();
    const [isLoading, setIsLoading] = useState(true);
    const [isConnected, setIsConnected] = useState(false);
    const [isTestingConnection, setIsTestingConnection] = useState(false);
    const [events, setEvents] = useState<Event[]>([]);
    const [campaigns, setCampaigns] = useState<EmailCampaign[]>([]);
    const [emailServiceStatus, setEmailServiceStatus] = useState<any>(null);
    
    // Campaign creation state
    const [showCreateCampaign, setShowCreateCampaign] = useState(false);
    const [campaignType, setCampaignType] = useState<string>(CampaignTypes.NEWSLETTER);
    const [selectedEvent, setSelectedEvent] = useState<string>('');
    const [campaignName, setCampaignName] = useState('');
    const [emailSubject, setEmailSubject] = useState('');
    const [emailContent, setEmailContent] = useState('');
    const [isSending, setIsSending] = useState(false);

    useEffect(() => {
        loadData();
    }, []);

    const loadData = async () => {
        const user = StorageService.getCurrentUser();
        if (!user) {
            navigate('/auth');
            return;
        }

        // Check email service status
        try {
            const response = await fetch('/api/email/status');
            const status = await response.json();
            setEmailServiceStatus(status);
            setIsConnected(status.configured && status.available);
        } catch (error) {
            console.error('Failed to check email status:', error);
            setIsConnected(false);
        }

        // Load events
        const allEvents = await StorageService.getEvents();
        setEvents(allEvents.filter(e => e.ownerId === user.id));

        // Load saved campaigns from localStorage
        const savedCampaigns = localStorage.getItem('email_campaigns');
        if (savedCampaigns) {
            setCampaigns(JSON.parse(savedCampaigns));
        }

        setIsLoading(false);
    };

    const testConnection = async () => {
        setIsTestingConnection(true);
        try {
            const response = await fetch('/api/email/status');
            const status = await response.json();
            setEmailServiceStatus(status);
            setIsConnected(status.configured && status.available);
            
            if (status.configured) {
                window.alert('✅ Email service is connected and ready!');
            } else {
                window.alert('⚠️ Email service is not configured. Contact your administrator.');
            }
        } catch (error) {
            window.alert('❌ Failed to connect to email service');
        } finally {
            setIsTestingConnection(false);
        }
    };

    const getTemplate = () => {
        const event = events.find(e => e.id === selectedEvent);
        const eventTitle = event?.title || 'Your Event';
        const eventDate = event ? new Date(event.date).toLocaleString() : '';
        const location = event?.location || 'TBA';
        const baseUrl = window.location.origin;

        switch (campaignType) {
            case CampaignTypes.PRE_EVENT_REMINDER:
                return getPreEventReminderTemplate(eventTitle, eventDate, location, `${baseUrl}/#/event/${selectedEvent}`);
            case CampaignTypes.POST_EVENT_FOLLOWUP:
                return getPostEventFollowupTemplate(eventTitle);
            case CampaignTypes.ABANDONED_CART:
                return getAbandonedCartTemplate(eventTitle, `${baseUrl}/#/event/${selectedEvent}`);
            default:
                return getNewsletterTemplate(emailSubject || 'Newsletter', emailContent);
        }
    };

    const loadTemplate = () => {
        const template = getTemplate();
        setEmailSubject(template.subject);
        setEmailContent(template.textContent || '');
    };

    const createCampaign = async () => {
        if (!campaignName || !emailSubject || !emailContent) {
            window.alert('Please fill in all required fields');
            return;
        }

        setIsSending(true);

        try {
            // Save campaign locally
            const campaign: EmailCampaign = {
                id: `campaign_${Date.now()}`,
                name: campaignName,
                type: campaignType,
                subject: emailSubject,
                status: 'draft',
                recipients: 0,
                createdAt: new Date()
            };

            const updatedCampaigns = [...campaigns, campaign];
            setCampaigns(updatedCampaigns);
            localStorage.setItem('email_campaigns', JSON.stringify(updatedCampaigns));

            // Reset form
            setShowCreateCampaign(false);
            setCampaignName('');
            setEmailSubject('');
            setEmailContent('');
            setSelectedEvent('');

            window.alert('Campaign created successfully!');
        } catch (error: any) {
            console.error('Failed to create campaign:', error);
            window.alert(`Failed to create campaign: ${error.message}`);
        } finally {
            setIsSending(false);
        }
    };

    const sendTestEmail = async () => {
        const user = StorageService.getCurrentUser();
        if (!user?.email) {
            window.alert('No email address found. Please update your profile.');
            return;
        }

        setIsSending(true);
        try {
            const template = getTemplate();
            const response = await fetch('/api/email/send-test', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    to: user.email,
                    template: {
                        subject: emailSubject || template.subject,
                        body: template.htmlContent,
                        name: campaignName,
                        type: campaignType
                    }
                })
            });

            const result = await response.json();
            
            if (result.preview) {
                window.alert(`📧 Email Preview Generated!\n\nSubject: ${result.previewData?.subject}\n\nNote: To send real emails, ensure RESEND_API_KEY is configured.`);
            } else if (result.success) {
                window.alert(`✅ Test email sent to ${user.email}!`);
            } else {
                window.alert(`❌ Failed to send: ${result.error}`);
            }
        } catch (error: any) {
            window.alert(`Failed to send test email: ${error.message}`);
        } finally {
            setIsSending(false);
        }
    };

    const deleteCampaign = (id: string) => {
        if (!window.confirm('Are you sure you want to delete this campaign?')) return;
        
        const updatedCampaigns = campaigns.filter(c => c.id !== id);
        setCampaigns(updatedCampaigns);
        localStorage.setItem('email_campaigns', JSON.stringify(updatedCampaigns));
    };

    const getCampaignIcon = (type: string) => {
        switch (type) {
            case CampaignTypes.PRE_EVENT_REMINDER: return <Bell size={16} />;
            case CampaignTypes.POST_EVENT_FOLLOWUP: return <CheckCircle2 size={16} />;
            case CampaignTypes.ABANDONED_CART: return <ShoppingCart size={16} />;
            case CampaignTypes.NEWSLETTER: return <Mail size={16} />;
            case CampaignTypes.ANNOUNCEMENT: return <Megaphone size={16} />;
            default: return <Mail size={16} />;
        }
    };

    const getCampaignTypeName = (type: string) => {
        switch (type) {
            case CampaignTypes.PRE_EVENT_REMINDER: return 'Pre-Event Reminder';
            case CampaignTypes.POST_EVENT_FOLLOWUP: return 'Post-Event Follow-up';
            case CampaignTypes.ABANDONED_CART: return 'Abandoned Cart';
            case CampaignTypes.NEWSLETTER: return 'Newsletter';
            case CampaignTypes.ANNOUNCEMENT: return 'Announcement';
            default: return type;
        }
    };

    if (isLoading) {
        return (
            <div className="min-h-screen flex items-center justify-center bg-zinc-50 dark:bg-black">
                <Loader2 className="w-8 h-8 animate-spin text-[#ec4899]" />
            </div>
        );
    }

    return (
        <div className="min-h-screen bg-zinc-50 dark:bg-black pb-24">
            {/* Header */}
            <div className="bg-white dark:bg-zinc-900 border-b border-zinc-200 dark:border-zinc-800 sticky top-0 z-20">
                <div className="max-w-6xl mx-auto px-4 py-4">
                    <div className="flex items-center justify-between">
                        <div className="flex items-center gap-4">
                            <button onClick={() => navigate('/dashboard')} className="text-zinc-500 hover:text-zinc-900 dark:hover:text-white">
                                <ArrowLeft size={20} />
                            </button>
                            <div>
                                <h1 className="text-2xl font-black text-zinc-900 dark:text-white flex items-center gap-2">
                                    <Mail className="text-[#ec4899]" />
                                    Email Marketing
                                </h1>
                                <p className="text-sm text-zinc-500">Engage your attendees with targeted campaigns</p>
                            </div>
                        </div>

                        {isConnected && (
                            <Button onClick={() => setShowCreateCampaign(true)} className="flex items-center gap-2">
                                <Plus size={16} /> New Campaign
                            </Button>
                        )}
                    </div>
                </div>
            </div>

            <div className="max-w-6xl mx-auto px-4 py-6">
                {/* Connection Status Card */}
                <Card className="p-6 mb-6">
                    <div className="flex items-center justify-between">
                        <div className="flex items-center gap-4">
                            <div className={`w-12 h-12 rounded-xl flex items-center justify-center ${isConnected ? 'bg-green-100 dark:bg-green-900/30' : 'bg-zinc-100 dark:bg-zinc-800'}`}>
                                {isConnected ? (
                                    <CheckCircle2 size={24} className="text-green-600" />
                                ) : (
                                    <AlertCircle size={24} className="text-zinc-400" />
                                )}
                            </div>
                            <div>
                                <h3 className="font-bold text-zinc-900 dark:text-white">
                                    {isConnected ? 'Resend Email Service Connected' : 'Email Service Status'}
                                </h3>
                                <p className="text-sm text-zinc-500">
                                    {isConnected 
                                        ? `Ready to send emails via Resend` 
                                        : emailServiceStatus?.message || 'Checking connection...'}
                                </p>
                            </div>
                        </div>
                        <Button variant="outline" onClick={testConnection} disabled={isTestingConnection}>
                            {isTestingConnection ? <Loader2 size={16} className="animate-spin" /> : <Zap size={16} />}
                            <span className="ml-2">{isTestingConnection ? 'Checking...' : 'Test Connection'}</span>
                        </Button>
                    </div>

                    {!isConnected && (
                        <div className="mt-4 p-4 bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-800 rounded-xl">
                            <p className="text-sm text-amber-800 dark:text-amber-200">
                                <strong>Note:</strong> Email service requires RESEND_API_KEY to be configured by your administrator. 
                                You can still create campaigns and send test previews.
                            </p>
                        </div>
                    )}
                </Card>

                {/* Quick Actions */}
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
                    <QuickActionCard
                        icon={<Bell className="text-blue-500" />}
                        title="Pre-Event Reminder"
                        description="Remind attendees about upcoming events"
                        onClick={() => { setCampaignType(CampaignTypes.PRE_EVENT_REMINDER); setShowCreateCampaign(true); }}
                    />
                    <QuickActionCard
                        icon={<CheckCircle2 className="text-green-500" />}
                        title="Post-Event Follow-up"
                        description="Thank attendees and gather feedback"
                        onClick={() => { setCampaignType(CampaignTypes.POST_EVENT_FOLLOWUP); setShowCreateCampaign(true); }}
                    />
                    <QuickActionCard
                        icon={<ShoppingCart className="text-orange-500" />}
                        title="Abandoned Cart"
                        description="Recover incomplete purchases"
                        onClick={() => { setCampaignType(CampaignTypes.ABANDONED_CART); setShowCreateCampaign(true); }}
                    />
                    <QuickActionCard
                        icon={<Megaphone className="text-purple-500" />}
                        title="Announcement"
                        description="Send news and updates"
                        onClick={() => { setCampaignType(CampaignTypes.ANNOUNCEMENT); setShowCreateCampaign(true); }}
                    />
                </div>

                {/* Campaigns List */}
                <Card className="p-6">
                    <h3 className="font-bold text-zinc-900 dark:text-white mb-4 flex items-center gap-2">
                        <Mail size={18} /> Your Campaigns
                    </h3>

                    {campaigns.length === 0 ? (
                        <div className="text-center py-12 text-zinc-500">
                            <MailPlus size={48} className="mx-auto mb-4 opacity-50" />
                            <p>No campaigns yet. Create your first campaign above!</p>
                        </div>
                    ) : (
                        <div className="space-y-3">
                            {campaigns.map(campaign => (
                                <div key={campaign.id} className="flex items-center justify-between p-4 bg-zinc-50 dark:bg-zinc-800 rounded-xl">
                                    <div className="flex items-center gap-4">
                                        <div className="w-10 h-10 rounded-lg bg-[#ec4899]/10 flex items-center justify-center text-[#ec4899]">
                                            {getCampaignIcon(campaign.type)}
                                        </div>
                                        <div>
                                            <p className="font-bold text-zinc-900 dark:text-white">{campaign.name}</p>
                                            <p className="text-sm text-zinc-500">{getCampaignTypeName(campaign.type)} • {campaign.subject}</p>
                                        </div>
                                    </div>
                                    <div className="flex items-center gap-3">
                                        <Badge color={campaign.status === 'sent' ? 'green' : campaign.status === 'scheduled' ? 'blue' : 'gray'}>
                                            {campaign.status}
                                        </Badge>
                                        <Button variant="ghost" size="sm" onClick={() => deleteCampaign(campaign.id)}>
                                            <Trash2 size={14} />
                                        </Button>
                                    </div>
                                </div>
                            ))}
                        </div>
                    )}
                </Card>
            </div>

            {/* Create Campaign Modal */}
            {showCreateCampaign && (
                <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
                    <Card className="max-w-2xl w-full max-h-[90vh] overflow-y-auto p-6">
                        <div className="flex items-center justify-between mb-6">
                            <h2 className="text-xl font-bold text-zinc-900 dark:text-white">Create Campaign</h2>
                            <button onClick={() => setShowCreateCampaign(false)} className="text-zinc-400 hover:text-zinc-900 dark:hover:text-white">
                                ✕
                            </button>
                        </div>

                        <div className="space-y-4">
                            {/* Campaign Type */}
                            <div>
                                <label className="block text-xs font-bold text-zinc-500 uppercase mb-2">Campaign Type</label>
                                <select
                                    value={campaignType}
                                    onChange={e => setCampaignType(e.target.value)}
                                    className="w-full bg-white dark:bg-zinc-800 border border-zinc-200 dark:border-zinc-700 rounded-xl px-4 py-3"
                                >
                                    <option value={CampaignTypes.NEWSLETTER}>Newsletter</option>
                                    <option value={CampaignTypes.PRE_EVENT_REMINDER}>Pre-Event Reminder</option>
                                    <option value={CampaignTypes.POST_EVENT_FOLLOWUP}>Post-Event Follow-up</option>
                                    <option value={CampaignTypes.ABANDONED_CART}>Abandoned Cart</option>
                                    <option value={CampaignTypes.ANNOUNCEMENT}>Announcement</option>
                                </select>
                            </div>

                            {/* Event Selection (for event-specific campaigns) */}
                            {[CampaignTypes.PRE_EVENT_REMINDER, CampaignTypes.POST_EVENT_FOLLOWUP, CampaignTypes.ABANDONED_CART].includes(campaignType) && (
                                <div>
                                    <label className="block text-xs font-bold text-zinc-500 uppercase mb-2">Select Event</label>
                                    <select
                                        value={selectedEvent}
                                        onChange={e => setSelectedEvent(e.target.value)}
                                        className="w-full bg-white dark:bg-zinc-800 border border-zinc-200 dark:border-zinc-700 rounded-xl px-4 py-3"
                                    >
                                        <option value="">Select an event...</option>
                                        {events.map(event => (
                                            <option key={event.id} value={event.id}>{event.title}</option>
                                        ))}
                                    </select>
                                </div>
                            )}

                            <Input
                                label="Campaign Name"
                                value={campaignName}
                                onChange={e => setCampaignName(e.target.value)}
                                placeholder="e.g., March Newsletter"
                            />

                            <Input
                                label="Email Subject"
                                value={emailSubject}
                                onChange={e => setEmailSubject(e.target.value)}
                                placeholder="e.g., Exciting news from us!"
                            />

                            <div>
                                <label className="block text-xs font-bold text-zinc-500 uppercase mb-2">Email Content</label>
                                <RichTextarea
                                    value={emailContent}
                                    onChange={setEmailContent}
                                    placeholder="Write your email content here..."
                                />
                            </div>

                            {/* Template Helper */}
                            <Button variant="outline" onClick={loadTemplate} className="w-full">
                                <Copy size={14} className="mr-2" /> Load Template
                            </Button>

                            <div className="flex gap-3 pt-4 border-t border-zinc-200 dark:border-zinc-700">
                                <Button variant="outline" onClick={sendTestEmail} disabled={isSending} className="flex-1">
                                    {isSending ? <Loader2 size={16} className="animate-spin mr-2" /> : <Send size={16} className="mr-2" />}
                                    Send Test Email
                                </Button>
                                <Button onClick={createCampaign} disabled={isSending} className="flex-1">
                                    {isSending ? <Loader2 size={16} className="animate-spin mr-2" /> : <Plus size={16} className="mr-2" />}
                                    Create Campaign
                                </Button>
                            </div>
                        </div>
                    </Card>
                </div>
            )}
        </div>
    );
};

// Quick Action Card Component
const QuickActionCard = ({ icon, title, description, onClick }: { icon: React.ReactNode; title: string; description: string; onClick: () => void }) => (
    <Card className="p-4 hover:border-[#ec4899] cursor-pointer transition-colors" onClick={onClick}>
        <div className="flex items-start gap-3">
            <div className="w-10 h-10 rounded-lg bg-zinc-100 dark:bg-zinc-800 flex items-center justify-center">
                {icon}
            </div>
            <div>
                <h4 className="font-bold text-zinc-900 dark:text-white text-sm">{title}</h4>
                <p className="text-xs text-zinc-500">{description}</p>
            </div>
        </div>
    </Card>
);

export default EmailMarketing;
