/**
 * Currency Auto-Detection Service
 * Detects user's currency based on location with manual override option
 */

export const SUPPORTED_CURRENCIES = {
    USD: { symbol: '$', name: 'US Dollar', countries: ['US'] },
    EUR: { symbol: '€', name: 'Euro', countries: ['DE', 'FR', 'IT', 'ES', 'NL', 'BE', 'AT', 'IE', 'PT', 'FI', 'GR'] },
    GBP: { symbol: '£', name: 'British Pound', countries: ['GB', 'UK'] },
    CAD: { symbol: 'C$', name: 'Canadian Dollar', countries: ['CA'] },
    AUD: { symbol: 'A$', name: 'Australian Dollar', countries: ['AU'] }
};

export type Currency = keyof typeof SUPPORTED_CURRENCIES;

/**
 * Detect user's currency based on their location
 */
export const detectUserCurrency = async (): Promise<Currency> => {
    // Check if currency is already saved in localStorage
    const savedCurrency = localStorage.getItem('preferredCurrency');
    if (savedCurrency && isValidCurrency(savedCurrency)) {
        console.log('[Currency] Using saved preference:', savedCurrency);
        return savedCurrency as Currency;
    }

    // Try to detect from browser locale
    const browserCurrency = detectFromBrowserLocale();
    if (browserCurrency) {
        console.log('[Currency] Detected from browser locale:', browserCurrency);
        saveCurrencyPreference(browserCurrency);
        return browserCurrency;
    }

    // Try to detect from IP geolocation (using ipapi.co free tier)
    try {
        const ipCurrency = await detectFromIP();
        if (ipCurrency) {
            console.log('[Currency] Detected from IP:', ipCurrency);
            saveCurrencyPreference(ipCurrency);
            return ipCurrency;
        }
    } catch (error) {
        console.warn('[Currency] IP detection failed:', error);
    }

    // Default to USD
    console.log('[Currency] Using default: USD');
    return 'USD';
};

/**
 * Detect currency from browser locale
 */
const detectFromBrowserLocale = (): Currency | null => {
    try {
        const locale = navigator.language || (navigator as any).userLanguage;
        const countryCode = locale.split('-')[1]?.toUpperCase();
        
        if (!countryCode) return null;

        // Map country code to currency
        for (const [currency, info] of Object.entries(SUPPORTED_CURRENCIES)) {
            if (info.countries.includes(countryCode)) {
                return currency as Currency;
            }
        }
    } catch (error) {
        console.warn('[Currency] Browser locale detection failed:', error);
    }
    return null;
};

/**
 * Detect currency from IP address using ipapi.co
 */
const detectFromIP = async (): Promise<Currency | null> => {
    try {
        // Use ipapi.co free tier (no API key needed, 1000 requests/day)
        const response = await fetch('https://ipapi.co/json/');
        
        if (!response.ok) {
            throw new Error(`IP API failed: ${response.status}`);
        }

        const data = await response.json();
        const countryCode = data.country_code;

        if (!countryCode) return null;

        // Map country code to currency
        for (const [currency, info] of Object.entries(SUPPORTED_CURRENCIES)) {
            if (info.countries.includes(countryCode)) {
                return currency as Currency;
            }
        }

        // Check if the API returned a currency directly
        if (data.currency && isValidCurrency(data.currency)) {
            return data.currency as Currency;
        }
    } catch (error) {
        console.warn('[Currency] IP detection failed:', error);
    }
    return null;
};

/**
 * Save user's currency preference
 */
export const saveCurrencyPreference = (currency: Currency): void => {
    if (isValidCurrency(currency)) {
        localStorage.setItem('preferredCurrency', currency);
        console.log('[Currency] Preference saved:', currency);
    }
};

/**
 * Get user's current currency preference
 */
export const getCurrentCurrency = (): Currency => {
    const saved = localStorage.getItem('preferredCurrency');
    return (saved && isValidCurrency(saved)) ? saved as Currency : 'USD';
};

/**
 * Check if a currency code is valid
 */
export const isValidCurrency = (currency: string): boolean => {
    return currency.toUpperCase() in SUPPORTED_CURRENCIES;
};

/**
 * Get currency symbol
 */
export const getCurrencySymbol = (currency: Currency): string => {
    return SUPPORTED_CURRENCIES[currency]?.symbol || '$';
};

/**
 * Get currency display name
 */
export const getCurrencyName = (currency: Currency): string => {
    return SUPPORTED_CURRENCIES[currency]?.name || 'US Dollar';
};

/**
 * Format price with currency
 */
export const formatPrice = (amount: number, currency: Currency): string => {
    const symbol = getCurrencySymbol(currency);
    return `${symbol}${amount.toFixed(2)}`;
};
