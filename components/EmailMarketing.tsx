import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { StorageService } from '../services/storageService';
import { mailerliteService, CampaignTypes } from '../services/mailerliteService';
import { Event, Registration } from '../types';
import { Button, Card, Input, Badge, RichTextarea } from './UI';
import { 
    ArrowLeft, Mail, Send, Users, Clock, CheckCircle2, AlertCircle,
    Loader2, Plus, Calendar, Bell, ShoppingCart, Megaphone, 
    Settings, Eye, Trash2, Copy, ExternalLink, MailPlus, Target
} from 'lucide-react';

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

export const EmailMarketing = () => {
    const navigate = useNavigate();
    const [isLoading, setIsLoading] = useState(true);
    const [apiKey, setApiKey] = useState('');
    const [isConnected, setIsConnected] = useState(false);
    const [isTestingConnection, setIsTestingConnection] = useState(false);
    const [events, setEvents] = useState<Event[]>([]);
    const [campaigns, setCampaigns] = useState<EmailCampaign[]>([]);
    const [groups, setGroups] = useState<any[]>([]);
    
    // Campaign creation state
    const [showCreateCampaign, setShowCreateCampaign] = useState(false);
    const [campaignType, setCampaignType] = useState<string>(CampaignTypes.NEWSLETTER);
    const [selectedEvent, setSelectedEvent] = useState<string>('');
    const [campaignName, setCampaignName] = useState('');
    const [emailSubject, setEmailSubject] = useState('');
    const [emailContent, setEmailContent] = useState('');
    const [selectedGroup, setSelectedGroup] = useState('');
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

        // Check for platform API key first, then organizer's own key
        const platformApiKey = localStorage.getItem('platform_mailerlite_key');
        const savedApiKey = localStorage.getItem('mailerlite_api_key') || platformApiKey;
        
        if (savedApiKey) {
            setApiKey(savedApiKey);
            mailerliteService.configure(savedApiKey);
            const connected = await mailerliteService.testConnection();
            setIsConnected(connected);
            
            if (connected) {
                // Load groups from Mailerlite
                try {
                    const groupsData = await mailerliteService.getGroups();
                    setGroups(groupsData.data || []);
                } catch (error) {
                    console.error('Failed to load groups:', error);
                }
            }
        }

        // Load events
        const allEvents = await StorageService.getEvents();
        setEvents(allEvents.filter(e => e.ownerId === user.id));

        // Load saved campaigns from local storage (in production, store in DB)
        const savedCampaigns = localStorage.getItem('email_campaigns');
        if (savedCampaigns) {
            setCampaigns(JSON.parse(savedCampaigns));
        }

        setIsLoading(false);
    };

    const testConnection = async () => {
        if (!apiKey) return;
        
        setIsTestingConnection(true);
        mailerliteService.configure(apiKey);
        
        const connected = await mailerliteService.testConnection();
        setIsConnected(connected);
        
        if (connected) {
            localStorage.setItem('mailerlite_api_key', apiKey);
            // Load groups
            try {
                const groupsData = await mailerliteService.getGroups();
                setGroups(groupsData.data || []);
            } catch (error) {
                console.error('Failed to load groups:', error);
            }
        }
        
        setIsTestingConnection(false);
    };

    const disconnectApi = () => {
        localStorage.removeItem('mailerlite_api_key');
        setApiKey('');
        setIsConnected(false);
        setGroups([]);
    };

    const getTemplateForCampaignType = () => {
        const event = events.find(e => e.id === selectedEvent);
        const eventTitle = event?.title || 'Your Event';
        const eventDate = event ? new Date(event.date).toLocaleString() : '';
        const eventLocation = event?.location || 'TBA';
        const baseUrl = window.location.origin;

        switch (campaignType) {
            case CampaignTypes.PRE_EVENT_REMINDER:
                return mailerliteService.getPreEventReminderTemplate(
                    eventTitle, eventDate, eventLocation, `${baseUrl}/#/event/${selectedEvent}`
                );
            case CampaignTypes.POST_EVENT_FOLLOWUP:
                return mailerliteService.getPostEventFollowupTemplate(eventTitle);
            case CampaignTypes.ABANDONED_CART:
                return mailerliteService.getAbandonedCartTemplate(
                    eventTitle, `${baseUrl}/#/event/${selectedEvent}`
                );
            default:
                return mailerliteService.getNewsletterTemplate(
                    emailSubject || 'Newsletter', emailContent
                );
        }
    };

    const loadTemplate = () => {
        const template = getTemplateForCampaignType();
        setEmailSubject(template.subject);
        setEmailContent(template.textContent || '');
    };

    const createCampaign = async () => {
        if (!campaignName || !emailSubject || !emailContent) {
            alert('Please fill in all required fields');
            return;
        }

        setIsSending(true);

        try {
            const template = getTemplateForCampaignType();
            
            // Create campaign in Mailerlite (if connected)
            if (isConnected && selectedGroup) {
                await mailerliteService.createCampaign({
                    name: campaignName,
                    type: campaignType,
                    subject: emailSubject,
                    content: { html: template.htmlContent, plain: emailContent },
                    groups: [selectedGroup]
                });
            }

            // Save campaign locally
            const newCampaign: EmailCampaign = {
                id: `campaign_${Date.now()}`,
                name: campaignName,
                type: campaignType,
                subject: emailSubject,
                status: 'draft',
                recipients: 0,
                createdAt: new Date()
            };

            const updatedCampaigns = [...campaigns, newCampaign];
            setCampaigns(updatedCampaigns);
            localStorage.setItem('email_campaigns', JSON.stringify(updatedCampaigns));

            // Reset form
            setShowCreateCampaign(false);
            setCampaignName('');
            setEmailSubject('');
            setEmailContent('');
            setSelectedEvent('');
            setSelectedGroup('');

            alert('Campaign created successfully!');
        } catch (error: any) {
            console.error('Failed to create campaign:', error);
            alert(`Failed to create campaign: ${error.message}`);
        } finally {
            setIsSending(false);
        }
    };

    const syncEventAttendees = async (eventId: string) => {
        if (!isConnected) {
            alert('Please connect your Mailerlite account first');
            return;
        }

        const event = events.find(e => e.id === eventId);
        if (!event) return;

        setIsLoading(true);

        try {
            // Get registrations for this event
            const registrations = await StorageService.getRegistrations(eventId);
            
            // Create or get group for this event
            const groupName = `Event: ${event.title}`;
            let group;
            
            try {
                const groupsResponse = await mailerliteService.getGroups();
                group = groupsResponse.data?.find((g: any) => g.name === groupName);
            } catch {
                // Group doesn't exist
            }

            if (!group) {
                const newGroup = await mailerliteService.createGroup(groupName);
                group = newGroup.data;
            }

            // Add subscribers
            const subscribers = registrations.map(r => ({
                email: r.attendeeEmail,
                name: r.attendeeName,
                fields: {
                    event_name: event.title,
                    event_date: new Date(event.date).toISOString()
                }
            }));

            if (subscribers.length > 0) {
                await mailerliteService.bulkAddSubscribers(subscribers, group.id);
            }

            // Refresh groups
            const groupsData = await mailerliteService.getGroups();
            setGroups(groupsData.data || []);

            alert(`Synced ${subscribers.length} attendees to Mailerlite!`);
        } catch (error: any) {
            console.error('Failed to sync attendees:', error);
            alert(`Failed to sync: ${error.message}`);
        } finally {
            setIsLoading(false);
        }
    };

    const deleteCampaign = (campaignId: string) => {
        if (!confirm('Are you sure you want to delete this campaign?')) return;
        
        const updatedCampaigns = campaigns.filter(c => c.id !== campaignId);
        setCampaigns(updatedCampaigns);
        localStorage.setItem('email_campaigns', JSON.stringify(updatedCampaigns));
    };

    const getCampaignTypeIcon = (type: string) => {
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
                {/* Connection Status */}
                <Card className="p-6 mb-6">
                    <div className="flex items-center justify-between">
                        <div className="flex items-center gap-4">
                            <div className={`w-12 h-12 rounded-xl flex items-center justify-center ${isConnected ? 'bg-green-100 dark:bg-green-900/30' : 'bg-zinc-100 dark:bg-zinc-800'}`}>
                                {isConnected ? (
                                    <CheckCircle2 size={24} className="text-green-600" />
                                ) : (
                                    <Settings size={24} className="text-zinc-400" />
                                )}
                            </div>
                            <div>
                                <h3 className="font-bold text-zinc-900 dark:text-white">
                                    {isConnected ? 'Connected to Mailerlite' : 'Connect Mailerlite'}
                                </h3>
                                <p className="text-sm text-zinc-500">
                                    {isConnected ? 'Your email marketing is ready' : 'Enter your API key to get started'}
                                </p>
                            </div>
                        </div>
                        {isConnected && (
                            <Button variant="ghost" onClick={disconnectApi} className="text-red-500">
                                Disconnect
                            </Button>
                        )}
                    </div>

                    {!isConnected && (
                        <div className="mt-4 flex gap-3">
                            <Input
                                type="password"
                                value={apiKey}
                                onChange={(e) => setApiKey(e.target.value)}
                                placeholder="Enter your Mailerlite API key"
                                className="flex-1"
                            />
                            <Button onClick={testConnection} disabled={isTestingConnection || !apiKey}>
                                {isTestingConnection ? <Loader2 size={16} className="animate-spin" /> : 'Connect'}
                            </Button>
                        </div>
                    )}

                    {!isConnected && (
                        <p className="text-xs text-zinc-400 mt-3">
                            Get your API key from{' '}
                            <a href="https://www.mailerlite.com/help/where-to-find-the-mailerlite-api-key-groupid-and-documentation" target="_blank" className="text-[#ec4899] underline">
                                Mailerlite → Integrations → API
                            </a>
                        </p>
                    )}
                </Card>

                {/* Quick Actions */}
                {isConnected && (
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
                )}

                {/* Sync Attendees */}
                {isConnected && events.length > 0 && (
                    <Card className="p-6 mb-6">
                        <h3 className="font-bold text-zinc-900 dark:text-white mb-4 flex items-center gap-2">
                            <Users size={18} /> Sync Event Attendees
                        </h3>
                        <p className="text-sm text-zinc-500 mb-4">
                            Import your event attendees into Mailerlite for targeted campaigns
                        </p>
                        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
                            {events.slice(0, 6).map(event => (
                                <div key={event.id} className="flex items-center justify-between p-3 bg-zinc-50 dark:bg-zinc-800 rounded-xl">
                                    <div className="flex-1 min-w-0 mr-3">
                                        <p className="font-medium text-zinc-900 dark:text-white text-sm truncate">{event.title}</p>
                                        <p className="text-xs text-zinc-500">{new Date(event.date).toLocaleDateString()}</p>
                                    </div>
                                    <Button size="sm" variant="ghost" onClick={() => syncEventAttendees(event.id)}>
                                        <MailPlus size={14} />
                                    </Button>
                                </div>
                            ))}
                        </div>
                    </Card>
                )}

                {/* Campaigns List */}
                <Card className="p-6">
                    <h3 className="font-bold text-zinc-900 dark:text-white mb-4 flex items-center gap-2">
                        <Target size={18} /> Campaigns
                    </h3>
                    
                    {campaigns.length > 0 ? (
                        <div className="space-y-3">
                            {campaigns.map(campaign => (
                                <div key={campaign.id} className="flex items-center justify-between p-4 bg-zinc-50 dark:bg-zinc-800 rounded-xl">
                                    <div className="flex items-center gap-3">
                                        <div className="w-10 h-10 bg-white dark:bg-zinc-700 rounded-lg flex items-center justify-center">
                                            {getCampaignTypeIcon(campaign.type)}
                                        </div>
                                        <div>
                                            <p className="font-bold text-zinc-900 dark:text-white">{campaign.name}</p>
                                            <p className="text-xs text-zinc-500">{getCampaignTypeName(campaign.type)} • {new Date(campaign.createdAt).toLocaleDateString()}</p>
                                        </div>
                                    </div>
                                    <div className="flex items-center gap-2">
                                        <Badge className={campaign.status === 'sent' ? 'bg-green-100 text-green-700' : campaign.status === 'scheduled' ? 'bg-blue-100 text-blue-700' : 'bg-zinc-200 text-zinc-700'}>
                                            {campaign.status}
                                        </Badge>
                                        <Button variant="ghost" size="sm" onClick={() => deleteCampaign(campaign.id)}>
                                            <Trash2 size={14} className="text-red-500" />
                                        </Button>
                                    </div>
                                </div>
                            ))}
                        </div>
                    ) : (
                        <div className="text-center py-12 text-zinc-400">
                            <Mail size={48} className="mx-auto mb-4 opacity-50" />
                            <p>No campaigns yet</p>
                            <p className="text-sm mt-1">Create your first campaign to engage your audience</p>
                        </div>
                    )}
                </Card>
            </div>

            {/* Create Campaign Modal */}
            {showCreateCampaign && (
                <div className="fixed inset-0 z-50 bg-black/50 flex items-center justify-center p-4">
                    <Card className="w-full max-w-2xl max-h-[90vh] overflow-y-auto">
                        <div className="p-6 border-b border-zinc-200 dark:border-zinc-800">
                            <h2 className="text-xl font-bold text-zinc-900 dark:text-white">Create Campaign</h2>
                        </div>
                        <div className="p-6 space-y-4">
                            <div>
                                <label className="block text-sm font-bold text-zinc-700 dark:text-zinc-300 mb-2">Campaign Type</label>
                                <select
                                    value={campaignType}
                                    onChange={(e) => setCampaignType(e.target.value)}
                                    className="w-full p-3 bg-zinc-100 dark:bg-zinc-800 border border-zinc-200 dark:border-zinc-700 rounded-xl"
                                >
                                    <option value={CampaignTypes.PRE_EVENT_REMINDER}>Pre-Event Reminder</option>
                                    <option value={CampaignTypes.POST_EVENT_FOLLOWUP}>Post-Event Follow-up</option>
                                    <option value={CampaignTypes.ABANDONED_CART}>Abandoned Cart Recovery</option>
                                    <option value={CampaignTypes.NEWSLETTER}>Newsletter</option>
                                    <option value={CampaignTypes.ANNOUNCEMENT}>Announcement</option>
                                </select>
                            </div>

                            {(campaignType === CampaignTypes.PRE_EVENT_REMINDER || 
                              campaignType === CampaignTypes.POST_EVENT_FOLLOWUP ||
                              campaignType === CampaignTypes.ABANDONED_CART) && (
                                <div>
                                    <label className="block text-sm font-bold text-zinc-700 dark:text-zinc-300 mb-2">Select Event</label>
                                    <select
                                        value={selectedEvent}
                                        onChange={(e) => setSelectedEvent(e.target.value)}
                                        className="w-full p-3 bg-zinc-100 dark:bg-zinc-800 border border-zinc-200 dark:border-zinc-700 rounded-xl"
                                    >
                                        <option value="">Choose an event...</option>
                                        {events.map(event => (
                                            <option key={event.id} value={event.id}>{event.title}</option>
                                        ))}
                                    </select>
                                </div>
                            )}

                            <div>
                                <label className="block text-sm font-bold text-zinc-700 dark:text-zinc-300 mb-2">Campaign Name</label>
                                <Input
                                    value={campaignName}
                                    onChange={(e) => setCampaignName(e.target.value)}
                                    placeholder="e.g., Summer Festival Reminder"
                                />
                            </div>

                            {groups.length > 0 && (
                                <div>
                                    <label className="block text-sm font-bold text-zinc-700 dark:text-zinc-300 mb-2">Recipient Group</label>
                                    <select
                                        value={selectedGroup}
                                        onChange={(e) => setSelectedGroup(e.target.value)}
                                        className="w-full p-3 bg-zinc-100 dark:bg-zinc-800 border border-zinc-200 dark:border-zinc-700 rounded-xl"
                                    >
                                        <option value="">Select a group...</option>
                                        {groups.map((group: any) => (
                                            <option key={group.id} value={group.id}>
                                                {group.name} ({group.active_count || 0} subscribers)
                                            </option>
                                        ))}
                                    </select>
                                </div>
                            )}

                            <div>
                                <div className="flex items-center justify-between mb-2">
                                    <label className="text-sm font-bold text-zinc-700 dark:text-zinc-300">Email Subject</label>
                                    <Button variant="ghost" size="sm" onClick={loadTemplate} className="text-xs">
                                        Load Template
                                    </Button>
                                </div>
                                <Input
                                    value={emailSubject}
                                    onChange={(e) => setEmailSubject(e.target.value)}
                                    placeholder="Subject line..."
                                />
                            </div>

                            <div>
                                <label className="block text-sm font-bold text-zinc-700 dark:text-zinc-300 mb-2">Email Content</label>
                                <textarea
                                    value={emailContent}
                                    onChange={(e) => setEmailContent(e.target.value)}
                                    placeholder="Write your message..."
                                    rows={6}
                                    className="w-full p-3 bg-zinc-100 dark:bg-zinc-800 border border-zinc-200 dark:border-zinc-700 rounded-xl resize-none"
                                />
                            </div>
                        </div>
                        <div className="p-6 border-t border-zinc-200 dark:border-zinc-800 flex justify-end gap-3">
                            <Button variant="ghost" onClick={() => setShowCreateCampaign(false)}>Cancel</Button>
                            <Button onClick={createCampaign} disabled={isSending}>
                                {isSending ? <Loader2 size={16} className="animate-spin mr-2" /> : <Plus size={16} className="mr-2" />}
                                Create Campaign
                            </Button>
                        </div>
                    </Card>
                </div>
            )}
        </div>
    );
};

// Quick Action Card Component
const QuickActionCard = ({ 
    icon, 
    title, 
    description, 
    onClick 
}: { 
    icon: React.ReactNode; 
    title: string; 
    description: string; 
    onClick: () => void;
}) => (
    <Card 
        className="p-4 cursor-pointer hover:shadow-lg transition-shadow group"
        onClick={onClick}
    >
        <div className="w-10 h-10 bg-zinc-100 dark:bg-zinc-800 rounded-xl flex items-center justify-center mb-3 group-hover:scale-110 transition-transform">
            {icon}
        </div>
        <h4 className="font-bold text-zinc-900 dark:text-white text-sm">{title}</h4>
        <p className="text-xs text-zinc-500 mt-1">{description}</p>
    </Card>
);

export default EmailMarketing;
