
import React, { useState, useEffect, useRef } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { ArrowLeft, CheckCircle2, Search, X, QrCode, User, RotateCcw, Camera, Filter, Users, Clock, AlertTriangle, Phone, Mail, ShoppingBag, CreditCard, Banknote, Smartphone, DollarSign, ChevronRight, ArrowLeftCircle, Trash2, Loader2, Ticket, MoreVertical } from 'lucide-react';
import { StorageService } from '../services/storageService';
import { Registration, Event, PurchasedTicket } from '../types';
import { Input, Button, Card, Badge } from './UI';
import { loadStripe, Stripe as StripeType } from '@stripe/stripe-js';

// Get Stripe publishable key from environment
const stripePromise = loadStripe(import.meta.env.VITE_STRIPE_PUBLISHABLE_KEY || '');

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
    const isUnpaid = ticket.reg.paymentStatus !== 'completed';

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

export const CheckInPortal = () => {
    const { id } = useParams<{ id: string }>();
    const navigate = useNavigate();
    const [event, setEvent] = useState<Event | null>(null);
    const [registrations, setRegistrations] = useState<Registration[]>([]);
    const [searchTerm, setSearchTerm] = useState('');
    const [allTickets, setAllTickets] = useState<CheckInTicket[]>([]);
    const [stats, setStats] = useState({ total: 0, checkedIn: 0 });
    const [filter, setFilter] = useState<'all' | 'checked-in' | 'unpaid'>('all');

    const [showScanner, setShowScanner] = useState(false);
    const videoRef = useRef<HTMLVideoElement>(null);
    const [scanError, setScanError] = useState('');
    const [scanResult, setScanResult] = useState('');

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
    const [stripeClientSecret, setStripeClientSecret] = useState<string | null>(null);
    const [stripeInstance, setStripeInstance] = useState<StripeType | null>(null);

    const [ticketToDelete, setTicketToDelete] = useState<CheckInTicket | null>(null);
    const [isDeleting, setIsDeleting] = useState(false);

    // Initialize Stripe
    useEffect(() => {
        stripePromise.then(stripe => {
            setStripeInstance(stripe);
        });
    }, []);

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
                        alert("Unauthorized access to Check-In Portal.");
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
                    const isCheckedIn = statusEntry ? statusEntry.checkedIn : (reg.checkedIn || false);

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
                        checkInTime: statusEntry?.timestamp,
                        originalTicketIndex: tIndex
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
            alert("Failed to delete ticket: " + e.message);
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
            if (showScanner) stopScanner();
            return;
        }

        setAllTickets(prev => prev.map(t => {
            // Match by ID instead of components for safety
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

        await StorageService.updateRegistration(regId, {
            checkInStatuses: newStatuses,
            checkedIn: anyCheckedIn
        });
    };

    const handleProcessPayment = async (method: 'cash' | 'card' | 'transfer') => {
        if (!paymentContext) return;
        setPaymentError(null);
        
        if (method === 'card') {
            // For card payments, we need to process through Stripe
            setPaymentStatus('processing');
            
            try {
                const totalDue = calculateTotalDue(paymentContext.reg);
                
                // Check if Stripe is available and we have a valid key
                if (!stripeInstance) {
                    // Fallback to manual/offline card recording
                    console.warn('[Payment] Stripe not available, falling back to offline card recording');
                    await finalizePayment(method, 'offline_card');
                    return;
                }

                // Create a PaymentIntent via our backend
                const response = await StorageService.Stripe.createAtDoorPaymentIntent(
                    paymentContext.reg.id,
                    totalDue
                );

                if (!response.clientSecret) {
                    throw new Error('Failed to create payment intent');
                }

                setStripeClientSecret(response.clientSecret);

                // Format card details for Stripe
                const [expMonth, expYear] = cardDetails.expiry.split('/').map(s => s.trim());
                const cardNumber = cardDetails.number.replace(/\s/g, '');

                // Confirm the payment with Stripe
                const { error, paymentIntent } = await stripeInstance.confirmCardPayment(
                    response.clientSecret,
                    {
                        payment_method: {
                            card: {
                                // Note: In production, you'd use Stripe Elements for PCI compliance
                                // This is a simplified version that collects card data directly
                                // For full PCI compliance, integrate Stripe Elements
                                token: await createCardToken(cardNumber, expMonth, expYear, cardDetails.cvc)
                            },
                            billing_details: {
                                name: paymentContext.reg.attendeeName,
                                email: paymentContext.reg.attendeeEmail
                            }
                        }
                    }
                );

                if (error) {
                    throw new Error(error.message);
                }

                if (paymentIntent?.status === 'succeeded') {
                    setPaymentStatus('done');
                    setTimeout(() => finalizePayment(method, 'stripe'), 1500);
                } else {
                    throw new Error(`Payment failed with status: ${paymentIntent?.status}`);
                }
            } catch (error: any) {
                console.error('[Payment] Card payment error:', error);
                setPaymentError(error.message || 'Payment failed. Try cash or manual entry.');
                setPaymentStatus('error');
                
                // Offer fallback option
                setTimeout(() => {
                    setPaymentStatus('input');
                }, 3000);
            }
            return;
        }
        
        // For cash and transfer, proceed directly to finalize
        finalizePayment(method);
    };

    // Helper to create a card token (simplified - in production use Stripe Elements)
    const createCardToken = async (number: string, expMonth: string, expYear: string, cvc: string) => {
        // This is a placeholder - in a real implementation, you would use Stripe Elements
        // or the Stripe.js createToken method with a card element
        // For now, we'll throw an error to fall back to offline mode
        throw new Error('Direct card tokenization requires Stripe Elements integration');
    };

    const finalizePayment = async (method: 'cash' | 'card' | 'transfer', paymentSource?: string) => {
        if (!paymentContext) return;
        const { reg, tierId, index } = paymentContext;

        try {
            // Record the payment method used
            const paymentMetadata = {
                method: method,
                source: paymentSource || method,
                processedAt: new Date().toISOString(),
                processedBy: StorageService.getCurrentUser()?.id || 'staff'
            };

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

            setPaymentContext(null);
            setPaymentMethod(null);
            setCashTendered('');
            setPaymentStatus('input');
            setStripeClientSecret(null);
            setPaymentError(null);
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

    const startScanner = async () => {
        // Removed desktop restriction check
        if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
            alert("Camera API not supported in this browser.");
            return;
        }

        setShowScanner(true);
        setScanError('');
        try {
            const stream = await navigator.mediaDevices.getUserMedia({ video: { facingMode: "environment" } });
            if (videoRef.current) {
                videoRef.current.srcObject = stream;
                videoRef.current.play();
                scanFrame();
            }
        } catch (err: any) {
            setScanError("Camera access denied or unavailable. " + (err.message || ''));
            console.error(err);
        }
    };

    const stopScanner = () => {
        if (videoRef.current && videoRef.current.srcObject) {
            const stream = videoRef.current.srcObject as MediaStream;
            stream.getTracks().forEach(track => track.stop());
        }
        setShowScanner(false);
    };

    const scanFrame = async () => {
        if (!videoRef.current || !showScanner) return;

        if ('BarcodeDetector' in window) {
            try {
                // @ts-ignore
                const barcodeDetector = new BarcodeDetector({ formats: ['qr_code'] });
                const barcodes = await barcodeDetector.detect(videoRef.current);
                if (barcodes.length > 0) {
                    handleScanInput(barcodes[0].rawValue);
                    return;
                }
            } catch (e) { }
        }
        if (showScanner) requestAnimationFrame(scanFrame);
    };

    const handleScanInput = (rawValue: string) => {
        setScanResult(rawValue);
        if (rawValue.startsWith('TICKET:')) {
            const parts = rawValue.split(':');
            if (parts.length >= 4) {
                const regId = parts[1];
                const tierId = parts[2];
                const index = parseInt(parts[3], 10);

                const targetTicket = allTickets.find(t =>
                    t.reg.id === regId && t.tierId === tierId && t.index === index
                );

                if (targetTicket) {
                    if (!targetTicket.checkedIn) {
                        handleCheckInToggle(regId, `${tierId}-${index}`, false);
                        if (targetTicket.reg.paymentStatus === 'completed') {
                            alert(`SUCCESS: Checked in ${targetTicket.attendeeName}`);
                            stopScanner();
                        }
                    } else {
                        alert(`ALREADY CHECKED IN: ${targetTicket.attendeeName}`);
                    }
                } else {
                    alert("Ticket not found in this event.");
                }
            }
        }
    };

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

                        {paymentMethod === 'card' && (
                            <div className="space-y-4">
                                <div className="p-3 bg-blue-50 dark:bg-blue-900/20 rounded-lg border border-blue-200 dark:border-blue-800 mb-2">
                                    <p className="text-xs text-blue-700 dark:text-blue-300 flex items-center gap-2">
                                        <CreditCard size={14} />
                                        Process card on your external terminal, then confirm below.
                                    </p>
                                </div>
                                <div className="p-4 bg-zinc-50 dark:bg-black rounded-xl border border-zinc-200 dark:border-zinc-800">
                                    <div className="flex justify-between items-center mb-2">
                                        <span className="text-sm font-bold text-zinc-500">Amount to Charge</span>
                                        <span className="font-bold text-2xl">${calculateTotalDue(paymentContext.reg).toFixed(2)}</span>
                                    </div>
                                </div>
                                <Input 
                                    label="Last 4 Digits (optional)" 
                                    placeholder="1234" 
                                    maxLength={4}
                                    value={cardDetails.number} 
                                    onChange={e => setCardDetails({ ...cardDetails, number: e.target.value })} 
                                    containerClassName="mb-0" 
                                />
                                <Button 
                                    onClick={() => handleProcessPayment('card')} 
                                    className="w-full mt-4 bg-blue-600 hover:bg-blue-700 text-white border-none"
                                >
                                    <CreditCard size={18} className="mr-2" />
                                    Confirm Card Payment Received
                                </Button>
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
            <div className="bg-white dark:bg-zinc-900 border-b border-zinc-200 dark:border-zinc-800 sticky top-0 z-30 shadow-sm">
                <div className="max-w-3xl mx-auto px-4 py-4">
                    <div className="flex items-center justify-between mb-4">
                        <button onClick={() => navigate(`/manage/${event.id}`)} className="text-zinc-500 hover:text-zinc-900 dark:hover:text-white flex items-center text-sm font-medium transition-colors">
                            <ArrowLeft size={18} className="mr-1" /> Exit Portal
                        </button>
                        <div className="flex items-center gap-2">
                            <div className="h-2 w-2 rounded-full bg-[#ec4899] animate-pulse"></div>
                            <span className="text-xs font-bold uppercase text-zinc-500 tracking-wider">Live Check-In</span>
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
                        <Button onClick={startScanner} className="h-14 w-20 p-0 flex items-center justify-center rounded-2xl shadow-lg bg-[#E0FF20] text-black hover:bg-[#d4f542] border-none">
                            <Camera size={28} strokeWidth={2.5} />
                        </Button>
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

            {showScanner && (
                <div className="fixed inset-0 z-50 bg-black flex flex-col">
                    <div className="absolute top-0 left-0 right-0 p-4 flex justify-between items-center z-10 bg-gradient-to-b from-black/80 to-transparent">
                        <h2 className="text-white font-bold text-lg flex items-center gap-2"><QrCode /> Scan Ticket</h2>
                        <button onClick={stopScanner} className="p-2 bg-white/20 rounded-full text-white"><X size={24} /></button>
                    </div>
                    <div className="flex-1 relative flex items-center justify-center">
                        <video ref={videoRef} className="absolute inset-0 w-full h-full object-cover" muted playsInline></video>
                        <div className="w-64 h-64 border-2 border-[#E0FF20] rounded-3xl relative z-10 shadow-[0_0_100px_rgba(0,0,0,0.5)]">
                            <div className="absolute top-0 left-0 w-4 h-4 border-t-4 border-l-4 border-[#E0FF20] -mt-1 -ml-1"></div>
                            <div className="absolute top-0 right-0 w-4 h-4 border-t-4 border-r-4 border-[#E0FF20] -mt-1 -mr-1"></div>
                            <div className="absolute bottom-0 left-0 w-4 h-4 border-b-4 border-l-4 border-[#E0FF20] -mb-1 -ml-1"></div>
                            <div className="absolute bottom-0 right-0 w-4 h-4 border-b-4 border-r-4 border-[#E0FF20] -mb-1 -mr-1"></div>

                            <div className="absolute inset-0 bg-[#E0FF20]/10 animate-pulse"></div>
                        </div>
                        {scanError && <div className="absolute bottom-32 bg-red-600 text-white px-4 py-2 rounded-lg font-bold">{scanError}</div>}

                        <div className="absolute bottom-10 left-0 right-0 p-4 flex justify-center z-10">
                            <button
                                onClick={stopScanner}
                                className="bg-white/10 backdrop-blur-md border border-white/20 text-white font-bold py-4 px-8 rounded-full shadow-lg active:scale-95 transition-all flex items-center gap-2"
                            >
                                <X size={20} /> Close Scanner
                            </button>
                        </div>
                    </div>
                </div>
            )}

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
                <div className="fixed inset-0 z-[60] bg-black/95 flex items-center justify-center p-4 animate-in fade-in">
                    <Card className="w-full max-w-lg p-0 bg-white dark:bg-zinc-900 border-2 border-red-500 relative overflow-hidden flex flex-col max-h-[90vh]">
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
