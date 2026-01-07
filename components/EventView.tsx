
import React, { useState, useEffect } from 'react';
import { useParams, useSearchParams, useNavigate } from 'react-router-dom';
import { StorageService } from '../services/storageService';
import { EmailService } from '../services/emailService';
import { CurrencyService } from '../services/currencyService';
import { Event, Registration, PurchasedTicket, PurchasedAddOn, PromoCode, User } from '../types';
import stripePromise from '../services/stripe';
import { Button, Input, Select, Card, Badge, formatTime, AnchorButton, PriceDisplay, EventPriceDisplay, ReceiptModal, DisplayCurrencySelector } from './UI';
import { Calendar, MapPin, Clock, Share2, Ticket, Check, AlertCircle, Info, Lock, Users, Printer, FileText, Download, Gift, Hourglass, CheckCircle, ArrowRight, Target, Image as ImageIcon, QrCode, Heart, Loader } from 'lucide-react';
import { useGlobalUI } from './GlobalUIProvider';

export const EventView = () => {
    const { id } = useParams<{ id: string }>();
    const [searchParams] = useSearchParams();
    const navigate = useNavigate();
    const isWidget = searchParams.get('widget') === 'true';
    const hideImage = searchParams.get('hideImage') === 'true';
    const hideDetails = searchParams.get('hideDetails') === 'true';

    // UI State
    const [showReceipt, setShowReceipt] = useState(false);

    const [event, setEvent] = useState<Event | null>(null);
    const [loading, setLoading] = useState(true);
    const [organizerUser, setOrganizerUser] = useState<User | null>(null);
    const [currentUser, setCurrentUser] = useState<User | null>(null);

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
    const [isRedirectingToStripe, setIsRedirectingToStripe] = useState(false);
    const [isSuccess, setIsSuccess] = useState(false);
    const [completedRegistration, setCompletedRegistration] = useState<Registration | null>(null);
    const [newCredentials, setNewCredentials] = useState<{ email: string, password?: string } | null>(null);

    // Server-calculated order breakdown (single source of truth)
    const [orderBreakdown, setOrderBreakdown] = useState<{
        ticketSubtotal: number;
        addOnSubtotal: number;
        rawSubtotal: number;
        discountAmount: number;
        discountedSubtotal: number;
        taxAmount: number;
        customFeesAmount: number;
        platformFee: number;
        grandTotal: number;
    } | null>(null);
    const [isCalculating, setIsCalculating] = useState(false);

    // Waitlist State
    const [isJoiningWaitlist, setIsJoiningWaitlist] = useState(false);
    const [waitlistSuccess, setWaitlistSuccess] = useState(false);
    const [waitlistData, setWaitlistData] = useState({ name: '', email: '' });
    const { showToast, showAlert, showConfirm } = useGlobalUI();

    // Display Currency State (UI-only, doesn't affect Stripe charges)
    const [displayCurrency, setDisplayCurrency] = useState<string>('');
    
    // Initialize display currency from user's locale/geo detection
    useEffect(() => {
        const initDisplayCurrency = async () => {
            // Check if user has set a manual preference
            const manualPref = CurrencyService.getUserPreference();
            if (manualPref) {
                setDisplayCurrency(manualPref);
                return;
            }
            
            // Auto-detect from locale/geo
            const detected = await CurrencyService.autoDetectCurrency();
            setDisplayCurrency(detected);
        };
        
        initDisplayCurrency();
        
        // Listen for currency change events
        const handleCurrencyChange = () => {
            const newCurrency = CurrencyService.getDisplayCurrency();
            setDisplayCurrency(newCurrency);
        };
        
        window.addEventListener('currencyChanged', handleCurrencyChange);
        return () => window.removeEventListener('currencyChanged', handleCurrencyChange);
    }, []);

    // Platform Donation Custom Amount State
    const [showCustomDonationInput, setShowCustomDonationInput] = useState(false);
    const [customDonationAmount, setCustomDonationAmount] = useState('');

    // Favorites
    const [loadingFavorite, setLoadingFavorite] = useState(false);
    const toggleFavorite = async () => {
        if (!currentUser) return showToast("Please login to favorite organizers.", "info");
        if (!organizerUser) return;
        setLoadingFavorite(true);
        const updated = await StorageService.toggleFavoriteOrganizer(organizerUser.id);
        if (updated) setCurrentUser(updated);
        setLoadingFavorite(false);
    };

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

    useEffect(() => {
        if (organizerUser?.primaryColor) {
            document.documentElement.style.setProperty('--color-primary', organizerUser.primaryColor);
        } else {
            document.documentElement.style.removeProperty('--color-primary');
        }

        return () => {
            // Clean up branding when leaving the event page to restore global site branding
            document.documentElement.style.removeProperty('--color-primary');
        };
    }, [organizerUser?.primaryColor]);

    useEffect(() => {
        const user = StorageService.getCurrentUser();
        if (user) {
            setCurrentUser(user);
            setRegData(prev => ({ ...prev, name: user.name, email: user.email }));
        }
    }, []);

    // Track affiliate click when visiting event page with referral code
    useEffect(() => {
        const refCode = searchParams.get('ref');
        if (refCode && id) {
            StorageService.trackAffiliateClick(id, refCode);
        }
    }, [id, searchParams]);



    useEffect(() => {
        const checkSuccess = async () => {
            const success = searchParams.get('success');
            const sessionId = searchParams.get('session_id');
            
            // Wait for event to be loaded before processing success
            if (success === 'true' && sessionId && event && !isSuccess && !isProcessingPayment) {
                setIsProcessingPayment(true);
                    
                // Show immediate feedback - payment was successful on Stripe's end
                showToast("Payment successful! Preparing your confirmation...", "success");
                    
                const verifyAndConfirm = async () => {
                    let attempts = 0;
                    const maxAttempts = 15; // 7.5 seconds max
                        
                    while (attempts < maxAttempts) {
                        try {
                            // First, try to verify with Stripe directly
                            const verifyResponse = await fetch('/api/stripe/verify-session', {
                                method: 'POST',
                                headers: { 'Content-Type': 'application/json' },
                                body: JSON.stringify({ sessionId })
                            });
                            
                            if (verifyResponse.ok) {
                                const result = await verifyResponse.json();
                                
                                if (result.status === 'success' && result.registration) {
                                    const reg = result.registration;
                                    // Normalize the registration
                                    const normalizedReg = {
                                        ...reg,
                                        id: reg.id,
                                        eventId: reg.event_id,
                                        attendeeName: reg.attendee_name,
                                        attendeeEmail: reg.attendee_email,
                                        paymentStatus: reg.payment_status || 'paid',
                                        tickets: reg.tickets || [],
                                        addOns: reg.add_ons || [],
                                        timestamp: new Date(reg.created_at).getTime(),
                                    };
                                    
                                    setCompletedRegistration(normalizedReg as any);
                                    setIsSuccess(true);
                                    setIsProcessingPayment(false);
                                    window.scrollTo(0, 0);

                                    // Send confirmation email
                                    if (organizerUser?.gmailConfig?.connected && event.emailSettings?.enabled !== false) {
                                        const subject = event.requiresApproval ? `Application Received: ${event.title}` : `Confirmation: ${event.title}`;
                                        const body = event.requiresApproval
                                            ? `Hi ${normalizedReg.attendeeName}, we've received your registration for ${event.title}. This event requires manual approval by the organizer. We'll notify you once your request has been reviewed.`
                                            : `Hi ${normalizedReg.attendeeName}, you are registered for ${event.title}.`;
                                        EmailService.sendEmail(organizerUser.id, normalizedReg.attendeeEmail, subject, body).catch(console.error);
                                    }

                                    // Remove query params
                                    window.history.replaceState({}, '', `/#/event/${event.id}`);
                                    return;
                                }
                            }
                            
                            // Fallback: poll for registration
                            const reg = await StorageService.getRegistrationBySessionId(sessionId);
                            if (reg && (reg.paymentStatus === 'paid' || reg.paymentStatus === 'completed')) {
                                setCompletedRegistration(reg);
                                setIsSuccess(true);
                                setIsProcessingPayment(false);
                                window.scrollTo(0, 0);
                                window.history.replaceState({}, '', `/#/event/${event.id}`);
                                return;
                            }
                        } catch (e) {
                            console.error("Verification error:", e);
                        }
                        attempts++;
                        await new Promise(r => setTimeout(r, 500));
                    }
                    
                    // Even if polling times out, payment was successful
                    showAlert({
                        title: "Payment Successful!",
                        message: "Your payment was processed successfully. Your tickets will appear in 'My Tickets' shortly."
                    });
                    setIsProcessingPayment(false);
                    
                    // Redirect to My Tickets
                    setTimeout(() => {
                        window.history.replaceState({}, '', '/#/my-tickets');
                        window.location.reload();
                    }, 2000);
                };
                verifyAndConfirm();
            }
        };

        if (event) checkSuccess();
    }, [searchParams, event, isSuccess, organizerUser, isProcessingPayment]);

    // Debounced fetch for server-calculated order breakdown
    useEffect(() => {
        if (!event) return;
        
        // Check if any tickets are selected
        const hasTickets = Object.values(ticketSelection).some(qty => qty > 0);
        if (!hasTickets && event.priceType !== 'donation') {
            setOrderBreakdown(null);
            return;
        }

        // For donation events, need donation amount > 0
        if (event.priceType === 'donation' && (!regData.donation || Number(regData.donation) <= 0)) {
            setOrderBreakdown(null);
            return;
        }

        const fetchBreakdown = async () => {
            setIsCalculating(true);
            try {
                // Convert addOnSelection to simple qty format
                const simpleAddOns: Record<string, number> = {};
                Object.entries(addOnSelection).forEach(([id, val]) => {
                    if (val.qty > 0) simpleAddOns[id] = val.qty;
                });

                const response = await fetch('/api/stripe/calculate-order', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({
                        eventId: event.id,
                        ticketSelections: ticketSelection,
                        addOnSelections: simpleAddOns,
                        promoCode: appliedPromo?.code || null,
                        donationAmount: event.priceType === 'donation' ? Number(regData.donation) || 0 : undefined,
                    }),
                });

                if (response.ok) {
                    const breakdown = await response.json();
                    setOrderBreakdown(breakdown);
                }
            } catch (error) {
                console.error('Failed to calculate order:', error);
            } finally {
                setIsCalculating(false);
            }
        };

        const timer = setTimeout(fetchBreakdown, 300);
        return () => clearTimeout(timer);
    }, [ticketSelection, addOnSelection, appliedPromo, event?.id, event?.priceType, regData.donation]);

    // Show payment processing screen immediately if returning from Stripe success
    const successParam = searchParams.get('success');
    const sessionIdParam = searchParams.get('session_id');
    
    if ((loading || !event) && successParam === 'true' && sessionIdParam) {
        return (
            <div className="min-h-screen bg-zinc-950 flex items-center justify-center p-6">
                <div className="max-w-md w-full bg-zinc-900 border border-white/10 rounded-[3rem] p-12 text-center shadow-[0_0_100px_rgba(34,197,94,0.15)] relative overflow-hidden">
                    <div className="absolute inset-0 bg-gradient-to-br from-green-500/5 to-transparent"></div>
                    <div className="relative">
                        <div className="w-24 h-24 border-4 border-green-500/20 border-t-green-500 rounded-full animate-spin mx-auto mb-8 shadow-[0_0_30px_rgba(34,197,94,0.2)]"></div>
                        <h2 className="text-3xl font-black text-white uppercase tracking-tighter mb-4">
                            Payment Successful!
                        </h2>
                        <p className="text-zinc-400 font-bold mb-8">
                            Preparing your tickets and confirmation...
                        </p>
                        <div className="flex items-center justify-center gap-6 px-4 py-3 bg-green-500/10 rounded-2xl border border-green-500/20">
                            <span className="text-xs font-black uppercase tracking-widest text-green-500">Payment Confirmed</span>
                            <div className="h-1 w-1 bg-green-500 rounded-full animate-pulse"></div>
                            <span className="text-xs font-black uppercase tracking-widest text-zinc-500">Loading Event...</span>
                        </div>
                    </div>
                </div>
            </div>
        );
    }
    
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
                    showToast(`Sorry, only ${availableForThisTier} tickets remaining for this event.`, "info");
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
            if (code.maxUsage && code.usageCount >= code.maxUsage) return showToast("This code has reached its usage limit.", "error");
            if (code.expiryDate && Date.now() > code.expiryDate) return showToast("This promo code has expired.", "error");
            if (code.minOrderQty && getTotalTickets() < code.minOrderQty) return showToast(`This code requires a minimum purchase of ${code.minOrderQty} tickets.`, "info");
            setAppliedPromo(code);
            showToast("Promo code applied!", "success");
        } else {
            showToast("Invalid promo code.", "error");
        }
    };

    const calculateTotal = () => {
        // Use server-calculated breakdown if available (single source of truth)
        if (orderBreakdown) {
            return orderBreakdown.grandTotal + (regData.platformDonationAmount || 0);
        }

        // Fallback calculation for immediate UI feedback (before API responds)
        let taxableGross = 0;
        let nonTaxableGross = 0;

        // Tickets are assumed taxable by default (legacy behavior)
        if (event.priceType === 'fixed') {
            taxableGross += (ticketSelection['general'] || 0) * event.price;
        } else if (event.priceType === 'tiered') {
            event.ticketTiers?.forEach(tier => {
                taxableGross += (ticketSelection[tier.id] || 0) * tier.price;
            });
        } else if (event.priceType === 'donation') {
            // Donation tickets often taxed in legacy code, preserving this unless changed.
            taxableGross += Number(regData.donation) || 0;
        }

        // Add-ons: Check taxable flag
        event.addOns?.forEach(addon => {
            const sel = addOnSelection[addon.id];
            if (sel) {
                const amount = sel.qty * addon.price;
                // Treat undefined as TRUE (Taxable) to support legacy behavior
                // Explicit FALSE means tax-exempt
                if (addon.taxable !== false) {
                    taxableGross += amount;
                } else {
                    nonTaxableGross += amount;
                }
            }
        });

        const totalGross = taxableGross + nonTaxableGross;

        // Apply Discount (Pro-rata or on total base)
        let basePrice = totalGross;
        if (appliedPromo) {
            if (appliedPromo.type === 'percent') basePrice -= basePrice * (appliedPromo.value / 100);
            else basePrice = Math.max(0, basePrice - appliedPromo.value);
        }

        // Calculate Taxable Portion of Base Price
        // If discount happened, we scale taxable amount down proportionally
        const taxableRatio = totalGross > 0 ? (taxableGross / totalGross) : 0;
        const taxableBase = basePrice * taxableRatio;

        let total = basePrice;

        // Tax
        if (event.taxRate) {
            total += taxableBase * (event.taxRate / 100);
        }

        // Custom Fees
        if (event.customFees) {
            event.customFees.forEach(fee => {
                if (fee.type === 'percent') total += basePrice * (fee.amount / 100);
                else total += fee.amount;
            });
        }

        if (!event.absorbFees && event.priceType !== 'free' && event.priceType !== 'donation') {
            const plan = organizerUser?.subscription?.plan || 'free';
            total += StorageService.calculateFees(total, plan);
        }

        // Add platform donation (separate from ticket revenue)
        total += regData.platformDonationAmount || 0;

        return Math.max(0, Number(total.toFixed(2)));
    };

    const handleRegister = async () => {
        if (!regData.name || !regData.email) return showToast("Please fill in your details (Main Buyer).", "info");
        if (event.collectGuestInfo !== false && getTotalTickets() > 0) {
            const tiers = event.ticketTiers || [{ id: 'general', name: 'General Admission' }];
            for (const tier of tiers) {
                const qty = ticketSelection[tier.id] || (tier.id === 'general' ? ticketSelection['general'] : 0) || 0;
                if (qty > 0) {
                    const tierAssignments = assignments[tier.id] || [];
                    for (let i = 0; i < qty; i++) {
                        const guest = tierAssignments[i] || { name: '', email: '' };
                        if (!guest.name) {
                            return showToast(`Please enter a name for ${tier.name} - Participant #${i + 1}`, "info");
                        }
                    }
                }
            }
        }

        const isWaiverEnabled = (event.waiverConfig?.enabled) || (event.specificWaiverText || event.specificWaiverPdfUrl);
        if (isWaiverEnabled && !regData.waiverAgreed) {
            return showToast("Please agree to the waiver to continue.", "info");
        }

        // Platform donation is now optional for all users - no validation needed

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
                        pricePerTicket: (event.priceType === 'donation' || event.priceType === 'free') ? 0 : event.price,
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


            // Let's do a precise breakdown calculation to save correct snapshots
            let taxableSnapshotGross = 0;
            let nonTaxableSnapshotGross = 0;

            // 1. Base Ticket Price
            if (event.priceType === 'fixed') taxableSnapshotGross += (ticketSelection['general'] || 0) * event.price;
            else if (event.priceType === 'tiered') event.ticketTiers?.forEach(t => taxableSnapshotGross += (ticketSelection[t.id] || 0) * t.price);
            else if (event.priceType === 'donation') taxableSnapshotGross += Number(regData.donation) || 0;

            event.addOns?.forEach(a => {
                if (addOnSelection[a.id]) {
                    const amt = addOnSelection[a.id].qty * a.price;
                    if (a.taxable !== false) taxableSnapshotGross += amt;
                    else nonTaxableSnapshotGross += amt;
                }
            });

            const snapshotTotalGross = taxableSnapshotGross + nonTaxableSnapshotGross;

            // 2. Discounts
            let basePrice = snapshotTotalGross;
            if (appliedPromo) {
                if (appliedPromo.type === 'percent') basePrice -= basePrice * (appliedPromo.value / 100);
                else basePrice = Math.max(0, basePrice - appliedPromo.value);
            }

            // 3. Tax
            let taxAmount = 0;
            if (event.taxRate) {
                const taxableRatio = snapshotTotalGross > 0 ? (taxableSnapshotGross / snapshotTotalGross) : 0;
                taxAmount = (basePrice * taxableRatio) * (event.taxRate / 100);
            }

            // 4. Custom Fees
            let customFeesAmount = 0;
            if (event.customFees) {
                event.customFees.forEach(fee => {
                    if (fee.type === 'percent') customFeesAmount += basePrice * (fee.amount / 100);
                    else customFeesAmount += fee.amount;
                });
            }

            // 5. Total
            const total = basePrice + taxAmount + customFeesAmount;

            // 6. Platform Fees (on the gross total usually, or base? Logic in calculateFees matches EventView logic implies total)
            const plan = organizerUser?.subscription?.plan || 'free';
            let serviceFee = 0;
            if (!event.absorbFees && event.priceType !== 'free' && event.priceType !== 'donation') {
                // If calculateFees adds on top, we use 'total' (which includes tax/fees)
                serviceFee = StorageService.calculateFees(total, plan);
            }

            const finalTotal = total + serviceFee;

            let paymentStatus: any = event.paymentConfig.method === 'online' ? 'pending' : 'offline_pending';
            let paymentIntentId = undefined;

            if (event.paymentConfig.method === 'online' && finalTotal > 0) {
                if (!organizerUser?.stripeConnectId) throw new Error("Online payments not connected by organizer.");

                // Validate that server breakdown is loaded and total matches
                if (orderBreakdown) {
                    const serverTotal = orderBreakdown.grandTotal + (regData.platformDonationAmount || 0);
                    const tolerance = 0.02; // Allow 2 cents tolerance for rounding
                    if (Math.abs(serverTotal - calculateTotal()) > tolerance) {
                        console.warn(`Price mismatch detected: UI=${calculateTotal()}, Server=${serverTotal}`);
                        // The useEffect will automatically refetch when dependencies change
                        showToast("Price updated. Please review and try again.", "info");
                        setIsRegistering(false);
                        return;
                    }
                }

                // --- REAL STRIPE CHECKOUT ---
                setIsProcessingPayment(true);

                // Construct simple addon map for backend
                const simpleAddOns: { [key: string]: number } = {};
                Object.entries(addOnSelection).forEach(([id, val]) => {
                    if (val.qty > 0) simpleAddOns[id] = val.qty;
                });

                // Use the event's currency for Stripe checkout
                // This ensures buyers are charged in the currency the organizer set
                const eventCurrency = event.currency || 'USD';

                const response = await fetch('/api/stripe/create-order', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({
                        eventId: event.id,
                        ticketSelections: ticketSelection,
                        addOnSelections: simpleAddOns,
                        promoCode: appliedPromo?.code,
                        affiliateCode: searchParams.get('ref') || undefined,
                        platformDonationAmount: regData.platformDonationAmount || 0, // Platform support donation
                        donationAmount: event.priceType === 'donation' ? Number(regData.donation) || 0 : 0, // Ticket donation amount
                        customerEmail: regData.email.trim(),
                        customerName: regData.name,
                        assignments: assignments,
                        phoneNumber: regData.phoneNumber,
                        currency: eventCurrency, // Use event's currency for checkout
                        successUrl: `${window.location.origin}/?stripe_return=true&success=true&event_id=${event.id}`,
                        cancelUrl: `${window.location.origin}/?stripe_return=true&canceled=true&event_id=${event.id}`,
                        userId: currentUser?.id
                    }),
                });

                const sessionData = await response.json();
                if (sessionData.error) throw new Error(sessionData.error);

                if (sessionData.url) {
                    // Show friendly redirect message before sending to Stripe
                    setIsRedirectingToStripe(true);
                    setIsRegistering(false);
                    
                    // Brief delay to show the message, then redirect
                    setTimeout(() => {
                        window.location.href = sessionData.url;
                    }, 1500);
                    return;
                }
                return; // Redirect happens here
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
                platformDonationAmount: regData.platformDonationAmount || 0,
                serviceFee,
                answers: regData.answers,
                tickets: tickets,
                addOns: purchasedAddOns,
                timestamp: Date.now(),
                paymentStatus,
                approvalStatus: event.requiresApproval ? 'pending' : 'approved',
                promoCodeUsed: appliedPromo?.code,
                waiverAgreed: regData.waiverAgreed,
                taxAmount,
                customFeesAmount,
                stripePaymentIntentId: paymentIntentId
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
            showAlert({
                title: "Registration Failed",
                message: e.message || "An unexpected error occurred during registration."
            });
        } finally {
            setIsRegistering(false);
        }
    };

    const handleJoinWaitlist = async () => {
        if (!waitlistData.name || !waitlistData.email) return showToast("Please fill in your details.", "info");
        setIsJoiningWaitlist(true);
        try {
            await StorageService.joinWaitlist(event.id, waitlistData.name, waitlistData.email);
            setWaitlistSuccess(true);
            showToast("You've been added to the waitlist!", "success");
        } catch (e: any) {
            showToast("Failed to join waitlist: " + e.message, "error");
        } finally {
            setIsJoiningWaitlist(false);
        }
    };

    const getTotalTickets = () => Object.values(ticketSelection).reduce((a, b) => a + (b || 0), 0);
    const getTotalAddOns = () => Object.values(addOnSelection).reduce((a, b) => a + (b.qty || 0), 0);

    // Global currency for this event - use organizer's default currency as source of truth
    const eventCurrency = organizerUser?.defaultCurrency || event.currency || 'USD';

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
                                    <h1 className="text-5xl lg:text-8xl font-black font-display text-white uppercase leading-[0.85] tracking-tighter mb-8 drop-shadow-2xl animate-in fade-in slide-in-from-bottom-8 duration-700 max-w-5xl">
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
                                                        <div key={idx} className="flex justify-between items-center py-3 border-b border-zinc-200 dark:border-zinc-800 last:border-0 transform transition-all hover:scale-[1.01]">
                                                            <div>
                                                                <div className="font-black text-zinc-900 dark:text-white">{ticket.name}</div>
                                                                <div className="text-xs font-bold text-zinc-500 uppercase tracking-tighter">Holder: {ticket.attendeeName || completedRegistration.attendeeName}</div>
                                                            </div>
                                                            <div className="font-black text-zinc-900 dark:text-white"><EventPriceDisplay amount={ticket.pricePerTicket} currency={event.currency || 'USD'} /></div>
                                                        </div>
                                                    ))}
                                                    {completedRegistration?.addOns?.map((addon, idx) => (
                                                        <div key={`addon-${idx}`} className="flex justify-between items-center py-3 border-b border-zinc-200 dark:border-zinc-800 last:border-0 border-t mt-3 pt-3">
                                                            <div>
                                                                <div className="font-black text-zinc-900 dark:text-white">{addon.name} x{addon.quantity}</div>
                                                            </div>
                                                            <div className="font-black text-zinc-900 dark:text-white"><EventPriceDisplay amount={addon.price * addon.quantity} currency={event.currency || 'USD'} /></div>
                                                        </div>
                                                    ))}

                                                    {/* Fees Breakdown */}
                                                    {(completedRegistration?.serviceFee || 0) > 0 && (
                                                        <div className="flex justify-between items-center py-2 text-sm text-zinc-500 font-medium">
                                                            <span>Platform & Service Fees</span>
                                                            <span><EventPriceDisplay amount={completedRegistration?.serviceFee || 0} currency={event.currency || 'USD'} /></span>
                                                        </div>
                                                    )}

                                                    {/* Total Calculation based on saved registration data, NOT current state */}
                                                    <div className="mt-6 flex justify-between items-center pt-6 border-t-2 border-dashed border-zinc-200 dark:border-zinc-800">
                                                        <div className="text-xl font-black uppercase tracking-tighter text-zinc-900 dark:text-white">Total Amount</div>
                                                        <div className="text-3xl font-black text-secondary">
                                                            {/* Recalculate total from the registration object to be safe */}
                                                            <EventPriceDisplay amount={
                                                                (completedRegistration?.tickets?.reduce((acc, t) => acc + (t.pricePerTicket * t.quantity), 0) || 0) +
                                                                (completedRegistration?.addOns?.reduce((acc, a) => acc + (a.price * a.quantity), 0) || 0) +
                                                                (completedRegistration?.serviceFee || 0) +
                                                                (completedRegistration?.donationAmount || 0)
                                                            } currency={event.currency || 'USD'} />
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
                                        <div className="flex flex-col sm:flex-row gap-6 justify-center pt-8 print:hidden">
                                            <Button onClick={() => setShowReceipt(true)} variant="secondary" className="h-20 px-12 rounded-3xl flex items-center gap-4 text-xl font-black shadow-2xl hover:scale-110 active:scale-95 transition-all">
                                                <Printer size={24} /> View Receipt
                                            </Button>
                                            <Button onClick={() => navigate('/my-tickets')} variant="outline" className="h-20 px-12 rounded-3xl flex items-center gap-4 text-xl font-black border-2 hover:bg-zinc-100 dark:hover:bg-zinc-800 transition-all">
                                                <Ticket size={24} /> My Tickets
                                            </Button>
                                        </div>
                                    </div>
                                    {completedRegistration && event && (
                                        <ReceiptModal
                                            isOpen={showReceipt}
                                            onClose={() => setShowReceipt(false)}
                                            registration={completedRegistration}
                                            event={event}
                                            organizer={organizerUser || undefined}
                                        />
                                    )}
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
                                        {isSoldOut ? (
                                            event.waitlistConfig?.enabled ? (
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
                                                <div className="text-center py-12">
                                                    <div className="w-20 h-20 bg-zinc-100 dark:bg-zinc-800 text-zinc-400 rounded-[2rem] flex items-center justify-center mx-auto mb-6 rotate-3 shadow-inner">
                                                        <AlertCircle size={40} />
                                                    </div>
                                                    <h2 className="text-5xl font-black uppercase tracking-tighter mb-4">Sold Out!</h2>
                                                    <p className="text-zinc-500 text-xl font-medium max-w-sm mx-auto">All tickets for this event have been claimed.</p>
                                                </div>
                                            )
                                        ) : (
                                            <div className="space-y-6">
                                                {/* Charge Currency Notice + Display Currency Selector */}
                                                <div className="flex flex-col sm:flex-row items-center justify-between gap-3 p-4 bg-blue-50 dark:bg-blue-900/20 rounded-xl border border-blue-200 dark:border-blue-800/50">
                                                    <div className="text-center sm:text-left">
                                                        <span className="text-blue-600 dark:text-blue-400 font-bold text-sm block">
                                                            💳 Prices in {organizerUser?.defaultCurrency || 'USD'}
                                                        </span>
                                                        {displayCurrency && displayCurrency !== (organizerUser?.defaultCurrency || 'USD') && (
                                                            <span className="text-blue-500 dark:text-blue-300 text-xs">
                                                                Viewing in {displayCurrency} (approximate)
                                                            </span>
                                                        )}
                                                    </div>
                                                    <DisplayCurrencySelector compact className="flex-shrink-0" />
                                                </div>
                                                
                                                {event.priceType === 'tiered' ? (
                                                    event.ticketTiers?.map(tier => (
                                                        <div key={tier.id} className={`group flex flex-col md:flex-row justify-between items-center p-8 border-2 transition-all rounded-[2rem] ${ticketSelection[tier.id] ? 'border-primary bg-primary/5 shadow-2xl shadow-primary/10' : 'border-zinc-100 dark:border-zinc-800 hover:border-zinc-200 dark:hover:border-zinc-700 bg-zinc-50 dark:bg-black/20'}`}>
                                                            <div className="flex-1 text-center md:text-left mb-6 md:mb-0">
                                                                <div className="font-black text-2xl mb-1 uppercase tracking-tighter">{tier.name}</div>
                                                                <div className="text-3xl font-black text-primary"><EventPriceDisplay amount={tier.price} currency={organizerUser?.defaultCurrency || 'USD'} showDisplayCurrency={true} /></div>
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
                                                    <>
                                                        <div className={`p-8 border-2 transition-all rounded-[2rem] flex flex-col md:flex-row justify-between items-center ${ticketSelection['general'] ? 'border-primary bg-primary/5 shadow-2xl shadow-primary/10' : 'border-zinc-100 dark:border-zinc-800 bg-zinc-50 dark:bg-black/20'}`}>
                                                            <div className="text-center md:text-left mb-6 md:mb-0">
                                                                <div className="font-black text-2xl mb-1 uppercase tracking-tighter">{event.ticketName || 'General Admission'}</div>
                                                                <div className="text-3xl font-black text-primary">
                                                                    {event.priceType === 'free' ? 'FREE' : event.priceType === 'donation' ? 'DONATION' : <EventPriceDisplay amount={event.price} currency={organizerUser?.defaultCurrency || 'USD'} showDisplayCurrency={true} />}
                                                                </div>
                                                            </div>
                                                            <div className="flex items-center gap-6 bg-white dark:bg-zinc-800 p-3 rounded-[2rem] shadow-xl">
                                                                <button onClick={() => handleTicketChange('general', Math.max(0, (ticketSelection['general'] || 0) - 1))} className="w-12 h-12 rounded-2xl bg-zinc-100 dark:bg-zinc-700 flex items-center justify-center hover:bg-zinc-200 transition-colors font-bold text-2xl disabled:opacity-30" disabled={!ticketSelection['general']}>-</button>
                                                                <span className="w-10 text-center font-black text-3xl">{ticketSelection['general'] || 0}</span>
                                                                <button onClick={() => handleTicketChange('general', (ticketSelection['general'] || 0) + 1)} className="w-12 h-12 rounded-2xl bg-primary text-white shadow-lg shadow-primary/30 flex items-center justify-center hover:scale-110 active:scale-90 transition-all font-bold text-2xl">+</button>
                                                            </div>
                                                        </div>

                                                        {/* Donation Amount Input - Only for donation type events */}
                                                        {event.priceType === 'donation' && ticketSelection['general'] > 0 && (
                                                            <div className="mt-6 p-6 bg-gradient-to-br from-pink-50 to-purple-50 dark:from-pink-900/20 dark:to-purple-900/20 rounded-[2rem] border-2 border-pink-200 dark:border-pink-800">
                                                                <div className="flex items-center gap-3 mb-4">
                                                                    <Heart size={24} className="text-pink-500" fill="currentColor" />
                                                                    <span className="font-black text-lg uppercase tracking-tight">Your Donation Amount</span>
                                                                </div>
                                                                <div className="flex items-center gap-4">
                                                                    <span className="text-4xl font-black text-pink-500">$</span>
                                                                    <input
                                                                        type="number"
                                                                        min="0"
                                                                        step="0.01"
                                                                        value={regData.donation}
                                                                        onChange={(e) => setRegData({ ...regData, donation: e.target.value })}
                                                                        placeholder="0.00"
                                                                        className="flex-1 h-16 text-3xl font-black bg-white dark:bg-zinc-900 border-2 border-pink-300 dark:border-pink-700 rounded-2xl px-4 text-center focus:border-pink-500 focus:ring-2 focus:ring-pink-500/30 outline-none transition-all"
                                                                    />
                                                                </div>
                                                                <p className="text-sm text-zinc-500 dark:text-zinc-400 mt-3 text-center">
                                                                    Enter any amount you'd like to contribute
                                                                </p>
                                                            </div>
                                                        )}
                                                    </>
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
                                                                            <span className="text-secondary font-black bg-secondary/10 px-3 py-1 rounded-full text-lg"><EventPriceDisplay amount={addon.price} currency={event.currency || 'USD'} /></span>
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
                                                        <Input label="Your Name" value={regData.name} onChange={e => setRegData({ ...regData, name: e.target.value })} required className="h-14 rounded-2xl text-lg" disabled={!!currentUser} />
                                                        <Input label="Your Email" type="email" value={regData.email} onChange={e => setRegData({ ...regData, email: e.target.value })} required className="h-14 rounded-2xl text-lg" disabled={!!currentUser} />
                                                    </div>

                                                    {((event.waiverConfig?.enabled) || (event.specificWaiverText || event.specificWaiverPdfUrl)) && (
                                                        <div className="p-8 bg-zinc-50 dark:bg-zinc-900 rounded-[2.5rem] border border-zinc-200 dark:border-zinc-800 mb-8">
                                                            <div className="flex justify-between items-center mb-4">
                                                                <h3 className="font-black text-xs uppercase tracking-widest text-zinc-400">Waiver & Release</h3>
                                                                {(event.waiverConfig?.pdfUrl || event.specificWaiverPdfUrl) && (
                                                                    <a
                                                                        href={event.waiverConfig?.pdfUrl || event.specificWaiverPdfUrl}
                                                                        target="_blank"
                                                                        rel="noopener noreferrer"
                                                                        className="flex items-center gap-2 text-primary text-xs font-bold hover:underline"
                                                                    >
                                                                        <Download size={14} /> Download PDF
                                                                    </a>
                                                                )}
                                                            </div>
                                                            <div className="h-40 overflow-y-auto bg-white dark:bg-zinc-900/50 p-6 rounded-2xl border border-zinc-200 dark:border-zinc-800 text-sm text-zinc-700 dark:text-zinc-200 mb-6 rich-text-content font-medium opacity-90" dangerouslySetInnerHTML={{ __html: event.waiverConfig?.text || event.specificWaiverText || (organizerUser?.defaultWaiver?.text) || "No waiver text provided." }} />
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

                                                    {/* Platform Donation Section - Compact, Optional for ALL users */}
                                                    {!event.hidePlatformDonation && (
                                                        <div className="p-4 rounded-2xl border bg-zinc-50/50 dark:bg-zinc-900/50 border-zinc-200 dark:border-zinc-800 mb-6">
                                                            <div className="flex items-center gap-3 mb-3">
                                                                <div className="w-8 h-8 rounded-lg bg-pink-100 dark:bg-pink-900/30 flex items-center justify-center">
                                                                    <Heart size={16} className="text-pink-500" />
                                                                </div>
                                                                <div className="flex-1 min-w-0">
                                                                    <p className="text-sm font-bold text-zinc-700 dark:text-zinc-300">
                                                                        Support OpenTicket <span className="text-xs font-normal text-zinc-400">(optional)</span>
                                                                    </p>
                                                                </div>
                                                            </div>

                                                            <div className="flex flex-wrap gap-2">
                                                                {/* No Tip option */}
                                                                <button
                                                                    type="button"
                                                                    onClick={() => {
                                                                        setRegData({ ...regData, platformDonationAmount: 0 });
                                                                        setShowCustomDonationInput(false);
                                                                        setCustomDonationAmount('');
                                                                    }}
                                                                    className={`py-2 px-3 rounded-lg text-xs font-bold transition-all ${
                                                                        regData.platformDonationAmount === 0
                                                                            ? 'bg-zinc-200 dark:bg-zinc-700 text-zinc-700 dark:text-zinc-200'
                                                                            : 'bg-white dark:bg-zinc-800 text-zinc-500 border border-zinc-200 dark:border-zinc-700 hover:border-zinc-300'
                                                                    }`}
                                                                >
                                                                    No tip
                                                                </button>

                                                                {/* Preset amounts: $5, $10, $25 */}
                                                                {[5, 10, 25].map((amount) => (
                                                                    <button
                                                                        key={amount}
                                                                        type="button"
                                                                        onClick={() => {
                                                                            setRegData({ ...regData, platformDonationAmount: amount });
                                                                            setShowCustomDonationInput(false);
                                                                            setCustomDonationAmount('');
                                                                        }}
                                                                        className={`py-2 px-3 rounded-lg text-xs font-bold transition-all ${
                                                                            regData.platformDonationAmount === amount
                                                                                ? 'bg-pink-500 text-white shadow-sm'
                                                                                : 'bg-white dark:bg-zinc-800 text-zinc-600 dark:text-zinc-300 border border-zinc-200 dark:border-zinc-700 hover:border-pink-300'
                                                                        }`}
                                                                    >
                                                                        ${amount}
                                                                    </button>
                                                                ))}

                                                                {/* Other/Custom button */}
                                                                {!showCustomDonationInput ? (
                                                                    <button
                                                                        type="button"
                                                                        onClick={() => setShowCustomDonationInput(true)}
                                                                        className={`py-2 px-3 rounded-lg text-xs font-bold transition-all ${
                                                                            regData.platformDonationAmount > 0 && ![5, 10, 25].includes(regData.platformDonationAmount)
                                                                                ? 'bg-pink-500 text-white shadow-sm'
                                                                                : 'bg-white dark:bg-zinc-800 text-zinc-600 dark:text-zinc-300 border border-zinc-200 dark:border-zinc-700 hover:border-pink-300'
                                                                        }`}
                                                                    >
                                                                        {regData.platformDonationAmount > 0 && ![5, 10, 25].includes(regData.platformDonationAmount) 
                                                                            ? `$${regData.platformDonationAmount}` 
                                                                            : 'Other'}
                                                                    </button>
                                                                ) : (
                                                                    <div className="flex items-center gap-1">
                                                                        <span className="text-xs text-zinc-400">$</span>
                                                                        <input
                                                                            type="number"
                                                                            min="1"
                                                                            step="1"
                                                                            placeholder="Amount"
                                                                            value={customDonationAmount}
                                                                            onChange={(e) => setCustomDonationAmount(e.target.value)}
                                                                            onBlur={() => {
                                                                                const val = parseFloat(customDonationAmount);
                                                                                if (!isNaN(val) && val > 0) {
                                                                                    setRegData({ ...regData, platformDonationAmount: val });
                                                                                }
                                                                            }}
                                                                            onKeyDown={(e) => {
                                                                                if (e.key === 'Enter') {
                                                                                    const val = parseFloat(customDonationAmount);
                                                                                    if (!isNaN(val) && val > 0) {
                                                                                        setRegData({ ...regData, platformDonationAmount: val });
                                                                                    }
                                                                                }
                                                                            }}
                                                                            className="w-16 py-1.5 px-2 text-xs rounded-lg border border-pink-300 dark:border-pink-700 bg-white dark:bg-zinc-800 focus:outline-none focus:ring-1 focus:ring-pink-500"
                                                                            autoFocus
                                                                        />
                                                                    </div>
                                                                )}
                                                            </div>

                                                            <p className="mt-2 text-[10px] text-zinc-400 leading-tight">
                                                                Tips help us keep fees low for organizers 💜
                                                            </p>
                                                        </div>
                                                    )}

                                                    {/* Order Summary with Fees */}
                                                    {(getTotalTickets() > 0 || getTotalAddOns() > 0) && calculateTotal() > 0 && (
                                                        <div className="mb-8 p-6 bg-zinc-100 dark:bg-zinc-800/50 rounded-3xl border border-zinc-200 dark:border-zinc-800">
                                                            <h4 className="font-black uppercase tracking-widest text-xs text-zinc-500 mb-4">Order Summary</h4>
                                                            <div className="space-y-2 text-sm font-medium">
                                                                {/* Itemization */}
                                                                {event.priceType === 'tiered' ? (
                                                                    event.ticketTiers?.map(tier => {
                                                                        const qty = ticketSelection[tier.id] || 0;
                                                                        if (qty === 0) return null;
                                                                        return (
                                                                            <div key={tier.id} className="flex justify-between text-zinc-600 dark:text-zinc-400">
                                                                                <span>{qty} x {tier.name}</span>
                                                                                <span>{tier.price === 0 ? 'FREE' : <EventPriceDisplay amount={tier.price * qty} currency={event.currency || 'USD'} />}</span>
                                                                            </div>
                                                                        );
                                                                    })
                                                                ) : (
                                                                    (ticketSelection['general'] || 0) > 0 && (
                                                                        <div className="flex justify-between text-zinc-600 dark:text-zinc-400">
                                                                            <span>{(ticketSelection['general'] || 0)} x {event.ticketName || 'Tickets'}</span>
                                                                            <span>{event.priceType === 'free' ? 'FREE' : event.priceType === 'donation' ? <EventPriceDisplay amount={Number(regData.donation) || 0} currency={event.currency || 'USD'} /> : <EventPriceDisplay amount={event.price * (ticketSelection['general'] || 0)} currency={event.currency || 'USD'} />}</span>
                                                                        </div>
                                                                    )
                                                                )}

                                                                {event.addOns?.map(addon => {
                                                                    const qty = addOnSelection[addon.id]?.qty || 0;
                                                                    if (qty === 0) return null;
                                                                    return (
                                                                        <div key={addon.id} className="flex justify-between text-zinc-600 dark:text-zinc-400">
                                                                            <span>{qty} x {addon.name}</span>
                                                                            <span><EventPriceDisplay amount={addon.price * qty} currency={event.currency || 'USD'} /></span>
                                                                        </div>
                                                                    )
                                                                })}

                                                                <div className="border-t border-zinc-200 dark:border-zinc-700 my-2"></div>

                                                                <div className="flex justify-between">
                                                                    <span>Subtotal</span>
                                                                    <span>
                                                                        {(() => {
                                                                            let sub = 0;
                                                                            if (event.priceType === 'fixed') sub += (ticketSelection['general'] || 0) * event.price;
                                                                            if (event.priceType === 'tiered') event.ticketTiers?.forEach(t => sub += (ticketSelection[t.id] || 0) * t.price);
                                                                            if (event.priceType === 'donation') sub += Number(regData.donation) || 0;
                                                                            event.addOns?.forEach(a => { if (addOnSelection[a.id]) sub += addOnSelection[a.id].qty * a.price; });
                                                                            if (appliedPromo) {
                                                                                if (appliedPromo.type === 'percent') sub -= sub * (appliedPromo.value / 100);
                                                                                else sub -= appliedPromo.value;
                                                                            }
                                                                            return <EventPriceDisplay amount={Math.max(0, sub)} currency={event.currency || 'USD'} />;
                                                                        })()}
                                                                    </span>
                                                                </div>

                                                                {/* Discount Line */}
                                                                {appliedPromo && (orderBreakdown?.discountAmount || 0) > 0 && (
                                                                    <div className="flex justify-between text-green-600 dark:text-green-400">
                                                                        <span>Discount ({appliedPromo.code})</span>
                                                                        <span>-<EventPriceDisplay amount={orderBreakdown?.discountAmount || 0} currency={event.currency || 'USD'} /></span>
                                                                    </div>
                                                                )}

                                                                {event.taxRate && event.taxRate > 0 && (
                                                                    <div className="flex justify-between text-zinc-500">
                                                                        <span>Tax ({event.taxRate}%)</span>
                                                                        <span>
                                                                            {orderBreakdown 
                                                                                ? <EventPriceDisplay amount={orderBreakdown.taxAmount} currency={event.currency || 'USD'} />
                                                                                : (() => {
                                                                                    let sub = 0;
                                                                                    if (event.priceType === 'fixed') sub += (ticketSelection['general'] || 0) * event.price;
                                                                                    if (event.priceType === 'tiered') event.ticketTiers?.forEach(t => sub += (ticketSelection[t.id] || 0) * t.price);
                                                                                    if (event.priceType === 'donation') sub += Number(regData.donation) || 0;
                                                                                    event.addOns?.forEach(a => { if (addOnSelection[a.id]) sub += addOnSelection[a.id].qty * a.price; });
                                                                                    if (appliedPromo) {
                                                                                        if (appliedPromo.type === 'percent') sub -= sub * (appliedPromo.value / 100);
                                                                                        else sub -= appliedPromo.value;
                                                                                    }
                                                                                    const tax = Math.max(0, sub) * (event.taxRate / 100);
                                                                                    return <EventPriceDisplay amount={tax} currency={event.currency || 'USD'} />;
                                                                                })()
                                                                            }
                                                                        </span>
                                                                    </div>
                                                                )}

                                                                {event.customFees?.map((fee, idx) => (
                                                                    <div key={idx} className="flex justify-between text-zinc-500">
                                                                        <span>{fee.name}</span>
                                                                        <span>
                                                                            {(() => {
                                                                                let sub = 0;
                                                                                if (event.priceType === 'fixed') sub += (ticketSelection['general'] || 0) * event.price;
                                                                                if (event.priceType === 'tiered') event.ticketTiers?.forEach(t => sub += (ticketSelection[t.id] || 0) * t.price);
                                                                                if (event.priceType === 'donation') sub += Number(regData.donation) || 0;
                                                                                event.addOns?.forEach(a => { if (addOnSelection[a.id]) sub += addOnSelection[a.id].qty * a.price; });
                                                                                if (appliedPromo) {
                                                                                    if (appliedPromo.type === 'percent') sub -= sub * (appliedPromo.value / 100);
                                                                                    else sub -= appliedPromo.value;
                                                                                }
                                                                                const amount = fee.type === 'percent' ? Math.max(0, sub) * (fee.amount / 100) : fee.amount;
                                                                                return <EventPriceDisplay amount={amount} currency={event.currency || 'USD'} />;
                                                                            })()}
                                                                        </span>
                                                                    </div>
                                                                ))}

                                                                {!event.absorbFees && event.priceType !== 'free' && event.priceType !== 'donation' && (
                                                                    <div className="flex justify-between text-zinc-500">
                                                                        <span>Service Fees</span>
                                                                        <span>
                                                                            {(() => {
                                                                                // Use server breakdown if available
                                                                                if (orderBreakdown) {
                                                                                    return <EventPriceDisplay amount={orderBreakdown.platformFee} currency={event.currency || 'USD'} />;
                                                                                }
                                                                                // Fallback calculation
                                                                                let sub = 0;
                                                                                if (event.priceType === 'fixed') sub += (ticketSelection['general'] || 0) * event.price;
                                                                                if (event.priceType === 'tiered') event.ticketTiers?.forEach(t => sub += (ticketSelection[t.id] || 0) * t.price);
                                                                                if ((event.priceType as string) === 'donation') sub += Number(regData.donation) || 0;
                                                                                event.addOns?.forEach(a => { if (addOnSelection[a.id]) sub += addOnSelection[a.id].qty * a.price; });
                                                                                if (appliedPromo) {
                                                                                    if (appliedPromo.type === 'percent') sub -= sub * (appliedPromo.value / 100);
                                                                                    else sub -= appliedPromo.value;
                                                                                }
                                                                                const base = Math.max(0, sub);
                                                                                let runningTotal = base;
                                                                                if (event.taxRate) runningTotal += base * (event.taxRate / 100);
                                                                                if (event.customFees) event.customFees.forEach(f => runningTotal += (f.type === 'percent' ? base * (f.amount / 100) : f.amount));

                                                                                const plan = organizerUser?.subscription?.plan || 'free';
                                                                                const fee = StorageService.calculateFees(runningTotal, plan);
                                                                                return <EventPriceDisplay amount={fee} currency={event.currency || 'USD'} />;
                                                                            })()}
                                                                        </span>
                                                                    </div>
                                                                )}

                                                                {/* Platform Donation in Summary */}
                                                                {regData.platformDonationAmount > 0 && (
                                                                    <div className="flex justify-between text-pink-600 dark:text-pink-400">
                                                                        <span className="flex items-center gap-1">
                                                                            <Heart size={14} fill="currentColor" /> Platform Donation
                                                                        </span>
                                                                        <span><EventPriceDisplay amount={regData.platformDonationAmount} currency={event.currency || 'USD'} /></span>
                                                                    </div>
                                                                )}
                                                            </div>
                                                            <div className="mt-4 pt-4 border-t border-zinc-200 dark:border-zinc-700 flex justify-between items-center text-xl font-black">
                                                                <span>Total</span>
                                                                <span className="flex items-center gap-2">
                                                                    {isCalculating && <Loader size={16} className="animate-spin text-zinc-400" />}
                                                                    <EventPriceDisplay amount={calculateTotal()} currency={event.currency || 'USD'} />
                                                                </span>
                                                            </div>
                                                            {orderBreakdown && (
                                                                <p className="text-xs text-zinc-400 mt-2 text-right">✓ Price verified</p>
                                                            )}
                                                        </div>
                                                    )}

                                                    <Button variant="secondary" onClick={handleRegister} isLoading={isRegistering} disabled={isCalculating} className="w-full h-20 text-2xl font-black shadow-2xl shadow-primary/30 rounded-[2rem] uppercase tracking-tighter hover:scale-[1.02] active:scale-95 transition-all disabled:opacity-50">
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
                                <div className="w-40 h-40 bg-gradient-to-br from-zinc-800 to-zinc-900 rounded-full mx-auto mb-6 flex items-center justify-center p-1 ring-4 ring-white/10 group-hover:scale-110 transition-transform duration-700 overflow-hidden">
                                    <div className="w-full h-full bg-zinc-900 rounded-full flex items-center justify-center text-8xl font-black overflow-hidden bg-white/5">
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
                                <div className="flex gap-3">
                                    <Button
                                        variant="outline"
                                        onClick={() => navigate(`/organizer/${organizerUser?.id || event.ownerId}`)}
                                        className="flex-1 border-zinc-800 text-white hover:bg-white hover:!text-black font-black rounded-2xl h-24 uppercase tracking-widest text-xs transition-all"
                                    >
                                        View Full Bio
                                    </Button>
                                    <Button
                                        variant="outline"
                                        onClick={toggleFavorite}
                                        disabled={loadingFavorite}
                                        className={`w-24 h-24 !p-0 rounded-2xl border-zinc-800 flex items-center justify-center transition-all ${currentUser?.favoriteOrganizers?.includes(organizerUser?.id || '') ? 'bg-pink-500 border-pink-500 text-white shadow-[0_0_20px_rgba(236,72,153,0.4)]' : 'text-zinc-600 hover:text-pink-500 hover:border-pink-500'}`}
                                    >
                                        <Heart size={42} fill={currentUser?.favoriteOrganizers?.includes(organizerUser?.id || '') ? "currentColor" : "none"} />
                                    </Button>
                                </div>
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

                        {/* Share Card - Interactive */}
                        <Card className="p-8 bg-zinc-50 dark:bg-zinc-900/50 border-zinc-200 dark:border-zinc-800 rounded-[3rem] text-center">
                            <div className="w-16 h-16 bg-white dark:bg-black rounded-2xl mx-auto mb-6 flex items-center justify-center shadow-xl">
                                <Share2 size={32} className="text-primary" />
                            </div>
                            <h3 className="text-2xl font-black uppercase tracking-tighter mb-2">Tell your friends</h3>
                            <p className="text-zinc-500 font-bold mb-6">This event is better with a crew. Share the vibe!</p>
                            
                            {/* Share Options Grid */}
                            <div className="grid grid-cols-4 gap-3 mb-6">
                                <button 
                                    onClick={() => window.open(`https://twitter.com/intent/tweet?text=${encodeURIComponent(`Check out ${event.title}!`)}&url=${encodeURIComponent(shareUrl)}`, '_blank')}
                                    className="p-3 bg-zinc-100 dark:bg-zinc-800 rounded-xl hover:bg-zinc-200 dark:hover:bg-zinc-700 transition-colors group"
                                    title="Share on X"
                                >
                                    <svg className="w-6 h-6 mx-auto text-zinc-600 dark:text-zinc-400 group-hover:text-black dark:group-hover:text-white" viewBox="0 0 24 24" fill="currentColor">
                                        <path d="M18.244 2.25h3.308l-7.227 8.26 8.502 11.24H16.17l-5.214-6.817L4.99 21.75H1.68l7.73-8.835L1.254 2.25H8.08l4.713 6.231zm-1.161 17.52h1.833L7.084 4.126H5.117z"/>
                                    </svg>
                                </button>
                                <button 
                                    onClick={() => window.open(`https://www.facebook.com/sharer/sharer.php?u=${encodeURIComponent(shareUrl)}`, '_blank')}
                                    className="p-3 bg-zinc-100 dark:bg-zinc-800 rounded-xl hover:bg-blue-100 dark:hover:bg-blue-900/30 transition-colors group"
                                    title="Share on Facebook"
                                >
                                    <svg className="w-6 h-6 mx-auto text-zinc-600 dark:text-zinc-400 group-hover:text-blue-600" viewBox="0 0 24 24" fill="currentColor">
                                        <path d="M24 12.073c0-6.627-5.373-12-12-12s-12 5.373-12 12c0 5.99 4.388 10.954 10.125 11.854v-8.385H7.078v-3.47h3.047V9.43c0-3.007 1.792-4.669 4.533-4.669 1.312 0 2.686.235 2.686.235v2.953H15.83c-1.491 0-1.956.925-1.956 1.874v2.25h3.328l-.532 3.47h-2.796v8.385C19.612 23.027 24 18.062 24 12.073z"/>
                                    </svg>
                                </button>
                                <button 
                                    onClick={() => window.open(`https://wa.me/?text=${encodeURIComponent(`Check out ${event.title}! ${shareUrl}`)}`, '_blank')}
                                    className="p-3 bg-zinc-100 dark:bg-zinc-800 rounded-xl hover:bg-green-100 dark:hover:bg-green-900/30 transition-colors group"
                                    title="Share on WhatsApp"
                                >
                                    <svg className="w-6 h-6 mx-auto text-zinc-600 dark:text-zinc-400 group-hover:text-green-600" viewBox="0 0 24 24" fill="currentColor">
                                        <path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413z"/>
                                    </svg>
                                </button>
                                <button 
                                    onClick={() => window.open(`mailto:?subject=${encodeURIComponent(`Check out ${event.title}`)}&body=${encodeURIComponent(`I thought you might be interested in this event: ${shareUrl}`)}`, '_blank')}
                                    className="p-3 bg-zinc-100 dark:bg-zinc-800 rounded-xl hover:bg-purple-100 dark:hover:bg-purple-900/30 transition-colors group"
                                    title="Share via Email"
                                >
                                    <svg className="w-6 h-6 mx-auto text-zinc-600 dark:text-zinc-400 group-hover:text-purple-600" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                                        <rect x="2" y="4" width="20" height="16" rx="2" />
                                        <path d="m22 7-8.97 5.7a1.94 1.94 0 0 1-2.06 0L2 7" />
                                    </svg>
                                </button>
                            </div>
                            
                            <Button onClick={() => { navigator.clipboard.writeText(shareUrl); showToast("Link copied to clipboard!", "success"); }} className="w-full h-14 rounded-2xl bg-zinc-900 text-white font-black uppercase tracking-widest text-xs hover:bg-zinc-800 transition-all flex items-center justify-center gap-3">
                                <CheckCircle size={16} /> Copy Magic Link
                            </Button>
                        </Card>
                    </div>
                </div >

                {/* Sticky Mobile Order Bar */}
                {
                    getTotalTickets() > 0 && !isSuccess && (
                        <div className="fixed bottom-0 left-0 w-full p-4 z-[100] animate-in slide-in-from-bottom-20 duration-500 pb-24 md:pb-4">
                            <div className="max-w-4xl mx-auto">
                                <Card className="p-4 bg-black/90 backdrop-blur-3xl text-white border-white/20 shadow-2xl rounded-[2.5rem] flex flex-row justify-between items-center gap-2 border-2">
                                    <div className="pl-4 shrink-0">
                                        <div className="text-[10px] font-black uppercase tracking-[2px] text-zinc-500 mb-1">Total</div>
                                        <div className="text-2xl md:text-3xl font-black flex items-center gap-2 tracking-tighter">
                                            ${calculateTotal().toFixed(2)}
                                            <Badge className="bg-primary text-black font-black border-none text-[10px] py-0 px-1.5 h-5">{getTotalTickets()}</Badge>
                                        </div>
                                    </div>
                                    <Button variant="secondary" onClick={handleRegister} isLoading={isRegistering} className="h-14 md:h-16 px-6 md:px-10 rounded-2xl font-black uppercase tracking-tighter text-sm md:text-xl shadow-2xl flex items-center gap-2 md:gap-3 active:scale-95 transition-all text-ellipsis whitespace-nowrap overflow-hidden">
                                        Checkout <ArrowRight size={18} className="md:w-6 md:h-6" />
                                    </Button>
                                </Card>
                            </div>
                        </div>
                    )
                }
            </div >

            {/* Simulated Payment Overlay */}
            {
                isProcessingPayment && (
                    <div className="fixed inset-0 z-[100] bg-black/80 backdrop-blur-2xl flex items-center justify-center p-6 animate-in fade-in duration-500">
                        <div className="max-w-md w-full bg-zinc-900 border border-white/10 rounded-[3rem] p-12 text-center shadow-[0_0_100px_rgba(224,255,32,0.15)] relative overflow-hidden">
                            {/* Animated gradient ring */}
                            <div className="absolute inset-0 bg-gradient-to-br from-secondary/5 to-transparent"></div>

                            <div className="relative">
                                <div className="w-24 h-24 border-4 border-green-500/20 border-t-green-500 rounded-full animate-spin mx-auto mb-8 shadow-[0_0_30px_rgba(34,197,94,0.2)]"></div>
                                <div className="absolute inset-0 flex items-center justify-center mb-8">
                                    <CheckCircle size={32} className="text-green-500 animate-pulse" />
                                </div>

                                <h2 className="text-3xl font-black text-white uppercase tracking-tighter mb-4">
                                    Payment Successful!
                                </h2>
                                <p className="text-zinc-400 font-bold mb-8">
                                    Preparing your tickets and confirmation...
                                </p>

                                <div className="flex items-center justify-center gap-6 px-4 py-3 bg-green-500/10 rounded-2xl border border-green-500/20">
                                    <span className="text-xs font-black uppercase tracking-widest text-green-500">Payment Confirmed</span>
                                    <div className="h-1 w-1 bg-green-500 rounded-full"></div>
                                    <span className="text-xs font-black uppercase tracking-widest text-zinc-500">Generating Tickets...</span>
                                </div>
                            </div>
                        </div>
                    </div>
                )
            }

            {/* Stripe Redirect Overlay - Friendly Message */}
            {
                isRedirectingToStripe && (
                    <div className="fixed inset-0 z-[100] bg-black/90 backdrop-blur-2xl flex items-center justify-center p-6 animate-in fade-in duration-300">
                        <div className="max-w-md w-full bg-gradient-to-br from-purple-900 to-pink-900 border border-white/20 rounded-[3rem] p-12 text-center shadow-[0_0_100px_rgba(168,85,247,0.3)] relative overflow-hidden">
                            {/* Animated background elements */}
                            <div className="absolute inset-0 overflow-hidden">
                                <div className="absolute -top-20 -right-20 w-40 h-40 bg-purple-500/20 rounded-full blur-3xl animate-pulse"></div>
                                <div className="absolute -bottom-20 -left-20 w-40 h-40 bg-pink-500/20 rounded-full blur-3xl animate-pulse delay-300"></div>
                            </div>

                            <div className="relative">
                                {/* Lock icon with animation */}
                                <div className="w-20 h-20 bg-white/10 rounded-3xl mx-auto mb-6 flex items-center justify-center animate-bounce">
                                    <Lock size={40} className="text-white" />
                                </div>

                                <h2 className="text-2xl font-black text-white uppercase tracking-tighter mb-3">
                                    Hang Tight! 🚀
                                </h2>
                                <p className="text-lg text-purple-200 font-bold mb-2">
                                    Sending you to our secure payment partner
                                </p>
                                <p className="text-sm text-purple-300/70 mb-8">
                                    Don't close this window — we'll have you back in a flash!
                                </p>

                                {/* Loading indicator */}
                                <div className="flex items-center justify-center gap-3">
                                    <div className="w-3 h-3 bg-white rounded-full animate-bounce" style={{animationDelay: '0ms'}}></div>
                                    <div className="w-3 h-3 bg-white rounded-full animate-bounce" style={{animationDelay: '150ms'}}></div>
                                    <div className="w-3 h-3 bg-white rounded-full animate-bounce" style={{animationDelay: '300ms'}}></div>
                                </div>

                                {/* Trust badge */}
                                <div className="mt-8 flex items-center justify-center gap-2 text-xs text-purple-300/60">
                                    <svg className="w-4 h-4" viewBox="0 0 24 24" fill="currentColor">
                                        <path d="M12 1L3 5v6c0 5.55 3.84 10.74 9 12 5.16-1.26 9-6.45 9-12V5l-9-4zm0 10.99h7c-.53 4.12-3.28 7.79-7 8.94V12H5V6.3l7-3.11v8.8z"/>
                                    </svg>
                                    <span>Powered by Stripe • 256-bit encryption</span>
                                </div>
                            </div>
                        </div>
                    </div>
                )
            }
        </>
    );
};
