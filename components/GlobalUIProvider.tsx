
import React, { createContext, useContext, useState, useEffect, ReactNode } from 'react';
import { X, Check, AlertTriangle, Info, Bell, Trash2 } from 'lucide-react';
import { Button } from './UI';

interface Toast {
    id: string;
    message: string;
    type: 'success' | 'error' | 'info';
}

interface ConfirmOptions {
    title: string;
    message: string;
    confirmText?: string;
    cancelText?: string;
    variant?: 'danger' | 'primary';
    onConfirm: () => void;
}

interface AlertOptions {
    title: string;
    message: string;
    onClose?: () => void;
}

interface GlobalUIContextType {
    showToast: (message: string, type?: 'success' | 'error' | 'info') => void;
    showConfirm: (options: ConfirmOptions) => void;
    showAlert: (options: AlertOptions) => void;
}

const GlobalUIContext = createContext<GlobalUIContextType | undefined>(undefined);

export const useGlobalUI = () => {
    const context = useContext(GlobalUIContext);
    if (!context) throw new Error("useGlobalUI must be used within GlobalUIProvider");
    return context;
};

export const GlobalUIProvider = ({ children }: { children: ReactNode }) => {
    const [toasts, setToasts] = useState<Toast[]>([]);
    const [confirmConfig, setConfirmConfig] = useState<ConfirmOptions | null>(null);
    const [alertConfig, setAlertConfig] = useState<AlertOptions | null>(null);

    const showToast = (message: string, type: 'success' | 'error' | 'info' = 'info') => {
        const id = Math.random().toString(36).substring(7);
        setToasts(prev => [...prev, { id, message, type }]);
        setTimeout(() => {
            setToasts(prev => prev.filter(t => t.id !== id));
        }, 3000);
    };

    const showConfirm = (options: ConfirmOptions) => {
        setConfirmConfig(options);
    };

    const showAlert = (options: AlertOptions) => {
        setAlertConfig(options);
    };

    return (
        <GlobalUIContext.Provider value={{ showToast, showConfirm, showAlert }}>
            {children}

            {/* Toasts Container */}
            <div className="fixed top-4 left-1/2 -translate-x-1/2 z-[100] flex flex-col gap-2 pointer-events-none">
                {toasts.map(t => (
                    <div key={t.id} className="pointer-events-auto bg-zinc-900/90 backdrop-blur-md text-white px-6 py-3 rounded-full shadow-2xl flex items-center gap-3 animate-in slide-in-from-top-4 fade-in border border-primary/20 shadow-primary/10">
                        {t.type === 'success' && <Check size={18} className="text-primary" />}
                        {t.type === 'error' && <AlertTriangle size={18} className="text-red-500" />}
                        {t.type === 'info' && <Info size={18} className="text-blue-400" />}
                        <span className="font-bold text-sm tracking-wide">{t.message}</span>
                    </div>
                ))}
            </div>

            {/* Confirm Modal */}
            {confirmConfig && (
                <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm animate-in fade-in">
                    <div className="bg-white dark:bg-zinc-900 w-full max-w-sm rounded-[2rem] p-8 shadow-2xl border border-zinc-200 dark:border-zinc-800 animate-in zoom-in-95">
                        <div className="text-center mb-6">
                            <div className={`w-16 h-16 rounded-full flex items-center justify-center mx-auto mb-4 ${confirmConfig.variant === 'danger' ? 'bg-red-100 text-red-500 dark:bg-red-900/30' : 'bg-zinc-100 text-zinc-900 dark:bg-zinc-800 dark:text-white'}`}>
                                {confirmConfig.variant === 'danger' ? <Trash2 size={32} /> : <AlertTriangle size={32} />}
                            </div>
                            <h3 className="text-xl font-black uppercase mb-2">{confirmConfig.title}</h3>
                            <p className="text-zinc-500 font-medium text-sm">{confirmConfig.message}</p>
                        </div>
                        <div className="flex gap-3">
                            <Button variant="outline" onClick={() => setConfirmConfig(null)} className="flex-1 rounded-xl">
                                {confirmConfig.cancelText || 'Cancel'}
                            </Button>
                            <Button
                                onClick={() => { confirmConfig.onConfirm(); setConfirmConfig(null); }}
                                className={`flex-1 rounded-xl border-none ${confirmConfig.variant === 'danger' ? 'bg-red-500 hover:bg-red-600 text-white' : ''}`}
                            >
                                {confirmConfig.confirmText || 'Confirm'}
                            </Button>
                        </div>
                    </div>
                </div>
            )}

            {/* Alert Modal */}
            {alertConfig && (
                <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm animate-in fade-in">
                    <div className="bg-white dark:bg-zinc-900 w-full max-w-sm rounded-[2rem] p-8 shadow-2xl border border-zinc-200 dark:border-zinc-800 animate-in zoom-in-95">
                        <div className="text-center mb-6">
                            <div className="w-16 h-16 rounded-full flex items-center justify-center mx-auto mb-4 bg-zinc-100 text-zinc-900 dark:bg-zinc-800 dark:text-white">
                                <Info size={32} />
                            </div>
                            <h3 className="text-xl font-black uppercase mb-2">{alertConfig.title}</h3>
                            <p className="text-zinc-500 font-medium text-sm">{alertConfig.message}</p>
                        </div>
                        <Button
                            onClick={() => { if (alertConfig.onClose) alertConfig.onClose(); setAlertConfig(null); }}
                            className="w-full rounded-xl"
                        >
                            Got it
                        </Button>
                    </div>
                </div>
            )}

        </GlobalUIContext.Provider>
    );
};
