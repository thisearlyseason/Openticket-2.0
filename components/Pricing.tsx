
import React, { useState, useEffect } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { Check, Star, Shield, Zap, Heart, Clock, X, Gift } from 'lucide-react';
import { Button, Card, Badge } from './UI';
import { StorageService, PLANS } from '../services/storageService';
import { CurrencyService } from '../services/currencyService';
import { PlanType, Invoice } from '../types';
import { useConfirm } from './ConfirmContext';

export const Pricing = () => {
    const { confirm } = useConfirm();
    const [billingCycle, setBillingCycle] = useState<'monthly' | 'yearly'>('monthly');
    const [currency, setCurrency] = useState('USD');
    const [confirmModal, setConfirmModal] = useState<{
        show: boolean;
        plan: PlanType | null;
        priceUSD: number;
        priceLocal: number;
        currencySymbol: string;
        currencyCode: string;
    }>({ show: false, plan: null, priceUSD: 0, priceLocal: 0, currencySymbol: '$', currencyCode: 'USD' });
    const navigate = useNavigate();
    const [searchParams] = useSearchParams();
    const user = StorageService.getCurrentUser();
    // Only consider it a "current plan" if they are already an organizer.
    // If they are an attendee, they have no plan selected yet in this context.
    const currentPlan = user?.role === 'organizer' ? (user.subscription?.plan || 'free') : null;

    // Load currency preference
    useEffect(() => {
        const loadCurrency = () => {
            const curr = CurrencyService.getUserCurrency();
            setCurrency(curr);
        };
        loadCurrency();

        // Listen for currency changes
        window.addEventListener('currencyChanged', loadCurrency);
        window.addEventListener('storage', loadCurrency);
        return () => {
            window.removeEventListener('currencyChanged', loadCurrency);
            window.removeEventListener('storage', loadCurrency);
        };
    }, []);

    // Handle auto-selection returning from Auth
    useEffect(() => {
        const selectPlan = searchParams.get('select') as PlanType;
        if (selectPlan && user && selectPlan !== currentPlan) {
            handleSelectPlan(selectPlan);
            // Clear param to prevent loop
            navigate('/pricing', { replace: true });
        }
    }, [searchParams, user]);

    const handleSelectPlan = async (plan: PlanType) => {
        if (!user) {
            // Redirect to Auth with plan intent
            navigate(`/auth?plan=${plan}`);
            return;
        }

        if (plan === currentPlan) return;

        // Calculate price in USD
        let priceUSD = billingCycle === 'monthly' ? PLANS[plan].priceMonthly : PLANS[plan].priceYearly;

        // Apply Non-Profit Discount (20%) - applies to Pro and Premium plans
        const isNonprofitEligible = user.nonProfitStatus === 'approved' && (plan === 'pro' || plan === 'premium');
        if (isNonprofitEligible) {
            priceUSD = priceUSD * 0.80; // 20% discount
        }

        // Convert to local currency
        const currencyInfo = CurrencyService.getInfo(currency);
        const priceLocal = CurrencyService.convert(priceUSD, currency);

        // Show confirmation modal
        setConfirmModal({ 
            show: true, 
            plan, 
            priceUSD,
            priceLocal,
            currencySymbol: currencyInfo.symbol,
            currencyCode: currency
        });
    };

    const confirmPlanSelection = async () => {
        if (!confirmModal.plan || !user) return;
        
        const plan = confirmModal.plan;
        const price = confirmModal.priceUSD; // Stripe always charges in USD
        
        setConfirmModal({ show: false, plan: null, priceUSD: 0, priceLocal: 0, currencySymbol: '$', currencyCode: 'USD' });
        
        // --- STRIPE_INTEGRATION: Process Subscription Fee ---
        // This now redirects to Stripe. The Webhook handles the profile update and invoice creation.
        await StorageService.Stripe.processSubscriptionPayment(price, user.id, PLANS[plan].name, billingCycle);
        // No code after this, as we expect redirect.
    };

    const getPriceDisplay = (plan: keyof typeof PLANS) => {
        let priceUSD = billingCycle === 'monthly' ? PLANS[plan].priceMonthly : PLANS[plan].priceYearly;
        const currencyInfo = CurrencyService.getInfo(currency);
        const convertedPrice = CurrencyService.convert(priceUSD, currency);
        
        // Apply 20% nonprofit discount to Pro and Premium plans
        const isNonprofitEligible = user?.nonProfitStatus === 'approved' && (plan === 'pro' || plan === 'premium');
        if (isNonprofitEligible) {
            const discountedUSD = priceUSD * 0.80; // 20% discount
            const discountedConverted = CurrencyService.convert(discountedUSD, currency);
            return (
                <div className="flex flex-col items-center">
                    <span className="text-sm line-through text-gray-400 dark:text-zinc-500">
                        {currencyInfo.symbol}{convertedPrice.toFixed(0)} {currency}
                    </span>
                    <span className="font-bold">{currencyInfo.symbol}{discountedConverted.toFixed(0)} {currency}</span>
                    <span className="text-xs text-emerald-600 dark:text-emerald-400 font-semibold mt-1">
                        20% OFF
                    </span>
                </div>
            );
        }
        
        if (priceUSD === 0) return `${currencyInfo.symbol}0 ${currency}`;
        return `${currencyInfo.symbol}${convertedPrice.toFixed(0)} ${currency}`;
    };

    const isNonUSD = currency !== 'USD';
    const hasNonprofitDiscount = user?.nonProfitStatus === 'approved';

    return (
        <div className="max-w-7xl mx-auto py-12 px-4">

            {/* Nonprofit Promotional Banner */}
            {hasNonprofitDiscount && (
                <div className="mb-8 p-6 bg-gradient-to-r from-emerald-50 to-teal-50 dark:from-emerald-900/20 dark:to-teal-900/20 border-2 border-emerald-400 dark:border-emerald-600 rounded-2xl shadow-lg animate-in slide-in-from-top-4">
                    <div className="flex items-center gap-4">
                        <div className="p-3 bg-emerald-100 dark:bg-emerald-800 rounded-xl shrink-0">
                            <Gift className="text-emerald-600 dark:text-emerald-300" size={32} />
                        </div>
                        <div className="flex-1">
                            <h3 className="text-xl font-black text-emerald-900 dark:text-emerald-100 mb-1">
                                🎉 NON-PROFIT DISCOUNT ACTIVE
                            </h3>
                            <p className="text-emerald-800 dark:text-emerald-200 font-semibold">
                                Your non-profit status has been approved! Enjoy <span className="text-emerald-600 dark:text-emerald-400 font-black">20% OFF</span> Pro and Premium plans.
                            </p>
                        </div>
                        <div className="hidden sm:flex items-center justify-center bg-emerald-600 dark:bg-emerald-700 text-white px-6 py-3 rounded-xl font-black text-2xl shrink-0">
                            20% OFF
                        </div>
                    </div>
                </div>
            )}

            {user?.role === 'attendee' && (
                <div className="mb-8 p-4 bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 rounded-xl flex items-center gap-4 animate-in slide-in-from-top-4">
                    <div className="p-2 bg-blue-100 dark:bg-blue-800 rounded-lg shrink-0">
                        <Shield className="text-blue-600 dark:text-blue-300" size={24} />
                    </div>
                    <div>
                        <h3 className="font-bold text-blue-900 dark:text-blue-100">ATTENDEE ACCOUNT</h3>
                        <p className="text-sm text-blue-700 dark:text-blue-300">You are currently viewing this page as an Attendee. Select a plan below to upgrade your account to an <strong>Organizer</strong> and start creating events.</p>
                    </div>
                </div>
            )}

            <div className="text-center mb-12">
                <h1 className="text-5xl font-black text-gray-900 dark:text-white mb-4 uppercase font-display tracking-tight">
                    Plans & <span className="text-primary">Pricing</span>
                </h1>
                <p className="text-xl text-gray-500 dark:text-zinc-400 mb-8">Choose the perfect plan for your events.</p>

                {/* Currency Info - Only show for non-USD */}
                {isNonUSD && (
                    <div className="max-w-2xl mx-auto mb-8 p-4 bg-gradient-to-r from-blue-50 to-indigo-50 dark:from-blue-900/20 dark:to-indigo-900/20 border border-blue-200 dark:border-blue-800/50 rounded-2xl">
                        <p className="text-sm text-blue-800 dark:text-blue-200">
                            <span className="font-bold">Good news!</span> You'll be charged in {CurrencyService.getInfo(currency).name} ({currency}). 
                            Prices are converted using current exchange rates — Stripe handles the math so you don't have to.
                        </p>
                    </div>
                )}

                {/* Highlight Free Events Policy */}
                <div className="inline-block bg-gradient-to-r from-pink-500 via-purple-500 to-indigo-500 p-[2px] rounded-full mb-8 shadow-lg shadow-pink-500/30">
                    <div className="bg-black text-white px-6 py-2 rounded-full font-bold flex items-center gap-2 text-lg">
                        <Heart size={20} className="text-pink-500 fill-current animate-pulse" />
                        Free events are ALWAYS FREE!
                    </div>
                </div>

                <div className="flex justify-center mb-8">
                    <div className="inline-flex bg-zinc-100 dark:bg-zinc-900 p-1 rounded-full border border-zinc-200 dark:border-zinc-800">
                        <button
                            onClick={() => setBillingCycle('monthly')}
                            className={`px-6 py-2 rounded-full text-sm font-bold transition-all ${billingCycle === 'monthly' ? 'bg-white dark:bg-zinc-800 text-black dark:text-white shadow-md' : 'text-gray-500 hover:text-gray-900 dark:hover:text-white'}`}
                        >
                            Monthly
                        </button>
                        <button
                            onClick={() => setBillingCycle('yearly')}
                            className={`px-6 py-2 rounded-full text-sm font-bold transition-all flex items-center ${billingCycle === 'yearly' ? 'bg-white dark:bg-zinc-800 text-black dark:text-white shadow-md' : 'text-gray-500 hover:text-gray-900 dark:hover:text-white'}`}
                        >
                            Yearly <Badge color="green" className="ml-2 text-[10px] px-1 py-0 h-5 flex items-center">SAVE 20%</Badge>
                        </button>
                    </div>
                </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-8">

                {/* FREE PLAN */}
                <Card className="p-8 border-zinc-200 dark:border-zinc-800 relative hover:-translate-y-2 transition-transform duration-300">
                    <div className="mb-6">
                        <h3 className="text-xl font-bold text-gray-900 dark:text-white mb-2">{PLANS.free.name}</h3>
                        <div className="text-4xl font-black text-gray-900 dark:text-white">$0<span className="text-sm font-medium text-gray-500">/mo</span></div>
                        <p className="text-sm text-gray-500 mt-2">For small events & meetups.</p>
                    </div>
                    <div className="space-y-4 mb-8 border-t border-zinc-100 dark:border-zinc-800 pt-6">
                        <div className="flex items-start font-bold text-zinc-900 dark:text-white">
                            <Check size={18} className="text-green-500 mr-2 mt-0.5 shrink-0" />
                            <span>50 Tickets / Event</span>
                        </div>
                        <div className="flex items-start text-zinc-600 dark:text-zinc-400">
                            <Check size={18} className="text-green-500 mr-2 mt-0.5 shrink-0" />
                            <span>3 Events / Month</span>
                        </div>
                        <div className="flex items-start text-zinc-600 dark:text-zinc-400">
                            <Check size={18} className="text-green-500 mr-2 mt-0.5 shrink-0" />
                            <span>Platform Donation Button</span>
                        </div>
                        <div className="flex items-start text-zinc-600 dark:text-zinc-400">
                            <Check size={18} className="text-green-500 mr-2 mt-0.5 shrink-0" />
                            <span>Offline Payments Allowed</span>
                        </div>
                        <div className="flex items-start text-zinc-600 dark:text-zinc-400">
                            <Check size={18} className="mr-2 mt-0.5 shrink-0 opacity-50" />
                            <span className="text-sm">2.75% + $0.99 per Ticket</span>
                        </div>
                    </div>
                    <Button
                        onClick={() => handleSelectPlan('free')}
                        variant={currentPlan === 'free' ? 'outline' : 'primary'}
                        className="w-full"
                        disabled={currentPlan === 'free'}
                    >
                        {currentPlan === 'free' ? 'Current Plan' : 'Get Started'}
                    </Button>
                </Card>

                {/* PRO PLAN */}
                <Card className="p-8 border-primary relative shadow-[0_0_30px_rgba(236,72,153,0.15)] md:scale-105 z-10 bg-white dark:bg-zinc-900">
                    <div className="absolute top-0 left-1/2 -translate-x-1/2 bg-primary text-white text-xs font-bold px-3 py-1 rounded-b-lg shadow-sm">
                        MOST POPULAR
                    </div>
                    {hasNonprofitDiscount && (
                        <div className="absolute top-0 right-4 bg-gradient-to-r from-emerald-500 to-teal-500 text-white text-xs font-black px-3 py-1.5 rounded-b-lg shadow-lg flex items-center gap-1">
                            <Gift size={12} />
                            20% OFF
                        </div>
                    )}
                    <div className="mb-6 mt-2">
                        <h3 className="text-xl font-bold text-primary mb-2 flex items-center gap-2"><Star size={20} fill="currentColor" /> {PLANS.pro.name}</h3>
                        <div className="text-4xl font-black text-gray-900 dark:text-white flex items-end">
                            {getPriceDisplay('pro')}
                            <span className="text-sm font-medium text-gray-500 mb-1 ml-1">/{billingCycle === 'monthly' ? 'mo' : 'yr'}</span>
                        </div>
                        <p className="text-sm text-gray-500 mt-2">For growing organizations.</p>
                    </div>
                    <div className="space-y-4 mb-8 border-t border-zinc-100 dark:border-zinc-800 pt-6">
                        <div className="flex items-start font-bold text-zinc-900 dark:text-white">
                            <Check size={18} className="text-primary mr-2 mt-0.5 shrink-0" />
                            <span>250 Tickets / Event</span>
                        </div>
                        <div className="flex items-start font-bold text-zinc-900 dark:text-white">
                            <Check size={18} className="text-primary mr-2 mt-0.5 shrink-0" />
                            <span>10 Events / Month</span>
                        </div>
                        <div className="flex items-start text-zinc-600 dark:text-zinc-400">
                            <Check size={18} className="text-primary mr-2 mt-0.5 shrink-0" />
                            <span>Optional Donation Button</span>
                        </div>
                        <div className="flex items-start text-zinc-600 dark:text-zinc-400">
                            <Check size={18} className="text-primary mr-2 mt-0.5 shrink-0" />
                            <span>Advanced Analytics</span>
                        </div>
                        <div className="flex items-start text-zinc-600 dark:text-zinc-400">
                            <Check size={18} className="text-primary mr-2 mt-0.5 shrink-0" />
                            <span className="text-sm font-bold text-primary">1.5% + $0.75 per Ticket</span>
                        </div>
                    </div>
                    <Button
                        onClick={() => handleSelectPlan('pro')}
                        className="w-full shadow-lg shadow-primary/25"
                        disabled={currentPlan === 'pro'}
                    >
                        {currentPlan === 'pro' ? 'Current Plan' : 'Upgrade to Pro'}
                    </Button>
                </Card>

                {/* PREMIUM PLAN */}
                <Card className="p-8 border-zinc-200 dark:border-zinc-800 bg-gradient-to-br from-zinc-50 to-white dark:from-zinc-900 dark:to-black relative hover:-translate-y-2 transition-transform duration-300">
                    <div className="mb-6">
                        <h3 className="text-xl font-bold text-purple-500 mb-2 flex items-center gap-2"><Zap size={20} fill="currentColor" /> {PLANS.premium.name}</h3>
                        <div className="text-4xl font-black text-gray-900 dark:text-white flex items-end">
                            {getPriceDisplay('premium')}
                            <span className="text-sm font-medium text-gray-500 mb-1 ml-1">/{billingCycle === 'monthly' ? 'mo' : 'yr'}</span>
                        </div>
                        <p className="text-sm text-gray-500 mt-2">Maximum power & branding.</p>
                    </div>
                    <div className="space-y-4 mb-8 border-t border-zinc-100 dark:border-zinc-800 pt-6">
                        <div className="flex items-start font-bold text-zinc-900 dark:text-white">
                            <Check size={18} className="text-purple-500 mr-2 mt-0.5 shrink-0" />
                            <span>Unlimited Tickets</span>
                        </div>
                        <div className="flex items-start font-bold text-zinc-900 dark:text-white">
                            <Check size={18} className="text-purple-500 mr-2 mt-0.5 shrink-0" />
                            <span>Unlimited Events</span>
                        </div>
                        <div className="flex items-start text-zinc-600 dark:text-zinc-300">
                            <Check size={18} className="text-purple-500 mr-2 mt-0.5 shrink-0" />
                            <span>Dedicated Priority Support</span>
                        </div>
                        <div className="flex items-start text-zinc-500 dark:text-zinc-400">
                            <Clock size={18} className="text-amber-500 mr-2 mt-0.5 shrink-0" />
                            <span>White Labeling <span className="text-xs bg-amber-100 dark:bg-amber-900/30 text-amber-700 dark:text-amber-400 px-2 py-0.5 rounded-full ml-1">Coming Soon</span></span>
                        </div>
                        <div className="flex items-start text-zinc-500 dark:text-zinc-400">
                            <Clock size={18} className="text-amber-500 mr-2 mt-0.5 shrink-0" />
                            <span>Custom Domain <span className="text-xs bg-amber-100 dark:bg-amber-900/30 text-amber-700 dark:text-amber-400 px-2 py-0.5 rounded-full ml-1">Coming Soon</span></span>
                        </div>
                        <div className="flex items-start">
                            <Check size={18} className="text-purple-500 mr-2 mt-0.5 shrink-0" />
                            <span className="text-sm text-green-600 dark:text-secondary font-bold">0.75% + $0.30 Ticket Fees</span>
                        </div>
                    </div>
                    <Button
                        onClick={() => handleSelectPlan('premium')}
                        variant="outline"
                        className="w-full border-purple-500 text-purple-500 hover:bg-purple-50 dark:hover:bg-purple-900/20"
                        disabled={currentPlan === 'premium'}
                    >
                        {currentPlan === 'premium' ? 'Current Plan' : 'Go Premium'}
                    </Button>
                </Card>

            </div>

            {/* Currency Notice */}
            <div className={`mt-8 text-center ${isNonUSD ? 'mb-4' : ''}`}>
                {isNonUSD && (
                    <div className="inline-flex items-center gap-2 px-4 py-2 bg-blue-600 dark:bg-blue-500 text-white rounded-full text-sm font-bold mb-4">
                        <span>💳</span> Charged in {currency}
                    </div>
                )}
                <p className="text-xs text-zinc-500 dark:text-zinc-400">
                    * Standard credit card processing fees (2.9% + $0.30) apply to all paid online ticket sales via Stripe. Platform fees are separate.
                    {!isNonUSD && <span className="block mt-1">All prices shown in USD.</span>}
                </p>
                {user?.businessType === 'nonprofit' && user.nonProfitStatus !== 'approved' && (
                    <div className="mt-4 p-4 bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 rounded-xl text-center text-sm text-blue-800 dark:text-blue-200 inline-block">
                        <span className="font-bold">Non-Profit Status Pending:</span> Once approved, you will see 20% off Pro pricing here.
                    </div>
                )}
            </div>

            {/* Confirmation Modal */}
            {confirmModal.show && confirmModal.plan && (
                <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/70 backdrop-blur-sm">
                    <div className="bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-700 rounded-2xl p-6 max-w-md w-full mx-4 shadow-2xl">
                        <div className="flex justify-between items-start mb-4">
                            <h3 className="text-xl font-bold text-zinc-900 dark:text-white">
                                Confirm Subscription
                            </h3>
                            <button 
                                onClick={() => setConfirmModal({ show: false, plan: null, priceUSD: 0, priceLocal: 0, currencySymbol: '$', currencyCode: 'USD' })}
                                className="text-zinc-400 hover:text-zinc-600"
                            >
                                <X size={24} />
                            </button>
                        </div>
                        <div className="bg-zinc-50 dark:bg-zinc-800 rounded-xl p-4 mb-6">
                            <p className="text-zinc-600 dark:text-zinc-300 mb-2">
                                You're upgrading to:
                            </p>
                            <p className="text-2xl font-bold text-zinc-900 dark:text-white">
                                {PLANS[confirmModal.plan].name} Plan
                            </p>
                            <p className="text-sm text-zinc-500 mt-1">
                                Billed {billingCycle}
                            </p>
                        </div>
                        <div className="flex justify-between items-center mb-4 pb-4 border-b border-zinc-200 dark:border-zinc-700">
                            <span className="text-zinc-600 dark:text-zinc-400">Total due now:</span>
                            <div className="text-right">
                                <span className="text-2xl font-bold text-[#E0FF20]">
                                    {confirmModal.currencySymbol}{confirmModal.priceLocal.toFixed(2)} {confirmModal.currencyCode}
                                </span>
                                {confirmModal.currencyCode !== 'USD' && (
                                    <p className="text-xs text-zinc-500">
                                        ≈ ${confirmModal.priceUSD.toFixed(2)} USD
                                    </p>
                                )}
                            </div>
                        </div>
                        {user?.nonProfitStatus === 'approved' && (confirmModal.plan === 'pro' || confirmModal.plan === 'premium') && (
                            <div className="mb-4 p-4 bg-gradient-to-r from-emerald-50 to-teal-50 dark:from-emerald-900/20 dark:to-teal-900/20 border-2 border-emerald-400 dark:border-emerald-600 rounded-lg">
                                <div className="flex items-center gap-2">
                                    <Gift size={20} className="text-emerald-600 dark:text-emerald-400" />
                                    <p className="text-sm font-bold text-emerald-800 dark:text-emerald-200">
                                        ✓ Non-Profit Discount (20% OFF) Applied
                                    </p>
                                </div>
                                <p className="text-xs text-emerald-700 dark:text-emerald-300 mt-1">
                                    Promotional pricing is already reflected in the amount above
                                </p>
                            </div>
                        )}
                        <div className="flex gap-3">
                            <button
                                onClick={() => setConfirmModal({ show: false, plan: null, priceUSD: 0, priceLocal: 0, currencySymbol: '$', currencyCode: 'USD' })}
                                className="flex-1 bg-zinc-200 dark:bg-zinc-700 hover:bg-zinc-300 dark:hover:bg-zinc-600 text-zinc-800 dark:text-white font-bold py-3 px-4 rounded-xl"
                            >
                                Cancel
                            </button>
                            <button
                                onClick={confirmPlanSelection}
                                className="flex-1 bg-[#E0FF20] hover:bg-[#c8e01c] text-black font-bold py-3 px-4 rounded-xl"
                            >
                                Continue to Payment
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
};
