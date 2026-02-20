/**
 * Financial Transaction Validator
 * Ensures financial records are balanced and accurate
 */

/**
 * Validate that financial transaction amounts add up correctly
 * @param {Object} transaction - Financial transaction object
 * @returns {Object} { isValid, error, difference }
 */
export const validateFinancialBalance = (transaction) => {
    const { gross_amount, platform_fee, stripe_fee, organizer_net } = transaction;

    // Convert to numbers and handle potential undefined values
    const gross = Number(gross_amount) || 0;
    const platform = Number(platform_fee) || 0;
    const stripe = Number(stripe_fee) || 0;
    const organizer = Number(organizer_net) || 0;

    // Calculate sum of components
    const calculated = Number((platform + stripe + organizer).toFixed(2));
    const difference = Number(Math.abs(calculated - gross).toFixed(2));

    // Allow 2 cent tolerance for rounding errors
    const TOLERANCE = 0.02;

    if (difference > TOLERANCE) {
        return {
            isValid: false,
            error: `Balance mismatch: $${calculated} (${platform} + ${stripe} + ${organizer}) != $${gross} (difference: $${difference})`,
            difference
        };
    }

    return {
        isValid: true,
        error: null,
        difference
    };
};

/**
 * Validate refund amount doesn't exceed original transaction
 * @param {number} refundAmount - Amount being refunded
 * @param {number} originalAmount - Original transaction amount
 * @param {Array} existingRefunds - Array of existing refund transactions
 * @returns {Object} { isValid, error, totalRefunded }
 */
export const validateRefundAmount = (refundAmount, originalAmount, existingRefunds = []) => {
    const refund = Math.abs(Number(refundAmount));
    const original = Number(originalAmount);

    // Check single refund doesn't exceed original
    if (refund > original) {
        return {
            isValid: false,
            error: `Refund amount ($${refund}) exceeds original transaction ($${original})`,
            totalRefunded: 0
        };
    }

    // Calculate total refunds including this one
    const totalRefunded = existingRefunds.reduce((sum, r) => {
        return sum + Math.abs(Number(r.gross_amount) || 0);
    }, refund);

    // Check total refunds don't exceed original
    if (totalRefunded > original + 0.01) { // Allow 1 cent tolerance
        return {
            isValid: false,
            error: `Total refunds ($${totalRefunded}) would exceed original transaction ($${original})`,
            totalRefunded: totalRefunded - refund
        };
    }

    return {
        isValid: true,
        error: null,
        totalRefunded: totalRefunded - refund
    };
};

/**
 * Validate transaction amount is within allowed limits
 * @param {number} amount - Transaction amount
 * @param {string} transactionType - Type of transaction
 * @returns {Object} { isValid, error }
 */
export const validateTransactionAmount = (amount, transactionType = 'payment') => {
    const amt = Number(amount);

    // Maximum transaction limit
    const MAX_AMOUNT = 50000; // $50,000
    
    // Check for negative amounts (only allowed for refunds)
    if (amt < 0 && transactionType !== 'refund') {
        return {
            isValid: false,
            error: `Negative amounts ($${amt}) only allowed for refunds`
        };
    }

    // Check for zero amounts (only allowed for free events)
    if (amt === 0 && transactionType !== 'free_event' && transactionType !== 'refund') {
        return {
            isValid: false,
            error: 'Zero amount transactions not allowed'
        };
    }

    // Check maximum limit
    if (amt > MAX_AMOUNT) {
        return {
            isValid: false,
            error: `Transaction amount ($${amt.toFixed(2)}) exceeds maximum allowed ($${MAX_AMOUNT})`
        };
    }

    return {
        isValid: true,
        error: null
    };
};

/**
 * Cap platform fee at reasonable maximum
 * @param {number} calculatedFee - Calculated platform fee
 * @returns {number} Capped fee
 */
export const capPlatformFee = (calculatedFee) => {
    const PLATFORM_FEE_CAP = 100; // $100 maximum
    return Math.min(Number(calculatedFee), PLATFORM_FEE_CAP);
};

/**
 * Log validation failure to audit trail
 * @param {string} validationType - Type of validation that failed
 * @param {Object} details - Failure details
 */
export const logValidationFailure = async (validationType, details, supabase, AuditLogService) => {
    console.error(`[Validation] ${validationType} failed:`, details);

    if (AuditLogService) {
        try {
            await AuditLogService.log({
                timestamp: new Date().toISOString(),
                actorId: 'system',
                actorType: 'system',
                action: 'validation_failure',
                targetType: 'financial_transaction',
                targetId: details.transactionId || 'unknown',
                details: {
                    validationType,
                    ...details
                }
            });
        } catch (err) {
            console.error('[Validation] Failed to log audit trail:', err);
        }
    }
};
