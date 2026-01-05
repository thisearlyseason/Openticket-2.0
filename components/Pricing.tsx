
import React, { useState, useEffect } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { Check, Star, Shield, Zap, Heart } from 'lucide-react';
import { Button, Card, Badge } from './UI';
import { StorageService, PLANS } from '../services/storageService';
import { PlanType, Invoice } from '../types';

export const Pricing = () => {
    const [billingCycle, setBillingCycle] = useState<'monthly' | 'yearly'>('monthly');
    const navigate = useNavigate();
    const [searchParams] = useSearchParams();
    const user = StorageService.getCurrentUser();
    // Only consider it a "current plan" if they are already an organizer.
    // If they are an attendee, they have no plan selected yet in this context.
    const currentPlan = user?.role === 'organizer' ? (user.subscription?.plan || 'free') : null;

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

        // Simulate Payment / Upgrade
        let price = billingCycle === 'monthly' ? PLANS[plan].priceMonthly : PLANS[plan].priceYearly;

        // Apply Non-Profit Discount (25%)
        if (user.nonProfitStatus === 'approved' && plan === 'pro') {
            price = price * 0.75;
        }

        if (confirm(`Confirm switch to ${PLANS[plan].name} plan?\n\nTotal due now: $${price.toFixed(2)} CAD`)) {
            // --- STRIPE_INTEGRATION: Process Subscription Fee ---
            // This now redirects to Stripe. The Webhook handles the profile update and invoice creation.
            await StorageService.Stripe.processSubscriptionPayment(price, user.id, PLANS[plan].name, billingCycle);
            // No code after this, as we expect redirect.
        }
    };

    const getPriceDisplay = (plan: keyof typeof PLANS) => {
        let price = billingCycle === 'monthly' ? PLANS[plan].priceMonthly : PLANS[plan].priceYearly;
        if (user?.nonProfitStatus === 'approved' && plan === 'pro') {
            return (
                <div className="flex flex-col items-center">
                    <span className="text-sm line-through text-gray-400 dark:text-zinc-500">${price.toFixed(0)}</span>
                    <span>${(price * 0.75).toFixed(0)}</span>
                </div>
            );
        }
        return `$${price}`;
    };

    return (
        <div className="max-w-7xl mx-auto py-12 px-4">

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
                            <span>Unlimited Events</span>
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
                            <span className="text-sm text-green-600 dark:text-secondary font-bold">0.75% Ticket Fees</span>
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

            <div className="mt-8 text-center">
                <p className="text-xs text-zinc-500 dark:text-zinc-400">
                    * Standard credit card processing fees (2.9% + $0.30) apply to all paid online ticket sales via Stripe. Platform fees are separate.
                </p>
                {user?.businessType === 'nonprofit' && user.nonProfitStatus !== 'approved' && (
                    <div className="mt-4 p-4 bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 rounded-xl text-center text-sm text-blue-800 dark:text-blue-200 inline-block">
                        <span className="font-bold">Non-Profit Status Pending:</span> Once approved, you will see 25% off Pro pricing here.
                    </div>
                )}
            </div>
        </div>
    );
};
