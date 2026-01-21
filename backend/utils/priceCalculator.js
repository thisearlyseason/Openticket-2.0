/**
 * SINGLE SOURCE OF TRUTH FOR PRICE CALCULATIONS
 * Used by both frontend (via API) and backend
 * Ensures checkout amounts always match Stripe amounts
 */

// Platform fee structure by plan
export const PLAN_FEES = {
    free: { percent: 0.045, fixed: 0.99 },         // 4.5% + $0.99
    pro: { percent: 0.029, fixed: 0.69 },          // 2.9% + $0.69
    premium: { percent: 0.019, fixed: 0.49 },      // 1.9% + $0.49
    enterprise: { percent: 0.019, fixed: 0.49 },   // 1.9% + $0.49
};

/**
 * Calculate platform service fee
 * @param {number} subtotal - Base amount in dollars
 * @param {string} plan - 'free' | 'pro' | 'premium'
 * @returns {number} Service fee in dollars
 */
export const calculatePlatformFee = (subtotal, plan = 'free') => {
    if (subtotal <= 0) return 0;
    const planFees = PLAN_FEES[plan] || PLAN_FEES.free;
    return Number(((subtotal * planFees.percent) + planFees.fixed).toFixed(2));
};

/**
 * Calculate complete order breakdown
 * @param {Object} params
 * @param {Object} params.event - Event object with ticket_tiers, add_ons, tax_rate, custom_fees, absorb_fees
 * @param {Object} params.ticketSelections - { tierId: quantity }
 * @param {Object} params.addOnSelections - { addonId: quantity }
 * @param {Object|null} params.promoCode - Applied promo code object
 * @param {string} params.organizerPlan - Organizer's subscription plan
 * @returns {Object} Complete price breakdown
 */
export const calculateOrderBreakdown = ({
    event,
    ticketSelections = {},
    addOnSelections = {},
    promoCode = null,
    organizerPlan = 'free',
    donationAmount = 0
}) => {
    const breakdown = {
        items: [],
        ticketSubtotal: 0,
        addOnSubtotal: 0,
        donationSubtotal: 0,
        rawSubtotal: 0,
        discountAmount: 0,
        discountedSubtotal: 0,
        taxableAmount: 0,
        taxAmount: 0,
        customFeesAmount: 0,
        platformFee: 0,
        grandTotal: 0,
        currency: 'usd',
    };

    // 1. Calculate ticket totals (for donation events, use donationAmount)
    for (const [ticketId, qty] of Object.entries(ticketSelections)) {
        const quantity = Number(qty) || 0;
        if (quantity <= 0) continue;

        let tierName = '';
        let tierPrice = 0;
        let found = false;

        // Find in tiers
        if (event.ticket_tiers && Array.isArray(event.ticket_tiers)) {
            const tier = event.ticket_tiers.find(t => t.id === ticketId);
            if (tier) {
                tierName = tier.name;
                tierPrice = Number(tier.price) || 0;
                found = true;
            }
        }

        // Fallback for general admission
        if (!found && ticketId === 'general') {
            tierName = event.ticket_name || 'General Admission';
            // For donation events, use the passed donationAmount
            if (event.price_type === 'donation') {
                tierPrice = 0; // Ticket itself is free, donation is separate
            } else if (event.price_type === 'free') {
                tierPrice = 0;
            } else {
                tierPrice = Number(event.price) || 0;
            }
            found = true;
        }

        if (found) {
            const itemTotal = tierPrice * quantity;
            breakdown.ticketSubtotal += itemTotal;
            breakdown.items.push({
                type: 'ticket',
                id: ticketId,
                name: tierName,
                unitPrice: tierPrice,
                quantity,
                total: itemTotal,
            });
        }
    }

    // 2. Calculate add-on totals
    if (event.add_ons && Array.isArray(event.add_ons)) {
        for (const [addonId, qty] of Object.entries(addOnSelections)) {
            const quantity = Number(qty) || 0;
            if (quantity <= 0) continue;

            const addon = event.add_ons.find(a => a.id === addonId);
            if (addon) {
                const itemTotal = (Number(addon.price) || 0) * quantity;
                breakdown.addOnSubtotal += itemTotal;
                breakdown.items.push({
                    type: 'addon',
                    id: addonId,
                    name: addon.name,
                    unitPrice: Number(addon.price) || 0,
                    quantity,
                    total: itemTotal,
                    taxable: addon.taxable !== false, // Default to taxable
                });
            }
        }
    }

    // 2b. Handle donation amount for donation-type events
    if (event.price_type === 'donation' && donationAmount > 0) {
        breakdown.donationSubtotal = Number(donationAmount) || 0;
        breakdown.items.push({
            type: 'donation',
            id: 'donation',
            name: 'Donation',
            unitPrice: breakdown.donationSubtotal,
            quantity: 1,
            total: breakdown.donationSubtotal,
            taxable: true, // Donations are typically taxable
        });
    }

    breakdown.rawSubtotal = breakdown.ticketSubtotal + breakdown.addOnSubtotal + breakdown.donationSubtotal;

    // 3. Apply promo code discount
    if (promoCode) {
        if (promoCode.type === 'percent') {
            breakdown.discountAmount = breakdown.rawSubtotal * (promoCode.value / 100);
        } else {
            breakdown.discountAmount = Math.min(promoCode.value, breakdown.rawSubtotal);
        }
    }
    breakdown.discountedSubtotal = Math.max(0, breakdown.rawSubtotal - breakdown.discountAmount);

    // 4. Calculate tax (on taxable items after discount)
    // Proportionally apply discount to each item
    const discountRatio = breakdown.rawSubtotal > 0 
        ? breakdown.discountedSubtotal / breakdown.rawSubtotal 
        : 1;

    // Tickets and donations are always taxable, add-ons check taxable flag
    breakdown.taxableAmount = (breakdown.ticketSubtotal + breakdown.donationSubtotal) * discountRatio;
    breakdown.items.forEach(item => {
        if (item.type === 'addon' && item.taxable) {
            breakdown.taxableAmount += item.total * discountRatio;
        }
    });

    if (event.tax_rate && event.tax_rate > 0) {
        breakdown.taxAmount = Number((breakdown.taxableAmount * (event.tax_rate / 100)).toFixed(2));
    }

    // 5. Calculate custom fees
    if (event.custom_fees && Array.isArray(event.custom_fees)) {
        event.custom_fees.forEach(fee => {
            let feeAmount = 0;
            if (fee.type === 'percent') {
                feeAmount = breakdown.discountedSubtotal * (fee.amount / 100);
            } else {
                feeAmount = fee.amount;
            }
            breakdown.customFeesAmount += Number(feeAmount.toFixed(2));
        });
    }

    // 6. Calculate platform fee
    const feeBase = breakdown.discountedSubtotal + breakdown.taxAmount + breakdown.customFeesAmount;
    
    // CRITICAL: ALWAYS calculate platform fee for paid transactions
    // Free tickets are the ONLY exception (per business requirements)
    // - Donation tickets: YES, charge platform fee on donation amount
    // - Organizer absorbs fees: YES, calculate fee but deduct from organizer revenue
    const isPaidTransaction = event.price_type !== 'free' && feeBase > 0;

    if (isPaidTransaction) {
        breakdown.platformFee = calculatePlatformFee(feeBase, organizerPlan);
        // Track whether organizer is absorbing this fee
        breakdown.platformFeeAbsorbedByOrganizer = event.absorb_fees === true;
    } else {
        breakdown.platformFeeAbsorbedByOrganizer = false;
    }

    // 7. Calculate grand total
    // If organizer absorbs fees, don't add platform fee to attendee's total
    if (breakdown.platformFeeAbsorbedByOrganizer) {
        // Attendee pays: subtotal + tax + custom fees (NO platform fee)
        breakdown.grandTotal = Number((
            breakdown.discountedSubtotal + 
            breakdown.taxAmount + 
            breakdown.customFeesAmount
        ).toFixed(2));
    } else {
        // Attendee pays: subtotal + tax + custom fees + platform fee
        breakdown.grandTotal = Number((
            breakdown.discountedSubtotal + 
            breakdown.taxAmount + 
            breakdown.customFeesAmount + 
            breakdown.platformFee
        ).toFixed(2));
    }

    return breakdown;
};

/**
 * Build Stripe line items from breakdown
 * @param {Object} breakdown - Result from calculateOrderBreakdown
 * @param {string} eventTitle - Event title for line item names
 * @param {string} chargeCurrency - Currency to charge in (e.g., 'usd', 'eur')
 * @param {number} conversionRate - Conversion rate from breakdown currency to charge currency (default 1)
 * @returns {Array} Stripe line_items array
 */
export const buildStripeLineItems = (breakdown, eventTitle, chargeCurrency = 'usd', conversionRate = 1) => {
    const lineItems = [];
    
    // Use the provided charge currency, falling back to breakdown.currency
    const currency = chargeCurrency || breakdown.currency || 'usd';
    
    // Helper to convert and round amounts to cents
    const convertToCents = (amountInOrgCurrency) => {
        const converted = amountInOrgCurrency * conversionRate;
        return Math.round(converted * 100); // cents
    };

    // Add tickets and add-ons
    breakdown.items.forEach(item => {
        // Apply discount proportionally
        const discountRatio = breakdown.rawSubtotal > 0 
            ? breakdown.discountedSubtotal / breakdown.rawSubtotal 
            : 1;
        const adjustedUnitPrice = convertToCents(item.unitPrice * discountRatio);

        lineItems.push({
            price_data: {
                currency: currency,
                product_data: {
                    name: item.type === 'ticket' 
                        ? `${eventTitle} - ${item.name}`
                        : item.type === 'donation'
                        ? 'Donation'
                        : `${item.name} (Add-on)`,
                    metadata: { type: item.type, id: item.id },
                },
                unit_amount: adjustedUnitPrice,
            },
            quantity: item.quantity,
        });
    });

    // Add tax as line item
    if (breakdown.taxAmount > 0) {
        lineItems.push({
            price_data: {
                currency: currency,
                product_data: { name: 'Tax' },
                unit_amount: convertToCents(breakdown.taxAmount),
            },
            quantity: 1,
        });
    }

    // Add custom fees as line items
    if (breakdown.customFeesAmount > 0) {
        lineItems.push({
            price_data: {
                currency: currency,
                product_data: { name: 'Additional Fees' },
                unit_amount: convertToCents(breakdown.customFeesAmount),
            },
            quantity: 1,
        });
    }

    // Add platform service fee as line item (ONLY if attendee pays it)
    if (breakdown.platformFee > 0 && !breakdown.platformFeeAbsorbedByOrganizer) {
        lineItems.push({
            price_data: {
                currency: currency,
                product_data: { name: 'Service Fee' },
                unit_amount: convertToCents(breakdown.platformFee),
            },
            quantity: 1,
        });
    }

    return lineItems;
};

export default {
    PLAN_FEES,
    calculatePlatformFee,
    calculateOrderBreakdown,
    buildStripeLineItems,
};
