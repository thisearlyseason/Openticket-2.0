/**
 * Currency Service - Handles flexible currency handling for event pricing
 * 
 * CURRENCY PRIORITY LOGIC:
 * 1. Event charge currency (if set) - Single source of truth for payments
 * 2. Backend default currency (fallback) - Global platform default
 * 3. USD (ultimate fallback)
 * 
 * IMPORTANT DISTINCTION:
 * - CHARGE CURRENCY: What Stripe uses for payment (never changes based on user preference)
 * - DISPLAY CURRENCY: What user sees in UI (can be switched, UI-only, no payment impact)
 * 
 * Price integrity: Organizer-defined price + charge currency is the source of truth.
 * Display conversions are estimates only and never affect actual charges.
 */

export interface CurrencyInfo {
    code: string;
    symbol: string;
    name: string;
    rate: number; // Exchange rate from USD
}

// Backend default currency storage key
const BACKEND_DEFAULT_KEY = 'openticket_backend_default_currency';

// Supported currencies
export const SUPPORTED_CURRENCIES: Record<string, CurrencyInfo> = {
    USD: { code: 'USD', symbol: '$', name: 'US Dollar', rate: 1 },
    EUR: { code: 'EUR', symbol: '€', name: 'Euro', rate: 0.92 },
    GBP: { code: 'GBP', symbol: '£', name: 'British Pound', rate: 0.79 },
    CAD: { code: 'CAD', symbol: 'C$', name: 'Canadian Dollar', rate: 1.36 },
    AUD: { code: 'AUD', symbol: 'A$', name: 'Australian Dollar', rate: 1.53 },
};

// Country to currency mapping
const COUNTRY_CURRENCY_MAP: Record<string, string> = {
    // USD
    US: 'USD', PR: 'USD', GU: 'USD', VI: 'USD', AS: 'USD',
    // EUR (Eurozone)
    DE: 'EUR', FR: 'EUR', IT: 'EUR', ES: 'EUR', NL: 'EUR', BE: 'EUR',
    AT: 'EUR', PT: 'EUR', IE: 'EUR', FI: 'EUR', GR: 'EUR', SK: 'EUR',
    SI: 'EUR', LU: 'EUR', EE: 'EUR', LV: 'EUR', LT: 'EUR', MT: 'EUR', CY: 'EUR',
    // GBP
    GB: 'GBP', UK: 'GBP',
    // CAD
    CA: 'CAD',
    // AUD
    AU: 'AUD',
};

const STORAGE_KEY = 'openticket_currency';
const CACHE_KEY = 'openticket_currency_cache';
const RATES_CACHE_KEY = 'openticket_exchange_rates';
const CACHE_DURATION = 24 * 60 * 60 * 1000; // 24 hours
const RATES_CACHE_DURATION = 60 * 60 * 1000; // 1 hour for rates

interface CurrencyCache {
    currency: string;
    timestamp: number;
    source: 'ip' | 'geo' | 'manual' | 'default';
}

interface RatesCache {
    rates: Record<string, number>;
    timestamp: number;
}

// Get API URL from environment
const getApiUrl = () => {
    return (import.meta as any).env?.VITE_API_URL || '';
};

/**
 * Fetch live exchange rates from backend
 */
const fetchLiveRates = async (): Promise<Record<string, number> | null> => {
    try {
        // Check cache first
        const cached = localStorage.getItem(RATES_CACHE_KEY);
        if (cached) {
            const data = JSON.parse(cached) as RatesCache;
            if (Date.now() - data.timestamp < RATES_CACHE_DURATION) {
                return data.rates;
            }
        }

        const apiUrl = getApiUrl();
        const response = await fetch(`${apiUrl}/api/stripe/exchange-rates`, {
            method: 'GET',
            headers: { 'Content-Type': 'application/json' },
            signal: AbortSignal.timeout(5000),
        });

        if (response.ok) {
            const data = await response.json();
            if (data.success && data.rates) {
                // Cache the rates
                const cacheData: RatesCache = {
                    rates: data.rates,
                    timestamp: Date.now()
                };
                localStorage.setItem(RATES_CACHE_KEY, JSON.stringify(cacheData));
                
                // Update SUPPORTED_CURRENCIES with live rates
                Object.keys(data.rates).forEach(code => {
                    if (SUPPORTED_CURRENCIES[code]) {
                        SUPPORTED_CURRENCIES[code].rate = data.rates[code];
                    }
                });
                
                return data.rates;
            }
        }
    } catch (e) {
        console.warn('[CurrencyService] Failed to fetch live rates:', e);
    }
    return null;
};

/**
 * Get cached currency preference
 */
const getCachedCurrency = (): CurrencyCache | null => {
    try {
        const cached = localStorage.getItem(CACHE_KEY);
        if (cached) {
            const data = JSON.parse(cached) as CurrencyCache;
            if (data.source === 'manual' || Date.now() - data.timestamp < CACHE_DURATION) {
                return data;
            }
        }
    } catch (e) {
        // Silent fail
    }
    return null;
};

/**
 * Save currency preference to cache
 */
const setCachedCurrency = (currency: string, source: CurrencyCache['source']): void => {
    try {
        const data: CurrencyCache = { currency, timestamp: Date.now(), source };
        localStorage.setItem(CACHE_KEY, JSON.stringify(data));
    } catch (e) {
        // Silent fail
    }
};

/**
 * Map country code to currency
 */
const countryToCurrency = (countryCode: string): string => {
    const currency = COUNTRY_CURRENCY_MAP[countryCode.toUpperCase()];
    return currency && SUPPORTED_CURRENCIES[currency] ? currency : 'USD';
};

/**
 * Detect currency via IP geolocation
 */
const detectCurrencyByIP = async (): Promise<string> => {
    // Primary: ipapi.co (HTTPS, works on secure pages)
    try {
        const response = await fetch('https://ipapi.co/country/', {
            method: 'GET',
            signal: AbortSignal.timeout(5000),
        });
        
        if (response.ok) {
            const countryCode = await response.text();
            if (countryCode && countryCode.length === 2) {
                return countryToCurrency(countryCode.trim());
            }
        }
    } catch (e) {
        // Silent fail, try fallback
    }
    
    // Fallback: Use HTTPS alternative - ipapi.co (free tier supports HTTPS)
    try {
        const response = await fetch('https://ipapi.co/json/', {
            method: 'GET',
            signal: AbortSignal.timeout(5000),
        });
        
        if (response.ok) {
            const data = await response.json();
            if (data.country_code) {
                return countryToCurrency(data.country_code);
            }
        }
    } catch (e) {
        // Silent fail
    }
    
    return 'USD';
};

/**
 * Detect currency from browser language
 */
const detectCurrencyByLanguage = (): string => {
    try {
        const lang = navigator.language || '';
        const region = lang.split('-')[1]?.toUpperCase();
        if (region) {
            return countryToCurrency(region);
        }
    } catch (e) {
        // Silent fail
    }
    return 'USD';
};

export const CurrencyService = {
    SUPPORTED_CURRENCIES,

    /**
     * Initialize service - fetch live rates
     */
    init: async (): Promise<void> => {
        await fetchLiveRates();
    },

    /**
     * Get user's manual currency preference
     */
    getUserPreference: (): string | null => {
        try {
            return localStorage.getItem(STORAGE_KEY);
        } catch {
            return null;
        }
    },

    /**
     * Set user's manual currency preference
     */
    setUserPreference: (currency: string): void => {
        try {
            if (SUPPORTED_CURRENCIES[currency]) {
                localStorage.setItem(STORAGE_KEY, currency);
                setCachedCurrency(currency, 'manual');
            }
        } catch (e) {
            // Silent fail
        }
    },

    /**
     * Clear user's manual currency preference
     */
    clearUserPreference: (): void => {
        try {
            localStorage.removeItem(STORAGE_KEY);
            localStorage.removeItem(CACHE_KEY);
        } catch (e) {
            // Silent fail
        }
    },

    /**
     * Get the user's currency (sync - from cache/preference)
     */
    getUserCurrency: (): string => {
        // 1. Check manual preference
        const pref = CurrencyService.getUserPreference();
        if (pref && SUPPORTED_CURRENCIES[pref]) {
            return pref;
        }

        // 2. Check cache
        const cached = getCachedCurrency();
        if (cached && SUPPORTED_CURRENCIES[cached.currency]) {
            return cached.currency;
        }

        // 3. Quick language-based detection
        return detectCurrencyByLanguage();
    },

    /**
     * Auto-detect currency with full detection chain (async)
     */
    autoDetectCurrency: async (): Promise<string> => {
        // Fetch live rates in background
        fetchLiveRates();

        // 1. Check manual preference
        const pref = CurrencyService.getUserPreference();
        if (pref && SUPPORTED_CURRENCIES[pref]) {
            return pref;
        }

        // 2. Check cache
        const cached = getCachedCurrency();
        if (cached && SUPPORTED_CURRENCIES[cached.currency]) {
            return cached.currency;
        }

        // 3. Try IP detection
        let currency = await detectCurrencyByIP();
        if (currency !== 'USD') {
            setCachedCurrency(currency, 'ip');
            return currency;
        }

        // 4. Language detection
        currency = detectCurrencyByLanguage();
        setCachedCurrency(currency, 'default');
        return currency;
    },

    /**
     * Get current exchange rate for a currency
     */
    getRate: (currency: string): number => {
        return SUPPORTED_CURRENCIES[currency]?.rate || 1;
    },

    /**
     * Convert a USD amount to target currency
     */
    convert: (amountInUsd: number, currency: string = 'USD'): number => {
        const info = SUPPORTED_CURRENCIES[currency];
        if (!info) return amountInUsd;
        return amountInUsd * info.rate;
    },

    /**
     * Convert from target currency back to USD
     */
    convertToUSD: (amount: number, fromCurrency: string): number => {
        const info = SUPPORTED_CURRENCIES[fromCurrency];
        if (!info || info.rate === 0) return amount;
        return amount / info.rate;
    },

    /**
     * Format a price for display - always includes currency code to avoid confusion
     */
    format: (amountInUsd: number, currency: string = 'USD', showCode: boolean = true): string => {
        const info = SUPPORTED_CURRENCIES[currency] || SUPPORTED_CURRENCIES.USD;
        const converted = amountInUsd * info.rate;
        const formattedAmount = `${info.symbol}${converted.toFixed(2)}`;
        return showCode ? `${formattedAmount} ${info.code}` : formattedAmount;
    },

    /**
     * Format with locale-aware number formatting - always includes currency code
     */
    formatLocale: (amountInUsd: number, currency: string = 'USD', showCode: boolean = true): string => {
        const info = SUPPORTED_CURRENCIES[currency] || SUPPORTED_CURRENCIES.USD;
        const converted = amountInUsd * info.rate;
        
        try {
            const formatted = new Intl.NumberFormat(undefined, {
                style: 'currency',
                currency: info.code,
                minimumFractionDigits: 2,
                maximumFractionDigits: 2
            }).format(converted);
            // Intl.NumberFormat already includes currency code for most locales
            return formatted;
        } catch {
            const fallback = `${info.symbol}${converted.toFixed(2)}`;
            return showCode ? `${fallback} ${info.code}` : fallback;
        }
    },

    /**
     * Get currency symbol
     */
    getSymbol: (currency: string): string => {
        return SUPPORTED_CURRENCIES[currency]?.symbol || '$';
    },

    /**
     * Get currency info
     */
    getInfo: (currency: string): CurrencyInfo => {
        return SUPPORTED_CURRENCIES[currency] || SUPPORTED_CURRENCIES.USD;
    },

    /**
     * Get list of supported currencies for selector
     */
    getSupportedList: (): CurrencyInfo[] => {
        return Object.values(SUPPORTED_CURRENCIES);
    },

    /**
     * Refresh exchange rates from backend
     */
    refreshRates: async (): Promise<boolean> => {
        const rates = await fetchLiveRates();
        return rates !== null;
    },

    // ==================== BACKEND DEFAULT CURRENCY ====================

    /**
     * Get the backend default currency (platform-wide setting)
     * This is used when an event doesn't specify its own currency
     */
    getBackendDefaultCurrency: (): string => {
        try {
            const saved = localStorage.getItem(BACKEND_DEFAULT_KEY);
            if (saved && SUPPORTED_CURRENCIES[saved]) {
                return saved;
            }
        } catch (e) {
            // Silent fail
        }
        return 'USD'; // Ultimate fallback
    },

    /**
     * Set the backend default currency (admin only)
     */
    setBackendDefaultCurrency: (currency: string): void => {
        try {
            if (SUPPORTED_CURRENCIES[currency]) {
                localStorage.setItem(BACKEND_DEFAULT_KEY, currency);
            }
        } catch (e) {
            // Silent fail
        }
    },

    // ==================== CHARGE CURRENCY RESOLUTION ====================

    /**
     * Get the CHARGE currency for an event
     * This is the currency Stripe will use for payment
     * 
     * Priority: Event Currency → Backend Default → USD
     * 
     * @param eventCurrency - The event's specified currency (if any)
     * @returns The currency code to use for Stripe charges
     */
    getChargeCurrency: (eventCurrency?: string | null): string => {
        // Priority 1: Event's own charge currency
        if (eventCurrency && SUPPORTED_CURRENCIES[eventCurrency]) {
            return eventCurrency;
        }
        
        // Priority 2: Backend default currency
        const backendDefault = CurrencyService.getBackendDefaultCurrency();
        if (backendDefault && SUPPORTED_CURRENCIES[backendDefault]) {
            return backendDefault;
        }
        
        // Priority 3: USD fallback
        return 'USD';
    },

    // ==================== DISPLAY CURRENCY (UI-ONLY) ====================

    /**
     * Get user's DISPLAY currency preference
     * This is for UI display only and does NOT affect Stripe charges
     */
    getDisplayCurrency: (): string => {
        // User's manual preference for display
        const pref = CurrencyService.getUserPreference();
        if (pref && SUPPORTED_CURRENCIES[pref]) {
            return pref;
        }
        
        // Fall back to auto-detected currency
        return CurrencyService.getUserCurrency();
    },

    /**
     * Set user's DISPLAY currency preference (UI-only)
     * This does NOT affect payment currency
     */
    setDisplayCurrency: (currency: string): void => {
        CurrencyService.setUserPreference(currency);
    },

    // ==================== PRICE FORMATTING ====================

    /**
     * Format a price in its CHARGE currency (no conversion)
     * Use this for displaying the actual price that will be charged
     * 
     * @param amount - The price amount in the charge currency
     * @param chargeCurrency - The charge currency code
     * @param showCode - Whether to show currency code
     */
    formatChargeCurrency: (amount: number, chargeCurrency: string = 'USD', showCode: boolean = true): string => {
        const info = SUPPORTED_CURRENCIES[chargeCurrency] || SUPPORTED_CURRENCIES.USD;
        
        try {
            const formatted = new Intl.NumberFormat(undefined, {
                style: 'currency',
                currency: info.code,
                minimumFractionDigits: 2,
                maximumFractionDigits: 2
            }).format(amount);
            return formatted;
        } catch {
            const fallback = `${info.symbol}${amount.toFixed(2)}`;
            return showCode ? `${fallback} ${info.code}` : fallback;
        }
    },

    /**
     * Format a price converted to DISPLAY currency (for UI only)
     * Shows the approximate value in user's preferred currency
     * 
     * @param amount - The price amount in the charge currency
     * @param chargeCurrency - The original charge currency
     * @param displayCurrency - The user's display currency preference
     * @param showApproximate - Whether to prefix with ~ for conversions
     */
    formatDisplayCurrency: (
        amount: number, 
        chargeCurrency: string = 'USD', 
        displayCurrency?: string,
        showApproximate: boolean = true
    ): string => {
        const display = displayCurrency || CurrencyService.getDisplayCurrency();
        
        // If same currency, no conversion needed
        if (display === chargeCurrency) {
            return CurrencyService.formatChargeCurrency(amount, chargeCurrency);
        }
        
        // Convert: charge currency → USD → display currency
        const chargeInfo = SUPPORTED_CURRENCIES[chargeCurrency] || SUPPORTED_CURRENCIES.USD;
        const displayInfo = SUPPORTED_CURRENCIES[display] || SUPPORTED_CURRENCIES.USD;
        
        // Convert to USD first, then to display currency
        const amountInUsd = chargeInfo.rate !== 0 ? amount / chargeInfo.rate : amount;
        const convertedAmount = amountInUsd * displayInfo.rate;
        
        try {
            const formatted = new Intl.NumberFormat(undefined, {
                style: 'currency',
                currency: displayInfo.code,
                minimumFractionDigits: 2,
                maximumFractionDigits: 2
            }).format(convertedAmount);
            
            return showApproximate ? `≈ ${formatted}` : formatted;
        } catch {
            const fallback = `${displayInfo.symbol}${convertedAmount.toFixed(2)}`;
            return showApproximate ? `≈ ${fallback}` : fallback;
        }
    },

    /**
     * Check if display currency differs from charge currency
     */
    isDisplayDifferentFromCharge: (chargeCurrency: string): boolean => {
        const displayCurrency = CurrencyService.getDisplayCurrency();
        return displayCurrency !== chargeCurrency;
    },
};

export default CurrencyService;
