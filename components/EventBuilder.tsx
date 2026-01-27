
import React, { useState, useEffect } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { useGlobalUI } from './GlobalUIProvider';
import { useConfirm } from './ConfirmContext';
import { Info, Image as ImageIcon, MapPin, Calendar, Clock, DollarSign, Plus, Trash2, Save, ArrowLeft, Loader2, Sparkles, Check, ChevronRight, Settings, Ticket, Target, Users, CreditCard, Shield, Globe, Gift, HelpCircle, FileText, Megaphone, CheckCircle2, QrCode, Tag, Percent, LinkIcon as LinkIcon, Copy, Mail, AlertCircle, X, Heart, Eye, Lock, Key, RefreshCw } from 'lucide-react';
import { Button, Input, RichTextarea, Select, Card, FileDropZone, DatePicker, TimePicker, Switch, Tooltip, formatTime, ErrorModal } from './UI';
import { StorageService, PLANS } from '../services/storageService';
import { GeminiService } from '../services/geminiService';
import { Event, User, TicketTier, AddOn, AffiliateLink, GalleryItem, PromoCode, PaymentConfig, Question, PresaleConfig, PresaleCode } from '../types';
import { EmailPreview } from './EmailPreview';

const STEPS = [
    { id: 1, label: 'Details', icon: Calendar },
    { id: 2, label: 'Content', icon: ImageIcon },
    { id: 3, label: 'Tickets', icon: Ticket },
    { id: 4, label: 'Payment', icon: CreditCard },
    { id: 5, label: 'Policies', icon: Shield },
    { id: 6, label: 'Marketing', icon: Megaphone },
    { id: 7, label: 'Presale', icon: Lock },
    { id: 8, label: 'Publish', icon: CheckCircle2 },
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
    const { confirm } = useConfirm();

    const [isLoading, setIsLoading] = useState(true);
    const [isSaving, setIsSaving] = useState(false);
    const [currentUser, setCurrentUser] = useState<User | null>(null);
    const [currentStep, setCurrentStep] = useState(1);
    const [validationError, setValidationError] = useState('');

    const [errorModal, setErrorModal] = useState<{ open: boolean, title?: string, message: string }>({ open: false, message: '' });
    const { showToast, showConfirm, showAlert } = useGlobalUI();

    // Upgrade Modal State
    const [upgradeModal, setUpgradeModal] = useState<{
        open: boolean;
        title: string;
        message: string;
        suggestedPlan: string | null;
        currentLimit: number;
        requested: number;
    }>({ open: false, title: '', message: '', suggestedPlan: null, currentLimit: 0, requested: 0 });

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

    // Email Preview Modal State
    const [showEmailPreview, setShowEmailPreview] = useState(false);

    // Tag Input State
    const [tagInput, setTagInput] = useState('');

    // Presale State
    const [presaleCodes, setPresaleCodes] = useState<PresaleCode[]>([]);
    const [isLoadingCodes, setIsLoadingCodes] = useState(false);
    const [newPresaleCode, setNewPresaleCode] = useState({ code: '', limitType: 'single' as const, maxUses: 1, name: '' });
    const [generateCodeSettings, setGenerateCodeSettings] = useState({ count: 10, limitType: 'single' as const, maxUses: 1, prefix: '' });

    const [formData, setFormData] = useState<Partial<Event>>({
        title: '', subtitle: '', description: '', timeline: '', venueName: '', location: '',
        eventType: 'in_person', onlineUrl: '', category: '',
        isRecurring: false, date: '', endDate: '', time: '', endTime: '', duration: 1,
        recurringDates: [], timeFormat: '12h', tags: [],
        organizer: '', organizerEmail: '', organizerPhone: '', organizerWebsite: '',
        priceType: 'free', price: 0, ticketName: '', ticketTiers: [], promoCodes: [],
        addOns: [], affiliates: [],
        absorbFees: false, taxRate: 0, capacity: 100,
        questions: [], gallery: [], reminders: [], imageUrl: '', coverImagePosition: 50,
        paymentConfig: { method: 'online' }, // Default to online payment
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
        collectGuestInfo: true,
        // Presale defaults
        presale: {
            enabled: false,
            startDate: '',
            endDate: '',
            accessMethods: {
                accountFlag: false,
                codes: true,
                privateLink: true
            },
            privateToken: '',
            generalSaleMessage: 'Presale in progress. General sale starts soon!'
        }
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
                    
                    // Ensure organizer fields are populated from user profile if empty
                    const useBusinessProfile = updatedUser?.useBusinessName || user.useBusinessName || false;
                    const defaultOrganizerName = useBusinessProfile 
                        ? (updatedUser?.businessName || user.businessName || updatedUser?.name || user.name)
                        : (updatedUser?.name || user.name);
                    const defaultOrganizerEmail = useBusinessProfile 
                        ? (updatedUser?.businessEmail || user.businessEmail || updatedUser?.email || user.email)
                        : (updatedUser?.email || user.email);
                    
                    // Only override if event's organizer fields are empty
                    const organizerName = event.organizer?.trim() || defaultOrganizerName || 'Your Name';
                    const organizerEmail = event.organizerEmail?.trim() || defaultOrganizerEmail || user.email || '';
                    
                    setFormData({
                        ...event,
                        organizer: organizerName,
                        organizerEmail: organizerEmail
                    });
                }
            } else {
                // New event - inherit defaults from user settings
                // Use businessName if useBusinessName is enabled, otherwise use personal name
                const useBusinessProfile = updatedUser?.useBusinessName || user.useBusinessName || false;
                
                // ALWAYS populate organizer fields - never leave empty
                const displayName = useBusinessProfile 
                    ? (updatedUser?.businessName || user.businessName || updatedUser?.name || user.name)
                    : (updatedUser?.name || user.name);
                
                const displayEmail = useBusinessProfile 
                    ? (updatedUser?.businessEmail || user.businessEmail || updatedUser?.email || user.email)
                    : (updatedUser?.email || user.email);
                
                setFormData(prev => ({
                    ...prev,
                    // Organizer name and email - ALWAYS populated from user profile
                    organizer: displayName || 'Your Name',
                    organizerEmail: displayEmail || user.email || '',
                    paymentConfig: { method: (updatedUser?.defaultPaymentMethod as any) || user.defaultPaymentMethod || 'online', link: updatedUser?.defaultPaymentLink || user.defaultPaymentLink, instructions: updatedUser?.defaultPaymentInstructions || user.defaultPaymentInstructions }, // Default to online
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
                    // Currency is now global (from user's defaultCurrency), not per-event
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

            if (totalCapacity > planDetails.ticketLimit && !asDraft) {
                // Determine suggested plan
                let suggestedPlan: string | null = null;
                if (totalCapacity <= PLANS.pro.ticketLimit) {
                    suggestedPlan = 'pro';
                } else if (totalCapacity <= PLANS.premium.ticketLimit) {
                    suggestedPlan = 'premium';
                } else {
                    suggestedPlan = 'enterprise';
                }

                setUpgradeModal({
                    open: true,
                    title: "Upgrade Required",
                    message: `Your ${planDetails.name} plan allows up to ${planDetails.ticketLimit.toLocaleString()} tickets per event. This event has ${totalCapacity.toLocaleString()} tickets.`,
                    suggestedPlan,
                    currentLimit: planDetails.ticketLimit,
                    requested: totalCapacity
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
                    const suggestedPlan = plan === 'free' ? 'pro' : 'premium';
                    setUpgradeModal({
                        open: true,
                        title: "Monthly Limit Reached",
                        message: `You've published ${eventsThisMonth} events this month, reaching your ${planDetails.name} plan limit of ${planDetails.eventLimit} events/month.`,
                        suggestedPlan,
                        currentLimit: planDetails.eventLimit,
                        requested: eventsThisMonth + 1
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
            if (!formData.title) return window.alert("Please enter an event title first.");
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
            window.alert("Promo code already exists!");
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
        window.alert("Affiliate link copied to clipboard!");
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
                                        if (!formData.title) return window.alert("Please enter an event title first.");
                                        const img = await GeminiService.generateEventImage(formData.title, formData.description || formData.title);
                                        if (img) setFormData({ ...formData, imageUrl: img });
                                    }}>
                                        <Sparkles size={14} className="mr-1" /> Generate Image with AI
                                    </Button>
                                </div>

                                {/* Image Gallery Section */}
                                <div className="mt-8 pt-6 border-t border-zinc-200 dark:border-zinc-800">
                                    <div className="flex justify-between items-center mb-4">
                                        <div>
                                            <label className="text-sm font-bold text-zinc-500 uppercase">Image Gallery</label>
                                            <p className="text-xs text-zinc-400 mt-1">Add multiple images to showcase your event</p>
                                        </div>
                                        <Button 
                                            size="sm" 
                                            variant="outline"
                                            onClick={() => {
                                                const newGalleryItem: GalleryItem = {
                                                    id: `gallery-${Date.now()}`,
                                                    url: '',
                                                    caption: ''
                                                };
                                                setFormData({ 
                                                    ...formData, 
                                                    gallery: [...(formData.gallery || []), newGalleryItem] 
                                                });
                                            }}
                                        >
                                            <Plus size={14} className="mr-1" /> Add Image
                                        </Button>
                                    </div>

                                    {formData.gallery && formData.gallery.length > 0 ? (
                                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                            {formData.gallery.map((item, idx) => (
                                                <div key={item.id} className="relative group border border-zinc-200 dark:border-zinc-700 rounded-xl overflow-hidden bg-zinc-50 dark:bg-zinc-900">
                                                    {item.url ? (
                                                        <div className="aspect-video relative">
                                                            <img 
                                                                src={item.url} 
                                                                alt={item.caption || `Gallery image ${idx + 1}`}
                                                                className="w-full h-full object-cover"
                                                            />
                                                            <button
                                                                onClick={() => {
                                                                    const updated = [...(formData.gallery || [])];
                                                                    updated[idx] = { ...updated[idx], url: '' };
                                                                    setFormData({ ...formData, gallery: updated });
                                                                }}
                                                                className="absolute top-2 right-2 p-1.5 bg-red-500 text-white rounded-full opacity-0 group-hover:opacity-100 transition-opacity"
                                                            >
                                                                <X size={14} />
                                                            </button>
                                                        </div>
                                                    ) : (
                                                        <div className="aspect-video">
                                                            <FileDropZone
                                                                label=""
                                                                currentImage=""
                                                                onFileSelect={(b64) => {
                                                                    const updated = [...(formData.gallery || [])];
                                                                    updated[idx] = { ...updated[idx], url: b64 as string };
                                                                    setFormData({ ...formData, gallery: updated });
                                                                }}
                                                                onClear={() => {}}
                                                                className="h-full"
                                                            />
                                                        </div>
                                                    )}
                                                    <div className="p-3">
                                                        <input
                                                            type="text"
                                                            placeholder="Add a caption..."
                                                            value={item.caption || ''}
                                                            onChange={(e) => {
                                                                const updated = [...(formData.gallery || [])];
                                                                updated[idx] = { ...updated[idx], caption: e.target.value };
                                                                setFormData({ ...formData, gallery: updated });
                                                            }}
                                                            className="w-full px-3 py-2 text-sm bg-white dark:bg-zinc-800 border border-zinc-200 dark:border-zinc-700 rounded-lg focus:ring-2 focus:ring-primary outline-none"
                                                        />
                                                        <button
                                                            onClick={() => {
                                                                const updated = (formData.gallery || []).filter((_, i) => i !== idx);
                                                                setFormData({ ...formData, gallery: updated });
                                                            }}
                                                            className="mt-2 text-xs text-red-500 hover:text-red-600 flex items-center gap-1"
                                                        >
                                                            <Trash2 size={12} /> Remove
                                                        </button>
                                                    </div>
                                                </div>
                                            ))}
                                        </div>
                                    ) : (
                                        <div className="text-center py-8 border-2 border-dashed border-zinc-200 dark:border-zinc-700 rounded-xl">
                                            <ImageIcon size={32} className="mx-auto text-zinc-300 mb-2" />
                                            <p className="text-sm text-zinc-400">No gallery images yet</p>
                                            <p className="text-xs text-zinc-400 mt-1">Click "Add Image" to create a gallery</p>
                                        </div>
                                    )}
                                </div>

                                {/* Description */}
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
                                
                                {/* Plan Limits Indicator */}
                                {currentUser && (() => {
                                    const plan = (currentUser.subscription?.plan as keyof typeof PLANS) || 'free';
                                    const planDetails = PLANS[plan] || PLANS.free;
                                    const totalCapacity = formData.isRecurring
                                        ? formData.recurringDates?.reduce((acc, rd) => acc + (rd.capacity || 0), 0) || 0
                                        : formData.capacity || 0;
                                    const usagePercent = Math.min(100, (totalCapacity / planDetails.ticketLimit) * 100);
                                    const isNearLimit = usagePercent >= 80;
                                    const isAtLimit = usagePercent >= 100;
                                    
                                    return (
                                        <div className={`p-4 rounded-xl mb-6 border ${
                                            isAtLimit ? 'bg-red-900/20 border-red-700' : 
                                            isNearLimit ? 'bg-amber-900/20 border-amber-700' : 
                                            'bg-zinc-800/50 border-zinc-700'
                                        }`}>
                                            <div className="flex items-center justify-between mb-2">
                                                <div className="flex items-center gap-2">
                                                    <Target size={16} className={isAtLimit ? 'text-red-400' : isNearLimit ? 'text-amber-400' : 'text-zinc-400'} />
                                                    <span className="text-sm font-medium text-zinc-300">
                                                        Ticket Capacity ({planDetails.name} Plan)
                                                    </span>
                                                </div>
                                                <span className={`text-sm font-bold ${
                                                    isAtLimit ? 'text-red-400' : isNearLimit ? 'text-amber-400' : 'text-zinc-400'
                                                }`}>
                                                    {totalCapacity.toLocaleString()} / {planDetails.ticketLimit.toLocaleString()}
                                                </span>
                                            </div>
                                            <div className="h-2 bg-zinc-700 rounded-full overflow-hidden">
                                                <div 
                                                    className={`h-full rounded-full transition-all ${
                                                        isAtLimit ? 'bg-red-500' : isNearLimit ? 'bg-amber-500' : 'bg-[#E0FF20]'
                                                    }`}
                                                    style={{ width: `${usagePercent}%` }}
                                                />
                                            </div>
                                            {isAtLimit && (
                                                <p className="text-xs text-red-400 mt-2 flex items-center gap-1">
                                                    <AlertCircle size={12} /> Limit reached. <button onClick={() => navigate('/pricing')} className="underline hover:text-red-300">Upgrade</button> for more capacity.
                                                </p>
                                            )}
                                            {isNearLimit && !isAtLimit && (
                                                <p className="text-xs text-amber-400 mt-2">
                                                    Approaching limit. Consider upgrading for more capacity.
                                                </p>
                                            )}
                                        </div>
                                    );
                                })()}
                                
                                {/* Organization Currency Notice - Read-only, set in Settings */}
                                <div className="bg-blue-50 dark:bg-blue-900/20 p-3 rounded-xl mb-6 border border-blue-200 dark:border-blue-800/50 flex items-center gap-3">
                                    <Globe size={18} className="text-blue-600 dark:text-blue-400" />
                                    <div>
                                        <span className="text-sm font-medium text-blue-900 dark:text-blue-100">
                                            All prices in <strong>{currentUser?.defaultCurrency || 'USD'}</strong> (your organization currency)
                                        </span>
                                        <span className="text-xs text-blue-600 dark:text-blue-300 ml-2">
                                            Change in <span className="underline cursor-pointer" onClick={() => navigate('/settings')}>Settings</span>
                                        </span>
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
                                        {formData.ticketTiers?.map((tier, idx) => tier && (
                                            <div key={tier.id || idx} className="p-4 border rounded-xl bg-white dark:bg-black border-zinc-200 dark:border-zinc-800 space-y-4">
                                                <div className="flex flex-col sm:flex-row gap-4">
                                                    <div className="flex-[2]">
                                                        <Input
                                                            label="Tier Name"
                                                            placeholder="e.g. General Admission, VIP"
                                                            value={tier.name || ''}
                                                            onChange={e => { const n = [...formData.ticketTiers || []]; n[idx].name = e.target.value; setFormData({ ...formData, ticketTiers: n }) }}
                                                            containerClassName="mb-0"
                                                        />
                                                    </div>
                                                    <div className="flex-1">
                                                        <Input
                                                            label={`Price (${currentUser?.defaultCurrency || 'USD'})`}
                                                            type="number"
                                                            placeholder="0.00"
                                                            value={tier.price || ''}
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
                                            <Input label={`Price (${currentUser?.defaultCurrency || 'USD'})`} type="number" value={formData.price || ''} onChange={e => setFormData({ ...formData, price: parseFloat(e.target.value) || 0 })} containerClassName="flex-1" />
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
                                        {formData.addOns?.map((addon, idx) => addon && (
                                            <div key={addon.id || idx} className="p-4 border rounded-xl bg-white dark:bg-black border-zinc-200 dark:border-zinc-800 flex justify-between items-center">
                                                <div>
                                                    <div className="font-bold">{addon.name || 'Unnamed Add-on'}</div>
                                                    <div className="text-sm text-zinc-500">
                                                        ${addon.price || 0} {addon.question && `• ${addon.question}`}
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
                                                label={`Price (${currentUser?.defaultCurrency || 'USD'})`}
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

                                {/* Email Ticket Templates - Visual Design for Emails */}
                                <div className="mt-8 pt-8 border-t border-zinc-200 dark:border-zinc-800">
                                    <h2 className="text-lg font-bold mb-2 flex items-center gap-2"><Mail className="text-purple-500" /> Email Ticket Templates</h2>
                                    <p className="text-sm text-zinc-500 mb-6">Choose a visual design for your confirmation emails and printable tickets. Customize content (subject lines, text) in Settings → Email Templates.</p>
                                    
                                    {/* Default Template Presets */}
                                    <div className="mb-4">
                                        <label className="text-xs font-bold text-zinc-500 uppercase mb-3 block">Default Templates</label>
                                        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                                            {[
                                                { id: 'modern', name: 'Modern', gradient: 'from-purple-500 to-indigo-600', textColor: '#ffffff', bgColor: '#ffffff', accent: '#8b5cf6' },
                                                { id: 'classic', name: 'Classic', gradient: 'from-zinc-800 to-zinc-900', textColor: '#ffffff', bgColor: '#1a1a1a', accent: '#fbbf24' },
                                                { id: 'minimal', name: 'Minimal', gradient: 'from-zinc-100 to-zinc-200', textColor: '#000000', bgColor: '#ffffff', accent: '#000000' },
                                                { id: 'festive', name: 'Festive', gradient: 'from-pink-500 to-orange-400', textColor: '#ffffff', bgColor: '#fff5f5', accent: '#ec4899' },
                                            ].map(template => (
                                                <button
                                                    key={template.id}
                                                    type="button"
                                                    onClick={() => setFormData({ 
                                                        ...formData, 
                                                        ticketDesign: { 
                                                            ...(formData.ticketDesign || {}), 
                                                            template: template.id,
                                                            backgroundColor: template.bgColor,
                                                            textColor: template.textColor,
                                                            accentColor: template.accent,
                                                        } 
                                                    })}
                                                    className={`relative p-3 rounded-xl border-2 transition-all ${
                                                        (formData.ticketDesign?.template || 'modern') === template.id 
                                                            ? 'border-primary ring-2 ring-primary/20' 
                                                            : 'border-zinc-200 dark:border-zinc-700 hover:border-zinc-300 dark:hover:border-zinc-600'
                                                    }`}
                                                >
                                                    {/* Mini Preview */}
                                                    <div className="w-full aspect-[3/4] rounded-lg overflow-hidden shadow-sm mb-2">
                                                        <div className={`h-1/3 bg-gradient-to-br ${template.gradient}`}></div>
                                                        <div className="h-2/3 flex flex-col items-center justify-center p-2" style={{ backgroundColor: template.bgColor }}>
                                                            <div className="w-4 h-4 rounded bg-zinc-300 mb-1"></div>
                                                            <div className="w-8 h-1 rounded bg-zinc-300"></div>
                                                        </div>
                                                    </div>
                                                    <span className="text-xs font-bold">{template.name}</span>
                                                    {(formData.ticketDesign?.template || 'modern') === template.id && (
                                                        <div className="absolute -top-1 -right-1 w-5 h-5 bg-primary rounded-full flex items-center justify-center">
                                                            <Check size={12} className="text-white" />
                                                        </div>
                                                    )}
                                                </button>
                                            ))}
                                        </div>
                                    </div>

                                    {/* My Saved Templates */}
                                    {currentUser?.savedTicketTemplates && currentUser.savedTicketTemplates.length > 0 && (
                                        <div className="mb-6">
                                            <label className="text-xs font-bold text-zinc-500 uppercase mb-3 block flex items-center gap-2">
                                                <Heart size={12} className="text-pink-500" /> My Templates
                                            </label>
                                            <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                                                {currentUser.savedTicketTemplates.map(saved => (
                                                    <div key={saved.id} className="relative group">
                                                        <button
                                                            type="button"
                                                            onClick={() => setFormData({ 
                                                                ...formData, 
                                                                ticketDesign: { 
                                                                    ...(formData.ticketDesign || {}), 
                                                                    template: saved.id,
                                                                    logoUrl: saved.design.logoUrl || formData.ticketDesign?.logoUrl,
                                                                    backgroundColor: saved.design.backgroundColor || '#ffffff',
                                                                    textColor: saved.design.textColor || '#000000',
                                                                    accentColor: saved.design.accentColor || '#8b5cf6',
                                                                    customMessage: saved.design.customMessage || '',
                                                                } 
                                                            })}
                                                            className={`w-full p-3 rounded-xl border-2 transition-all ${
                                                                formData.ticketDesign?.template === saved.id 
                                                                    ? 'border-pink-500 ring-2 ring-pink-500/20' 
                                                                    : 'border-zinc-200 dark:border-zinc-700 hover:border-zinc-300 dark:hover:border-zinc-600'
                                                            }`}
                                                        >
                                                            {/* Mini Preview */}
                                                            <div className="w-full aspect-[3/4] rounded-lg overflow-hidden shadow-sm mb-2">
                                                                <div 
                                                                    className="h-1/3 flex items-center justify-center"
                                                                    style={{ backgroundColor: saved.design.accentColor || '#8b5cf6' }}
                                                                >
                                                                    {saved.design.logoUrl ? (
                                                                        <img src={saved.design.logoUrl} className="max-h-full max-w-full object-contain p-1" alt="" />
                                                                    ) : (
                                                                        <div className="w-6 h-3 bg-white/30 rounded"></div>
                                                                    )}
                                                                </div>
                                                                <div className="h-2/3 flex flex-col items-center justify-center p-2" style={{ backgroundColor: saved.design.backgroundColor || '#ffffff' }}>
                                                                    <div className="w-4 h-4 rounded bg-zinc-300 mb-1"></div>
                                                                    <div className="w-8 h-1 rounded bg-zinc-300"></div>
                                                                </div>
                                                            </div>
                                                            <span className="text-xs font-bold truncate block">{saved.name}</span>
                                                            {formData.ticketDesign?.template === saved.id && (
                                                                <div className="absolute -top-1 -right-1 w-5 h-5 bg-pink-500 rounded-full flex items-center justify-center">
                                                                    <Check size={12} className="text-white" />
                                                                </div>
                                                            )}
                                                        </button>
                                                        {/* Delete Button */}
                                                        <button
                                                            type="button"
                                                            onClick={async (e) => {
                                                                e.stopPropagation();
                                                                const confirmed = await confirm({
                                                                    title: 'Delete Template',
                                                                    message: `Delete template "${saved.name}"?`,
                                                                    confirmText: 'Delete',
                                                                    variant: 'danger'
                                                                });

                                                                if (confirmed) {
                                                                    const updated = currentUser.savedTicketTemplates?.filter(t => t.id !== saved.id) || [];
                                                                    await StorageService.updateUser(currentUser.id, { savedTicketTemplates: updated });
                                                                    setCurrentUser({ ...currentUser, savedTicketTemplates: updated });
                                                                }
                                                            }}
                                                            className="absolute top-1 right-1 w-6 h-6 bg-red-500 text-white rounded-full opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center shadow-lg"
                                                        >
                                                            <Trash2 size={12} />
                                                        </button>
                                                    </div>
                                                ))}
                                            </div>
                                        </div>
                                    )}
                                    
                                    <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                                        {/* Left: Customization Options */}
                                        <div className="space-y-4 relative z-10">
                                            {/* A. Add Image to Ticket */}
                                            <div className="p-4 bg-zinc-50 dark:bg-zinc-900 rounded-xl border border-zinc-200 dark:border-zinc-800">
                                                <label className="text-sm font-bold text-zinc-700 dark:text-zinc-300 mb-2 block flex items-center gap-2">
                                                    <ImageIcon size={16} className="text-purple-500" />
                                                    Ticket Image <span className="text-xs font-normal text-zinc-400">(optional)</span>
                                                </label>
                                                <p className="text-xs text-zinc-500 mb-3">Logo or banner for the ticket header. Use a URL or upload (400x200px recommended).</p>
                                                
                                                {/* URL Input Option */}
                                                <div className="mb-3">
                                                    <input
                                                        type="url"
                                                        className="w-full px-3 py-2 rounded-lg border border-zinc-200 dark:border-zinc-700 bg-white dark:bg-black text-sm"
                                                        placeholder="https://example.com/logo.png"
                                                        value={formData.ticketDesign?.logoUrl?.startsWith('http') ? formData.ticketDesign.logoUrl : ''}
                                                        onChange={(e) => setFormData({ ...formData, ticketDesign: { ...(formData.ticketDesign || {}), logoUrl: e.target.value } })}
                                                    />
                                                </div>
                                                
                                                <div className="text-xs text-zinc-400 text-center mb-2">— or upload —</div>
                                                
                                                <div className="h-20">
                                                    <FileDropZone
                                                        label="Upload Image"
                                                        currentImage={formData.ticketDesign?.logoUrl || undefined}
                                                        onFileSelect={async (b64) => {
                                                            // Upload to storage and get public URL
                                                            try {
                                                                const path = `events/${formData.id || 'new'}/ticket-logo-${Date.now()}.png`;
                                                                const publicUrl = await StorageService.uploadFile(b64 as string, path);
                                                                setFormData({ ...formData, ticketDesign: { ...(formData.ticketDesign || {}), logoUrl: publicUrl } });
                                                            } catch (e) {
                                                                console.error('Logo upload failed:', e);
                                                                // Fallback to base64 if upload fails
                                                                setFormData({ ...formData, ticketDesign: { ...(formData.ticketDesign || {}), logoUrl: b64 as string } });
                                                            }
                                                        }}
                                                        onClear={() => setFormData({ ...formData, ticketDesign: { ...(formData.ticketDesign || {}), logoUrl: '' } })}
                                                    />
                                                </div>
                                            </div>
                                            
                                            {/* B. Add Details to Ticket */}
                                            <div className="p-4 bg-zinc-50 dark:bg-zinc-900 rounded-xl border border-zinc-200 dark:border-zinc-800">
                                                <label className="text-sm font-bold text-zinc-700 dark:text-zinc-300 mb-2 block flex items-center gap-2">
                                                    <FileText size={16} className="text-blue-500" />
                                                    Ticket Details <span className="text-xs font-normal text-zinc-400">(optional)</span>
                                                </label>
                                                <p className="text-xs text-zinc-500 mb-2">Instructions or reminders for attendees.</p>
                                                <textarea
                                                    className="w-full px-3 py-2 rounded-lg border border-zinc-200 dark:border-zinc-700 bg-white dark:bg-black text-sm resize-none"
                                                    rows={2}
                                                    placeholder="e.g., Bring valid ID. Doors open 30 min early."
                                                    value={formData.ticketDesign?.customMessage || ''}
                                                    onChange={e => setFormData({ ...formData, ticketDesign: { ...(formData.ticketDesign || {}), customMessage: e.target.value } })}
                                                />
                                            </div>

                                            {/* Save as My Template */}
                                            <button
                                                type="button"
                                                onClick={async () => {
                                                    const templateName = prompt('Give your template a name:', `My Template ${(currentUser?.savedTicketTemplates?.length || 0) + 1}`);
                                                    if (!templateName) return;
                                                    
                                                    const newTemplate = {
                                                        id: `custom_${Date.now()}`,
                                                        name: templateName,
                                                        createdAt: Date.now(),
                                                        design: {
                                                            logoUrl: formData.ticketDesign?.logoUrl || '',
                                                            backgroundColor: formData.ticketDesign?.backgroundColor || '#ffffff',
                                                            textColor: formData.ticketDesign?.textColor || '#000000',
                                                            accentColor: formData.ticketDesign?.accentColor || '#8b5cf6',
                                                            customMessage: formData.ticketDesign?.customMessage || '',
                                                        }
                                                    };
                                                    
                                                    const existingTemplates = currentUser?.savedTicketTemplates || [];
                                                    const updated = [...existingTemplates, newTemplate];
                                                    
                                                    await StorageService.updateUser(currentUser!.id, { savedTicketTemplates: updated });
                                                    setCurrentUser({ ...currentUser!, savedTicketTemplates: updated });
                                                    
                                                    // Select the new template
                                                    setFormData({ ...formData, ticketDesign: { ...(formData.ticketDesign || {}), template: newTemplate.id } });
                                                    
                                                    window.alert(`Template "${templateName}" saved! You can now use it for future events.`);
                                                }}
                                                className="w-full py-3 px-4 bg-gradient-to-r from-pink-500 to-purple-500 hover:from-pink-600 hover:to-purple-600 text-white rounded-xl font-bold text-sm flex items-center justify-center gap-2 transition-all shadow-lg shadow-purple-500/20"
                                            >
                                                <Heart size={16} /> Save as My Template
                                            </button>
                                        </div>
                                        
                                        {/* Right: Live Preview */}
                                        <div className="bg-zinc-100 dark:bg-zinc-900 rounded-xl p-4 flex items-center justify-center border border-zinc-200 dark:border-zinc-800 min-h-[300px]">
                                            {(() => {
                                                const defaultTemplates: Record<string, { gradient: string; bg: string; text: string }> = {
                                                    modern: { gradient: 'from-purple-500 to-indigo-600', bg: 'bg-white dark:bg-zinc-800', text: 'text-zinc-900 dark:text-white' },
                                                    classic: { gradient: 'from-zinc-800 to-zinc-900', bg: 'bg-zinc-900', text: 'text-white' },
                                                    minimal: { gradient: 'from-zinc-100 to-zinc-200', bg: 'bg-white', text: 'text-zinc-900' },
                                                    festive: { gradient: 'from-pink-500 to-orange-400', bg: 'bg-pink-50', text: 'text-pink-900' },
                                                };
                                                
                                                const templateId = formData.ticketDesign?.template || 'modern';
                                                const isCustomTemplate = templateId.startsWith('custom_');
                                                
                                                // For custom templates, use the stored colors
                                                let t = defaultTemplates[templateId] || defaultTemplates.modern;
                                                let headerStyle: React.CSSProperties = {};
                                                let bodyStyle: React.CSSProperties = {};
                                                
                                                if (isCustomTemplate) {
                                                    // Use inline styles for custom templates
                                                    headerStyle = { backgroundColor: formData.ticketDesign?.accentColor || '#8b5cf6' };
                                                    bodyStyle = { 
                                                        backgroundColor: formData.ticketDesign?.backgroundColor || '#ffffff',
                                                        color: formData.ticketDesign?.textColor || '#000000'
                                                    };
                                                    t = { gradient: '', bg: '', text: '' };
                                                }
                                                
                                                return (
                                                    <div 
                                                        className={`w-full max-w-[240px] rounded-xl shadow-xl overflow-hidden ${!isCustomTemplate ? t.bg : ''}`}
                                                        style={isCustomTemplate ? bodyStyle : {}}
                                                    >
                                                        {/* Ticket Header */}
                                                        <div 
                                                            className={`h-20 flex items-center justify-center p-3 ${!isCustomTemplate ? `bg-gradient-to-br ${t.gradient}` : ''}`}
                                                            style={isCustomTemplate ? headerStyle : {}}
                                                        >
                                                            {formData.ticketDesign?.logoUrl ? (
                                                                <img src={formData.ticketDesign.logoUrl} className="max-h-full max-w-full object-contain" alt="Ticket" />
                                                            ) : (
                                                                <span className="text-white/60 text-[10px] font-bold uppercase">Your Logo</span>
                                                            )}
                                                        </div>
                                                        
                                                        {/* Ticket Content */}
                                                        <div 
                                                            className={`p-3 text-center ${!isCustomTemplate ? t.text : ''}`}
                                                            style={isCustomTemplate ? bodyStyle : {}}
                                                        >
                                                            <div className="font-black text-sm leading-tight mb-0.5">{formData.title || 'Event Title'}</div>
                                                            <div className="text-[10px] opacity-60 mb-2">{formData.date || 'Date'} • {formData.location || 'Location'}</div>
                                                            
                                                            {/* Custom Message */}
                                                            {formData.ticketDesign?.customMessage && (
                                                                <div className="text-[9px] opacity-70 bg-black/5 p-1.5 rounded mb-2 line-clamp-2">
                                                                    {formData.ticketDesign.customMessage}
                                                                </div>
                                                            )}
                                                            
                                                            {/* QR Code */}
                                                            <div className="w-16 h-16 mx-auto bg-black/10 rounded-lg flex items-center justify-center">
                                                                <QrCode size={32} className="opacity-40" />
                                                            </div>
                                                            <div className="font-mono text-[8px] opacity-40 mt-1">#TICKET-12345</div>
                                                        </div>
                                                    </div>
                                                );
                                            })()}
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
                                                {formData.customFees?.map((fee, index) => fee && (
                                                    <div key={index} className="flex gap-2 mb-2">
                                                        <Input
                                                            placeholder="Name"
                                                            value={fee.name || ''}
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
                                                                value={fee.amount || ''}
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
                                                            value={fee.type || 'fixed'}
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
                                            <h3 className="font-bold text-sm uppercase text-zinc-500 mb-2 flex items-center gap-2"><Mail size={16} /> Email Notifications</h3>
                                            <p className="text-xs text-zinc-500 mb-4">Control which automated emails are sent to attendees. Emails use the visual template selected above. Customize content in Settings → Email Templates.</p>

                                            <div className="space-y-4">
                                                {/* Purchase Confirmation Email */}
                                                <div className="bg-zinc-50 dark:bg-zinc-900 p-4 rounded-xl border border-zinc-200 dark:border-zinc-800">
                                                    <div className="flex justify-between items-center">
                                                        <div className="flex items-start gap-3">
                                                            <div className="w-8 h-8 rounded-lg bg-green-100 dark:bg-green-900/30 flex items-center justify-center shrink-0">
                                                                <CheckCircle2 size={16} className="text-green-600 dark:text-green-400" />
                                                            </div>
                                                            <div>
                                                                <h4 className="font-bold text-sm">Purchase Confirmation</h4>
                                                                <p className="text-xs text-zinc-500">Sent when payment is successful (Stripe webhook).</p>
                                                            </div>
                                                        </div>
                                                        <Switch
                                                            checked={formData.emailSettings?.confirmationEnabled !== false}
                                                            onChange={c => setFormData({ ...formData, emailSettings: { ...(formData.emailSettings || {}), confirmationEnabled: c } })}
                                                        />
                                                    </div>
                                                </div>

                                                {/* Refund Confirmation Email */}
                                                <div className="bg-zinc-50 dark:bg-zinc-900 p-4 rounded-xl border border-zinc-200 dark:border-zinc-800">
                                                    <div className="flex justify-between items-center">
                                                        <div className="flex items-start gap-3">
                                                            <div className="w-8 h-8 rounded-lg bg-red-100 dark:bg-red-900/30 flex items-center justify-center shrink-0">
                                                                <DollarSign size={16} className="text-red-600 dark:text-red-400" />
                                                            </div>
                                                            <div>
                                                                <h4 className="font-bold text-sm">Refund Confirmation</h4>
                                                                <p className="text-xs text-zinc-500">Sent when a refund is processed (Stripe webhook).</p>
                                                            </div>
                                                        </div>
                                                        <Switch
                                                            checked={formData.emailSettings?.refundEnabled !== false}
                                                            onChange={c => setFormData({ ...formData, emailSettings: { ...(formData.emailSettings || {}), refundEnabled: c } })}
                                                        />
                                                    </div>
                                                </div>

                                                {/* Primary Reminder Email (24h) */}
                                                <div className="bg-zinc-50 dark:bg-zinc-900 p-4 rounded-xl border border-zinc-200 dark:border-zinc-800">
                                                    <div className="flex justify-between items-center">
                                                        <div className="flex items-start gap-3">
                                                            <div className="w-8 h-8 rounded-lg bg-blue-100 dark:bg-blue-900/30 flex items-center justify-center shrink-0">
                                                                <Clock size={16} className="text-blue-600 dark:text-blue-400" />
                                                            </div>
                                                            <div>
                                                                <h4 className="font-bold text-sm">Event Reminder (24 hours)</h4>
                                                                <p className="text-xs text-zinc-500">Sent 24 hours before event starts.</p>
                                                            </div>
                                                        </div>
                                                        <Switch
                                                            checked={formData.emailSettings?.reminderEnabled !== false}
                                                            onChange={c => setFormData({ ...formData, emailSettings: { ...(formData.emailSettings || {}), reminderEnabled: c } })}
                                                        />
                                                    </div>
                                                </div>

                                                {/* Secondary Reminder Email (Configurable) */}
                                                <div className="bg-zinc-50 dark:bg-zinc-900 p-4 rounded-xl border border-zinc-200 dark:border-zinc-800">
                                                    <div className="flex justify-between items-center">
                                                        <div className="flex items-start gap-3">
                                                            <div className="w-8 h-8 rounded-lg bg-orange-100 dark:bg-orange-900/30 flex items-center justify-center shrink-0">
                                                                <Clock size={16} className="text-orange-600 dark:text-orange-400" />
                                                            </div>
                                                            <div>
                                                                <h4 className="font-bold text-sm">Secondary Reminder</h4>
                                                                <p className="text-xs text-zinc-500">Additional reminder at a custom time before event.</p>
                                                            </div>
                                                        </div>
                                                        <Switch
                                                            checked={formData.reminderSettings?.secondaryEnabled || false}
                                                            onChange={c => setFormData({ ...formData, reminderSettings: { ...(formData.reminderSettings || {}), secondaryEnabled: c } })}
                                                        />
                                                    </div>
                                                    {formData.reminderSettings?.secondaryEnabled && (
                                                        <div className="mt-4 animate-in fade-in slide-in-from-top-2">
                                                            <label className="text-xs font-bold text-zinc-500 uppercase mb-2 block">Send reminder</label>
                                                            <select
                                                                className="w-full bg-white dark:bg-black border border-zinc-200 dark:border-zinc-700 rounded-lg px-3 py-2 text-sm"
                                                                value={formData.reminderSettings?.secondaryTime || '1h'}
                                                                onChange={(e: any) => setFormData({ ...formData, reminderSettings: { ...(formData.reminderSettings || {}), secondaryTime: e.target.value } })}
                                                            >
                                                                <option value="1h">1 hour before</option>
                                                                <option value="2h">2 hours before</option>
                                                                <option value="3h">3 hours before</option>
                                                                <option value="6h">6 hours before</option>
                                                                <option value="12h">12 hours before</option>
                                                                <option value="48h">2 days before</option>
                                                                <option value="72h">3 days before</option>
                                                                <option value="168h">1 week before</option>
                                                            </select>
                                                        </div>
                                                    )}
                                                </div>

                                                {/* Post-Event Thank You Email */}
                                                <div className="bg-zinc-50 dark:bg-zinc-900 p-4 rounded-xl border border-zinc-200 dark:border-zinc-800">
                                                    <div className="flex justify-between items-center">
                                                        <div className="flex items-start gap-3">
                                                            <div className="w-8 h-8 rounded-lg bg-purple-100 dark:bg-purple-900/30 flex items-center justify-center shrink-0">
                                                                <Heart size={16} className="text-purple-600 dark:text-purple-400" />
                                                            </div>
                                                            <div>
                                                                <h4 className="font-bold text-sm">Post-Event Thank You</h4>
                                                                <p className="text-xs text-zinc-500">Sent the morning after your event ends.</p>
                                                            </div>
                                                        </div>
                                                        <Switch
                                                            checked={formData.emailSettings?.postEventEnabled !== false}
                                                            onChange={c => setFormData({ ...formData, emailSettings: { ...(formData.emailSettings || {}), postEventEnabled: c } })}
                                                        />
                                                    </div>
                                                </div>

                                                {/* Abandoned Cart Email */}
                                                <div className="bg-zinc-50 dark:bg-zinc-900 p-4 rounded-xl border border-zinc-200 dark:border-zinc-800">
                                                    <div className="flex justify-between items-center">
                                                        <div className="flex items-start gap-3">
                                                            <div className="w-8 h-8 rounded-lg bg-amber-100 dark:bg-amber-900/30 flex items-center justify-center shrink-0">
                                                                <Target size={16} className="text-amber-600 dark:text-amber-400" />
                                                            </div>
                                                            <div>
                                                                <h4 className="font-bold text-sm">Abandoned Cart Recovery</h4>
                                                                <p className="text-xs text-zinc-500">Sent 24 hours after checkout started but not completed.</p>
                                                            </div>
                                                        </div>
                                                        <Switch
                                                            checked={formData.emailSettings?.abandonedCartEnabled !== false}
                                                            onChange={c => setFormData({ ...formData, emailSettings: { ...(formData.emailSettings || {}), abandonedCartEnabled: c } })}
                                                        />
                                                    </div>
                                                </div>

                                                {/* Info Note */}
                                                <div className="p-3 bg-blue-50 dark:bg-blue-900/20 rounded-lg border border-blue-200 dark:border-blue-800">
                                                    <p className="text-xs text-blue-700 dark:text-blue-300 flex items-start gap-2">
                                                        <Info size={14} className="shrink-0 mt-0.5" />
                                                        <span>All emails are sent from the backend based on Stripe webhooks and scheduled cron jobs. To customize email subject lines, text content, and footers, go to <strong>Settings → Email Templates</strong>.</span>
                                                    </p>
                                                </div>
                                            </div>

                                            {/* Email Preview Section */}
                                            <div className="mt-6 p-4 bg-gradient-to-br from-purple-50 to-blue-50 dark:from-purple-900/10 dark:to-blue-900/10 rounded-xl border border-purple-200 dark:border-purple-800">
                                                <div className="flex items-center justify-between mb-3">
                                                    <div>
                                                        <h4 className="font-bold text-sm flex items-center gap-2">
                                                            <Eye size={16} className="text-purple-600 dark:text-purple-400" />
                                                            Preview Your Emails
                                                        </h4>
                                                        <p className="text-xs text-zinc-600 dark:text-zinc-400 mt-1">
                                                            See how emails will look with your current ticket design
                                                        </p>
                                                    </div>
                                                    <Button
                                                        size="sm"
                                                        variant="secondary"
                                                        onClick={() => {
                                                            if (id) {
                                                                // If editing existing event, navigate to preview page
                                                                navigate(`/manage/${id}/email-preview`);
                                                            } else {
                                                                // If creating new event, show inline preview
                                                                setShowEmailPreview(true);
                                                            }
                                                        }}
                                                        className="flex items-center gap-2"
                                                    >
                                                        <Eye size={14} />
                                                        Preview
                                                    </Button>
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
                            {currentStep < 8 && (
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

            {/* Upgrade Plan Modal */}
            {upgradeModal.open && (
                <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/70 backdrop-blur-sm">
                    <div className="bg-zinc-900 border border-zinc-700 rounded-2xl p-6 max-w-md w-full mx-4 shadow-2xl">
                        <div className="flex items-center gap-3 mb-4">
                            <div className="w-12 h-12 rounded-xl bg-amber-500/20 flex items-center justify-center">
                                <AlertCircle size={24} className="text-amber-400" />
                            </div>
                            <h3 className="text-xl font-bold text-white">{upgradeModal.title}</h3>
                        </div>
                        
                        <p className="text-zinc-300 mb-4">{upgradeModal.message}</p>
                        
                        {upgradeModal.suggestedPlan && (
                            <div className="bg-zinc-800/50 rounded-xl p-4 mb-6">
                                <p className="text-sm text-zinc-400 mb-2">Recommended upgrade:</p>
                                <div className="flex items-center justify-between">
                                    <div>
                                        <span className="font-bold text-[#E0FF20] text-lg capitalize">{upgradeModal.suggestedPlan}</span>
                                        <span className="text-zinc-400 text-sm ml-2">
                                            {upgradeModal.suggestedPlan === 'pro' && '• Up to 1,000 tickets/event'}
                                            {upgradeModal.suggestedPlan === 'premium' && '• Up to 3,000 tickets/event'}
                                            {upgradeModal.suggestedPlan === 'enterprise' && '• Unlimited capacity'}
                                        </span>
                                    </div>
                                </div>
                            </div>
                        )}
                        
                        <div className="flex gap-3">
                            <Button
                                variant="outline"
                                onClick={() => setUpgradeModal({ ...upgradeModal, open: false })}
                                className="flex-1"
                            >
                                Cancel
                            </Button>
                            <Button
                                onClick={() => {
                                    setUpgradeModal({ ...upgradeModal, open: false });
                                    navigate('/pricing');
                                }}
                                className="flex-1 bg-[#E0FF20] hover:bg-[#c8e01c] text-black border-none font-bold"
                            >
                                View Plans
                            </Button>
                        </div>
                    </div>
                </div>
            )}

            {/* Email Preview Modal */}
            {showEmailPreview && (
                <div className="fixed inset-0 bg-black/50 z-[9999] flex items-center justify-center p-4" onClick={() => setShowEmailPreview(false)}>
                    <div className="bg-white dark:bg-zinc-900 rounded-xl shadow-2xl max-w-7xl w-full max-h-[90vh] overflow-auto" onClick={(e) => e.stopPropagation()}>
                        <div className="sticky top-0 bg-white dark:bg-zinc-900 border-b border-zinc-200 dark:border-zinc-800 px-6 py-4 flex items-center justify-between z-10">
                            <h2 className="text-xl font-bold">Email Preview</h2>
                            <Button
                                variant="ghost"
                                size="sm"
                                onClick={() => setShowEmailPreview(false)}
                                className="flex items-center gap-2"
                            >
                                <X size={20} />
                                Close
                            </Button>
                        </div>
                        <div className="p-6">
                            <EmailPreview 
                                event={formData as Event} 
                                embedded={true}
                            />
                        </div>
                    </div>
                </div>
            )}
        </div >
    );
};
