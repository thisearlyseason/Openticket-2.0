
// Map of common currencies to exchange rates (Base: USD)
// In a real app, this would fetch from an API like OpenExchangeRates
const EXCHANGE_RATES: Record<string, number> = {
    'USD': 1.00,
    'EUR': 0.92,
    'GBP': 0.78,
    'CAD': 1.36,
    'AUD': 1.52,
    'JPY': 151.40,
    'MXN': 16.70
};

const SYMBOLS: Record<string, string> = {
    'USD': '$',
    'EUR': '€',
    'GBP': '£',
    'CAD': 'CA$',
    'AUD': 'A$',
    'JPY': '¥',
    'MXN': 'MX$'
};

export const CurrencyService = {
    /**
     * Get the user's preferred currency safely.
     * Defaults to USD if detection fails or not supported.
     */
    getUserCurrency: (): string => {
        if (typeof navigator !== 'undefined' && navigator.language) {
            // Rough mapping of locales to currencies
            const locale = navigator.language.toLowerCase();
            if (locale.includes('gb') || locale.includes('uk')) return 'GBP';
            if (locale.includes('de') || locale.includes('fr') || locale.includes('es') || locale.includes('it')) return 'EUR';
            if (locale.includes('ca')) return 'CAD';
            if (locale.includes('au')) return 'AUD';
            if (locale.includes('jp')) return 'JPY';
            if (locale.includes('mx')) return 'MXN';
        }
        return 'USD';
    },

    /**
     * Convert a USD amount to the target currency.
     */
    convert: (amountInUsd: number, currency: string = 'USD'): number => {
        const rate = EXCHANGE_RATES[currency] || 1.0;
        return amountInUsd * rate;
    },

    /**
     * Format a price for display.
     * Example: formatPrompt(10, 'EUR') -> "€9.20"
     */
    format: (amountInUsd: number, currency: string = 'USD', includeApprox = false): string => {
        const converted = CurrencyService.convert(amountInUsd, currency);
        const symbol = SYMBOLS[currency] || '$';

        // JPY doesn't have decimals usually
        const decimals = currency === 'JPY' ? 0 : 2;
        const formatted = `${symbol}${converted.toFixed(decimals)}`;

        if (includeApprox && currency !== 'USD') {
            return `~${formatted}`;
        }
        return formatted;
    },

    /**
     * Helper to get the symbol
     */
    getSymbol: (currency: string) => SYMBOLS[currency] || '$'
};
