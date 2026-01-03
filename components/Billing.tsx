
import React, { useState, useEffect } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { CreditCard, Calendar, Package, Download, Plus, Trash2, AlertCircle, DollarSign, ArrowRight, Zap, Banknote, Clock, Wallet, FileText, CheckCircle2, Edit2, ChevronRight, Settings, Save, ExternalLink, RefreshCw, XCircle, Loader2 } from 'lucide-react';
import { Button, Card, Badge, Input, Select } from './UI';
import { StorageService, PLANS } from '../services/storageService';
import { Registration, Event } from '../types';
import { useGlobalUI } from './GlobalUIProvider';

export const Billing = () => {
    const navigate = useNavigate();
    const location = useLocation();
    const { showToast } = useGlobalUI();
    const [showAddCard, setShowAddCard] = useState(false);

    // Stripe Connect State
    const [stripeStatus, setStripeStatus] = useState<{
        connected: boolean;
        accountId: string | null;
        chargesEnabled: boolean;
        payoutsEnabled: boolean;
        detailsSubmitted: boolean;
    }>({ connected: false, accountId: null, chargesEnabled: false, payoutsEnabled: false, detailsSubmitted: false });
    const [isLoadingStripeStatus, setIsLoadingStripeStatus] = useState(true);
    const [isConnecting, setIsConnecting] = useState(false);

    const [newCardData, setNewCardData] = useState({ number: '', expiry: '', cvc: '', name: '' });

    const [payoutMode, setPayoutMode] = useState<'standard' | 'instant'>('standard');
    const [isProcessingPayout, setIsProcessingPayout] = useState(false);
    const [isPayingBalance, setIsPayingBalance] = useState(false);

    // Ledger State
    const [ledger, setLedger] = useState<{ reg: Registration, event: Event }[]>([]);
    const [isLoadingLedger, setIsLoadingLedger] = useState(true);

    // Financial Summary State
    const [financialSummary, setFinancialSummary] = useState<{
        grossRevenue: number;
        stripeFees: number;
        platformFees: number;
        organizerNet: number;
        transactionCount: number;
    }>({ grossRevenue: 0, stripeFees: 0, platformFees: 0, organizerNet: 0, transactionCount: 0 });

    const user = StorageService.getCurrentUser();

    // Handle Stripe redirect parameters
    useEffect(() => {
        const hash = location.hash;
        if (hash.includes('stripe_success=true')) {
            showToast('Stripe account connected successfully!', 'success');
            // Refresh status
            loadStripeStatus();
            // Clean URL
            window.history.replaceState(null, '', '/#/billing');
        } else if (hash.includes('stripe_refresh=true')) {
            showToast('Please complete your Stripe onboarding.', 'warning');
            window.history.replaceState(null, '', '/#/billing');
        }
    }, [location]);

    const loadStripeStatus = async () => {
        setIsLoadingStripeStatus(true);
        try {
            const status = await StorageService.getStripeConnectStatus();
            setStripeStatus(status);
        } catch (error) {
            console.error('Failed to load Stripe status:', error);
        } finally {
            setIsLoadingStripeStatus(false);
        }
    };

    useEffect(() => {
        const loadLedger = async () => {
            if (!user) return;
            const allEvents = await StorageService.getEvents();
            const myEvents = allEvents.filter(e => e.ownerId === user.id);

            // SECURITY FIX: Fetch registrations per event to avoid 403 on getAllRegistrations
            const regsPromises = myEvents.map(evt => StorageService.getRegistrations(evt.id));
            const regsArrays = await Promise.all(regsPromises);

            const mySales: { reg: Registration, event: Event }[] = [];

            myEvents.forEach((evt, index) => {
                const evtRegs = regsArrays[index] || [];
                evtRegs.forEach(reg => mySales.push({ reg, event: evt }));
            });

            // Sort by date desc
            setLedger(mySales.sort((a, b) => b.reg.timestamp - a.reg.timestamp));
            setIsLoadingLedger(false);
        };
        loadLedger();
        loadStripeStatus();
    }, [user?.id]);

    if (!user || user.role !== 'organizer') {
        return (
            <div className="p-8 text-center">
                <h2 className="text-2xl font-bold">Access Denied</h2>
                <p>Only organizers can manage billing.</p>
                <Button onClick={() => navigate('/')} className="mt-4">Go Home</Button>
            </div>
        );
    }

    const sub = user.subscription || { plan: 'free', cycle: 'monthly', status: 'active', nextBillingDate: Date.now() };
    const planDetails = PLANS[sub.plan as keyof typeof PLANS];
    const balanceDue = user.balanceDue || 0;
    const availablePayout = user.availablePayout || 0;

    const netPayoutAvailable = Math.max(0, availablePayout - balanceDue);

    const instantFee = netPayoutAvailable * 0.015;
    const instantNet = netPayoutAvailable - instantFee;

    const handleConnectStripe = async () => {
        setIsConnecting(true);
        try {
            await StorageService.connectStripeAccount(user.id, 'express');
            // Stripe opens in new tab
            showToast('Stripe onboarding opened in a new tab. Complete the setup there, then refresh this page.', 'success');
            setIsConnecting(false);
        } catch (error: any) {
            showToast(error.message || 'Failed to connect Stripe', 'error');
            setIsConnecting(false);
        }
    };

    const handleCompleteOnboarding = async () => {
        setIsConnecting(true);
        try {
            await StorageService.createStripeOnboardingLink();
            // Stripe opens in new tab
            showToast('Stripe onboarding opened in a new tab. Complete the setup there, then refresh this page.', 'success');
            setIsConnecting(false);
        } catch (error: any) {
            showToast(error.message || 'Failed to create onboarding link', 'error');
            setIsConnecting(false);
        }
    };

    const handleOpenDashboard = async () => {
        try {
            await StorageService.openStripeDashboard();
        } catch (error: any) {
            showToast(error.message || 'Failed to open dashboard', 'error');
        }
    };

    const handleDisconnect = async () => {
        if (!confirm('Are you sure you want to disconnect your Stripe account? You will need to reconnect to receive payouts.')) {
            return;
        }
        try {
            await StorageService.disconnectStripeAccount();
            showToast('Stripe account disconnected', 'success');
            loadStripeStatus();
        } catch (error: any) {
            showToast(error.message || 'Failed to disconnect', 'error');
        }
    };

    const handleAddDebitCard = (e: React.FormEvent) => {
        e.preventDefault();
        const last4 = newCardData.number.slice(-4) || '4242';
        const [month, year] = newCardData.expiry.split('/').map(Number);

        StorageService.Payment.addInstantCard(user.id, {
            last4: last4,
            brand: 'Visa',
            expMonth: month || 12,
            expYear: year || 2030
        });

        setShowAddCard(false);
        showToast('Debit card added for instant payouts!', 'success');
        window.location.reload();
    };

    const handlePayBalance = async () => {
        setIsPayingBalance(true);
        try {
            const success = await StorageService.Payment.payOutstandingBalance(user.id);
            if (success) {
                showToast('Payment successful! Balance cleared.', 'success');
                window.location.reload();
            } else {
                showToast('Payment failed. Please check your payment method.', 'error');
            }
        } catch (e: any) {
            console.error("Payment Error:", e);
            showToast(`An unexpected error occurred: ${e.message || "Unknown error"}`, 'error');
        } finally {
            setIsPayingBalance(false);
        }
    };

    const handleRequestPayout = () => {
        if (netPayoutAvailable <= 0) return;
        if (payoutMode === 'instant' && !user.payoutSettings?.instantCard) {
            setShowAddCard(true);
            return;
        }
        setIsProcessingPayout(true);

        (async () => {
            const result = await StorageService.Payment.requestPayout(user.id, payoutMode);
            if (result.success) {
                showToast(
                    payoutMode === 'instant'
                        ? `⚡ Payout of $${result.amount.toFixed(2)} sent! Fee: $${result.fee.toFixed(2)}`
                        : `Payout of $${result.amount.toFixed(2)} requested successfully.`,
                    'success'
                );
                window.location.reload();
            } else {
                showToast('Payout failed.', 'error');
            }
            setIsProcessingPayout(false);
        })();
    };

    const exportLedgerCSV = () => {
        const headers = ['Date', 'Order ID', 'Event', 'Buyer', 'Email', 'Gross Amount', 'Net (Est)', 'Status'];
        const rows = ledger.map(item => {
            const r = item.reg;
            const isCancelled = r.paymentStatus === 'refunded';

            let gross = 0;
            let net = 0;

            if (!isCancelled) {
                gross = (r.tickets?.reduce((acc, t) => acc + (t.pricePerTicket * t.quantity), 0) || 0)
                    + (r.donationAmount || 0)
                    + (r.addOns?.reduce((acc, a) => acc + (a.price * a.quantity), 0) || 0)
                    + (r.taxAmount || 0)
                    + (r.customFeesAmount || 0);

                net = gross - (r.serviceFee || 0);
            }

            return [
                new Date(r.timestamp).toLocaleDateString(),
                r.id,
                item.event.title,
                r.attendeeName,
                r.attendeeEmail,
                isCancelled ? '0.00' : gross.toFixed(2),
                isCancelled ? '0.00' : net.toFixed(2),
                isCancelled ? 'CANCELLED' : r.paymentStatus
            ];
        });

        const csvContent = "data:text/csv;charset=utf-8," + [headers, ...rows].map(e => e.join(",")).join("\n");
        const encodedUri = encodeURI(csvContent);
        const link = document.createElement("a");
        link.setAttribute("href", encodedUri);
        link.setAttribute("download", `transaction_ledger_${new Date().toISOString().split('T')[0]}.csv`);
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
    };

    const downloadTransaction = (item: { reg: Registration, event: Event }) => {
        const r = item.reg;
        const isCancelled = r.paymentStatus === 'refunded';
        let gross = 0;

        if (!isCancelled) {
            gross = (r.tickets?.reduce((acc, t) => acc + (t.pricePerTicket * t.quantity), 0) || 0)
                + (r.donationAmount || 0)
                + (r.addOns?.reduce((acc, a) => acc + (a.price * a.quantity), 0) || 0)
                + (r.taxAmount || 0)
                + (r.customFeesAmount || 0);
        }

        const headers = ['Date', 'Order ID', 'Event', 'Buyer', 'Email', 'Gross Amount', 'Status'];
        const row = [
            new Date(r.timestamp).toLocaleDateString(),
            r.id,
            item.event.title,
            r.attendeeName,
            r.attendeeEmail,
            isCancelled ? '0.00' : gross.toFixed(2),
            r.paymentStatus
        ];

        const csvContent = "data:text/csv;charset=utf-8," + [headers, row].map(e => e.join(",")).join("\n");
        const encodedUri = encodeURI(csvContent);
        const link = document.createElement("a");
        link.setAttribute("href", encodedUri);
        link.setAttribute("download", `transaction_${r.id}.csv`);
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
    };

    // Stripe Connect status rendering
    const renderStripeConnect = () => {
        if (isLoadingStripeStatus) {
            return (
                <div className="bg-[#635BFF] p-6 rounded-3xl text-white shadow-lg shadow-[#635BFF]/30">
                    <div className="flex items-center justify-center gap-2 py-8">
                        <Loader2 className="animate-spin" size={24} />
                        <span>Loading Stripe status...</span>
                    </div>
                </div>
            );
        }

        const isFullyActive = stripeStatus.connected && stripeStatus.chargesEnabled && stripeStatus.payoutsEnabled;
        const needsOnboarding = stripeStatus.connected && (!stripeStatus.chargesEnabled || !stripeStatus.payoutsEnabled);

        return (
            <div className="bg-[#635BFF] p-6 rounded-3xl text-white shadow-lg shadow-[#635BFF]/30 transition-all">
                <div className="flex justify-between items-start mb-4">
                    <div>
                        <h3 className="font-bold text-xl mb-1 flex items-center gap-2">
                            <svg viewBox="0 0 60 25" xmlns="http://www.w3.org/2000/svg" width="60" height="25" className="fill-white">
                                <path d="M59.64 14.28h-8.06c.19 1.93 1.6 2.55 3.2 2.55 1.64 0 2.96-.37 4.05-.95v3.32a8.33 8.33 0 0 1-4.56 1.1c-4.01 0-6.83-2.5-6.83-7.48 0-4.19 2.39-7.52 6.3-7.52 3.92 0 5.96 3.28 5.96 7.5 0 .4-.02.75-.06 1.48zm-5.92-5.62c-1.03 0-2.17.73-2.17 2.58h4.25c0-1.85-1.07-2.58-2.08-2.58zM40.95 20.3c-1.44 0-2.32-.6-2.9-1.04l-.02 4.63-4.12.87V5.57h3.76l.08 1.02a4.7 4.7 0 0 1 3.23-1.29c2.9 0 5.62 2.6 5.62 7.4 0 5.23-2.7 7.6-5.65 7.6zM40 9.16c-.95 0-1.54.34-1.97.81l.02 6.12c.4.44.98.78 1.95.78 1.52 0 2.54-1.65 2.54-3.87 0-2.15-1.04-3.84-2.54-3.84zM28.24 5.57h4.13v14.44h-4.13V5.57zm0-5.13L32.37 0v3.77l-4.13.88V.44zm-4.32 9.35v10.22H19.8V5.57h3.7l.12 1.22c1-1.77 3.07-1.41 3.62-1.22v3.79c-.52-.17-2.29-.45-3.32.43zm-8.55 4.72c0 2.43 2.6 1.68 3.12 1.46v3.36c-.55.3-1.54.54-2.89.54a4.15 4.15 0 0 1-4.27-4.24l.01-10.44-4.3.92V5.57h4.3V2.35l4.03-.85v4.07h3.12v3.2l-3.12.02v5.72zm-7.3.82c0 2.2.5 3.16 1.8 3.16.8 0 1.22-.09 2.08-.35v3.33c-.88.37-1.85.5-2.9.5-3.37 0-5.07-1.87-5.07-5.71V5.57h4.08v9.76zm-8.37-4.97h5.4v3.78h-5.4v-3.78z" fillRule="evenodd"/>
                            </svg>
                            <span className="ml-1">Connect</span>
                        </h3>
                        <p className="text-white/80 text-sm">Automated payouts for ticket sales.</p>
                    </div>
                    {isFullyActive && (
                        <button 
                            onClick={handleOpenDashboard}
                            className="text-xs bg-white/20 hover:bg-white/30 px-3 py-1.5 rounded-lg transition-colors flex items-center gap-1"
                        >
                            <ExternalLink size={12} /> Dashboard
                        </button>
                    )}
                </div>

                {!stripeStatus.connected ? (
                    // Not connected - show onboarding CTA
                    <div className="bg-white/10 p-6 rounded-xl backdrop-blur-sm animate-in fade-in space-y-4">
                        <div className="text-center">
                            <h4 className="font-bold text-lg mb-2">Get Paid with Stripe</h4>
                            <p className="text-sm text-white/80 mb-6">
                                OpenTicket partners with Stripe for secure payments and payouts.
                                Connect your account to receive funds directly to your bank.
                            </p>
                            <Button
                                onClick={handleConnectStripe}
                                disabled={isConnecting}
                                className="bg-white text-[#635BFF] hover:bg-white/90 font-bold py-3 px-6 rounded-full shadow-lg w-full transform transition-transform hover:scale-105"
                            >
                                {isConnecting ? (
                                    <span className="flex items-center gap-2 justify-center">
                                        <Loader2 className="animate-spin" size={18} />
                                        Connecting...
                                    </span>
                                ) : (
                                    'Connect with Stripe'
                                )}
                            </Button>
                            <p className="text-xs text-white/50 mt-4">
                                You will be redirected to Stripe to verify your business details.
                            </p>
                        </div>
                    </div>
                ) : needsOnboarding ? (
                    // Connected but incomplete
                    <div className="bg-yellow-500/20 p-6 rounded-xl backdrop-blur-sm animate-in fade-in space-y-4">
                        <div className="flex items-start gap-3">
                            <AlertCircle className="text-yellow-300 mt-1" size={24} />
                            <div>
                                <h4 className="font-bold text-lg mb-1">Complete Your Setup</h4>
                                <p className="text-sm text-white/80 mb-4">
                                    Your Stripe account is connected but needs additional verification to enable payouts.
                                </p>
                                <div className="flex flex-wrap gap-2 mb-4">
                                    <Badge color={stripeStatus.detailsSubmitted ? 'green' : 'yellow'}>
                                        {stripeStatus.detailsSubmitted ? '✓ Details Submitted' : '○ Details Pending'}
                                    </Badge>
                                    <Badge color={stripeStatus.chargesEnabled ? 'green' : 'yellow'}>
                                        {stripeStatus.chargesEnabled ? '✓ Charges Enabled' : '○ Charges Disabled'}
                                    </Badge>
                                    <Badge color={stripeStatus.payoutsEnabled ? 'green' : 'yellow'}>
                                        {stripeStatus.payoutsEnabled ? '✓ Payouts Enabled' : '○ Payouts Disabled'}
                                    </Badge>
                                </div>
                                <Button
                                    onClick={handleCompleteOnboarding}
                                    disabled={isConnecting}
                                    className="bg-white text-[#635BFF] hover:bg-white/90 font-bold py-2 px-4 rounded-lg"
                                >
                                    {isConnecting ? 'Redirecting...' : 'Complete Setup'}
                                </Button>
                            </div>
                        </div>
                    </div>
                ) : (
                    // Fully connected and active
                    <div className="space-y-3">
                        <div className="flex items-center gap-4 bg-white/10 p-4 rounded-xl backdrop-blur-sm">
                            <div className="w-12 h-12 bg-[#00D924] rounded-full flex items-center justify-center shadow-lg">
                                <CheckCircle2 size={24} className="text-white" />
                            </div>
                            <div className="flex-1">
                                <div className="font-bold text-lg leading-tight">Payouts Active</div>
                                <div className="font-mono text-white/60 text-xs mt-1">
                                    Account: {stripeStatus.accountId}
                                </div>
                            </div>
                        </div>
                        <div className="flex gap-2">
                            <button 
                                onClick={() => loadStripeStatus()}
                                className="text-xs bg-white/10 hover:bg-white/20 px-3 py-1.5 rounded-lg transition-colors flex items-center gap-1"
                            >
                                <RefreshCw size={12} /> Refresh
                            </button>
                            <button 
                                onClick={handleDisconnect}
                                className="text-xs bg-red-500/20 hover:bg-red-500/30 text-red-200 px-3 py-1.5 rounded-lg transition-colors flex items-center gap-1"
                            >
                                <XCircle size={12} /> Disconnect
                            </button>
                        </div>
                    </div>
                )}
            </div>
        );
    };

    return (
        <div className="max-w-4xl mx-auto py-8 px-4 space-y-8">
            <h1 className="text-3xl font-black text-gray-900 dark:text-white font-display uppercase tracking-tight">Billing & Payouts</h1>

            {balanceDue > 0 && (
                <div className="bg-red-500/10 border-l-4 border-red-500 p-4 mb-6 rounded-r-xl animate-in slide-in-from-top-2">
                    <div className="flex items-start gap-3">
                        <AlertCircle className="text-red-500 mt-1" size={24} />
                        <div>
                            <h3 className="text-red-500 font-bold uppercase">Account Locked: Outstanding Balance</h3>
                            <p className="text-gray-700 dark:text-gray-300 text-sm mb-2">
                                You have unpaid platform fees from offline ticket sales.
                                <strong> Event publishing is disabled until this invoice is paid.</strong>
                            </p>
                        </div>
                    </div>
                </div>
            )}

            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                <div className="md:col-span-2 space-y-6">
                    <Card className="p-6 border-l-4 border-l-primary">
                        <div className="flex justify-between items-start mb-4">
                            <div>
                                <h2 className="text-lg font-bold text-gray-900 dark:text-white">Current Subscription</h2>
                                <p className="text-sm text-gray-500">Your plan and billing cycle.</p>
                            </div>
                            <Badge color={sub.plan === 'premium' ? 'purple' : sub.plan === 'pro' ? 'blue' : 'green'}>
                                {planDetails.name} Plan
                            </Badge>
                        </div>
                        <div className="flex items-center gap-4 text-sm mb-6">
                            <div className="flex items-center text-gray-600 dark:text-zinc-300">
                                <Calendar size={16} className="mr-2 text-primary" />
                                Next billing: {new Date(sub.nextBillingDate).toLocaleDateString()}
                            </div>
                            <div className="flex items-center text-gray-600 dark:text-zinc-300">
                                <DollarSign size={16} className="mr-2 text-primary" />
                                ${sub.plan === 'free' ? '0.00' : sub.cycle === 'monthly' ? planDetails.priceMonthly.toFixed(2) : planDetails.priceYearly.toFixed(2)}/{sub.cycle === 'monthly' ? 'mo' : 'yr'}
                            </div>
                        </div>
                    </Card>

                    {/* Stripe Connect Card */}
                    {renderStripeConnect()}
                </div>

                <Card className="p-6 bg-zinc-900 text-white border-zinc-800 h-fit">
                    <div className="flex justify-between items-start mb-2">
                        <div>
                            <h2 className="text-lg font-bold">Payout Balance</h2>
                            <p className="text-xs text-zinc-400">Available to withdraw</p>
                        </div>
                        <Zap size={20} className="text-[#E0FF20]" fill="currentColor" />
                    </div>
                    <div className="text-4xl font-black mb-4">${availablePayout.toFixed(2)}</div>

                    {balanceDue > 0 && (
                        <div className="bg-red-900/30 p-2 rounded-lg mb-4 text-xs text-red-300 flex justify-between">
                            <span>Owed Fees:</span>
                            <span className="font-bold">-${balanceDue.toFixed(2)}</span>
                        </div>
                    )}

                    {!stripeStatus.connected || !stripeStatus.payoutsEnabled ? (
                        <div className="text-center py-4">
                            <p className="text-zinc-400 text-sm mb-2">Connect Stripe to enable payouts</p>
                            <Button disabled className="w-full bg-zinc-800 text-zinc-500 border-none">
                                Payouts Disabled
                            </Button>
                        </div>
                    ) : netPayoutAvailable > 0 ? (
                        <div className="space-y-2">
                            <div className="flex items-center gap-2 p-2 bg-white/5 rounded-lg">
                                <input type="radio" name="payout" checked={payoutMode === 'standard'} onChange={() => setPayoutMode('standard')} />
                                <div className="text-xs">
                                    <div className="font-bold">Standard (2-3 Days)</div>
                                    <div className="text-zinc-400">Free</div>
                                </div>
                            </div>
                            <div className="flex items-center gap-2 p-2 bg-white/5 rounded-lg">
                                <input type="radio" name="payout" checked={payoutMode === 'instant'} onChange={() => setPayoutMode('instant')} />
                                <div className="text-xs">
                                    <div className="font-bold flex items-center gap-1">Instant <Zap size={10} className="text-[#E0FF20]" fill="currentColor" /></div>
                                    <div className="text-zinc-400">1.5% Fee (${instantFee.toFixed(2)})</div>
                                </div>
                            </div>
                            <Button
                                onClick={handleRequestPayout}
                                isLoading={isProcessingPayout}
                                className="w-full bg-[#E0FF20] text-black hover:bg-[#d4f542] border-none mt-2"
                            >
                                Withdraw ${payoutMode === 'instant' ? instantNet.toFixed(2) : netPayoutAvailable.toFixed(2)}
                            </Button>
                        </div>
                    ) : (
                        <Button disabled className="w-full bg-zinc-800 text-zinc-500 border-none">No funds available</Button>
                    )}
                </Card>
            </div>

            {balanceDue > 0 && (
                <Card className="p-6 border-red-200 dark:border-red-900">
                    <div className="flex flex-col md:flex-row justify-between items-center gap-4">
                        <div>
                            <h2 className="text-xl font-bold text-red-600 dark:text-red-500 flex items-center gap-2">
                                <AlertCircle size={24} /> Outstanding Invoice
                            </h2>
                            <p className="text-sm text-gray-600 dark:text-zinc-400 mt-1">
                                You have collected offline payments that incurred platform fees.
                                Please settle this balance to unlock your account features.
                            </p>
                        </div>
                        <div className="text-center md:text-right">
                            <div className="text-3xl font-black text-gray-900 dark:text-white mb-2">${balanceDue.toFixed(2)}</div>
                            <Button onClick={handlePayBalance} isLoading={isPayingBalance} className="bg-red-600 hover:bg-red-700 text-white border-none w-full md:w-auto">
                                Pay Now
                            </Button>
                        </div>
                    </div>
                </Card>
            )}

            <div className="space-y-4">
                <div className="flex justify-between items-center">
                    <h2 className="text-xl font-bold text-gray-900 dark:text-white flex items-center gap-2">
                        <FileText className="text-primary" /> Transaction Ledger
                    </h2>
                    <Button size="sm" variant="outline" onClick={exportLedgerCSV} disabled={ledger.length === 0}>
                        <Download size={16} className="mr-2" /> Export CSV
                    </Button>
                </div>

                <div className="bg-white dark:bg-black border border-zinc-200 dark:border-zinc-800 rounded-xl overflow-hidden">
                    <div className="overflow-x-auto">
                        <table className="w-full text-left text-sm">
                            <thead className="bg-zinc-100 dark:bg-zinc-900 border-b border-zinc-200 dark:border-zinc-800 text-zinc-500 uppercase font-bold text-xs">
                                <tr>
                                    <th className="p-4">Date</th>
                                    <th className="p-4">Event / Item</th>
                                    <th className="p-4 text-right">Gross</th>
                                    <th className="p-4 text-right">Fee</th>
                                    <th className="p-4 text-right">Net</th>
                                    <th className="p-4 text-center">Status</th>
                                    <th className="p-4"></th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-zinc-200 dark:divide-zinc-800">
                                {ledger.length === 0 ? (
                                    <tr>
                                        <td colSpan={7} className="p-8 text-center text-zinc-500">No transactions recorded yet.</td>
                                    </tr>
                                ) : (
                                    ledger.map((item, idx) => {
                                        const r = item.reg;
                                        const isCancelled = r.paymentStatus === 'refunded';
                                        let gross = 0;
                                        let net = 0;

                                        if (!isCancelled) {
                                            gross = (r.tickets?.reduce((acc, t) => acc + (t.pricePerTicket * t.quantity), 0) || 0)
                                                + (r.donationAmount || 0)
                                                + (r.addOns?.reduce((acc, a) => acc + (a.price * a.quantity), 0) || 0)
                                                + (r.customFeesAmount || 0);
                                            net = gross - (r.serviceFee || 0);
                                        }

                                        return (
                                            <tr key={idx} className="hover:bg-zinc-50 dark:hover:bg-zinc-900/50 transition-colors">
                                                <td className="p-4 text-zinc-500">{new Date(r.timestamp).toLocaleDateString()}</td>
                                                <td className="p-4">
                                                    <div className="font-bold text-gray-900 dark:text-white">{item.event.title}</div>
                                                    <div className="text-xs text-zinc-500">Order #{r.id.slice(-6).toUpperCase()} • {r.attendeeName}</div>
                                                </td>
                                                {isCancelled ? (
                                                    <>
                                                        <td className="p-4 text-right font-mono text-zinc-400 line-through">$0.00</td>
                                                        <td className="p-4 text-right font-mono text-zinc-400">-</td>
                                                        <td className="p-4 text-right font-mono text-zinc-400">$0.00</td>
                                                    </>
                                                ) : (
                                                    <>
                                                        <td className="p-4 text-right font-mono">${gross.toFixed(2)}</td>
                                                        <td className="p-4 text-right font-mono text-red-500">-${(r.serviceFee || 0).toFixed(2)}</td>
                                                        <td className="p-4 text-right font-mono font-bold text-green-600 dark:text-green-400">
                                                            ${net.toFixed(2)}
                                                        </td>
                                                    </>
                                                )}

                                                <td className="p-4 text-center">
                                                    {isCancelled ? (
                                                        <Badge color="gray">CANCELLED</Badge>
                                                    ) : (
                                                        <Badge color={r.paymentStatus === 'completed' || r.paymentStatus === 'paid' ? 'green' : 'yellow'}>
                                                            {r.paymentStatus === 'completed' || r.paymentStatus === 'paid' ? 'PAID' : 'PENDING'}
                                                        </Badge>
                                                    )}
                                                </td>
                                                <td className="p-4 text-right">
                                                    <button onClick={() => downloadTransaction(item)} className="text-zinc-400 hover:text-zinc-900 dark:hover:text-white">
                                                        <Download size={16} />
                                                    </button>
                                                </td>
                                            </tr>
                                        );
                                    })
                                )}
                            </tbody>
                        </table>
                    </div>
                </div>
            </div>

            {showAddCard && (
                <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm animate-in fade-in">
                    <Card className="w-full max-w-md p-6">
                        <h3 className="text-xl font-bold mb-4">Add Debit Card for Instant Payouts</h3>
                        <form onSubmit={handleAddDebitCard} className="space-y-4">
                            <Input
                                label="Card Number"
                                placeholder="0000 0000 0000 0000"
                                value={newCardData.number}
                                onChange={e => setNewCardData({ ...newCardData, number: e.target.value })}
                                required
                            />
                            <div className="grid grid-cols-2 gap-4">
                                <Input
                                    label="Expiry (MM/YY)"
                                    placeholder="12/25"
                                    value={newCardData.expiry}
                                    onChange={e => setNewCardData({ ...newCardData, expiry: e.target.value })}
                                    required
                                />
                                <Input
                                    label="CVC"
                                    placeholder="123"
                                    value={newCardData.cvc}
                                    onChange={e => setNewCardData({ ...newCardData, cvc: e.target.value })}
                                    required
                                />
                            </div>
                            <Input
                                label="Cardholder Name"
                                placeholder="John Doe"
                                value={newCardData.name}
                                onChange={e => setNewCardData({ ...newCardData, name: e.target.value })}
                                required
                            />
                            <div className="flex gap-2 justify-end mt-6">
                                <Button variant="ghost" onClick={() => setShowAddCard(false)}>Cancel</Button>
                                <Button type="submit">Save Card</Button>
                            </div>
                        </form>
                    </Card>
                </div>
            )}
        </div>
    );
};
