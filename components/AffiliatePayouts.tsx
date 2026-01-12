import React, { useState, useEffect } from 'react';
import { Card, Button, Badge, Input } from './UI';
import { Calendar, Clock, DollarSign, TrendingUp, Download, CheckCircle2, AlertCircle, Loader2, CreditCard, Banknote } from 'lucide-react';
import { useGlobalUI } from './GlobalUIProvider';
import { getAuthToken } from '../services/firebaseConfig';

interface AffiliatePayout {
    id: string;
    amount: number;
    status: 'pending' | 'scheduled' | 'paid' | 'failed';
    requestedAt: string;
    scheduledFor?: string;
    paidAt?: string;
    method: 'manual' | 'scheduled';
}

export const AffiliatePayouts: React.FC = () => {
    const [payouts, setPayouts] = useState<AffiliatePayout[]>([]);
    const [earnings, setEarnings] = useState({
        total: 0,
        pending: 0,
        paid: 0,
        available: 0
    });
    const [isLoading, setIsLoading] = useState(true);
    const [isRequesting, setIsRequesting] = useState(false);
    const [payoutMethod, setPayoutMethod] = useState<'manual' | 'scheduled'>('scheduled');
    const { showToast } = useGlobalUI();

    useEffect(() => {
        loadAffiliateData();
    }, []);

    const loadAffiliateData = async () => {
        setIsLoading(true);
        try {
            const token = await getAuthToken();
            
            // Load earnings summary
            const earningsRes = await fetch('/api/admin/affiliate/earnings', {
                headers: { 'Authorization': `Bearer ${token}` }
            });
            if (earningsRes.ok) {
                const data = await earningsRes.json();
                setEarnings(data);
            }

            // Load payout history
            const payoutsRes = await fetch('/api/admin/affiliate/payouts', {
                headers: { 'Authorization': `Bearer ${token}` }
            });
            if (payoutsRes.ok) {
                const data = await payoutsRes.json();
                setPayouts(data.payouts || []);
            }
        } catch (error) {
            console.error('Failed to load affiliate data:', error);
            showToast('Failed to load payout information', 'error');
        } finally {
            setIsLoading(false);
        }
    };

    const requestPayout = async (method: 'manual' | 'scheduled') => {
        if (earnings.available <= 0) {
            showToast('No funds available for payout', 'error');
            return;
        }

        setIsRequesting(true);
        try {
            const token = await getAuthToken();
            const response = await fetch('/api/admin/affiliate/request-payout', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${token}`
                },
                body: JSON.stringify({ method })
            });

            const data = await response.json();

            if (response.ok) {
                if (method === 'manual') {
                    showToast(`Payout request submitted! Amount: $${data.amount.toFixed(2)}`, 'success');
                } else {
                    const scheduledDate = new Date(data.scheduledFor);
                    showToast(`Payout scheduled for ${scheduledDate.toLocaleDateString()}`, 'success');
                }
                await loadAffiliateData();
            } else {
                showToast(data.error || 'Failed to request payout', 'error');
            }
        } catch (error) {
            console.error('Error requesting payout:', error);
            showToast('Failed to request payout', 'error');
        } finally {
            setIsRequesting(false);
        }
    };

    if (isLoading) {
        return (
            <Card className="p-8">
                <div className="flex items-center justify-center">
                    <Loader2 className="animate-spin text-primary" size={32} />
                </div>
            </Card>
        );
    }

    const nextScheduledPayout = getLastDayOfMonth();

    return (
        <div className="space-y-6">
            {/* Earnings Summary */}
            <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
                <Card className="p-6">
                    <div className="flex items-center justify-between mb-2">
                        <span className="text-sm text-zinc-500">Total Earned</span>
                        <TrendingUp size={16} className="text-blue-600" />
                    </div>
                    <div className="text-2xl font-bold">${earnings.total.toFixed(2)}</div>
                </Card>

                <Card className="p-6">
                    <div className="flex items-center justify-between mb-2">
                        <span className="text-sm text-zinc-500">Available</span>
                        <DollarSign size={16} className="text-green-600" />
                    </div>
                    <div className="text-2xl font-bold text-green-600">${earnings.available.toFixed(2)}</div>
                </Card>

                <Card className="p-6">
                    <div className="flex items-center justify-between mb-2">
                        <span className="text-sm text-zinc-500">Pending</span>
                        <Clock size={16} className="text-orange-600" />
                    </div>
                    <div className="text-2xl font-bold text-orange-600">${earnings.pending.toFixed(2)}</div>
                </Card>

                <Card className="p-6">
                    <div className="flex items-center justify-between mb-2">
                        <span className="text-sm text-zinc-500">Paid Out</span>
                        <CheckCircle2 size={16} className="text-gray-600" />
                    </div>
                    <div className="text-2xl font-bold">${earnings.paid.toFixed(2)}</div>
                </Card>
            </div>

            {/* Payout Request Card */}
            <Card className="p-6 border-2 border-primary/20">
                <h3 className="text-xl font-bold mb-4">💰 Request Commission Payout</h3>
                
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-6">
                    {/* Manual Payout Option */}
                    <div 
                        onClick={() => setPayoutMethod('manual')}
                        className={`p-6 border-2 rounded-lg cursor-pointer transition-all ${
                            payoutMethod === 'manual'
                                ? 'border-primary bg-primary/5'
                                : 'border-zinc-200 dark:border-zinc-800 hover:border-primary/50'
                        }`}
                    >
                        <div className="flex items-start gap-3 mb-3">
                            <CreditCard className={payoutMethod === 'manual' ? 'text-primary' : 'text-zinc-400'} size={24} />
                            <div className="flex-1">
                                <h4 className="font-bold text-lg mb-1">Manual Payout</h4>
                                <p className="text-sm text-zinc-500">
                                    Request immediate payout for approval
                                </p>
                            </div>
                        </div>
                        <div className="flex items-center gap-2">
                            <CheckCircle2 size={16} className="text-green-600" />
                            <span className="text-sm font-medium text-green-700 dark:text-green-400">
                                Available now
                            </span>
                        </div>
                    </div>

                    {/* Scheduled Payout Option */}
                    <div 
                        onClick={() => setPayoutMethod('scheduled')}
                        className={`p-6 border-2 rounded-lg cursor-pointer transition-all ${
                            payoutMethod === 'scheduled'
                                ? 'border-primary bg-primary/5'
                                : 'border-zinc-200 dark:border-zinc-800 hover:border-primary/50'
                        }`}
                    >
                        <div className="flex items-start gap-3 mb-3">
                            <Calendar className={payoutMethod === 'scheduled' ? 'text-primary' : 'text-zinc-400'} size={24} />
                            <div className="flex-1">
                                <h4 className="font-bold text-lg mb-1">Scheduled Payout</h4>
                                <p className="text-sm text-zinc-500">
                                    Automatic payout on last day of month
                                </p>
                            </div>
                        </div>
                        <div className="flex items-center gap-2">
                            <Clock size={16} className="text-blue-600" />
                            <span className="text-sm font-medium text-blue-700 dark:text-blue-400">
                                Next: {nextScheduledPayout}
                            </span>
                        </div>
                    </div>
                </div>

                {/* Request Button */}
                <Button
                    onClick={() => requestPayout(payoutMethod)}
                    disabled={earnings.available <= 0 || isRequesting}
                    className="w-full h-12 text-lg"
                >
                    {isRequesting ? (
                        <>
                            <Loader2 className="animate-spin mr-2" size={20} />
                            Processing...
                        </>
                    ) : (
                        <>
                            <DollarSign size={20} className="mr-2" />
                            Request ${earnings.available.toFixed(2)} Payout
                            {payoutMethod === 'scheduled' && (
                                <span className="ml-2 text-sm opacity-75">
                                    (on {nextScheduledPayout})
                                </span>
                            )}
                        </>
                    )}
                </Button>

                {earnings.available <= 0 && (
                    <div className="mt-4 p-4 bg-orange-50 dark:bg-orange-900/10 border border-orange-200 dark:border-orange-800 rounded-lg">
                        <div className="flex items-start gap-3">
                            <AlertCircle className="text-orange-600 flex-shrink-0 mt-0.5" size={20} />
                            <p className="text-sm text-orange-700 dark:text-orange-300">
                                No funds available for payout. Commissions become available after a 30-day hold period.
                            </p>
                        </div>
                    </div>
                )}
            </Card>

            {/* Payout History */}
            <Card className="p-6">
                <h3 className="text-lg font-bold mb-4">Payout History</h3>
                
                {payouts.length === 0 ? (
                    <div className="text-center py-8 text-zinc-500">
                        <Banknote size={48} className="mx-auto mb-3 opacity-20" />
                        <p>No payout history yet</p>
                    </div>
                ) : (
                    <div className="space-y-3">
                        {payouts.map((payout) => (
                            <div 
                                key={payout.id}
                                className="flex items-center justify-between p-4 bg-zinc-50 dark:bg-zinc-900/50 rounded-lg border border-zinc-200 dark:border-zinc-800"
                            >
                                <div className="flex-1">
                                    <div className="flex items-center gap-2 mb-1">
                                        <span className="font-bold text-gray-900 dark:text-white">
                                            ${payout.amount.toFixed(2)}
                                        </span>
                                        <Badge 
                                            className={
                                                payout.status === 'paid' 
                                                    ? 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400'
                                                    : payout.status === 'scheduled'
                                                    ? 'bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400'
                                                    : 'bg-orange-100 text-orange-700 dark:bg-orange-900/30 dark:text-orange-400'
                                            }
                                        >
                                            {payout.status}
                                        </Badge>
                                        <Badge className="bg-zinc-100 text-zinc-600 dark:bg-zinc-800 dark:text-zinc-400">
                                            {payout.method}
                                        </Badge>
                                    </div>
                                    <div className="text-xs text-zinc-500">
                                        Requested: {new Date(payout.requestedAt).toLocaleDateString()}
                                        {payout.scheduledFor && payout.status === 'scheduled' && (
                                            <span className="ml-2">
                                                • Scheduled: {new Date(payout.scheduledFor).toLocaleDateString()}
                                            </span>
                                        )}
                                        {payout.paidAt && (
                                            <span className="ml-2 text-green-600 font-medium">
                                                • Paid: {new Date(payout.paidAt).toLocaleDateString()}
                                            </span>
                                        )}
                                    </div>
                                </div>
                            </div>
                        ))}
                    </div>
                )}
            </Card>
        </div>
    );
};

// Helper function to get last day of current month
function getLastDayOfMonth(): string {
    const now = new Date();
    const lastDay = new Date(now.getFullYear(), now.getMonth() + 1, 0);
    return lastDay.toLocaleDateString();
}
