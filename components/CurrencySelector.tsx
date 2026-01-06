import React, { useState, useRef, useEffect } from 'react';
import { Globe, Check, ChevronDown, RotateCcw } from 'lucide-react';
import { CurrencyService, SUPPORTED_CURRENCIES, CurrencyInfo } from '../services/currencyService';

interface CurrencySelectorProps {
    compact?: boolean;
    className?: string;
}

export const CurrencySelector: React.FC<CurrencySelectorProps> = ({ compact = false, className = '' }) => {
    const [isOpen, setIsOpen] = useState(false);
    const [currency, setCurrency] = useState('USD');
    const [isAutoDetected, setIsAutoDetected] = useState(true);
    const dropdownRef = useRef<HTMLDivElement>(null);

    // Load current currency on mount
    useEffect(() => {
        const pref = CurrencyService.getUserPreference();
        if (pref && SUPPORTED_CURRENCIES[pref]) {
            setCurrency(pref);
            setIsAutoDetected(false);
        } else {
            // Use sync method for initial display
            const detected = CurrencyService.getUserCurrency();
            setCurrency(detected);
            setIsAutoDetected(true);
        }
    }, []);

    // Close dropdown on outside click
    useEffect(() => {
        const handleClickOutside = (event: MouseEvent) => {
            if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
                setIsOpen(false);
            }
        };
        document.addEventListener('mousedown', handleClickOutside);
        return () => document.removeEventListener('mousedown', handleClickOutside);
    }, []);

    const handleSelect = (code: string) => {
        CurrencyService.setUserPreference(code);
        setCurrency(code);
        setIsAutoDetected(false);
        setIsOpen(false);
        
        // Dispatch custom event to notify PriceDisplay components
        window.dispatchEvent(new Event('currencyChanged'));
    };

    const handleResetToAuto = async () => {
        CurrencyService.clearUserPreference();
        const detected = await CurrencyService.autoDetectCurrency();
        setCurrency(detected);
        setIsAutoDetected(true);
        setIsOpen(false);
        
        window.dispatchEvent(new Event('currencyChanged'));
    };

    const currentInfo = SUPPORTED_CURRENCIES[currency] || SUPPORTED_CURRENCIES.USD;
    const currencies = Object.values(SUPPORTED_CURRENCIES);

    if (compact) {
        return (
            <div className={`relative ${className}`} ref={dropdownRef}>
                <button
                    onClick={() => setIsOpen(!isOpen)}
                    className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg bg-zinc-100 dark:bg-zinc-800 hover:bg-zinc-200 dark:hover:bg-zinc-700 transition-colors text-sm font-medium text-zinc-700 dark:text-zinc-300"
                    title={`Currency: ${currentInfo.name}${isAutoDetected ? ' (auto-detected)' : ''}`}
                >
                    <span className="text-base">{currentInfo.symbol}</span>
                    <span className="hidden sm:inline">{currency}</span>
                    <ChevronDown size={14} className={`transition-transform ${isOpen ? 'rotate-180' : ''}`} />
                </button>

                {isOpen && (
                    <div className="absolute right-0 top-full mt-2 w-56 bg-white dark:bg-zinc-900 rounded-xl shadow-xl border border-zinc-200 dark:border-zinc-700 overflow-hidden z-50">
                        <div className="p-2 border-b border-zinc-100 dark:border-zinc-800">
                            <p className="text-[10px] uppercase font-bold text-zinc-400 px-2">Display Currency</p>
                        </div>
                        <div className="max-h-64 overflow-y-auto">
                            {currencies.map((info) => (
                                <button
                                    key={info.code}
                                    onClick={() => handleSelect(info.code)}
                                    className={`w-full flex items-center justify-between px-3 py-2.5 hover:bg-zinc-50 dark:hover:bg-zinc-800 transition-colors ${
                                        currency === info.code ? 'bg-zinc-50 dark:bg-zinc-800' : ''
                                    }`}
                                >
                                    <div className="flex items-center gap-3">
                                        <span className="text-lg w-6">{info.symbol}</span>
                                        <div className="text-left">
                                            <p className="text-sm font-medium text-zinc-900 dark:text-white">{info.code}</p>
                                            <p className="text-xs text-zinc-500">{info.name}</p>
                                        </div>
                                    </div>
                                    {currency === info.code && (
                                        <Check size={16} className="text-green-500" />
                                    )}
                                </button>
                            ))}
                        </div>
                        {!isAutoDetected && (
                            <div className="p-2 border-t border-zinc-100 dark:border-zinc-800">
                                <button
                                    onClick={handleResetToAuto}
                                    className="w-full flex items-center justify-center gap-2 px-3 py-2 text-xs font-medium text-zinc-500 hover:text-zinc-700 dark:hover:text-zinc-300 hover:bg-zinc-50 dark:hover:bg-zinc-800 rounded-lg transition-colors"
                                >
                                    <RotateCcw size={12} />
                                    Reset to auto-detect
                                </button>
                            </div>
                        )}
                        <div className="p-2 bg-zinc-50 dark:bg-zinc-800/50 border-t border-zinc-100 dark:border-zinc-800">
                            <p className="text-[10px] text-zinc-500 dark:text-zinc-400 text-center leading-relaxed font-medium">
                                You will be charged in USD.
                            </p>
                        </div>
                    </div>
                )}
            </div>
        );
    }

    // Full version for settings page
    return (
        <div className={`${className}`} ref={dropdownRef}>
            <label className="block text-sm font-bold text-zinc-700 dark:text-zinc-300 mb-2">
                <Globe size={14} className="inline mr-2" />
                Display Currency
            </label>
            <div className="relative">
                <button
                    onClick={() => setIsOpen(!isOpen)}
                    className="w-full flex items-center justify-between px-4 py-3 rounded-xl bg-white dark:bg-zinc-800 border border-zinc-200 dark:border-zinc-700 hover:border-zinc-300 dark:hover:border-zinc-600 transition-colors"
                >
                    <div className="flex items-center gap-3">
                        <span className="text-2xl">{currentInfo.symbol}</span>
                        <div className="text-left">
                            <p className="font-bold text-zinc-900 dark:text-white">{currentInfo.name}</p>
                            <p className="text-xs text-zinc-500">
                                {currency}
                                {isAutoDetected && <span className="ml-2 text-green-500">(auto-detected)</span>}
                            </p>
                        </div>
                    </div>
                    <ChevronDown size={20} className={`text-zinc-400 transition-transform ${isOpen ? 'rotate-180' : ''}`} />
                </button>

                {isOpen && (
                    <div className="absolute left-0 right-0 top-full mt-2 bg-white dark:bg-zinc-900 rounded-xl shadow-xl border border-zinc-200 dark:border-zinc-700 overflow-hidden z-50">
                        <div className="max-h-64 overflow-y-auto">
                            {currencies.map((info) => (
                                <button
                                    key={info.code}
                                    onClick={() => handleSelect(info.code)}
                                    className={`w-full flex items-center justify-between px-4 py-3 hover:bg-zinc-50 dark:hover:bg-zinc-800 transition-colors ${
                                        currency === info.code ? 'bg-zinc-50 dark:bg-zinc-800' : ''
                                    }`}
                                >
                                    <div className="flex items-center gap-3">
                                        <span className="text-xl w-8">{info.symbol}</span>
                                        <div className="text-left">
                                            <p className="font-medium text-zinc-900 dark:text-white">{info.name}</p>
                                            <p className="text-xs text-zinc-500">{info.code}</p>
                                        </div>
                                    </div>
                                    {currency === info.code && (
                                        <Check size={18} className="text-green-500" />
                                    )}
                                </button>
                            ))}
                        </div>
                        {!isAutoDetected && (
                            <div className="p-3 border-t border-zinc-100 dark:border-zinc-800">
                                <button
                                    onClick={handleResetToAuto}
                                    className="w-full flex items-center justify-center gap-2 px-4 py-2 text-sm font-medium text-zinc-500 hover:text-zinc-700 dark:hover:text-zinc-300 hover:bg-zinc-100 dark:hover:bg-zinc-800 rounded-lg transition-colors"
                                >
                                    <RotateCcw size={14} />
                                    Reset to auto-detect
                                </button>
                            </div>
                        )}
                    </div>
                )}
            </div>
            <p className="mt-2 text-xs text-zinc-500">
                Prices are shown in your selected currency for reference. All payments are processed in USD.
            </p>
        </div>
    );
};

export default CurrencySelector;
