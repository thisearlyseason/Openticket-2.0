/**
 * Shared types and interfaces for Super Admin Dashboard
 */

export interface FinancialTransaction {
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

export interface OrganizerBreakdown {
    organizerId: string;
    organizerName: string;
    organizerEmail: string;
    totalVolume: number;
    platformFees: number;
    netEarnings: number;
    transactionCount: number;
}

export interface AffiliateData {
    id: string;
    name: string;
    email: string;
    affiliateCode: string;
    stripeConnectId?: string;
    totalEarnings: number;
    pendingPayout: number;
    paidOut: number;
    clicks: number;
    registrations: number;
}

export interface AffiliatePayout {
    id: string;
    affiliate_id: string;
    amount: number;
    method: 'stripe' | 'offline';
    status: 'pending' | 'completed' | 'failed';
    notes?: string;
    created_at: string;
    completed_at?: string;
}

export interface PromoCode {
    id: string;
    code: string;
    type: 'percentage' | 'fixed';
    value: number;
    target: 'subscription' | 'ticket' | 'all';
    target_plans?: string[];
    usage_limit: number;
    usage_count: number;
    expires_at?: string;
    created_at: string;
    active: boolean;
}

export interface DonationBreakdown {
    total: number;
    count: number;
    byAmount: { '$1': number; '$2': number; '$5': number; '$10': number; 'other': number };
    recent: { amount: number; attendeeName: string; eventTitle: string; createdAt: string }[];
    thisMonth: number;
    lastMonth: number;
}

export interface FinancialSummary {
    totalRevenue: number;
    platformFees: number;
    transactionCount: number;
    recentTransactions: FinancialTransaction[];
    organizerBreakdown: OrganizerBreakdown[];
    donationBreakdown: DonationBreakdown;
}

export interface NonprofitApplication {
    id: string;
    user_id: string;
    email: string;
    name: string;
    nonprofit_name: string;
    nonprofit_ein: string;
    nonprofit_doc_url: string;
    nonprofit_status: 'pending' | 'approved' | 'rejected';
    created_at: string;
    reviewed_at?: string;
    reviewed_by?: string;
    reject_reason?: string;
}

export interface OnboardingResponse {
    id: string;
    user_id: string;
    email: string;
    name: string;
    role: string;
    business_name?: string;
    business_type?: string;
    event_types?: string;
    submitted_at: string;
}

export interface SuspiciousActivity {
    id: string;
    action: string;
    entity_type: string;
    entity_id: string;
    user_id?: string;
    user_email?: string;
    details: any;
    severity: 'info' | 'warning' | 'critical';
    created_at: string;
}

export type AdminTab = 
    | 'users' 
    | 'events' 
    | 'registrations' 
    | 'finance' 
    | 'affiliates' 
    | 'security' 
    | 'analytics' 
    | 'broadcast' 
    | 'promo' 
    | 'nonprofit' 
    | 'onboarding' 
    | 'settings';

export interface ConfirmModalState {
    show: boolean;
    title: string;
    message: string;
    onConfirm: () => void;
    type: 'approve' | 'reject' | 'other';
}
