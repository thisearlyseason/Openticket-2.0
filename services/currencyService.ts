/**
 * Currency Service - Handles automatic currency detection and conversion
 * 
 * NOTE: All prices are displayed in local currency for reference only.
 * All payments are processed in USD.
 */

export interface CurrencyInfo {
    code: string;
    symbol: string;
    name: string;
    rate: number; // Exchange rate from USD
}

// Supported currencies (Major only - default to USD for others)
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
const CACHE_DURATION = 24 * 60 * 60 * 1000; // 24 hours

interface CurrencyCache {
    currency: string;
    timestamp: number;
    source: 'ip' | 'geo' | 'manual' | 'default';
}

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
    try {
        // Try ip-api.com (free, no API key)
        const response = await fetch('http://ip-api.com/json/?fields=countryCode', {
            method: 'GET',
            signal: AbortSignal.timeout(5000),
        });
        
        if (response.ok) {
            const data = await response.json();
            if (data.countryCode) {
                return countryToCurrency(data.countryCode);
            }
        }
    } catch (e) {
        // Silent fail, try fallback
    }
    
    // Fallback: ipapi.co
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
        // Silent fail
    }
    
    return 'USD';
};

/**
 * Detect currency via Browser Geolocation API
 */
const detectCurrencyByGeolocation = (): Promise<string> => {
    return new Promise((resolve) => {
        if (!navigator.geolocation) {
            resolve('USD');
            return;
        }

        const timeout = setTimeout(() => resolve('USD'), 10000);

        navigator.geolocation.getCurrentPosition(
            async (position) => {
                clearTimeout(timeout);
                try {
                    const { latitude, longitude } = position.coords;
                    const response = await fetch(
                        `https://nominatim.openstreetmap.org/reverse?lat=${latitude}&lon=${longitude}&format=json`,
                        { 
                            headers: { 'User-Agent': 'OpenTicket/1.0' },
                            signal: AbortSignal.timeout(5000),
                        }
                    );
                    
                    if (response.ok) {
                        const data = await response.json();
                        const countryCode = data.address?.country_code?.toUpperCase();
                        if (countryCode) {
                            resolve(countryToCurrency(countryCode));
                            return;
                        }
                    }
                } catch (e) {
                    // Silent fail
                }
                resolve('USD');
            },
            () => {
                clearTimeout(timeout);
                resolve('USD');
            },
            { timeout: 10000, maximumAge: 3600000 }
        );
    });
};

/**
 * Detect currency from browser language (quick fallback)
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
     * Clear user's manual currency preference (revert to auto-detect)
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
     * Priority: Manual preference > Cached > IP > Geolocation > Language > USD
     */
    autoDetectCurrency: async (): Promise<string> => {
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

        // 3. Try IP detection (primary)
        let currency = await detectCurrencyByIP();
        if (currency !== 'USD') {
            setCachedCurrency(currency, 'ip');
            return currency;
        }

        // 4. Try browser geolocation (fallback)
        currency = await detectCurrencyByGeolocation();
        if (currency !== 'USD') {
            setCachedCurrency(currency, 'geo');
            return currency;
        }

        // 5. Language detection
        currency = detectCurrencyByLanguage();
        setCachedCurrency(currency, 'default');
        return currency;
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
     * Format a price for display
     */
    format: (amountInUsd: number, currency: string = 'USD', showApprox = true): string => {
        const info = SUPPORTED_CURRENCIES[currency] || SUPPORTED_CURRENCIES.USD;
        const converted = amountInUsd * info.rate;
        const formatted = `${info.symbol}${converted.toFixed(2)}`;
        
        if (showApprox && currency !== 'USD') {
            return `~${formatted}`;
        }
        return formatted;
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
};

export default CurrencyService;
