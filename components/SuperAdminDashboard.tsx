
import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { StorageService } from '../services/storageService';
import { User, Event, Registration } from '../types';
import { Card, Button, Badge, Input, RichTextarea, Select } from './UI';
import { Users, Ticket, DollarSign, Search, Shield, Lock, Trash2, Megaphone, Send, Ban, CheckCircle, ExternalLink, RefreshCw, XCircle, AlertTriangle, AlertCircle, EyeOff, CheckCircle2, Settings, CreditCard, Crown, TrendingUp, Save, Download, Tag, Percent, Calendar, Mail, Building2, UserCheck, FileText, Gift, Wallet, Clock, Eye, Heart } from 'lucide-react';

interface FinancialTransaction {
    id: string;
    gross_amount: number;
    platform_fee: number;
    stripe_fee: number;
    organizer_net: number;
    affiliate_code?: string;
    affiliate_commission?: number;
    stripe_session_id?: string;
    event_id?: string;
    created_at: string;
    registration?: {
        attendee_name: string;
        attendee_email: string;
    };
    event?: {
        title: string;
        owner_id: string;
    };
}

interface OrganizerBreakdown {
    organizerId: string;
    organizerName: string;
    organizerEmail: string;
    totalVolume: number;
    platformFees: number;
    netEarnings: number;
    transactionCount: number;
}

interface AffiliateData {
    id: string;
    name: string;
    email: string;
    affiliateCode: string;
    stripeConnectId?: string;
    totalEarnings: number;
    pendingPayout: number;
    paidOut: number;
    clicks: number;
    conversions: number;
    conversionRate: number;
    transactions: FinancialTransaction[];
    commissionRate: number; // Affiliate's commission rate (%)
    discountPercent: number; // Discount given to users who sign up via this affiliate (%)
}

interface AffiliatePayout {
    id: string;
    affiliateId: string;
    affiliateName: string;
    affiliateCode: string;
    amount: number;
    method: 'stripe' | 'offline' | 'manual';
    status: 'pending' | 'paid' | 'failed';
    notes?: string;
    createdAt: string;
    paidAt?: string;
}

interface PromoCode {
    id: string;
    code: string;
    type: 'percentage' | 'fixed';
    value: number;
    target: 'subscription' | 'ticket' | 'all';
    targetPlans?: string[];
    usageLimit?: number;
    usageCount: number;
    expiresAt?: string;
    isActive: boolean;
    createdAt: string;
}

export const SuperAdminDashboard = ({ embedded = false }: { embedded?: boolean }) => {
    const navigate = useNavigate();
    const [users, setUsers] = useState<User[]>([]);
    const [events, setEvents] = useState<Event[]>([]);
    const [registrations, setRegistrations] = useState<Registration[]>([]);
    const [stats, setStats] = useState({
        platformFees: 0,         // What platform earns from ticket sales
        subscriptionRevenue: 0,  // What platform earns from Pro/Premium subscriptions
        totalVolume: 0,          // Total gross transaction volume
        organizerNet: 0,         // Total paid out to organizers
        pendingPayouts: 0,       // Pending organizer payouts
        stripeFees: 0,           // Stripe processing fees
        refundTotal: 0,          // Total refunds issued
        platformDonations: 0,    // Total platform donations from attendees
        recentTransactions: [] as FinancialTransaction[],
        organizerBreakdown: [] as OrganizerBreakdown[],
        donationBreakdown: {
            total: 0,
            count: 0,
            byAmount: { '$1': 0, '$2': 0, '$5': 0, '$10': 0, 'other': 0 },
            recent: [] as { amount: number; attendeeName: string; eventTitle: string; createdAt: string }[],
            thisMonth: 0,
            lastMonth: 0
        }
    });
    const [searchTerm, setSearchTerm] = useState('');
    const [activeTab, setActiveTab] = useState<'users' | 'events' | 'registrations' | 'finance' | 'affiliates' | 'broadcast' | 'promo' | 'settings'>('users');
    const [unauthorized, setUnauthorized] = useState(false);

    // Broadcast State
    const [broadcastMsg, setBroadcastMsg] = useState('');
    const [broadcastTarget, setBroadcastTarget] = useState<'all' | 'organizers' | 'affiliates'>('all');
    const [activeNotification, setActiveNotification] = useState<any>(null);

    // Affiliate State
    const [affiliates, setAffiliates] = useState<AffiliateData[]>([]);
    const [affiliatePayouts, setAffiliatePayouts] = useState<AffiliatePayout[]>([]);
    const [selectedAffiliate, setSelectedAffiliate] = useState<AffiliateData | null>(null);
    const [payoutAmount, setPayoutAmount] = useState('');
    const [payoutMethod, setPayoutMethod] = useState<'stripe' | 'offline'>('stripe');
    const [affiliatePayoutNotes, setAffiliatePayoutNotes] = useState('');
    const [isProcessingPayout, setIsProcessingPayout] = useState(false);
    
    // Affiliate rate editing
    const [editCommissionRate, setEditCommissionRate] = useState<number | null>(null);
    const [editDiscountPercent, setEditDiscountPercent] = useState<number | null>(null);
    const [isSavingRates, setIsSavingRates] = useState(false);

    // Platform Payouts State
    const [platformPayouts, setPlatformPayouts] = useState<any[]>([]);
    const [pendingPayoutSummary, setPendingPayoutSummary] = useState<any>(null);
    const [showPayoutModal, setShowPayoutModal] = useState(false);
    const [payoutType, setPayoutType] = useState<'platform_fees' | 'subscriptions' | 'combined'>('platform_fees');
    const [platformPayoutNotes, setPlatformPayoutNotes] = useState('');
    const [isProcessingPlatformPayout, setIsProcessingPlatformPayout] = useState(false);

    // Promo Code State
    const [promoCodes, setPromoCodes] = useState<PromoCode[]>([]);
    const [newPromo, setNewPromo] = useState({
        code: '',
        type: 'percentage' as 'percentage' | 'fixed',
        value: 10,
        target: 'all' as 'subscription' | 'ticket' | 'all',
        targetPlans: [] as string[],
        usageLimit: 0,
        expiresAt: ''
    });

    // Platform Settings State
    const [platformStripeId, setPlatformStripeId] = useState('');
    const [platformPublishableKey, setPlatformPublishableKey] = useState('');
    const [platformSecretKey, setPlatformSecretKey] = useState('');

    const currentUser = StorageService.getCurrentUser();

    useEffect(() => {
        // When embedded, the parent component already verified admin access
        if (!embedded && (!currentUser || !currentUser.isAdmin)) {
            setUnauthorized(true);
            return;
        }
        setPlatformStripeId(currentUser?.stripeConnectId || '');
        setPlatformPublishableKey(currentUser?.stripePublishableKey || '');
        setPlatformSecretKey(currentUser?.stripeSecretKey || '');
        refreshData();
        loadPromoCodes();
    }, [navigate, embedded]);

    const refreshData = async () => {
        try {
            const [allUsers, allEvents, allRegs] = await Promise.all([
                StorageService.getAllUsersAdmin().catch(e => { console.error(e); return []; }),
                StorageService.getAllEventsAdmin().catch(e => { console.error(e); return []; }),
                StorageService.getAllRegistrationsAdmin().catch(e => { console.error(e); return []; })
            ]);

            setUsers(allUsers);
            setEvents(allEvents);
            setRegistrations(allRegs);

            // Fetch True Financials
            const financials = await StorageService.getAdminFinancials();

            // Get actual values from financial transactions
            const platformFees = financials.platformFees || 0;
            const totalVolume = financials.totalVolume || 0;
            const organizerNet = financials.organizerNet || 0;
            const refundTotal = financials.refundTotal || 0;
            const platformDonations = financials.platformDonations || 0;
            let stripeFees = 0;

            // Calculate Stripe fees from transactions
            if (financials.recentTransactions) {
                stripeFees = financials.recentTransactions.reduce((acc: number, tx: any) => 
                    acc + (Number(tx.stripe_fee) || 0), 0);
            }

            // Calculate subscription revenue from user invoices
            const subscriptionRevenue = allUsers.reduce((acc: number, user: User) => {
                const userSubInvoices = user.invoices?.filter(inv => inv.type === 'subscription' && inv.status === 'paid') || [];
                const userTotal = userSubInvoices.reduce((sum, inv) => sum + inv.amount, 0);
                return acc + userTotal;
            }, 0);

            const pending = allUsers.reduce((acc: number, u: User) => acc + (u.availablePayout || 0), 0);

            setStats({
                platformFees,
                subscriptionRevenue,
                totalVolume,
                organizerNet,
                pendingPayouts: pending,
                stripeFees,
                refundTotal,
                platformDonations,
                recentTransactions: financials.recentTransactions || [],
                organizerBreakdown: financials.organizerBreakdown || [],
                donationBreakdown: financials.donationBreakdown || {
                    total: 0,
                    count: 0,
                    byAmount: { '$1': 0, '$2': 0, '$5': 0, '$10': 0, 'other': 0 },
                    recent: [],
                    thisMonth: 0,
                    lastMonth: 0
                }
            });

            // Load affiliate data from new analytics endpoint
            try {
                const affiliateAnalytics = await StorageService.getAffiliateAnalytics();
                if (affiliateAnalytics && affiliateAnalytics.affiliates) {
                    const affiliateDataList: AffiliateData[] = affiliateAnalytics.affiliates.map((aff: any) => ({
                        id: aff.id,
                        name: aff.name || 'Unknown',
                        email: aff.email || '',
                        affiliateCode: aff.affiliateCode || '',
                        stripeConnectId: aff.stripeConnected ? 'connected' : undefined,
                        totalEarnings: aff.totalCommission || 0,
                        pendingPayout: aff.pendingPayout || 0,
                        paidOut: aff.totalPaidOut || 0,
                        clicks: aff.clicks || 0,
                        conversions: aff.conversions || 0,
                        conversionRate: aff.conversionRate || 0,
                        transactions: aff.transactions || [],
                        commissionRate: aff.commissionRate || 10,
                        discountPercent: aff.discountPercent || 0
                    }));
                    setAffiliates(affiliateDataList);
                } else {
                    // Fallback to old method if analytics endpoint fails
                    const affiliateUsers = allUsers.filter(u => u.role === 'affiliate' && u.affiliateCode);
                    const affiliateDataList: AffiliateData[] = affiliateUsers.map(aff => {
                        const affTransactions = (financials.recentTransactions || []).filter(
                            (tx: any) => tx.affiliate_code === aff.affiliateCode
                        );
                        const totalCommission = affTransactions.reduce(
                            (sum: number, tx: any) => sum + (Number(tx.affiliate_commission) || 0), 0
                        );
                        const paidOut = aff.totalPaidOut || 0;
                        return {
                            id: aff.id,
                            name: aff.name || 'Unknown',
                            email: aff.email || '',
                            affiliateCode: aff.affiliateCode || '',
                            stripeConnectId: aff.stripeConnectId,
                            totalEarnings: totalCommission,
                            pendingPayout: Math.max(0, totalCommission - paidOut),
                            paidOut: paidOut,
                            clicks: aff.affiliateClicks || 0,
                            conversions: affTransactions.length,
                            conversionRate: aff.affiliateClicks ? (affTransactions.length / aff.affiliateClicks * 100) : 0,
                            transactions: affTransactions,
                            commissionRate: aff.commissionRate || 10,
                            discountPercent: aff.discountPercent || 0
                        };
                    });
                    setAffiliates(affiliateDataList);
                }
            } catch (e) {
                console.error("Failed to load affiliate analytics, using fallback", e);
                // Fallback to calculating from users
                const affiliateUsers = allUsers.filter(u => u.role === 'affiliate' && u.affiliateCode);
                const affiliateDataList: AffiliateData[] = affiliateUsers.map(aff => {
                    const affTransactions = (financials.recentTransactions || []).filter(
                        (tx: any) => tx.affiliate_code === aff.affiliateCode
                    );
                    const totalCommission = affTransactions.reduce(
                        (sum: number, tx: any) => sum + (Number(tx.affiliate_commission) || 0), 0
                    );
                    const paidOut = aff.totalPaidOut || 0;
                    return {
                        id: aff.id,
                        name: aff.name || 'Unknown',
                        email: aff.email || '',
                        affiliateCode: aff.affiliateCode || '',
                        stripeConnectId: aff.stripeConnectId,
                        totalEarnings: totalCommission,
                        pendingPayout: Math.max(0, totalCommission - paidOut),
                        paidOut: paidOut,
                        clicks: aff.affiliateClicks || 0,
                        conversions: affTransactions.length,
                        conversionRate: aff.affiliateClicks ? (affTransactions.length / aff.affiliateClicks * 100) : 0,
                        transactions: affTransactions,
                        commissionRate: aff.commissionRate || 10,
                        discountPercent: aff.discountPercent || 0
                    };
                });
                setAffiliates(affiliateDataList);
            }
            
            // Load affiliate payouts
            try {
                const payouts = await StorageService.getAffiliatePayouts();
                setAffiliatePayouts(payouts || []);
            } catch (e) {
                console.error("Failed to load affiliate payouts", e);
            }

            // Load platform payouts
            try {
                const [payouts, pendingSummary] = await Promise.all([
                    StorageService.getPlatformPayouts(),
                    StorageService.getPendingPayoutSummary()
                ]);
                setPlatformPayouts(payouts || []);
                setPendingPayoutSummary(pendingSummary);
            } catch (e) {
                console.error("Failed to load platform payouts", e);
            }

            try {
                setActiveNotification(StorageService.getSystemNotification());
            } catch (e) { console.error(e); }

        } catch (e) {
            console.error("Dashboard Refresh Error", e);
        }
    };

    const loadPromoCodes = async () => {
        try {
            const codes = await StorageService.getPromoCodes();
            setPromoCodes(codes || []);
        } catch (e) {
            console.error("Failed to load promo codes", e);
        }
    };

    const handleProcessAffiliatePayout = async () => {
        if (!selectedAffiliate || !payoutAmount) return;
        
        const amount = parseFloat(payoutAmount);
        if (isNaN(amount) || amount <= 0) {
            alert('Please enter a valid amount');
            return;
        }
        
        if (amount > selectedAffiliate.pendingPayout) {
            alert(`Cannot pay more than pending amount ($${selectedAffiliate.pendingPayout.toFixed(2)})`);
            return;
        }
        
        setIsProcessingPayout(true);
        
        try {
            const payout: AffiliatePayout = {
                id: `payout-${Date.now()}`,
                affiliateId: selectedAffiliate.id,
                affiliateName: selectedAffiliate.name,
                affiliateCode: selectedAffiliate.affiliateCode,
                amount: amount,
                method: payoutMethod,
                status: payoutMethod === 'stripe' ? 'pending' : 'paid',
                notes: affiliatePayoutNotes,
                createdAt: new Date().toISOString(),
                paidAt: payoutMethod === 'offline' ? new Date().toISOString() : undefined
            };
            
            // Save payout record
            await StorageService.createAffiliatePayout(payout);
            
            // Update affiliate's paid out amount
            await StorageService.updateUser(selectedAffiliate.id, {
                totalPaidOut: (selectedAffiliate.paidOut || 0) + amount
            });
            
            // If Stripe payout, initiate transfer
            if (payoutMethod === 'stripe' && selectedAffiliate.stripeConnectId) {
                try {
                    await StorageService.initiateStripePayout(selectedAffiliate.id, amount);
                    await StorageService.updateAffiliatePayout(payout.id, { status: 'paid', paidAt: new Date().toISOString() });
                } catch (stripeError) {
                    console.error('Stripe payout failed:', stripeError);
                    await StorageService.updateAffiliatePayout(payout.id, { status: 'failed' });
                    alert('Stripe payout failed. Please try offline payment or check Stripe connection.');
                }
            }
            
            // Reset form
            setPayoutAmount('');
            setAffiliatePayoutNotes('');
            setSelectedAffiliate(null);
            
            // Refresh data
            refreshData();
            alert(`Payout of $${amount.toFixed(2)} to ${payout.affiliateName} recorded successfully!`);
            
        } catch (e) {
            console.error('Payout error:', e);
            alert('Failed to process payout. Please try again.');
        } finally {
            setIsProcessingPayout(false);
        }
    };

    const handleUpdateAffiliateRates = async () => {
        if (!selectedAffiliate) return;
        
        setIsSavingRates(true);
        try {
            const updates: any = {};
            
            if (editCommissionRate !== null && editCommissionRate !== selectedAffiliate.commissionRate) {
                updates.commissionRate = editCommissionRate;
            }
            if (editDiscountPercent !== null && editDiscountPercent !== selectedAffiliate.discountPercent) {
                updates.discountPercent = editDiscountPercent;
            }
            
            if (Object.keys(updates).length === 0) {
                alert('No changes to save');
                setIsSavingRates(false);
                return;
            }
            
            await StorageService.updateAffiliateRates(selectedAffiliate.id, updates);
            
            // Update local state
            setAffiliates(prev => prev.map(aff => 
                aff.id === selectedAffiliate.id 
                    ? { ...aff, ...updates }
                    : aff
            ));
            setSelectedAffiliate(prev => prev ? { ...prev, ...updates } : null);
            
            // Reset edit state
            setEditCommissionRate(null);
            setEditDiscountPercent(null);
            
            alert('Affiliate rates updated successfully!');
        } catch (e) {
            console.error('Update rates error:', e);
            alert('Failed to update rates. Please try again.');
        } finally {
            setIsSavingRates(false);
        }
    };

    const handleSchedulePlatformPayout = async () => {
        if (!pendingPayoutSummary) return;
        
        setIsProcessingPlatformPayout(true);
        try {
            let amount = 0;
            let breakdown: any = {};
            
            if (payoutType === 'platform_fees') {
                amount = pendingPayoutSummary.platformFees?.amount || 0;
                breakdown = {
                    ...pendingPayoutSummary.platformFees,
                    type: 'platform_fees'
                };
            } else if (payoutType === 'subscriptions') {
                amount = pendingPayoutSummary.subscriptions?.amount || 0;
                breakdown = {
                    ...pendingPayoutSummary.subscriptions,
                    type: 'subscriptions'
                };
            } else {
                amount = pendingPayoutSummary.total || 0;
                breakdown = {
                    platformFees: pendingPayoutSummary.platformFees,
                    subscriptions: pendingPayoutSummary.subscriptions,
                    type: 'combined'
                };
            }
            
            if (amount <= 0) {
                alert('No pending amount to pay out');
                return;
            }
            
            const result = await StorageService.schedulePlatformPayout(
                payoutType,
                amount,
                undefined, // scheduledFor - execute immediately
                platformPayoutNotes,
                breakdown
            );
            
            if (result?.payout?.id) {
                // Mark as executed immediately
                await StorageService.executePlatformPayout(result.payout.id);
            }
            
            setShowPayoutModal(false);
            setPlatformPayoutNotes('');
            refreshData();
            alert(`Payout of $${amount.toFixed(2)} has been recorded successfully!`);
        } catch (e) {
            console.error('Platform payout error:', e);
            alert('Failed to process payout. Please try again.');
        } finally {
            setIsProcessingPlatformPayout(false);
        }
    };

    const handleSendBroadcast = async () => {
        if (!broadcastMsg.trim()) return;
        
        // Store broadcast with target audience
        await StorageService.setSystemNotification(broadcastMsg, 'info', broadcastTarget);
        setBroadcastMsg('');
        refreshData();
        alert(`Broadcast sent to ${broadcastTarget === 'all' ? 'all users' : broadcastTarget}!`);
    };

    const handleClearBroadcast = () => {
        StorageService.clearSystemNotification();
        refreshData();
    };

    const handleToggleBan = (user: User) => {
        if (user.isAdmin) return;
        const confirmMsg = user.isBanned
            ? `Re-activate ${user.name}?`
            : `Are you sure you want to BAN ${user.name}? They will be unable to login.`;

        if (confirm(confirmMsg)) {
            StorageService.updateUser(user.id, { isBanned: !user.isBanned });
            refreshData();
        }
    };

    const handleDeleteEvent = (event: Event) => {
        if (confirm(`Delete "${event.title}"? This cannot be undone.`)) {
            StorageService.deleteEvent(event.id);
            refreshData();
        }
    };

    const handleRejectEvent = (event: Event) => {
        if (confirm(`Reject "${event.title}"? This will hide the event from the public and mark it as rejected.`)) {
            StorageService.saveEvent({ ...event, moderationStatus: 'rejected', visibility: 'hidden' });
            refreshData();
        }
    };

    const handleCreatePromoCode = async () => {
        if (!newPromo.code.trim()) {
            alert('Please enter a promo code');
            return;
        }

        const promoCode: PromoCode = {
            id: `promo-${Date.now()}`,
            code: newPromo.code.toUpperCase(),
            type: newPromo.type,
            value: newPromo.value,
            target: newPromo.target,
            targetPlans: newPromo.targetPlans,
            usageLimit: newPromo.usageLimit || undefined,
            usageCount: 0,
            expiresAt: newPromo.expiresAt || undefined,
            isActive: true,
            createdAt: new Date().toISOString()
        };

        await StorageService.createPromoCode(promoCode);
        loadPromoCodes();
        setNewPromo({
            code: '',
            type: 'percentage',
            value: 10,
            target: 'all',
            targetPlans: [],
            usageLimit: 0,
            expiresAt: ''
        });
        alert('Promo code created successfully!');
    };

    const handleTogglePromoCode = async (promo: PromoCode) => {
        await StorageService.updatePromoCode(promo.id, { isActive: !promo.isActive });
        loadPromoCodes();
    };

    const handleDeletePromoCode = async (promo: PromoCode) => {
        if (confirm(`Delete promo code "${promo.code}"?`)) {
            await StorageService.deletePromoCode(promo.id);
            loadPromoCodes();
        }
    };

    const handleSavePlatformSettings = async () => {
        if (!currentUser) return;
        await StorageService.updateUser(currentUser.id, {
            stripeConnectId: platformStripeId,
            stripePublishableKey: platformPublishableKey,
            stripeSecretKey: platformSecretKey
        });
        alert("Platform settings saved successfully.");
    };

    const exportFinancialsCSV = () => {
        const headers = ['Date', 'Transaction ID', 'Event', 'Organizer', 'Gross', 'Platform Fee', 'Stripe Fee', 'Organizer Net'];
        const rows = stats.recentTransactions.map(tx => {
            const event = events.find(e => e.id === tx.event_id);
            return [
                new Date(tx.created_at).toLocaleDateString(),
                tx.id,
                event?.title || 'Unknown',
                getOrganizerName(event?.ownerId),
                tx.gross_amount?.toFixed(2) || '0.00',
                tx.platform_fee?.toFixed(2) || '0.00',
                tx.stripe_fee?.toFixed(2) || '0.00',
                tx.organizer_net?.toFixed(2) || '0.00'
            ];
        });

        // Add summary
        rows.push([]);
        rows.push(['SUMMARY']);
        rows.push(['Total Volume', '', '', '', stats.totalVolume.toFixed(2)]);
        rows.push(['Platform Fees', '', '', '', stats.platformFees.toFixed(2)]);
        rows.push(['Stripe Fees', '', '', '', stats.stripeFees.toFixed(2)]);
        rows.push(['Organizer Net', '', '', '', stats.organizerNet.toFixed(2)]);
        rows.push(['Refunds', '', '', '', stats.refundTotal.toFixed(2)]);
        rows.push(['Subscription Revenue', '', '', '', stats.subscriptionRevenue.toFixed(2)]);

        const csv = [headers.join(','), ...rows.map(r => r.join(','))].join('\n');
        const blob = new Blob([csv], { type: 'text/csv' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `platform-financials-${new Date().toISOString().split('T')[0]}.csv`;
        a.click();
    };

    const exportUsersCSV = () => {
        const headers = ['Name', 'Email', 'Role', 'Business Name', 'Business Type', 'Account Type', 'Created At'];
        const rows = users.map(u => [
            u.name || '',
            u.email || '',
            u.role || '',
            u.businessName || '',
            u.businessType || '',
            u.role === 'organizer' ? 'Organizer' : u.role === 'affiliate' ? 'Affiliate' : 'User',
            u.createdAt ? new Date(u.createdAt).toLocaleDateString() : ''
        ]);

        const csv = [headers.join(','), ...rows.map(r => r.map(cell => `"${cell}"`).join(','))].join('\n');
        const blob = new Blob([csv], { type: 'text/csv' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `platform-users-${new Date().toISOString().split('T')[0]}.csv`;
        a.click();
    };

    if (unauthorized && !embedded) {
        return (
            <div className="min-h-[60vh] flex flex-col items-center justify-center p-4">
                <div className="bg-red-500/10 p-8 rounded-3xl border border-red-500/20 text-center max-w-md">
                    <div className="w-16 h-16 bg-red-500/20 text-red-500 rounded-full flex items-center justify-center mx-auto mb-4">
                        <Lock size={32} />
                    </div>
                    <h1 className="text-2xl font-black text-red-500 mb-2">Access Denied</h1>
                    <p className="text-zinc-500 mb-4">You need Super Admin privileges to view this dashboard.</p>
                    <p className="text-xs text-zinc-600 mb-6">Make sure your profile has <code className="bg-zinc-800 px-1 rounded">is_admin = true</code> in the database, then log out and back in.</p>
                    <Button onClick={async () => { try { await StorageService.logout(); } finally { navigate('/auth'); } }}>Login Again</Button>
                </div>
            </div>
        );
    }

    if (!embedded && !currentUser?.isAdmin) {
        return (
            <div className="min-h-[60vh] flex flex-col items-center justify-center p-4">
                <div className="bg-yellow-500/10 p-8 rounded-3xl border border-yellow-500/20 text-center max-w-md">
                    <div className="w-16 h-16 bg-yellow-500/20 text-yellow-500 rounded-full flex items-center justify-center mx-auto mb-4">
                        <AlertCircle size={32} />
                    </div>
                    <h1 className="text-2xl font-black text-yellow-500 mb-2">Not Authorized</h1>
                    <p className="text-zinc-500 mb-4">Your account doesn't have admin privileges.</p>
                    <p className="text-xs text-zinc-600 mb-6">To become a Super Admin, run this SQL in Supabase:<br/><code className="bg-zinc-800 px-2 py-1 rounded mt-2 block">UPDATE profiles SET is_admin = true WHERE email = 'your@email.com';</code></p>
                    <Button onClick={() => navigate('/dashboard')}>Go to Dashboard</Button>
                </div>
            </div>
        );
    }

    const filteredUsers = (users || []).filter(u =>
        (u.name || '').toLowerCase().includes(searchTerm.toLowerCase()) ||
        (u.email || '').toLowerCase().includes(searchTerm.toLowerCase()) ||
        (u.businessName || '').toLowerCase().includes(searchTerm.toLowerCase())
    );

    const filteredEvents = (events || []).filter(e =>
        (e.title || '').toLowerCase().includes(searchTerm.toLowerCase()) ||
        (e.organizer || '').toLowerCase().includes(searchTerm.toLowerCase())
    );

    // Get organizer name for an event
    const getOrganizerName = (ownerId: string) => {
        const owner = users.find(u => u.id === ownerId);
        return owner?.name || owner?.email || 'Unknown';
    };

    return (
        <div className={embedded ? "py-4 px-6" : "max-w-7xl mx-auto py-8 px-4 pb-20"} data-testid="super-admin-dashboard">
            {/* Header - only show when not embedded */}
            {!embedded && (
                <div className="flex flex-col md:flex-row justify-between items-start md:items-center mb-8 gap-4">
                    <div>
                        <h1 className="text-3xl font-black text-white uppercase tracking-tight flex items-center gap-3">
                            <Shield className="text-[#E0FF20]" size={32} /> Super Admin
                        </h1>
                        <p className="text-zinc-400">Platform Management Dashboard</p>
                    </div>
                    <div className="flex gap-4 flex-wrap">
                        <div className="text-right bg-zinc-900 border border-zinc-800 p-4 rounded-xl">
                            <div className="text-[10px] font-bold text-zinc-500 uppercase flex items-center justify-end gap-1">
                                <Ticket size={12} /> Platform Fees
                            </div>
                            <div className="text-xl font-bold text-[#E0FF20]">${stats.platformFees.toFixed(2)}</div>
                        </div>
                        <div className="text-right bg-zinc-900 border border-zinc-800 p-4 rounded-xl">
                            <div className="text-[10px] font-bold text-zinc-500 uppercase flex items-center justify-end gap-1">
                                <Crown size={12} className="text-purple-500" /> Subscriptions
                            </div>
                            <div className="text-xl font-bold text-purple-400">${stats.subscriptionRevenue.toFixed(2)}</div>
                        </div>
                        <div className="text-right bg-zinc-900 border border-zinc-800 p-4 rounded-xl">
                            <div className="text-[10px] font-bold text-zinc-500 uppercase flex items-center justify-end gap-1">
                                <TrendingUp size={12} className="text-green-500" /> Total Volume
                            </div>
                            <div className="text-xl font-bold text-green-400">${stats.totalVolume.toFixed(2)}</div>
                        </div>
                    </div>
                </div>
            )}

            {/* Stats Summary - show at top when embedded */}
            {embedded && (
                <div className="flex gap-4 flex-wrap mb-6">
                    <div className="text-right bg-zinc-900 border border-zinc-800 p-4 rounded-xl flex-1 min-w-[150px]">
                        <div className="text-[10px] font-bold text-zinc-500 uppercase flex items-center justify-end gap-1">
                            <Ticket size={12} /> Platform Fees
                        </div>
                        <div className="text-xl font-bold text-[#E0FF20]">${stats.platformFees.toFixed(2)}</div>
                    </div>
                    <div className="text-right bg-zinc-900 border border-zinc-800 p-4 rounded-xl flex-1 min-w-[150px]">
                        <div className="text-[10px] font-bold text-zinc-500 uppercase flex items-center justify-end gap-1">
                            <Crown size={12} className="text-purple-500" /> Subscriptions
                        </div>
                        <div className="text-xl font-bold text-purple-400">${stats.subscriptionRevenue.toFixed(2)}</div>
                    </div>
                    <div className="text-right bg-zinc-900 border border-zinc-800 p-4 rounded-xl flex-1 min-w-[150px]">
                        <div className="text-[10px] font-bold text-zinc-500 uppercase flex items-center justify-end gap-1">
                            <TrendingUp size={12} className="text-green-500" /> Total Volume
                        </div>
                        <div className="text-xl font-bold text-green-400">${stats.totalVolume.toFixed(2)}</div>
                    </div>
                </div>
            )}

            {/* Search Bar */}
            <div className="mb-6">
                <div className="relative">
                    <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-zinc-500" size={20} />
                    <input
                        type="text"
                        placeholder="Search users, events, or organizations..."
                        value={searchTerm}
                        onChange={(e) => setSearchTerm(e.target.value)}
                        className="w-full bg-zinc-900 border border-zinc-800 rounded-xl pl-12 pr-4 py-3 text-white focus:border-[#E0FF20] outline-none"
                    />
                </div>
            </div>

            <div className="flex gap-2 mb-6 overflow-x-auto pb-2">
                {['users', 'events', 'registrations', 'finance', 'affiliates', 'broadcast', 'promo', 'settings'].map(tab => (
                    <button
                        key={tab}
                        onClick={() => setActiveTab(tab as any)}
                        className={`flex items-center gap-2 px-6 py-3 rounded-xl font-bold capitalize transition-all whitespace-nowrap ${activeTab === tab
                            ? 'bg-[#E0FF20] text-black shadow-[0_0_20px_rgba(224,255,32,0.3)]'
                            : 'bg-zinc-900 text-zinc-400 hover:bg-zinc-800'
                            }`}
                    >
                        {tab === 'promo' ? 'Promo Codes' : tab}
                    </button>
                ))}
            </div>

            <div className="bg-zinc-900 border border-zinc-800 rounded-3xl overflow-hidden min-h-[500px]">
                {/* USERS TAB */}
                {activeTab === 'users' && (
                    <div>
                        <div className="p-4 border-b border-zinc-800 flex justify-between items-center">
                            <span className="font-bold text-white">All Users ({filteredUsers.length})</span>
                            <Button size="sm" variant="outline" onClick={exportUsersCSV}>
                                <Download size={14} className="mr-2" /> Export CSV
                            </Button>
                        </div>
                        <div className="overflow-x-auto">
                            <table className="w-full text-left text-sm text-zinc-400">
                                <thead className="bg-black text-zinc-500 uppercase font-bold text-xs">
                                    <tr>
                                        <th className="p-4">User</th>
                                        <th className="p-4">Organization</th>
                                        <th className="p-4">Account Type</th>
                                        <th className="p-4">Business Type</th>
                                        <th className="p-4">Role</th>
                                        <th className="p-4">Actions</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    {filteredUsers.map(u => (
                                        <tr key={u.id} className="border-t border-zinc-800 hover:bg-zinc-800/50">
                                            <td className="p-4">
                                                <div className="font-bold text-white">{u.name || 'No Name'}</div>
                                                <div className="text-xs">{u.email}</div>
                                            </td>
                                            <td className="p-4">
                                                <div className="font-medium text-white">{u.businessName || '-'}</div>
                                            </td>
                                            <td className="p-4">
                                                <Badge color={u.role === 'organizer' ? 'green' : u.role === 'affiliate' ? 'purple' : 'gray'}>
                                                    {u.role === 'organizer' ? 'Organizer' : u.role === 'affiliate' ? 'Affiliate' : 'User'}
                                                </Badge>
                                            </td>
                                            <td className="p-4 text-xs">{u.businessType || '-'}</td>
                                            <td className="p-4">
                                                <Badge color={u.isAdmin ? 'yellow' : 'gray'}>
                                                    {u.isAdmin ? 'Admin' : u.role || 'User'}
                                                </Badge>
                                            </td>
                                            <td className="p-4">
                                                {!u.isAdmin && (
                                                    <Button size="sm" variant={u.isBanned ? 'primary' : 'outline'} onClick={() => handleToggleBan(u)}>
                                                        {u.isBanned ? 'Unban' : 'Ban'}
                                                    </Button>
                                                )}
                                            </td>
                                        </tr>
                                    ))}
                                    {filteredUsers.length === 0 && (
                                        <tr><td colSpan={6} className="p-8 text-center">No users found.</td></tr>
                                    )}
                                </tbody>
                            </table>
                        </div>
                    </div>
                )}

                {/* EVENTS TAB */}
                {activeTab === 'events' && (
                    <div className="overflow-x-auto">
                        <div className="p-4 border-b border-zinc-800">
                            <span className="font-bold text-white">All Events ({filteredEvents.length})</span>
                        </div>
                        <table className="w-full text-left text-sm text-zinc-400">
                            <thead className="bg-black text-zinc-500 uppercase font-bold text-xs">
                                <tr>
                                    <th className="p-4">Event</th>
                                    <th className="p-4">Organizer</th>
                                    <th className="p-4">Date</th>
                                    <th className="p-4">Registrations</th>
                                    <th className="p-4">Status</th>
                                    <th className="p-4">Actions</th>
                                </tr>
                            </thead>
                            <tbody>
                                {filteredEvents.map(e => (
                                    <tr key={e.id} className="border-t border-zinc-800 hover:bg-zinc-800/50">
                                        <td className="p-4">
                                            <div className="font-bold text-white">{e.title}</div>
                                            <div className="text-xs text-zinc-500">{e.location}</div>
                                        </td>
                                        <td className="p-4">
                                            <div className="text-white">{getOrganizerName(e.ownerId)}</div>
                                        </td>
                                        <td className="p-4 text-xs">{new Date(e.date).toLocaleDateString()}</td>
                                        <td className="p-4">
                                            <span className="font-mono">{e.registeredCount || 0}/{e.capacity || '∞'}</span>
                                        </td>
                                        <td className="p-4">
                                            {e.moderationStatus === 'rejected' ? (
                                                <Badge color="red">Rejected</Badge>
                                            ) : e.isDraft ? (
                                                <Badge color="gray">Draft</Badge>
                                            ) : (
                                                <Badge color="green">Active</Badge>
                                            )}
                                        </td>
                                        <td className="p-4 flex gap-2">
                                            <button 
                                                onClick={() => navigate(`/event/${e.id}`)} 
                                                className="p-2 hover:bg-zinc-700 rounded text-blue-400"
                                                title="View Event"
                                            >
                                                <ExternalLink size={14} />
                                            </button>
                                            <button 
                                                onClick={() => handleRejectEvent(e)} 
                                                className="p-2 hover:bg-red-900/30 text-red-500 rounded"
                                                title="Reject Event"
                                            >
                                                <Ban size={14} />
                                            </button>
                                            <button 
                                                onClick={() => handleDeleteEvent(e)} 
                                                className="p-2 hover:bg-red-900/30 text-red-500 rounded"
                                                title="Delete Event"
                                            >
                                                <Trash2 size={14} />
                                            </button>
                                        </td>
                                    </tr>
                                ))}
                                {filteredEvents.length === 0 && (
                                    <tr><td colSpan={6} className="p-8 text-center">No events found.</td></tr>
                                )}
                            </tbody>
                        </table>
                    </div>
                )}

                {/* REGISTRATIONS TAB */}
                {activeTab === 'registrations' && (
                    <div className="overflow-x-auto">
                        <div className="p-4 border-b border-zinc-800 flex justify-between items-center">
                            <span className="font-bold text-white">All Registrations ({registrations.length})</span>
                            <Button size="sm" variant="outline" onClick={() => {
                                const headers = ['Date', 'Event', 'Attendee Name', 'Email', 'Status', 'Amount', 'Affiliate', 'Promo Code'];
                                const rows = registrations.map(r => {
                                    const event = events.find(e => e.id === r.eventId);
                                    return [
                                        new Date(r.timestamp).toLocaleDateString(),
                                        event?.title || r.eventTitle || 'Unknown',
                                        r.attendeeName,
                                        r.attendeeEmail,
                                        r.paymentStatus,
                                        `$${((r.totalAmount || 0) + (r.taxAmount || 0)).toFixed(2)}`,
                                        r.affiliateCode || '-',
                                        r.promoCodeUsed || '-'
                                    ];
                                });
                                const csv = [headers.join(','), ...rows.map(r => r.map(c => `"${c}"`).join(','))].join('\n');
                                const blob = new Blob([csv], { type: 'text/csv' });
                                const url = URL.createObjectURL(blob);
                                const a = document.createElement('a');
                                a.href = url;
                                a.download = `registrations-${new Date().toISOString().split('T')[0]}.csv`;
                                a.click();
                            }}>
                                <Download size={14} className="mr-2" /> Export CSV
                            </Button>
                        </div>
                        <table className="w-full text-left text-sm text-zinc-400">
                            <thead className="bg-black text-zinc-500 uppercase font-bold text-xs">
                                <tr>
                                    <th className="p-4">Date</th>
                                    <th className="p-4">Event</th>
                                    <th className="p-4">Organizer</th>
                                    <th className="p-4">Attendee</th>
                                    <th className="p-4">Tickets</th>
                                    <th className="p-4">Status</th>
                                    <th className="p-4">Affiliate</th>
                                    <th className="p-4 text-right">Amount</th>
                                </tr>
                            </thead>
                            <tbody>
                                {registrations.map(r => {
                                    const event = events.find(e => e.id === r.eventId);
                                    const ticketCount = r.tickets?.length || 0;
                                    return (
                                        <tr key={r.id} className="border-t border-zinc-800 hover:bg-zinc-800/50">
                                            <td className="p-4 text-xs">
                                                <div>{new Date(r.timestamp).toLocaleDateString()}</div>
                                                <div className="text-zinc-600">{new Date(r.timestamp).toLocaleTimeString()}</div>
                                            </td>
                                            <td className="p-4 font-bold text-white max-w-[200px] truncate">
                                                {event?.title || r.eventTitle || 'Unknown Event'}
                                            </td>
                                            <td className="p-4">
                                                {event ? (event.ownerName || getOrganizerName(event.ownerId)) : '-'}
                                            </td>
                                            <td className="p-4">
                                                <div className="text-white font-medium">{r.attendeeName || 'N/A'}</div>
                                                <div className="text-xs opacity-60">{r.attendeeEmail || 'No email'}</div>
                                                {r.phoneNumber && <div className="text-xs opacity-40">{r.phoneNumber}</div>}
                                            </td>
                                            <td className="p-4">
                                                <span className="bg-zinc-800 px-2 py-1 rounded text-xs font-mono">
                                                    {ticketCount} ticket{ticketCount !== 1 ? 's' : ''}
                                                </span>
                                            </td>
                                            <td className="p-4">
                                                <Badge color={
                                                    r.paymentStatus === 'paid' || r.paymentStatus === 'completed' ? 'green' : 
                                                    r.paymentStatus === 'refunded' ? 'red' : 'yellow'
                                                }>
                                                    {r.paymentStatus || 'unknown'}
                                                </Badge>
                                                {r.checkedIn && (
                                                    <Badge color="blue" className="ml-1">Checked In</Badge>
                                                )}
                                            </td>
                                            <td className="p-4">
                                                {r.affiliateCode ? (
                                                    <span className="font-mono text-purple-400 text-xs bg-purple-500/10 px-2 py-1 rounded">
                                                        {r.affiliateCode}
                                                    </span>
                                                ) : r.promoCodeUsed ? (
                                                    <span className="font-mono text-yellow-400 text-xs bg-yellow-500/10 px-2 py-1 rounded">
                                                        {r.promoCodeUsed}
                                                    </span>
                                                ) : (
                                                    <span className="text-zinc-600">-</span>
                                                )}
                                            </td>
                                            <td className="p-4 text-right">
                                                <div className="font-mono text-white font-bold">
                                                    ${((r.totalAmount || 0)).toFixed(2)}
                                                </div>
                                                {(r.taxAmount || 0) > 0 && (
                                                    <div className="text-xs text-zinc-500">+${r.taxAmount?.toFixed(2)} tax</div>
                                                )}
                                                {(r.serviceFee || 0) > 0 && (
                                                    <div className="text-xs text-zinc-600">Fee: ${r.serviceFee?.toFixed(2)}</div>
                                                )}
                                            </td>
                                        </tr>
                                    );
                                })}
                                {registrations.length === 0 && (
                                    <tr><td colSpan={8} className="p-8 text-center text-zinc-500">
                                        No registrations found. Registrations will appear here when users purchase tickets.
                                    </td></tr>
                                )}
                            </tbody>
                        </table>
                    </div>
                )}

                {/* FINANCE TAB */}
                {activeTab === 'finance' && (
                    <div className="p-8">
                        <div className="flex justify-between items-center mb-6">
                            <h2 className="text-xl font-bold text-white flex items-center gap-2">
                                <DollarSign size={24} className="text-[#E0FF20]" /> Financial Overview
                            </h2>
                            <Button size="sm" onClick={exportFinancialsCSV}>
                                <Download size={14} className="mr-2" /> Export CSV
                            </Button>
                        </div>

                        {/* Financial Summary Cards */}
                        <div className="grid grid-cols-1 md:grid-cols-5 gap-4 mb-8">
                            <Card className="p-6 border-zinc-700 bg-zinc-800/30">
                                <div className="text-xs font-bold text-zinc-500 uppercase mb-2">Total Gross Volume</div>
                                <div className="text-3xl font-black text-white">${stats.totalVolume.toFixed(2)}</div>
                            </Card>
                            <Card className="p-6 border-zinc-700 bg-zinc-800/30">
                                <div className="text-xs font-bold text-zinc-500 uppercase mb-2">Platform Fees</div>
                                <div className="text-3xl font-black text-[#E0FF20]">${stats.platformFees.toFixed(2)}</div>
                                <div className="text-xs text-zinc-500 mt-1">Revenue to OpenTicket</div>
                            </Card>
                            <Card className="p-6 border-zinc-700 bg-gradient-to-br from-pink-900/30 to-purple-900/30 border-pink-500/30">
                                <div className="text-xs font-bold text-pink-400 uppercase mb-2 flex items-center gap-1">
                                    <Heart size={12} fill="currentColor" /> Platform Donations
                                </div>
                                <div className="text-3xl font-black text-pink-400">${stats.platformDonations.toFixed(2)}</div>
                                <div className="text-xs text-zinc-500 mt-1">From attendees</div>
                            </Card>
                            <Card className="p-6 border-zinc-700 bg-zinc-800/30">
                                <div className="text-xs font-bold text-zinc-500 uppercase mb-2">Stripe Fees</div>
                                <div className="text-3xl font-black text-red-400">${stats.stripeFees.toFixed(2)}</div>
                                <div className="text-xs text-zinc-500 mt-1">Paid to Stripe</div>
                            </Card>
                            <Card className="p-6 border-zinc-700 bg-zinc-800/30">
                                <div className="text-xs font-bold text-zinc-500 uppercase mb-2">Subscription Revenue</div>
                                <div className="text-3xl font-black text-purple-400">${stats.subscriptionRevenue.toFixed(2)}</div>
                                <div className="text-xs text-zinc-500 mt-1">Pro & Premium plans</div>
                            </Card>
                        </div>

                        {/* Platform Donations Detail Section */}
                        <div className="bg-gradient-to-r from-pink-900/20 to-purple-900/20 border border-pink-500/30 rounded-2xl p-6 mb-8">
                            <div className="flex justify-between items-center mb-6">
                                <h3 className="text-lg font-bold text-white flex items-center gap-2">
                                    <Heart size={20} className="text-pink-400" fill="currentColor" /> Total Platform Donations
                                </h3>
                                <div className="text-right">
                                    <div className="text-3xl font-black text-pink-400">${stats.donationBreakdown.total.toFixed(2)}</div>
                                    <div className="text-xs text-zinc-500">{stats.donationBreakdown.count} donations total</div>
                                </div>
                            </div>

                            {/* Monthly Comparison */}
                            <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
                                <Card className="p-4 bg-zinc-800/50 border-zinc-700">
                                    <div className="text-xs text-zinc-500 uppercase font-bold mb-1">This Month</div>
                                    <div className="text-2xl font-black text-pink-400">${stats.donationBreakdown.thisMonth.toFixed(2)}</div>
                                </Card>
                                <Card className="p-4 bg-zinc-800/50 border-zinc-700">
                                    <div className="text-xs text-zinc-500 uppercase font-bold mb-1">Last Month</div>
                                    <div className="text-2xl font-black text-zinc-400">${stats.donationBreakdown.lastMonth.toFixed(2)}</div>
                                </Card>
                                <Card className="p-4 bg-zinc-800/50 border-zinc-700">
                                    <div className="text-xs text-zinc-500 uppercase font-bold mb-1">Avg Donation</div>
                                    <div className="text-2xl font-black text-white">
                                        ${stats.donationBreakdown.count > 0 
                                            ? (stats.donationBreakdown.total / stats.donationBreakdown.count).toFixed(2) 
                                            : '0.00'}
                                    </div>
                                </Card>
                                <Card className="p-4 bg-zinc-800/50 border-zinc-700">
                                    <div className="text-xs text-zinc-500 uppercase font-bold mb-1">Growth</div>
                                    <div className={`text-2xl font-black ${stats.donationBreakdown.thisMonth >= stats.donationBreakdown.lastMonth ? 'text-green-400' : 'text-red-400'}`}>
                                        {stats.donationBreakdown.lastMonth > 0 
                                            ? `${((stats.donationBreakdown.thisMonth - stats.donationBreakdown.lastMonth) / stats.donationBreakdown.lastMonth * 100).toFixed(0)}%`
                                            : stats.donationBreakdown.thisMonth > 0 ? '+100%' : '0%'}
                                    </div>
                                </Card>
                            </div>

                            {/* Donation Amount Distribution */}
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                                <div>
                                    <h4 className="text-sm font-bold text-zinc-400 uppercase mb-3">Donation Distribution</h4>
                                    <div className="space-y-2">
                                        {Object.entries(stats.donationBreakdown.byAmount).map(([amount, count]) => {
                                            const percentage = stats.donationBreakdown.count > 0 
                                                ? (count / stats.donationBreakdown.count * 100) 
                                                : 0;
                                            return (
                                                <div key={amount} className="flex items-center gap-3">
                                                    <span className="w-16 text-sm font-bold text-white">{amount}</span>
                                                    <div className="flex-1 bg-zinc-700 rounded-full h-4 overflow-hidden">
                                                        <div 
                                                            className="bg-gradient-to-r from-pink-500 to-purple-500 h-full rounded-full transition-all duration-500"
                                                            style={{ width: `${percentage}%` }}
                                                        />
                                                    </div>
                                                    <span className="w-12 text-right text-sm text-zinc-400">{count}</span>
                                                </div>
                                            );
                                        })}
                                    </div>
                                </div>

                                {/* Recent Donations */}
                                <div>
                                    <h4 className="text-sm font-bold text-zinc-400 uppercase mb-3">Recent Donations</h4>
                                    <div className="space-y-2 max-h-[200px] overflow-y-auto">
                                        {stats.donationBreakdown.recent.length > 0 ? (
                                            stats.donationBreakdown.recent.map((donation, idx) => (
                                                <div key={idx} className="flex items-center justify-between p-2 bg-zinc-800/50 rounded-lg">
                                                    <div className="flex-1 min-w-0">
                                                        <div className="text-sm font-bold text-white truncate">{donation.attendeeName}</div>
                                                        <div className="text-xs text-zinc-500 truncate">{donation.eventTitle}</div>
                                                    </div>
                                                    <div className="text-right ml-2">
                                                        <div className="text-sm font-black text-pink-400">${donation.amount}</div>
                                                        <div className="text-xs text-zinc-600">
                                                            {new Date(donation.createdAt).toLocaleDateString()}
                                                        </div>
                                                    </div>
                                                </div>
                                            ))
                                        ) : (
                                            <div className="text-center py-8 text-zinc-500">
                                                <Heart size={32} className="mx-auto mb-2 opacity-30" />
                                                <p className="text-sm">No donations yet</p>
                                            </div>
                                        )}
                                    </div>
                                </div>
                            </div>

                            <div className="mt-4 pt-4 border-t border-zinc-700/50">
                                <p className="text-xs text-zinc-500 text-center">
                                    💡 Platform donations are separate from ticket revenue and go directly to supporting OpenTicket operations.
                                </p>
                            </div>
                        </div>

                        {/* Platform Payouts Section */}
                        <div className="bg-gradient-to-r from-green-900/20 to-emerald-900/20 border border-green-500/30 rounded-2xl p-6 mb-8">
                            <div className="flex justify-between items-center mb-4">
                                <h3 className="text-lg font-bold text-white flex items-center gap-2">
                                    <Wallet size={20} className="text-green-400" /> Platform Payouts
                                </h3>
                                <Button 
                                    onClick={() => setShowPayoutModal(true)}
                                    className="bg-green-600 hover:bg-green-700 border-none"
                                >
                                    <DollarSign size={16} className="mr-2" /> Schedule Payout
                                </Button>
                            </div>
                            
                            {/* Pending Amounts */}
                            <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
                                <div className="bg-black/30 rounded-xl p-4">
                                    <div className="text-xs font-bold text-zinc-500 uppercase mb-1">Pending Platform Fees</div>
                                    <div className="text-2xl font-black text-[#E0FF20]">
                                        ${(pendingPayoutSummary?.platformFees?.amount || 0).toFixed(2)}
                                    </div>
                                    <div className="text-xs text-zinc-500">
                                        {pendingPayoutSummary?.platformFees?.transactionCount || 0} transactions
                                    </div>
                                </div>
                                <div className="bg-black/30 rounded-xl p-4">
                                    <div className="text-xs font-bold text-zinc-500 uppercase mb-1">Pending Subscriptions</div>
                                    <div className="text-2xl font-black text-purple-400">
                                        ${(pendingPayoutSummary?.subscriptions?.amount || 0).toFixed(2)}
                                    </div>
                                    <div className="text-xs text-zinc-500">
                                        {pendingPayoutSummary?.subscriptions?.transactionCount || 0} payments
                                    </div>
                                </div>
                                <div className="bg-black/30 rounded-xl p-4">
                                    <div className="text-xs font-bold text-zinc-500 uppercase mb-1">Total Pending</div>
                                    <div className="text-2xl font-black text-green-400">
                                        ${(pendingPayoutSummary?.total || 0).toFixed(2)}
                                    </div>
                                    <div className="text-xs text-zinc-500">Ready to withdraw</div>
                                </div>
                            </div>

                            {/* Payout History */}
                            {platformPayouts.length > 0 && (
                                <div className="bg-black/20 rounded-xl overflow-hidden">
                                    <div className="p-3 border-b border-zinc-800 text-xs font-bold text-zinc-500 uppercase">
                                        Recent Payouts
                                    </div>
                                    <table className="w-full text-sm">
                                        <thead className="bg-black/30 text-zinc-500 text-xs uppercase">
                                            <tr>
                                                <th className="p-3 text-left">Date</th>
                                                <th className="p-3 text-left">Type</th>
                                                <th className="p-3 text-right">Amount</th>
                                                <th className="p-3 text-center">Status</th>
                                            </tr>
                                        </thead>
                                        <tbody>
                                            {platformPayouts.slice(0, 5).map((payout: any) => (
                                                <tr key={payout.id} className="border-t border-zinc-800/50">
                                                    <td className="p-3 text-zinc-400">
                                                        {new Date(payout.created_at).toLocaleDateString()}
                                                    </td>
                                                    <td className="p-3">
                                                        <span className={`text-xs px-2 py-1 rounded-full ${
                                                            payout.payout_type === 'platform_fees' ? 'bg-yellow-500/20 text-yellow-400' :
                                                            payout.payout_type === 'subscriptions' ? 'bg-purple-500/20 text-purple-400' :
                                                            'bg-blue-500/20 text-blue-400'
                                                        }`}>
                                                            {payout.payout_type === 'platform_fees' ? 'Platform Fees' :
                                                             payout.payout_type === 'subscriptions' ? 'Subscriptions' : 'Combined'}
                                                        </span>
                                                    </td>
                                                    <td className="p-3 text-right font-mono text-white font-bold">
                                                        ${Number(payout.amount).toFixed(2)}
                                                    </td>
                                                    <td className="p-3 text-center">
                                                        <Badge color={
                                                            payout.status === 'completed' ? 'green' :
                                                            payout.status === 'processing' ? 'yellow' :
                                                            payout.status === 'cancelled' ? 'red' : 'blue'
                                                        }>
                                                            {payout.status}
                                                        </Badge>
                                                    </td>
                                                </tr>
                                            ))}
                                        </tbody>
                                    </table>
                                </div>
                            )}
                        </div>

                        {/* Payout Modal */}
                        {showPayoutModal && (
                            <div className="fixed inset-0 bg-black/80 flex items-center justify-center z-50 p-4">
                                <div className="bg-zinc-900 border border-zinc-700 rounded-2xl max-w-md w-full p-6">
                                    <div className="flex justify-between items-center mb-6">
                                        <h3 className="text-lg font-bold text-white">Schedule Payout</h3>
                                        <button onClick={() => setShowPayoutModal(false)} className="text-zinc-500 hover:text-white">
                                            <XCircle size={20} />
                                        </button>
                                    </div>

                                    <div className="space-y-4">
                                        <div>
                                            <label className="block text-xs font-bold text-zinc-500 uppercase mb-2">
                                                Payout Type
                                            </label>
                                            <select
                                                value={payoutType}
                                                onChange={e => setPayoutType(e.target.value as any)}
                                                className="w-full bg-black border border-zinc-700 rounded-lg p-3 text-white"
                                            >
                                                <option value="platform_fees">Platform Fees Only (${(pendingPayoutSummary?.platformFees?.amount || 0).toFixed(2)})</option>
                                                <option value="subscriptions">Subscriptions Only (${(pendingPayoutSummary?.subscriptions?.amount || 0).toFixed(2)})</option>
                                                <option value="combined">Combined (${(pendingPayoutSummary?.total || 0).toFixed(2)})</option>
                                            </select>
                                        </div>

                                        <div>
                                            <label className="block text-xs font-bold text-zinc-500 uppercase mb-2">
                                                Amount to Withdraw
                                            </label>
                                            <div className="text-3xl font-black text-green-400 bg-black/50 rounded-lg p-4 text-center">
                                                ${payoutType === 'platform_fees' 
                                                    ? (pendingPayoutSummary?.platformFees?.amount || 0).toFixed(2)
                                                    : payoutType === 'subscriptions'
                                                    ? (pendingPayoutSummary?.subscriptions?.amount || 0).toFixed(2)
                                                    : (pendingPayoutSummary?.total || 0).toFixed(2)
                                                }
                                            </div>
                                        </div>

                                        <div>
                                            <label className="block text-xs font-bold text-zinc-500 uppercase mb-2">
                                                Notes (optional)
                                            </label>
                                            <Input
                                                value={platformPayoutNotes}
                                                onChange={e => setPlatformPayoutNotes(e.target.value)}
                                                placeholder="e.g., Monthly payout for December"
                                                className="bg-black border-zinc-700"
                                            />
                                        </div>

                                        <div className="flex gap-3 mt-6">
                                            <Button 
                                                variant="outline" 
                                                onClick={() => setShowPayoutModal(false)}
                                                className="flex-1"
                                            >
                                                Cancel
                                            </Button>
                                            <Button 
                                                onClick={handleSchedulePlatformPayout}
                                                disabled={isProcessingPlatformPayout || (pendingPayoutSummary?.total || 0) <= 0}
                                                className="flex-1 bg-green-600 hover:bg-green-700 border-none"
                                            >
                                                {isProcessingPlatformPayout ? (
                                                    <><RefreshCw size={16} className="mr-2 animate-spin" /> Processing...</>
                                                ) : (
                                                    <><CheckCircle size={16} className="mr-2" /> Confirm Payout</>
                                                )}
                                            </Button>
                                        </div>
                                    </div>
                                </div>
                            </div>
                        )}

                        {/* Organizer Breakdown */}
                        {stats.organizerBreakdown.length > 0 && (
                            <div className="bg-zinc-900 border border-zinc-800 rounded-xl overflow-hidden mb-8">
                                <div className="p-4 border-b border-zinc-800 font-bold flex items-center gap-2">
                                    <Building2 size={16} /> Revenue by Organizer
                                </div>
                                <table className="w-full text-left text-sm text-zinc-400">
                                    <thead className="bg-black text-zinc-500 uppercase font-bold text-xs">
                                        <tr>
                                            <th className="p-4">Organizer</th>
                                            <th className="p-4 text-right">Transactions</th>
                                            <th className="p-4 text-right">Gross Volume</th>
                                            <th className="p-4 text-right text-[#E0FF20]">Platform Fees</th>
                                            <th className="p-4 text-right text-green-500">Organizer Net</th>
                                        </tr>
                                    </thead>
                                    <tbody>
                                        {stats.organizerBreakdown.map((org, idx) => (
                                            <tr key={idx} className="border-t border-zinc-800">
                                                <td className="p-4">
                                                    <div className="font-bold text-white">{org.organizerName}</div>
                                                    <div className="text-xs">{org.organizerEmail}</div>
                                                </td>
                                                <td className="p-4 text-right font-mono">{org.transactionCount}</td>
                                                <td className="p-4 text-right font-mono text-white">${org.totalVolume.toFixed(2)}</td>
                                                <td className="p-4 text-right font-mono text-[#E0FF20]">${org.platformFees.toFixed(2)}</td>
                                                <td className="p-4 text-right font-mono text-green-500">${org.netEarnings.toFixed(2)}</td>
                                            </tr>
                                        ))}
                                    </tbody>
                                </table>
                            </div>
                        )}

                        {/* Recent Transactions */}
                        <div className="bg-zinc-900 border border-zinc-800 rounded-xl overflow-hidden">
                            <div className="p-4 border-b border-zinc-800 font-bold flex justify-between">
                                <span>Recent Transactions</span>
                                <span className="text-xs font-mono bg-zinc-800 p-1 rounded text-zinc-400">Source: financial_transactions</span>
                            </div>
                            <table className="w-full text-left text-sm text-zinc-400">
                                <thead className="bg-black text-zinc-500 uppercase font-bold text-xs">
                                    <tr>
                                        <th className="p-4">ID</th>
                                        <th className="p-4">Event</th>
                                        <th className="p-4 text-right">Gross</th>
                                        <th className="p-4 text-right text-[#E0FF20]">Platform Fee</th>
                                        <th className="p-4 text-right text-red-400">Stripe Fee</th>
                                        <th className="p-4 text-right text-green-500">Organizer Net</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    {stats.recentTransactions.map((tx: any) => (
                                        <tr key={tx.id} className="border-t border-zinc-800">
                                            <td className="p-4 font-mono text-xs text-white">{tx.id.slice(0, 8)}...</td>
                                            <td className="p-4 text-white">{tx.event?.title || '-'}</td>
                                            <td className="p-4 text-right font-mono text-white">${(tx.gross_amount || 0).toFixed(2)}</td>
                                            <td className="p-4 text-right font-mono text-[#E0FF20]">${(tx.platform_fee || 0).toFixed(2)}</td>
                                            <td className="p-4 text-right font-mono text-red-400">${(tx.stripe_fee || 0).toFixed(2)}</td>
                                            <td className="p-4 text-right font-mono text-green-500">${(tx.organizer_net || 0).toFixed(2)}</td>
                                        </tr>
                                    ))}
                                    {stats.recentTransactions.length === 0 && (
                                        <tr><td colSpan={6} className="p-8 text-center">No financial records found.</td></tr>
                                    )}
                                </tbody>
                            </table>
                        </div>
                    </div>
                )}

                {/* AFFILIATES TAB */}
                {activeTab === 'affiliates' && (
                    <div className="p-8">
                        <div className="flex justify-between items-center mb-6">
                            <h2 className="text-xl font-bold text-white flex items-center gap-2">
                                <Gift size={24} className="text-purple-400" /> Affiliate Management
                            </h2>
                            <div className="flex gap-2">
                                <Button 
                                    size="sm" 
                                    variant="outline" 
                                    className="border-purple-500 text-purple-400 hover:bg-purple-500/10"
                                    onClick={async () => {
                                        try {
                                            const response = await fetch('/api/admin/affiliate/send-weekly-summaries', {
                                                method: 'POST',
                                                headers: { 
                                                    'Content-Type': 'application/json',
                                                    'Authorization': `Bearer ${await (window as any).firebase?.auth()?.currentUser?.getIdToken()}`
                                                }
                                            });
                                            const result = await response.json();
                                            if (result.success) {
                                                alert(`✅ Sent ${result.sent} weekly summaries to affiliates!`);
                                            } else {
                                                alert(`❌ Error: ${result.error}`);
                                            }
                                        } catch (e: any) {
                                            alert(`❌ Failed: ${e.message}`);
                                        }
                                    }}
                                >
                                    <Mail size={14} className="mr-2" /> Send Weekly Summary
                                </Button>
                                <Button size="sm" variant="outline" onClick={refreshData}>
                                    <RefreshCw size={14} className="mr-2" /> Refresh
                                </Button>
                                <Button size="sm" variant="outline" onClick={() => {
                                    const headers = ['Name', 'Email', 'Code', 'Clicks', 'Conversions', 'Rate', 'Earnings', 'Paid', 'Pending'];
                                    const rows = affiliates.map(a => [
                                        a.name, a.email, a.affiliateCode, a.clicks, a.conversions, 
                                        `${a.conversionRate.toFixed(1)}%`, `$${a.totalEarnings.toFixed(2)}`,
                                        `$${a.paidOut.toFixed(2)}`, `$${a.pendingPayout.toFixed(2)}`
                                    ]);
                                    const csv = [headers.join(','), ...rows.map(r => r.join(','))].join('\n');
                                    const blob = new Blob([csv], { type: 'text/csv' });
                                    const url = URL.createObjectURL(blob);
                                    const a = document.createElement('a');
                                    a.href = url;
                                    a.download = `affiliates-${new Date().toISOString().split('T')[0]}.csv`;
                                    a.click();
                                }}>
                                    <Download size={14} className="mr-2" /> Export CSV
                                </Button>
                            </div>
                        </div>

                        {/* Conversion Funnel Visualization */}
                        <div className="mb-8 bg-gradient-to-r from-purple-900/20 to-blue-900/20 border border-purple-500/30 rounded-2xl p-6">
                            <h3 className="text-lg font-bold text-white mb-4 flex items-center gap-2">
                                <TrendingUp size={20} className="text-purple-400" /> Conversion Funnel
                            </h3>
                            <div className="flex items-center justify-between">
                                {/* Step 1: Clicks */}
                                <div className="flex-1 text-center">
                                    <div className="bg-purple-500/20 rounded-xl p-4 mx-2">
                                        <div className="text-3xl font-black text-purple-400">
                                            {affiliates.reduce((sum, a) => sum + a.clicks, 0).toLocaleString()}
                                        </div>
                                        <div className="text-xs text-zinc-400 uppercase font-bold mt-1">Total Clicks</div>
                                    </div>
                                </div>
                                <div className="text-zinc-500">→</div>
                                {/* Step 2: Conversions */}
                                <div className="flex-1 text-center">
                                    <div className="bg-blue-500/20 rounded-xl p-4 mx-2">
                                        <div className="text-3xl font-black text-blue-400">
                                            {affiliates.reduce((sum, a) => sum + a.conversions, 0).toLocaleString()}
                                        </div>
                                        <div className="text-xs text-zinc-400 uppercase font-bold mt-1">Conversions</div>
                                    </div>
                                </div>
                                <div className="text-zinc-500">→</div>
                                {/* Step 3: Revenue */}
                                <div className="flex-1 text-center">
                                    <div className="bg-green-500/20 rounded-xl p-4 mx-2">
                                        <div className="text-3xl font-black text-green-400">
                                            ${affiliates.reduce((sum, a) => sum + a.totalEarnings, 0).toFixed(0)}
                                        </div>
                                        <div className="text-xs text-zinc-400 uppercase font-bold mt-1">Commission Earned</div>
                                    </div>
                                </div>
                            </div>
                            {/* Conversion Rate Bar */}
                            <div className="mt-6">
                                <div className="flex justify-between text-xs text-zinc-500 mb-2">
                                    <span>Overall Conversion Rate</span>
                                    <span className="font-mono">
                                        {(() => {
                                            const totalClicks = affiliates.reduce((sum, a) => sum + a.clicks, 0);
                                            const totalConversions = affiliates.reduce((sum, a) => sum + a.conversions, 0);
                                            return totalClicks > 0 ? ((totalConversions / totalClicks) * 100).toFixed(2) : '0.00';
                                        })()}%
                                    </span>
                                </div>
                                <div className="h-3 bg-zinc-800 rounded-full overflow-hidden">
                                    <div 
                                        className="h-full bg-gradient-to-r from-purple-500 to-green-500 rounded-full transition-all duration-500"
                                        style={{ 
                                            width: `${Math.min(100, (() => {
                                                const totalClicks = affiliates.reduce((sum, a) => sum + a.clicks, 0);
                                                const totalConversions = affiliates.reduce((sum, a) => sum + a.conversions, 0);
                                                return totalClicks > 0 ? (totalConversions / totalClicks) * 100 : 0;
                                            })())}%` 
                                        }}
                                    />
                                </div>
                            </div>
                        </div>

                        {/* Affiliate Summary Cards */}
                        <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-8">
                            <Card className="p-4 border-zinc-700 bg-zinc-800/30">
                                <div className="text-xs font-bold text-zinc-500 uppercase">Total Affiliates</div>
                                <div className="text-2xl font-black text-white">{affiliates.length}</div>
                            </Card>
                            <Card className="p-4 border-zinc-700 bg-zinc-800/30">
                                <div className="text-xs font-bold text-zinc-500 uppercase">Total Commissions</div>
                                <div className="text-2xl font-black text-purple-400">
                                    ${affiliates.reduce((sum, a) => sum + a.totalEarnings, 0).toFixed(2)}
                                </div>
                            </Card>
                            <Card className="p-4 border-zinc-700 bg-zinc-800/30">
                                <div className="text-xs font-bold text-zinc-500 uppercase">Pending Payouts</div>
                                <div className="text-2xl font-black text-yellow-400">
                                    ${affiliates.reduce((sum, a) => sum + a.pendingPayout, 0).toFixed(2)}
                                </div>
                            </Card>
                            <Card className="p-4 border-zinc-700 bg-zinc-800/30">
                                <div className="text-xs font-bold text-zinc-500 uppercase">Total Paid Out</div>
                                <div className="text-2xl font-black text-green-400">
                                    ${affiliates.reduce((sum, a) => sum + a.paidOut, 0).toFixed(2)}
                                </div>
                            </Card>
                        </div>

                        {/* Top Performers Section */}
                        {affiliates.length > 0 && (
                            <div className="mb-8 grid grid-cols-1 md:grid-cols-3 gap-4">
                                {/* Top by Clicks */}
                                <Card className="p-4 border-zinc-700 bg-zinc-800/30">
                                    <div className="text-xs font-bold text-zinc-500 uppercase mb-3 flex items-center gap-2">
                                        <Eye size={14} /> Top by Clicks
                                    </div>
                                    {[...affiliates].sort((a, b) => b.clicks - a.clicks).slice(0, 3).map((aff, i) => (
                                        <div key={aff.id} className="flex justify-between items-center py-2 border-b border-zinc-800 last:border-0">
                                            <div className="flex items-center gap-2">
                                                <span className={`w-5 h-5 rounded-full flex items-center justify-center text-xs font-bold ${i === 0 ? 'bg-yellow-500 text-black' : i === 1 ? 'bg-zinc-400 text-black' : 'bg-amber-700 text-white'}`}>
                                                    {i + 1}
                                                </span>
                                                <span className="text-sm text-white truncate max-w-[100px]">{aff.name}</span>
                                            </div>
                                            <span className="font-mono text-purple-400">{aff.clicks.toLocaleString()}</span>
                                        </div>
                                    ))}
                                </Card>
                                {/* Top by Conversions */}
                                <Card className="p-4 border-zinc-700 bg-zinc-800/30">
                                    <div className="text-xs font-bold text-zinc-500 uppercase mb-3 flex items-center gap-2">
                                        <CheckCircle size={14} /> Top by Conversions
                                    </div>
                                    {[...affiliates].sort((a, b) => b.conversions - a.conversions).slice(0, 3).map((aff, i) => (
                                        <div key={aff.id} className="flex justify-between items-center py-2 border-b border-zinc-800 last:border-0">
                                            <div className="flex items-center gap-2">
                                                <span className={`w-5 h-5 rounded-full flex items-center justify-center text-xs font-bold ${i === 0 ? 'bg-yellow-500 text-black' : i === 1 ? 'bg-zinc-400 text-black' : 'bg-amber-700 text-white'}`}>
                                                    {i + 1}
                                                </span>
                                                <span className="text-sm text-white truncate max-w-[100px]">{aff.name}</span>
                                            </div>
                                            <span className="font-mono text-blue-400">{aff.conversions}</span>
                                        </div>
                                    ))}
                                </Card>
                                {/* Top by Earnings */}
                                <Card className="p-4 border-zinc-700 bg-zinc-800/30">
                                    <div className="text-xs font-bold text-zinc-500 uppercase mb-3 flex items-center gap-2">
                                        <DollarSign size={14} /> Top by Earnings
                                    </div>
                                    {[...affiliates].sort((a, b) => b.totalEarnings - a.totalEarnings).slice(0, 3).map((aff, i) => (
                                        <div key={aff.id} className="flex justify-between items-center py-2 border-b border-zinc-800 last:border-0">
                                            <div className="flex items-center gap-2">
                                                <span className={`w-5 h-5 rounded-full flex items-center justify-center text-xs font-bold ${i === 0 ? 'bg-yellow-500 text-black' : i === 1 ? 'bg-zinc-400 text-black' : 'bg-amber-700 text-white'}`}>
                                                    {i + 1}
                                                </span>
                                                <span className="text-sm text-white truncate max-w-[100px]">{aff.name}</span>
                                            </div>
                                            <span className="font-mono text-green-400">${aff.totalEarnings.toFixed(0)}</span>
                                        </div>
                                    ))}
                                </Card>
                            </div>
                        )}

                        {/* Affiliate List */}
                        <div className="bg-zinc-900 border border-zinc-800 rounded-xl overflow-hidden mb-8">
                            <div className="p-4 border-b border-zinc-800 font-bold">
                                All Affiliates ({affiliates.length})
                            </div>
                            <table className="w-full text-left text-sm text-zinc-400">
                                <thead className="bg-black text-zinc-500 uppercase font-bold text-xs">
                                    <tr>
                                        <th className="p-4">Affiliate</th>
                                        <th className="p-4">Code</th>
                                        <th className="p-4 text-right">Clicks</th>
                                        <th className="p-4 text-right">Conversions</th>
                                        <th className="p-4 text-right">Rate</th>
                                        <th className="p-4 text-right">Earnings</th>
                                        <th className="p-4 text-right">Pending</th>
                                        <th className="p-4">Actions</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    {affiliates.map(aff => (
                                        <tr key={aff.id} className="border-t border-zinc-800 hover:bg-zinc-800/50">
                                            <td className="p-4">
                                                <div className="font-bold text-white">{aff.name}</div>
                                                <div className="text-xs">{aff.email}</div>
                                            </td>
                                            <td className="p-4 font-mono text-purple-400">{aff.affiliateCode}</td>
                                            <td className="p-4 text-right font-mono">{aff.clicks}</td>
                                            <td className="p-4 text-right font-mono">{aff.conversions}</td>
                                            <td className="p-4 text-right font-mono">{aff.conversionRate.toFixed(1)}%</td>
                                            <td className="p-4 text-right font-mono text-white">${aff.totalEarnings.toFixed(2)}</td>
                                            <td className="p-4 text-right">
                                                {aff.pendingPayout > 0 ? (
                                                    <span className="font-mono text-yellow-400">${aff.pendingPayout.toFixed(2)}</span>
                                                ) : (
                                                    <span className="text-zinc-500">$0.00</span>
                                                )}
                                            </td>
                                            <td className="p-4">
                                                <div className="flex gap-2">
                                                    <button 
                                                        onClick={() => setSelectedAffiliate(aff)}
                                                        className="p-2 hover:bg-zinc-700 rounded text-blue-400"
                                                        title="View Details"
                                                        data-testid={`view-affiliate-${aff.id}`}
                                                    >
                                                        <Eye size={14} />
                                                    </button>
                                                    {aff.pendingPayout > 0 && (
                                                        <Button 
                                                            size="sm" 
                                                            onClick={() => {
                                                                setSelectedAffiliate(aff);
                                                                setPayoutAmount(aff.pendingPayout.toFixed(2));
                                                            }}
                                                            data-testid={`pay-affiliate-${aff.id}`}
                                                        >
                                                            <Wallet size={12} className="mr-1" /> Pay
                                                        </Button>
                                                    )}
                                                </div>
                                            </td>
                                        </tr>
                                    ))}
                                    {affiliates.length === 0 && (
                                        <tr><td colSpan={8} className="p-8 text-center text-zinc-500">
                                            No affiliates found. Affiliates will appear here once they join your program.
                                        </td></tr>
                                    )}
                                </tbody>
                            </table>
                        </div>

                        {/* Payout Modal */}
                        {selectedAffiliate && (
                            <div className="fixed inset-0 bg-black/80 flex items-center justify-center z-50 p-4">
                                <Card className="max-w-2xl w-full p-6 border-zinc-700 bg-zinc-900">
                                    <div className="flex justify-between items-start mb-6">
                                        <div>
                                            <h3 className="text-xl font-bold text-white">{selectedAffiliate.name}</h3>
                                            <div className="text-sm text-zinc-400">{selectedAffiliate.email}</div>
                                            <div className="text-xs text-purple-400 font-mono mt-1">Code: {selectedAffiliate.affiliateCode}</div>
                                        </div>
                                        <button onClick={() => setSelectedAffiliate(null)} className="text-zinc-400 hover:text-white">
                                            <XCircle size={24} />
                                        </button>
                                    </div>

                                    {/* Affiliate Stats */}
                                    <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
                                        <div className="bg-zinc-800 p-3 rounded-xl">
                                            <div className="text-xs text-zinc-500">Clicks</div>
                                            <div className="text-lg font-bold text-white">{selectedAffiliate.clicks}</div>
                                        </div>
                                        <div className="bg-zinc-800 p-3 rounded-xl">
                                            <div className="text-xs text-zinc-500">Conversions</div>
                                            <div className="text-lg font-bold text-white">{selectedAffiliate.conversions}</div>
                                        </div>
                                        <div className="bg-zinc-800 p-3 rounded-xl">
                                            <div className="text-xs text-zinc-500">Total Earnings</div>
                                            <div className="text-lg font-bold text-purple-400">${selectedAffiliate.totalEarnings.toFixed(2)}</div>
                                        </div>
                                        <div className="bg-zinc-800 p-3 rounded-xl">
                                            <div className="text-xs text-zinc-500">Pending Payout</div>
                                            <div className="text-lg font-bold text-yellow-400">${selectedAffiliate.pendingPayout.toFixed(2)}</div>
                                        </div>
                                    </div>

                                    {/* Affiliate Settings - Commission & Discount */}
                                    <div className="border border-purple-500/30 bg-purple-900/10 rounded-xl p-4 mb-6">
                                        <h4 className="font-bold text-purple-400 mb-4 flex items-center gap-2">
                                            <Percent size={16} /> Affiliate Rates
                                        </h4>
                                        <div className="grid grid-cols-2 gap-4">
                                            <div>
                                                <label className="block text-xs font-bold text-zinc-500 uppercase mb-2">
                                                    Commission Rate
                                                </label>
                                                <div className="flex items-center gap-2">
                                                    <Input
                                                        type="number"
                                                        min="0"
                                                        max="100"
                                                        value={editCommissionRate ?? selectedAffiliate.commissionRate}
                                                        onChange={e => setEditCommissionRate(Number(e.target.value))}
                                                        className="bg-black border-zinc-700 w-20"
                                                    />
                                                    <span className="text-zinc-400">%</span>
                                                    <span className="text-xs text-zinc-500 ml-2">of referred sales</span>
                                                </div>
                                            </div>
                                            <div>
                                                <label className="block text-xs font-bold text-zinc-500 uppercase mb-2">
                                                    User Discount (Pro/Premium)
                                                </label>
                                                <div className="flex items-center gap-2">
                                                    <Input
                                                        type="number"
                                                        min="0"
                                                        max="100"
                                                        value={editDiscountPercent ?? selectedAffiliate.discountPercent}
                                                        onChange={e => setEditDiscountPercent(Number(e.target.value))}
                                                        className="bg-black border-zinc-700 w-20"
                                                    />
                                                    <span className="text-zinc-400">%</span>
                                                    <span className="text-xs text-zinc-500 ml-2">off for signups</span>
                                                </div>
                                            </div>
                                        </div>
                                        <Button 
                                            size="sm"
                                            onClick={handleUpdateAffiliateRates}
                                            disabled={isSavingRates}
                                            className="mt-4"
                                        >
                                            {isSavingRates ? (
                                                <><RefreshCw size={14} className="mr-2 animate-spin" /> Saving...</>
                                            ) : (
                                                <><Save size={14} className="mr-2" /> Save Rates</>
                                            )}
                                        </Button>
                                    </div>

                                    {/* Payout Form */}
                                    {selectedAffiliate.pendingPayout > 0 && (
                                        <div className="border-t border-zinc-800 pt-6">
                                            <h4 className="font-bold text-white mb-4">Process Payout</h4>
                                            <div className="grid grid-cols-2 gap-4 mb-4">
                                                <Input
                                                    label="Amount ($)"
                                                    type="number"
                                                    value={payoutAmount}
                                                    onChange={e => setPayoutAmount(e.target.value)}
                                                    placeholder={selectedAffiliate.pendingPayout.toFixed(2)}
                                                    className="bg-black border-zinc-700"
                                                />
                                                <div>
                                                    <label className="block text-xs font-bold text-zinc-500 uppercase mb-2">Method</label>
                                                    <select
                                                        value={payoutMethod}
                                                        onChange={e => setPayoutMethod(e.target.value as any)}
                                                        className="w-full bg-black border border-zinc-700 rounded-xl px-4 py-3 text-white"
                                                    >
                                                        <option value="stripe" disabled={!selectedAffiliate.stripeConnectId}>
                                                            Stripe {!selectedAffiliate.stripeConnectId && '(Not Connected)'}
                                                        </option>
                                                        <option value="offline">Offline / Manual</option>
                                                    </select>
                                                </div>
                                            </div>
                                            <Input
                                                label="Notes (optional)"
                                                value={affiliatePayoutNotes}
                                                onChange={e => setAffiliatePayoutNotes(e.target.value)}
                                                placeholder="e.g., Bank transfer, PayPal, etc."
                                                className="bg-black border-zinc-700 mb-4"
                                            />
                                            <Button 
                                                onClick={handleProcessAffiliatePayout}
                                                disabled={isProcessingPayout || !payoutAmount}
                                                className="w-full"
                                            >
                                                {isProcessingPayout ? (
                                                    <><RefreshCw size={16} className="mr-2 animate-spin" /> Processing...</>
                                                ) : (
                                                    <><Wallet size={16} className="mr-2" /> Process ${payoutAmount || '0.00'} Payout</>
                                                )}
                                            </Button>
                                        </div>
                                    )}

                                    {/* Transaction History */}
                                    {selectedAffiliate.transactions.length > 0 && (
                                        <div className="border-t border-zinc-800 pt-6 mt-6">
                                            <h4 className="font-bold text-white mb-4">Commission History</h4>
                                            <div className="max-h-48 overflow-y-auto">
                                                <table className="w-full text-xs">
                                                    <thead className="text-zinc-500 uppercase">
                                                        <tr>
                                                            <th className="p-2 text-left">Date</th>
                                                            <th className="p-2 text-left">Event</th>
                                                            <th className="p-2 text-right">Gross</th>
                                                            <th className="p-2 text-right">Commission</th>
                                                        </tr>
                                                    </thead>
                                                    <tbody>
                                                        {selectedAffiliate.transactions.map((tx: any) => (
                                                            <tr key={tx.id} className="border-t border-zinc-800">
                                                                <td className="p-2 text-zinc-400">
                                                                    {new Date(tx.created_at).toLocaleDateString()}
                                                                </td>
                                                                <td className="p-2 text-white">{tx.event?.title || '-'}</td>
                                                                <td className="p-2 text-right text-white">${(tx.gross_amount || 0).toFixed(2)}</td>
                                                                <td className="p-2 text-right text-purple-400">${(tx.affiliate_commission || 0).toFixed(2)}</td>
                                                            </tr>
                                                        ))}
                                                    </tbody>
                                                </table>
                                            </div>
                                        </div>
                                    )}
                                </Card>
                            </div>
                        )}

                        {/* Payout History */}
                        <div className="bg-zinc-900 border border-zinc-800 rounded-xl overflow-hidden">
                            <div className="p-4 border-b border-zinc-800 font-bold flex items-center gap-2">
                                <Clock size={16} /> Payout History (Audit Trail)
                            </div>
                            <table className="w-full text-left text-sm text-zinc-400">
                                <thead className="bg-black text-zinc-500 uppercase font-bold text-xs">
                                    <tr>
                                        <th className="p-4">Date</th>
                                        <th className="p-4">Affiliate</th>
                                        <th className="p-4">Code</th>
                                        <th className="p-4 text-right">Amount</th>
                                        <th className="p-4">Method</th>
                                        <th className="p-4">Status</th>
                                        <th className="p-4">Notes</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    {affiliatePayouts.map(payout => (
                                        <tr key={payout.id} className="border-t border-zinc-800">
                                            <td className="p-4 text-xs">{new Date(payout.createdAt).toLocaleString()}</td>
                                            <td className="p-4 text-white">{payout.affiliateName}</td>
                                            <td className="p-4 font-mono text-purple-400">{payout.affiliateCode}</td>
                                            <td className="p-4 text-right font-mono text-white">${payout.amount.toFixed(2)}</td>
                                            <td className="p-4 capitalize">{payout.method}</td>
                                            <td className="p-4">
                                                <Badge color={payout.status === 'paid' ? 'green' : payout.status === 'pending' ? 'yellow' : 'red'}>
                                                    {payout.status}
                                                </Badge>
                                            </td>
                                            <td className="p-4 text-xs max-w-[150px] truncate">{payout.notes || '-'}</td>
                                        </tr>
                                    ))}
                                    {affiliatePayouts.length === 0 && (
                                        <tr><td colSpan={7} className="p-8 text-center">No payout history yet.</td></tr>
                                    )}
                                </tbody>
                            </table>
                        </div>
                    </div>
                )}

                {/* BROADCAST TAB */}
                {activeTab === 'broadcast' && (
                    <div className="p-8">
                        <h2 className="text-xl font-bold text-white mb-4 flex items-center gap-2">
                            <Megaphone size={24} className="text-[#E0FF20]" /> System Broadcast
                        </h2>
                        <div className="max-w-2xl">
                            <div className="mb-4">
                                <label className="block text-xs font-bold text-zinc-500 uppercase mb-2">Target Audience</label>
                                <div className="flex gap-2">
                                    {['all', 'organizers', 'affiliates'].map(target => (
                                        <button
                                            key={target}
                                            onClick={() => setBroadcastTarget(target as any)}
                                            className={`px-4 py-2 rounded-lg font-bold capitalize ${
                                                broadcastTarget === target
                                                    ? 'bg-[#E0FF20] text-black'
                                                    : 'bg-zinc-800 text-zinc-400 hover:bg-zinc-700'
                                            }`}
                                        >
                                            {target === 'all' ? 'All Users' : target}
                                        </button>
                                    ))}
                                </div>
                            </div>
                            <RichTextarea
                                label="Broadcast Message"
                                value={broadcastMsg}
                                onChange={(e: any) => setBroadcastMsg(e.target.value)}
                                placeholder="Message to display on dashboards..."
                                className="mb-4"
                            />
                            <div className="flex gap-2">
                                <Button onClick={handleSendBroadcast} disabled={!broadcastMsg}>
                                    <Send size={16} className="mr-2" /> Send to {broadcastTarget === 'all' ? 'All' : broadcastTarget}
                                </Button>
                                <Button variant="outline" onClick={handleClearBroadcast}>Clear Active Broadcast</Button>
                            </div>
                        </div>
                        {activeNotification && (
                            <div className="mt-8 p-4 border border-zinc-700 rounded-xl bg-zinc-800/50">
                                <div className="text-xs font-bold uppercase text-zinc-500 mb-2">Active Broadcast</div>
                                <div dangerouslySetInnerHTML={{ __html: activeNotification.message }} className="text-white" />
                            </div>
                        )}
                    </div>
                )}

                {/* PROMO CODES TAB */}
                {activeTab === 'promo' && (
                    <div className="p-8">
                        <h2 className="text-xl font-bold text-white mb-6 flex items-center gap-2">
                            <Tag size={24} className="text-[#E0FF20]" /> Promo Code Management
                        </h2>

                        {/* Create New Promo Code */}
                        <Card className="p-6 border-zinc-700 bg-zinc-800/30 mb-8">
                            <h3 className="font-bold text-white mb-4">Create New Promo Code</h3>
                            <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-4">
                                <Input
                                    label="Promo Code"
                                    placeholder="e.g., SUMMER2026"
                                    value={newPromo.code}
                                    onChange={e => setNewPromo({ ...newPromo, code: e.target.value.toUpperCase() })}
                                    className="bg-black border-zinc-700"
                                />
                                <div>
                                    <label className="block text-xs font-bold text-zinc-500 uppercase mb-2">Discount Type</label>
                                    <select
                                        value={newPromo.type}
                                        onChange={e => setNewPromo({ ...newPromo, type: e.target.value as any })}
                                        className="w-full bg-black border border-zinc-700 rounded-xl px-4 py-3 text-white"
                                    >
                                        <option value="percentage">Percentage (%)</option>
                                        <option value="fixed">Fixed Amount ($)</option>
                                    </select>
                                </div>
                                <Input
                                    label={newPromo.type === 'percentage' ? 'Discount %' : 'Discount $'}
                                    type="number"
                                    value={newPromo.value}
                                    onChange={e => setNewPromo({ ...newPromo, value: Number(e.target.value) })}
                                    className="bg-black border-zinc-700"
                                />
                            </div>
                            <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-4">
                                <div>
                                    <label className="block text-xs font-bold text-zinc-500 uppercase mb-2">Applies To</label>
                                    <select
                                        value={newPromo.target}
                                        onChange={e => setNewPromo({ ...newPromo, target: e.target.value as any })}
                                        className="w-full bg-black border border-zinc-700 rounded-xl px-4 py-3 text-white"
                                    >
                                        <option value="all">All (Subscriptions & Tickets)</option>
                                        <option value="subscription">Subscriptions Only (Pro/Premium)</option>
                                        <option value="ticket">Tickets Only</option>
                                    </select>
                                </div>
                                <Input
                                    label="Usage Limit (0 = unlimited)"
                                    type="number"
                                    value={newPromo.usageLimit}
                                    onChange={e => setNewPromo({ ...newPromo, usageLimit: Number(e.target.value) })}
                                    className="bg-black border-zinc-700"
                                />
                                <Input
                                    label="Expires At (optional)"
                                    type="date"
                                    value={newPromo.expiresAt}
                                    onChange={e => setNewPromo({ ...newPromo, expiresAt: e.target.value })}
                                    className="bg-black border-zinc-700"
                                />
                            </div>
                            <Button onClick={handleCreatePromoCode}>
                                <Tag size={16} className="mr-2" /> Create Promo Code
                            </Button>
                        </Card>

                        {/* Existing Promo Codes */}
                        <div className="bg-zinc-900 border border-zinc-800 rounded-xl overflow-hidden">
                            <div className="p-4 border-b border-zinc-800 font-bold">
                                Active Promo Codes ({promoCodes.length})
                            </div>
                            <table className="w-full text-left text-sm text-zinc-400">
                                <thead className="bg-black text-zinc-500 uppercase font-bold text-xs">
                                    <tr>
                                        <th className="p-4">Code</th>
                                        <th className="p-4">Discount</th>
                                        <th className="p-4">Applies To</th>
                                        <th className="p-4">Usage</th>
                                        <th className="p-4">Status</th>
                                        <th className="p-4">Actions</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    {promoCodes.map(promo => (
                                        <tr key={promo.id} className="border-t border-zinc-800">
                                            <td className="p-4 font-mono font-bold text-[#E0FF20]">{promo.code}</td>
                                            <td className="p-4">
                                                {promo.type === 'percentage' ? `${promo.value}%` : `$${promo.value}`}
                                            </td>
                                            <td className="p-4 capitalize">{promo.target}</td>
                                            <td className="p-4">
                                                {promo.usageCount}/{promo.usageLimit || '∞'}
                                            </td>
                                            <td className="p-4">
                                                <Badge color={promo.isActive ? 'green' : 'gray'}>
                                                    {promo.isActive ? 'Active' : 'Inactive'}
                                                </Badge>
                                            </td>
                                            <td className="p-4 flex gap-2">
                                                <Button 
                                                    size="sm" 
                                                    variant="outline" 
                                                    onClick={() => handleTogglePromoCode(promo)}
                                                >
                                                    {promo.isActive ? 'Disable' : 'Enable'}
                                                </Button>
                                                <button 
                                                    onClick={() => handleDeletePromoCode(promo)} 
                                                    className="p-2 hover:bg-red-900/30 text-red-500 rounded"
                                                >
                                                    <Trash2 size={14} />
                                                </button>
                                            </td>
                                        </tr>
                                    ))}
                                    {promoCodes.length === 0 && (
                                        <tr><td colSpan={6} className="p-8 text-center">No promo codes created yet.</td></tr>
                                    )}
                                </tbody>
                            </table>
                        </div>
                    </div>
                )}

                {/* SETTINGS TAB */}
                {activeTab === 'settings' && (
                    <div className="p-8">
                        <h2 className="text-xl font-bold text-white mb-6 flex items-center gap-2">
                            <Settings size={24} className="text-[#E0FF20]" /> Platform Configuration
                        </h2>

                        <div className="max-w-2xl space-y-6">
                            <div className="bg-zinc-800/50 p-6 rounded-2xl border border-zinc-700">
                                <h3 className="font-bold text-white mb-4 flex items-center gap-2">
                                    <CreditCard size={20} className="text-blue-400" /> Stripe Connect Integration
                                </h3>
                                <p className="text-sm text-zinc-400 mb-6">
                                    Configure your platform's Stripe keys here. These will be used to process payments and split fees from organizers.
                                </p>

                                <div className="space-y-4">
                                    {platformStripeId ? (
                                        <div className="bg-green-900/20 border border-green-900/50 p-3 rounded-lg flex justify-between items-center mb-4">
                                            <div className="text-green-500 font-bold flex items-center gap-2"><CheckCircle size={16} /> Connected: {platformStripeId}</div>
                                            <Button size="sm" variant="outline" onClick={() => setPlatformStripeId('')} className="text-xs h-7">Disconnect</Button>
                                        </div>
                                    ) : (
                                        <div className="mb-4">
                                            <label className="block text-xs font-bold text-zinc-500 uppercase mb-2">Platform Account</label>
                                            <Button
                                                onClick={async () => {
                                                    const res = await StorageService.connectStripeAccount(currentUser.id, 'standard');
                                                    if (res.success) {
                                                        setPlatformStripeId(res.stripeId);
                                                    }
                                                }}
                                                className="w-full bg-[#635BFF] hover:bg-[#534ac2] text-white border-none"
                                            >
                                                Connect Platform Account
                                            </Button>
                                        </div>
                                    )}
                                    <Input
                                        label="Publishable Key"
                                        placeholder="pk_live_..."
                                        value={platformPublishableKey}
                                        onChange={e => setPlatformPublishableKey(e.target.value)}
                                        className="bg-black border-zinc-700 text-white"
                                    />
                                    <div className="relative">
                                        <Input
                                            label="Secret Key"
                                            placeholder="sk_live_..."
                                            type="password"
                                            value={platformSecretKey}
                                            onChange={e => setPlatformSecretKey(e.target.value)}
                                            className="bg-black border-zinc-700 text-white"
                                        />
                                        <div className="absolute right-0 top-0 mt-8 mr-3 text-zinc-500 pointer-events-none">
                                            <Lock size={16} />
                                        </div>
                                    </div>
                                </div>

                                <div className="mt-6 flex justify-end">
                                    <Button onClick={handleSavePlatformSettings} className="bg-[#635BFF] hover:bg-[#534ac2] text-white border-none">
                                        <Save size={16} className="mr-2" /> Save Configuration
                                    </Button>
                                </div>
                            </div>
                        </div>
                    </div>
                )}
            </div>
        </div>
    );
};
