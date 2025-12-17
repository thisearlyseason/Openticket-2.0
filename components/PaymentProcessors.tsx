

import React, { useState, useEffect } from 'react';
import { CreditCard, Lock, CheckCircle2, Loader2, AlertCircle } from 'lucide-react';
import { Button, Input } from './UI';

interface PaymentProps {
    amount: number;
    onComplete: () => void;
    onError: (msg: string) => void;
    providerConfig: any;
}

// --- OPENTICKET SECURE CHECKOUT ---
export const OpenTicketCheckout = ({ amount, onComplete, onError }: PaymentProps) => {
    const [isProcessing, setIsProcessing] = useState(false);
    const [cardData, setCardData] = useState({ number: '', expiry: '', cvc: '', zip: '' });

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        setIsProcessing(true);
        
        // Simulation of Platform Payment Processing
        setTimeout(() => {
            if (cardData.number.length < 14) {
                setIsProcessing(false);
                onError("Invalid card number.");
                return;
            }
            // Success
            onComplete();
        }, 2000);
    };

    return (
        <form onSubmit={handleSubmit} className="animate-in fade-in">
            <div className="mb-6">
                <div className="flex justify-between items-center mb-4">
                    <h3 className="font-semibold text-gray-900 dark:text-white flex items-center gap-2">
                        <CreditCard size={20} className="text-primary"/> Pay with Card
                    </h3>
                    <div className="flex gap-2">
                        <span className="text-xs bg-gray-100 text-gray-600 px-2 py-1 rounded font-mono border border-gray-200">SECURE CHECKOUT</span>
                    </div>
                </div>
                
                {/* Unified Card Element */}
                <div className="border border-zinc-300 dark:border-zinc-700 rounded-xl overflow-hidden shadow-sm focus-within:ring-2 focus-within:ring-primary focus-within:border-primary transition-all bg-white dark:bg-black">
                    <div className="p-3 border-b border-zinc-200 dark:border-zinc-800">
                        <label className="text-xs font-semibold text-zinc-500 uppercase block mb-1">Card Number</label>
                        <div className="relative">
                            <CreditCard className="absolute left-0 top-1/2 -translate-y-1/2 text-zinc-400" size={16} />
                            <input 
                                type="text" 
                                placeholder="0000 0000 0000 0000" 
                                className="w-full pl-6 outline-none text-zinc-900 dark:text-white placeholder-zinc-300 bg-transparent font-mono"
                                value={cardData.number}
                                onChange={e => setCardData({...cardData, number: e.target.value})}
                                required
                            />
                        </div>
                    </div>
                    <div className="flex divide-x divide-zinc-200 dark:divide-zinc-800">
                        <div className="w-1/2 p-3">
                            <label className="text-xs font-semibold text-zinc-500 uppercase block mb-1">Expiration</label>
                            <input 
                                type="text" 
                                placeholder="MM / YY" 
                                className="w-full outline-none text-zinc-900 dark:text-white placeholder-zinc-300 bg-transparent font-mono"
                                value={cardData.expiry}
                                onChange={e => setCardData({...cardData, expiry: e.target.value})}
                                required
                            />
                        </div>
                        <div className="w-1/2 p-3">
                            <label className="text-xs font-semibold text-zinc-500 uppercase block mb-1">CVC</label>
                            <div className="relative">
                                <Lock className="absolute left-0 top-1/2 -translate-y-1/2 text-zinc-400" size={12} />
                                <input 
                                    type="text" 
                                    placeholder="123" 
                                    className="w-full pl-4 outline-none text-zinc-900 dark:text-white placeholder-zinc-300 bg-transparent font-mono"
                                    value={cardData.cvc}
                                    onChange={e => setCardData({...cardData, cvc: e.target.value})}
                                    required
                                />
                            </div>
                        </div>
                    </div>
                </div>
                <div className="mt-3">
                     <label className="text-xs font-semibold text-zinc-500 uppercase block mb-1">Billing ZIP Code</label>
                     <input 
                        type="text" 
                        placeholder="12345" 
                        className="w-full p-3 border border-zinc-300 dark:border-zinc-700 rounded-xl outline-none focus:border-primary bg-white dark:bg-black text-zinc-900 dark:text-white"
                        value={cardData.zip}
                        onChange={e => setCardData({...cardData, zip: e.target.value})}
                        required
                    />
                </div>
            </div>

            <Button 
                type="submit" 
                className="w-full py-4 text-lg font-bold shadow-[0_0_20px_rgba(236,72,153,0.3)]"
                isLoading={isProcessing}
            >
                {isProcessing ? 'Processing...' : `Pay $${amount.toFixed(2)}`}
            </Button>
            
            <div className="flex items-center justify-center gap-2 mt-4 text-xs text-zinc-500">
                <Lock size={12}/> Payments processed securely by OpenTicket
            </div>
        </form>
    );
};
