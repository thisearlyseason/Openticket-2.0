
import React, { useState, useEffect } from 'react';
import { useParams, useNavigate, Link } from 'react-router-dom';
import { StorageService } from '../services/storageService';
import { GeminiService } from '../services/geminiService';
import { EmailService } from '../services/emailService';
import { Event, User } from '../types';
import { Button, Input, Card, Badge, RichTextarea, Select } from './UI';
import {
    Edit, QrCode, Users, Calendar, MapPin,
    ArrowLeft, Eye, Mail, Send, Sparkles,
    AlertTriangle, Check, List, BarChart3, Megaphone, ShoppingBag,
    Wallet, Settings, DollarSign, ExternalLink, Share2, Copy, Download, X,
    TrendingUp, Trash2
} from 'lucide-react';
import { ShareButtons } from './UI';

export const ManageEvent = () => {
    const { id } = useParams<{ id: string }>();
    const navigate = useNavigate();
    const [event, setEvent] = useState<Event | null>(null);
    const [currentUser, setCurrentUser] = useState<User | null>(null);
    const [isLoading, setIsLoading] = useState(true);

    // Broadcast State
    const [broadcastSubject, setBroadcastSubject] = useState('');
    const [broadcastBody, setBroadcastBody] = useState('');
    const [selectedTemplateId, setSelectedTemplateId] = useState('');
    const [isSendingBroadcast, setIsSendingBroadcast] = useState(false);
    const [isGeneratingDraft, setIsGeneratingDraft] = useState(false);
    const [showShareModal, setShowShareModal] = useState(false);
    const [showDeleteModal, setShowDeleteModal] = useState(false);
    const [showBroadcastModal, setShowBroadcastModal] = useState(false);

    useEffect(() => {
        const load = async () => {
            const user = StorageService.getCurrentUser();
            if (!user) { navigate('/auth'); return; }
            setCurrentUser(user);

            if (id) {
                const e = await StorageService.getEventFull(id);
                if (e) {
                    if (e.ownerId !== user.id && !user.isAdmin) {
                        window.alert("Unauthorized");
                        navigate('/dashboard');
                        return;
                    }
                    
                    // Calculate accurate guest count from registrations
                    try {
                        const registrations = await StorageService.getRegistrations(id);
                        const paidRegistrations = registrations.filter(r => 
                            r.paymentStatus === 'paid' || r.paymentStatus === 'completed'
                        );
                        
                        // Count total guests (sum of all non-refunded ticket quantities)
                        const totalGuests = paidRegistrations.reduce((sum, reg) => {
                            if (reg.tickets && Array.isArray(reg.tickets)) {
                                const guestCount = reg.tickets.reduce((ticketSum, ticket) => {
                                    if (ticket.status !== 'refunded') {
                                        return ticketSum + (ticket.quantity || 1);
                                    }
                                    return ticketSum;
                                }, 0);
                                return sum + guestCount;
                            }
                            return sum + 1; // Legacy registrations without ticket breakdown
                        }, 0);
                        
                        // Update event with calculated count
                        e.registeredCount = totalGuests;
                    } catch (err) {
                        console.error('Failed to calculate guest count:', err);
                    }
                    
                    setEvent(e);
                }
            }
            setIsLoading(false);
        };
        load();
    }, [id, navigate]);

    const handleGenerateDraft = async () => {
        if (!event) return;
        const purpose = prompt("Email purpose? (e.g. 'Venue change', 'Thank you')");
        if (!purpose) return;

        setIsGeneratingDraft(true);
        const draft = await GeminiService.generateBroadcastDraft(event.title, purpose);
        setBroadcastSubject(draft.subject);
        setBroadcastBody(draft.body);
        setIsGeneratingDraft(false);
    };

    const handleSendBroadcast = () => {
        if (!event || !broadcastSubject || !broadcastBody) return;
        setShowBroadcastModal(true);
    };

    const executeBroadcast = async () => {
        if (!event) return;

        setIsSendingBroadcast(true);
        try {
            // 1. Record in System (creates Notification for Dashboard)
            const count = await StorageService.sendEventBroadcast(event.id, broadcastSubject, broadcastBody, selectedTemplateId);

            // 2. Send via Gmail if connected
            if (currentUser?.gmailConfig?.connected) {
                const allRegs = await StorageService.getRegistrations();
                const eventRegs = allRegs.filter(r => r.eventId === event!.id && r.paymentStatus !== 'refunded');

                let sentCount = 0;
                // Collect all unique recipients
                const recipients = new Set<string>();
                eventRegs.forEach(reg => {
                    if (reg.attendeeEmail) recipients.add(reg.attendeeEmail);
                    reg.tickets?.forEach(t => {
                        if (t.attendeeEmail) recipients.add(t.attendeeEmail);
                    });
                });

                // Batch send (one by one due to API rate limits usually, but here await loop)
                for (const email of Array.from(recipients)) {
                    await EmailService.sendEmail(currentUser.id, email, broadcastSubject, broadcastBody);
                    sentCount++;
                }
                window.alert(`Broadcast recorded! Sent real emails to ${sentCount} recipients via Gmail.`);
            } else {
                window.alert(`Broadcast recorded! (Simulated send to ${count} attendees). Connect Gmail in Settings to send real emails.`);
            }

            setBroadcastSubject('');
            setBroadcastBody('');
            setSelectedTemplateId('');
            const e = await StorageService.getEventFull(event.id); // Refresh
            if (e) setEvent(e);
        } catch (e: any) {
            console.error(e);
            window.alert("Error sending broadcast: " + e.message);
        } finally {
            setIsSendingBroadcast(false);
            setShowBroadcastModal(false);
        }
    };

    const handleDownloadQR = async () => {
        if (!event) return;
        const qrUrl = `https://api.qrserver.com/v1/create-qr-code/?size=500x500&data=${encodeURIComponent(`${window.location.origin}/#/event/${event.id}`)}`;

        try {
            const response = await fetch(qrUrl);
            const blob = await response.blob();
            const url = window.URL.createObjectURL(blob);
            const link = document.createElement('a');
            link.href = url;
            link.download = `event-${event.id}-qr.png`;
            document.body.appendChild(link);
            link.click();
            document.body.removeChild(link);
        } catch (e) {
            console.error('Error downloading QR:', e);
            window.open(qrUrl, '_blank');
        }
    };

    const confirmDelete = async () => {
        if (!event) return;
        try {
            await StorageService.deleteEvent(event.id);
            navigate('/dashboard');
        } catch (e: any) {
            window.alert("Error deleting event: " + e.message);
        }
    };

    if (isLoading) return <div className="min-h-screen flex items-center justify-center"><div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div></div>;
    if (!event || !currentUser) return <div className="p-8 text-center">Event not found.</div>;

    // Financial Security Check
    const isPaidEvent = event.priceType !== 'free';
    const hasPayoutMethod = currentUser.stripeConnectId || currentUser.payoutSettings?.instantCard;
    const showPayoutWarning = isPaidEvent && !hasPayoutMethod;

    return (
        <div className="min-h-screen pb-24">

            {/* 1. Hero / Header Section */}
            <div className="relative h-64 md:h-80 w-full overflow-hidden">
                <div className="absolute inset-0 bg-zinc-900">
                    {event.imageUrl && <img src={event.imageUrl} className="w-full h-full object-cover opacity-50 blur-sm" />}
                    <div className="absolute inset-0 bg-gradient-to-t from-black via-black/40 to-transparent"></div>
                </div>

                <div className="absolute bottom-0 left-0 right-0 p-4 md:p-8 max-w-7xl mx-auto flex flex-col md:flex-row justify-between items-end gap-6">
                    <div className="flex-1">
                        <button onClick={() => navigate('/dashboard')} className="text-zinc-300 hover:text-white flex items-center text-sm font-bold mb-4 transition-colors">
                            <ArrowLeft size={16} className="mr-1" /> Back to Dashboard
                        </button>
                        <div className="flex items-center gap-3 mb-2">
                            <Badge color={event.isDraft ? 'yellow' : 'green'}>{event.isDraft ? 'DRAFT' : 'LIVE'}</Badge>
                            <span className="text-white/70 text-sm font-bold flex items-center gap-1"><Calendar size={14} /> {new Date(event.date).toLocaleDateString()}</span>
                        </div>
                        <h1 className="text-4xl md:text-5xl font-black text-white uppercase tracking-tighter drop-shadow-2xl">{event.title}</h1>
                        <div className="flex items-center gap-2 text-white/80 text-sm mt-1 font-medium">
                            <MapPin size={14} /> {event.location || 'Online'}
                        </div>
                    </div>

                    <div className="flex gap-3">
                        <Button onClick={() => window.open(`/#/event/${event.id}`, '_blank')} variant="outline" className="bg-black/30 backdrop-blur border-white/20 text-white hover:bg-white/10">
                            <Eye size={18} className="mr-2" /> View Page
                        </Button>
                        <Button onClick={() => navigate(`/edit/${event.id}`)} variant="secondary" className="shadow-[0_0_20px_rgba(224,255,32,0.3)]">
                            <Edit size={18} className="mr-2" /> Edit Event
                        </Button>
                    </div>
                </div>
            </div>

            <div className="max-w-7xl mx-auto px-4 mt-8 space-y-8">

                {/* 2. Financial Security Alert */}
                {showPayoutWarning && (
                    <div className="bg-red-500/10 border-l-4 border-red-500 p-6 rounded-r-xl flex flex-col md:flex-row items-start md:items-center justify-between gap-4 animate-pulse">
                        <div className="flex items-start gap-4">
                            <div className="p-3 bg-red-500 rounded-full text-white">
                                <AlertTriangle size={24} />
                            </div>
                            <div>
                                <h3 className="text-xl font-bold text-red-500 uppercase">Payouts Paused</h3>
                                <p className="text-zinc-300 text-sm max-w-2xl">
                                    You are selling tickets but have not set up a payout method.
                                    Your revenue is being held safely, but you cannot withdraw it until you connect Stripe or add a Debit Card.
                                </p>
                            </div>
                        </div>
                        <Button onClick={() => navigate('/billing')} className="bg-red-500 hover:bg-red-600 text-white border-none whitespace-nowrap">
                            <Wallet size={18} className="mr-2" /> Fix Now
                        </Button>
                    </div>
                )}

                {/* 3. Command Grid (Tools) */}
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
                    <Link to={`/manage/${event.id}/attendees`} className="block group">
                        <Card className="p-6 cursor-pointer hover:border-primary transition-all hover:-translate-y-1 h-full">
                            <div className="flex justify-between items-start mb-4">
                                <div className="p-3 bg-blue-500/10 text-blue-500 rounded-xl group-hover:bg-blue-500 group-hover:text-white transition-colors">
                                    <List size={24} />
                                </div>
                            </div>
                            <h3 className="font-bold text-lg">Attendee List</h3>
                            <p className="text-xs text-zinc-500">Manage guests & orders</p>
                        </Card>
                    </Link>

                    <Link to={`/manage/${event.id}/refunds`} className="block group">
                        <Card className="p-6 cursor-pointer hover:border-red-500 transition-all hover:-translate-y-1 h-full">
                            <div className="flex justify-between items-start mb-4">
                                <div className="p-3 bg-red-500/10 text-red-500 rounded-xl group-hover:bg-red-500 group-hover:text-white transition-colors">
                                    <DollarSign size={24} />
                                </div>
                                <span className="text-2xl font-black text-red-500">NEW</span>
                            </div>
                            <h3 className="font-bold text-lg">Refunds</h3>
                            <p className="text-xs text-zinc-500">Process & track refunds</p>
                        </Card>
                    </Link>

                    <Link to={`/checkin/${event.id}`} className="block group">
                        <Card className="p-6 cursor-pointer hover:border-[#E0FF20] transition-all hover:-translate-y-1 h-full">
                            <div className="flex justify-between items-start mb-4">
                                <div className="p-3 bg-[#E0FF20]/10 text-[#E0FF20] rounded-xl group-hover:bg-[#E0FF20] group-hover:text-black transition-colors">
                                    <QrCode size={24} />
                                </div>
                                <div className="text-right">
                                    <span className="text-[10px] font-bold uppercase text-zinc-500">Desktop</span>
                                </div>
                            </div>
                            <h3 className="font-bold text-lg">Check-In Portal</h3>
                            <p className="text-xs text-zinc-500">Full-featured check-in</p>
                        </Card>
                    </Link>

                    <Link to={`/mobile-scanner/${event.id}`} className="block group">
                        <Card className="p-6 cursor-pointer hover:border-[#ec4899] transition-all hover:-translate-y-1 h-full border-2 border-[#ec4899]/30">
                            <div className="flex justify-between items-start mb-4">
                                <div className="p-3 bg-[#ec4899]/10 text-[#ec4899] rounded-xl group-hover:bg-[#ec4899] group-hover:text-white transition-colors">
                                    <QrCode size={24} />
                                </div>
                                <div className="text-right">
                                    <Badge className="bg-[#ec4899] text-white border-none text-[10px]">NEW</Badge>
                                </div>
                            </div>
                            <h3 className="font-bold text-lg">Mobile Scanner</h3>
                            <p className="text-xs text-zinc-500">Fast mobile check-in 📱</p>
                        </Card>
                    </Link>

                    <Link to={`/manage/${event.id}/analytics`} className="block group">
                        <Card className="p-6 cursor-pointer hover:border-orange-500 transition-all hover:-translate-y-1 h-full">
                            <div className="flex justify-between items-start mb-4">
                                <div className="p-3 bg-orange-500/10 text-orange-500 rounded-xl group-hover:bg-orange-500 group-hover:text-white transition-colors">
                                    <BarChart3 size={24} />
                                </div>
                            </div>
                            <h3 className="font-bold text-lg">Analytics</h3>
                            <p className="text-xs text-zinc-500">Sales & traffic data</p>
                        </Card>
                    </Link>

                    <Link to={`/manage/${event.id}/marketing`} className="block group">
                        <Card className="p-6 cursor-pointer hover:border-purple-500 transition-all hover:-translate-y-1 h-full">
                            <div className="flex justify-between items-start mb-4">
                                <div className="p-3 bg-purple-500/10 text-purple-500 rounded-xl group-hover:bg-purple-500 group-hover:text-white transition-colors">
                                    <Megaphone size={24} />
                                </div>
                                <div className="text-right">
                                    <span className="text-[10px] font-bold uppercase text-zinc-500">AI Tools</span>
                                </div>
                            </div>
                            <h3 className="font-bold text-lg">Marketing Lab</h3>
                            <p className="text-xs text-zinc-500">Generate social posts</p>
                        </Card>
                    </Link>

                    <Link to={`/manage/${event.id}/email-preview`} className="block group">
                        <Card className="p-6 cursor-pointer hover:border-blue-500 transition-all hover:-translate-y-1 h-full">
                            <div className="flex justify-between items-start mb-4">
                                <div className="p-3 bg-blue-500/10 text-blue-500 rounded-xl group-hover:bg-blue-500 group-hover:text-white transition-colors">
                                    <Eye size={24} />
                                </div>
                            </div>
                            <h3 className="font-bold text-lg">Email Preview</h3>
                            <p className="text-xs text-zinc-500">View themed emails</p>
                        </Card>
                    </Link>

                    <Link to={`/manage/${event.id}/email-preview`} className="block group">
                        <Card className="p-6 cursor-pointer hover:border-blue-500 transition-all hover:-translate-y-1 h-full">
                            <div className="flex justify-between items-start mb-4">
                                <div className="p-3 bg-blue-500/10 text-blue-500 rounded-xl group-hover:bg-blue-500 group-hover:text-white transition-colors">
                                    <Eye size={24} />
                                </div>
                            </div>
                            <h3 className="font-bold text-lg">Email Preview</h3>
                            <p className="text-xs text-zinc-500">View themed emails</p>
                        </Card>
                    </Link>

                    <Link to={`/manage/${event.id}/settings`} className="block group">
                        <Card className="p-6 cursor-pointer hover:border-zinc-500 transition-all hover:-translate-y-1 h-full">
                            <div className="flex justify-between items-start mb-4">
                                <div className="p-3 bg-zinc-500/10 text-zinc-500 rounded-xl group-hover:bg-zinc-500 group-hover:text-white transition-colors">
                                    <Settings size={24} />
                                </div>
                            </div>
                            <h3 className="font-bold text-lg">Settings</h3>
                            <p className="text-xs text-zinc-500">Visibility & Config</p>
                        </Card>
                    </Link>


                    <Link to={`/manage/${event.id}/addons`} className="block group">
                        <Card className="p-6 cursor-pointer hover:border-emerald-500 transition-all hover:-translate-y-1 h-full">
                            <div className="flex justify-between items-start mb-4">
                                <div className="p-3 bg-emerald-500/10 text-emerald-500 rounded-xl group-hover:bg-emerald-500 group-hover:text-white transition-colors">
                                    <ShoppingBag size={24} />
                                </div>
                            </div>
                            <h3 className="font-bold text-lg">Add-on & Products</h3>
                            <p className="text-xs text-zinc-500">Shop items & upsells</p>
                        </Card>
                    </Link>

                    <Link to={`/manage/${event.id}/finance`} className="block group">
                        <Card className="p-6 cursor-pointer hover:border-primary transition-all hover:-translate-y-1 h-full">
                            <div className="flex justify-between items-start mb-4">
                                <div className="p-3 bg-primary/10 text-primary rounded-xl group-hover:bg-primary group-hover:text-black transition-colors">
                                    <TrendingUp size={24} />
                                </div>
                            </div>
                            <h3 className="font-bold text-lg">Finance & Payouts</h3>
                            <p className="text-xs text-zinc-500">Revenue & bank transfers</p>
                        </Card>
                    </Link>

                    <div onClick={() => setShowShareModal(true)} className="block group cursor-pointer">
                        <Card className="p-6 transition-all hover:-translate-y-1 h-full border-2 border-dashed border-zinc-300 dark:border-zinc-700 hover:border-primary">
                            <div className="flex justify-between items-start mb-4">
                                <div className="p-3 bg-indigo-500/10 text-indigo-500 rounded-xl group-hover:bg-indigo-500 group-hover:text-white transition-colors">
                                    <Share2 size={24} />
                                </div>
                            </div>
                            <h3 className="font-bold text-lg">Share Event</h3>
                            <p className="text-xs text-zinc-500">Socials, Links & QR Codes</p>
                        </Card>
                    </div>

                    <div onClick={() => setShowDeleteModal(true)} className="block group cursor-pointer">
                        <Card className="p-6 transition-all hover:-translate-y-1 h-full border-2 border-dashed border-zinc-300 dark:border-zinc-700 hover:border-red-500">
                            <div className="flex justify-between items-start mb-4">
                                <div className="p-3 bg-red-500/10 text-red-500 rounded-xl group-hover:bg-red-500 group-hover:text-white transition-colors">
                                    <Trash2 size={24} />
                                </div>
                            </div>
                            <h3 className="font-bold text-lg text-red-500">Delete Event</h3>
                            <p className="text-xs text-zinc-500">Permanently remove</p>
                        </Card>
                    </div>
                </div>



                <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
                    {/* 4. Main Activity Column */}
                    <div className="lg:col-span-2 space-y-8">

                        {/* Email Broadcasts */}
                        <Card className="p-6 border-zinc-200 dark:border-zinc-800">
                            <div className="flex items-center gap-3 mb-6">
                                <div className="p-2 bg-zinc-100 dark:bg-zinc-800 rounded-lg"><Mail size={20} /></div>
                                <h2 className="text-xl font-bold">Attendee Broadcasts</h2>
                            </div>

                            <div className="bg-zinc-50 dark:bg-zinc-900/50 p-4 rounded-xl border border-zinc-200 dark:border-zinc-800 mb-6">
                                <div className="flex justify-between items-center mb-4">
                                    <h3 className="font-bold uppercase text-xs text-zinc-500">New Message</h3>
                                    <Button size="sm" variant="ghost" onClick={handleGenerateDraft} isLoading={isGeneratingDraft} className="text-purple-500 hover:bg-purple-50 dark:hover:bg-purple-900/20">
                                        <Sparkles size={14} className="mr-1" /> AI Draft
                                    </Button>
                                </div>
                                {currentUser?.emailTemplates && currentUser.emailTemplates.length > 0 && (
                                    <Select
                                        label="Load Template"
                                        options={[{ value: '', label: 'Select a template...' }, ...currentUser.emailTemplates.filter((t: any) => t.type === 'broadcast').map((t: any) => ({ value: t.id, label: t.name }))]}
                                        value={selectedTemplateId}
                                        onChange={(e) => {
                                            const t = currentUser.emailTemplates?.find((temp: any) => temp.id === e.target.value);
                                            if (t) {
                                                setBroadcastSubject(t.subject);
                                                setBroadcastBody(t.body);
                                                setSelectedTemplateId(t.id);
                                            } else {
                                                setSelectedTemplateId('');
                                            }
                                        }}
                                        containerClassName="mb-3"
                                    />
                                )}
                                <Input
                                    placeholder="Subject Line"
                                    value={broadcastSubject}
                                    onChange={(e) => setBroadcastSubject(e.target.value)}
                                    className="mb-3"
                                />
                                <RichTextarea
                                    placeholder="Write your update here..."
                                    value={broadcastBody}
                                    onChange={(e: any) => setBroadcastBody(e.target.value)}
                                    className="min-h-[120px] mb-4"
                                />
                                <div className="flex justify-end">
                                    <Button
                                        onClick={handleSendBroadcast}
                                        disabled={!broadcastSubject || !broadcastBody}
                                        isLoading={isSendingBroadcast}
                                    >
                                        <Send size={16} className="mr-2" /> Send to All
                                    </Button>
                                </div>
                            </div>

                            {event.broadcasts && event.broadcasts.length > 0 && (
                                <div className="space-y-3">
                                    <h3 className="font-bold text-sm text-zinc-500 uppercase">Sent History</h3>
                                    {event.broadcasts.sort((a, b) => b.sentAt - a.sentAt).map(b => (
                                        <div key={b.id} className="p-4 rounded-xl border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-black flex gap-4">
                                            <div className="mt-1"><Check size={16} className="text-green-500" /></div>
                                            <div>
                                                <div className="font-bold text-sm mb-1">{b.subject}</div>
                                                <div className="text-xs text-zinc-500">{new Date(b.sentAt).toLocaleDateString()} • {new Date(b.sentAt).toLocaleTimeString()}</div>
                                                <div className="text-xs text-zinc-400 mt-2 line-clamp-1" dangerouslySetInnerHTML={{ __html: b.message }} />
                                            </div>
                                        </div>
                                    ))}
                                </div>
                            )}
                        </Card>
                    </div>

                    {/* 5. Sidebar - Settings */}
                    <div className="space-y-6">
                        <Card className="p-6 border-zinc-200 dark:border-zinc-800">
                            <h3 className="font-bold mb-4">Quick Settings</h3>
                            <div className="space-y-2">
                                <button onClick={() => navigate(`/manage/${event.id}/settings`)} className="w-full flex items-center justify-between p-3 rounded-lg hover:bg-zinc-50 dark:hover:bg-zinc-900 transition-colors text-sm">
                                    <span className="flex items-center gap-2"><Settings size={16} /> Event Settings</span>
                                    <ExternalLink size={14} className="text-zinc-400" />
                                </button>
                                <button onClick={() => navigate('/billing')} className="w-full flex items-center justify-between p-3 rounded-lg hover:bg-zinc-50 dark:hover:bg-zinc-900 transition-colors text-sm">
                                    <span className="flex items-center gap-2"><DollarSign size={16} /> Payout Settings</span>
                                    <ExternalLink size={14} className="text-zinc-400" />
                                </button>
                            </div>
                        </Card>
                    </div>
                </div>
            </div>
            {/* Share Modal */}
            {
                showShareModal && (
                    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm animate-in fade-in">
                        <div className="bg-white dark:bg-zinc-900 w-full max-w-lg rounded-3xl p-6 shadow-2xl border border-zinc-200 dark:border-zinc-800 animate-in zoom-in-95">
                            <div className="flex justify-between items-center mb-6">
                                <h2 className="text-2xl font-black uppercase">Share Event</h2>
                                <button onClick={() => setShowShareModal(false)} className="p-2 hover:bg-zinc-100 dark:hover:bg-zinc-800 rounded-full transition-colors">
                                    <X size={24} />
                                </button>
                            </div>

                            <div className="space-y-6">
                                <div>
                                    <label className="text-xs font-bold text-zinc-500 uppercase mb-2 block">Event Link</label>
                                    <div className="flex gap-2">
                                        <div className="flex-1 bg-zinc-100 dark:bg-black border border-zinc-200 dark:border-zinc-800 rounded-lg px-4 py-3 text-sm truncate font-mono text-zinc-600 dark:text-zinc-400">
                                            {window.location.origin}/#/event/{event.id}
                                        </div>
                                        <Button onClick={() => {
                                            navigator.clipboard.writeText(`${window.location.origin}/#/event/${event.id}`);
                                            window.alert("Link copied!");
                                        }}>
                                            <Copy size={18} />
                                        </Button>
                                    </div>
                                </div>

                                <div>
                                    <label className="text-xs font-bold text-zinc-500 uppercase mb-2 block">Share to Socials</label>
                                    <div className="bg-zinc-50 dark:bg-black/50 p-4 rounded-xl border border-zinc-100 dark:border-zinc-800">
                                        <ShareButtons title={event.title} url={`${window.location.origin}/#/event/${event.id}`} />
                                    </div>
                                </div>

                                <div>
                                    <label className="text-xs font-bold text-zinc-500 uppercase mb-2 block">Unique QR Code</label>
                                    <div className="flex items-center gap-6 bg-zinc-50 dark:bg-black/50 p-4 rounded-xl border border-zinc-100 dark:border-zinc-800">
                                        <div className="bg-white p-2 rounded-lg shadow-sm">
                                            <img src={`https://api.qrserver.com/v1/create-qr-code/?size=150x150&data=${encodeURIComponent(`${window.location.origin}/#/event/${event.id}`)}`} className="w-24 h-24" />
                                        </div>
                                        <div className="flex-1">
                                            <div className="text-sm font-bold mb-1">Scan to View</div>
                                            <p className="text-xs text-zinc-500 mb-3">Direct link to your event page.</p>
                                            <Button variant="outline" size="sm" onClick={handleDownloadQR}>
                                                <Download size={14} className="mr-2" /> Download PNG
                                            </Button>
                                        </div>
                                    </div>
                                </div>
                            </div>
                        </div>
                    </div>
                )
            }

            {/* Broadcast Confirmation Modal */}
            {showBroadcastModal && (
                <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm animate-in fade-in">
                    <div className="bg-white dark:bg-zinc-900 w-full max-w-sm rounded-2xl p-6 shadow-2xl border border-zinc-200 dark:border-zinc-800 animate-in zoom-in-95">
                        <div className="text-center mb-6">
                            <div className="w-16 h-16 bg-blue-100 dark:bg-blue-900/30 rounded-full flex items-center justify-center mx-auto mb-4 text-blue-500">
                                <Megaphone size={32} />
                            </div>
                            <h3 className="text-xl font-bold mb-2">Send Broadcast?</h3>
                            <p className="text-zinc-500 text-sm">
                                This will send an email to all active attendees. <br />
                                <strong>Subject:</strong> {broadcastSubject}
                            </p>
                        </div>
                        <div className="flex gap-3">
                            <Button onClick={() => setShowBroadcastModal(false)} variant="outline" className="flex-1">Cancel</Button>
                            <Button onClick={executeBroadcast} isLoading={isSendingBroadcast} className="flex-1 bg-blue-600 hover:bg-blue-700 text-white border-none">
                                Yes, Send
                            </Button>
                        </div>
                    </div>
                </div>
            )}

            {/* Delete Confirmation Modal */}
            {showDeleteModal && (
                <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm animate-in fade-in">
                    <div className="bg-white dark:bg-zinc-900 w-full max-w-sm rounded-2xl p-6 shadow-2xl border border-zinc-200 dark:border-zinc-800 animate-in zoom-in-95">
                        <div className="text-center mb-6">
                            <div className="w-16 h-16 bg-red-100 dark:bg-red-900/30 rounded-full flex items-center justify-center mx-auto mb-4 text-red-500">
                                <Trash2 size={32} />
                            </div>
                            <h3 className="text-xl font-bold mb-2">Delete Event?</h3>
                            <p className="text-zinc-500 text-sm">
                                Are you sure you want to delete this event? This action cannot be undone and all data will be lost.
                            </p>
                        </div>
                        <div className="flex gap-3">
                            <Button onClick={() => setShowDeleteModal(false)} variant="outline" className="flex-1">Cancel</Button>
                            <Button onClick={confirmDelete} className="flex-1 bg-red-500 hover:bg-red-600 text-white border-none">Delete</Button>
                        </div>
                    </div>
                </div>
            )}
        </div >
    );
};
