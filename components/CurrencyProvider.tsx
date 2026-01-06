import React, { createContext, useContext, useState, useEffect, useCallback, ReactNode } from 'react';
import { CurrencyService, CurrencyInfo, SUPPORTED_CURRENCIES } from '../services/currencyService';

interface CurrencyContextType {
    currency: string;
    currencyInfo: CurrencyInfo;
    isLoading: boolean;
    isAutoDetected: boolean;
    setCurrency: (code: string) => void;
    resetToAuto: () => void;
    convert: (amountUSD: number) => number;
    format: (amountUSD: number, showApprox?: boolean) => string;
    supportedCurrencies: CurrencyInfo[];
}

const CurrencyContext = createContext<CurrencyContextType | undefined>(undefined);

export const CurrencyProvider: React.FC<{ children: ReactNode }> = ({ children }) => {
    const [currency, setCurrencyState] = useState<string>('USD');
    const [isLoading, setIsLoading] = useState(true);
    const [isAutoDetected, setIsAutoDetected] = useState(true);

    // Initial detection
    useEffect(() => {
        const detect = async () => {
            setIsLoading(true);
            
            // First, use sync method for immediate display
            const quickCurrency = CurrencyService.getUserCurrency();
            setCurrencyState(quickCurrency);
            
            // Check if user has manual preference
            const pref = CurrencyService.getUserPreference();
            setIsAutoDetected(!pref);

            // Then do full async detection if no manual preference
            if (!pref) {
                try {
                    const detected = await CurrencyService.autoDetectCurrency();
                    setCurrencyState(detected);
                } catch (e) {
                    // Keep the quick detection result
                }
            }
            
            setIsLoading(false);
        };

        detect();
    }, []);

    const setCurrency = useCallback((code: string) => {
        if (SUPPORTED_CURRENCIES[code]) {
            CurrencyService.setUserPreference(code);
            setCurrencyState(code);
            setIsAutoDetected(false);
        }
    }, []);

    const resetToAuto = useCallback(async () => {
        CurrencyService.clearUserPreference();
        setIsLoading(true);
        setIsAutoDetected(true);
        
        const detected = await CurrencyService.autoDetectCurrency();
        setCurrencyState(detected);
        setIsLoading(false);
    }, []);

    const convert = useCallback((amountUSD: number) => {
        return CurrencyService.convert(amountUSD, currency);
    }, [currency]);

    const format = useCallback((amountUSD: number, showApprox = true) => {
        return CurrencyService.format(amountUSD, currency, showApprox);
    }, [currency]);

    const value: CurrencyContextType = {
        currency,
        currencyInfo: SUPPORTED_CURRENCIES[currency] || SUPPORTED_CURRENCIES.USD,
        isLoading,
        isAutoDetected,
        setCurrency,
        resetToAuto,
        convert,
        format,
        supportedCurrencies: CurrencyService.getSupportedList(),
    };

    return (
        <CurrencyContext.Provider value={value}>
            {children}
        </CurrencyContext.Provider>
    );
};

export const useCurrency = (): CurrencyContextType => {
    const context = useContext(CurrencyContext);
    if (!context) {
        throw new Error('useCurrency must be used within a CurrencyProvider');
    }
    return context;
};

export default CurrencyContext;
