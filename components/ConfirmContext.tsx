
import React, { createContext, useContext, useState, ReactNode } from 'react';
import { X } from 'lucide-react';

interface ConfirmOptions {
    title: string;
    message: string;
    confirmText?: string;
    cancelText?: string;
    variant?: 'danger' | 'warning' | 'info';
}

interface ConfirmContextValue {
    confirm: (options: ConfirmOptions) => Promise<boolean>;
}

const ConfirmContext = createContext<ConfirmContextValue | null>(null);

export const useConfirm = () => {
    const context = useContext(ConfirmContext);
    if (!context) {
        throw new Error('useConfirm must be used within ConfirmProvider');
    }
    return context;
};

export const ConfirmProvider: React.FC<{ children: ReactNode }> = ({ children }) => {
    const [isOpen, setIsOpen] = useState(false);
    const [options, setOptions] = useState<ConfirmOptions>({
        title: '',
        message: '',
        confirmText: 'Confirm',
        cancelText: 'Cancel',
        variant: 'danger'
    });
    const [resolver, setResolver] = useState<((value: boolean) => void) | null>(null);

    const confirm = (opts: ConfirmOptions): Promise<boolean> => {
        return new Promise((resolve) => {
            setOptions({ ...opts, confirmText: opts.confirmText || 'Confirm', cancelText: opts.cancelText || 'Cancel', variant: opts.variant || 'danger' });
            setIsOpen(true);
            setResolver(() => resolve);
        });
    };

    const handleConfirm = () => {
        if (resolver) {
            resolver(true);
        }
        setIsOpen(false);
        setResolver(null);
    };

    const handleCancel = () => {
        if (resolver) {
            resolver(false);
        }
        setIsOpen(false);
        setResolver(null);
    };

    const variantStyles = {
        danger: 'bg-red-500 hover:bg-red-600 text-white',
        warning: 'bg-amber-500 hover:bg-amber-600 text-black',
        info: 'bg-blue-500 hover:bg-blue-600 text-white'
    };

    return (
        <ConfirmContext.Provider value={{ confirm }}>
            {children}
            
            {/* Global Confirmation Modal */}
            {isOpen && (
                <div className="fixed inset-0 z-[99999] flex items-center justify-center p-4 bg-black/70 backdrop-blur-sm animate-in fade-in duration-200">
                    <div className="bg-white dark:bg-zinc-900 rounded-2xl shadow-2xl max-w-md w-full p-6 animate-in zoom-in-95 duration-200 border border-zinc-200 dark:border-zinc-700">
                        <div className="flex justify-between items-start mb-4">
                            <h3 className="text-xl font-bold text-zinc-900 dark:text-white">{options.title}</h3>
                            <button
                                onClick={handleCancel}
                                className="text-zinc-400 hover:text-zinc-600 dark:hover:text-zinc-300 transition-colors"
                                aria-label="Close"
                            >
                                <X size={24} />
                            </button>
                        </div>
                        <p className="text-zinc-600 dark:text-zinc-400 mb-6 whitespace-pre-wrap leading-relaxed">
                            {options.message}
                        </p>
                        <div className="flex gap-3 justify-end">
                            <button
                                onClick={handleCancel}
                                className="px-5 py-2.5 rounded-xl font-semibold text-zinc-600 dark:text-zinc-400 hover:bg-zinc-100 dark:hover:bg-zinc-800 transition-colors"
                            >
                                {options.cancelText}
                            </button>
                            <button
                                onClick={handleConfirm}
                                className={`px-5 py-2.5 rounded-xl font-bold transition-colors shadow-lg ${variantStyles[options.variant || 'danger']}`}
                            >
                                {options.confirmText}
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </ConfirmContext.Provider>
    );
};
