
import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { StorageService } from '../services/storageService';
import { User, Event, Registration } from '../types';
import { Card, Button, Badge, Input, RichTextarea, Select } from './UI';
import { Users, Ticket, DollarSign, Search, Shield, Lock, Trash2, Megaphone, Send, Ban, CheckCircle, ExternalLink, RefreshCw, XCircle, AlertTriangle, AlertCircle, EyeOff, CheckCircle2, Settings, CreditCard, Crown, TrendingUp, Save, Download, Tag, Percent, Calendar, Mail, Building2, UserCheck, FileText, Gift, Wallet, Clock, Eye, Heart, X, Check, Zap, Database } from 'lucide-react';
import { useConfirm } from './ConfirmContext';
import { BroadcastTab } from './admin/tabs/BroadcastTab';
import { PromoCodesTab } from './admin/tabs/PromoCodesTab';
import AdminAnalyticsDashboard from './AdminAnalyticsDashboard';

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
    const { confirm } = useConfirm();
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
    const [activeTab, setActiveTab] = useState<'users' | 'events' | 'registrations' | 'finance' | 'affiliates' | 'security' | 'analytics' | 'broadcast' | 'promo' | 'nonprofit' | 'onboarding' | 'settings'>('users');
    const [unauthorized, setUnauthorized] = useState(false);

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
    const [globalCommissionRate, setGlobalCommissionRate] = useState<number>(15);
    const [isUpdatingGlobalRate, setIsUpdatingGlobalRate] = useState(false);

    // Platform Payouts State
    const [platformPayouts, setPlatformPayouts] = useState<any[]>([]);
    const [pendingPayoutSummary, setPendingPayoutSummary] = useState<any>(null);
    const [showPayoutModal, setShowPayoutModal] = useState(false);
    const [payoutType, setPayoutType] = useState<'platform_fees' | 'subscriptions' | 'combined'>('platform_fees');
    const [platformPayoutNotes, setPlatformPayoutNotes] = useState('');
    const [isProcessingPlatformPayout, setIsProcessingPlatformPayout] = useState(false);

    // Non-Profit Applications State
    const [nonprofitApplications, setNonprofitApplications] = useState<any[]>([]);
    const [allNonprofitApplications, setAllNonprofitApplications] = useState<any[]>([]);
    const [selectedNonprofit, setSelectedNonprofit] = useState<any | null>(null);
    const [nonprofitFilter, setNonprofitFilter] = useState<'pending' | 'approved' | 'rejected' | 'all'>('pending');
    const [isApprovingNonprofit, setIsApprovingNonprofit] = useState(false);
    const [nonprofitRejectReason, setNonprofitRejectReason] = useState('');

    // Confirmation Modal State
    const [confirmModal, setConfirmModal] = useState<{
        show: boolean;
        title: string;
        message: string;
        onConfirm: () => void;
        type: 'approve' | 'reject' | 'other';
    }>({ show: false, title: '', message: '', onConfirm: () => {}, type: 'other' });

    // Lightbox State
    const [lightboxImage, setLightboxImage] = useState<string | null>(null);

    // Onboarding Responses State
    const [onboardingResponses, setOnboardingResponses] = useState<any[]>([]);
    const [selectedOnboarding, setSelectedOnboarding] = useState<any | null>(null);

    // Migration State
    const [migrationRunning, setMigrationRunning] = useState(false);
    const [migrationResults, setMigrationResults] = useState<any>(null);


    // Platform Settings State
    const [platformStripeId, setPlatformStripeId] = useState('');
    const [platformPublishableKey, setPlatformPublishableKey] = useState('');
    const [platformSecretKey, setPlatformSecretKey] = useState('');
    const [resendApiKeyConfigured, setResendApiKeyConfigured] = useState(false);
    const [backendDefaultCurrency, setBackendDefaultCurrency] = useState('USD');

    // Donation analytics date range filter
    const [donationDateRange, setDonationDateRange] = useState<'all' | '7d' | '30d' | '90d' | 'custom'>('all');
    const [donationCustomStart, setDonationCustomStart] = useState('');
    const [donationCustomEnd, setDonationCustomEnd] = useState('');
    const [filteredDonations, setFilteredDonations] = useState<any[]>([]);

    // Suspicious Activity State
    const [suspiciousActivities, setSuspiciousActivities] = useState<any[]>([]);
    const [loadingSuspicious, setLoadingSuspicious] = useState(false);
    const [suspiciousSeverityFilter, setSuspiciousSeverityFilter] = useState<'all' | 'info' | 'warning' | 'critical'>('all');

    const currentUser = StorageService.getCurrentUser();

    // Check Resend status from backend API
    const checkResendStatus = async () => {
        console.log('[SuperAdmin] checkResendStatus called');
        try {
            console.log('[SuperAdmin] Fetching /api/email/status...');
            const response = await fetch('/api/email/status', {
                method: 'GET',
                headers: {
                    'Accept': 'application/json',
                    'Content-Type': 'application/json'
                },
                cache: 'no-store'
            });
            console.log('[SuperAdmin] Response received, status:', response.status, 'ok:', response.ok);
            
            if (!response.ok) {
                console.error('[SuperAdmin] API error status:', response.status);
                setResendApiKeyConfigured(false);
                return;
            }
            
            const text = await response.text();
            console.log('[SuperAdmin] Raw response:', text);
            
            let status;
            try {
                status = JSON.parse(text);
            } catch (parseError) {
                console.error('[SuperAdmin] JSON parse error:', parseError);
                setResendApiKeyConfigured(false);
                return;
            }
            
            console.log('[SuperAdmin] Parsed status:', status);
            console.log('[SuperAdmin] configured:', status.configured, 'available:', status.available);
            
            const isConfigured = status.configured === true && status.available === true;
            console.log('[SuperAdmin] isConfigured result:', isConfigured);
            
            setResendApiKeyConfigured(isConfigured);
            console.log('[SuperAdmin] State updated to:', isConfigured);
        } catch (error) {
            console.error('[SuperAdmin] Fetch error:', error);
            setResendApiKeyConfigured(false);
        }
    };

    // Load suspicious activities from security audit logs
    const loadSuspiciousActivities = async () => {
        setLoadingSuspicious(true);
        try {
            const token = await import('../services/firebaseConfig').then(m => m.getAuthToken());
            const severityParam = suspiciousSeverityFilter !== 'all' ? `?severity=${suspiciousSeverityFilter}` : '';
            const response = await fetch(`/api/admin/security-audit-logs/suspicious${severityParam}`, {
                headers: {
                    'Authorization': `Bearer ${token}`
                }
            });

            if (response.ok) {
                const data = await response.json();
                setSuspiciousActivities(data.logs || []);
            } else {
                console.error('Failed to load suspicious activities:', await response.text());
            }
        } catch (error) {
            console.error('Error loading suspicious activities:', error);
        } finally {
            setLoadingSuspicious(false);
        }
    };

    useEffect(() => {
        // When embedded, the parent component already verified admin access
        if (!embedded && (!currentUser || !currentUser.isAdmin)) {
            setUnauthorized(true);
            return;
        }
        setPlatformStripeId(currentUser?.stripeConnectId || '');
        setPlatformPublishableKey(currentUser?.stripePublishableKey || '');
        setPlatformSecretKey(currentUser?.stripeSecretKey || '');
        // Check if Resend is configured via backend - run async
        checkResendStatus().catch(console.error);
        setBackendDefaultCurrency(localStorage.getItem('openticket_backend_default_currency') || 'USD');
        refreshData();
    }, [navigate, embedded]);

    // Re-check Resend status when switching to settings tab
    useEffect(() => {
        if (activeTab === 'settings') {
            console.log('[SuperAdmin] Settings tab active, checking Resend status...');
            checkResendStatus().catch(console.error);
        }
        if (activeTab === 'security') {
            console.log('[SuperAdmin] Security tab active, loading suspicious activities...');
            loadSuspiciousActivities().catch(console.error);
        }
    }, [activeTab, suspiciousSeverityFilter]);

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
                        commissionRate: aff.commissionRate || 15,  // Default 15% for subscriptions
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
                            commissionRate: aff.commissionRate || 15,  // Default 15% for subscriptions
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
                        commissionRate: aff.commissionRate || 15,  // Default 15% for subscriptions
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

            // Load non-profit applications
            try {
                const token = await StorageService.getAuthToken();
                const response = await fetch('/api/onboarding/admin/nonprofit/all', {
                    headers: { 'Authorization': `Bearer ${token}` }
                });
                if (response.ok) {
                    const data = await response.json();
                    setAllNonprofitApplications(data.data || []);
                    setNonprofitApplications((data.data || []).filter((a: any) => a.status === 'pending'));
                }
            } catch (e) {
                console.error("Failed to load non-profit applications", e);
            }

            // Load onboarding responses
            try {
                const token = await StorageService.getAuthToken();
                const response = await fetch('/api/onboarding/admin/all', {
                    headers: { 'Authorization': `Bearer ${token}` }
                });
                if (response.ok) {
                    const data = await response.json();
                    setOnboardingResponses(data.data || []);
                }
            } catch (e) {
                console.error("Failed to load onboarding responses", e);
            }

 

        } catch (e) {
            console.error("Dashboard Refresh Error", e);
        }
    };

    // Non-profit approval handler - shows confirmation modal
    const showApproveConfirmation = (applicationId: string, userId: string) => {
        setConfirmModal({
            show: true,
            title: 'Approve Non-Profit Application',
            message: 'This will generate a 20% discount code and send an email to the applicant. Continue?',
            type: 'approve',
            onConfirm: () => executeApproveNonprofit(applicationId, userId)
        });
    };

    // Execute the actual approval
    const executeApproveNonprofit = async (applicationId: string, userId: string) => {
        console.log('Executing approval:', { applicationId, userId });
        setConfirmModal({ ...confirmModal, show: false });
        setIsApprovingNonprofit(true);
        
        try {
            const token = await StorageService.getAuthToken();
            console.log('Token obtained, making request...');
            
            const response = await fetch('/api/onboarding/admin/nonprofit/approve', {
                method: 'POST',
                headers: { 
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${token}` 
                },
                body: JSON.stringify({ applicationId, userId })
            });
            
            console.log('Response status:', response.status);
            const data = await response.json();
            console.log('Response data:', data);
            
            if (!response.ok) {
                throw new Error(data.error || 'Failed to approve application');
            }
            
            // Show success message in a modal-like way
            setConfirmModal({
                show: true,
                title: '✅ Non-Profit Approved!',
                message: `Discount code: ${data.discountCode}\n\nAn email with the 20% discount has been sent to the applicant.`,
                type: 'other',
                onConfirm: () => setConfirmModal({ ...confirmModal, show: false })
            });
            refreshData();
            setSelectedNonprofit(null);
        } catch (e: any) {
            console.error('Approve nonprofit error:', e);
            setConfirmModal({
                show: true,
                title: '❌ Error',
                message: e.message || 'Failed to approve application',
                type: 'other',
                onConfirm: () => setConfirmModal({ ...confirmModal, show: false })
            });
        } finally {
            setIsApprovingNonprofit(false);
        }
    };

    // Non-profit rejection handler - shows confirmation modal
    const showRejectConfirmation = (applicationId: string, userId: string) => {
        const reason = nonprofitRejectReason || 'Your application did not meet our verification requirements.';
        setConfirmModal({
            show: true,
            title: 'Reject Non-Profit Application',
            message: `Are you sure you want to reject this application?\n\nReason: ${reason}`,
            type: 'reject',
            onConfirm: () => executeRejectNonprofit(applicationId, userId, reason)
        });
    };

    // Execute the actual rejection
    const executeRejectNonprofit = async (applicationId: string, userId: string, reason: string) => {
        console.log('Executing rejection:', { applicationId, userId, reason });
        setConfirmModal({ ...confirmModal, show: false });
        
        setIsApprovingNonprofit(true);
        try {
            const token = await StorageService.getAuthToken();
            const response = await fetch('/api/onboarding/admin/nonprofit/reject', {
                method: 'POST',
                headers: { 
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${token}` 
                },
                body: JSON.stringify({ applicationId, userId, reason })
            });
            
            if (!response.ok) {
                const data = await response.json();
                throw new Error(data.error || 'Failed to reject application');
            }
            
            setConfirmModal({
                show: true,
                title: 'Application Rejected',
                message: 'Non-profit application has been rejected. The applicant will be notified.',
                type: 'other',
                onConfirm: () => setConfirmModal({ ...confirmModal, show: false })
            });
            setNonprofitRejectReason('');
            refreshData();
            setSelectedNonprofit(null);
        } catch (e: any) {
            console.error('Reject nonprofit error:', e);
            setConfirmModal({
                show: true,
                title: '❌ Error',
                message: e.message || 'Failed to reject application',
                type: 'other',
                onConfirm: () => setConfirmModal({ ...confirmModal, show: false })
            });
        } finally {
            setIsApprovingNonprofit(false);
        }
    };

    const handleProcessAffiliatePayout = async () => {
        if (!selectedAffiliate || !payoutAmount) return;
        
        const amount = parseFloat(payoutAmount);
        if (isNaN(amount) || amount <= 0) {
            window.alert('Please enter a valid amount');
            return;
        }
        
        if (amount > selectedAffiliate.pendingPayout) {
            window.alert(`Cannot pay more than pending amount ($${selectedAffiliate.pendingPayout.toFixed(2)})`);
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
                    window.alert('Stripe payout failed. Please try offline payment or check Stripe connection.');
                }
            }
            
            // Reset form
            setPayoutAmount('');
            setAffiliatePayoutNotes('');
            setSelectedAffiliate(null);
            
            // Refresh data
            refreshData();
            window.alert(`Payout of $${amount.toFixed(2)} to ${payout.affiliateName} recorded successfully!`);
            
        } catch (e) {
            console.error('Payout error:', e);
            window.alert('Failed to process payout. Please try again.');
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
                window.alert('No changes to save');
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
            
            window.alert('Affiliate rates updated successfully!');
        } catch (e) {
            console.error('Update rates error:', e);
            window.alert('Failed to update rates. Please try again.');
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
                window.alert('No pending amount to pay out');
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
            window.alert(`Payout of $${amount.toFixed(2)} has been recorded successfully!`);
        } catch (e) {
            console.error('Platform payout error:', e);
            window.alert('Failed to process payout. Please try again.');
        } finally {
            setIsProcessingPlatformPayout(false);
        }
    };

    const handleToggleBan = async (user: User) => {
        if (user.isAdmin) return;
        const confirmMsg = user.isBanned
            ? `Re-activate ${user.name}?`
            : `Are you sure you want to BAN ${user.name}? They will be unable to login.`;

        const confirmed = await confirm({
            title: user.isBanned ? 'Re-activate User' : 'Ban User',
            message: confirmMsg,
            confirmText: user.isBanned ? 'Re-activate' : 'Ban User',
            variant: 'danger'
        });

        if (confirmed) {
            StorageService.updateUser(user.id, { isBanned: !user.isBanned });
            refreshData();
        }
    };

    const handleDeleteEvent = async (event: Event) => {
        const confirmed = await confirm({
            title: 'Delete Event',
            message: `Delete "${event.title}"? This cannot be undone.`,
            confirmText: 'Delete',
            variant: 'danger'
        });

        if (confirmed) {
            StorageService.deleteEvent(event.id);
            refreshData();
        }
    };

    const handleRejectEvent = async (event: Event) => {
        const confirmed = await confirm({
            title: 'Reject Event',
            message: `Reject "${event.title}"? This will hide the event from the public and mark it as rejected.`,
            confirmText: 'Reject',
            variant: 'warning'
        });

        if (confirmed) {
            StorageService.saveEvent({ ...event, moderationStatus: 'rejected', visibility: 'hidden' });
            refreshData();
        }
    };

    const handleSavePlatformSettings = async () => {
        if (!currentUser) return;
        await StorageService.updateUser(currentUser.id, {
            stripeConnectId: platformStripeId,
            stripePublishableKey: platformPublishableKey,
            stripeSecretKey: platformSecretKey
        });
        window.alert("Platform settings saved successfully.");
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
                {['users', 'events', 'registrations', 'finance', 'affiliates', 'security', 'analytics', 'broadcast', 'promo', 'nonprofit', 'onboarding', 'settings'].map(tab => (
                    <button
                        key={tab}
                        onClick={() => setActiveTab(tab as any)}
                        className={`flex items-center gap-2 px-6 py-3 rounded-xl font-bold capitalize transition-all whitespace-nowrap ${activeTab === tab
                            ? 'bg-[#E0FF20] text-black shadow-[0_0_20px_rgba(224,255,32,0.3)]'
                            : 'bg-zinc-900 text-zinc-400 hover:bg-zinc-800'
                            }`}
                    >
                        {tab === 'promo' ? 'Promo Codes' : tab === 'nonprofit' ? (
                            <>Non-Profit {nonprofitApplications.length > 0 && <span className="ml-1 px-1.5 py-0.5 bg-red-500 text-white text-xs rounded-full">{nonprofitApplications.length}</span>}</>
                        ) : tab}
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
                            <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4 mb-6">
                                <h3 className="text-lg font-bold text-white flex items-center gap-2">
                                    <Heart size={20} className="text-pink-400" fill="currentColor" /> Total Platform Donations
                                </h3>
                                
                                {/* Date Range Filter */}
                                <div className="flex flex-wrap items-center gap-2">
                                    {[
                                        { value: 'all', label: 'All Time' },
                                        { value: '7d', label: '7 Days' },
                                        { value: '30d', label: '30 Days' },
                                        { value: '90d', label: '90 Days' },
                                    ].map(opt => (
                                        <button
                                            key={opt.value}
                                            onClick={() => setDonationDateRange(opt.value as any)}
                                            className={`px-3 py-1 text-xs font-bold rounded-lg transition-all ${
                                                donationDateRange === opt.value
                                                    ? 'bg-pink-500 text-white'
                                                    : 'bg-zinc-800 text-zinc-400 hover:bg-zinc-700'
                                            }`}
                                        >
                                            {opt.label}
                                        </button>
                                    ))}
                                    <button
                                        onClick={() => setDonationDateRange('custom')}
                                        className={`px-3 py-1 text-xs font-bold rounded-lg transition-all ${
                                            donationDateRange === 'custom'
                                                ? 'bg-pink-500 text-white'
                                                : 'bg-zinc-800 text-zinc-400 hover:bg-zinc-700'
                                        }`}
                                    >
                                        Custom
                                    </button>
                                </div>
                            </div>

                            {/* Custom Date Range Inputs */}
                            {donationDateRange === 'custom' && (
                                <div className="flex flex-wrap items-center gap-3 mb-4 p-3 bg-zinc-800/50 rounded-lg">
                                    <div className="flex items-center gap-2">
                                        <label className="text-xs text-zinc-400">From:</label>
                                        <input
                                            type="date"
                                            value={donationCustomStart}
                                            onChange={(e) => setDonationCustomStart(e.target.value)}
                                            className="px-2 py-1 text-xs bg-zinc-700 border border-zinc-600 rounded text-white"
                                        />
                                    </div>
                                    <div className="flex items-center gap-2">
                                        <label className="text-xs text-zinc-400">To:</label>
                                        <input
                                            type="date"
                                            value={donationCustomEnd}
                                            onChange={(e) => setDonationCustomEnd(e.target.value)}
                                            className="px-2 py-1 text-xs bg-zinc-700 border border-zinc-600 rounded text-white"
                                        />
                                    </div>
                                </div>
                            )}

                            {/* Filtered Stats Summary */}
                            {(() => {
                                // Calculate filtered donation stats
                                const now = new Date();
                                let startDate: Date | null = null;
                                let endDate: Date = now;

                                if (donationDateRange === '7d') {
                                    startDate = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
                                } else if (donationDateRange === '30d') {
                                    startDate = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
                                } else if (donationDateRange === '90d') {
                                    startDate = new Date(now.getTime() - 90 * 24 * 60 * 60 * 1000);
                                } else if (donationDateRange === 'custom' && donationCustomStart) {
                                    startDate = new Date(donationCustomStart);
                                    if (donationCustomEnd) {
                                        endDate = new Date(donationCustomEnd);
                                        endDate.setHours(23, 59, 59, 999);
                                    }
                                }

                                const filteredRecent = stats.donationBreakdown.recent.filter((d: any) => {
                                    const dDate = new Date(d.createdAt);
                                    if (startDate && dDate < startDate) return false;
                                    if (dDate > endDate) return false;
                                    return true;
                                });

                                const filteredTotal = filteredRecent.reduce((sum: number, d: any) => sum + (d.amount || 0), 0);
                                const filteredCount = filteredRecent.length;

                                return (
                                    <>
                                        <div className="flex justify-between items-center mb-6">
                                            <div className="text-xs text-zinc-500">
                                                {donationDateRange === 'all' ? 'All time' : 
                                                 donationDateRange === 'custom' && donationCustomStart ? 
                                                    `${donationCustomStart} to ${donationCustomEnd || 'now'}` :
                                                 donationDateRange === '7d' ? 'Last 7 days' :
                                                 donationDateRange === '30d' ? 'Last 30 days' : 'Last 90 days'}
                                            </div>
                                            <div className="text-right">
                                                <div className="text-3xl font-black text-pink-400">
                                                    ${donationDateRange === 'all' ? stats.donationBreakdown.total.toFixed(2) : filteredTotal.toFixed(2)}
                                                </div>
                                                <div className="text-xs text-zinc-500">
                                                    {donationDateRange === 'all' ? stats.donationBreakdown.count : filteredCount} donations
                                                </div>
                                            </div>
                                        </div>

                                        {/* Monthly Comparison (only show for 'all' time) */}
                                        {donationDateRange === 'all' && (
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
                                        )}

                                        {/* Period Stats (show for filtered views) */}
                                        {donationDateRange !== 'all' && (
                                            <div className="grid grid-cols-2 md:grid-cols-3 gap-4 mb-6">
                                                <Card className="p-4 bg-zinc-800/50 border-zinc-700">
                                                    <div className="text-xs text-zinc-500 uppercase font-bold mb-1">Period Total</div>
                                                    <div className="text-2xl font-black text-pink-400">${filteredTotal.toFixed(2)}</div>
                                                </Card>
                                                <Card className="p-4 bg-zinc-800/50 border-zinc-700">
                                                    <div className="text-xs text-zinc-500 uppercase font-bold mb-1">Donations</div>
                                                    <div className="text-2xl font-black text-white">{filteredCount}</div>
                                                </Card>
                                                <Card className="p-4 bg-zinc-800/50 border-zinc-700">
                                                    <div className="text-xs text-zinc-500 uppercase font-bold mb-1">Avg Donation</div>
                                                    <div className="text-2xl font-black text-white">
                                                        ${filteredCount > 0 ? (filteredTotal / filteredCount).toFixed(2) : '0.00'}
                                                    </div>
                                                </Card>
                                            </div>
                                        )}

                                        {/* Donation Amount Distribution */}
                                        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                                            <div>
                                                <h4 className="text-sm font-bold text-zinc-400 uppercase mb-3">Donation Distribution</h4>
                                                <div className="space-y-2">
                                                    {Object.entries(stats.donationBreakdown.byAmount).map(([amount, count]) => {
                                                        const totalCount = donationDateRange === 'all' ? stats.donationBreakdown.count : filteredCount;
                                                        const percentage = totalCount > 0 
                                                            ? ((count as number) / totalCount * 100) 
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
                                                                <span className="w-12 text-right text-sm text-zinc-400">{count as number}</span>
                                                            </div>
                                                        );
                                                    })}
                                                </div>
                                            </div>

                                            {/* Recent Donations */}
                                            <div>
                                                <h4 className="text-sm font-bold text-zinc-400 uppercase mb-3">
                                                    {donationDateRange === 'all' ? 'Recent Donations' : 'Donations in Period'}
                                                </h4>
                                                <div className="space-y-2 max-h-[200px] overflow-y-auto">
                                                    {(donationDateRange === 'all' ? stats.donationBreakdown.recent : filteredRecent).length > 0 ? (
                                                        (donationDateRange === 'all' ? stats.donationBreakdown.recent : filteredRecent).map((donation: any, idx: number) => (
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
                                                            <p className="text-sm">No donations {donationDateRange === 'all' ? 'yet' : 'in this period'}</p>
                                                        </div>
                                                    )}
                                                </div>
                                            </div>
                                        </div>
                                    </>
                                );
                            })()}

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
                                                    'Authorization': `Bearer ${await StorageService.getAuthToken()}`
                                                }
                                            });
                                            const result = await response.json();
                                            if (result.success) {
                                                window.alert(`✅ Sent ${result.sent} weekly summaries to affiliates!`);
                                            } else {
                                                window.alert(`❌ Error: ${result.error}`);
                                            }
                                        } catch (e: any) {
                                            window.alert(`❌ Failed: ${e.message}`);
                                        }
                                    }}
                                >
                                    <Mail size={14} className="mr-2" /> Send Weekly Summary
                                </Button>
                                <Button size="sm" variant="outline" onClick={refreshData}>
                                    <RefreshCw size={14} className="mr-2" /> Refresh
                                </Button>
                                <Button size="sm" variant="outline" onClick={() => {
                                    const headers = ['Name', 'Email', 'Code', 'Clicks', 'Conversions', 'Rate', 'Commission%', 'Earnings', 'Paid', 'Pending'];
                                    const rows = affiliates.map(a => [
                                        a.name, a.email, a.affiliateCode, a.clicks, a.conversions, 
                                        `${a.conversionRate.toFixed(1)}%`, `${a.commissionRate}%`, `$${a.totalEarnings.toFixed(2)}`,
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

                        {/* Global Commission Rate Setting */}
                        <div className="mb-6 bg-gradient-to-r from-purple-900/30 to-pink-900/30 border border-purple-500/30 rounded-xl p-4">
                            <div className="flex items-center justify-between">
                                <div>
                                    <h3 className="font-bold text-white flex items-center gap-2">
                                        <Percent size={18} className="text-purple-400" /> Global Subscription Commission Rate
                                    </h3>
                                    <p className="text-sm text-zinc-400 mt-1">
                                        Set the default commission rate for all affiliates on Pro/Premium subscriptions
                                    </p>
                                </div>
                                <div className="flex items-center gap-3">
                                    <div className="flex items-center gap-2">
                                        <input
                                            type="number"
                                            min="0"
                                            max="100"
                                            value={globalCommissionRate}
                                            onChange={(e) => setGlobalCommissionRate(Number(e.target.value))}
                                            className="w-20 bg-zinc-800 border border-zinc-700 rounded-lg px-3 py-2 text-white text-center"
                                        />
                                        <span className="text-zinc-400">%</span>
                                    </div>
                                    <Button
                                        size="sm"
                                        disabled={isUpdatingGlobalRate}
                                        onClick={async () => {
                                            const confirmed = await confirm({
                                                title: 'Update Global Commission Rate',
                                                message: `Set ALL affiliates to ${globalCommissionRate}% commission rate?`,
                                                confirmText: 'Update All',
                                                variant: 'warning'
                                            });

                                            if (!confirmed) return;
                                            
                                            setIsUpdatingGlobalRate(true);
                                            try {
                                                const token = await StorageService.getAuthToken();
                                                const response = await fetch('/api/admin/affiliates/global-commission', {
                                                    method: 'PUT',
                                                    headers: { 
                                                        'Content-Type': 'application/json',
                                                        'Authorization': `Bearer ${token}` 
                                                    },
                                                    body: JSON.stringify({ commissionRate: globalCommissionRate })
                                                });
                                                const result = await response.json();
                                                if (response.ok) {
                                                    await confirm({
                                                        title: 'Success',
                                                        message: result.message,
                                                        confirmText: 'OK',
                                                        variant: 'info'
                                                    });
                                                    refreshData();
                                                } else {
                                                    window.alert('Error: ' + result.error);
                                                }
                                            } catch (e: any) {
                                                window.alert('Failed: ' + e.message);
                                            } finally {
                                                setIsUpdatingGlobalRate(false);
                                            }
                                        }}
                                        className="bg-purple-600 hover:bg-purple-700 text-white"
                                    >
                                        {isUpdatingGlobalRate ? 'Updating...' : 'Apply to All'}
                                    </Button>
                                </div>
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

                {/* SECURITY TAB - Suspicious Activity Monitoring */}
                {activeTab === 'security' && (
                    <div className="p-8">
                        <div className="flex justify-between items-center mb-6">
                            <div>
                                <h2 className="text-2xl font-bold text-white mb-2 flex items-center gap-2">
                                    <Shield size={28} className="text-red-500" /> Security & Fraud Detection
                                </h2>
                                <p className="text-zinc-400 text-sm">Monitor suspicious ticket transfer activities and fraud attempts</p>
                            </div>
                            <div className="flex gap-4 items-center">
                                <Select
                                    value={suspiciousSeverityFilter}
                                    onChange={(e) => setSuspiciousSeverityFilter(e.target.value as any)}
                                    className="bg-zinc-900 border-zinc-800"
                                >
                                    <option value="all">All Severity</option>
                                    <option value="info">Info</option>
                                    <option value="warning">Warning</option>
                                    <option value="critical">Critical</option>
                                </Select>
                                <Button
                                    onClick={loadSuspiciousActivities}
                                    size="sm"
                                    className="bg-red-600 hover:bg-red-700 border-none"
                                >
                                    <RefreshCw size={16} className="mr-2" /> Refresh
                                </Button>
                            </div>
                        </div>

                        {/* Summary Cards */}
                        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
                            <Card className="p-6 bg-zinc-900 border-zinc-800">
                                <div className="flex items-center justify-between mb-2">
                                    <span className="text-sm text-zinc-500">Total Suspicious Events</span>
                                    <AlertTriangle className="text-yellow-500" size={20} />
                                </div>
                                <div className="text-3xl font-bold text-white">
                                    {(suspiciousActivities || []).length}
                                </div>
                            </Card>
                            <Card className="p-6 bg-zinc-900 border-zinc-800">
                                <div className="flex items-center justify-between mb-2">
                                    <span className="text-sm text-zinc-500">Rate Limit Violations</span>
                                    <Clock className="text-orange-500" size={20} />
                                </div>
                                <div className="text-3xl font-bold text-white">
                                    {(suspiciousActivities || []).filter(a => a.action === 'SUSPICIOUS_TRANSFER_RATE').length}
                                </div>
                            </Card>
                            <Card className="p-6 bg-zinc-900 border-zinc-800">
                                <div className="flex items-center justify-between mb-2">
                                    <span className="text-sm text-zinc-500">Circular Transfers</span>
                                    <RefreshCw className="text-red-500" size={20} />
                                </div>
                                <div className="text-3xl font-bold text-white">
                                    {(suspiciousActivities || []).filter(a => a.action === 'SUSPICIOUS_CIRCULAR_TRANSFER').length}
                                </div>
                            </Card>
                        </div>

                        {/* Suspicious Activities Table */}
                        <Card className="bg-zinc-900 border-zinc-800 overflow-hidden">
                            <div className="overflow-x-auto">
                                <table className="w-full">
                                    <thead className="bg-black text-left">
                                        <tr>
                                            <th className="p-4 text-xs text-zinc-500 uppercase font-bold">Timestamp</th>
                                            <th className="p-4 text-xs text-zinc-500 uppercase font-bold">Action</th>
                                            <th className="p-4 text-xs text-zinc-500 uppercase font-bold">Severity</th>
                                            <th className="p-4 text-xs text-zinc-500 uppercase font-bold">User</th>
                                            <th className="p-4 text-xs text-zinc-500 uppercase font-bold">Entity</th>
                                            <th className="p-4 text-xs text-zinc-500 uppercase font-bold">Details</th>
                                        </tr>
                                    </thead>
                                    <tbody className="divide-y divide-zinc-800">
                                        {loadingSuspicious ? (
                                            <tr>
                                                <td colSpan={6} className="p-8 text-center text-zinc-500">
                                                    <RefreshCw className="animate-spin mx-auto mb-2" size={24} />
                                                    <div>Loading suspicious activities...</div>
                                                </td>
                                            </tr>
                                        ) : (suspiciousActivities || []).length === 0 ? (
                                            <tr>
                                                <td colSpan={6} className="p-8 text-center text-zinc-500">
                                                    <CheckCircle2 className="mx-auto mb-2 text-green-500" size={32} />
                                                    <div className="text-lg font-bold text-white">No Suspicious Activity Detected</div>
                                                    <div className="text-sm mt-1">All ticket transfers are within normal parameters</div>
                                                </td>
                                            </tr>
                                        ) : (
                                            (suspiciousActivities || []).map((activity) => (
                                                <tr key={activity.id} className="hover:bg-zinc-800/50 transition-colors">
                                                    <td className="p-4 text-sm text-zinc-400">
                                                        {new Date(activity.created_at).toLocaleString()}
                                                    </td>
                                                    <td className="p-4">
                                                        <div className="flex items-center gap-2">
                                                            {activity.action === 'SUSPICIOUS_TRANSFER_RATE' && (
                                                                <Clock size={16} className="text-orange-500" />
                                                            )}
                                                            {activity.action === 'SUSPICIOUS_CIRCULAR_TRANSFER' && (
                                                                <RefreshCw size={16} className="text-red-500" />
                                                            )}
                                                            <span className="text-sm font-medium text-white">
                                                                {activity.action.replace('SUSPICIOUS_', '').replace(/_/g, ' ')}
                                                            </span>
                                                        </div>
                                                    </td>
                                                    <td className="p-4">
                                                        <Badge
                                                            className={
                                                                activity.severity === 'critical'
                                                                    ? 'bg-red-600 text-white'
                                                                    : activity.severity === 'warning'
                                                                    ? 'bg-orange-600 text-white'
                                                                    : 'bg-blue-600 text-white'
                                                            }
                                                        >
                                                            {activity.severity?.toUpperCase() || 'INFO'}
                                                        </Badge>
                                                    </td>
                                                    <td className="p-4">
                                                        <div className="text-sm text-white font-mono">
                                                            {activity.user_email || 'Unknown'}
                                                        </div>
                                                        <div className="text-xs text-zinc-500 truncate max-w-[150px]">
                                                            {activity.user_id}
                                                        </div>
                                                    </td>
                                                    <td className="p-4">
                                                        <div className="text-sm text-zinc-300">
                                                            {activity.entity_type}: {activity.entity_id}
                                                        </div>
                                                    </td>
                                                    <td className="p-4">
                                                        <details className="text-xs">
                                                            <summary className="cursor-pointer text-[#E0FF20] hover:text-[#d4f542]">
                                                                View Details
                                                            </summary>
                                                            <pre className="mt-2 p-2 bg-black rounded text-zinc-400 overflow-auto max-w-md">
                                                                {JSON.stringify(activity.details, null, 2)}
                                                            </pre>
                                                        </details>
                                                    </td>
                                                </tr>
                                            ))
                                        )}
                                    </tbody>
                                </table>
                            </div>
                        </Card>

                        {/* Additional Info */}
                        <Card className="mt-6 p-6 bg-zinc-900 border-zinc-800 border-l-4 border-l-blue-500">
                            <h3 className="text-lg font-bold text-white mb-3 flex items-center gap-2">
                                <Eye size={20} className="text-blue-500" /> Fraud Detection Rules
                            </h3>
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-sm text-zinc-300">
                                <div>
                                    <div className="font-bold text-white mb-1">🚦 Rate Limiting</div>
                                    <div className="text-zinc-400">
                                        Maximum 5 transfer attempts per ticket within 1 hour. Exceeding this triggers a warning and blocks further transfers.
                                    </div>
                                </div>
                                <div>
                                    <div className="font-bold text-white mb-1">🔄 Circular Transfer Detection</div>
                                    <div className="text-zinc-400">
                                        Prevents A→B→A transfers within 24 hours. System detects and blocks attempts to return tickets to the original owner.
                                    </div>
                                </div>
                            </div>
                        </Card>
                    </div>
                )}

                {/* ANALYTICS TAB */}
                {activeTab === 'analytics' && (
                    <div className="p-8">
                        <AdminAnalyticsDashboard />
                    </div>
                )}

                {/* BROADCAST TAB */}
                {/* BROADCAST TAB */}
                {activeTab === 'broadcast' && (
                    <BroadcastTab refreshData={refreshData} />
                )}

                {/* PROMO CODES TAB */}
                {activeTab === 'promo' && (
                    <PromoCodesTab confirm={confirm} />
                )}

                {/* NON-PROFIT TAB */}
                {activeTab === 'nonprofit' && (
                    <div className="p-6">
                        <div className="flex justify-between items-center mb-6">
                            <h2 className="text-xl font-bold text-white flex items-center gap-2">
                                <Heart size={24} className="text-[#E0FF20]" /> Non-Profit Applications
                            </h2>
                            <div className="flex gap-2">
                                <Button 
                                    size="sm" 
                                    variant="outline"
                                    onClick={async () => {
                                        const confirmed = await confirm({
                                            title: 'Migrate Legacy Users',
                                            message: 'This will migrate existing nonprofit users from profiles to the applications table. Continue?',
                                            confirmText: 'Migrate',
                                            variant: 'warning'
                                        });

                                        if (!confirmed) return;

                                        try {
                                            const token = await StorageService.getAuthToken();
                                            const response = await fetch('/api/onboarding/admin/nonprofit/migrate', {
                                                method: 'POST',
                                                headers: { 'Authorization': `Bearer ${token}` }
                                            });
                                            const data = await response.json();
                                            if (response.ok) {
                                                await confirm({
                                                    title: 'Success',
                                                    message: data.message,
                                                    confirmText: 'OK',
                                                    variant: 'info'
                                                });
                                                refreshData();
                                            } else {
                                                await confirm({
                                                    title: 'Error',
                                                    message: 'Migration failed: ' + data.error,
                                                    confirmText: 'OK',
                                                    variant: 'danger'
                                                });
                                            }
                                        } catch (e: any) {
                                            await confirm({
                                                title: 'Error',
                                                message: 'Migration failed: ' + e.message,
                                                confirmText: 'OK',
                                                variant: 'danger'
                                            });
                                        }
                                    }}
                                >
                                    <RefreshCw size={14} className="mr-2" /> Migrate Legacy Users
                                </Button>
                                {(['pending', 'approved', 'rejected', 'all'] as const).map(filter => (
                                    <button
                                        key={filter}
                                        onClick={() => setNonprofitFilter(filter)}
                                        className={`px-4 py-2 rounded-lg text-sm font-bold capitalize ${
                                            nonprofitFilter === filter
                                                ? 'bg-[#E0FF20] text-black'
                                                : 'bg-zinc-800 text-zinc-400 hover:bg-zinc-700'
                                        }`}
                                    >
                                        {filter} {filter === 'pending' && nonprofitApplications.length > 0 && `(${nonprofitApplications.length})`}
                                    </button>
                                ))}
                            </div>
                        </div>

                        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                            {/* Applications List */}
                            <div className="space-y-4">
                                {(nonprofitFilter === 'all' ? allNonprofitApplications : 
                                  nonprofitFilter === 'pending' ? nonprofitApplications :
                                  allNonprofitApplications.filter(a => a.status === nonprofitFilter)
                                ).length === 0 ? (
                                    <div className="bg-zinc-800/50 rounded-xl p-8 text-center">
                                        <Heart size={48} className="mx-auto mb-4 text-zinc-600" />
                                        <p className="text-zinc-400">No {nonprofitFilter} applications</p>
                                    </div>
                                ) : (
                                    (nonprofitFilter === 'all' ? allNonprofitApplications : 
                                      nonprofitFilter === 'pending' ? nonprofitApplications :
                                      allNonprofitApplications.filter(a => a.status === nonprofitFilter)
                                    ).map(app => (
                                        <div
                                            key={app.id}
                                            onClick={() => setSelectedNonprofit(app)}
                                            className={`bg-zinc-800/50 rounded-xl p-4 cursor-pointer border-2 transition-all hover:border-zinc-600 ${
                                                selectedNonprofit?.id === app.id ? 'border-[#E0FF20]' : 'border-transparent'
                                            }`}
                                        >
                                            <div className="flex justify-between items-start mb-2">
                                                <div>
                                                    <h3 className="font-bold text-white">{app.organization_name}</h3>
                                                    <p className="text-sm text-zinc-400">{app.user?.email}</p>
                                                </div>
                                                <span className={`px-2 py-1 rounded-full text-xs font-bold ${
                                                    app.status === 'pending' ? 'bg-amber-500/20 text-amber-400' :
                                                    app.status === 'approved' ? 'bg-green-500/20 text-green-400' :
                                                    'bg-red-500/20 text-red-400'
                                                }`}>
                                                    {app.status}
                                                </span>
                                            </div>
                                            <div className="flex items-center gap-4 text-xs text-zinc-500">
                                                <span>Submitted: {new Date(app.submitted_at).toLocaleDateString()}</span>
                                                {app.ein && <span>EIN: {app.ein}</span>}
                                            </div>
                                        </div>
                                    ))
                                )}
                            </div>

                            {/* Selected Application Details */}
                            <div className="bg-zinc-800/50 rounded-xl p-6">
                                {selectedNonprofit ? (
                                    <div className="space-y-6">
                                        <div>
                                            <h3 className="text-lg font-bold text-white mb-1">{selectedNonprofit.organization_name}</h3>
                                            <p className="text-zinc-400">{selectedNonprofit.user?.name} ({selectedNonprofit.user?.email})</p>
                                        </div>

                                        <div className="grid grid-cols-2 gap-4 text-sm">
                                            <div>
                                                <span className="text-zinc-500">Status</span>
                                                <p className={`font-bold ${
                                                    selectedNonprofit.status === 'pending' ? 'text-amber-400' :
                                                    selectedNonprofit.status === 'approved' ? 'text-green-400' :
                                                    'text-red-400'
                                                }`}>{selectedNonprofit.status.toUpperCase()}</p>
                                            </div>
                                            <div>
                                                <span className="text-zinc-500">Submitted</span>
                                                <p className="text-white">{new Date(selectedNonprofit.submitted_at).toLocaleString()}</p>
                                            </div>
                                            {selectedNonprofit.ein && (
                                                <div>
                                                    <span className="text-zinc-500">EIN / Tax ID</span>
                                                    <p className="text-white font-mono">{selectedNonprofit.ein}</p>
                                                </div>
                                            )}
                                            {selectedNonprofit.discount_code && (
                                                <div>
                                                    <span className="text-zinc-500">Discount Code</span>
                                                    <p className="text-[#E0FF20] font-mono font-bold">{selectedNonprofit.discount_code}</p>
                                                </div>
                                            )}
                                        </div>

                                        {selectedNonprofit.description && (
                                            <div>
                                                <span className="text-zinc-500 text-sm">Mission Description</span>
                                                <p className="text-white mt-1">{selectedNonprofit.description}</p>
                                            </div>
                                        )}

                                        {/* Document */}
                                        {selectedNonprofit.document_url && (
                                            <div>
                                                <span className="text-zinc-500 text-sm">Verification Document</span>
                                                {selectedNonprofit.document_url.startsWith('data:image') ? (
                                                    <div className="mt-2">
                                                        <img 
                                                            src={selectedNonprofit.document_url} 
                                                            alt="Verification Document" 
                                                            className="max-w-full max-h-48 rounded-lg border border-zinc-700 cursor-pointer hover:opacity-80 transition-opacity"
                                                            onClick={() => setLightboxImage(selectedNonprofit.document_url)}
                                                        />
                                                        <p className="text-xs text-zinc-500 mt-1">Click to enlarge</p>
                                                    </div>
                                                ) : selectedNonprofit.document_url.startsWith('data:application/pdf') ? (
                                                    <div className="mt-2 p-4 bg-zinc-800 rounded-lg">
                                                        <p className="text-zinc-400 text-sm mb-2">PDF Document Attached</p>
                                                        <a
                                                            href={selectedNonprofit.document_url}
                                                            download="verification-document.pdf"
                                                            className="flex items-center gap-2 text-blue-400 hover:text-blue-300"
                                                        >
                                                            <FileText size={18} />
                                                            Download PDF
                                                            <Download size={14} />
                                                        </a>
                                                    </div>
                                                ) : (
                                                    <a
                                                        href={selectedNonprofit.document_url}
                                                        target="_blank"
                                                        rel="noopener noreferrer"
                                                        className="mt-2 flex items-center gap-2 text-blue-400 hover:text-blue-300"
                                                    >
                                                        <FileText size={18} />
                                                        View Document
                                                        <ExternalLink size={14} />
                                                    </a>
                                                )}
                                            </div>
                                        )}

                                        {/* Onboarding Data */}
                                        {selectedNonprofit.onboarding?.[0]?.responses && (
                                            <div>
                                                <span className="text-zinc-500 text-sm">Onboarding Responses</span>
                                                <div className="mt-2 bg-zinc-900/50 rounded-lg p-4 text-sm">
                                                    {Object.entries(selectedNonprofit.onboarding[0].responses).map(([key, value]) => (
                                                        <div key={key} className="flex justify-between py-1 border-b border-zinc-800 last:border-0">
                                                            <span className="text-zinc-400 capitalize">{key.replace(/([A-Z])/g, ' $1')}</span>
                                                            <span className="text-white">{Array.isArray(value) ? value.join(', ') : String(value)}</span>
                                                        </div>
                                                    ))}
                                                </div>
                                            </div>
                                        )}

                                        {/* Action Buttons */}
                                        {selectedNonprofit.status === 'pending' && (
                                            <div className="pt-4 border-t border-zinc-700 space-y-4">
                                                <div>
                                                    <label className="text-sm text-zinc-400 block mb-2">Rejection Reason (optional)</label>
                                                    <textarea
                                                        value={nonprofitRejectReason}
                                                        onChange={(e) => setNonprofitRejectReason(e.target.value)}
                                                        placeholder="Enter reason if rejecting..."
                                                        className="w-full bg-zinc-900 border border-zinc-700 rounded-lg p-3 text-white text-sm resize-none h-20"
                                                    />
                                                </div>
                                                <div className="flex gap-3">
                                                    <button
                                                        onClick={() => showApproveConfirmation(selectedNonprofit.id, selectedNonprofit.user_id)}
                                                        disabled={isApprovingNonprofit}
                                                        className="flex-1 bg-green-600 hover:bg-green-700 text-white font-bold py-3 px-4 rounded-xl disabled:opacity-50 flex items-center justify-center gap-2"
                                                    >
                                                        <Check size={18} />
                                                        Approve & Send Code
                                                    </button>
                                                    <button
                                                        onClick={() => showRejectConfirmation(selectedNonprofit.id, selectedNonprofit.user_id)}
                                                        disabled={isApprovingNonprofit}
                                                        className="flex-1 bg-red-600 hover:bg-red-700 text-white font-bold py-3 px-4 rounded-xl disabled:opacity-50 flex items-center justify-center gap-2"
                                                    >
                                                        <X size={18} />
                                                        Reject
                                                    </button>
                                                </div>
                                            </div>
                                        )}

                                        {/* Audit Info for Approved/Rejected */}
                                        {selectedNonprofit.status === 'approved' && selectedNonprofit.approved_at && (
                                            <div className="pt-4 border-t border-zinc-700 text-sm">
                                                <p className="text-green-400">✓ Approved on {new Date(selectedNonprofit.approved_at).toLocaleString()}</p>
                                            </div>
                                        )}
                                        {selectedNonprofit.status === 'rejected' && selectedNonprofit.rejected_at && (
                                            <div className="pt-4 border-t border-zinc-700 text-sm">
                                                <p className="text-red-400">✗ Rejected on {new Date(selectedNonprofit.rejected_at).toLocaleString()}</p>
                                                {selectedNonprofit.rejection_reason && (
                                                    <p className="text-zinc-400 mt-1">Reason: {selectedNonprofit.rejection_reason}</p>
                                                )}
                                            </div>
                                        )}
                                    </div>
                                ) : (
                                    <div className="h-full flex items-center justify-center text-zinc-500">
                                        <div className="text-center">
                                            <Heart size={48} className="mx-auto mb-4" />
                                            <p>Select an application to view details</p>
                                        </div>
                                    </div>
                                )}
                            </div>
                        </div>
                    </div>
                )}

                {/* ONBOARDING TAB */}
                {activeTab === 'onboarding' && (
                    <div className="p-6">
                        <div className="flex justify-between items-center mb-6">
                            <h2 className="text-xl font-bold text-white flex items-center gap-2">
                                <Users size={24} className="text-[#E0FF20]" /> Onboarding Responses
                            </h2>
                            <span className="text-zinc-400">{onboardingResponses.length} responses</span>
                        </div>

                        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                            {/* Responses List */}
                            <div className="space-y-3 max-h-[600px] overflow-y-auto">
                                {onboardingResponses.length === 0 ? (
                                    <div className="bg-zinc-800/50 rounded-xl p-8 text-center">
                                        <Users size={48} className="mx-auto mb-4 text-zinc-600" />
                                        <p className="text-zinc-400">No onboarding responses yet</p>
                                    </div>
                                ) : (
                                    onboardingResponses.map(response => (
                                        <div
                                            key={response.id}
                                            onClick={() => setSelectedOnboarding(response)}
                                            className={`bg-zinc-800/50 rounded-xl p-4 cursor-pointer border-2 transition-all hover:border-zinc-600 ${
                                                selectedOnboarding?.id === response.id ? 'border-[#E0FF20]' : 'border-transparent'
                                            }`}
                                        >
                                            <div className="flex justify-between items-start">
                                                <div>
                                                    <h3 className="font-bold text-white">{response.user?.name || 'Unknown User'}</h3>
                                                    <p className="text-sm text-zinc-400">{response.user?.email}</p>
                                                </div>
                                                <span className={`px-2 py-1 rounded-full text-xs font-bold ${
                                                    response.organization_type === 'nonprofit' ? 'bg-pink-500/20 text-pink-400' :
                                                    response.organization_type === 'business' ? 'bg-blue-500/20 text-blue-400' :
                                                    'bg-zinc-700 text-zinc-400'
                                                }`}>
                                                    {response.organization_type || 'individual'}
                                                </span>
                                            </div>
                                            <p className="text-xs text-zinc-500 mt-2">
                                                Completed: {new Date(response.completed_at).toLocaleDateString()}
                                            </p>
                                        </div>
                                    ))
                                )}
                            </div>

                            {/* Selected Response Details */}
                            <div className="bg-zinc-800/50 rounded-xl p-6">
                                {selectedOnboarding ? (
                                    <div className="space-y-6">
                                        <div>
                                            <h3 className="text-lg font-bold text-white mb-1">{selectedOnboarding.user?.name || 'Unknown User'}</h3>
                                            <p className="text-zinc-400">{selectedOnboarding.user?.email}</p>
                                            <p className="text-sm text-zinc-500 mt-1">
                                                User since: {new Date(selectedOnboarding.user?.created_at).toLocaleDateString()}
                                            </p>
                                        </div>

                                        <div className="grid grid-cols-2 gap-4 text-sm">
                                            <div>
                                                <span className="text-zinc-500">Organization Type</span>
                                                <p className="text-white font-bold capitalize">{selectedOnboarding.organization_type || 'Individual'}</p>
                                            </div>
                                            <div>
                                                <span className="text-zinc-500">Completed</span>
                                                <p className="text-white">{new Date(selectedOnboarding.completed_at).toLocaleString()}</p>
                                            </div>
                                        </div>

                                        {/* All Responses */}
                                        <div>
                                            <span className="text-zinc-500 text-sm">All Responses</span>
                                            <div className="mt-2 bg-zinc-900/50 rounded-lg p-4 text-sm space-y-2">
                                                {selectedOnboarding.responses && Object.entries(selectedOnboarding.responses).map(([key, value]) => (
                                                    <div key={key} className="py-2 border-b border-zinc-800 last:border-0">
                                                        <span className="text-zinc-400 capitalize block text-xs mb-1">{key.replace(/([A-Z])/g, ' $1')}</span>
                                                        <span className="text-white">{Array.isArray(value) ? value.join(', ') : String(value)}</span>
                                                    </div>
                                                ))}
                                            </div>
                                        </div>
                                    </div>
                                ) : (
                                    <div className="h-full flex items-center justify-center text-zinc-500">
                                        <div className="text-center">
                                            <Users size={48} className="mx-auto mb-4" />
                                            <p>Select a response to view details</p>
                                        </div>
                                    </div>
                                )}
                            </div>
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
                            {/* Stripe Settings */}
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

                            {/* Backend Default Currency */}
                            <div className="bg-zinc-800/50 p-6 rounded-2xl border border-zinc-700">
                                <h3 className="font-bold text-white mb-4 flex items-center gap-2">
                                    <DollarSign size={20} className="text-green-400" /> Backend Default Currency
                                </h3>
                                <p className="text-sm text-zinc-400 mb-6">
                                    Set the platform's default charge currency. This applies to events that don't specify their own currency.
                                    <br /><span className="text-amber-400 mt-2 inline-block">⚠️ Stripe charges will use this currency unless the event overrides it.</span>
                                </p>

                                <div className="space-y-4">
                                    <div>
                                        <label className="block text-xs font-bold text-zinc-500 uppercase mb-2">Default Charge Currency</label>
                                        <select
                                            value={backendDefaultCurrency}
                                            onChange={e => setBackendDefaultCurrency(e.target.value)}
                                            className="w-full bg-black border border-zinc-700 rounded-xl px-4 py-3 text-white"
                                        >
                                            <option value="USD">🇺🇸 USD - US Dollar ($)</option>
                                            <option value="EUR">🇪🇺 EUR - Euro (€)</option>
                                            <option value="GBP">🇬🇧 GBP - British Pound (£)</option>
                                            <option value="CAD">🇨🇦 CAD - Canadian Dollar (C$)</option>
                                            <option value="AUD">🇦🇺 AUD - Australian Dollar (A$)</option>
                                        </select>
                                    </div>
                                    <div className="bg-zinc-900/50 p-4 rounded-lg">
                                        <p className="text-xs text-zinc-400 mb-2 font-bold">Currency Priority Logic:</p>
                                        <ol className="text-xs text-zinc-500 list-decimal list-inside space-y-1">
                                            <li>Event's charge currency (if organizer sets one)</li>
                                            <li>Backend default currency (this setting)</li>
                                            <li>USD as final fallback</li>
                                        </ol>
                                    </div>
                                </div>

                                <div className="mt-6 flex justify-end">
                                    <Button 
                                        onClick={() => {
                                            localStorage.setItem('openticket_backend_default_currency', backendDefaultCurrency);
                                            window.alert(`Backend default currency set to ${backendDefaultCurrency}. All events without a specific currency will use this for charges.`);
                                        }} 
                                        className="bg-green-600 hover:bg-green-700 text-white border-none"
                                    >
                                        <Save size={16} className="mr-2" /> Save Currency Settings
                                    </Button>
                                </div>
                            </div>

                            {/* Resend Email Service Settings */}
                            <div className="bg-zinc-800/50 p-6 rounded-2xl border border-zinc-700">
                                <h3 className="font-bold text-white mb-4 flex items-center gap-2">
                                    <Mail size={20} className="text-pink-400" /> Email Service (Resend)
                                </h3>
                                <p className="text-sm text-zinc-400 mb-6">
                                    Resend is configured via environment variables on the backend. This enables transactional emails, campaigns, and attendee engagement features.
                                </p>

                                <div className="space-y-4">
                                    <div className="flex items-center gap-4 p-4 bg-black/50 rounded-xl">
                                        <div className={`w-12 h-12 rounded-xl flex items-center justify-center ${resendApiKeyConfigured ? 'bg-green-500/20' : 'bg-zinc-700'}`}>
                                            {resendApiKeyConfigured ? (
                                                <CheckCircle size={24} className="text-green-500" />
                                            ) : (
                                                <AlertCircle size={24} className="text-zinc-400" />
                                            )}
                                        </div>
                                        <div className="flex-1">
                                            <p className="font-bold text-white">
                                                {resendApiKeyConfigured ? 'Resend Connected' : 'Resend Not Configured'}
                                            </p>
                                            <p className="text-sm text-zinc-400">
                                                {resendApiKeyConfigured 
                                                    ? 'Email service is ready to send transactional emails' 
                                                    : 'Add RESEND_API_KEY to backend environment variables'}
                                            </p>
                                        </div>
                                        <Button variant="outline" onClick={async () => {
                                            try {
                                                const response = await fetch('/api/email/status', { cache: 'no-store' });
                                                const status = await response.json();
                                                const isConfigured = status.configured === true && status.available === true;
                                                setResendApiKeyConfigured(isConfigured);
                                                window.alert(`Resend Status:\n\nConfigured: ${status.configured}\nAvailable: ${status.available}\nProvider: ${status.provider}\nSender: ${status.senderEmail}\n\nResult: ${isConfigured ? '✅ Connected' : '❌ Not Connected'}`);
                                            } catch (error: any) {
                                                window.alert(`Error checking Resend status: ${error.message}`);
                                            }
                                        }} size="sm">
                                            Refresh Status
                                        </Button>
                                    </div>

                                    <div className="p-4 bg-blue-900/20 border border-blue-700 rounded-xl">
                                        <h4 className="font-bold text-blue-400 text-sm mb-2">Configuration Instructions</h4>
                                        <ol className="text-xs text-zinc-400 space-y-2 list-decimal list-inside">
                                            <li>Sign up at <a href="https://resend.com" target="_blank" className="text-pink-400 underline">resend.com</a></li>
                                            <li>Go to Dashboard → API Keys → Create API Key</li>
                                            <li>Add to backend/.env: <code className="bg-black px-2 py-1 rounded">RESEND_API_KEY=re_your_key</code></li>
                                            <li>Restart the backend service</li>
                                        </ol>
                                    </div>
                                    
                                    <div className="mt-4 pt-4 border-t border-zinc-700">
                                        <h4 className="font-bold text-white text-sm mb-3">Available Email Features</h4>
                                        <div className="grid grid-cols-2 gap-3">
                                            <div className="bg-black/50 p-3 rounded-xl">
                                                <div className="flex items-center gap-2 text-blue-400 text-sm font-bold mb-1">
                                                    <Clock size={14} /> Pre-Event Reminder
                                                </div>
                                                <p className="text-xs text-zinc-500">Sent 24h before event</p>
                                            </div>
                                            <div className="bg-black/50 p-3 rounded-xl">
                                                <div className="flex items-center gap-2 text-green-400 text-sm font-bold mb-1">
                                                    <CheckCircle size={14} /> Post-Event Follow-up
                                                </div>
                                                <p className="text-xs text-zinc-500">Sent after event ends</p>
                                            </div>
                                            <div className="bg-black/50 p-3 rounded-xl">
                                                <div className="flex items-center gap-2 text-orange-400 text-sm font-bold mb-1">
                                                    <AlertCircle size={14} /> Abandoned Cart
                                                </div>
                                                <p className="text-xs text-zinc-500">Recover lost sales</p>
                                            </div>
                                            <div className="bg-black/50 p-3 rounded-xl">
                                                <div className="flex items-center gap-2 text-purple-400 text-sm font-bold mb-1">
                                                    <Megaphone size={14} /> Newsletter
                                                </div>
                                                <p className="text-xs text-zinc-500">Custom announcements</p>
                                            </div>
                                        </div>
                                    </div>
                                </div>
                            </div>

                            {/* Database Migrations */}
                            <div className="bg-zinc-800/50 p-6 rounded-2xl border border-zinc-700">
                                <h3 className="font-bold text-white mb-4 flex items-center gap-2">
                                    <RefreshCw size={20} className="text-amber-400" /> Database Migrations
                                </h3>
                                <p className="text-sm text-zinc-400 mb-6">
                                    Run database migrations to update user data. Use dry-run mode first to preview changes.
                                </p>

                                <div className="space-y-4">
                                    {/* Plan ID Assignment Migration */}
                                    <div className="bg-black/50 p-4 rounded-xl">
                                        <div className="flex items-center justify-between mb-3">
                                            <div>
                                                <h4 className="font-bold text-white">Assign Plan IDs (Grandfathering)</h4>
                                                <p className="text-xs text-zinc-500 mt-1">
                                                    Assigns <code className="bg-zinc-800 px-1 rounded">plan_id</code> (e.g., free_v1, pro_v1) to existing users for backward compatibility.
                                                </p>
                                            </div>
                                            <Badge variant="outline" className="text-amber-400 border-amber-400/50">
                                                v1 → v2 Migration
                                            </Badge>
                                        </div>

                                        <div className="flex gap-2 mt-4">
                                            <Button
                                                variant="outline"
                                                size="sm"
                                                disabled={migrationRunning}
                                                onClick={async () => {
                                                    setMigrationRunning(true);
                                                    setMigrationResults(null);
                                                    try {
                                                        const token = await StorageService.getAuthToken();
                                                        const response = await fetch('/api/admin/run-migration', {
                                                            method: 'POST',
                                                            headers: {
                                                                'Content-Type': 'application/json',
                                                                'Authorization': `Bearer ${token}`
                                                            },
                                                            body: JSON.stringify({
                                                                migration: 'assign_plan_ids',
                                                                dryRun: true
                                                            })
                                                        });
                                                        const result = await response.json();
                                                        setMigrationResults({ ...result, mode: 'dry-run' });
                                                    } catch (error: any) {
                                                        setMigrationResults({ error: error.message, mode: 'dry-run' });
                                                    }
                                                    setMigrationRunning(false);
                                                }}
                                                className="flex-1"
                                            >
                                                {migrationRunning ? (
                                                    <><RefreshCw size={14} className="mr-2 animate-spin" /> Running...</>
                                                ) : (
                                                    <><Eye size={14} className="mr-2" /> Dry Run (Preview)</>
                                                )}
                                            </Button>
                                            <Button
                                                size="sm"
                                                disabled={migrationRunning}
                                                onClick={async () => {
                                                    const confirmed = await confirm(
                                                        'Run Migration',
                                                        'This will permanently update all user profiles with plan_id values. This action cannot be undone. Are you sure you want to proceed?'
                                                    );
                                                    if (!confirmed) return;

                                                    setMigrationRunning(true);
                                                    setMigrationResults(null);
                                                    try {
                                                        const token = await StorageService.getAuthToken();
                                                        const response = await fetch('/api/admin/run-migration', {
                                                            method: 'POST',
                                                            headers: {
                                                                'Content-Type': 'application/json',
                                                                'Authorization': `Bearer ${token}`
                                                            },
                                                            body: JSON.stringify({
                                                                migration: 'assign_plan_ids',
                                                                dryRun: false
                                                            })
                                                        });
                                                        const result = await response.json();
                                                        setMigrationResults({ ...result, mode: 'live' });
                                                    } catch (error: any) {
                                                        setMigrationResults({ error: error.message, mode: 'live' });
                                                    }
                                                    setMigrationRunning(false);
                                                }}
                                                className="flex-1 bg-amber-600 hover:bg-amber-700 text-white border-none"
                                            >
                                                <Zap size={14} className="mr-2" /> Run Migration (Live)
                                            </Button>
                                        </div>

                                        {/* Migration Results */}
                                        {migrationResults && (
                                            <div className={`mt-4 p-4 rounded-lg ${
                                                migrationResults.error 
                                                    ? 'bg-red-900/30 border border-red-700' 
                                                    : migrationResults.mode === 'dry-run'
                                                        ? 'bg-blue-900/30 border border-blue-700'
                                                        : 'bg-green-900/30 border border-green-700'
                                            }`}>
                                                <div className="flex items-center gap-2 mb-2">
                                                    {migrationResults.error ? (
                                                        <XCircle size={16} className="text-red-400" />
                                                    ) : migrationResults.mode === 'dry-run' ? (
                                                        <Eye size={16} className="text-blue-400" />
                                                    ) : (
                                                        <CheckCircle size={16} className="text-green-400" />
                                                    )}
                                                    <span className={`font-bold text-sm ${
                                                        migrationResults.error ? 'text-red-400' : 
                                                        migrationResults.mode === 'dry-run' ? 'text-blue-400' : 'text-green-400'
                                                    }`}>
                                                        {migrationResults.error 
                                                            ? 'Migration Failed' 
                                                            : migrationResults.mode === 'dry-run' 
                                                                ? 'Dry Run Complete (No Changes Made)'
                                                                : 'Migration Complete'}
                                                    </span>
                                                </div>
                                                
                                                {migrationResults.error ? (
                                                    <p className="text-sm text-red-300">{migrationResults.error}</p>
                                                ) : migrationResults.results && (
                                                    <div className="text-sm space-y-1">
                                                        <p className="text-zinc-300">
                                                            <span className="text-zinc-500">Processed:</span> {migrationResults.results.processed} users
                                                        </p>
                                                        <p className="text-zinc-300">
                                                            <span className="text-zinc-500">Updated:</span> {migrationResults.results.updated} users
                                                        </p>
                                                        <p className="text-zinc-300">
                                                            <span className="text-zinc-500">Skipped:</span> {migrationResults.results.skipped} (already had plan_id)
                                                        </p>
                                                        {migrationResults.results.errors?.length > 0 && (
                                                            <p className="text-red-300">
                                                                <span className="text-zinc-500">Errors:</span> {migrationResults.results.errors.length}
                                                            </p>
                                                        )}
                                                    </div>
                                                )}
                                            </div>
                                        )}
                                    </div>
                                </div>
                            </div>
                        </div>
                    </div>
                )}

            {/* Confirmation Modal */}
            {confirmModal.show && (
                <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/70 backdrop-blur-sm">
                    <div className="bg-zinc-900 border border-zinc-700 rounded-2xl p-6 max-w-md w-full mx-4 shadow-2xl">
                        <h3 className={`text-xl font-bold mb-4 ${
                            confirmModal.type === 'approve' ? 'text-green-400' : 
                            confirmModal.type === 'reject' ? 'text-red-400' : 'text-white'
                        }`}>
                            {confirmModal.title}
                        </h3>
                        <p className="text-zinc-300 whitespace-pre-line mb-6">{confirmModal.message}</p>
                        <div className="flex gap-3">
                            {confirmModal.type !== 'other' && (
                                <button
                                    onClick={() => setConfirmModal({ ...confirmModal, show: false })}
                                    className="flex-1 bg-zinc-700 hover:bg-zinc-600 text-white font-bold py-3 px-4 rounded-xl"
                                >
                                    Cancel
                                </button>
                            )}
                            <button
                                onClick={confirmModal.onConfirm}
                                className={`flex-1 font-bold py-3 px-4 rounded-xl ${
                                    confirmModal.type === 'approve' ? 'bg-green-600 hover:bg-green-700 text-white' :
                                    confirmModal.type === 'reject' ? 'bg-red-600 hover:bg-red-700 text-white' :
                                    'bg-[#E0FF20] hover:bg-[#c8e01c] text-black'
                                }`}
                            >
                                {confirmModal.type === 'other' ? 'OK' : 'Confirm'}
                            </button>
                        </div>
                    </div>
                </div>
            )}

            {/* Lightbox for Document Images */}
            {lightboxImage && (
                <div 
                    className="fixed inset-0 z-[100] flex items-center justify-center bg-black/90 backdrop-blur-sm cursor-pointer"
                    onClick={() => setLightboxImage(null)}
                >
                    <div className="relative max-w-[90vw] max-h-[90vh]">
                        <button
                            onClick={() => setLightboxImage(null)}
                            className="absolute -top-10 right-0 text-white hover:text-zinc-300"
                        >
                            <X size={32} />
                        </button>
                        <img 
                            src={lightboxImage} 
                            alt="Document Preview" 
                            className="max-w-full max-h-[85vh] rounded-lg shadow-2xl"
                            onClick={(e) => e.stopPropagation()}
                        />
                    </div>
                </div>
            )}
            </div>
        </div>
    );
};
