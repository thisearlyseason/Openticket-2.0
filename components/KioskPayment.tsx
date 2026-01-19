import React, { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { kioskService } from '../services/kioskService';
import { Button, Card, Input } from './UI';
import { DollarSign, CreditCard, Banknote, Loader2, ArrowLeft, CheckCircle2 } from 'lucide-react';

export const KioskPayment: React.FC = () => {
    const { eventId, regId } = useParams<{ eventId: string; regId?: string }>();
    const navigate = useNavigate();

    const [paymentMethod, setPaymentMethod] = useState<'cash' | 'card' | null>(null);
    const [amount, setAmount] = useState<string>('');
    const [isProcessing, setIsProcessing] = useState(false);
    const [registrationId, setRegistrationId] = useState(regId || '');

    const handlePayment = async () => {
        if (!paymentMethod || !registrationId) return;

        setIsProcessing(true);
        try {
            const result = await kioskService.processPayment(
                registrationId,
                paymentMethod,
                amount ? parseFloat(amount) : undefined
            );

            if (result.requiresPayment && result.paymentUrl) {
                // Redirect to Stripe payment
                window.location.href = result.paymentUrl;
            } else if (result.success) {
                // Cash payment success
                navigate(`/kiosk/${eventId}/success?type=payment`);
            }
        } catch (error: any) {
            alert(error.message || 'Payment failed');
        } finally {
            setIsProcessing(false);
        }
    };

    return (
        <div className="min-h-screen bg-zinc-950 text-white">
            {/* Header */}
            <div className="bg-zinc-900 border-b border-zinc-800 px-6 py-4">
                <div className="max-w-7xl mx-auto flex items-center justify-between">
                    <Button
                        variant="ghost"
                        onClick={() => navigate(`/kiosk/${eventId}/checkin`)}
                        className="flex items-center gap-2"
                    >
                        <ArrowLeft size={20} />
                        Back
                    </Button>
                    <h1 className="text-2xl font-bold">Door Payment</h1>
                    <div className="w-20" />
                </div>
            </div>

            <div className="max-w-2xl mx-auto p-6 py-12">
                {!paymentMethod ? (
                    <>
                        <h2 className="text-2xl font-bold mb-8 text-center">Select Payment Method</h2>
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                            {/* Stripe Payment Link */}
                            <button
                                onClick={() => setPaymentMethod('card')}
                                className="group relative overflow-hidden rounded-2xl bg-gradient-to-br from-blue-600 to-blue-700 p-8 text-left hover:scale-105 transition-transform duration-200 shadow-2xl"
                            >
                                <div className="relative z-10">
                                    <div className="bg-white/20 rounded-full w-16 h-16 flex items-center justify-center mb-4">
                                        <CreditCard size={32} className="text-white" />
                                    </div>
                                    <h3 className="text-2xl font-bold mb-2 text-white">Card Payment</h3>
                                    <p className="text-white/80 text-sm">Pay with credit/debit card</p>
                                </div>
                                <div className="absolute inset-0 bg-gradient-to-tr from-white/0 to-white/10 group-hover:to-white/20 transition-colors" />
                            </button>

                            {/* Cash Payment */}
                            <button
                                onClick={() => setPaymentMethod('cash')}
                                className="group relative overflow-hidden rounded-2xl bg-gradient-to-br from-green-600 to-green-700 p-8 text-left hover:scale-105 transition-transform duration-200 shadow-2xl"
                            >
                                <div className="relative z-10">
                                    <div className="bg-white/20 rounded-full w-16 h-16 flex items-center justify-center mb-4">
                                        <Banknote size={32} className="text-white" />
                                    </div>
                                    <h3 className="text-2xl font-bold mb-2 text-white">Cash Payment</h3>
                                    <p className="text-white/80 text-sm">Accept cash at door</p>
                                </div>
                                <div className="absolute inset-0 bg-gradient-to-tr from-white/0 to-white/10 group-hover:to-white/20 transition-colors" />
                            </button>
                        </div>
                    </>
                ) : (
                    <Card className="p-8 bg-zinc-900 border-zinc-800">
                        <div className="text-center mb-8">
                            <div className="bg-primary/20 rounded-full w-20 h-20 flex items-center justify-center mx-auto mb-4">
                                {paymentMethod === 'cash' ? (
                                    <Banknote size={40} className="text-primary" />
                                ) : (
                                    <CreditCard size={40} className="text-primary" />
                                )}
                            </div>
                            <h2 className="text-2xl font-bold mb-2">
                                {paymentMethod === 'cash' ? 'Cash Payment' : 'Card Payment'}
                            </h2>
                            <p className="text-zinc-400">Enter payment details</p>
                        </div>

                        <div className="space-y-6">
                            {!regId && (
                                <div>
                                    <label className="block text-sm font-bold text-zinc-300 mb-2">Registration ID</label>
                                    <Input
                                        type="text"
                                        value={registrationId}
                                        onChange={(e) => setRegistrationId(e.target.value)}
                                        placeholder="Enter registration ID"
                                        className="text-lg py-6"
                                    />
                                </div>
                            )}

                            {paymentMethod === 'cash' && (
                                <div>
                                    <label className="block text-sm font-bold text-zinc-300 mb-2">Amount (optional)</label>
                                    <Input
                                        type="number"
                                        value={amount}
                                        onChange={(e) => setAmount(e.target.value)}
                                        placeholder="Leave empty for ticket price"
                                        className="text-lg py-6"
                                        step="0.01"
                                    />
                                </div>
                            )}

                            <div className="flex gap-4">
                                <Button
                                    variant="secondary"
                                    onClick={() => setPaymentMethod(null)}
                                    disabled={isProcessing}
                                    size="lg"
                                    className="flex-1"
                                >
                                    Back
                                </Button>
                                <Button
                                    onClick={handlePayment}
                                    disabled={isProcessing || !registrationId}
                                    size="lg"
                                    className="flex-1"
                                >
                                    {isProcessing ? (
                                        <Loader2 className="animate-spin mr-2" size={20} />
                                    ) : (
                                        <CheckCircle2 size={20} className="mr-2" />
                                    )}
                                    Process Payment
                                </Button>
                            </div>
                        </div>
                    </Card>
                )}
            </div>
        </div>
    );
};