
import React, { useEffect, useState } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { useGlobalUI } from './GlobalUIProvider';
import { StorageService } from '../services/storageService';
import { CurrencyService } from '../services/currencyService';
import { isPaidStatus, isRefundedStatus, calculatePaidRevenue, calculatePaidTickets } from '../services/paymentUtils';
import type { Event, Registration, User, SystemNotification, Broadcast } from '../types';
import { Card, Button, Badge, formatTime, Input, Select } from './UI';
import { NonprofitPendingBanner, NonprofitRejectedBanner, NonprofitResubmitForm } from './Onboarding';
import SMMSignupCard from './SMMSignupCard';
import {
    Search, Calendar, Grid, List as ListIcon, MoreVertical,
    Copy, Trash2, Edit, ExternalLink, QrCode, Download,
    Code, Eye, EyeOff, BarChart3, DollarSign, Ticket, RefreshCw,
    Link as LinkIcon, ArrowRight, Wallet, Megaphone, X, Bell, Globe, MapPin, MoreHorizontal, Settings, Gift,
    Target, Check, Image as ImageIcon
} from 'lucide-react';

export const Dashboard = () => {
    const navigate = useNavigate();
    const location = useLocation();
    const [events, setEvents] = useState<Event[]>([]);
    const [registrations, setRegistrations] = useState<Registration[]>([]);
    const [currentUser, setCurrentUser] = useState<User | null>(null);
    const [systemNote, setSystemNote] = useState<SystemNotification | null>(null);
    const { showToast, showConfirm } = useGlobalUI();

    // View State
    const [activeTab, setActiveTab] = useState<'all' | 'upcoming' | 'drafts' | 'past'>('upcoming');
    const [searchTerm, setSearchTerm] = useState('');

    const [showSuccessOverlay, setShowSuccessOverlay] = useState(false);

    // Messages State
    const [showMessages, setShowMessages] = useState(false);
    const [userMessages, setUserMessages] = useState<{ broadcast: Broadcast, eventTitle: string }[]>([]);

    // Menu State for Cards
    const [openMenuId, setOpenMenuId] = useState<string | null>(null);
    const [eventToDelete, setEventToDelete] = useState<string | null>(null);

    // Non-profit application state
    const [nonprofitStatus, setNonprofitStatus] = useState<any>(null);
    const [showResubmitForm, setShowResubmitForm] = useState(false);

    useEffect(() => {
        const user = StorageService.getCurrentUser();
        if (!user) {
            navigate('/auth');
            return;
        }

        // SECURITY CHECK: Redirect non-organizers immediately
        if (user.role !== 'organizer' && !user.isAdmin) {
            // If they are affiliate, send to affiliate portal, else browse
            if (user.role === 'affiliate') {
                navigate('/affiliate', { replace: true });
            } else {
                navigate('/browse', { replace: true });
            }
            return;
        }

        setCurrentUser(user);
        refreshData(user.id);

        const note = StorageService.getSystemNotification();
        setSystemNote(note);

        // Check non-profit application status from API and user profile
        checkNonprofitStatus(user);

        const handleClickOutside = () => setOpenMenuId(null);
        document.addEventListener('click', handleClickOutside);
        return () => document.removeEventListener('click', handleClickOutside);

    }, [navigate]);

    // ... rest of the dashboard code remains the same ...

    useEffect(() => {
        if (location.state && (location.state as any).showSuccess) {
            setShowSuccessOverlay(true);
            // Delay clearing state to ensure it stays visible
            const timer = setTimeout(() => {
                setShowSuccessOverlay(false);
                window.history.replaceState({}, document.title);
            }, 8000);
            return () => clearTimeout(timer);
        }
    }, [location]);

    const refreshData = async (userId: string) => {
        const allEvents = await StorageService.getEvents();
        // Only show events owned by user
        const myEvents = allEvents.filter(e => e.ownerId === userId);
        setEvents(myEvents);

        // Fetch registrations per event (not all at once - that causes 403)
        const regsPromises = myEvents.map(evt => StorageService.getRegistrations(evt.id));
        const regsArrays = await Promise.all(regsPromises);
        const myRegs = regsArrays.flat();
        setRegistrations(myRegs);

        // For user messages, fetch registrations by email
        const userRegs = await StorageService.getRegistrationsByEmail(currentUser?.email || '');
        const attendedEvents = allEvents.filter(e => userRegs.some(r => r.eventId === e.id));

        const messages: { broadcast: Broadcast, eventTitle: string }[] = [];
        attendedEvents.forEach(e => {
            if (e.broadcasts) {
                e.broadcasts.forEach(b => {
                    messages.push({ broadcast: b, eventTitle: e.title });
                });
            }
        });
        setUserMessages(messages.sort((a, b) => b.broadcast.sentAt - a.broadcast.sentAt));

        // Fetch available payout from backend (ready payouts)
        try {
            const token = await StorageService.getAuthToken();
            const response = await fetch('/api/admin/upcoming-payouts', {
                headers: { 'Authorization': `Bearer ${token}` }
            });
            if (response.ok) {
                const data = await response.json();
                const readyPayouts = data.payouts?.filter((p: any) => p.status === 'ready') || [];
                const totalReady = readyPayouts.reduce((sum: number, p: any) => sum + (p.amount || 0), 0);
                // Update current user with calculated payout
                if (currentUser) {
                    setCurrentUser({ ...currentUser, availablePayout: totalReady });
                }
            }
        } catch (e) {
            console.error('Failed to fetch available payout:', e);
        }
    };

    const checkNonprofitStatus = async (user: User) => {
        try {
            // First check user profile for nonprofit status (handles legacy sign-ups)
            if (user.nonProfitStatus === 'pending' || user.nonProfitStatus === 'rejected') {
                // Try to fetch from nonprofit_applications table
                const token = await StorageService.getAuthToken();
                const response = await fetch('/api/onboarding/nonprofit/status', {
                    headers: { 'Authorization': `Bearer ${token}` }
                });
                if (response.ok) {
                    const data = await response.json();
                    if (data.data) {
                        setNonprofitStatus(data.data);
                        return;
                    }
                }
                // If no record in nonprofit_applications, use profile status
                setNonprofitStatus({ status: user.nonProfitStatus });
            }
        } catch (error) {
            console.error('Failed to check nonprofit status:', error);
            // Fallback to profile status
            if (user.nonProfitStatus) {
                setNonprofitStatus({ status: user.nonProfitStatus });
            }
        }
    };

    const handleResubmitComplete = () => {
        setShowResubmitForm(false);
        checkNonprofitStatus();
        showToast('Non-profit application resubmitted successfully!', 'success');
    };

    const handleDuplicate = async (event: Event) => {
        const user = currentUser || StorageService.getCurrentUser();
        if (!user) return;

        if (!user) return;

        showConfirm({
            title: "Duplicate Event",
            message: `Duplicate "${event.title}"?`,
            confirmText: "Duplicate",
            onConfirm: async () => {
                try {
                    const { id, registeredCount, createdAt, moderationStatus, moderationReason, broadcasts, ...eventProps } = event;
                    const cleanProps = JSON.parse(JSON.stringify(eventProps));

                    // 1. Regenerate Ticket Tier IDs & Build Map
                    const tierIdMap: Record<string, string> = {};
                    if (cleanProps.ticketTiers) {
                        cleanProps.ticketTiers = cleanProps.ticketTiers.map((t: any) => {
                            const newId = `tier-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
                            tierIdMap[t.id] = newId;
                            return { ...t, id: newId };
                        });
                    }

                    // 2. Update Promo Codes with new Tier IDs
                    if (cleanProps.promoCodes) {
                        cleanProps.promoCodes = cleanProps.promoCodes.map((p: any) => {
                            if (p.applicableTiers && p.applicableTiers.length > 0) {
                                return {
                                    ...p,
                                    applicableTiers: p.applicableTiers.map((oldId: string) => tierIdMap[oldId]).filter(Boolean)
                                };
                            }
                            return p;
                        });
                    }

                    // 3. Regenerate other sub-IDs
                    if (cleanProps.questions) {
                        cleanProps.questions = cleanProps.questions.map((q: any) => ({ ...q, id: `q-${Date.now()}-${Math.random().toString(36).substr(2, 9)}` }));
                    }
                    if (cleanProps.addOns) {
                        cleanProps.addOns = cleanProps.addOns.map((a: any) => ({ ...a, id: `addon-${Date.now()}-${Math.random().toString(36).substr(2, 9)}` }));
                    }
                    if (cleanProps.recurringDates) {
                        cleanProps.recurringDates = cleanProps.recurringDates.map((r: any) => ({ ...r, id: `date-${Date.now()}-${Math.random().toString(36).substr(2, 9)}` }));
                    }
                    if (cleanProps.gallery) {
                        cleanProps.gallery = cleanProps.gallery.map((g: any) => ({ ...g, id: `img-${Date.now()}-${Math.random().toString(36).substr(2, 9)}` }));
                    }
                    if (cleanProps.affiliates) {
                        cleanProps.affiliates = []; // Clear affiliates for new event
                    }

                    const newEvent: Event = {
                        ...cleanProps,
                        id: `evt-${Date.now()}`,
                        title: `${event.title} (Copy)`,
                        registeredCount: 0,
                        createdAt: Date.now(),
                        isDraft: true,
                        broadcasts: [],
                        moderationStatus: 'approved'
                    };

                    const savedEvent = await StorageService.saveEvent(newEvent);
                    // Use the returned event which has the correct database ID
                    setEvents(prev => [savedEvent, ...prev]);
                    setActiveTab('drafts');
                    showToast("Event duplicated successfully", "success");
                } catch (e: any) {
                    showToast(`Failed to duplicate: ${e.message}`, "error");
                }
            }
        });
    };

    const handleDeleteClick = (id: string, e?: React.MouseEvent) => {
        if (e) e.stopPropagation();

        const event = events.find(x => x.id === id);
        showConfirm({
            title: "Delete Event",
            message: `Are you sure you want to delete "${event?.title || 'this event'}"? This cannot be undone and all data will be lost.`,
            confirmText: "Delete Permanently",
            variant: "danger",
            onConfirm: async () => {
                try {
                    await StorageService.deleteEvent(id);
                    setEvents(prev => prev.filter(e => e.id !== id));
                    showToast("Event deleted", "info");
                } catch (e: any) {
                    showToast(`Failed to delete: ${e.message}`, "error");
                }
            }
        });
    };

    const getEventStats = (eventId: string) => {
        // AUDIT FIX: Use centralized payment status check
        const eventRegs = registrations.filter(r => 
            r.eventId === eventId && 
            isPaidStatus(r.paymentStatus) &&
            !isRefundedStatus(r.paymentStatus)
        );
        
        const itemsSold = calculatePaidTickets(eventRegs);
        const grossRevenue = calculatePaidRevenue(eventRegs);
        return { itemsSold, grossRevenue };
    };

    // Filter Logic
    const filteredEvents = events.filter(e => {
        const matchesSearch = e.title.toLowerCase().includes(searchTerm.toLowerCase());
        const eventDate = new Date(e.date);
        eventDate.setHours(23, 59, 59, 999);
        const isPast = eventDate.getTime() < Date.now();

        let matchesTab = false;
        if (activeTab === 'all') matchesTab = true;
        else if (activeTab === 'drafts') matchesTab = !!e.isDraft;
        else if (activeTab === 'past') matchesTab = !e.isDraft && isPast;
        else if (activeTab === 'upcoming') matchesTab = !e.isDraft && !isPast;

        return matchesSearch && matchesTab;
    }).sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());

    // Aggregate Stats - Use centralized payment status check
    const paidRegistrations = registrations.filter(r => 
        isPaidStatus(r.paymentStatus) && !isRefundedStatus(r.paymentStatus)
    );
    const totalRevenue = calculatePaidRevenue(paidRegistrations);
    const totalTicketsSold = calculatePaidTickets(paidRegistrations);

    if (!currentUser) return null; // Don't render while redirecting

    return (
        <div className="max-w-7xl mx-auto space-y-8 pb-20 relative">
            {/* Non-Profit Pending Banner */}
            {nonprofitStatus?.status === 'pending' && (
                <NonprofitPendingBanner />
            )}

            {/* Non-Profit Rejected Banner */}
            {nonprofitStatus?.status === 'rejected' && (
                <NonprofitRejectedBanner 
                    rejectionReason={nonprofitStatus?.rejection_reason}
                    onResubmit={() => setShowResubmitForm(true)}
                />
            )}

            {/* Non-Profit Resubmit Form Modal */}
            {showResubmitForm && (
                <NonprofitResubmitForm 
                    user={currentUser}
                    previousApplication={nonprofitStatus}
                    onComplete={handleResubmitComplete}
                    onCancel={() => setShowResubmitForm(false)}
                />
            )}

            {/* Success Overlay */}
            {showSuccessOverlay && (
                <div className="fixed inset-0 z-[100] flex items-center justify-center pointer-events-none">
                    <div className="bg-[#E0FF20] w-[65%] h-64 rounded-full flex items-center justify-center shadow-[0_0_50px_rgba(224,255,32,0.6)] animate-pulse border-4 border-black/10">
                        <div className="text-black text-5xl md:text-7xl font-black font-display uppercase tracking-tighter drop-shadow-sm transform -rotate-1 animate-bounce">
                            Success!
                        </div>
                    </div>
                </div>
            )}

            <div className="flex flex-col md:flex-row justify-between items-end md:items-center gap-4">
                <div>
                    <h1 className="text-3xl font-black text-zinc-900 dark:text-white uppercase tracking-tight">Dashboard</h1>
                    <p className="text-zinc-500">Welcome back, {currentUser?.name}</p>
                </div>

                <div className="flex gap-2">
                    <Button variant="outline" onClick={() => setShowMessages(true)} className="relative">
                        <Bell size={18} />
                        {userMessages.length > 0 && <span className="absolute top-0 right-0 -mt-1 -mr-1 h-3 w-3 bg-red-500 rounded-full"></span>}
                    </Button>
                    <Button onClick={() => navigate('/create')} variant="secondary" className="shadow-lg shadow-[#E0FF20]/20">
                        <RefreshCw size={18} className="mr-2" /> Create Event
                    </Button>
                </div>
            </div>

            {/* Stats Row */}
            <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
                <div className="bg-white dark:bg-black border border-zinc-200 dark:border-zinc-800 p-6 rounded-2xl shadow-sm">
                    <div className="text-xs font-bold text-zinc-500 uppercase mb-1">Total Revenue</div>
                    <div className="text-3xl font-black text-zinc-900 dark:text-white">{CurrencyService.formatChargeCurrency(totalRevenue, currentUser?.defaultCurrency || 'USD')}</div>
                </div>
                <div className="bg-white dark:bg-black border border-zinc-200 dark:border-zinc-800 p-6 rounded-2xl shadow-sm">
                    <div className="text-xs font-bold text-zinc-500 uppercase mb-1">Tickets Sold</div>
                    <div className="text-3xl font-black text-zinc-900 dark:text-white">{totalTicketsSold}</div>
                </div>
                <div className="bg-surface border border-zinc-200 dark:border-zinc-800 p-6 rounded-2xl flex items-center justify-between shadow-sm cursor-pointer hover:border-secondary transition-colors" onClick={() => navigate('/billing')}>
                    <div>
                        <div className="text-xs font-bold text-zinc-500 uppercase mb-1">Available Payout</div>
                        <div className="text-3xl font-black text-zinc-900 dark:text-white">{CurrencyService.formatChargeCurrency(currentUser?.availablePayout || 0, currentUser?.defaultCurrency || 'USD')}</div>
                    </div>
                    <Wallet size={24} className="text-emerald-600 dark:text-emerald-400" />
                </div>
                {/* Affiliate Access */}
                <div className="bg-gradient-to-br from-[#E0FF20]/20 to-green-500/10 border border-[#E0FF20]/30 p-6 rounded-2xl flex flex-col justify-center cursor-pointer hover:border-[#E0FF20] transition-colors group" onClick={() => navigate('/affiliate')}>
                    <div className="flex justify-between items-center mb-1">
                        <div className="text-xs font-bold text-[#E0FF20] uppercase">Partner Program</div>
                        <ArrowRight size={16} className="text-[#E0FF20] group-hover:translate-x-1 transition-transform" />
                    </div>
                    <div className="text-sm font-bold text-white">Earn 15% Commissions</div>
                </div>
            </div>

            {/* SMM Signup Card */}
            <div className="my-6">
                <SMMSignupCard userType="organizer" />
            </div>

            {/* Tools Row - Analytics */}
            <div 
                className="bg-gradient-to-br from-purple-500/10 to-pink-500/10 border border-purple-500/20 p-5 rounded-2xl flex items-center gap-4 cursor-pointer hover:border-purple-500/50 transition-colors group"
                onClick={() => navigate('/analytics')}
            >
                <div className="w-12 h-12 bg-gradient-to-br from-purple-500 to-pink-500 rounded-xl flex items-center justify-center">
                    <BarChart3 size={24} className="text-white" />
                </div>
                <div className="flex-1">
                    <div className="font-bold text-zinc-900 dark:text-white flex items-center gap-2">
                        Advanced Analytics
                        <ArrowRight size={14} className="opacity-0 group-hover:opacity-100 group-hover:translate-x-1 transition-all" />
                    </div>
                    <p className="text-xs text-zinc-500">Revenue trends, ticket insights & performance metrics</p>
                </div>
            </div>

            {/* Getting Started Checklist */}
            {(() => {
                const dismissed = localStorage.getItem('hide_getting_started') === 'true';
                if (dismissed && events.length > 0) return null; // Hide if dismissed AND they know what they are doing (have events)

                const steps = [
                    { id: 1, label: 'Create Account', done: true },
                    { id: 2, label: 'Complete Profile', done: !!currentUser?.businessName || currentUser?.role === 'organizer' }, // Approximate check
                    { id: 3, label: 'Create First Event', done: events.length > 0 },
                    { id: 4, label: 'Sell a Ticket', done: registrations.length > 0 }
                ];
                const progress = (steps.filter(s => s.done).length / steps.length) * 100;

                if (progress === 100 && dismissed) return null; // Totally done

                return (
                    <div className="bg-white dark:bg-black border border-zinc-200 dark:border-zinc-800 rounded-2xl p-6 relative overflow-hidden">
                        <div className="flex justify-between items-start mb-4 relative z-10">
                            <div>
                                <h3 className="text-lg font-bold flex items-center gap-2"><Target className="text-primary" /> Getting Started</h3>
                                <p className="text-zinc-500 text-sm">Follow these steps to launch your ticketing business.</p>
                            </div>
                            <button onClick={() => { localStorage.setItem('hide_getting_started', 'true'); window.dispatchEvent(new Event('storage')); navigate(0); }} className="text-zinc-400 hover:text-zinc-600"><X size={16} /></button>
                        </div>

                        {/* Progress Bar */}
                        <div className="h-2 bg-zinc-100 dark:bg-zinc-900 rounded-full mb-6 overflow-hidden">
                            <div className="h-full bg-primary transition-all duration-500 ease-out" style={{ width: `${progress}%` }}></div>
                        </div>

                        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
                            {steps.map((step, i) => (
                                <div key={i} className={`flex items-center gap-3 p-3 rounded-xl border ${step.done ? 'bg-green-50 dark:bg-green-900/10 border-green-200 dark:border-green-900/30' : 'bg-zinc-50 dark:bg-zinc-900 border-zinc-100 dark:border-zinc-800'} transition-colors`}>
                                    <div className={`w-6 h-6 rounded-full flex items-center justify-center shrink-0 ${step.done ? 'bg-green-500 text-white' : 'bg-zinc-200 dark:bg-zinc-700 text-zinc-400'}`}>
                                        {step.done ? <Check size={14} strokeWidth={3} /> : <span className="text-[10px] font-bold">{i + 1}</span>}
                                    </div>
                                    <span className={`text-sm font-bold ${step.done ? 'text-green-700 dark:text-green-400' : 'text-zinc-500'}`}>{step.label}</span>
                                </div>
                            ))}
                        </div>
                    </div>
                );
            })()}

            {/* Tabs & Search */}
            <div className="flex flex-col md:flex-row justify-between items-center gap-4">
                <div className="flex gap-2 p-1 bg-zinc-100 dark:bg-zinc-900 rounded-xl overflow-x-auto w-full md:w-auto">
                    {['all', 'upcoming', 'drafts', 'past'].map(tab => (
                        <button
                            key={tab}
                            onClick={() => setActiveTab(tab as any)}
                            className={`px-6 py-2 rounded-lg text-sm font-bold capitalize transition-all ${activeTab === tab ? 'bg-white dark:bg-black shadow text-black dark:text-white' : 'text-zinc-500 hover:text-zinc-900 dark:hover:text-zinc-300'}`}
                        >
                            {tab === 'all' ? 'All Events' : tab}
                        </button>
                    ))}
                </div>
                <div className="relative w-full md:w-64">
                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-zinc-400" size={16} />
                    <input
                        type="text"
                        placeholder="Search events..."
                        value={searchTerm}
                        onChange={(e) => setSearchTerm(e.target.value)}
                        className="w-full pl-10 h-10 bg-zinc-50 dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-xl text-sm focus:border-primary outline-none"
                    />
                </div>
            </div>

            {/* Events Grid */}
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                {filteredEvents.map(event => {
                    const stats = getEventStats(event.id);
                    const eventDate = new Date(event.date);
                    eventDate.setHours(23, 59, 59, 999);
                    const isPast = eventDate.getTime() < Date.now();

                    return (
                        <div key={event.id} className={`group bg-white dark:bg-black border ${event.isDraft ? 'border-yellow-200 dark:border-yellow-900' : 'border-zinc-200 dark:border-zinc-800'} rounded-3xl overflow-hidden hover:shadow-xl transition-all duration-300 flex flex-col h-full relative`}>
                            {/* Image Section */}
                            <div className="h-48 relative overflow-hidden bg-zinc-100 dark:bg-zinc-800">
                                {event.imageUrl ? (
                                    <img src={event.imageUrl} alt={event.title} className={`w-full h-full object-cover group-hover:scale-105 transition-transform duration-500 ${event.isDraft ? 'grayscale' : ''}`} />
                                ) : (
                                    <div className="w-full h-full flex items-center justify-center text-zinc-400">
                                        <ImageIcon size={32} />
                                    </div>
                                )}
                                <div className="absolute top-3 left-3 flex gap-2 flex-wrap max-w-[80%]">
                                    <Badge color={event.visibility === 'public' ? 'green' : 'gray'}>{event.visibility}</Badge>
                                    {event.isDraft && <Badge color="purple">DRAFT</Badge>}
                                    {!event.isDraft && isPast && <Badge color="red">ENDED</Badge>}
                                </div>
                                {/* Card Menu */}
                                <div className="absolute top-3 right-3">
                                    <button
                                        onClick={(e) => { e.stopPropagation(); setOpenMenuId(openMenuId === event.id ? null : event.id); }}
                                        className="p-2 bg-black/50 hover:bg-black/70 text-white rounded-full backdrop-blur-md transition-colors"
                                    >
                                        <MoreHorizontal size={18} />
                                    </button>
                                    {openMenuId === event.id && (
                                        <div className="absolute right-0 mt-2 w-48 bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-xl shadow-xl overflow-hidden z-20 animate-in fade-in zoom-in-95 origin-top-right">
                                            <button onClick={() => navigate(`/edit/${event.id}`)} className="w-full text-left px-4 py-3 text-sm hover:bg-zinc-50 dark:hover:bg-zinc-800 flex items-center gap-2"><Edit size={14} /> Edit Event</button>
                                            <button onClick={() => handleDuplicate(event)} className="w-full text-left px-4 py-3 text-sm hover:bg-zinc-50 dark:hover:bg-zinc-800 flex items-center gap-2"><Copy size={14} /> Duplicate</button>
                                            <button onClick={() => window.open(`/#/event/${event.id}`, '_blank')} className="w-full text-left px-4 py-3 text-sm hover:bg-zinc-50 dark:hover:bg-zinc-800 flex items-center gap-2"><ExternalLink size={14} /> View Page</button>
                                            <div className="h-px bg-zinc-100 dark:bg-zinc-800 my-1"></div>
                                            <button onClick={(e) => handleDeleteClick(event.id, e)} className="w-full text-left px-4 py-3 text-sm text-red-500 hover:bg-red-50 dark:hover:bg-red-900/10 flex items-center gap-2"><Trash2 size={14} /> Delete</button>
                                        </div>
                                    )}
                                </div>
                            </div>

                            {/* Content */}
                            <div className="p-5 flex-1 flex flex-col">
                                <div className="mb-4">
                                    <h3 className="text-lg font-bold text-zinc-900 dark:text-white line-clamp-1 mb-1" title={event.title}>{event.title}</h3>
                                    <div className="text-xs text-zinc-500 flex items-center gap-1">
                                        <Calendar size={12} /> {new Date(event.date).toLocaleDateString()}
                                        <span className="mx-1">•</span>
                                        <MapPin size={12} /> {event.location?.split(',')[0]}
                                    </div>
                                </div>

                                <div className="grid grid-cols-2 gap-2 mb-4 bg-zinc-50 dark:bg-zinc-900 p-3 rounded-xl border border-zinc-100 dark:border-zinc-800">
                                    <div>
                                        <div className="text-[10px] uppercase font-bold text-zinc-400">Sold</div>
                                        <div className="font-black text-zinc-900 dark:text-white">{stats.itemsSold} <span className="text-zinc-400 text-xs font-medium">/ {event.capacity}</span></div>
                                    </div>
                                    <div>
                                        <div className="text-[10px] uppercase font-bold text-zinc-400">Revenue</div>
                                        <div className="font-black text-green-600 dark:text-green-400">{CurrencyService.formatChargeCurrency(stats.grossRevenue, currentUser?.defaultCurrency || 'USD', false)}</div>
                                    </div>
                                </div>

                                <div className="mt-auto pt-2 flex gap-2">
                                    <Button onClick={() => navigate(`/manage/${event.id}`)} className="flex-1 bg-zinc-900 dark:bg-white text-white dark:text-black hover:bg-zinc-800 dark:hover:bg-zinc-200 border-none py-3 shadow-lg">
                                        Manage
                                    </Button>
                                    <Button onClick={() => navigate(`/checkin/${event.id}`)} variant="outline" className="px-3" title="Check-In Portal">
                                        <QrCode size={18} />
                                    </Button>
                                    <Button onClick={(e) => handleDeleteClick(event.id, e)} variant="outline" className="px-3 text-red-500 hover:bg-red-50 dark:hover:bg-red-900/20 border-red-200 dark:border-red-900/30" title="Delete Event">
                                        <Trash2 size={18} />
                                    </Button>
                                </div>
                            </div>
                        </div>
                    );
                })}

                {filteredEvents.length === 0 && (
                    <div className="col-span-full py-20 text-center">
                        <div className="w-16 h-16 bg-zinc-100 dark:bg-zinc-900 rounded-full flex items-center justify-center mx-auto mb-4 text-zinc-400">
                            <Calendar size={32} />
                        </div>
                        <h3 className="text-lg font-bold text-zinc-900 dark:text-white mb-2">No events found</h3>
                        <p className="text-zinc-500 mb-6">Create your first event or adjust your filters.</p>
                        <Button onClick={() => navigate('/create')}>Create Event</Button>
                    </div>
                )}
            </div>

            {/* Notifications Modal */}
            {showMessages && (
                <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm animate-in fade-in">
                    <div className="bg-white dark:bg-zinc-900 w-full max-w-lg rounded-2xl p-6 shadow-2xl relative">
                        <div className="flex justify-between items-center mb-6">
                            <h3 className="text-xl font-bold flex items-center gap-2">
                                <Bell size={20} className="text-primary" /> Notifications
                            </h3>
                            <button onClick={() => setShowMessages(false)} className="p-2 hover:bg-zinc-100 dark:hover:bg-zinc-800 rounded-full"><X size={20} /></button>
                        </div>

                        <div className="space-y-4 max-h-[60vh] overflow-y-auto">
                            {systemNote && (
                                <div className={`p-4 rounded-xl border ${systemNote.type === 'warning' ? 'bg-red-50 border-red-200 text-red-800' : 'bg-blue-50 border-blue-200 text-blue-800'}`}>
                                    <div className="font-bold text-xs uppercase mb-1">System Message</div>
                                    <p>{systemNote.message}</p>
                                </div>
                            )}

                            {userMessages.length === 0 && !systemNote ? (
                                <div className="text-center py-8 text-zinc-500">No new messages.</div>
                            ) : (
                                userMessages.map((msg, idx) => (
                                    <div key={idx} className="p-4 bg-zinc-50 dark:bg-zinc-800 rounded-xl border border-zinc-200 dark:border-zinc-700">
                                        <div className="flex justify-between items-start mb-2">
                                            <h4 className="font-bold text-sm">{msg.broadcast.subject}</h4>
                                            <span className="text-[10px] text-zinc-500">{new Date(msg.broadcast.sentAt).toLocaleDateString()}</span>
                                        </div>
                                        <div className="text-sm text-zinc-600 dark:text-zinc-300 mb-2" dangerouslySetInnerHTML={{ __html: msg.broadcast.message }} />
                                        <div className="text-[10px] text-zinc-400 font-medium">From: {msg.eventTitle}</div>
                                    </div>
                                ))
                            )}
                        </div>
                    </div>
                </div>
            )}

        </div>
    );
};
