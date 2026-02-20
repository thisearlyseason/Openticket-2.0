/**
 * Financial Transaction Type Constants
 * Single source of truth for transaction categorization
 */

/**
 * ✅ FIX: Standardized transaction types
 * 
 * transaction_type: Detailed type (what happened)
 * type: Category (for reporting/filtering)
 */

// Detailed transaction types
export const TRANSACTION_TYPES = {
    // Event-related
    TICKET_SALE: 'ticket_sale',
    AT_DOOR_PAYMENT: 'at_door_payment',
    CHECKIN_PAYMENT: 'checkin_payment',
    
    // Subscription-related
    SUBSCRIPTION: 'subscription',
    SMM_SUBSCRIPTION: 'smm_subscription',
    
    // Platform-related
    PLATFORM_FEE: 'platform_fee',
    
    // Refunds
    REFUND: 'refund',
    
    // Free events
    FREE_EVENT: 'free_event'
};

// Transaction categories (for filtering/reporting)
export const TRANSACTION_CATEGORIES = {
    EVENT: 'event',
    SUBSCRIPTION: 'subscription',
    PLATFORM_FEE: 'platform_fee',
    REFUND: 'refund'
};

// Transaction statuses
export const TRANSACTION_STATUSES = {
    PENDING: 'pending',
    PROCESSING: 'processing',
    SUCCEEDED: 'succeeded',
    FAILED: 'failed',
    REFUNDED: 'refunded',
    PARTIALLY_REFUNDED: 'partially_refunded',
    CANCELLED: 'cancelled'
};

// Payout statuses
export const PAYOUT_STATUSES = {
    PENDING: 'pending',
    REQUESTED: 'requested',
    SCHEDULED: 'scheduled',
    PROCESSING: 'processing',
    PAID: 'paid',
    FAILED: 'failed',
    CANCELLED: 'cancelled'
};

/**
 * Map transaction_type to category (type)
 * @param {string} transactionType - Detailed transaction type
 * @returns {string} Category type
 */
export const getTransactionCategory = (transactionType) => {
    const mapping = {
        [TRANSACTION_TYPES.TICKET_SALE]: TRANSACTION_CATEGORIES.EVENT,
        [TRANSACTION_TYPES.AT_DOOR_PAYMENT]: TRANSACTION_CATEGORIES.EVENT,
        [TRANSACTION_TYPES.CHECKIN_PAYMENT]: TRANSACTION_CATEGORIES.EVENT,
        [TRANSACTION_TYPES.SUBSCRIPTION]: TRANSACTION_CATEGORIES.SUBSCRIPTION,
        [TRANSACTION_TYPES.SMM_SUBSCRIPTION]: TRANSACTION_CATEGORIES.SUBSCRIPTION,
        [TRANSACTION_TYPES.PLATFORM_FEE]: TRANSACTION_CATEGORIES.PLATFORM_FEE,
        [TRANSACTION_TYPES.REFUND]: TRANSACTION_CATEGORIES.REFUND,
        [TRANSACTION_TYPES.FREE_EVENT]: TRANSACTION_CATEGORIES.EVENT
    };
    
    return mapping[transactionType] || TRANSACTION_CATEGORIES.EVENT;
};

/**
 * Validate transaction type is recognized
 * @param {string} transactionType - Type to validate
 * @returns {boolean}
 */
export const isValidTransactionType = (transactionType) => {
    return Object.values(TRANSACTION_TYPES).includes(transactionType);
};

/**
 * Validate transaction category is recognized
 * @param {string} category - Category to validate
 * @returns {boolean}
 */
export const isValidTransactionCategory = (category) => {
    return Object.values(TRANSACTION_CATEGORIES).includes(category);
};

/**
 * Create standardized financial transaction object
 * Ensures both transaction_type and type are always set correctly
 * 
 * @param {Object} params
 * @param {string} params.transactionType - Detailed type (required)
 * @param {number} params.grossAmount - Total amount
 * @param {number} params.platformFee - Platform's fee
 * @param {number} params.stripeFee - Stripe's fee
 * @param {number} params.organizerNet - Organizer receives
 * @param {string} params.status - Transaction status
 * @param {string} params.payoutStatus - Payout status
 * @param {Object} params.metadata - Additional metadata
 * @returns {Object} Standardized transaction object
 */
export const createStandardizedTransaction = ({
    transactionType,
    grossAmount,
    platformFee,
    stripeFee,
    organizerNet,
    status = TRANSACTION_STATUSES.SUCCEEDED,
    payoutStatus = PAYOUT_STATUSES.PENDING,
    stripePaymentIntentId = null,
    registrationId = null,
    eventId = null,
    organizerId = null,
    userId = null,
    currency = 'usd',
    metadata = {}
}) => {
    // Validate transaction type
    if (!isValidTransactionType(transactionType)) {
        throw new Error(`Invalid transaction type: ${transactionType}`);
    }
    
    // ✅ FIX: Always set both fields
    const category = getTransactionCategory(transactionType);
    
    return {
        transaction_type: transactionType,  // Detailed type
        type: category,                     // Category
        gross_amount: Number(grossAmount),
        platform_fee: Number(platformFee),
        stripe_fee: Number(stripeFee),
        organizer_net: Number(organizerNet),
        status,
        payout_status: payoutStatus,
        stripe_payment_intent_id: stripePaymentIntentId,
        registration_id: registrationId,
        event_id: eventId,
        organizer_id: organizerId,
        user_id: userId,
        currency: currency.toLowerCase(),
        metadata,
        created_at: new Date().toISOString()
    };
};

/**
 * Helper: Create event transaction
 */
export const createEventTransaction = (params) => {
    return createStandardizedTransaction({
        ...params,
        transactionType: params.isAtDoor 
            ? TRANSACTION_TYPES.AT_DOOR_PAYMENT 
            : TRANSACTION_TYPES.TICKET_SALE
    });
};

/**
 * Helper: Create subscription transaction
 */
export const createSubscriptionTransaction = (params) => {
    return createStandardizedTransaction({
        ...params,
        transactionType: params.isSMM 
            ? TRANSACTION_TYPES.SMM_SUBSCRIPTION 
            : TRANSACTION_TYPES.SUBSCRIPTION,
        organizerNet: 0 // Platform keeps 100%
    });
};

/**
 * Helper: Create refund transaction
 */
export const createRefundTransaction = (params) => {
    return createStandardizedTransaction({
        ...params,
        transactionType: TRANSACTION_TYPES.REFUND,
        grossAmount: -Math.abs(params.grossAmount),
        platformFee: -Math.abs(params.platformFee),
        stripeFee: -Math.abs(params.stripeFee),
        organizerNet: -Math.abs(params.organizerNet),
        status: TRANSACTION_STATUSES.REFUNDED
    });
};
