import { createRequire } from 'module';
const require = createRequire(import.meta.url);

/**
 * Stripe Helper Utilities
 * Centralized Stripe instance creation with validation
 */

/**
 * Validates Stripe API key format and returns mode
 * @param {string} apiKey - Stripe API key
 * @returns {object} { isValid, mode, error }
 */
export const validateStripeKey = (apiKey) => {
    if (!apiKey) {
        return {
            isValid: false,
            mode: null,
            error: 'STRIPE_SECRET_KEY is not configured. Please set it in your environment variables.'
        };
    }

    // Check format
    if (!apiKey.startsWith('sk_')) {
        return {
            isValid: false,
            mode: null,
            error: 'STRIPE_SECRET_KEY format is invalid. Must start with "sk_"'
        };
    }

    // Determine mode
    let mode = 'unknown';
    if (apiKey.startsWith('sk_test_')) {
        mode = 'test';
    } else if (apiKey.startsWith('sk_live_')) {
        mode = 'live';
    } else {
        return {
            isValid: false,
            mode: null,
            error: 'STRIPE_SECRET_KEY must start with "sk_test_" or "sk_live_"'
        };
    }

    return {
        isValid: true,
        mode,
        error: null
    };
};

/**
 * Get validated Stripe instance
 * Throws error if key is invalid
 * @returns {Stripe} Stripe instance
 */
export const getValidatedStripe = () => {
    const Stripe = require('stripe');
    const apiKey = process.env.STRIPE_SECRET_KEY;

    const validation = validateStripeKey(apiKey);
    
    if (!validation.isValid) {
        throw new Error(`Stripe Configuration Error: ${validation.error}`);
    }

    // Log mode for transparency (but not the full key)
    console.log(`[Stripe] Initialized in ${validation.mode.toUpperCase()} mode`);

    // Warn if using test mode in production-like environment
    if (validation.mode === 'test' && process.env.NODE_ENV === 'production') {
        console.warn('⚠️  [Stripe] WARNING: Using TEST mode keys in production environment!');
    }

    // Warn if using live mode in development
    if (validation.mode === 'live' && process.env.NODE_ENV === 'development') {
        console.warn('⚠️  [Stripe] WARNING: Using LIVE mode keys in development environment!');
    }

    return new Stripe(apiKey, { apiVersion: '2023-10-16' });
};

/**
 * Check if Stripe is in test mode
 * @returns {boolean}
 */
export const isTestMode = () => {
    const apiKey = process.env.STRIPE_SECRET_KEY;
    return apiKey?.startsWith('sk_test_') || false;
};

/**
 * Check if Stripe is in live mode
 * @returns {boolean}
 */
export const isLiveMode = () => {
    const apiKey = process.env.STRIPE_SECRET_KEY;
    return apiKey?.startsWith('sk_live_') || false;
};

/**
 * Get current Stripe mode
 * @returns {string} 'test' | 'live' | 'unknown'
 */
export const getStripeMode = () => {
    const validation = validateStripeKey(process.env.STRIPE_SECRET_KEY);
    return validation.mode || 'unknown';
};
