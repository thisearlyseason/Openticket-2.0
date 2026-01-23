
import React, { useState, useEffect, useRef } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { ArrowLeft, CheckCircle2, Search, X, QrCode, User, RotateCcw, Filter, Users, Clock, AlertTriangle, Phone, Mail, ShoppingBag, CreditCard, Banknote, Smartphone, DollarSign, ChevronRight, ArrowLeftCircle, Trash2, Loader2, Ticket, MoreVertical, WifiOff, CloudOff, RefreshCw } from 'lucide-react';
import { StorageService } from '../services/storageService';
import { isPaidStatus, isRefundedStatus, getPaymentStatusLabel } from '../services/paymentUtils';
import { Registration, Event, PurchasedTicket } from '../types';
import { Input, Button, Card, Badge } from './UI';
import { OfflineService } from '../services/offlineService';
import { Elements, PaymentElement, useStripe, useElements } from '@stripe/react-stripe-js';
import stripePromise from '../services/stripe';

interface CheckInTicket {
    reg: Registration;
    id: string;
    tierId: string;
    index: number;
    uniqueKeySuffix?: string;
    name: string;
    attendeeName: string;
    attendeeEmail?: string;
    checkedIn: boolean;
    checkInTime?: number;
    originalTicketIndex?: number;
}

interface TicketRowProps {
    ticket: CheckInTicket;
    onCheckIn: () => void;
    onDelete: () => void;
    onPay: () => void;
}

const TicketRow: React.FC<TicketRowProps> = ({ ticket, onCheckIn, onDelete, onPay }) => {
    const [showMenu, setShowMenu] = useState(false);
    const menuRef = useRef<HTMLDivElement>(null);

    useEffect(() => {
        const handleClickOutside = (event: MouseEvent) => {
            if (menuRef.current && !menuRef.current.contains(event.target as Node)) {
                setShowMenu(false);
            }
        };
        document.addEventListener('mousedown', handleClickOutside);
        return () => document.removeEventListener('mousedown', handleClickOutside);
    }, []);

    const isCheckedIn = ticket.checkedIn;
    // Use centralized payment status check
    const isUnpaid = !isPaidStatus(ticket.reg.paymentStatus);

    return (
        <div className={`relative rounded-2xl mb-3 border-l-4 transition-all shadow-sm flex flex-col sm:flex-row gap-4 p-5 ${isCheckedIn
            ? 'bg-zinc-100 dark:bg-black border-t border-b border-r border-zinc-200 dark:border-zinc-800 border-l-[#ec4899]'
            : 'bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 border-l-zinc-300 dark:border-l-zinc-700'
            }`}>
            <div className="flex-1">
                <div className="flex items-start justify-between mb-1 relative">
                    <h3 className="font-black text-lg leading-tight text-zinc-900 dark:text-white">
                        {ticket.attendeeName}
                    </h3>

                    <div className="relative" ref={menuRef}>
                        <button
                            onClick={(e) => { e.stopPropagation(); setShowMenu(!showMenu); }}
                            className="p-1 -mr-2 text-zinc-400 hover:text-zinc-600 dark:hover:text-zinc-200 rounded-full"
                        >
                            <MoreVertical size={20} />
                        </button>

                        {showMenu && (
                            <div className="absolute right-0 top-full mt-1 w-48 bg-white dark:bg-zinc-800 border border-zinc-200 dark:border-zinc-700 rounded-xl shadow-xl z-20 overflow-hidden animate-in fade-in zoom-in-95">
                                <button
                                    onClick={(e) => { e.stopPropagation(); onDelete(); setShowMenu(false); }}
                                    className="w-full text-left px-4 py-3 text-sm text-red-600 hover:bg-red-50 dark:hover:bg-red-900/20 flex items-center gap-2 font-bold"
                                >
                                    <Trash2 size={16} /> Delete Attendee
                                </button>
                            </div>
                        )}
                    </div>
                </div>

                <div className="flex items-center gap-2 mb-1">
                    {isUnpaid && (
                        <Badge color="red" className="text-[10px] px-1.5 py-0.5">UNPAID</Badge>
                    )}
                    {isCheckedIn && (
                        <Badge className="bg-[#ec4899] text-white border-none font-bold">IN</Badge>
                    )}
                </div>

                <div className="text-sm text-zinc-500 font-medium mb-3 flex flex-wrap gap-x-4 gap-y-1">
                    <span className="flex items-center gap-1 text-zinc-400"><Ticket size={12} /> {ticket.name}</span>
                    <span className="flex items-center gap-1"><Mail size={12} /> {ticket.attendeeEmail || ticket.reg.attendeeEmail}</span>
                </div>

                {ticket.reg.addOns && ticket.reg.addOns.length > 0 && (
                    <div className="mt-3 flex flex-wrap gap-2">
                        {ticket.reg.addOns.map((addon, i) => (
                            <div key={i} className="inline-flex items-center gap-1 bg-zinc-200 dark:bg-zinc-800 rounded-md px-2 py-1 text-xs text-zinc-600 dark:text-zinc-300 font-bold">
                                <ShoppingBag size={10} className="text-zinc-500" />
                                <span>{addon.quantity}x</span> {addon.name}
                            </div>
                        ))}
                    </div>
                )}
            </div>

            <div className="flex items-center justify-between sm:justify-end gap-4 border-t sm:border-t-0 sm:border-l border-zinc-200 dark:border-zinc-800 pt-4 sm:pt-0 sm:pl-4">
                <div className="text-right sm:block hidden select-none">
                    {ticket.checkedIn ? (
                        <div className="text-xs font-bold text-[#ec4899] flex items-center justify-end gap-1">
                            <Clock size={12} />
                            {ticket.checkInTime ? new Date(ticket.checkInTime).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : 'Just now'}
                        </div>
                    ) : (
                        <div className="text-xs text-zinc-400">Not checked in</div>
                    )}
                    <div className="text-[10px] font-mono text-zinc-400 mt-1">
                        ID: {ticket.id.split('-').slice(1).join('-').toUpperCase()}
                    </div>
                </div>

                <div className="flex gap-2 w-full sm:w-auto">
                    {isUnpaid && (
                        <button
                            onClick={(e) => { e.stopPropagation(); onPay(); }}
                            className="h-12 w-full sm:w-auto px-4 rounded-xl font-bold flex items-center justify-center gap-2 transition-all active:scale-95 bg-green-100 text-green-700 hover:bg-green-200 border border-green-200"
                        >
                            <DollarSign size={18} /> Pay
                        </button>
                    )}
                    <button
                        onClick={(e) => { e.stopPropagation(); onCheckIn(); }}
                        className={`
                            h-12 w-full sm:w-auto px-6 rounded-xl font-bold flex items-center justify-center gap-2 transition-all active:scale-95 shadow-lg
                            ${isCheckedIn
                                ? 'bg-zinc-800 text-zinc-400 hover:text-white border border-zinc-700'
                                : 'bg-[#E0FF20] text-black hover:bg-[#d4f542] hover:scale-105 border border-transparent'
                            }
                        `}
                    >
                        {isCheckedIn ? (
                            <>Undo <RotateCcw size={16} /></>
                        ) : (
                            <>Check In <CheckCircle2 size={18} /></>
                        )}
                    </button>
                </div>
            </div>
        </div>
    );
};

// ============ STRIPE CARD PAYMENT FORM COMPONENT ============
interface StripeCardFormProps {
    registrationId: string;
    amount: number;
    onSuccess: () => void;
    onError: (error: string) => void;
    onProcessing: (isProcessing: boolean) => void;
}

const StripeCardPaymentForm = ({ registrationId, amount, onSuccess, onError, onProcessing }: StripeCardFormProps) => {
    const stripe = useStripe();
    const elements = useElements();
    const [isSubmitting, setIsSubmitting] = useState(false);
    const [isReady, setIsReady] = useState(false);

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!stripe || !elements || !isReady) {
            onError('Payment form is not ready. Please wait a moment and try again.');
            return;
        }

        setIsSubmitting(true);
        onProcessing(true);

        try {
            // Submit the form first to validate the payment details
            const { error: submitError } = await elements.submit();
            if (submitError) {
                console.error('[StripeCard] Submit error:', submitError);
                onError(submitError.message || 'Please check your payment details');
                setIsSubmitting(false);
                onProcessing(false);
                return;
            }

            // Confirm the payment
            const { error, paymentIntent } = await stripe.confirmPayment({
                elements,
                confirmParams: {
                    return_url: window.location.href, // Not actually used since we handle redirect ourselves
                },
                redirect: 'if_required',
            });

            if (error) {
                console.error('[StripeCard] Payment error:', error);
                onError(error.message || 'Payment failed');
                setIsSubmitting(false);
                onProcessing(false);
                return;
            }

            if (paymentIntent && paymentIntent.status === 'succeeded') {
                // Confirm the payment on our backend
                const response = await fetch('/api/stripe/at-door/confirm-payment', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({
                        paymentIntentId: paymentIntent.id,
                        registrationId,
                    }),
                });

                if (!response.ok) {
                    const data = await response.json();
                    throw new Error(data.error || 'Failed to confirm payment');
                }

                onSuccess();
            } else {
                onError('Payment was not completed. Please try again.');
            }
        } catch (err: any) {
            console.error('[StripeCard] Error:', err);
            onError(err.message || 'An unexpected error occurred');
        } finally {
            setIsSubmitting(false);
            onProcessing(false);
        }
    };

    return (
        <form onSubmit={handleSubmit} className="space-y-4">
            <div className="p-4 bg-zinc-50 dark:bg-zinc-900 rounded-xl border border-zinc-200 dark:border-zinc-800">
                <PaymentElement 
                    options={{
                        layout: 'tabs',
                    }}
                    onReady={() => setIsReady(true)}
                />
            </div>
            <Button 
                type="submit"
                disabled={!stripe || !elements || isSubmitting || !isReady}
                className="w-full bg-blue-600 hover:bg-blue-700 text-white border-none disabled:opacity-50"
            >
                {isSubmitting ? (
                    <><Loader2 size={18} className="mr-2 animate-spin" /> Processing...</>
                ) : (
                    <><CreditCard size={18} className="mr-2" /> Pay ${amount.toFixed(2)}</>
                )}
            </Button>
        </form>
    );
};

// ============ STRIPE PAYMENT WRAPPER WITH ELEMENTS ============
interface StripePaymentWrapperProps {
    registrationId: string;
    amount: number;
    currency?: string;
    onSuccess: () => void;
    onError: (error: string) => void;
    onProcessing: (isProcessing: boolean) => void;
}

const StripePaymentWrapper = ({ registrationId, amount, currency = 'usd', onSuccess, onError, onProcessing }: StripePaymentWrapperProps) => {
    const [clientSecret, setClientSecret] = useState<string | null>(null);
    const [loading, setLoading] = useState(true);
    const [initError, setInitError] = useState<string | null>(null);
    const mountedRef = useRef(true);

    useEffect(() => {
        mountedRef.current = true;
        
        const createPaymentIntent = async () => {
            try {
                console.log('[StripeWrapper] Creating payment intent for:', registrationId, 'amount:', amount);
                
                const response = await fetch('/api/stripe/at-door/create-payment-intent', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({
                        registrationId,
                        amount,
                        currency,
                    }),
                });

                if (!mountedRef.current) {
                    console.log('[StripeWrapper] Component unmounted, aborting');
                    return;
                }

                if (!response.ok) {
                    const data = await response.json();
                    throw new Error(data.error || 'Failed to initialize payment');
                }

                const data = await response.json();
                console.log('[StripeWrapper] Payment intent created successfully');
                
                if (mountedRef.current) {
                    setClientSecret(data.clientSecret);
                }
            } catch (err: any) {
                console.error('[StripeWrapper] Init error:', err);
                if (mountedRef.current) {
                    setInitError(err.message || 'Failed to initialize payment');
                }
            } finally {
                if (mountedRef.current) {
                    setLoading(false);
                }
            }
        };

        createPaymentIntent();
        
        return () => {
            mountedRef.current = false;
        };
    }, [registrationId, amount, currency]);

    if (loading) {
        return (
            <div className="flex items-center justify-center py-8">
                <Loader2 size={32} className="animate-spin text-blue-500" />
                <span className="ml-3 text-zinc-500">Initializing secure payment...</span>
            </div>
        );
    }

    if (initError) {
        return (
            <div className="p-4 bg-red-50 dark:bg-red-900/20 rounded-xl border border-red-200 dark:border-red-800 text-center">
                <AlertTriangle size={24} className="mx-auto mb-2 text-red-500" />
                <p className="text-red-600 dark:text-red-400 font-bold">{initError}</p>
                <p className="text-sm text-red-500 mt-1">Please try again or use a different payment method.</p>
            </div>
        );
    }

    if (!clientSecret) {
        return (
            <div className="p-4 bg-amber-50 dark:bg-amber-900/20 rounded-xl border border-amber-200 dark:border-amber-800 text-center">
                <p className="text-amber-600 dark:text-amber-400">Unable to initialize payment. Please try another method.</p>
            </div>
        );
    }

    const appearance = {
        theme: 'stripe' as const,
        variables: {
            colorPrimary: '#3b82f6',
            borderRadius: '8px',
        },
    };

    return (
        <Elements stripe={stripePromise} options={{ clientSecret, appearance }}>
            <StripeCardPaymentForm 
                registrationId={registrationId}
                amount={amount}
                onSuccess={onSuccess}
                onError={onError}
                onProcessing={onProcessing}
            />
        </Elements>
    );
};

export const CheckInPortal = () => {
    const { id } = useParams<{ id: string }>();
    const navigate = useNavigate();
    const [event, setEvent] = useState<Event | null>(null);
    const [registrations, setRegistrations] = useState<Registration[]>([]);
    const [searchTerm, setSearchTerm] = useState('');
    const [allTickets, setAllTickets] = useState<CheckInTicket[]>([]);
    const [stats, setStats] = useState({ total: 0, checkedIn: 0 });
    const [filter, setFilter] = useState<'all' | 'checked-in' | 'unpaid'>('all');
    
    // Auto-refresh for real-time check-in updates
    const [lastRefresh, setLastRefresh] = useState(Date.now());

    // Offline support state
    const [isOnline, setIsOnline] = useState(navigator.onLine);
    const [pendingCheckIns, setPendingCheckIns] = useState(0);
    const [isSyncing, setIsSyncing] = useState(false);

    const [paymentContext, setPaymentContext] = useState<{
        reg: Registration;
        ticketId: string;
        tierId: string;
        index: number;
    } | null>(null);

    const [paymentMethod, setPaymentMethod] = useState<'cash' | 'card' | 'transfer' | null>(null);
    const [cashTendered, setCashTendered] = useState('');
    const [cardDetails, setCardDetails] = useState({ number: '', expiry: '', cvc: '', zip: '' });
    const [paymentStatus, setPaymentStatus] = useState<'input' | 'processing' | 'done' | 'error'>('input');
    const [paymentError, setPaymentError] = useState<string | null>(null);

    const [ticketToDelete, setTicketToDelete] = useState<CheckInTicket | null>(null);
    const [isDeleting, setIsDeleting] = useState(false);

    // Network status listener
    useEffect(() => {
        const cleanup = OfflineService.setupNetworkListeners(
            async () => {
                setIsOnline(true);
                // Auto-sync when coming back online
                await syncOfflineCheckIns();
            },
            () => setIsOnline(false)
        );
        
        // Check pending count on mount
        OfflineService.getPendingCount().then(setPendingCheckIns);
        
        return cleanup;
    }, []);

    // Sync offline check-ins
    const syncOfflineCheckIns = async () => {
        if (!isOnline || isSyncing) return;
        
        setIsSyncing(true);
        try {
            const pending = await OfflineService.getPendingCheckIns();
            
            for (const checkIn of pending) {
                try {
                    // Find the registration
                    const reg = registrations.find(r => r.id === checkIn.registrationId);
                    if (reg) {
                        const newStatuses = { ...(reg.checkInStatuses || {}) };
                        newStatuses[checkIn.ticketKey] = { 
                            checkedIn: checkIn.checkedIn, 
                            timestamp: checkIn.timestamp 
                        };
                        
                        await StorageService.updateRegistration(checkIn.registrationId, {
                            checkInStatuses: newStatuses,
                            checkedIn: Object.values(newStatuses).some(s => s.checkedIn)
                        });
                        
                        await OfflineService.markCheckInSynced(checkIn.id);
                    }
                } catch (err) {
                    console.error('[CheckIn] Failed to sync:', checkIn.id, err);
                }
            }
            
            // Refresh data after sync
            await loadRegistrations();
            await OfflineService.clearSyncedCheckIns();
            setPendingCheckIns(await OfflineService.getPendingCount());
        } finally {
            setIsSyncing(false);
        }
    };

    useEffect(() => {
        const user = StorageService.getCurrentUser();
        if (!user) {
            navigate('/auth');
            return;
        }

        const init = async () => {
            if (id) {
                const e = await StorageService.getEventFull(id);
                if (e) {
                    if (e.ownerId !== user.id && !user.isAdmin) {
                        window.alert("Unauthorized access to Check-In Portal.");
                        navigate('/dashboard');
                        return;
                    }
                    setEvent(e);
                    await loadRegistrations();
                }
            }
        };
        init();
    }, [id, navigate]);
    
    // Auto-refresh every 3 seconds for real-time updates from other scanners
    useEffect(() => {
        if (!id) return;
        
        const interval = setInterval(async () => {
            await loadRegistrations();
            setLastRefresh(Date.now());
        }, 3000);
        
        return () => clearInterval(interval);
    }, [id]);

    const loadRegistrations = async () => {
        if (!id) return;
        const regs = await StorageService.getRegistrations(id);
        setRegistrations(regs);
        processTickets(regs);
    };

    const processTickets = (regs: Registration[]) => {
        const tickets: CheckInTicket[] = regs.flatMap(reg => {
            if (reg.paymentStatus === 'refunded' || reg.approvalStatus === 'rejected') return [];

            if (!reg.tickets || reg.tickets.length === 0) {
                const key = `general-0`;
                const statusEntry = reg.checkInStatuses?.[key];
                const isCheckedIn = statusEntry ? statusEntry.checkedIn : (reg.checkedIn || false);

                return [{
                    reg,
                    id: `${reg.id}-general-0`,
                    tierId: 'general',
                    index: 0,
                    name: 'General Admission',
                    attendeeName: reg.attendeeName,
                    attendeeEmail: reg.attendeeEmail,
                    checkedIn: isCheckedIn,
                    checkInTime: statusEntry?.timestamp,
                    originalTicketIndex: undefined
                }];
            }

            return reg.tickets.flatMap((t, tIndex) => {
                if (t.status === 'refunded') return [];

                return Array.from({ length: t.quantity }).map((_, i) => {
                    // FIX: Include tIndex to ensure uniqueness if multiple line items share a tier
                    const uniqueKey = `${t.tierId || 'general'}-${tIndex}-${i}`;
                    const statusEntry = reg.checkInStatuses?.[uniqueKey];
                    
                    // Check ALL sources of check-in status:
                    // 1. checkInStatuses[key] (from CheckInPortal manual check-in)
                    // 2. ticket.checkedIn (from Kiosk/Mobile scanner)
                    // 3. reg.checkedIn (legacy registration-level)
                    const isCheckedIn = statusEntry?.checkedIn || t.checkedIn || reg.checkedIn || false;
                    const checkInTime = statusEntry?.timestamp || (t.checkedInAt ? new Date(t.checkedInAt).getTime() : undefined);

                    const guestName = t.attendeeName || reg.attendeeName;
                    const guestEmail = t.attendeeEmail || reg.attendeeEmail;

                    return {
                        reg,
                        id: `${reg.id}-${uniqueKey}`,
                        tierId: t.tierId,
                        index: i,
                        // We store tIndex in the object to use it for updates if needed, 
                        // though checkInStatuses uses the key.
                        uniqueKeySuffix: uniqueKey,
                        name: t.name,
                        attendeeName: guestName,
                        attendeeEmail: guestEmail,
                        checkedIn: isCheckedIn,
                        checkInTime: checkInTime,
                        originalTicketIndex: tIndex,
                        ticketId: t.ticketId,
                        ticketNumber: t.ticketNumber
                    };
                });
            });
        });

        tickets.sort((a, b) => {
            if (a.checkedIn === b.checkedIn) {
                return a.attendeeName.localeCompare(b.attendeeName);
            }
            return a.checkedIn ? 1 : -1;
        });

        setAllTickets(tickets);
        setStats({
            total: tickets.length,
            checkedIn: tickets.filter(t => t.checkedIn).length
        });
    };

    // ... rest of the component implementation remains largely same, just updated processTickets logic ...
    // including helper functions like confirmDelete, handleCheckInToggle, handleProcessPayment, finalizePayment, etc.

    const confirmDelete = async () => {
        if (!ticketToDelete) return;
        setIsDeleting(true);

        const reg = ticketToDelete.reg;

        try {
            let updatedRegData: Partial<Registration> = {};
            let refundAmount = 0;

            if (ticketToDelete.originalTicketIndex !== undefined && reg.tickets) {
                const updatedTickets = [...reg.tickets];
                const targetTicket = updatedTickets[ticketToDelete.originalTicketIndex];

                if (targetTicket) {
                    refundAmount = targetTicket.pricePerTicket; // Refunding 1 unit

                    if (targetTicket.quantity > 1) {
                        updatedTickets[ticketToDelete.originalTicketIndex] = { ...targetTicket, quantity: targetTicket.quantity - 1 };
                        updatedTickets.push({ ...targetTicket, quantity: 1, status: 'refunded' });
                    } else {
                        updatedTickets[ticketToDelete.originalTicketIndex] = { ...targetTicket, status: 'refunded' };
                    }

                    const allRefunded = updatedTickets.every(t => t.status === 'refunded');

                    updatedRegData = {
                        tickets: updatedTickets,
                        paymentStatus: allRefunded ? 'refunded' : reg.paymentStatus,
                        approvalStatus: allRefunded ? 'rejected' : reg.approvalStatus,
                        refundReason: allRefunded ? 'Deleted at door' : undefined,
                        refundedAmount: (reg.refundedAmount || 0) + refundAmount
                    };
                }
            } else {
                // If it's a general/legacy structure where we delete the whole thing
                refundAmount = (reg.donationAmount || 0) + (reg.tickets?.[0]?.pricePerTicket || 0);
                updatedRegData = {
                    approvalStatus: 'rejected',
                    paymentStatus: 'refunded',
                    refundReason: 'Deleted at door',
                    refundedAmount: (reg.refundedAmount || 0) + refundAmount
                };
            }

            await StorageService.updateRegistration(reg.id, updatedRegData);
            await loadRegistrations();
            setTicketToDelete(null);
        } catch (e: any) {
            console.error("Delete failed", e);
            window.alert("Failed to delete ticket: " + e.message);
        } finally {
            setIsDeleting(false);
        }
    };

    const handleCheckInToggle = async (regId: string, uniqueKey: string, currentStatus: boolean) => {
        const ticketKey = uniqueKey;
        const ticketUniqueId = `${regId}-${ticketKey}`;
        const timestamp = Date.now();

        const reg = registrations.find(r => r.id === regId);
        if (!reg) return;

        if (!currentStatus && (reg.paymentStatus === 'offline_pending' || reg.paymentStatus === 'pending')) {
            setPaymentContext({
                reg,
                ticketId: ticketUniqueId,
                tierId: uniqueKey.split('-')[0], // Approximation
                index: parseInt(uniqueKey.split('-').pop() || '0')
            });
            setPaymentMethod(null);
            setCashTendered('');
            setCardDetails({ number: '', expiry: '', cvc: '', zip: '' });
            setPaymentStatus('input');
            return;
        }

        // Optimistic UI update
        setAllTickets(prev => prev.map(t => {
            if (t.id === ticketUniqueId) {
                return { ...t, checkedIn: !currentStatus, checkInTime: !currentStatus ? timestamp : undefined };
            }
            return t;
        }));

        setStats(prev => ({
            ...prev,
            checkedIn: !currentStatus ? prev.checkedIn + 1 : prev.checkedIn - 1
        }));

        const newStatuses = { ...(reg.checkInStatuses || {}) };
        if (!currentStatus) {
            newStatuses[ticketKey] = { checkedIn: true, timestamp };
        } else {
            newStatuses[ticketKey] = { checkedIn: false, timestamp: 0 };
        }

        const anyCheckedIn = Object.values(newStatuses).some((s: any) => s.checkedIn === true);

        // If offline, save locally and sync later
        if (!isOnline) {
            try {
                await OfflineService.saveOfflineCheckIn({
                    eventId: id!,
                    registrationId: regId,
                    ticketKey,
                    checkedIn: !currentStatus,
                    timestamp,
                    attendeeName: reg.attendeeName
                });
                setPendingCheckIns(await OfflineService.getPendingCount());
                
                // Update local state
                setRegistrations(prev => prev.map(r => {
                    if (r.id === regId) {
                        return { ...r, checkInStatuses: newStatuses, checkedIn: anyCheckedIn };
                    }
                    return r;
                }));
            } catch (err) {
                console.error('[CheckIn] Failed to save offline:', err);
            }
            return;
        }

        // Online - sync immediately
        try {
            // Also update the individual ticket's checkedIn status in the tickets array
            let updatedTickets = reg.tickets;
            if (reg.tickets && Array.isArray(reg.tickets)) {
                // Parse the ticketKey to find the matching ticket
                // ticketKey format: "tierId-tIndex-i" or "tierId-i"
                const keyParts = ticketKey.split('-');
                updatedTickets = reg.tickets.map((t, tIndex) => {
                    // Match by either ticketId, ticketNumber, or by tier/index
                    // Try to match the specific ticket within the array
                    const tierMatches = t.tierId === keyParts[0] || t.id === keyParts[0];
                    const indexInKey = parseInt(keyParts[keyParts.length - 1], 10);
                    
                    // Check if this ticket matches the uniqueKey pattern
                    if (tierMatches) {
                        // For multi-quantity tickets, we need to track individual check-ins
                        // The ticketKey includes the index within the quantity
                        const tIndexInKey = keyParts.length >= 3 ? parseInt(keyParts[1], 10) : 0;
                        if (tIndex === tIndexInKey || keyParts.length < 3) {
                            return {
                                ...t,
                                checkedIn: !currentStatus,
                                checkedInAt: !currentStatus ? new Date().toISOString() : null,
                                checkedInBy: !currentStatus ? 'portal' : null
                            };
                        }
                    }
                    return t;
                });
            }
            
            await StorageService.updateRegistration(regId, {
                checkInStatuses: newStatuses,
                checkedIn: anyCheckedIn,
                tickets: updatedTickets
            });
        } catch (err) {
            console.error('[CheckIn] Failed to sync, saving offline:', err);
            // Fallback to offline storage if sync fails
            await OfflineService.saveOfflineCheckIn({
                eventId: id!,
                registrationId: regId,
                ticketKey,
                checkedIn: !currentStatus,
                timestamp,
                attendeeName: reg.attendeeName
            });
            setPendingCheckIns(await OfflineService.getPendingCount());
        }
    };

    const handleProcessPayment = async (method: 'cash' | 'card' | 'transfer') => {
        if (!paymentContext) return;
        setPaymentError(null);
        setPaymentStatus('processing');
        
        try {
            // For at-door payments, we record the payment and mark as completed
            // Card payments are assumed to be processed on an external terminal
            await finalizePayment(method, method === 'card' ? 'terminal' : method);
        } catch (error: any) {
            console.error('[Payment] Payment error:', error);
            setPaymentError(error.message || 'Payment failed. Please try again.');
            setPaymentStatus('error');
            
            setTimeout(() => {
                setPaymentStatus('input');
            }, 3000);
        }
    };

    const finalizePayment = async (method: 'cash' | 'card' | 'transfer', paymentSource?: string) => {
        if (!paymentContext) return;
        const { reg, tierId, index } = paymentContext;

        try {
            await StorageService.updateRegistration(reg.id, {
                paymentStatus: 'completed',
                approvalStatus: 'approved',
            });

            // Create financial transaction record for at-door payment
            try {
                const totalAmount = calculateTotalDue(reg);
                await StorageService.Stripe.recordAtDoorPayment(reg.id, totalAmount, method);
            } catch (txError) {
                console.warn('[Payment] Could not record financial transaction:', txError);
                // Non-blocking - registration is still marked as paid
            }

            const ticketKey = `${tierId}-${index}`;
            const timestamp = Date.now();
            const newStatuses = { ...(reg.checkInStatuses || {}) };
            newStatuses[ticketKey] = { checkedIn: true, timestamp };

            await StorageService.updateRegistration(reg.id, {
                checkInStatuses: newStatuses,
                checkedIn: true
            });

            const updatedRegs = registrations.map(r =>
                r.id === reg.id
                    ? { ...r, paymentStatus: 'completed' as const, checkInStatuses: newStatuses, checkedIn: true }
                    : r
            );
            setRegistrations(updatedRegs);
            processTickets(updatedRegs);

            // Show success state before closing
            setPaymentStatus('done');
            setTimeout(() => {
                setPaymentContext(null);
                setPaymentMethod(null);
                setCashTendered('');
                setPaymentStatus('input');
                setPaymentError(null);
            }, 1500);
        } catch (e: any) {
            setPaymentError("Payment confirmation failed: " + e.message);
            setPaymentStatus('error');
        }
    };

    const calculateTotalDue = (reg: Registration) => {
        const ticketTotal = reg.tickets?.reduce((acc, t) => acc + (t.pricePerTicket * t.quantity), 0) || 0;
        const addonTotal = reg.addOns?.reduce((acc, a) => acc + (a.price * a.quantity), 0) || 0;
        const subtotal = ticketTotal + addonTotal;
        const fees = (reg.serviceFee || 0) + (reg.customFeesAmount || 0);
        const tax = reg.taxAmount || 0;
        const donation = (reg.donationAmount || 0) + (reg.platformDonationAmount || 0);
        const discount = reg.discountAmount || 0;
        return Math.max(0, subtotal + fees + tax + donation - discount);
    };

    const filteredTickets = allTickets.filter(t => {
        const matchesSearch = t.attendeeName.toLowerCase().includes(searchTerm.toLowerCase()) ||
            (t.attendeeEmail || '').toLowerCase().includes(searchTerm.toLowerCase()) ||
            (t.reg.phoneNumber || '').toLowerCase().includes(searchTerm.toLowerCase()) ||
            t.reg.id.toLowerCase().includes(searchTerm.toLowerCase()) ||
            t.id.toLowerCase().includes(searchTerm.toLowerCase());

        let matchesFilter = true;
        if (filter === 'checked-in') matchesFilter = t.checkedIn;
        if (filter === 'unpaid') matchesFilter = t.reg.paymentStatus !== 'completed';

        return matchesSearch && matchesFilter;
    });

    // Scanner functions removed - QR scanning functionality disabled

    const renderPaymentModalContent = () => {
        if (!paymentContext) return null;

        if (paymentStatus === 'processing' || paymentStatus === 'done' || paymentStatus === 'error') {
            return (
                <div className="flex flex-col items-center justify-center h-full py-10">
                    {paymentStatus === 'processing' ? (
                        <>
                            <Loader2 size={48} className="animate-spin text-primary mb-4" />
                            <h3 className="text-xl font-bold">Processing Payment...</h3>
                        </>
                    ) : paymentStatus === 'done' ? (
                        <>
                            <div className="w-16 h-16 bg-green-500 rounded-full flex items-center justify-center mb-4 text-white">
                                <CheckCircle2 size={32} />
                            </div>
                            <h3 className="text-xl font-bold">Payment Approved!</h3>
                        </>
                    ) : (
                        <>
                            <div className="w-16 h-16 bg-red-500 rounded-full flex items-center justify-center mb-4 text-white">
                                <X size={32} />
                            </div>
                            <h3 className="text-xl font-bold text-red-600">Payment Failed</h3>
                            {paymentError && (
                                <p className="text-sm text-zinc-500 mt-2 text-center max-w-xs">{paymentError}</p>
                            )}
                            <p className="text-xs text-zinc-400 mt-4">Returning to payment options...</p>
                        </>
                    )}
                </div>
            );
        }

        const totalDue = calculateTotalDue(paymentContext.reg);

        return (
            <div className="space-y-6">
                <div className="text-center mb-6">
                    <div className="text-sm text-zinc-500 uppercase font-bold">Total Due</div>
                    <div className="text-4xl font-black">${totalDue.toFixed(2)}</div>
                </div>

                {!paymentMethod ? (
                    <div className="grid grid-cols-1 gap-3">
                        <button
                            onClick={() => setPaymentMethod('card')}
                            className="p-4 border border-zinc-200 dark:border-zinc-800 rounded-xl flex items-center justify-between hover:border-primary hover:bg-zinc-50 dark:hover:bg-zinc-800 transition-all group"
                        >
                            <div className="flex items-center gap-3">
                                <div className="bg-blue-100 text-blue-600 p-2 rounded-lg"><CreditCard size={20} /></div>
                                <span className="font-bold">Credit Card</span>
                            </div>
                            <ChevronRight size={16} className="text-zinc-400 group-hover:text-zinc-900 dark:group-hover:text-white" />
                        </button>
                        <button
                            onClick={() => setPaymentMethod('cash')}
                            className="p-4 border border-zinc-200 dark:border-zinc-800 rounded-xl flex items-center justify-between hover:border-primary hover:bg-zinc-50 dark:hover:bg-zinc-800 transition-all group"
                        >
                            <div className="flex items-center gap-3">
                                <div className="bg-green-100 text-green-600 p-2 rounded-lg"><Banknote size={20} /></div>
                                <span className="font-bold">Cash</span>
                            </div>
                            <ChevronRight size={16} className="text-zinc-400 group-hover:text-zinc-900 dark:group-hover:text-white" />
                        </button>
                        <button
                            onClick={() => setPaymentMethod('transfer')}
                            className="p-4 border border-zinc-200 dark:border-zinc-800 rounded-xl flex items-center justify-between hover:border-primary hover:bg-zinc-50 dark:hover:bg-zinc-800 transition-all group"
                        >
                            <div className="flex items-center gap-3">
                                <div className="bg-purple-100 text-purple-600 p-2 rounded-lg"><Smartphone size={20} /></div>
                                <span className="font-bold">E-Transfer / External</span>
                            </div>
                            <ChevronRight size={16} className="text-zinc-400 group-hover:text-zinc-900 dark:group-hover:text-white" />
                        </button>
                    </div>
                ) : (
                    <div className="animate-in fade-in slide-in-from-right-4">
                        <button onClick={() => setPaymentMethod(null)} className="mb-4 text-sm text-zinc-500 hover:text-zinc-900 dark:hover:text-white flex items-center">
                            <ArrowLeftCircle size={16} className="mr-1" /> Change Method
                        </button>

                        {paymentMethod === 'card' && paymentContext && (
                            <div className="space-y-4" key={`card-payment-${paymentContext.reg.id}`}>
                                <div className="p-3 bg-blue-50 dark:bg-blue-900/20 rounded-lg border border-blue-200 dark:border-blue-800 mb-2">
                                    <p className="text-xs text-blue-700 dark:text-blue-300 flex items-center gap-2">
                                        <CreditCard size={14} />
                                        Enter card details below to process payment securely via Stripe.
                                    </p>
                                </div>
                                <StripePaymentWrapper
                                    key={`stripe-wrapper-${paymentContext.reg.id}`}
                                    registrationId={paymentContext.reg.id}
                                    amount={totalDue}
                                    onSuccess={() => {
                                        // Update local state
                                        const updatedRegs = registrations.map(r =>
                                            r.id === paymentContext.reg.id
                                                ? { ...r, paymentStatus: 'completed' as const }
                                                : r
                                        );
                                        setRegistrations(updatedRegs);
                                        processTickets(updatedRegs);
                                        
                                        // Show success
                                        setPaymentStatus('done');
                                        setTimeout(() => {
                                            setPaymentContext(null);
                                            setPaymentMethod(null);
                                            setPaymentStatus('input');
                                            setPaymentError(null);
                                        }, 1500);
                                    }}
                                    onError={(error) => {
                                        console.error('[Payment] Card payment error:', error);
                                        setPaymentError(error);
                                        setPaymentStatus('error');
                                        setTimeout(() => setPaymentStatus('input'), 3000);
                                    }}
                                    onProcessing={(isProcessing) => {
                                        if (isProcessing) setPaymentStatus('processing');
                                    }}
                                />
                            </div>
                        )}

                        {paymentMethod === 'cash' && (
                            <div className="space-y-4">
                                <div className="p-4 bg-zinc-50 dark:bg-black rounded-xl border border-zinc-200 dark:border-zinc-800 mb-4">
                                    <div className="flex justify-between items-center mb-2">
                                        <span className="text-sm font-bold text-zinc-500">Total Due</span>
                                        <span className="font-bold text-lg">${totalDue.toFixed(2)}</span>
                                    </div>
                                    <Input
                                        label="Cash Tendered"
                                        type="number"
                                        value={cashTendered}
                                        onChange={e => setCashTendered(e.target.value)}
                                        placeholder="0.00"
                                        containerClassName="mb-0"
                                        className="text-right font-mono text-lg"
                                    />
                                    {Number(cashTendered) > totalDue && (
                                        <div className="flex justify-between items-center mt-4 pt-4 border-t border-zinc-200 dark:border-zinc-800">
                                            <span className="text-sm font-bold text-green-600">Change Due</span>
                                            <span className="font-black text-xl text-green-600">${(Number(cashTendered) - totalDue).toFixed(2)}</span>
                                        </div>
                                    )}
                                </div>
                                <Button onClick={() => handleProcessPayment('cash')} className="w-full bg-green-600 hover:bg-green-700 text-white border-none">
                                    <Banknote size={18} className="mr-2" />
                                    Mark as Paid (Cash)
                                </Button>
                            </div>
                        )}

                        {paymentMethod === 'transfer' && (
                            <div className="space-y-4">
                                <div className="p-4 bg-purple-50 dark:bg-purple-900/10 rounded-xl border border-purple-200 dark:border-purple-800 text-center">
                                    <p className="text-purple-800 dark:text-purple-200 text-sm mb-2">Verify the transfer on your external device/app.</p>
                                    <div className="font-mono font-bold text-2xl text-purple-900 dark:text-white">${totalDue.toFixed(2)}</div>
                                </div>
                                <Button onClick={() => handleProcessPayment('transfer')} className="w-full bg-purple-600 hover:bg-purple-700 text-white border-none">
                                    <Smartphone size={18} className="mr-2" />
                                    Confirm Transfer Received
                                </Button>
                            </div>
                        )}
                    </div>
                )}
            </div>
        );
    };

    if (!event) return <div className="min-h-screen bg-zinc-50 dark:bg-black flex items-center justify-center"><div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div></div>;

    const percentage = stats.total > 0 ? Math.round((stats.checkedIn / stats.total) * 100) : 0;

    return (
        <div className="min-h-screen bg-zinc-50 dark:bg-black text-zinc-900 dark:text-white flex flex-col">
            {/* Offline Status Banner */}
            {(!isOnline || pendingCheckIns > 0) && (
                <div className={`${isOnline ? 'bg-yellow-500 text-black' : 'bg-red-500 text-white'} px-4 py-2 flex items-center justify-between text-sm font-medium`}>
                    <div className="flex items-center gap-2">
                        {isOnline ? <CloudOff size={16} /> : <WifiOff size={16} />}
                        {isOnline 
                            ? `${pendingCheckIns} check-in${pendingCheckIns > 1 ? 's' : ''} pending sync`
                            : 'Offline Mode - Check-ins saved locally'}
                    </div>
                    {isOnline && pendingCheckIns > 0 && (
                        <button 
                            onClick={syncOfflineCheckIns}
                            disabled={isSyncing}
                            className="flex items-center gap-1 bg-white/20 px-3 py-1 rounded-full hover:bg-white/30 transition-colors"
                        >
                            <RefreshCw size={14} className={isSyncing ? 'animate-spin' : ''} />
                            {isSyncing ? 'Syncing...' : 'Sync Now'}
                        </button>
                    )}
                </div>
            )}

            <div className="bg-white dark:bg-zinc-900 border-b border-zinc-200 dark:border-zinc-800 sticky top-0 z-30 shadow-sm">
                <div className="max-w-3xl mx-auto px-4 py-4">
                    <div className="flex items-center justify-between mb-4">
                        <button onClick={() => navigate(`/manage/${event.id}`)} className="text-zinc-500 hover:text-zinc-900 dark:hover:text-white flex items-center text-sm font-medium transition-colors">
                            <ArrowLeft size={18} className="mr-1" /> Exit Portal
                        </button>
                        <div className="flex items-center gap-2">
                            <div className={`h-2 w-2 rounded-full ${isOnline ? 'bg-[#ec4899]' : 'bg-yellow-500'} animate-pulse`}></div>
                            <span className="text-xs font-bold uppercase text-zinc-500 tracking-wider">
                                {isOnline ? 'Live Check-In' : 'Offline Mode'}
                            </span>
                        </div>
                    </div>

                    <div className="flex flex-col md:flex-row md:items-end justify-between gap-4">
                        <div>
                            <h1 className="text-2xl font-black uppercase tracking-tight leading-none mb-1">{event.title}</h1>
                            <p className="text-zinc-500 text-sm font-medium">Guest Management</p>
                        </div>

                        <div className="bg-zinc-100 dark:bg-black border border-zinc-200 dark:border-zinc-800 rounded-xl p-3 flex items-center gap-6 min-w-[200px]">
                            <div>
                                <div className="text-xs font-bold text-zinc-500 uppercase">Checked In</div>
                                <div className="text-2xl font-black text-primary leading-none mt-1">{stats.checkedIn} <span className="text-lg text-zinc-400 font-medium">/ {stats.total}</span></div>
                            </div>
                            <div className="h-10 w-px bg-zinc-300 dark:bg-zinc-800"></div>
                            <div className="text-right flex-1">
                                <div className="text-2xl font-black text-zinc-900 dark:text-white leading-none">{percentage}%</div>
                                <div className="w-full bg-zinc-300 dark:bg-zinc-800 h-1.5 rounded-full mt-2 overflow-hidden">
                                    <div className="bg-primary h-full rounded-full transition-all duration-500" style={{ width: `${percentage}%` }}></div>
                                </div>
                            </div>
                        </div>
                    </div>
                </div>
            </div>

            <div className="max-w-3xl mx-auto px-4 py-6 w-full flex-1 flex flex-col">
                <div className="flex flex-col gap-4 mb-6 sticky top-36 z-20 bg-zinc-50 dark:bg-black pb-2">
                    <div className="relative flex gap-2">
                        <div className="relative flex-1 group">
                            <Search className="absolute top-1/2 -translate-y-1/2 left-4 text-zinc-400 group-focus-within:text-primary transition-colors" size={20} />
                            <input
                                type="text"
                                placeholder="Search Name, Email, Phone, Order ID..."
                                value={searchTerm}
                                onChange={(e) => setSearchTerm(e.target.value)}
                                className="w-full h-14 pl-12 pr-10 bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-2xl text-lg font-medium outline-none focus:ring-2 focus:ring-primary/50 focus:border-primary transition-all shadow-sm"
                                autoFocus
                            />
                            {searchTerm && (
                                <button onClick={() => setSearchTerm('')} className="absolute top-1/2 -translate-y-1/2 right-4 text-zinc-400 hover:text-zinc-600 dark:hover:text-zinc-200 p-1">
                                    <X size={18} />
                                </button>
                            )}
                        </div>
                    </div>

                    <div className="flex gap-2 overflow-x-auto pb-1 custom-scrollbar">
                        {['all', 'checked-in', 'unpaid'].map((f) => (
                            <button
                                key={f}
                                onClick={() => setFilter(f as any)}
                                className={`px-4 py-2 rounded-full text-sm font-bold whitespace-nowrap transition-colors border capitalize ${filter === f ? 'bg-zinc-900 dark:bg-white text-white dark:text-black border-transparent' : 'bg-white dark:bg-zinc-900 text-zinc-500 border-zinc-200 dark:border-zinc-800 hover:border-zinc-400'}`}
                            >
                                {f}
                            </button>
                        ))}
                    </div>
                </div>

                <div className="space-y-4 pb-20">
                    {filteredTickets.length === 0 ? (
                        <div className="flex flex-col items-center justify-center py-20 text-zinc-400">
                            <div className="w-16 h-16 bg-zinc-100 dark:bg-zinc-900 rounded-full flex items-center justify-center mb-4">
                                <Users size={32} className="opacity-50" />
                            </div>
                            <p className="font-bold text-lg">No guests found</p>
                            <p className="text-sm">Try adjusting your search or filters</p>
                        </div>
                    ) : (
                        filteredTickets.map(ticket => (
                            <TicketRow
                                key={ticket.id}
                                ticket={ticket}
                                onCheckIn={() => handleCheckInToggle(ticket.reg.id, ticket.uniqueKeySuffix || `${ticket.tierId}-${ticket.index}`, ticket.checkedIn)}
                                onDelete={() => setTicketToDelete(ticket)}
                                onPay={() => {
                                    setPaymentContext({
                                        reg: ticket.reg,
                                        ticketId: ticket.id,
                                        tierId: ticket.tierId,
                                        index: ticket.index
                                    });
                                    setPaymentMethod(null); // Force selection
                                    setCashTendered('');
                                    setCardDetails({ number: '', expiry: '', cvc: '', zip: '' });
                                    setPaymentStatus('input');
                                }}
                            />
                        ))
                    )}
                </div>
            </div>

            {ticketToDelete && (
                <div className="fixed inset-0 z-[70] flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm animate-in fade-in">
                    <div className="bg-white dark:bg-zinc-900 w-full max-w-sm rounded-2xl p-6 shadow-2xl border border-zinc-200 dark:border-zinc-800">
                        <div className="text-center mb-6">
                            <div className="w-12 h-12 bg-red-100 text-red-600 rounded-full flex items-center justify-center mx-auto mb-4">
                                <Trash2 size={24} />
                            </div>
                            <h3 className="text-xl font-bold text-zinc-900 dark:text-white mb-2">Delete Attendee?</h3>
                            <p className="text-zinc-500 text-sm">
                                Are you sure you want to remove <strong>{ticketToDelete.attendeeName}</strong>?
                                <br /><br />
                                {ticketToDelete.reg.paymentStatus === 'completed' && (
                                    <div className="text-red-500 font-bold block bg-red-50 dark:bg-red-900/20 p-2 rounded text-left">
                                        <div className="text-xs uppercase mb-1">Warning: Paid Ticket</div>
                                        Deleting this will mark it as REFUNDED.
                                        <div className="mt-2 text-xs font-normal border-t border-red-200 dark:border-red-800 pt-2">
                                            Refund Amount: ${(ticketToDelete.reg.tickets?.[ticketToDelete.originalTicketIndex || 0]?.pricePerTicket || 0).toFixed(2)}
                                            <br />
                                            <span className="font-bold">Platform fees are non-refundable.</span>
                                        </div>
                                    </div>
                                )}
                            </p>
                        </div>
                        <div className="flex gap-2">
                            <Button variant="ghost" onClick={() => setTicketToDelete(null)} className="flex-1">Cancel</Button>
                            <Button
                                onClick={confirmDelete}
                                isLoading={isDeleting}
                                className="flex-1 bg-red-600 hover:bg-red-700 text-white border-none"
                            >
                                Delete & Refund
                            </Button>
                        </div>
                    </div>
                </div>
            )}

            {paymentContext && (
                <div 
                    className="fixed inset-0 z-[60] bg-black/95 flex items-center justify-center p-4 animate-in fade-in"
                    onClick={(e) => {
                        // Only close if clicking the backdrop, not the modal content
                        if (e.target === e.currentTarget) {
                            setPaymentContext(null);
                        }
                    }}
                >
                    <Card 
                        className="w-full max-w-lg p-0 bg-white dark:bg-zinc-900 border-2 border-red-500 relative overflow-hidden flex flex-col max-h-[90vh]"
                        onClick={(e) => e.stopPropagation()}
                    >
                        <div className="bg-red-600 text-white p-6 pb-8 relative">
                            <button onClick={() => setPaymentContext(null)} className="absolute top-4 right-4 p-2 bg-white/10 hover:bg-white/20 rounded-full transition-colors"><X size={20} /></button>
                            <div className="flex items-center gap-3 mb-2">
                                <div className="p-2 bg-white/20 rounded-lg"><AlertTriangle size={24} /></div>
                                <h2 className="text-2xl font-black uppercase">Payment Required</h2>
                            </div>
                            <p className="text-red-100 text-sm">
                                This guest has an outstanding balance. Collect payment to auto-check-in.
                            </p>
                        </div>
                        <div className="p-6 overflow-y-auto flex-1">
                            {renderPaymentModalContent()}
                        </div>
                    </Card>
                </div>
            )}
        </div>
    );
};
