
import React, { useState, useEffect } from 'react';
import { useParams, useSearchParams, useNavigate } from 'react-router-dom';
import { StorageService } from '../services/storageService';
import { EmailService } from '../services/emailService';
import { Event, Registration, PurchasedTicket, PurchasedAddOn, PromoCode, User } from '../types';
import { Button, Input, Select, Card, Badge, formatTime, AnchorButton, PriceDisplay } from './UI';
import { Calendar, MapPin, Clock, Share2, Ticket, Check, AlertCircle, Info, Lock, Users, Printer, FileText, Download, Gift, Hourglass, CheckCircle, ArrowRight, Target, Image as ImageIcon, QrCode } from 'lucide-react';

export const EventView = () => {
    const { id } = useParams<{ id: string }>();
    const [searchParams] = useSearchParams();
    const navigate = useNavigate();
    const isWidget = searchParams.get('widget') === 'true';
    const hideImage = searchParams.get('hideImage') === 'true';
    const hideDetails = searchParams.get('hideDetails') === 'true';

    const [event, setEvent] = useState<Event | null>(null);
    const [loading, setLoading] = useState(true);
    const [organizerUser, setOrganizerUser] = useState<User | null>(null);

    // Registration State
    const [ticketSelection, setTicketSelection] = useState<Record<string, number>>({});
    const [addOnSelection, setAddOnSelection] = useState<Record<string, { qty: number, answer?: string }>>({});
    const [promoCode, setPromoCode] = useState('');
    const [appliedPromo, setAppliedPromo] = useState<PromoCode | null>(null);
    const [assignments, setAssignments] = useState<Record<string, { name: string, email: string }[]>>({});
    const [regData, setRegData] = useState({
        name: '',
        email: '',
        phoneNumber: '',
        donation: '',
        platformDonationAmount: 0,
        answers: {} as Record<string, string>,
        waiverAgreed: false
    });

    const [isRegistering, setIsRegistering] = useState(false);
    const [isProcessingPayment, setIsProcessingPayment] = useState(false);
    const [isSuccess, setIsSuccess] = useState(false);
    const [completedRegistration, setCompletedRegistration] = useState<Registration | null>(null);
    const [newCredentials, setNewCredentials] = useState<{ email: string, password?: string } | null>(null);

    // Waitlist State
    const [isJoiningWaitlist, setIsJoiningWaitlist] = useState(false);
    const [waitlistSuccess, setWaitlistSuccess] = useState(false);
    const [waitlistData, setWaitlistData] = useState({ name: '', email: '' });

    useEffect(() => {
        if (id) {
            StorageService.getEventById(id).then(async (ev) => {
                if (ev) {
                    setEvent(ev);
                    const org = await StorageService.getUserById(ev.ownerId);
                    if (org) setOrganizerUser(org);
                }
                setLoading(false);
            });
        }
    }, [id]);

    if (loading) return <div className="p-20 text-center animate-pulse text-zinc-500 font-black uppercase tracking-widest text-xl">Loading Experience...</div>;
    if (!event) return <div className="p-20 text-center font-black uppercase text-red-500">Event not found.</div>;

    const isSoldOut = event.capacity ? (event.registeredCount || 0) >= event.capacity : false;

    const handleTicketChange = (tierId: string, qty: number) => {
        if (event.capacity && event.capacity > 0) {
            const currentTotal = getTotalTickets();
            const currentTierQty = ticketSelection[tierId] || 0;
            const newTotal = currentTotal - currentTierQty + qty;
            const remainingGlobalCapacity = Math.max(0, event.capacity - (event.registeredCount || 0));

            if (newTotal > remainingGlobalCapacity) {
                const availableForThisTier = remainingGlobalCapacity - (currentTotal - currentTierQty);
                if (qty > availableForThisTier) {
                    alert(`Sorry, only ${availableForThisTier} tickets remaining for this event.`);
                    return;
                }
            }
        }

        setTicketSelection(prev => ({ ...prev, [tierId]: qty }));
        setAssignments(prev => {
            const current = prev[tierId] || [];
            if (qty > current.length) {
                const newSlots = Array(qty - current.length).fill({ name: '', email: '' });
                return { ...prev, [tierId]: [...current, ...newSlots] };
            } else if (qty < current.length) {
                return { ...prev, [tierId]: current.slice(0, qty) };
            }
            return prev;
        });
    };

    const handleAssignmentChange = (tierId: string, index: number, field: 'name' | 'email', value: string) => {
        setAssignments(prev => {
            const tierAssignments = [...(prev[tierId] || [])];
            while (tierAssignments.length <= index) {
                tierAssignments.push({ name: '', email: '' });
            }
            tierAssignments[index] = { ...tierAssignments[index], [field]: value };
            return { ...prev, [tierId]: tierAssignments };
        });
    };

    const handleApplyPromo = () => {
        if (!promoCode) return;
        const code = event.promoCodes?.find(p => p.code === promoCode);
        if (code) {
            if (code.maxUsage && code.usageCount >= code.maxUsage) return alert("This code has reached its usage limit.");
            if (code.expiryDate && Date.now() > code.expiryDate) return alert("This promo code has expired.");
            if (code.minOrderQty && getTotalTickets() < code.minOrderQty) return alert(`This code requires a minimum purchase of ${code.minOrderQty} tickets.`);
            setAppliedPromo(code);
        } else {
            alert("Invalid code.");
        }
    };

    const calculateTotal = () => {
        let total = 0;
        if (event.priceType === 'fixed') {
            total += (ticketSelection['general'] || 0) * event.price;
        } else if (event.priceType === 'tiered') {
            event.ticketTiers?.forEach(tier => {
                total += (ticketSelection[tier.id] || 0) * tier.price;
            });
        } else if (event.priceType === 'donation') {
            total += Number(regData.donation) || 0;
        }

        event.addOns?.forEach(addon => {
            const sel = addOnSelection[addon.id];
            if (sel) total += sel.qty * addon.price;
        });

        if (appliedPromo) {
            if (appliedPromo.type === 'percent') total -= total * (appliedPromo.value / 100);
            else total -= appliedPromo.value;
        }

        if (event.taxRate) total += total * (event.taxRate / 100);

        if (!event.absorbFees && event.priceType !== 'free' && event.priceType !== 'donation') {
            const plan = organizerUser?.subscription?.plan || 'free';
            total += StorageService.calculateFees(total, plan);
        }

        return Math.max(0, total);
    };

    const handleRegister = async () => {
        if (!regData.name || !regData.email) return alert("Please fill in your details (Main Buyer).");
        if (event.collectGuestInfo !== false && getTotalTickets() > 0) {
            const tiers = event.ticketTiers || [{ id: 'general', name: 'General Admission' }];
            for (const tier of tiers) {
                const qty = ticketSelection[tier.id] || (tier.id === 'general' ? ticketSelection['general'] : 0) || 0;
                if (qty > 0) {
                    const tierAssignments = assignments[tier.id] || [];
                    for (let i = 0; i < qty; i++) {
                        const guest = tierAssignments[i] || { name: '', email: '' };
                        if (!guest.name) {
                            return alert(`Please enter a name for ${tier.name} - Participant #${i + 1}`);
                        }
                    }
                }
            }
        }

        const isWaiverEnabled = (event.waiverConfig?.enabled) || (event.specificWaiverText || event.specificWaiverPdfUrl);
        if (isWaiverEnabled && !regData.waiverAgreed) {
            return alert("Please agree to the waiver and release of liability to continue.");
        }

        setIsRegistering(true);
        try {
            const tickets: PurchasedTicket[] = [];
            if (event.priceType === 'tiered') {
                event.ticketTiers?.forEach(tier => {
                    const qty = ticketSelection[tier.id] || 0;
                    if (qty > 0) {
                        for (let i = 0; i < qty; i++) {
                            const assignment = assignments[tier.id]?.[i] || { name: '', email: '' };
                            tickets.push({
                                tierId: tier.id,
                                name: tier.name,
                                pricePerTicket: tier.price,
                                quantity: 1,
                                attendeeName: assignment.name || (i === 0 ? regData.name : 'Guest'),
                                attendeeEmail: assignment.email
                            });
                        }
                    }
                });
            } else {
                const qty = ticketSelection['general'] || 1;
                for (let i = 0; i < qty; i++) {
                    const assignment = assignments['general']?.[i] || { name: '', email: '' };
                    tickets.push({
                        tierId: 'general',
                        name: event.ticketName || 'General Admission',
                        pricePerTicket: event.priceType === 'donation' ? 0 : event.price,
                        quantity: 1,
                        attendeeName: assignment.name || (i === 0 ? regData.name : 'Guest'),
                        attendeeEmail: assignment.email
                    });
                }
            }

            const purchasedAddOns: PurchasedAddOn[] = [];
            event.addOns?.forEach(addon => {
                const sel = addOnSelection[addon.id];
                if (sel && sel.qty > 0) {
                    purchasedAddOns.push({ id: addon.id, name: addon.name, price: addon.price, quantity: sel.qty, answer: sel.answer });
                }
            });

            const total = calculateTotal();
            const plan = organizerUser?.subscription?.plan || 'free';
            let serviceFee = 0;
            if (!event.absorbFees && event.priceType !== 'free' && event.priceType !== 'donation') {
                serviceFee = StorageService.calculateFees(total, plan);
            }

            let paymentStatus: any = event.paymentConfig.method === 'online' ? 'pending' : 'offline_pending';
            let paymentIntentId = undefined;

            if (event.paymentConfig.method === 'online' && total > 0) {
                if (!organizerUser?.stripeConnectId) throw new Error("Online payments not connected by organizer.");

                // --- SIMULATED PAYMENT TRANSFER ---
                setIsProcessingPayment(true);
                // Simulate redirect/checkout delay
                await new Promise(resolve => setTimeout(resolve, 2500));

                const payResult = await StorageService.Stripe.processSplitPayment(total, serviceFee, organizerUser.stripeConnectId);
                if (payResult.success) {
                    paymentStatus = 'completed';
                    paymentIntentId = payResult.paymentIntentId;
                } else {
                    setIsProcessingPayment(false);
                    throw new Error("Payment declined.");
                }
                setIsProcessingPayment(false);
            } else if (total === 0) {
                paymentStatus = 'completed';
            }

            const newReg: Registration = {
                id: `reg-${Date.now()}`,
                eventId: event.id,
                attendeeName: regData.name,
                attendeeEmail: regData.email.trim(),
                phoneNumber: regData.phoneNumber,
                donationAmount: Number(regData.donation) || 0,
                serviceFee,
                answers: regData.answers,
                tickets: tickets,
                addOns: purchasedAddOns,
                timestamp: Date.now(),
                paymentStatus,
                approvalStatus: event.requiresApproval ? 'pending' : 'approved',
                promoCodeUsed: appliedPromo?.code,
                waiverAgreed: regData.waiverAgreed,
                // @ts-ignore
                paymentIntentId
            };

            const result: any = await StorageService.saveRegistration(newReg);
            setNewCredentials(result.newAccount);
            setCompletedRegistration(newReg);
            setIsSuccess(true);
            window.scrollTo(0, 0);

            if (organizerUser?.gmailConfig?.connected && event.emailSettings?.enabled !== false) {
                const subject = event.requiresApproval ? `Application Received: ${event.title}` : `Confirmation: ${event.title}`;
                const body = event.requiresApproval
                    ? `Hi ${newReg.attendeeName}, we've received your registration for ${event.title}. This event requires manual approval by the organizer. We'll notify you once your request has been reviewed.`
                    : `Hi ${newReg.attendeeName}, you are registered for ${event.title}.`;

                EmailService.sendEmail(organizerUser.id, newReg.attendeeEmail, subject, body).catch(console.error);
            }
        } catch (e: any) {
            console.error(e);
            alert("Registration failed: " + e.message);
        } finally {
            setIsRegistering(false);
        }
    };

    const handleJoinWaitlist = async () => {
        if (!waitlistData.name || !waitlistData.email) return alert("Please fill in your details.");
        setIsJoiningWaitlist(true);
        try {
            await StorageService.joinWaitlist(event.id, waitlistData.name, waitlistData.email);
            setWaitlistSuccess(true);
        } catch (e: any) {
            alert("Failed to join waitlist: " + e.message);
        } finally {
            setIsJoiningWaitlist(false);
        }
    };

    const getTotalTickets = () => Object.values(ticketSelection).reduce((a, b) => a + (b || 0), 0);
    const getTotalAddOns = () => Object.values(addOnSelection).reduce((a, b) => a + (b.qty || 0), 0);

    const shareUrl = `${window.location.origin}/#/event/${event.id}`;
    const metaTitle = event.seo?.metaTitle || event.title;
    const metaDesc = event.seo?.metaDescription || event.subtitle || event.description?.substring(0, 160) || "Check out this event!";

    return (
        <>

            <div className={`min-h-screen ${isWidget ? 'bg-transparent' : 'pb-20'}`}>
                {!isWidget && (
                    <div className="max-w-7xl mx-auto px-6 mt-6">
                        <div className="relative h-[400px] md:h-[650px] w-full overflow-hidden rounded-[3rem] shadow-2xl">
                            {event.imageUrl ? (
                                <img src={event.imageUrl} alt={event.title} className="w-full h-full object-cover" />
                            ) : (
                                <div className="w-full h-full flex items-center justify-center bg-zinc-900 text-zinc-700">
                                    <ImageIcon size={64} />
                                </div>
                            )}
                            <div className="absolute inset-0 bg-gradient-to-t from-black via-black/30 to-transparent"></div>
                            <div className="absolute inset-0 bg-gradient-to-r from-black/60 via-transparent to-transparent"></div>
                            <div className="absolute bottom-0 left-0 w-full p-6 md:p-12">
                                <div className="max-w-7xl mx-auto">
                                    <Badge color="primary" className="mb-6 px-4 py-1.5 shadow-lg animate-in fade-in slide-in-from-left-4">{event.category || 'Event'}</Badge>
                                    <h1 className="text-6xl md:text-9xl font-black font-display text-white uppercase leading-[0.85] tracking-tighter mb-8 drop-shadow-2xl animate-in fade-in slide-in-from-bottom-8 duration-700">
                                        {event.title}
                                    </h1>
                                    <div className="flex flex-wrap gap-6 items-center text-white/90 font-bold bg-black/40 backdrop-blur-md p-4 rounded-2xl border border-white/10 w-fit animate-in fade-in zoom-in-95 duration-1000">
                                        <div className="flex items-center gap-3"><Calendar size={28} className="text-primary" /> {new Date(event.date).toLocaleDateString(undefined, { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' })}</div>
                                        <div className="w-px h-8 bg-white/20 hidden md:block"></div>
                                        <div className="flex items-center gap-3"><Clock size={28} className="text-secondary" /> {formatTime(event.time, event.timeFormat)}</div>
                                        <div className="w-px h-8 bg-white/20 hidden md:block"></div>
                                        <div className="flex items-center gap-3"><MapPin size={28} className="text-blue-400" /> {event.location}</div>
                                    </div>
                                </div>
                            </div>
                        </div>
                    </div>
                )}

                <div className={isWidget ? 'max-w-xl mx-auto px-4 pb-12 space-y-6' : 'max-w-7xl mx-auto px-6 mt-16 grid grid-cols-1 lg:grid-cols-12 gap-12'}>
                    <div className={isWidget ? 'space-y-6' : 'lg:col-span-8 space-y-12'}>
                        {isSuccess ? (
                            <section className="animate-in fade-in slide-in-from-bottom-8 duration-1000 print:m-0 print:p-0">
                                <div className="max-w-2xl mx-auto space-y-8">
                                    <div className="text-center space-y-4 mb-12 print:hidden">
                                        <div className={`w-20 h-20 rounded-full flex items-center justify-center mx-auto text-white shadow-2xl ${event.requiresApproval ? 'bg-amber-500 shadow-amber-500/40' : 'bg-green-500 shadow-green-500/40'}`}>
                                            {event.requiresApproval ? <Clock size={40} /> : <Check size={40} strokeWidth={4} />}
                                        </div>
                                        <h2 className="text-4xl font-black uppercase tracking-tighter text-zinc-900 dark:text-white">
                                            {event.requiresApproval ? 'Application Received!' : "You're All Set!"}
                                        </h2>
                                        <p className="text-zinc-500 font-bold">
                                            {event.requiresApproval
                                                ? "The organizer will review your request shortly."
                                                : "A confirmation email with your tickets has been sent."
                                            }
                                        </p>
                                    </div>

                                    {/* PREMIUM RECEIPT CARD */}
                                    <div className="bg-white dark:bg-zinc-900 rounded-[3rem] shadow-2xl border-2 border-zinc-100 dark:border-zinc-800 overflow-hidden relative print:border-0 print:shadow-none print:bg-white print:text-black">
                                        {/* Stub Perforation Effect */}
                                        <div className="absolute left-0 top-1/2 -translate-y-1/2 w-8 h-16 bg-zinc-50 dark:bg-zinc-950 rounded-r-full border-r border-t border-b border-zinc-200 dark:border-zinc-800 z-10 print:hidden"></div>
                                        <div className="absolute right-0 top-1/2 -translate-y-1/2 w-8 h-16 bg-zinc-50 dark:bg-zinc-950 rounded-l-full border-l border-t border-b border-zinc-200 dark:border-zinc-800 z-10 print:hidden"></div>

                                        <div className="p-10 md:p-16">
                                            {/* Receipt Header */}
                                            <div className="flex flex-col md:flex-row justify-between items-start gap-8 mb-12 border-b border-zinc-100 dark:border-zinc-800 pb-12">
                                                <div>
                                                    <div className="text-[10px] font-black uppercase tracking-[3px] text-zinc-400 mb-2">Order Confirmation</div>
                                                    <h1 className="text-4xl font-black uppercase tracking-tighter mb-4 text-zinc-900 dark:text-white leading-none">{event.title}</h1>
                                                    <div className="flex items-center gap-3 text-zinc-500 font-bold">
                                                        <Calendar size={18} /> {new Date(event.date).toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' })}
                                                    </div>
                                                    <div className="flex items-center gap-3 text-zinc-500 font-bold mt-1">
                                                        <MapPin size={18} /> {event.venueName || event.location}
                                                    </div>
                                                </div>
                                                <div className="flex flex-col items-center md:items-end gap-3 self-center md:self-start">
                                                    <div className="p-4 bg-zinc-50 dark:bg-black rounded-3xl border border-zinc-100 dark:border-zinc-800 shadow-inner">
                                                        <QrCode size={80} className="text-zinc-900 dark:text-white" />
                                                    </div>
                                                    <div className="text-[10px] font-mono uppercase tracking-widest text-zinc-400">Order ID: {completedRegistration?.id}</div>
                                                </div>
                                            </div>

                                            {/* Attendee Info */}
                                            <div className="grid grid-cols-1 md:grid-cols-2 gap-12 mb-12">
                                                <div>
                                                    <h3 className="text-xs font-black uppercase tracking-widest text-zinc-400 mb-4">Purchaser</h3>
                                                    <p className="text-xl font-black text-zinc-900 dark:text-white">{completedRegistration?.attendeeName}</p>
                                                    <p className="font-bold text-zinc-500">{completedRegistration?.attendeeEmail}</p>
                                                </div>
                                                <div>
                                                    <h3 className="text-xs font-black uppercase tracking-widest text-zinc-400 mb-4">Status</h3>
                                                    <Badge color={event.requiresApproval ? 'yellow' : 'secondary'} className="h-10 px-6 text-sm">
                                                        {event.requiresApproval ? 'Pending Approval' : 'Confirmed'}
                                                    </Badge>
                                                </div>
                                            </div>

                                            {/* Ticket Summary Table */}
                                            <div className="space-y-4 mb-12">
                                                <h3 className="text-xs font-black uppercase tracking-widest text-zinc-400 mb-4">Ticket Summary</h3>
                                                <div className="bg-zinc-50 dark:bg-black p-6 rounded-[2rem] border border-zinc-100 dark:border-zinc-800">
                                                    {completedRegistration?.tickets?.map((ticket, idx) => (
                                                        <div key={idx} className="flex justify-between items-center py-3 border-b border-zinc-200 dark:border-zinc-800 last:border-0">
                                                            <div>
                                                                <div className="font-black text-zinc-900 dark:text-white">{ticket.name}</div>
                                                                <div className="text-xs font-bold text-zinc-500 uppercase tracking-tighter">Holder: {ticket.attendeeName || completedRegistration.attendeeName}</div>
                                                            </div>
                                                            <div className="font-black text-zinc-900 dark:text-white"><PriceDisplay amount={ticket.pricePerTicket} /></div>
                                                        </div>
                                                    ))}
                                                    {completedRegistration?.addOns?.map((addon, idx) => (
                                                        <div key={idx} className="flex justify-between items-center py-3 border-b border-zinc-200 dark:border-zinc-800 last:border-0 border-t mt-3 pt-3">
                                                            <div>
                                                                <div className="font-black text-zinc-900 dark:text-white">{addon.name} x{addon.quantity}</div>
                                                            </div>
                                                            <div className="font-black text-zinc-900 dark:text-white"><PriceDisplay amount={addon.price * addon.quantity} /></div>
                                                        </div>
                                                    ))}
                                                    <div className="mt-6 flex justify-between items-center pt-6 border-t-2 border-dashed border-zinc-200 dark:border-zinc-800">
                                                        <div className="text-xl font-black uppercase tracking-tighter text-zinc-900 dark:text-white">Total Amount</div>
                                                        <div className="text-3xl font-black text-secondary">
                                                            <PriceDisplay amount={calculateTotal()} />
                                                        </div>
                                                    </div>
                                                </div>
                                            </div>

                                            {/* New Credentials section integrated nicely */}
                                            {newCredentials && (
                                                <div className="mb-12 p-8 bg-zinc-900 text-white rounded-[2rem] border border-white/10 shadow-2xl space-y-4 relative overflow-hidden group print:hidden">
                                                    <div className="absolute top-0 right-0 p-4 opacity-10 group-hover:rotate-12 transition-transform">
                                                        <Lock size={120} />
                                                    </div>
                                                    <div className="text-xs font-black uppercase tracking-[3px] text-zinc-500">Access Key Generated</div>
                                                    <h4 className="text-2xl font-black uppercase tracking-tighter leading-none">Your tickets are safe.</h4>
                                                    <p className="text-zinc-400 font-bold max-w-sm">We've created a temporary account so you can manage your registration.</p>
                                                    <div className="bg-white/5 p-4 rounded-xl border border-white/5 font-mono text-sm">
                                                        <div className="flex justify-between">
                                                            <span className="text-zinc-500">EMAIL:</span>
                                                            <span className="font-bold">{newCredentials.email}</span>
                                                        </div>
                                                        {newCredentials.password && (
                                                            <div className="flex justify-between mt-1">
                                                                <span className="text-zinc-500">PASS:</span>
                                                                <span className="text-secondary font-black">{newCredentials.password}</span>
                                                            </div>
                                                        )}
                                                    </div>
                                                </div>
                                            )}

                                            {/* Footer Message */}
                                            <div className="text-center">
                                                <div className="text-[10px] font-black uppercase tracking-[5px] text-zinc-300 dark:text-zinc-700 mb-4 italic">See you at the event</div>
                                                <div className="h-0.5 w-12 bg-secondary mx-auto rounded-full"></div>
                                            </div>
                                        </div>
                                    </div>

                                    {/* Action Buttons */}
                                    <div className="flex flex-col sm:flex-row gap-6 justify-center pt-8 print:hidden">
                                        <Button onClick={() => window.print()} variant="secondary" className="h-20 px-12 rounded-3xl flex items-center gap-4 text-xl font-black shadow-2xl hover:scale-110 active:scale-95 transition-all">
                                            <Printer size={24} /> Print Receipt
                                        </Button>
                                        <Button onClick={() => navigate('/my-tickets')} variant="outline" className="h-20 px-12 rounded-3xl flex items-center gap-4 text-xl font-black border-2 hover:bg-zinc-100 dark:hover:bg-zinc-800 transition-all">
                                            <Ticket size={24} /> My Tickets
                                        </Button>
                                    </div>
                                </div>
                            </section>
                        ) : (
                            <>
                                {(!isWidget || !hideDetails) && (
                                    <section className="animate-in fade-in duration-1000">
                                        <div className="flex items-center gap-4 mb-6">
                                            <div className="h-10 w-2 bg-primary rounded-full"></div>
                                            <h2 className="text-3xl font-black uppercase tracking-tighter text-zinc-900 dark:text-white">About Event</h2>
                                        </div>
                                        <Card className="p-8 border-zinc-200 dark:border-zinc-800 bg-white/80 dark:bg-zinc-900/80 rounded-[2rem] shadow-sm">
                                            <div className="rich-text-content text-zinc-800 dark:text-zinc-300 leading-relaxed text-xl" dangerouslySetInnerHTML={{ __html: event.description }} />
                                        </Card>
                                    </section>
                                )}

                                {(!isWidget || !hideDetails) && ((event.scheduleConfig?.enabled) || event.schedulePdfUrl) && (
                                    <section className="animate-in fade-in duration-1000 delay-200">
                                        <div className="flex items-center gap-4 mb-6">
                                            <div className="h-10 w-2 bg-secondary rounded-full"></div>
                                            <h2 className="text-3xl font-black uppercase tracking-tighter text-zinc-900 dark:text-white">Schedule</h2>
                                        </div>
                                        <Card className="p-1 overflow-hidden border-zinc-200/50 dark:border-zinc-800/50 bg-zinc-50 dark:bg-zinc-950/50 backdrop-blur-sm rounded-[2.5rem]">
                                            <div className="p-8 bg-white dark:bg-zinc-900 rounded-[calc(2.5rem-4px)]">
                                                {event.scheduleConfig?.text && (
                                                    <div className="rich-text-content text-zinc-900 dark:text-zinc-200 text-xl leading-relaxed font-bold mb-8" dangerouslySetInnerHTML={{ __html: event.scheduleConfig.text }} />
                                                )}
                                                {(event.scheduleConfig?.pdfUrl || event.schedulePdfUrl) && (
                                                    <div className={event.scheduleConfig?.text ? "pt-8 border-t border-zinc-100 dark:border-zinc-800" : ""}>
                                                        <AnchorButton
                                                            href={event.scheduleConfig?.pdfUrl || event.schedulePdfUrl}
                                                            target="_blank"
                                                            variant="secondary"
                                                            className="w-full md:w-auto h-14 px-10 rounded-2xl flex items-center justify-center gap-3 font-black text-lg shadow-xl shadow-secondary/10"
                                                        >
                                                            <FileText size={24} /> Download Schedule (PDF)
                                                        </AnchorButton>
                                                    </div>
                                                )}
                                            </div>
                                        </Card>
                                    </section>
                                )}

                                <section id="tickets" className="animate-in fade-in duration-1000 delay-300">
                                    <div className="flex items-center gap-4 mb-6">
                                        <div className="h-10 w-2 bg-primary rounded-full"></div>
                                        <h2 className="text-3xl font-black uppercase tracking-tighter flex items-center gap-3 text-zinc-900 dark:text-white">
                                            Tickets
                                        </h2>
                                    </div>

                                    <Card className="p-8 border-zinc-200/50 dark:border-zinc-800/50 bg-white dark:bg-zinc-900/50 rounded-[2.5rem]">
                                        {isSoldOut && event.waitlistConfig?.enabled ? (
                                            waitlistSuccess ? (
                                                <div className="text-center py-12 animate-in zoom-in-95 duration-500">
                                                    <div className="w-24 h-24 bg-green-500/10 text-green-500 rounded-full flex items-center justify-center mx-auto mb-6 shadow-2xl shadow-green-500/20">
                                                        <CheckCircle size={48} />
                                                    </div>
                                                    <h2 className="text-4xl font-black uppercase tracking-tighter mb-4">You're on the list!</h2>
                                                    <p className="text-zinc-500 text-xl font-medium">We'll email you if a spot opens up.</p>
                                                </div>
                                            ) : (
                                                <div className="space-y-8">
                                                    <div className="text-center mb-10">
                                                        <div className="w-20 h-20 bg-zinc-100 dark:bg-zinc-800 text-zinc-400 rounded-[2rem] flex items-center justify-center mx-auto mb-6 rotate-3 shadow-inner">
                                                            <Hourglass size={40} />
                                                        </div>
                                                        <h2 className="text-5xl font-black uppercase tracking-tighter mb-4">Sold Out!</h2>
                                                        <p className="text-zinc-500 text-xl font-medium max-w-sm mx-auto">Join our waitlist to be first in line if tickets reappear.</p>
                                                    </div>
                                                    <div className="max-w-md mx-auto space-y-4 p-8 bg-zinc-50 dark:bg-zinc-900 rounded-[2.5rem] border border-zinc-200 dark:border-zinc-800 shadow-2xl relative overflow-hidden group">
                                                        <div className="absolute top-0 right-0 w-32 h-32 bg-primary/10 rounded-full -mr-16 -mt-16 blur-2xl group-hover:bg-primary/20 transition-colors"></div>
                                                        <Input label="Full Name" placeholder="Jane Doe" value={waitlistData.name} onChange={e => setWaitlistData({ ...waitlistData, name: e.target.value })} className="bg-white dark:bg-black rounded-xl h-12" />
                                                        <Input label="Email Address" type="email" placeholder="jane@example.com" value={waitlistData.email} onChange={e => setWaitlistData({ ...waitlistData, email: e.target.value })} className="bg-white dark:bg-black rounded-xl h-12" />
                                                        <Button onClick={handleJoinWaitlist} isLoading={isJoiningWaitlist} className="w-full mt-6 h-14 text-xl font-black shadow-xl shadow-primary/20 hover:scale-[1.02] active:scale-95 transition-all rounded-2xl">
                                                            Join Waitlist
                                                        </Button>
                                                    </div>
                                                </div>
                                            )
                                        ) : (
                                            <div className="space-y-6">
                                                {event.priceType === 'tiered' ? (
                                                    event.ticketTiers?.map(tier => (
                                                        <div key={tier.id} className={`group flex flex-col md:flex-row justify-between items-center p-8 border-2 transition-all rounded-[2rem] ${ticketSelection[tier.id] ? 'border-primary bg-primary/5 shadow-2xl shadow-primary/10' : 'border-zinc-100 dark:border-zinc-800 hover:border-zinc-200 dark:hover:border-zinc-700 bg-zinc-50 dark:bg-black/20'}`}>
                                                            <div className="flex-1 text-center md:text-left mb-6 md:mb-0">
                                                                <div className="font-black text-2xl mb-1 uppercase tracking-tighter">{tier.name}</div>
                                                                <div className="text-3xl font-black text-primary"><PriceDisplay amount={tier.price} /></div>
                                                                {tier.description && <div className="text-zinc-500 mt-2 max-w-sm font-bold">{tier.description}</div>}
                                                            </div>
                                                            <div className="flex items-center gap-6 bg-white dark:bg-zinc-800 p-3 rounded-[2rem] shadow-xl ring-1 ring-zinc-200 dark:ring-zinc-700">
                                                                <button onClick={() => handleTicketChange(tier.id, Math.max(0, (ticketSelection[tier.id] || 0) - 1))} className="w-12 h-12 rounded-2xl bg-zinc-100 dark:bg-zinc-700 shadow-sm flex items-center justify-center hover:bg-zinc-200 dark:hover:bg-zinc-600 transition-colors font-bold text-2xl disabled:opacity-30" disabled={!ticketSelection[tier.id]}>-</button>
                                                                <span className="w-10 text-center font-black text-3xl">{ticketSelection[tier.id] || 0}</span>
                                                                <button onClick={() => handleTicketChange(tier.id, (ticketSelection[tier.id] || 0) + 1)} className="w-12 h-12 rounded-2xl bg-primary text-white shadow-lg shadow-primary/30 flex items-center justify-center hover:scale-110 active:scale-90 transition-all font-bold text-2xl">+</button>
                                                            </div>
                                                        </div>
                                                    ))
                                                ) : (
                                                    <div className={`p-8 border-2 transition-all rounded-[2rem] flex flex-col md:flex-row justify-between items-center ${ticketSelection['general'] ? 'border-primary bg-primary/5 shadow-2xl shadow-primary/10' : 'border-zinc-100 dark:border-zinc-800 bg-zinc-50 dark:bg-black/20'}`}>
                                                        <div className="text-center md:text-left mb-6 md:mb-0">
                                                            <div className="font-black text-2xl mb-1 uppercase tracking-tighter">{event.ticketName || 'General Admission'}</div>
                                                            <div className="text-3xl font-black text-primary">
                                                                {event.priceType === 'free' ? 'FREE' : event.priceType === 'donation' ? 'DONATION' : <PriceDisplay amount={event.price} />}
                                                            </div>
                                                        </div>
                                                        <div className="flex items-center gap-6 bg-white dark:bg-zinc-800 p-3 rounded-[2rem] shadow-xl">
                                                            <button onClick={() => handleTicketChange('general', Math.max(0, (ticketSelection['general'] || 0) - 1))} className="w-12 h-12 rounded-2xl bg-zinc-100 dark:bg-zinc-700 flex items-center justify-center hover:bg-zinc-200 transition-colors font-bold text-2xl disabled:opacity-30" disabled={!ticketSelection['general']}>-</button>
                                                            <span className="w-10 text-center font-black text-3xl">{ticketSelection['general'] || 0}</span>
                                                            <button onClick={() => handleTicketChange('general', (ticketSelection['general'] || 0) + 1)} className="w-12 h-12 rounded-2xl bg-primary text-white shadow-lg shadow-primary/30 flex items-center justify-center hover:scale-110 active:scale-90 transition-all font-bold text-2xl">+</button>
                                                        </div>
                                                    </div>
                                                )}

                                                {event.addOns && event.addOns.length > 0 && (
                                                    <div className="mt-12 pt-12 border-t border-zinc-100 dark:border-zinc-800">
                                                        <h3 className="text-2xl font-black uppercase tracking-tighter mb-8 flex items-center gap-3"><Gift size={32} className="text-secondary" /> Extra Goodies</h3>
                                                        <div className="space-y-6">
                                                            {event.addOns.map(addon => (
                                                                <div key={addon.id} className="p-8 bg-zinc-50 dark:bg-zinc-900 rounded-[2.5rem] border border-zinc-200 dark:border-zinc-800 flex flex-col md:flex-row justify-between items-center gap-8 group hover:border-secondary/30 transition-all">
                                                                    <div className="flex-1 text-center md:text-left">
                                                                        <div className="font-black text-xl flex flex-col md:flex-row items-center gap-3">
                                                                            {addon.name}
                                                                            <span className="text-secondary font-black bg-secondary/10 px-3 py-1 rounded-full text-lg"><PriceDisplay amount={addon.price} /></span>
                                                                        </div>
                                                                    </div>
                                                                    <div className="flex items-center gap-4 bg-white dark:bg-zinc-800 p-2 rounded-[1.5rem] shadow-lg">
                                                                        <button onClick={() => setAddOnSelection(prev => ({ ...prev, [addon.id]: { ...(prev[addon.id] || { qty: 0 }), qty: Math.max(0, (prev[addon.id]?.qty || 0) - 1) } }))} className="w-10 h-10 rounded-xl bg-zinc-50 flex items-center justify-center hover:bg-zinc-100 transition-colors font-bold disabled:opacity-30" disabled={!addOnSelection[addon.id]?.qty}>-</button>
                                                                        <span className="w-8 text-center font-black text-xl">{addOnSelection[addon.id]?.qty || 0}</span>
                                                                        <button onClick={() => setAddOnSelection(prev => ({ ...prev, [addon.id]: { ...(prev[addon.id] || { qty: 0 }), qty: (prev[addon.id]?.qty || 0) + 1 } }))} className="w-10 h-10 rounded-xl bg-secondary text-white flex items-center justify-center hover:scale-110 active:scale-90 transition-all font-bold text-xl">+</button>
                                                                    </div>
                                                                </div>
                                                            ))}
                                                        </div>
                                                    </div>
                                                )}

                                                <div className="mt-12 p-8 bg-zinc-100 dark:bg-zinc-800/50 rounded-[2.5rem] border-2 border-dashed border-zinc-300 dark:border-zinc-700 group hover:border-primary/50 transition-colors">
                                                    <div className="text-sm font-black text-zinc-500 uppercase tracking-widest mb-6 flex items-center gap-3">
                                                        <Target size={20} className="text-primary" /> Got a promo code?
                                                    </div>
                                                    <div className="flex gap-4">
                                                        <Input value={promoCode} onChange={e => setPromoCode(e.target.value.toUpperCase())} placeholder="ENTER CODE" containerClassName="mb-0 flex-1" disabled={!!appliedPromo} className="bg-white dark:bg-black border-none shadow-xl h-14 text-lg font-black tracking-widest rounded-2xl" />
                                                        {appliedPromo ? (
                                                            <Button variant="danger" onClick={() => { setAppliedPromo(null); setPromoCode(''); }} className="rounded-2xl px-8 h-14 font-black">Remove</Button>
                                                        ) : (
                                                            <Button variant="outline" onClick={handleApplyPromo} className="rounded-2xl px-10 h-14 font-black bg-white dark:bg-black hover:bg-primary hover:text-white border-none shadow-xl">Apply</Button>
                                                        )}
                                                    </div>
                                                    {appliedPromo && (
                                                        <div className="mt-4 text-lg text-green-600 font-black flex items-center gap-2 animate-in slide-in-from-top-4">
                                                            <CheckCircle size={20} /> Applied: {appliedPromo.type === 'percent' ? `${appliedPromo.value}% OFF` : `-$${appliedPromo.value}`}
                                                        </div>
                                                    )}
                                                </div>

                                                {(getTotalTickets() >= 1 && event.collectGuestInfo !== false) && (
                                                    <div className="mt-12 pt-12 border-t border-zinc-100 dark:border-zinc-800 animate-in fade-in">
                                                        <h3 className="text-2xl font-black uppercase tracking-tighter mb-8 flex items-center gap-3"><Users size={32} className="text-secondary" /> Guest List</h3>
                                                        <div className="space-y-6">
                                                            {(event.ticketTiers?.length ? event.ticketTiers : [{ id: 'general', name: event.ticketName || 'General Admission' }]).map(tier => {
                                                                const qty = ticketSelection[tier.id] || (tier.id === 'general' ? ticketSelection['general'] : 0) || 0;
                                                                if (qty <= 0) return null;
                                                                return (
                                                                    <div key={tier.id} className="space-y-4">
                                                                        <div className="text-sm font-black text-primary uppercase tracking-[0.2em] mb-4 mt-6">
                                                                            {tier.name} Participants
                                                                        </div>
                                                                        <div className="grid grid-cols-1 gap-4">
                                                                            {Array.from({ length: qty }).map((_, idx) => (
                                                                                <div key={`${tier.id}-${idx}`} className="p-6 bg-white dark:bg-black/40 rounded-[2rem] border border-zinc-200 dark:border-zinc-800 shadow-sm group hover:border-primary/50 transition-all">
                                                                                    <div className="text-[10px] font-black text-zinc-400 uppercase tracking-widest mb-3 flex justify-between">
                                                                                        <span>Participant #{idx + 1}</span>
                                                                                        {idx === 0 && tier.id === 'general' && <span className="text-primary">Main Buyer</span>}
                                                                                    </div>
                                                                                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                                                                        <Input
                                                                                            placeholder="Full Name"
                                                                                            value={assignments[tier.id]?.[idx]?.name || ''}
                                                                                            onChange={e => handleAssignmentChange(tier.id, idx, 'name', e.target.value)}
                                                                                            containerClassName="mb-0"
                                                                                            className="h-12 rounded-xl"
                                                                                        />
                                                                                        <Input
                                                                                            placeholder="Email (Optional)"
                                                                                            value={assignments[tier.id]?.[idx]?.email || ''}
                                                                                            onChange={e => handleAssignmentChange(tier.id, idx, 'email', e.target.value)}
                                                                                            containerClassName="mb-0"
                                                                                            className="h-12 rounded-xl"
                                                                                        />
                                                                                    </div>
                                                                                </div>
                                                                            ))}
                                                                        </div>
                                                                    </div>
                                                                );
                                                            })}
                                                        </div>
                                                    </div>
                                                )}

                                                <div className="mt-12 pt-12 border-t border-zinc-100 dark:border-zinc-800">
                                                    <h3 className="text-2xl font-black uppercase tracking-tighter mb-8">Ready to roll?</h3>
                                                    <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-12">
                                                        <Input label="Your Name" value={regData.name} onChange={e => setRegData({ ...regData, name: e.target.value })} required className="h-14 rounded-2xl text-lg" />
                                                        <Input label="Your Email" type="email" value={regData.email} onChange={e => setRegData({ ...regData, email: e.target.value })} required className="h-14 rounded-2xl text-lg" />
                                                    </div>

                                                    {((event.waiverConfig?.enabled) || (event.specificWaiverText || event.specificWaiverPdfUrl)) && (
                                                        <div className="p-8 bg-zinc-50 dark:bg-zinc-900 rounded-[2.5rem] border border-zinc-200 dark:border-zinc-800 mb-8">
                                                            <h3 className="font-black mb-4 text-xs uppercase tracking-widest text-zinc-400">Waiver & Release</h3>
                                                            <div className="h-40 overflow-y-auto bg-white dark:bg-black p-6 rounded-2xl border border-zinc-200 dark:border-zinc-800 text-sm text-zinc-600 dark:text-zinc-400 mb-6 rich-text-content font-medium" dangerouslySetInnerHTML={{ __html: event.waiverConfig?.text || event.specificWaiverText || (organizerUser?.defaultWaiver?.text) || "No waiver text provided." }} />
                                                            <label className="flex items-start gap-4 cursor-pointer group">
                                                                <div className="relative pt-1">
                                                                    <input type="checkbox" className="peer sr-only" checked={regData.waiverAgreed} onChange={e => setRegData({ ...regData, waiverAgreed: e.target.checked })} />
                                                                    <div className="w-6 h-6 border-2 border-zinc-300 dark:border-zinc-700 rounded-lg group-hover:border-primary peer-checked:bg-primary peer-checked:border-primary transition-all"></div>
                                                                    <Check size={18} className="absolute inset-0 m-auto text-white opacity-0 peer-checked:opacity-100 transition-opacity" />
                                                                </div>
                                                                <span className="text-lg font-black tracking-tight leading-tight">I agree to the waiver and release of liability. <span className="text-primary">*</span></span>
                                                            </label>
                                                        </div>
                                                    )}

                                                    <Button variant="secondary" onClick={handleRegister} isLoading={isRegistering} className="w-full h-20 text-2xl font-black shadow-2xl shadow-primary/30 rounded-[2rem] uppercase tracking-tighter hover:scale-[1.02] active:scale-95 transition-all">
                                                        Complete Order
                                                    </Button>
                                                </div>
                                            </div>
                                        )}
                                    </Card>
                                </section>
                            </>
                        )}
                    </div>

                    <div className={isWidget ? 'hidden' : 'lg:col-span-4 space-y-8'}>
                        {/* Organizer Profile */}
                        <Card className="p-8 bg-black text-white border-none rounded-[3rem] shadow-2xl relative overflow-hidden group">
                            <div className="absolute top-0 right-0 w-32 h-32 bg-primary/20 rounded-full -mr-16 -mt-16 blur-2xl group-hover:bg-primary/40 transition-all"></div>
                            <div className="relative text-center">
                                <div className="w-24 h-24 bg-gradient-to-br from-zinc-800 to-zinc-900 rounded-full mx-auto mb-6 flex items-center justify-center p-1 ring-4 ring-white/10 group-hover:scale-110 transition-transform duration-700 overflow-hidden">
                                    <div className="w-full h-full bg-zinc-900 rounded-full flex items-center justify-center text-4xl font-black overflow-hidden bg-white/5">
                                        {organizerUser?.logoUrl ? (
                                            <img src={organizerUser.logoUrl} alt={organizerUser.businessName || organizerUser.name} className="w-full h-full object-cover" />
                                        ) : (
                                            event.organizer?.charAt(0) || 'O'
                                        )}
                                    </div>
                                </div>
                                <div className="text-xs font-black uppercase tracking-[3px] text-zinc-500 mb-2">Hosted by</div>
                                <h3 className="text-3xl font-black mb-2 uppercase tracking-tighter">
                                    {organizerUser?.useBusinessName ? (organizerUser.businessName || organizerUser.name) : (organizerUser?.name || event.organizer)}
                                </h3>
                                <p className="text-zinc-400 font-bold mb-8 italic">
                                    "{organizerUser?.organizerSubtitle || `Building the future of ${event.category?.toLowerCase() || 'events'}`}"
                                </p>
                                <Button
                                    variant="outline"
                                    onClick={() => navigate(`/organizer/${organizerUser?.id || event.ownerId}`)}
                                    className="w-full border-zinc-800 text-white hover:bg-white hover:!text-black font-black rounded-2xl h-14 uppercase tracking-widest text-xs transition-all"
                                >
                                    View Full Bio
                                </Button>
                            </div>
                        </Card>

                        {/* Location Mini Map */}
                        <Card className="p-1 rounded-[3rem] overflow-hidden border-zinc-200 dark:border-zinc-800 bg-zinc-100 dark:bg-black/40">
                            <div className="h-48 bg-zinc-200 dark:bg-zinc-800 flex items-center justify-center rounded-[2.8rem] relative overflow-hidden group">
                                <MapPin size={48} className="text-primary animate-bounce relative z-10" />
                                <div className="absolute inset-0 bg-gradient-to-br from-primary/5 to-secondary/5 group-hover:scale-125 transition-transform duration-1000"></div>
                            </div>
                            <div className="p-6 text-center">
                                <h4 className="font-black uppercase tracking-tighter text-xl mb-1">{event.location?.split(',')[0]}</h4>
                                <p className="text-zinc-500 font-bold text-sm mb-6">{event.location}</p>
                                <AnchorButton href={`https://maps.google.com/?q=${encodeURIComponent(event.location)}`} target="_blank" variant="outline" className="w-full rounded-2xl h-12 uppercase font-black text-xs tracking-widest">Open in Maps</AnchorButton>
                            </div>
                        </Card>

                        {/* Share Card */}
                        <Card className="p-8 bg-zinc-50 dark:bg-zinc-900/50 border-zinc-200 dark:border-zinc-800 rounded-[3rem] text-center">
                            <div className="w-16 h-16 bg-white dark:bg-black rounded-2xl mx-auto mb-6 flex items-center justify-center shadow-xl">
                                <Share2 size={32} className="text-primary" />
                            </div>
                            <h3 className="text-2xl font-black uppercase tracking-tighter mb-2">Tell your friends</h3>
                            <p className="text-zinc-500 font-bold mb-8">This event is better with a crew. Share the vibe!</p>
                            <Button onClick={() => { navigator.clipboard.writeText(shareUrl); alert("Link copied!"); }} className="w-full h-14 rounded-2xl bg-zinc-900 text-white font-black uppercase tracking-widest text-xs hover:bg-zinc-800 transition-all flex items-center justify-center gap-3">
                                <CheckCircle size={16} /> Copy Magic Link
                            </Button>
                        </Card>
                    </div>
                </div>

                {/* Sticky Mobile Order Bar */}
                {getTotalTickets() > 0 && !isSuccess && (
                    <div className="fixed bottom-0 left-0 w-full p-4 z-50 animate-in slide-in-from-bottom-20 duration-500">
                        <div className="max-w-4xl mx-auto">
                            <Card className="p-4 bg-black/90 backdrop-blur-3xl text-white border-white/20 shadow-2xl rounded-[2.5rem] flex flex-row justify-between items-center gap-4 border-2">
                                <div className="pl-6">
                                    <div className="text-[10px] font-black uppercase tracking-[2px] text-zinc-500 mb-1">Your Selection</div>
                                    <div className="text-3xl font-black flex items-center gap-3 tracking-tighter">
                                        ${calculateTotal().toFixed(2)}
                                        <Badge className="bg-primary text-black font-black border-none text-[10px] py-0 px-2 h-5">{getTotalTickets()} TIX</Badge>
                                    </div>
                                </div>
                                <Button variant="secondary" onClick={handleRegister} isLoading={isRegistering} className="h-16 px-10 rounded-2xl font-black uppercase tracking-tighter text-xl shadow-2xl flex items-center gap-3 active:scale-95 transition-all">
                                    Checkout <ArrowRight size={24} />
                                </Button>
                            </Card>
                        </div>
                    </div>
                )}
            </div>

            {/* Simulated Payment Overlay */}
            {isProcessingPayment && (
                <div className="fixed inset-0 z-[100] bg-black/80 backdrop-blur-2xl flex items-center justify-center p-6 animate-in fade-in duration-500">
                    <div className="max-w-md w-full bg-zinc-900 border border-white/10 rounded-[3rem] p-12 text-center shadow-[0_0_100px_rgba(224,255,32,0.15)] relative overflow-hidden">
                        {/* Animated gradient ring */}
                        <div className="absolute inset-0 bg-gradient-to-br from-secondary/5 to-transparent"></div>

                        <div className="relative">
                            <div className="w-24 h-24 border-4 border-secondary/20 border-t-secondary rounded-full animate-spin mx-auto mb-8 shadow-[0_0_30px_rgba(224,255,32,0.2)]"></div>
                            <div className="absolute inset-0 flex items-center justify-center mb-8">
                                <Lock size={32} className="text-secondary animate-pulse" />
                            </div>

                            <h2 className="text-3xl font-black text-white uppercase tracking-tighter mb-4 animate-pulse">
                                Secure Checkout
                            </h2>
                            <p className="text-zinc-400 font-bold mb-8">
                                Transferring to our secure payment processor...
                            </p>

                            <div className="flex items-center justify-center gap-6 px-4 py-3 bg-white/5 rounded-2xl border border-white/5">
                                <span className="text-xs font-black uppercase tracking-widest text-zinc-500">Encrypted</span>
                                <div className="h-1 w-1 bg-zinc-700 rounded-full"></div>
                                <span className="text-xs font-black uppercase tracking-widest text-zinc-500">Validated</span>
                                <div className="h-1 w-1 bg-zinc-700 rounded-full"></div>
                                <span className="text-xs font-black uppercase tracking-widest text-zinc-500">Stripe Verified</span>
                            </div>
                        </div>
                    </div>
                </div>
            )}
        </>
    );
};
