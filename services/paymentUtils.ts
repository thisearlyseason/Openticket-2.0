/**
 * Payment & Financial Utilities
 * Centralizes payment status handling and financial calculations
 * to ensure consistency across the entire application.
 */

// ==================== PAYMENT STATUS NORMALIZATION ====================

/**
 * Valid payment statuses that indicate a successful payment
 * Stripe uses 'succeeded', our system uses 'paid' and 'completed'
 */
export const PAID_STATUSES = ['paid', 'completed', 'succeeded'] as const;
export const UNPAID_STATUSES = ['pending', 'incomplete', 'failed', 'offline_pending'] as const;
export const REFUNDED_STATUSES = ['refunded', 'partially_refunded'] as const;

export type PaidStatus = typeof PAID_STATUSES[number];
export type UnpaidStatus = typeof UNPAID_STATUSES[number];
export type RefundedStatus = typeof REFUNDED_STATUSES[number];
export type PaymentStatus = PaidStatus | UnpaidStatus | RefundedStatus;

/**
 * Check if a payment status indicates successful payment
 * Use this instead of direct string comparisons
 */
export const isPaidStatus = (status?: string | null): boolean => {
    if (!status) return false;
    return PAID_STATUSES.includes(status.toLowerCase() as PaidStatus);
};

/**
 * Check if a payment status indicates pending/unpaid
 */
export const isUnpaidStatus = (status?: string | null): boolean => {
    if (!status) return true; // No status = unpaid
    return UNPAID_STATUSES.includes(status.toLowerCase() as UnpaidStatus);
};

/**
 * Check if a payment status indicates refunded
 */
export const isRefundedStatus = (status?: string | null): boolean => {
    if (!status) return false;
    return REFUNDED_STATUSES.includes(status.toLowerCase() as RefundedStatus);
};

/**
 * Get normalized display label for payment status
 * Standardizes all successful statuses to "Paid"
 */
export const getPaymentStatusLabel = (status?: string | null): string => {
    if (!status) return 'Pending';
    
    const lower = status.toLowerCase();
    
    if (isPaidStatus(lower)) return 'Paid';
    if (isRefundedStatus(lower)) return 'Refunded';
    if (lower === 'offline_pending') return 'Pay at Door';
    if (lower === 'failed') return 'Failed';
    
    return 'Pending';
};

/**
 * Get color class for payment status badge
 */
export const getPaymentStatusColor = (status?: string | null): 'green' | 'yellow' | 'red' | 'zinc' => {
    if (isPaidStatus(status)) return 'green';
    if (isRefundedStatus(status)) return 'red';
    if (status === 'failed') return 'red';
    return 'yellow';
};

// ==================== FINANCIAL CALCULATIONS ====================

import type { Registration, PurchasedTicket, PurchasedAddOn } from './types';

/**
 * Calculate total revenue from a registration
 * Includes tickets, add-ons, and donations
 */
export const calculateRegistrationRevenue = (reg: Registration): number => {
    let total = 0;
    
    // Tickets
    if (reg.tickets && Array.isArray(reg.tickets)) {
        total += reg.tickets.reduce((sum, t) => {
            return sum + ((Number(t.pricePerTicket) || 0) * (Number(t.quantity) || 0));
        }, 0);
    }
    
    // Add-ons
    if (reg.addOns && Array.isArray(reg.addOns)) {
        total += reg.addOns.reduce((sum, a) => {
            return sum + ((Number(a.price) || 0) * (Number(a.quantity) || 0));
        }, 0);
    }
    
    // Donation
    total += Number(reg.donationAmount) || 0;
    
    return total;
};

/**
 * Calculate total tickets count from a registration
 */
export const calculateRegistrationTickets = (reg: Registration): number => {
    if (reg.tickets && Array.isArray(reg.tickets)) {
        return reg.tickets.reduce((sum, t) => sum + (Number(t.quantity) || 0), 0);
    }
    return 1; // Default to 1 if no ticket details
};

/**
 * Calculate revenue from only PAID registrations
 * This is the source-of-truth calculation for financial displays
 */
export const calculatePaidRevenue = (registrations: Registration[]): number => {
    return registrations
        .filter(r => isPaidStatus(r.paymentStatus) && !isRefundedStatus(r.paymentStatus))
        .reduce((sum, r) => sum + calculateRegistrationRevenue(r), 0);
};

/**
 * Calculate tickets sold from only PAID registrations
 */
export const calculatePaidTickets = (registrations: Registration[]): number => {
    return registrations
        .filter(r => isPaidStatus(r.paymentStatus) && !isRefundedStatus(r.paymentStatus))
        .reduce((sum, r) => sum + calculateRegistrationTickets(r), 0);
};

/**
 * Calculate add-on revenue from PAID registrations
 */
export const calculatePaidAddOnRevenue = (registrations: Registration[]): number => {
    return registrations
        .filter(r => isPaidStatus(r.paymentStatus) && !isRefundedStatus(r.paymentStatus))
        .reduce((sum, r) => {
            if (r.addOns && Array.isArray(r.addOns)) {
                return sum + r.addOns.reduce((addonSum, a) => {
                    return addonSum + ((Number(a.price) || 0) * (Number(a.quantity) || 0));
                }, 0);
            }
            return sum;
        }, 0);
};

/**
 * Calculate ticket revenue (excluding add-ons) from PAID registrations
 */
export const calculatePaidTicketRevenue = (registrations: Registration[]): number => {
    return registrations
        .filter(r => isPaidStatus(r.paymentStatus) && !isRefundedStatus(r.paymentStatus))
        .reduce((sum, r) => {
            if (r.tickets && Array.isArray(r.tickets)) {
                return sum + r.tickets.reduce((ticketSum, t) => {
                    return ticketSum + ((Number(t.pricePerTicket) || 0) * (Number(t.quantity) || 0));
                }, 0);
            }
            return sum;
        }, 0);
};

/**
 * Get aggregated add-on data for an event
 * Returns add-ons grouped by name with total quantity and revenue
 */
export const getAddOnSummary = (registrations: Registration[]): {
    name: string;
    totalQuantity: number;
    totalRevenue: number;
    unitPrice: number;
}[] => {
    const addOnMap: Record<string, { quantity: number; revenue: number; price: number }> = {};
    
    registrations
        .filter(r => isPaidStatus(r.paymentStatus) && !isRefundedStatus(r.paymentStatus))
        .forEach(r => {
            if (r.addOns && Array.isArray(r.addOns)) {
                r.addOns.forEach(a => {
                    const key = a.name || 'Unknown Add-on';
                    if (!addOnMap[key]) {
                        addOnMap[key] = { quantity: 0, revenue: 0, price: Number(a.price) || 0 };
                    }
                    const qty = Number(a.quantity) || 1;
                    addOnMap[key].quantity += qty;
                    addOnMap[key].revenue += (Number(a.price) || 0) * qty;
                });
            }
        });
    
    return Object.entries(addOnMap).map(([name, data]) => ({
        name,
        totalQuantity: data.quantity,
        totalRevenue: data.revenue,
        unitPrice: data.price
    }));
};

// ==================== PAYOUT CALCULATIONS ====================

const MINIMUM_PAYOUT = 20; // Minimum payout threshold in USD

/**
 * Calculate available payout amount
 * Only includes paid registrations minus platform fees
 */
export const calculateAvailablePayout = (
    registrations: Registration[],
    platformFeePercent: number = 2.5
): { amount: number; isEligible: boolean; minimumRequired: number } => {
    const grossRevenue = calculatePaidRevenue(registrations);
    const platformFee = grossRevenue * (platformFeePercent / 100);
    const netAmount = grossRevenue - platformFee;
    
    return {
        amount: Math.max(0, netAmount),
        isEligible: netAmount >= MINIMUM_PAYOUT,
        minimumRequired: MINIMUM_PAYOUT
    };
};

// ==================== CURRENCY FORMATTING ====================

/**
 * Format currency amount for display
 */
export const formatCurrency = (
    amount: number,
    currency: string = 'USD',
    locale: string = 'en-US'
): string => {
    return new Intl.NumberFormat(locale, {
        style: 'currency',
        currency: currency,
        minimumFractionDigits: 2,
        maximumFractionDigits: 2
    }).format(amount);
};
