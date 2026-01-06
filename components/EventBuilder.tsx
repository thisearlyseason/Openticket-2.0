
import React, { useState, useEffect } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { useGlobalUI } from './GlobalUIProvider';
import { Info, Image as ImageIcon, MapPin, Calendar, Clock, DollarSign, Plus, Trash2, Save, ArrowLeft, Loader2, Sparkles, Check, ChevronRight, Settings, Ticket, Target, Users, CreditCard, Shield, Globe, Gift, HelpCircle, FileText, Megaphone, CheckCircle2, QrCode, Tag, Percent, LinkIcon as LinkIcon, Copy, Mail, AlertCircle, X, Heart } from 'lucide-react';
import { Button, Input, RichTextarea, Select, Card, FileDropZone, DatePicker, TimePicker, Switch, Tooltip, formatTime, ErrorModal } from './UI';
import { StorageService, PLANS } from '../services/storageService';
import { GeminiService } from '../services/geminiService';
import { Event, User, TicketTier, AddOn, AffiliateLink, GalleryItem, PromoCode, PaymentConfig, Question } from '../types';

const STEPS = [
    { id: 1, label: 'Details', icon: Calendar },
    { id: 2, label: 'Content', icon: ImageIcon },
    { id: 3, label: 'Tickets', icon: Ticket },
    { id: 4, label: 'Payment', icon: CreditCard },
    { id: 5, label: 'Policies', icon: Shield },
    { id: 6, label: 'Marketing', icon: Megaphone },
    { id: 7, label: 'Publish', icon: CheckCircle2 },
];

const CATEGORIES = [
    { value: '', label: 'Select a Category' },
    { value: 'music', label: 'Music & Concerts' },
    { value: 'nightlife', label: 'Nightlife & Parties' },
    { value: 'arts', label: 'Performing Arts & Theatre' },
    { value: 'food', label: 'Food & Drink' },
    { value: 'business', label: 'Business & Networking' },
    { value: 'classes', label: 'Classes & Workshops' },
    { value: 'sports', label: 'Sports & Wellness' },
    { value: 'community', label: 'Community & Culture' },
];

// Currency symbols for display
const CURRENCY_SYMBOLS: Record<string, string> = {
    USD: '$',
    EUR: '€',
    GBP: '£',
    CAD: 'C$',
    AUD: 'A$',
};

const getCurrencySymbol = (currency: string = 'USD'): string => {
    return CURRENCY_SYMBOLS[currency] || '$';
};

export const EventBuilder = () => {
    const navigate = useNavigate();
    const { id } = useParams<{ id: string }>();

    const [isLoading, setIsLoading] = useState(true);
    const [isSaving, setIsSaving] = useState(false);
    const [currentUser, setCurrentUser] = useState<User | null>(null);
    const [currentStep, setCurrentStep] = useState(1);
    const [validationError, setValidationError] = useState('');

    const [errorModal, setErrorModal] = useState<{ open: boolean, title?: string, message: string }>({ open: false, message: '' });
    const { showToast, showConfirm, showAlert } = useGlobalUI();

    // Expanded Ticket State
    const [expandedTierIndex, setExpandedTierIndex] = useState<number | null>(null);

    // New Affiliate State
    const [newAffiliate, setNewAffiliate] = useState({ name: '', code: '' });

    // New Promo Code State
    const [newPromo, setNewPromo] = useState<PromoCode>({ code: '', type: 'percent', value: 0, usageCount: 0, maxUsage: undefined, minOrderQty: 0, expiryDate: undefined, applicableTiers: [] });

    // New Add-On State
    const [newAddOn, setNewAddOn] = useState<Partial<AddOn>>({ name: '', price: 0, allowMultiple: true, options: [] });
    // New Question State
    const [newQuestion, setNewQuestion] = useState<Partial<Question>>({ label: '', type: 'text', required: false, options: [] });

    // Tag Input State
    const [tagInput, setTagInput] = useState('');

    const [formData, setFormData] = useState<Partial<Event>>({
        title: '', subtitle: '', description: '', timeline: '', venueName: '', location: '',
        eventType: 'in_person', onlineUrl: '', category: '',
        isRecurring: false, date: '', endDate: '', time: '', endTime: '', duration: 1,
        recurringDates: [], timeFormat: '12h', tags: [],
        organizer: '', organizerEmail: '', organizerPhone: '', organizerWebsite: '',
        useOrganizerProfile: true, // Default to organizer profile
        priceType: 'free', price: 0, currency: 'USD', ticketName: '', ticketTiers: [], promoCodes: [],
        addOns: [], affiliates: [],
        absorbFees: false, taxRate: 0, capacity: 100,
        questions: [], gallery: [], reminders: [], imageUrl: '', coverImagePosition: 50,
        paymentConfig: { method: 'none' },
        confirmationMessage: '', requiresApproval: false,
        specificWaiverText: '', specificWaiverPdfUrl: '', schedulePdfUrl: '', refundPolicy: '',
        enablePayAtDoor: false,
        paymentTimeLimit: 24, // Default 24 hours
        customFees: [],
        visibility: 'public',
        rsvpMode: false,
        remarketing: false,
        isDraft: false,
        notifications: { reminder: true, newOrder: true },
        trackingPixels: { ga: '', fb: '', tiktok: '', adwords: '' },
        waitlistConfig: { enabled: false, startDate: '', endDate: '' },
        collectGuestInfo: true
    });

    useEffect(() => {
        const init = async () => {
            setIsLoading(true);
            const user = StorageService.getCurrentUser();
            if (!user) { navigate('/auth'); return; }
            // Refresh user to get latest balance/plan
            const updatedUser = await StorageService.getUserById(user.id);
            setCurrentUser(updatedUser || user);

            if (id) {
                const event = await StorageService.getEventFull(id);
                if (event) {
                    if (event.ownerId !== user.id && !user.isAdmin) {
                        setErrorModal({ open: true, message: "Unauthorized access to this event." });
                        navigate('/dashboard');
                        return;
                    }
                    setFormData(event);
                }
            } else {
                // New event - inherit defaults from user settings
                // Use businessName if useBusinessName is enabled, otherwise use personal name
                const useBusinessProfile = updatedUser?.useBusinessName || user.useBusinessName || false;
                const displayName = useBusinessProfile 
                    ? (updatedUser?.businessName || user.businessName || updatedUser?.name || user.name)
                    : (updatedUser?.name || user.name);
                
                setFormData(prev => ({
                    ...prev,
                    // Organizer name based on useBusinessName setting in profile
                    organizer: displayName,
                    organizerEmail: updatedUser?.email || user.email,
                    paymentConfig: { method: (updatedUser?.defaultPaymentMethod as any) || user.defaultPaymentMethod || 'none', link: updatedUser?.defaultPaymentLink || user.defaultPaymentLink, instructions: updatedUser?.defaultPaymentInstructions || user.defaultPaymentInstructions },
                    confirmationMessage: updatedUser?.defaultConfirmationTemplate || user.defaultConfirmationTemplate,
                    refundPolicy: updatedUser?.defaultRefundPolicy || user.defaultRefundPolicy,
                    waiverConfig: updatedUser?.defaultWaiver ? {
                        enabled: !!updatedUser.defaultWaiver.text || !!updatedUser.defaultWaiver.pdfUrl,
                        text: updatedUser.defaultWaiver.text || '',
                        pdfUrl: updatedUser.defaultWaiver.pdfUrl || '',
                        fileName: updatedUser.defaultWaiver.fileName || ''
                    } : undefined,
                    taxRate: updatedUser?.defaultTaxRate || user.defaultTaxRate || 0,
                    customFees: updatedUser?.defaultCustomFees || user.defaultCustomFees || [],
                    // Currency defaults to organizer's default currency
                    currency: updatedUser?.defaultCurrency || user.defaultCurrency || 'USD',
                    trackingPixels: { ga: '', fb: '', tiktok: '', adwords: '' }
                }));
            }
            setIsLoading(false);
        };
        init();
    }, [id, navigate]);

    // --- Capacity Enforcement Helper ---
    const enforceCapacityLimit = (newVal: number, recurringIndex: number = -1): number => {
        const userPlan = (currentUser?.subscription?.plan as any) || 'free';
        const planConfig = PLANS[userPlan as keyof typeof PLANS] || PLANS.free;
        const limit = planConfig.ticketLimit;

        // Premium has practically unlimited
        if (userPlan === 'premium') return newVal;

        if (recurringIndex === -1) {
            // Single Event Total Capacity
            if (newVal > limit) {
                showAlert({
                    title: "Capacity Limit Reached",
                    message: `Your ${planConfig.name} plan allows a maximum of ${limit} tickets per event.\n\nPlease upgrade your plan to increase this limit.`
                });
                return limit;
            }
        } else {
            // Recurring: Check Sum of all dates
            const dates = formData.recurringDates || [];
            const otherDatesTotal = dates.reduce((sum, d, idx) => {
                return idx === recurringIndex ? sum : sum + (d.capacity || 0);
            }, 0);

            if ((otherDatesTotal + newVal) > limit) {
                const available = Math.max(0, limit - otherDatesTotal);
                showAlert({
                    title: "Capacity Limit Reached",
                    message: `Your ${planConfig.name} plan allows ${limit} total tickets across all dates.\n\nYou have ${otherDatesTotal} assigned to other dates. You can add up to ${available} for this date.`
                });
                return available;
            }
        }
        return newVal;
    };

    const validateStep = (step: number) => {
        if (step === 1) {
            if (!formData.title) return "Event Title is required.";
            if (formData.eventType !== 'online' && !formData.location) return "Location is required for In-Person/Hybrid events.";

            const hasValidDate = formData.isRecurring
                ? (formData.recurringDates && formData.recurringDates.length > 0)
                : (formData.date && formData.time);
            if (!hasValidDate) return "Please set a valid Date and Time.";
            if (!formData.organizer || !formData.organizerEmail) return "Organizer info is required.";
        }
        return null;
    };

    const handleNext = () => {
        const error = validateStep(currentStep);
        if (error) {
            setValidationError(error);
            showAlert({ title: "Missing Info", message: error });
            return;
        }
        setValidationError('');
        setCurrentStep(prev => Math.min(prev + 1, STEPS.length));
        window.scrollTo(0, 0);
    };

    const handleBack = () => {
        setValidationError('');
        setCurrentStep(prev => Math.max(prev - 1, 1));
        window.scrollTo(0, 0);
    };

    const handleExit = () => {
        showConfirm({
            title: "Exit Builder",
            message: "Exit without saving? Unsaved changes will be lost.",
            confirmText: "Exit",
            variant: "danger",
            onConfirm: async () => navigate('/dashboard')
        });
    };

    const handleSubmit = async (asDraft = false) => {
        // 1. Ensure User Session
        let user = currentUser;
        if (!user) {
            try {
                user = StorageService.getCurrentUser();
                // Refresh to ensure we have latest data
                if (user) {
                    const refreshed = await StorageService.getUserById(user.id);
                    if (refreshed) user = refreshed;
                }
            } catch (e) {
                console.warn("Session check failed", e);
            }

            if (!user) {
                showAlert({ title: "Session Expired", message: "Please log in again." });
                navigate('/auth');
                return;
            }
        }

        const plan = (user.subscription?.plan as any) || 'free';
        const planDetails = PLANS[plan] || PLANS.free;

        // 2. Validate current step before proceeding (sanity check)
        const stepError = validateStep(1); // Check basics
        if (stepError && !asDraft) {
            showAlert({ title: "Incomplete Event", message: `Cannot publish: ${stepError}` });
            return;
        }

        // --- Validation for Publishing ---
        if (!asDraft) {
            // Check Outstanding Balance - FORCE DRAFT if unpaid
            if (user.balanceDue > 0) {
                showAlert({ title: "Balance Due", message: "Event saved as Draft. Please pay your balance to publish." });
                asDraft = true;
            }

            // Check Ticket Limit
            const totalCapacity = formData.isRecurring
                ? formData.recurringDates?.reduce((acc, rd) => acc + (rd.capacity || 0), 0) || 0
                : formData.capacity || 0;

            if (totalCapacity > planDetails.ticketLimit && !asDraft) { // Skip checking if already forced to draft
                showAlert({
                    title: "Capacity Limit Exceeded",
                    message: `Your current ${planDetails.name} plan is limited to ${planDetails.ticketLimit} tickets per event. This event has a capacity of ${totalCapacity}. Please upgrade to increase capacity.`
                });
                return;
            }

            // Check Monthly Event Limit (Free and Pro Plans)
            if ((plan === 'free' || plan === 'pro') && !asDraft) {
                const allEvents = await StorageService.getEvents();
                const myEvents = allEvents.filter(e => e.ownerId === user!.id && !e.isDraft);
                const currentMonth = new Date().getMonth();
                const currentYear = new Date().getFullYear();

                // Only count events created THIS month
                const eventsThisMonth = myEvents.filter(e => {
                    const d = new Date(e.createdAt);
                    return d.getMonth() === currentMonth && d.getFullYear() === currentYear;
                }).length;

                // If editing an existing published event, don't count it as "new"
                const isNewPublish = !id || (id && formData.isDraft);

                if (isNewPublish && eventsThisMonth >= planDetails.eventLimit) {
                    const upgradeMsg = plan === 'free' 
                        ? 'Upgrade to Pro for 10 events/month or Premium for unlimited events.'
                        : 'Upgrade to Premium for unlimited events.';
                    showAlert({
                        title: "Monthly Limit Reached",
                        message: `You have reached the limit of ${planDetails.eventLimit} published events this month on the ${planDetails.name} plan. ${upgradeMsg}`
                    });
                    return;
                }
            }
        }

        setIsSaving(true);
        try {
            // Prepare final data object
            let finalData = { ...formData };

            // 3. Helper to process uploads with Timeout
            // 3. Helper to process uploads with Timeout
            const timeout = (ms: number, context: string) => new Promise((_, reject) => setTimeout(() => reject(new Error(`${context} timed out`)), ms));

            const processUpload = async (dataUrl: string | undefined, path: string) => {
                if (!dataUrl || !dataUrl.startsWith('data:')) return dataUrl;
                try {
                    // Race the upload against a 30-second timeout (reduced back to 30s as we have a fallback now)
                    return await Promise.race([
                        StorageService.uploadFile(dataUrl, path),
                        timeout(5000, "File upload")
                    ]) as string;
                } catch (e) {
                    console.warn(`Upload failed for ${path}, falling back to inline storage`, e);
                    // Fallback: return the original base64 string to save directly in the document
                    // Since images are resized to 800px, they should fit in Firestore (<1MB)
                    return dataUrl;
                }
            };

            const eventId = id || `evt-${Date.now()}`;

            // Upload Images & PDFs
            if (finalData.imageUrl?.startsWith('data:')) {
                finalData.imageUrl = await processUpload(finalData.imageUrl, `events/${eventId}/cover`);
            }

            if (finalData.waiverConfig?.pdfUrl?.startsWith('data:')) {
                const url = await processUpload(finalData.waiverConfig.pdfUrl, `events/${eventId}/waiver.pdf`);
                finalData.waiverConfig = { ...finalData.waiverConfig, pdfUrl: url };
            }

            if (finalData.scheduleConfig?.pdfUrl?.startsWith('data:')) {
                const url = await processUpload(finalData.scheduleConfig.pdfUrl, `events/${eventId}/schedule.pdf`);
                finalData.scheduleConfig = { ...finalData.scheduleConfig, pdfUrl: url };
            }

            // Legacy Fields Support
            if (finalData.specificWaiverPdfUrl?.startsWith('data:')) {
                finalData.specificWaiverPdfUrl = await processUpload(finalData.specificWaiverPdfUrl, `events/${eventId}/legacy_waiver.pdf`);
            }
            if (finalData.schedulePdfUrl?.startsWith('data:')) {
                finalData.schedulePdfUrl = await processUpload(finalData.schedulePdfUrl, `events/${eventId}/legacy_schedule.pdf`);
            }

            if (formData.isRecurring && formData.recurringDates && formData.recurringDates.length > 0) {
                const sorted = [...formData.recurringDates].sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime());
                finalData.date = sorted[0].date;
                finalData.time = sorted[0].startTime;
                finalData.recurringDates = sorted;
                // Sync UI state, though we are about to navigate/save
                setFormData(prev => ({ ...prev, date: sorted[0].date, time: sorted[0].startTime, recurringDates: sorted }));
            }

            const eventToSave: Event = {
                ...finalData as Event,
                id: eventId,
                ownerId: user.id,
                isDraft: asDraft,
                createdAt: formData.createdAt || Date.now(),
                registeredCount: formData.registeredCount || 0
            };

            // Save Key Data with Timeout
            await Promise.race([
                StorageService.saveEvent(eventToSave),
                timeout(10000, "Database save")
            ]);

            if (asDraft) {
                showToast("Event saved as Draft!", "info");
                navigate('/dashboard');
            } else {
                navigate('/dashboard', { state: { showSuccess: true } });
            }
        } catch (e: any) {
            console.error("Save failed", e);
            showAlert({ title: "Save Failed", message: `Failed to save event: ${e.message}` });
        } finally {
            setIsSaving(false);
        }
    };

    const handleAIHelp = async (field: 'description') => {
        if (field === 'description') {
            if (!formData.title) return alert("Please enter an event title first.");
            const desc = await GeminiService.generateDescription(formData.title, `${formData.date || 'TBA'} at ${formData.location || 'TBA'}`);
            setFormData(prev => ({ ...prev, description: desc }));
        }
    };

    const handleAddAffiliate = () => {
        if (!newAffiliate.name || !newAffiliate.code) return;
        const code = newAffiliate.code.toUpperCase().replace(/[^A-Z0-9]/g, '');
        const newLink: AffiliateLink = {
            id: `aff-${Date.now()}`,
            name: newAffiliate.name,
            code: code,
            clicks: 0,
            conversions: 0
        };
        setFormData(prev => ({
            ...prev,
            affiliates: [...(prev.affiliates || []), newLink]
        }));
        setNewAffiliate({ name: '', code: '' });
    };

    const handleAddPromo = () => {
        if (!newPromo.code || !newPromo.value) return;

        const code = newPromo.code.toUpperCase().replace(/[^A-Z0-9]/g, '');
        if (formData.promoCodes?.some(p => p.code === code)) {
            alert("Promo code already exists!");
            return;
        }

        const promo: PromoCode = {
            code,
            type: newPromo.type || 'percent',
            value: parseFloat(String(newPromo.value)),
            usageCount: 0,
            maxUsage: newPromo.maxUsage ? parseInt(String(newPromo.maxUsage)) : undefined
        };

        setFormData(prev => ({
            ...prev,
            promoCodes: [...(prev.promoCodes || []), promo]
        }));
        setNewPromo({ code: '', type: 'percent', value: 0, usageCount: 0, maxUsage: undefined });
    };

    const copyAffiliateLink = (code: string) => {
        const baseUrl = window.location.href.split('#')[0];
        const link = `${baseUrl}#/event/${id || formData.id}?ref=${code}`;
        navigator.clipboard.writeText(link);
        alert("Affiliate link copied to clipboard!");
    };

    const handleAddTag = (e: React.KeyboardEvent<HTMLInputElement>) => {
        if (e.key === 'Enter' || e.key === ',') {
            e.preventDefault();
            const tag = tagInput.trim().replace(/^#/, '').replace(',', '');
            if (tag) {
                const currentTags = formData.tags || [];
                if (!currentTags.includes(tag)) {
                    setFormData(prev => ({ ...prev, tags: [...currentTags, tag] }));
                }
                setTagInput('');
            }
        }
    };

    const removeTag = (tagToRemove: string) => {
        setFormData(prev => ({ ...prev, tags: prev.tags?.filter(tag => tag !== tagToRemove) }));
    };

    const renderFeeBreakdown = (mode: 'online' | 'offline') => {
        if (formData.priceType === 'free' || formData.priceType === 'donation') return null;

        let price = formData.price || 0;
        let priceLabel = "Ticket Price";

        if (formData.priceType === 'tiered') {
            if (formData.ticketTiers && formData.ticketTiers.length > 0) {
                const exampleTier = formData.ticketTiers[0];
                price = exampleTier.price;
                priceLabel = `Ticket Price (${exampleTier.name})`;
            } else {
                return <div className="mt-4 p-4 text-sm text-zinc-500 italic">Add ticket tiers in the Tickets step to see fee breakdown.</div>;
            }
        }

        // Calculate Tax & Custom Fees
        const taxAmount = price * ((formData.taxRate || 0) / 100);
        let customFeesTotal = 0;
        if (formData.customFees) {
            customFeesTotal = formData.customFees.reduce((acc, fee) => {
                if (fee.type === 'percent') return acc + (price * (fee.amount / 100));
                return acc + fee.amount;
            }, 0);
        }

        const subtotal = price + taxAmount + customFeesTotal;

        const plan = currentUser?.subscription?.plan || 'free';
        const platformFee = StorageService.calculateFees(price, plan);
        let stripeFee = 0;

        if (mode === 'online') {
            // Stripe Fee: 2.9% + $0.30 on the amount processed
            // If absorbing fees, we process 'subtotal'. If passing on, we process 'subtotal + platformFee + stripeFee' (recursive, approximated here)
            // standard approx:
            stripeFee = (subtotal * 0.029) + 0.30;
        }

        const totalFee = platformFee + stripeFee;

        const attendeePays = formData.absorbFees ? subtotal : subtotal + totalFee;
        const youReceive = formData.absorbFees ? subtotal - totalFee : subtotal;

        if (mode === 'offline') {
            return (
                <div className="mt-4 p-4 bg-zinc-100 dark:bg-zinc-900 rounded-xl border border-zinc-200 dark:border-zinc-800 text-sm animate-in fade-in">
                    <h4 className="font-bold mb-2 uppercase text-xs text-zinc-500">Offline Payment Cost Analysis (Per Ticket)</h4>
                    <div className="space-y-1 mb-2">
                        <div className="flex justify-between">
                            <span>{priceLabel}:</span>
                            <span className="font-mono font-bold">${price.toFixed(2)}</span>
                        </div>
                        {taxAmount > 0 && (
                            <div className="flex justify-between text-zinc-500">
                                <span>Tax ({formData.taxRate}%):</span>
                                <span className="font-mono">${taxAmount.toFixed(2)}</span>
                            </div>
                        )}
                        {customFeesTotal > 0 && (
                            <div className="flex justify-between text-zinc-500">
                                <span>Custom Fees:</span>
                                <span className="font-mono">${customFeesTotal.toFixed(2)}</span>
                            </div>
                        )}
                    </div>

                    <div className="flex justify-between mb-1 text-red-500 pt-2 border-t border-zinc-200 dark:border-zinc-700">
                        <span>Platform Fees (You Owe Later):</span>
                        <span className="font-mono">-${platformFee.toFixed(2)}</span>
                    </div>
                    <div className="border-t border-zinc-300 dark:border-zinc-700 my-2 pt-2">
                        <div className="flex justify-between font-bold text-green-600 dark:text-green-400">
                            <span>Net Revenue:</span>
                            <span>${Math.max(0, subtotal - platformFee).toFixed(2)}</span>
                        </div>
                    </div>
                    <div className="text-[10px] text-zinc-400 mt-2 italic">
                        * Fees will be added to your account balance and billed monthly.
                    </div>
                </div>
            );
        }

        return (
            <div className="mt-4 p-4 bg-zinc-100 dark:bg-zinc-900 rounded-xl border border-zinc-200 dark:border-zinc-800 text-sm animate-in fade-in">
                <h4 className="font-bold mb-2 uppercase text-xs text-zinc-500">Online Fee Breakdown (Per Ticket)</h4>

                {/* Fee Absorption Toggle */}
                <div className="flex items-center justify-between mb-4 p-3 bg-white dark:bg-black rounded-lg border border-zinc-200 dark:border-zinc-700">
                    <div className="flex items-center gap-2">
                        <Settings size={16} className="text-zinc-400" />
                        <span className="font-bold text-zinc-700 dark:text-zinc-300">Absorb Fees?</span>
                    </div>
                    <div className="flex items-center gap-2">
                        <span className={`text-xs ${formData.absorbFees ? 'text-zinc-400' : 'font-bold text-primary'}`}>Attendee Pays</span>
                        <Switch checked={formData.absorbFees || false} onChange={c => setFormData({ ...formData, absorbFees: c })} />
                        <span className={`text-xs ${formData.absorbFees ? 'font-bold text-primary' : 'text-zinc-400'}`}>I Pay</span>
                    </div>
                </div>

                {/* Platform Donation Toggle - Only for Pro/Premium */}
                {(plan === 'pro' || plan === 'premium') && (
                    <div className="flex items-center justify-between mb-4 p-3 bg-white dark:bg-black rounded-lg border border-zinc-200 dark:border-zinc-700">
                        <div className="flex-1 pr-4">
                            <div className="flex items-center gap-2">
                                <Heart size={16} className="text-pink-500" />
                                <span className="font-bold text-zinc-700 dark:text-zinc-300">Platform Donation</span>
                            </div>
                            <p className="text-xs text-zinc-500 mt-1">
                                Allow attendees to optionally donate to support OpenTicket
                            </p>
                        </div>
                        <div className="flex items-center gap-2">
                            <span className={`text-xs ${formData.hidePlatformDonation ? 'font-bold text-zinc-500' : 'text-zinc-400'}`}>Hide</span>
                            <Switch checked={!formData.hidePlatformDonation} onChange={c => setFormData({ ...formData, hidePlatformDonation: !c })} />
                            <span className={`text-xs ${!formData.hidePlatformDonation ? 'font-bold text-pink-500' : 'text-zinc-400'}`}>Show</span>
                        </div>
                    </div>
                )}

                <div className="space-y-1 mb-2">
                    <div className="flex justify-between">
                        <span>{priceLabel}:</span>
                        <span className="font-mono">${price.toFixed(2)}</span>
                    </div>
                    {taxAmount > 0 && (
                        <div className="flex justify-between text-zinc-500">
                            <span>Tax ({formData.taxRate}%):</span>
                            <span className="font-mono">${taxAmount.toFixed(2)}</span>
                        </div>
                    )}
                    {customFeesTotal > 0 && (
                        <div className="flex justify-between text-zinc-500">
                            <span>Custom Fees:</span>
                            <span className="font-mono">${customFeesTotal.toFixed(2)}</span>
                        </div>
                    )}
                </div>

                <div className="pt-2 border-t border-zinc-200 dark:border-zinc-700 space-y-1 mb-2">
                    <div className="flex justify-between text-zinc-500">
                        <span>Platform Fee ({PLANS[plan].name}):</span>
                        <span className="font-mono">${platformFee.toFixed(2)}</span>
                    </div>
                    <div className="flex justify-between text-zinc-500">
                        <span>Stripe Processing Fee (2.9% + 30¢):</span>
                        <span className="font-mono">${stripeFee.toFixed(2)}</span>
                    </div>
                </div>

                <div className="border-t border-zinc-300 dark:border-zinc-700 my-2 pt-2">
                    <div className="flex justify-between font-bold">
                        <span>Attendee Pays:</span>
                        <span className="text-primary">${attendeePays.toFixed(2)}</span>
                    </div>
                    <div className="flex justify-between font-bold text-green-600 dark:text-green-400">
                        <span>You Receive:</span>
                        <span>${Math.max(0, youReceive).toFixed(2)}</span>
                    </div>
                </div>
            </div>
        );
    };

    if (isLoading || !currentUser) return <div className="min-h-screen flex items-center justify-center"><Loader2 className="animate-spin text-primary" size={48} /></div>;

    return (
        <div className="max-w-5xl mx-auto pb-24 px-4">
            {/* Progress Stepper & Exit */}
            <div className="flex justify-between items-center mb-8 border-b border-zinc-200 dark:border-zinc-800 pb-2 overflow-x-auto">
                <div className="flex gap-4">
                    {STEPS.map((step, idx) => (
                        <div key={step.id}
                            onClick={() => setCurrentStep(step.id)}
                            className={`flex items-center gap-2 cursor-pointer transition-colors px-2 py-2 rounded-lg whitespace-nowrap ${currentStep === step.id ? 'text-black dark:text-white font-bold bg-zinc-100 dark:bg-zinc-800' : 'text-zinc-400 hover:text-zinc-600'}`}>
                            <div className={`w-6 h-6 rounded-full flex items-center justify-center text-[10px] font-bold ${currentStep === step.id ? 'bg-primary text-white' : currentStep > step.id ? 'bg-green-500 text-white' : 'bg-zinc-200 dark:bg-zinc-800'}`}>
                                {currentStep > step.id ? <Check size={12} /> : step.id}
                            </div>
                            <span className="hidden md:inline text-xs">{step.label}</span>
                        </div>
                    ))}
                </div>
                <Button size="sm" variant="ghost" onClick={handleExit} className="text-red-500 hover:text-red-600 hover:bg-red-50 ml-4 shrink-0">
                    <X size={16} className="mr-1" /> Exit
                </Button>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
                <div className="lg:col-span-2 space-y-8">

                    {/* STEP 1: BASIC DETAILS */}
                    {currentStep === 1 && (
                        <div className="animate-in fade-in slide-in-from-bottom-4 space-y-6">
                            <Card className="p-6">
                                <h2 className="text-xl font-bold mb-6 flex items-center gap-2"><Calendar className="text-primary" /> Event Basics</h2>
                                <Input label="Event Title" value={formData.title} onChange={e => setFormData({ ...formData, title: e.target.value })} placeholder="e.g. Summer Music Festival" required />
                                <Input label="Subtitle (Optional)" value={formData.subtitle} onChange={e => setFormData({ ...formData, subtitle: e.target.value })} placeholder="Short catchy slogan" />

                                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                    <Select
                                        label="Category"
                                        value={formData.category}
                                        onChange={e => setFormData({ ...formData, category: e.target.value })}
                                        options={CATEGORIES}
                                    />
                                    <Select
                                        label="Event Type"
                                        value={formData.eventType}
                                        onChange={e => setFormData({ ...formData, eventType: e.target.value as any })}
                                        options={[
                                            { value: 'in_person', label: 'In Person' },
                                            { value: 'online', label: 'Online / Virtual' },
                                            { value: 'hybrid', label: 'Hybrid' }
                                        ]}
                                    />
                                </div>

                                {formData.eventType !== 'online' && (
                                    <div className="space-y-4 mt-4">
                                        <Input label="Venue Name" value={formData.venueName} onChange={e => setFormData({ ...formData, venueName: e.target.value })} placeholder="e.g. The Grand Hall" />
                                        <div className="relative">
                                            <Input
                                                label="Address / Location"
                                                value={formData.location}
                                                onChange={e => setFormData({ ...formData, location: e.target.value })}
                                                placeholder="123 Main St, City, Country"
                                                icon={MapPin}
                                                required
                                            />
                                        </div>
                                    </div>
                                )}
                            </Card>
                            {/* ... Date & Time Card ... */}
                            <Card className="p-6">
                                <div className="flex justify-between items-center mb-6">
                                    <h2 className="text-xl font-bold flex items-center gap-4"><Clock className="text-[#00ff9d]" size={20} /> Date & Time</h2>

                                    <div className="flex items-center gap-3 bg-zinc-100 dark:bg-zinc-900 rounded-full px-3 py-1 border border-zinc-200 dark:border-zinc-800">
                                        <span className={`text-xs font-bold ${!formData.isRecurring ? 'text-primary' : 'text-zinc-500'}`}>Single Date</span>
                                        <Switch checked={formData.isRecurring || false} onChange={c => setFormData({ ...formData, isRecurring: c })} />
                                        <span className={`text-xs font-bold ${formData.isRecurring ? 'text-secondary' : 'text-zinc-500'}`}>Recurring Dates</span>
                                    </div>
                                </div>

                                {!formData.isRecurring ? (
                                    <div className="grid grid-cols-2 gap-4">
                                        <DatePicker label="Date" value={formData.date} onChange={e => setFormData({ ...formData, date: e.target.value })} required containerClassName="mb-0" />
                                        <TimePicker label="Time" value={formData.time} onChange={e => setFormData({ ...formData, time: e.target.value })} required containerClassName="mb-0" />
                                        <DatePicker label="End Date (Opt)" value={formData.endDate} onChange={e => setFormData({ ...formData, endDate: e.target.value })} containerClassName="mb-0" />
                                        <TimePicker label="End Time (Opt)" value={formData.endTime} onChange={e => setFormData({ ...formData, endTime: e.target.value })} containerClassName="mb-0" />
                                    </div>
                                ) : (
                                    <div className="space-y-4">
                                        <p className="text-sm text-zinc-500 bg-zinc-100 dark:bg-zinc-900 p-3 rounded-xl border border-zinc-200 dark:border-zinc-800">Add multiple dates/times for repeating events (e.g. tour dates, workshops).</p>
                                        {formData.recurringDates?.map((rd, idx) => (
                                            <div key={rd.id} className="flex gap-2 items-end bg-zinc-50 dark:bg-zinc-900/50 p-2 rounded-xl">
                                                <DatePicker value={rd.date} onChange={(e: any) => { const n = [...(formData.recurringDates || [])]; n[idx].date = e.target.value; setFormData({ ...formData, recurringDates: n }) }} containerClassName="mb-0 flex-1" />
                                                <TimePicker value={rd.startTime} onChange={(e: any) => { const n = [...(formData.recurringDates || [])]; n[idx].startTime = e.target.value; setFormData({ ...formData, recurringDates: n }) }} containerClassName="mb-0 w-32" />
                                                <Input
                                                    type="number"
                                                    placeholder="Cap"
                                                    value={rd.capacity}
                                                    onChange={e => {
                                                        const val = parseInt(e.target.value);
                                                        const finalVal = enforceCapacityLimit(val, idx);
                                                        const n = [...(formData.recurringDates || [])];
                                                        n[idx].capacity = finalVal;
                                                        setFormData({ ...formData, recurringDates: n });
                                                    }}
                                                    containerClassName="mb-0 w-20"
                                                />
                                                <Button variant="danger" size="sm" onClick={() => setFormData({ ...formData, recurringDates: formData.recurringDates?.filter((_, i) => i !== idx) })} className="h-10 w-10 p-0 flex items-center justify-center"><Trash2 size={16} /></Button>
                                            </div>
                                        ))}
                                        <Button size="sm" variant="outline" onClick={() => setFormData({ ...formData, recurringDates: [...(formData.recurringDates || []), { id: `rd-${Date.now()}`, date: '', startTime: '', capacity: 50 }] })} className="w-full border-dashed"><Plus size={16} className="mr-2" /> Add Date</Button>
                                    </div>
                                )}
                            </Card>
                            {/* ... Organizer Card ... */}
                            <Card className="p-6">
                                <h2 className="text-xl font-bold mb-6 flex items-center gap-2"><Target className="text-primary" /> Organizer Profile</h2>
                                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                    <Input label="Organizer Name" value={formData.organizer} onChange={e => setFormData({ ...formData, organizer: e.target.value })} required />
                                    <Input label="Contact Email" type="email" value={formData.organizerEmail} onChange={e => setFormData({ ...formData, organizerEmail: e.target.value })} required />
                                </div>
                                <div className="mt-4">
                                    <Input label="Organizer Website" value={formData.organizerWebsite || ''} onChange={e => setFormData({ ...formData, organizerWebsite: e.target.value })} placeholder="https://..." icon={Globe} />
                                </div>
                                <p className="text-xs text-zinc-500 mt-4">
                                    💡 This information will be shown to attendees. To change your default name preference, go to <span className="text-primary font-medium">Settings → Organizer Profile</span>.
                                </p>
                            </Card>
                        </div>
                    )}

                    {/* STEP 2: Content */}
                    {currentStep === 2 && (
                        <div className="animate-in fade-in space-y-6">
                            <Card className="p-6">
                                <h2 className="text-xl font-bold mb-6 flex items-center gap-2"><ImageIcon className="text-primary" /> Event Media</h2>
                                <FileDropZone
                                    label="Cover Image"
                                    currentImage={formData.imageUrl}
                                    onFileSelect={(b64) => setFormData({ ...formData, imageUrl: b64 as string })}
                                    onClear={() => setFormData({ ...formData, imageUrl: '' })}
                                />
                                <div className="flex justify-end mt-2">
                                    <Button size="sm" variant="ghost" className="text-purple-600 hover:bg-purple-50" onClick={async () => {
                                        if (!formData.title) return alert("Please enter an event title first.");
                                        const img = await GeminiService.generateEventImage(formData.title, formData.description || formData.title);
                                        if (img) setFormData({ ...formData, imageUrl: img });
                                    }}>
                                        <Sparkles size={14} className="mr-1" /> Generate Image with AI
                                    </Button>
                                </div>
                                {/* Gallery, Description etc. */}
                                <div className="mt-6">
                                    <div className="flex justify-between items-center mb-1">
                                        <label className="text-sm font-bold text-zinc-500 uppercase">Description</label>
                                        <Button size="sm" variant="ghost" className="h-6 text-xs text-purple-600 hover:bg-purple-50" onClick={() => handleAIHelp('description')}>
                                            <Sparkles size={12} className="mr-1" /> Magic Write
                                        </Button>
                                    </div>
                                    <RichTextarea
                                        label=""
                                        value={formData.description}
                                        onChange={(e: any) => setFormData({ ...formData, description: e.target.value })}
                                        placeholder="Describe your event..."
                                        className="min-h-[300px]"
                                    />
                                </div>
                            </Card>
                        </div>
                    )}

                    {/* STEP 3: Tickets */}
                    {currentStep === 3 && (
                        <div className="animate-in fade-in space-y-6">
                            <Card className="p-6">
                                <h2 className="text-xl font-bold mb-6 flex items-center gap-2"><Ticket className="text-primary" /> Tickets</h2>
                                
                                {/* Currency Selection Banner */}
                                <div className="bg-gradient-to-r from-blue-50 to-indigo-50 dark:from-blue-900/20 dark:to-indigo-900/20 p-4 rounded-xl mb-6 border border-blue-200 dark:border-blue-800/50">
                                    <div className="flex flex-col sm:flex-row gap-4 items-start sm:items-center justify-between">
                                        <div className="flex items-center gap-3">
                                            <div className="w-10 h-10 rounded-lg bg-blue-100 dark:bg-blue-900/50 flex items-center justify-center">
                                                <Globe size={20} className="text-blue-600 dark:text-blue-400" />
                                            </div>
                                            <div>
                                                <span className="text-sm font-bold text-blue-900 dark:text-blue-100 block">Event Currency</span>
                                                <span className="text-xs text-blue-600 dark:text-blue-300">All ticket and add-on prices will be in this currency</span>
                                            </div>
                                        </div>
                                        <div className="flex items-center gap-2">
                                            <select
                                                value={formData.currency || 'USD'}
                                                onChange={(e) => {
                                                    const newCurrency = e.target.value;
                                                    const oldCurrency = formData.currency || 'USD';
                                                    // Warn if prices already set
                                                    if (oldCurrency !== newCurrency && (formData.price > 0 || (formData.ticketTiers?.some(t => t.price > 0)))) {
                                                        if (!confirm(`⚠️ Currency Change Warning\n\nYou're changing from ${oldCurrency} to ${newCurrency}.\n\nExisting prices will NOT be auto-converted. You'll need to update your prices manually.\n\nContinue?`)) {
                                                            return;
                                                        }
                                                    }
                                                    setFormData({ ...formData, currency: newCurrency });
                                                }}
                                                className="px-4 py-2 rounded-lg border border-blue-300 dark:border-blue-700 bg-white dark:bg-zinc-800 text-blue-900 dark:text-blue-100 font-bold text-sm focus:ring-2 focus:ring-blue-500 focus:outline-none"
                                            >
                                                <option value="USD">$ USD - US Dollar</option>
                                                <option value="EUR">€ EUR - Euro</option>
                                                <option value="GBP">£ GBP - British Pound</option>
                                                <option value="CAD">C$ CAD - Canadian Dollar</option>
                                                <option value="AUD">A$ AUD - Australian Dollar</option>
                                            </select>
                                        </div>
                                    </div>
                                </div>

                                <div className="bg-zinc-50 dark:bg-zinc-900 p-4 rounded-xl mb-6 flex flex-col sm:flex-row gap-4 items-center justify-between border border-zinc-200 dark:border-zinc-800">
                                    <div>
                                        <span className="text-sm font-bold text-zinc-500 uppercase block mb-1">Pricing Model</span>
                                        <div className="flex gap-2">
                                            {['free', 'fixed', 'donation', 'tiered'].map(type => (
                                                <button
                                                    key={type}
                                                    onClick={() => {
                                                        const updates: any = { priceType: type };
                                                        if (type === 'free' || type === 'donation') {
                                                            updates.price = 0;
                                                            updates.customFees = [];
                                                        }
                                                        setFormData({ ...formData, ...updates });
                                                    }}
                                                    className={`px-3 py-1 rounded-lg text-sm font-bold capitalize transition-colors ${formData.priceType === type ? 'bg-zinc-900 text-white dark:bg-white dark:text-black' : 'bg-white dark:bg-black border border-zinc-200 dark:border-zinc-700 text-zinc-500'}`}
                                                >
                                                    {type}
                                                </button>
                                            ))}
                                        </div>
                                    </div>
                                </div>
                                {/* Ticket Tiers Logic (Simplified for brevity, logic exists in full version) */}
                                {formData.priceType === 'tiered' ? (
                                    <div className="space-y-4">
                                        <Button variant="outline" className="w-full border-dashed" onClick={() => setFormData({ ...formData, ticketTiers: [...(formData.ticketTiers || []), { id: `tier-${Date.now()}`, name: 'New Tier', price: 0, capacity: 100, visibility: 'public' }] })}>
                                            <Plus size={16} className="mr-2" /> Add Ticket Tier
                                        </Button>
                                        {/* Map tiers here */}
                                        {/* Map tiers here */}
                                        {formData.ticketTiers?.map((tier, idx) => (
                                            <div key={tier.id} className="p-4 border rounded-xl bg-white dark:bg-black border-zinc-200 dark:border-zinc-800 space-y-4">
                                                <div className="flex flex-col sm:flex-row gap-4">
                                                    <div className="flex-[2]">
                                                        <Input
                                                            label="Tier Name"
                                                            placeholder="e.g. General Admission, VIP"
                                                            value={tier.name}
                                                            onChange={e => { const n = [...formData.ticketTiers || []]; n[idx].name = e.target.value; setFormData({ ...formData, ticketTiers: n }) }}
                                                            containerClassName="mb-0"
                                                        />
                                                    </div>
                                                    <div className="flex-1">
                                                        <Input
                                                            label={`Price (${formData.currency || 'USD'})`}
                                                            type="number"
                                                            placeholder="0.00"
                                                            value={tier.price}
                                                            onChange={e => { const n = [...formData.ticketTiers || []]; n[idx].price = parseFloat(e.target.value); setFormData({ ...formData, ticketTiers: n }) }}
                                                            containerClassName="mb-0"
                                                        />
                                                    </div>
                                                    <div className="flex-1">
                                                        <Input
                                                            label="Quantity Available"
                                                            type="number"
                                                            placeholder="100"
                                                            value={tier.capacity}
                                                            onChange={e => { const n = [...formData.ticketTiers || []]; n[idx].capacity = parseFloat(e.target.value); setFormData({ ...formData, ticketTiers: n }) }}
                                                            containerClassName="mb-0"
                                                        />
                                                    </div>
                                                    <div className="flex items-end pb-1">
                                                        <Button variant="danger" onClick={() => setFormData({ ...formData, ticketTiers: formData.ticketTiers?.filter((_, i) => i !== idx) })} className="px-3 h-[42px]">
                                                            <Trash2 size={16} />
                                                        </Button>
                                                    </div>
                                                </div>
                                                <Input
                                                    label="Description (Optional)"
                                                    placeholder="Includes... (shown to attendees)"
                                                    value={tier.description || ''}
                                                    onChange={e => { const n = [...formData.ticketTiers || []]; n[idx].description = e.target.value; setFormData({ ...formData, ticketTiers: n }) }}
                                                    containerClassName="mb-0"
                                                />
                                            </div>
                                        ))}
                                    </div>
                                ) : (
                                    <div className="space-y-4">
                                        <div className="flex gap-4">
                                            <Input label={`Price (${formData.currency || 'USD'})`} type="number" value={formData.price || ''} onChange={e => setFormData({ ...formData, price: parseFloat(e.target.value) || 0 })} containerClassName="flex-1" />
                                            {/* Capacity for non-tiered events */}
                                            <Input label="Capacity" type="number" value={formData.capacity || ''} onChange={e => setFormData({ ...formData, capacity: parseFloat(e.target.value) || 0 })} containerClassName="flex-1" />
                                        </div>
                                    </div>
                                )}

                                {/* Global Capacity for Tiered Events (Separate input to avoid confusion) */}
                                {formData.priceType === 'tiered' && (
                                    <div className="mt-4 p-4 bg-zinc-50 dark:bg-zinc-900 rounded-xl border border-zinc-200 dark:border-zinc-800">
                                        <div className="flex items-center justify-between gap-4">
                                            <div className="flex-1">
                                                <div className="font-bold text-sm mb-1">Total Event Capacity</div>
                                                <div className="text-xs text-zinc-500">Optional: Set a maximum number of total tickets sold across ALL tiers. Leave as 0 or empty for no global limit (tiers effectively limit themselves).</div>
                                            </div>
                                            <Input
                                                type="number"
                                                value={formData.capacity || ''}
                                                onChange={e => setFormData({ ...formData, capacity: parseFloat(e.target.value) || 0 })}
                                                placeholder="Total Cap"
                                                containerClassName="mb-0 w-32"
                                            />
                                        </div>
                                    </div>
                                )}

                                {/* Products & Add-ons Section */}
                                <div className="mt-8 pt-8 border-t border-zinc-200 dark:border-zinc-800">
                                    <h2 className="text-lg font-bold mb-4 flex items-center gap-2"><Gift className="text-primary" /> Products & Add-ons</h2>
                                    <p className="text-sm text-zinc-500 mb-4">Sell merchandise, parking passes, or donations along with tickets.</p>

                                    <div className="space-y-4 mb-4">
                                        {formData.addOns?.map((addon, idx) => (
                                            <div key={addon.id} className="p-4 border rounded-xl bg-white dark:bg-black border-zinc-200 dark:border-zinc-800 flex justify-between items-center">
                                                <div>
                                                    <div className="font-bold">{addon.name}</div>
                                                    <div className="text-sm text-zinc-500">
                                                        ${addon.price} {addon.question && `• ${addon.question}`}
                                                        {addon.taxable && <span className="ml-2 text-xs bg-zinc-100 dark:bg-zinc-800 px-1.5 py-0.5 rounded text-zinc-500 font-bold border border-zinc-200 dark:border-zinc-700">+ TAX</span>}
                                                    </div>
                                                </div>
                                                <Button variant="danger" size="sm" onClick={() => setFormData({ ...formData, addOns: formData.addOns?.filter((_, i) => i !== idx) })}>
                                                    <Trash2 size={16} />
                                                </Button>
                                            </div>
                                        ))}
                                    </div>

                                    <div className="bg-zinc-50 dark:bg-zinc-900 p-4 rounded-xl border border-zinc-200 dark:border-zinc-800 space-y-4">
                                        <div className="flex gap-4">
                                            <Input
                                                label="Product Name"
                                                placeholder="e.g. T-Shirt"
                                                value={newAddOn.name}
                                                onChange={e => setNewAddOn({ ...newAddOn, name: e.target.value })}
                                                containerClassName="flex-[2] mb-0"
                                            />
                                            <Input
                                                label={`Price (${formData.currency || 'USD'})`}
                                                type="number"
                                                placeholder="25.00"
                                                value={newAddOn.price || ''}
                                                onChange={e => setNewAddOn({ ...newAddOn, price: parseFloat(e.target.value) })}
                                                containerClassName="flex-1 mb-0"
                                            />
                                        </div>

                                        <div className="flex items-center gap-4">
                                            <div className="flex items-center gap-2">
                                                <Switch
                                                    checked={!!newAddOn.question}
                                                    onChange={c => setNewAddOn({ ...newAddOn, question: c ? 'Select Option' : undefined, questionType: 'select' })}
                                                />
                                                <span className="text-sm font-bold">Has Variants</span>
                                            </div>
                                            <div className="flex items-center gap-2">
                                                <Switch
                                                    checked={newAddOn.taxable || false}
                                                    onChange={c => setNewAddOn({ ...newAddOn, taxable: c })}
                                                />
                                                <span className="text-sm font-bold">Taxable</span>
                                            </div>
                                        </div>

                                        {newAddOn.question !== undefined && (
                                            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 animate-in fade-in">
                                                <Input
                                                    label="Label"
                                                    placeholder="e.g. Size"
                                                    value={newAddOn.question}
                                                    onChange={e => setNewAddOn({ ...newAddOn, question: e.target.value })}
                                                />
                                                <Input
                                                    label="Options (comma separated)"
                                                    placeholder="Small, Medium, Large"
                                                    value={newAddOn.options?.join(', ') || ''}
                                                    onChange={e => setNewAddOn({ ...newAddOn, options: e.target.value.split(',').map(s => s.trim()) })}
                                                />
                                            </div>
                                        )}

                                        <Button
                                            variant="secondary"
                                            onClick={() => {
                                                if (!newAddOn.name || newAddOn.price === undefined) return;
                                                setFormData({ ...formData, addOns: [...(formData.addOns || []), { ...newAddOn, id: `addon-${Date.now()}`, allowMultiple: true } as AddOn] });
                                                setNewAddOn({ name: '', price: 0, allowMultiple: true, options: [] });
                                            }}
                                            className="w-full"
                                        >
                                            <Plus size={16} className="mr-2" /> Add Product
                                        </Button>
                                    </div>
                                </div>

                                {/* Ticket Designer Section */}
                                <div className="mt-8 pt-8 border-t border-zinc-200 dark:border-zinc-800">
                                    <h2 className="text-lg font-bold mb-4 flex items-center gap-2"><Sparkles className="text-purple-500" /> Ticket Appearance (Pro)</h2>
                                    <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                                        <div className="space-y-4">
                                            <div>
                                                <label className="text-xs font-bold text-zinc-500 uppercase mb-2 block">Ticket Logo</label>
                                                <div className="h-32">
                                                    <FileDropZone
                                                        label="Upload Logo"
                                                        currentImage={formData.ticketDesign?.logoUrl}
                                                        onFileSelect={(b64) => setFormData({ ...formData, ticketDesign: { ...(formData.ticketDesign || {}), logoUrl: b64 as string } })}
                                                        onClear={() => setFormData({ ...formData, ticketDesign: { ...(formData.ticketDesign || {}), logoUrl: '' } })}
                                                    />
                                                </div>
                                            </div>
                                            <div className="grid grid-cols-3 gap-2">
                                                <Input
                                                    label="Background"
                                                    type="color"
                                                    value={formData.ticketDesign?.backgroundColor || '#ffffff'}
                                                    onChange={e => setFormData({ ...formData, ticketDesign: { ...(formData.ticketDesign || {}), backgroundColor: e.target.value } })}
                                                    containerClassName="h-12 p-1 cursor-pointer overflow-hidden rounded-lg"
                                                />
                                                <Input
                                                    label="Text"
                                                    type="color"
                                                    value={formData.ticketDesign?.textColor || '#000000'}
                                                    onChange={e => setFormData({ ...formData, ticketDesign: { ...(formData.ticketDesign || {}), textColor: e.target.value } })}
                                                    containerClassName="h-12 p-1 cursor-pointer overflow-hidden rounded-lg"
                                                />
                                                <Input
                                                    label="Accent"
                                                    type="color"
                                                    value={formData.ticketDesign?.accentColor || '#E0FF20'}
                                                    onChange={e => setFormData({ ...formData, ticketDesign: { ...(formData.ticketDesign || {}), accentColor: e.target.value } })}
                                                    containerClassName="h-12 p-1 cursor-pointer overflow-hidden rounded-lg"
                                                />
                                            </div>
                                        </div>
                                        <div className="bg-zinc-100 dark:bg-zinc-900 rounded-xl p-4 flex items-center justify-center border border-zinc-200 dark:border-zinc-800 relative overflow-hidden">
                                            {/* Preview */}
                                            <div
                                                className="w-full max-w-[280px] aspect-[3/4] rounded-2xl shadow-xl flex flex-col p-4 relative"
                                                style={{
                                                    backgroundColor: formData.ticketDesign?.backgroundColor || '#ffffff',
                                                    color: formData.ticketDesign?.textColor || '#000000'
                                                }}
                                            >
                                                <div className="h-4 w-4 bg-gray-200 rounded-full absolute -left-2 top-24"></div>
                                                <div className="h-4 w-4 bg-gray-200 rounded-full absolute -right-2 top-24"></div>
                                                <div className="border-b-2 border-dashed border-current opacity-20 absolute top-26 left-4 right-4"></div>

                                                <div className="flex justify-between items-center mb-4">
                                                    {formData.ticketDesign?.logoUrl ? (
                                                        <img src={formData.ticketDesign.logoUrl} className="h-8 object-contain" alt="Logo" />
                                                    ) : (
                                                        <div className="h-8 w-8 bg-current opacity-10 rounded-full"></div>
                                                    )}
                                                    <span className="font-mono text-xs opacity-50">#12345</span>
                                                </div>
                                                <div className="flex-1 mt-8 text-center space-y-2">
                                                    <div className="font-black text-xl leading-tight">{formData.title || 'Event Title'}</div>
                                                    <div className="text-xs opacity-70">{formData.date || 'Date'} • {formData.location || 'Location'}</div>
                                                </div>
                                                <div className="mt-auto">
                                                    <div className="w-full h-24 bg-current opacity-10 rounded-lg flex items-center justify-center">
                                                        <QrCode className="opacity-50" />
                                                    </div>
                                                </div>
                                            </div>
                                        </div>
                                    </div>
                                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mt-4">
                                        <Input
                                            label="Custom Message (on ticket)"
                                            placeholder="e.g. Bring ID, No refunds"
                                            value={formData.ticketDesign?.customMessage || ''}
                                            onChange={e => setFormData({ ...formData, ticketDesign: { ...(formData.ticketDesign || {}), customMessage: e.target.value } })}
                                        />
                                        <div className="flex items-center justify-between p-3 bg-zinc-50 dark:bg-zinc-900 rounded-xl">
                                            <span className="text-sm font-bold">Show Event Cover Image</span>
                                            <Switch
                                                checked={formData.ticketDesign?.showCoverImage !== false}
                                                onChange={c => setFormData({ ...formData, ticketDesign: { ...(formData.ticketDesign || {}), showCoverImage: c } })}
                                            />
                                        </div>
                                    </div>
                                </div>

                                <div className="mt-6 pt-6 border-t border-zinc-200 dark:border-zinc-800">
                                    <div className="flex items-center justify-between p-4 bg-zinc-50 dark:bg-zinc-900 rounded-xl mb-6">
                                        <div className="flex items-center gap-3">
                                            <Users className="text-primary" />
                                            <div>
                                                <div className="font-bold text-sm">Collect Guest Info</div>
                                                <div className="text-xs text-zinc-500">Ask for name and email for each guest when purchasing multiple tickets.</div>
                                            </div>
                                        </div>
                                        <Switch checked={formData.collectGuestInfo !== false} onChange={c => setFormData({ ...formData, collectGuestInfo: c })} />
                                    </div>

                                    <h2 className="text-lg font-bold mb-4 flex items-center gap-2"><HelpCircle className="text-primary" /> Custom Registration Questions</h2>
                                    <p className="text-sm text-zinc-500 mb-4">Ask custom questions to the main buyer during checkout (e.g. Dietary restrictions).</p>

                                    <div className="space-y-4 mb-4">
                                        {formData.questions?.map((q, idx) => (
                                            <div key={q.id || idx} className="p-4 border rounded-xl bg-white dark:bg-black border-zinc-200 dark:border-zinc-800 flex justify-between items-center">
                                                <div>
                                                    <div className="font-bold">{q.label} {q.required && <span className="text-red-500">*</span>}</div>
                                                    <div className="text-sm text-zinc-500 capitalize">{q.type} {q.options && q.options.length > 0 && `• ${q.options.join(', ')}`}</div>
                                                </div>
                                                <Button variant="danger" size="sm" onClick={() => setFormData({ ...formData, questions: formData.questions?.filter((_, i) => i !== idx) })}>
                                                    <Trash2 size={16} />
                                                </Button>
                                            </div>
                                        ))}
                                    </div>

                                    <div className="bg-zinc-50 dark:bg-zinc-900 p-4 rounded-xl border border-zinc-200 dark:border-zinc-800 space-y-4">
                                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                            <Input
                                                label="Question Label"
                                                placeholder="e.g. Dietary Restrictions"
                                                value={newQuestion.label}
                                                onChange={e => setNewQuestion({ ...newQuestion, label: e.target.value })}
                                                containerClassName="mb-0"
                                            />
                                            <Select
                                                label="Type"
                                                value={newQuestion.type || 'text'}
                                                onChange={e => setNewQuestion({ ...newQuestion, type: e.target.value as any })}
                                                options={[
                                                    { value: 'text', label: 'Short Text' },
                                                    { value: 'textarea', label: 'Long Text' },
                                                    { value: 'select', label: 'Dropdown Selection' },
                                                    { value: 'checkbox', label: 'Checkbox' }
                                                ]}
                                                containerClassName="mb-0"
                                            />
                                        </div>

                                        {(newQuestion.type === 'select' || newQuestion.type === 'checkbox' || newQuestion.type === 'radio') && (
                                            <div className="animate-in fade-in">
                                                <Input
                                                    label="Options (comma separated)"
                                                    placeholder="Vegan, Gluten Free, None"
                                                    value={newQuestion.options?.join(', ') || ''}
                                                    onChange={e => setNewQuestion({ ...newQuestion, options: e.target.value.split(',').map(s => s.trim()) })}
                                                />
                                            </div>
                                        )}

                                        <div className="flex items-center justify-between">
                                            <div className="flex items-center gap-2">
                                                <Switch checked={newQuestion.required || false} onChange={c => setNewQuestion({ ...newQuestion, required: c })} />
                                                <span className="text-sm font-bold">Required</span>
                                            </div>
                                            <Button
                                                variant="secondary"
                                                onClick={() => {
                                                    if (!newQuestion.label) return;
                                                    setFormData({ ...formData, questions: [...(formData.questions || []), { ...newQuestion, id: `q-${Date.now()}` } as Question] });
                                                    setNewQuestion({ label: '', type: 'text', required: false, options: [] });
                                                }}
                                            >
                                                <Plus size={16} className="mr-2" /> Add Question
                                            </Button>
                                        </div>
                                    </div>
                                </div>
                            </Card>
                        </div>
                    )
                    }

                    {/* STEP 4: Payment */}
                    {
                        currentStep === 4 && (
                            <div className="animate-in fade-in space-y-6">
                                <Card className="p-6">
                                    <h2 className="text-xl font-bold mb-6 flex items-center gap-2"><CreditCard className="text-primary" /> Payment</h2>
                                    {/* Payment Config UI */}
                                    <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-4">
                                        <div onClick={() => setFormData({ ...formData, paymentConfig: { ...formData.paymentConfig, method: 'online' } as any })} className={`p-4 rounded-xl border-2 cursor-pointer ${formData.paymentConfig?.method === 'online' ? 'border-primary' : 'border-zinc-200'}`}>Online</div>
                                        <div onClick={() => setFormData({ ...formData, paymentConfig: { ...formData.paymentConfig, method: 'offline' } as any })} className={`p-4 rounded-xl border-2 cursor-pointer ${formData.paymentConfig?.method === 'offline' ? 'border-primary' : 'border-zinc-200'}`}>Offline</div>
                                    </div>

                                    <div className="mb-6 p-4 bg-zinc-50 dark:bg-zinc-900 rounded-xl border border-zinc-200 dark:border-zinc-800">
                                        <h3 className="font-bold text-sm text-zinc-900 dark:text-white mb-4">Tax & Custom Fees</h3>

                                        <div className="space-y-4">
                                            <div>
                                                <label className="block text-xs font-bold text-zinc-500 uppercase mb-2">Tax Rate (%)</label>
                                                <Input
                                                    type="number"
                                                    value={formData.taxRate}
                                                    onChange={e => setFormData({ ...formData, taxRate: Number(e.target.value) })}
                                                    placeholder="0.00"
                                                    className="max-w-[150px]"
                                                    containerClassName="mb-0"
                                                />
                                            </div>

                                            <div>
                                                <label className="block text-xs font-bold text-zinc-500 uppercase mb-2">Custom Fees</label>
                                                {formData.customFees?.map((fee, index) => (
                                                    <div key={index} className="flex gap-2 mb-2">
                                                        <Input
                                                            placeholder="Name"
                                                            value={fee.name}
                                                            onChange={e => {
                                                                const newFees = [...(formData.customFees || [])];
                                                                newFees[index].name = e.target.value;
                                                                setFormData({ ...formData, customFees: newFees });
                                                            }}
                                                            className="flex-1"
                                                            containerClassName="mb-0"
                                                        />
                                                        <div className="w-24">
                                                            <Input
                                                                type="number"
                                                                placeholder="Amount"
                                                                value={fee.amount}
                                                                onChange={e => {
                                                                    const newFees = [...(formData.customFees || [])];
                                                                    newFees[index].amount = Number(e.target.value);
                                                                    setFormData({ ...formData, customFees: newFees });
                                                                }}
                                                                containerClassName="mb-0"
                                                            />
                                                        </div>
                                                        <select
                                                            className="bg-white dark:bg-black rounded-lg text-sm px-2 border border-zinc-300 dark:border-zinc-700 h-10"
                                                            value={fee.type}
                                                            onChange={e => {
                                                                const newFees = [...(formData.customFees || [])];
                                                                newFees[index].type = e.target.value as 'fixed' | 'percent';
                                                                setFormData({ ...formData, customFees: newFees });
                                                            }}
                                                        >
                                                            <option value="fixed">$</option>
                                                            <option value="percent">%</option>
                                                        </select>
                                                        <Button variant="danger" size="sm" onClick={() => setFormData({ ...formData, customFees: formData.customFees?.filter((_, i) => i !== index) })} className="h-10 w-10 p-0 flex items-center justify-center">
                                                            <Trash2 size={16} />
                                                        </Button>
                                                    </div>
                                                ))}
                                                <Button size="sm" variant="outline" onClick={() => setFormData({ ...formData, customFees: [...(formData.customFees || []), { name: '', amount: 0, type: 'fixed' }] })}>
                                                    <Plus size={14} className="mr-1" /> Add Fee
                                                </Button>
                                            </div>
                                        </div>
                                    </div>
                                    {renderFeeBreakdown(formData.paymentConfig?.method as any)}
                                </Card>
                            </div>
                        )
                    }

                    {/* STEP 5: Policies */}
                    {
                        currentStep === 5 && (
                            <div className="animate-in fade-in space-y-6">
                                <Card className="p-6">
                                    <h2 className="text-xl font-bold mb-6 flex items-center gap-2"><Shield className="text-primary" /> Policies</h2>
                                    <RichTextarea label="Refund Policy" value={formData.refundPolicy} onChange={(e: any) => setFormData({ ...formData, refundPolicy: e.target.value })} />

                                    <div className="mt-8 pt-8 border-t border-zinc-200 dark:border-zinc-800 space-y-8">
                                        {/* Waiver Section */}
                                        <div className="space-y-4">
                                            <div className="flex items-center justify-between">
                                                <div>
                                                    <h3 className="text-lg font-bold">Attendee Waiver</h3>
                                                    <p className="text-sm text-zinc-500">Require attendees to agree to a waiver before checkout.</p>
                                                </div>
                                                <Switch
                                                    checked={formData.waiverConfig?.enabled || false}
                                                    onChange={c => setFormData({ ...formData, waiverConfig: { ...formData.waiverConfig, enabled: c } })}
                                                />
                                            </div>

                                            {formData.waiverConfig?.enabled && (
                                                <div className="bg-zinc-50 dark:bg-zinc-900 p-4 rounded-xl border border-zinc-200 dark:border-zinc-800 animate-in fade-in space-y-4">
                                                    <RichTextarea
                                                        label="Waiver Text"
                                                        placeholder="Enter the full text of your waiver here..."
                                                        value={formData.waiverConfig?.text || ''}
                                                        onChange={(e: any) => setFormData({ ...formData, waiverConfig: { ...formData.waiverConfig, enabled: true, text: e.target.value } })}
                                                        className="min-h-[150px]"
                                                    />
                                                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                                        <div>
                                                            <label className="block text-xs font-bold text-zinc-600 dark:text-zinc-400 uppercase tracking-wider mb-2 ml-1">Upload PDF (Optional)</label>
                                                            <FileDropZone
                                                                currentImage={formData.waiverConfig?.fileName ? 'PDF_UPLOADED' : ''}
                                                                label={formData.waiverConfig?.fileName || "Drop Waiver PDF"}
                                                                onFileSelect={(b64, name) => setFormData({ ...formData, waiverConfig: { ...formData.waiverConfig, enabled: true, pdfUrl: b64 as string, fileName: name } })}
                                                                onClear={() => setFormData({ ...formData, waiverConfig: { ...formData.waiverConfig, enabled: true, pdfUrl: '', fileName: '' } })}
                                                                accept="application/pdf"
                                                            />
                                                        </div>
                                                    </div>
                                                </div>
                                            )}
                                        </div>

                                        {/* Schedule Section */}
                                        <div className="space-y-4">
                                            <div className="flex items-center justify-between">
                                                <div>
                                                    <h3 className="text-lg font-bold">Event Schedule</h3>
                                                    <p className="text-sm text-zinc-500">Display a detailed schedule on the event page.</p>
                                                </div>
                                                <Switch
                                                    checked={formData.scheduleConfig?.enabled || false}
                                                    onChange={c => setFormData({ ...formData, scheduleConfig: { ...formData.scheduleConfig, enabled: c } })}
                                                />
                                            </div>

                                            {formData.scheduleConfig?.enabled && (
                                                <div className="bg-zinc-50 dark:bg-zinc-900 p-4 rounded-xl border border-zinc-200 dark:border-zinc-800 animate-in fade-in space-y-4">
                                                    <RichTextarea
                                                        label="Schedule Details"
                                                        placeholder="09:00 AM - Registration..."
                                                        value={formData.scheduleConfig?.text || ''}
                                                        onChange={(e: any) => setFormData({ ...formData, scheduleConfig: { ...formData.scheduleConfig, enabled: true, text: e.target.value } })}
                                                    />
                                                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                                        <div>
                                                            <label className="block text-xs font-bold text-zinc-600 dark:text-zinc-400 uppercase tracking-wider mb-2 ml-1">Upload PDF (Optional)</label>
                                                            <FileDropZone
                                                                currentImage={formData.scheduleConfig?.fileName ? 'PDF_UPLOADED' : ''}
                                                                label={formData.scheduleConfig?.fileName || "Drop Schedule PDF"}
                                                                onFileSelect={(b64, name) => setFormData({ ...formData, scheduleConfig: { ...formData.scheduleConfig, enabled: true, pdfUrl: b64 as string, fileName: name } })}
                                                                onClear={() => setFormData({ ...formData, scheduleConfig: { ...formData.scheduleConfig, enabled: true, pdfUrl: '', fileName: '' } })}
                                                                accept="application/pdf"
                                                            />
                                                        </div>
                                                    </div>
                                                </div>
                                            )}
                                        </div>
                                    </div>
                                </Card>
                            </div>
                        )
                    }

                    {/* STEP 6: Marketing */}
                    {
                        currentStep === 6 && (
                            <div className="animate-in fade-in space-y-6">
                                <Card className="p-6">
                                    <h2 className="text-xl font-bold mb-6 flex items-center gap-2"><Megaphone className="text-primary" /> Marketing</h2>
                                    <div className="space-y-4">
                                        <div>
                                            <label className="block text-xs font-bold text-zinc-600 dark:text-zinc-400 uppercase tracking-wider mb-2 ml-1">Event Tags</label>
                                            <div className="bg-zinc-50 dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-xl p-3 focus-within:ring-1 focus-within:ring-primary focus-within:border-primary transition-all">
                                                <div className="flex flex-wrap gap-2 mb-2">
                                                    {formData.tags?.map((tag, i) => (
                                                        <span key={i} className="inline-flex items-center px-3 py-1 rounded-full text-xs font-bold bg-white dark:bg-black border border-zinc-200 dark:border-zinc-700 text-zinc-700 dark:text-zinc-300 shadow-sm animate-in fade-in zoom-in">
                                                            <Tag size={12} className="mr-1 text-zinc-400" /> {tag}
                                                            <button onClick={() => removeTag(tag)} className="ml-2 text-zinc-400 hover:text-red-500 transition-colors"><X size={12} /></button>
                                                        </span>
                                                    ))}
                                                </div>
                                                <input
                                                    type="text"
                                                    value={tagInput}
                                                    onChange={e => setTagInput(e.target.value)}
                                                    onKeyDown={handleAddTag}
                                                    placeholder={formData.tags && formData.tags.length > 0 ? "Add another tag..." : "Type a tag and press Enter (e.g. 'Music', 'Tech')"}
                                                    className="w-full bg-transparent outline-none text-sm px-1 py-1 text-zinc-900 dark:text-white placeholder-zinc-400"
                                                />
                                            </div>
                                            <p className="text-[10px] text-zinc-500 mt-2 ml-1">Tags help attendees find your event in search and recommendations. Press Enter to add.</p>
                                        </div>

                                        {/* SEO Section */}
                                        <div className="pt-6 border-t border-zinc-200 dark:border-zinc-800">
                                            <h3 className="font-bold text-sm uppercase text-zinc-500 mb-4 flex items-center gap-2"><Globe size={16} /> Search Engine Optimization (SEO)</h3>
                                            <div className="space-y-4">
                                                <Input
                                                    label="Meta Title (Optional)"
                                                    placeholder="Custom title for Google search results"
                                                    value={formData.seo?.metaTitle || ''}
                                                    onChange={e => setFormData({ ...formData, seo: { ...(formData.seo || {}), metaTitle: e.target.value } })}
                                                />
                                                <RichTextarea
                                                    label="Meta Description"
                                                    placeholder="Summary used for search snippets and social shares..."
                                                    value={formData.seo?.metaDescription || ''}
                                                    onChange={(e: any) => setFormData({ ...formData, seo: { ...(formData.seo || {}), metaDescription: e.target.value } })}
                                                    className="min-h-[100px]"
                                                />
                                                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                                    <Input
                                                        label="Canonical URL"
                                                        placeholder="https://..."
                                                        value={formData.seo?.canonicalUrl || ''}
                                                        onChange={e => setFormData({ ...formData, seo: { ...(formData.seo || {}), canonicalUrl: e.target.value } })}
                                                    />
                                                    <div className="flex items-center gap-2 mt-8">
                                                        <Switch
                                                            checked={formData.seo?.noIndex || false}
                                                            onChange={c => setFormData({ ...formData, seo: { ...(formData.seo || {}), noIndex: c } })}
                                                        />
                                                        <span className="text-sm font-bold">Hide from Search Engines (NoIndex)</span>
                                                    </div>
                                                </div>
                                            </div>
                                        </div>

                                        {/* Promo Codes */}
                                        <div className="pt-6 border-t border-zinc-200 dark:border-zinc-800">
                                            <h3 className="font-bold text-sm uppercase text-zinc-500 mb-4 flex items-center gap-2"><Percent size={16} /> Promo Codes</h3>

                                            {/* List */}
                                            <div className="space-y-2 mb-4">
                                                {formData.promoCodes?.map((promo, idx) => (
                                                    <div key={idx} className="flex justify-between items-center p-3 bg-zinc-50 dark:bg-zinc-900 rounded-xl border border-zinc-200 dark:border-zinc-800">
                                                        <div>
                                                            <div className="font-mono font-bold text-sm tracking-wider">{promo.code}</div>
                                                            <div className="text-xs text-zinc-500">{promo.type === 'percent' ? `${promo.value}% Off` : `$${promo.value} Off`} {promo.maxUsage ? `• Limit: ${promo.maxUsage}` : ''}</div>
                                                        </div>
                                                        <Button variant="danger" size="sm" onClick={() => setFormData({ ...formData, promoCodes: formData.promoCodes?.filter((_, i) => i !== idx) })} className="h-8 w-8 p-0 flex items-center justify-center"><Trash2 size={14} /></Button>
                                                    </div>
                                                ))}
                                            </div>

                                            {/* Add Form */}
                                            <div className="bg-zinc-100 dark:bg-zinc-900 p-4 rounded-xl border border-zinc-200 dark:border-zinc-800 space-y-4">
                                                <div className="flex flex-col md:flex-row gap-4 items-end">
                                                    <Input
                                                        label="Code"
                                                        placeholder="SUMMER25"
                                                        value={newPromo.code}
                                                        onChange={e => setNewPromo({ ...newPromo, code: e.target.value.toUpperCase() })}
                                                        containerClassName="mb-0 flex-1"
                                                    />
                                                    <div className="w-24">
                                                        <label className="text-xs font-bold text-zinc-500 uppercase mb-2 block">Type</label>
                                                        <select
                                                            className="w-full bg-white dark:bg-black border border-zinc-200 dark:border-zinc-700 rounded-lg px-2 py-2 text-sm h-[42px]"
                                                            value={newPromo.type}
                                                            onChange={e => setNewPromo({ ...newPromo, type: e.target.value as any })}
                                                        >
                                                            <option value="percent">% Off</option>
                                                            <option value="fixed">$ Off</option>
                                                        </select>
                                                    </div>
                                                    <Input
                                                        label="Value"
                                                        type="number"
                                                        placeholder="10"
                                                        value={newPromo.value || ''}
                                                        onChange={e => setNewPromo({ ...newPromo, value: parseFloat(e.target.value) })}
                                                        containerClassName="mb-0 w-24"
                                                    />
                                                    <Button onClick={handleAddPromo} variant="secondary" className="mb-0"><Plus size={16} /></Button>
                                                </div>

                                                <div className="grid grid-cols-1 md:grid-cols-3 gap-4 pt-4 border-t border-dashed border-zinc-300 dark:border-zinc-700">
                                                    <Input
                                                        label="Max Uses (Optional)"
                                                        type="number"
                                                        placeholder="Unlimited"
                                                        value={newPromo.maxUsage || ''}
                                                        onChange={e => setNewPromo({ ...newPromo, maxUsage: e.target.value ? parseInt(e.target.value) : undefined })}
                                                        containerClassName="mb-0"
                                                    />
                                                    <Input
                                                        label="Min Order Qty"
                                                        type="number"
                                                        placeholder="1"
                                                        value={newPromo.minOrderQty || ''}
                                                        onChange={e => setNewPromo({ ...newPromo, minOrderQty: e.target.value ? parseInt(e.target.value) : undefined })}
                                                        containerClassName="mb-0"
                                                    />
                                                    <Input
                                                        label="Expires On"
                                                        type="date"
                                                        value={newPromo.expiryDate ? new Date(newPromo.expiryDate).toISOString().split('T')[0] : ''}
                                                        onChange={e => setNewPromo({ ...newPromo, expiryDate: e.target.value ? new Date(e.target.value).getTime() : undefined })}
                                                        containerClassName="mb-0"
                                                    />
                                                </div>
                                            </div>
                                        </div>

                                        {/* Affiliate Links */}
                                        <div className="pt-6 border-t border-zinc-200 dark:border-zinc-800">
                                            <h3 className="font-bold text-sm uppercase text-zinc-500 mb-4 flex items-center gap-2"><LinkIcon size={16} /> Affiliate Links</h3>

                                            <div className="space-y-2 mb-4">
                                                {formData.affiliates?.map((aff, idx) => (
                                                    <div key={idx} className="flex justify-between items-center p-3 bg-zinc-50 dark:bg-zinc-900 rounded-xl border border-zinc-200 dark:border-zinc-800">
                                                        <div>
                                                            <div className="font-bold text-sm">{aff.name}</div>
                                                            <div className="text-xs text-zinc-500 font-mono">Ref: {aff.code}</div>
                                                        </div>
                                                        <div className="flex gap-2">
                                                            <Button size="sm" variant="ghost" onClick={() => copyAffiliateLink(aff.code)}><Copy size={14} className="mr-1" /> Copy Link</Button>
                                                            <Button variant="danger" size="sm" onClick={() => setFormData({ ...formData, affiliates: formData.affiliates?.filter((_, i) => i !== idx) })} className="h-8 w-8 p-0 flex items-center justify-center"><Trash2 size={14} /></Button>
                                                        </div>
                                                    </div>
                                                ))}
                                            </div>

                                            {/* Add Affiliate */}
                                            <div className="bg-zinc-100 dark:bg-zinc-900 p-4 rounded-xl border border-zinc-200 dark:border-zinc-800 flex flex-col md:flex-row gap-4 items-end">
                                                <Input
                                                    label="Partner Name"
                                                    placeholder="Influencer X"
                                                    value={newAffiliate.name}
                                                    onChange={e => setNewAffiliate({ ...newAffiliate, name: e.target.value })}
                                                    containerClassName="mb-0 flex-1"
                                                />
                                                <Input
                                                    label="Code Suffix"
                                                    placeholder="INFLUENCERX"
                                                    value={newAffiliate.code}
                                                    onChange={e => setNewAffiliate({ ...newAffiliate, code: e.target.value })}
                                                    containerClassName="mb-0 flex-1"
                                                />
                                                <Button onClick={handleAddAffiliate} variant="secondary" className="mb-0"><Plus size={16} /> Create Link</Button>
                                            </div>
                                        </div>

                                        {/* Email Configuration */}
                                        <div className="pt-6 border-t border-zinc-200 dark:border-zinc-800">
                                            <h3 className="font-bold text-sm uppercase text-zinc-500 mb-4 flex items-center gap-2"><Mail size={16} /> Email Notifications</h3>

                                            <div className="space-y-4">
                                                {/* Confirmation Email */}
                                                <div className="bg-zinc-50 dark:bg-zinc-900 p-4 rounded-xl border border-zinc-200 dark:border-zinc-800">
                                                    <div className="flex justify-between items-center mb-0">
                                                        <div>
                                                            <h4 className="font-bold text-sm">Order Confirmation</h4>
                                                            <p className="text-xs text-zinc-500">Sent automatically when a customer purchases a ticket.</p>
                                                        </div>
                                                        <Switch
                                                            checked={formData.emailSettings?.enabled !== false}
                                                            onChange={c => setFormData({ ...formData, emailSettings: { ...(formData.emailSettings || { enabled: true }), enabled: c } })}
                                                        />
                                                    </div>
                                                    {formData.emailSettings?.enabled !== false && currentUser?.emailTemplates && (
                                                        <div className="mt-4 animate-in fade-in">
                                                            <label className="text-xs font-bold text-zinc-500 uppercase mb-2 block">Custom Template</label>
                                                            <select
                                                                className="w-full bg-white dark:bg-black border border-zinc-200 dark:border-zinc-700 rounded-lg px-3 py-2 text-sm"
                                                                value={formData.emailSettings?.confirmationTemplateId || ''}
                                                                onChange={(e: any) => setFormData({ ...formData, emailSettings: { ...(formData.emailSettings || { enabled: true }), confirmationTemplateId: e.target.value } })}
                                                            >
                                                                <option value="">Default System Email</option>
                                                                {currentUser.emailTemplates.filter(t => t.type === 'confirmation').map(t => (
                                                                    <option key={t.id} value={t.id}>{t.name}</option>
                                                                ))}
                                                            </select>
                                                        </div>
                                                    )}
                                                </div>

                                                {/* Reminder Email */}
                                                <div className="bg-zinc-50 dark:bg-zinc-900 p-4 rounded-xl border border-zinc-200 dark:border-zinc-800">
                                                    <div className="flex justify-between items-center mb-0">
                                                        <div>
                                                            <h4 className="font-bold text-sm">Event Reminder</h4>
                                                            <p className="text-xs text-zinc-500">Sent 24h before event starts.</p>
                                                        </div>
                                                        <Switch
                                                            checked={formData.emailSettings?.reminderEnabled || false}
                                                            onChange={c => setFormData({ ...formData, emailSettings: { ...(formData.emailSettings || { enabled: true }), reminderEnabled: c } })}
                                                        />
                                                    </div>
                                                    {formData.emailSettings?.reminderEnabled && currentUser?.emailTemplates && (
                                                        <div className="mt-4 animate-in fade-in">
                                                            <label className="text-xs font-bold text-zinc-500 uppercase mb-2 block">Custom Template</label>
                                                            <select
                                                                className="w-full bg-white dark:bg-black border border-zinc-200 dark:border-zinc-700 rounded-lg px-3 py-2 text-sm"
                                                                value={formData.emailSettings?.reminderTemplateId || ''}
                                                                onChange={(e: any) => setFormData({ ...formData, emailSettings: { ...(formData.emailSettings || { enabled: true }), reminderTemplateId: e.target.value } })}
                                                            >
                                                                <option value="">Default Reminder Email</option>
                                                                {currentUser.emailTemplates.filter(t => t.type === 'reminder').map(t => (
                                                                    <option key={t.id} value={t.id}>{t.name}</option>
                                                                ))}
                                                            </select>
                                                        </div>
                                                    )}
                                                </div>
                                            </div>
                                        </div>
                                    </div>
                                </Card>
                            </div>
                        )
                    }

                    {/* STEP 7: PUBLISH */}
                    {
                        currentStep === 7 && (
                            <div className="animate-in fade-in space-y-6">
                                <Card className="p-8 text-center border-2 border-primary/20 bg-primary/5">
                                    <Sparkles className="mx-auto text-primary mb-4" size={48} />
                                    <h2 className="text-3xl font-black mb-2">Ready to Launch?</h2>
                                    <p className="text-zinc-600 dark:text-zinc-300 max-w-lg mx-auto mb-8">
                                        Review your event details one last time. You can always edit later, but published events will be live instantly.
                                    </p>

                                    <div className="flex flex-col sm:flex-row gap-4 justify-center">
                                        <Button onClick={() => handleSubmit(true)} variant="outline" className="px-8 py-4" isLoading={isSaving}>
                                            Save as Draft
                                        </Button>
                                        <Button onClick={() => handleSubmit(false)} className="px-12 py-4 text-lg shadow-[0_0_30px_rgba(236,72,153,0.4)]" isLoading={isSaving}>
                                            Publish Event
                                        </Button>
                                    </div>
                                </Card>
                            </div>
                        )
                    }

                </div >

                {/* Sidebar / Navigation */}
                < div className="lg:col-span-1" >
                    <div className="sticky top-24 space-y-4">
                        <Card className="p-4 bg-zinc-50 dark:bg-zinc-900 border-zinc-200 dark:border-zinc-800">
                            <h3 className="font-bold text-sm uppercase text-zinc-500 mb-3">Quick Navigation</h3>
                            <div className="space-y-1">
                                {STEPS.map(step => (
                                    <button
                                        key={step.id}
                                        onClick={() => setCurrentStep(step.id)}
                                        className={`w-full text-left px-3 py-2 rounded-lg text-sm font-medium transition-colors flex items-center justify-between ${currentStep === step.id ? 'bg-white dark:bg-black text-primary shadow-sm' : 'text-zinc-500 hover:text-zinc-900 dark:hover:text-zinc-300'}`}
                                    >
                                        <span className="flex items-center gap-2"><step.icon size={14} /> {step.label}</span>
                                        {currentStep > step.id && <Check size={12} className="text-green-500" />}
                                    </button>
                                ))}
                            </div>
                        </Card>

                        <div className="flex gap-2">
                            <Button
                                variant="ghost"
                                onClick={handleBack}
                                disabled={currentStep === 1}
                                className="flex-1"
                            >
                                Back
                            </Button>
                            {currentStep < 7 && (
                                <Button onClick={handleNext} className="flex-1">
                                    Next <ChevronRight size={16} className="ml-1" />
                                </Button>
                            )}
                        </div>

                        {validationError && (
                            <div className="p-3 bg-red-50 text-red-600 text-sm rounded-xl font-bold flex items-start gap-2">
                                <AlertCircle size={16} className="shrink-0 mt-0.5" />
                                {validationError}
                            </div>
                        )}
                    </div>
                </div >
            </div >

            <ErrorModal
                isOpen={errorModal.open}
                onClose={() => setErrorModal({ ...errorModal, open: false })}
                title={errorModal.title}
                message={errorModal.message}
            />
        </div >
    );
};
