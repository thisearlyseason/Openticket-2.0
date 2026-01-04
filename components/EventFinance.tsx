
import React, { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { DollarSign, TrendingUp, TrendingDown, Users, Receipt, RefreshCw, Download, ArrowLeft, CreditCard, AlertCircle, CheckCircle, Clock, Ban, Loader2 } from 'lucide-react';
import { Card, Button, Badge } from './UI';
import { StorageService, PLANS } from '../services/storageService';
import { Event, Registration } from '../types';
import { useGlobalUI } from './GlobalUIProvider';
import { getAuthToken } from '../services/firebaseConfig';

interface FinancialSummary {
    grossSales: number;
    platformFees: number;
    stripeFees: number;
    taxCollected: number;
    netEarnings: number;
    refundedAmount: number;
    transactionCount: number;
    refundCount: number;
}

interface FinancialTransaction {
    id: string;
    registration_id: string;
    gross_amount: number;
    platform_fee: number;
    stripe_fee: number;
    tax_amount: number;
    organizer_net: number;
    status: string;
    transaction_type: string;
    created_at: string;
    payout_status: string;
    registration?: {
        attendee_name: string;
        attendee_email: string;
    };
}

export const EventFinance = () => {
    const { eventId } = useParams<{ eventId: string }>();
    const navigate = useNavigate();
    const { showToast } = useGlobalUI();

    const [event, setEvent] = useState<Event | null>(null);
    const [summary, setSummary] = useState<FinancialSummary | null>(null);
    const [transactions, setTransactions] = useState<FinancialTransaction[]>([]);
    const [registrations, setRegistrations] = useState<Registration[]>([]);
    const [isLoading, setIsLoading] = useState(true);
    const [isRefreshing, setIsRefreshing] = useState(false);

    const user = StorageService.getCurrentUser();

    const loadFinancials = async () => {
        if (!eventId) {
            setIsLoading(false);
            return;
        }
        
        // Check if user is authenticated
        if (!user) {
            console.warn('No authenticated user, redirecting to login');
            navigate('/auth');
            return;
        }

        try {
            // 1. Load Event
            const eventData = await StorageService.getEventById(eventId);
            if (!eventData) {
                showToast('Event not found', 'error');
                navigate('/dashboard');
                return;
            }
            setEvent(eventData);

            // 2. Try to load from backend API first
            try {
                const token = await getAuthToken();
                if (token) {
                    const response = await fetch(`/api/admin/events/${eventId}/financials`, {
                        headers: {
                            'Content-Type': 'application/json',
                            'Authorization': `Bearer ${token}`
                        }
                    });

                    if (response.ok) {
                        const data = await response.json();
                        setSummary(data.summary);
                        setTransactions(data.transactions || []);
                    } else {
                        // Fallback to registration-based calculation
                        console.warn('API returned error, using registration data');
                        await loadFromRegistrations(eventId);
                    }
                } else {
                    // No token available, use registration-based calculation
                    console.warn('No auth token, using registration data');
                    await loadFromRegistrations(eventId);
                }
            } catch (apiError) {
                console.warn('API not available, using registration data:', apiError);
                await loadFromRegistrations(eventId);
            }

            // 3. Load registrations for additional context
            const regs = await StorageService.getRegistrations(eventId);
            setRegistrations(regs);

        } catch (error) {
            console.error('Failed to load financials:', error);
            showToast('Failed to load financial data', 'error');
        } finally {
            setIsLoading(false);
            setIsRefreshing(false);
        }
    };

    const loadFromRegistrations = async (eventId: string) => {
        const regs = await StorageService.getRegistrations(eventId);
        const event = await StorageService.getEventById(eventId);

        // Calculate from registrations
        const planKey = (user?.subscription?.plan || 'free') as keyof typeof PLANS;
        const plan = PLANS[planKey];

        let grossSales = 0;
        let platformFees = 0;
        let refundedAmount = 0;
        let taxCollected = 0;
        let transactionCount = 0;
        let refundCount = 0;

        const mockTransactions: FinancialTransaction[] = [];

        regs.forEach(reg => {
            // Consider paid if status is paid/completed OR has stripe payment intent
            const isPaid = reg.paymentStatus === 'paid' || reg.paymentStatus === 'completed' || !!(reg as any).stripePaymentIntentId;
            const isRefunded = reg.paymentStatus === 'refunded';

            if (isRefunded) {
                refundCount++;
                const refundAmt = reg.refundedAmount || reg.totalAmount || 0;
                refundedAmount += refundAmt;
                mockTransactions.push({
                    id: `refund-${reg.id}`,
                    registration_id: reg.id,
                    gross_amount: -refundAmt,
                    platform_fee: 0,
                    stripe_fee: 0,
                    tax_amount: 0,
                    organizer_net: -refundAmt,
                    status: 'refunded',
                    transaction_type: 'refund',
                    created_at: new Date(reg.timestamp).toISOString(),
                    payout_status: 'settled',
                    registration: { attendee_name: reg.attendeeName, attendee_email: reg.attendeeEmail }
                });
                return;
            }

            if (!isPaid) return;

            // Calculate gross
            const ticketTotal = reg.tickets?.reduce((sum, t) => sum + (t.pricePerTicket * t.quantity), 0) || 0;
            const addonTotal = reg.addOns?.reduce((sum, a) => sum + (a.price * a.quantity), 0) || 0;
            const donation = reg.donationAmount || 0;
            const tax = reg.taxAmount || 0;
            const customFees = reg.customFeesAmount || 0;
            const serviceFee = reg.serviceFee || 0;

            const gross = ticketTotal + addonTotal + donation + tax + customFees + serviceFee;

            grossSales += gross;
            platformFees += serviceFee;
            taxCollected += tax;
            transactionCount++;

            mockTransactions.push({
                id: `tx-${reg.id}`,
                registration_id: reg.id,
                gross_amount: gross,
                platform_fee: serviceFee,
                stripe_fee: Number((gross * 0.029 + 0.30).toFixed(2)),
                tax_amount: tax,
                organizer_net: gross - serviceFee - Number((gross * 0.029 + 0.30).toFixed(2)),
                status: 'succeeded',
                transaction_type: 'ticket_sale',
                created_at: new Date(reg.timestamp).toISOString(),
                payout_status: 'pending',
                registration: { attendee_name: reg.attendeeName, attendee_email: reg.attendeeEmail }
            });
        });

        // Estimate stripe fees (2.9% + $0.30 per transaction)
        const estimatedStripeFees = transactionCount > 0 
            ? Number((grossSales * 0.029 + (transactionCount * 0.30)).toFixed(2))
            : 0;

        setSummary({
            grossSales,
            platformFees,
            stripeFees: estimatedStripeFees,
            taxCollected,
            netEarnings: grossSales - platformFees - estimatedStripeFees,
            refundedAmount,
            transactionCount,
            refundCount,
        });

        setTransactions(mockTransactions.sort((a, b) => 
            new Date(b.created_at).getTime() - new Date(a.created_at).getTime()
        ));
    };

    useEffect(() => {
        loadFinancials();
    }, [eventId]);

    const handleRefresh = () => {
        setIsRefreshing(true);
        loadFinancials();
    };

    const exportFinancials = () => {
        if (!event || !summary) return;

        const headers = ['Date', 'Transaction ID', 'Attendee', 'Email', 'Type', 'Gross', 'Platform Fee', 'Stripe Fee', 'Net', 'Status', 'Payout Status'];
        const rows = transactions.map(tx => [
            new Date(tx.created_at).toLocaleDateString(),
            tx.id,
            tx.registration?.attendee_name || 'N/A',
            tx.registration?.attendee_email || 'N/A',
            tx.transaction_type,
            tx.gross_amount.toFixed(2),
            tx.platform_fee.toFixed(2),
            tx.stripe_fee.toFixed(2),
            tx.organizer_net.toFixed(2),
            tx.status,
            tx.payout_status
        ]);

        // Add summary row
        rows.push([]);
        rows.push(['SUMMARY']);
        rows.push(['Gross Sales', '', '', '', '', summary.grossSales.toFixed(2)]);
        rows.push(['Platform Fees', '', '', '', '', '', summary.platformFees.toFixed(2)]);
        rows.push(['Stripe Fees', '', '', '', '', '', '', summary.stripeFees.toFixed(2)]);
        rows.push(['Net Earnings', '', '', '', '', '', '', '', summary.netEarnings.toFixed(2)]);
        rows.push(['Refunded', '', '', '', '', summary.refundedAmount.toFixed(2)]);

        const csvContent = "data:text/csv;charset=utf-8," + [headers, ...rows].map(r => r.join(",")).join("\n");
        const link = document.createElement("a");
        link.setAttribute("href", encodeURI(csvContent));
        link.setAttribute("download", `${event.title}_financials_${new Date().toISOString().split('T')[0]}.csv`);
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
    };

    if (isLoading) {
        return (
            <div className="flex items-center justify-center min-h-[60vh]">
                <Loader2 className="animate-spin text-primary" size={48} />
            </div>
        );
    }

    if (!event || !summary) {
        return (
            <div className="p-8 text-center">
                <AlertCircle className="mx-auto mb-4 text-red-500" size={48} />
                <h2 className="text-2xl font-bold">Event Not Found</h2>
                <Button onClick={() => navigate('/dashboard')} className="mt-4">Back to Dashboard</Button>
            </div>
        );
    }

    const paidRegistrations = registrations.filter(r => r.paymentStatus === 'paid' || r.paymentStatus === 'completed').length;
    const pendingRegistrations = registrations.filter(r => r.paymentStatus === 'pending').length;

    return (
        <div className="max-w-6xl mx-auto py-8 px-4 space-y-8">
            {/* Header */}
            <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
                <div>
                    <button 
                        onClick={() => navigate(-1)} 
                        className="text-zinc-500 hover:text-zinc-900 dark:hover:text-white flex items-center gap-1 text-sm mb-2"
                    >
                        <ArrowLeft size={16} /> Back
                    </button>
                    <h1 className="text-3xl font-black text-gray-900 dark:text-white font-display uppercase tracking-tight">
                        Event Financials
                    </h1>
                    <p className="text-zinc-500">{event.title}</p>
                </div>
                <div className="flex gap-2">
                    <Button variant="outline" size="sm" onClick={handleRefresh} disabled={isRefreshing}>
                        <RefreshCw size={16} className={`mr-2 ${isRefreshing ? 'animate-spin' : ''}`} /> 
                        Refresh
                    </Button>
                    <Button variant="outline" size="sm" onClick={exportFinancials}>
                        <Download size={16} className="mr-2" /> Export
                    </Button>
                </div>
            </div>

            {/* Summary Cards */}
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                <Card className="p-6">
                    <div className="flex items-center gap-3 mb-2">
                        <div className="w-10 h-10 bg-green-100 dark:bg-green-900/30 rounded-xl flex items-center justify-center">
                            <TrendingUp className="text-green-600" size={20} />
                        </div>
                        <span className="text-sm text-zinc-500">Gross Sales</span>
                    </div>
                    <div className="text-3xl font-black text-gray-900 dark:text-white">
                        ${summary.grossSales.toFixed(2)}
                    </div>
                    <div className="text-xs text-zinc-500 mt-1">
                        {summary.transactionCount} transaction{summary.transactionCount !== 1 ? 's' : ''}
                    </div>
                </Card>

                <Card className="p-6">
                    <div className="flex items-center gap-3 mb-2">
                        <div className="w-10 h-10 bg-yellow-100 dark:bg-yellow-900/30 rounded-xl flex items-center justify-center">
                            <CreditCard className="text-yellow-600" size={20} />
                        </div>
                        <span className="text-sm text-zinc-500">Total Fees</span>
                    </div>
                    <div className="text-3xl font-black text-gray-900 dark:text-white">
                        ${(summary.platformFees + summary.stripeFees).toFixed(2)}
                    </div>
                    <div className="text-xs text-zinc-500 mt-1">
                        Platform: ${summary.platformFees.toFixed(2)} | Stripe: ${summary.stripeFees.toFixed(2)}
                    </div>
                </Card>

                <Card className="p-6">
                    <div className="flex items-center gap-3 mb-2">
                        <div className="w-10 h-10 bg-blue-100 dark:bg-blue-900/30 rounded-xl flex items-center justify-center">
                            <DollarSign className="text-blue-600" size={20} />
                        </div>
                        <span className="text-sm text-zinc-500">Net Earnings</span>
                    </div>
                    <div className="text-3xl font-black text-green-600">
                        ${summary.netEarnings.toFixed(2)}
                    </div>
                    <div className="text-xs text-zinc-500 mt-1">
                        After all fees
                    </div>
                </Card>

                <Card className="p-6">
                    <div className="flex items-center gap-3 mb-2">
                        <div className="w-10 h-10 bg-red-100 dark:bg-red-900/30 rounded-xl flex items-center justify-center">
                            <TrendingDown className="text-red-600" size={20} />
                        </div>
                        <span className="text-sm text-zinc-500">Refunded</span>
                    </div>
                    <div className="text-3xl font-black text-red-600">
                        ${summary.refundedAmount.toFixed(2)}
                    </div>
                    <div className="text-xs text-zinc-500 mt-1">
                        {summary.refundCount} refund{summary.refundCount !== 1 ? 's' : ''}
                    </div>
                </Card>
            </div>

            {/* Registration Stats */}
            <div className="grid grid-cols-3 gap-4">
                <Card className="p-4 flex items-center gap-3">
                    <CheckCircle className="text-green-500" size={24} />
                    <div>
                        <div className="text-2xl font-bold">{paidRegistrations}</div>
                        <div className="text-xs text-zinc-500">Paid</div>
                    </div>
                </Card>
                <Card className="p-4 flex items-center gap-3">
                    <Clock className="text-yellow-500" size={24} />
                    <div>
                        <div className="text-2xl font-bold">{pendingRegistrations}</div>
                        <div className="text-xs text-zinc-500">Pending</div>
                    </div>
                </Card>
                <Card className="p-4 flex items-center gap-3">
                    <Ban className="text-red-500" size={24} />
                    <div>
                        <div className="text-2xl font-bold">{summary.refundCount}</div>
                        <div className="text-xs text-zinc-500">Refunded</div>
                    </div>
                </Card>
            </div>

            {/* Tax Collected */}
            {summary.taxCollected > 0 && (
                <Card className="p-4 bg-blue-50 dark:bg-blue-900/20 border-blue-200 dark:border-blue-800">
                    <div className="flex items-center justify-between">
                        <div className="flex items-center gap-2">
                            <Receipt className="text-blue-600" size={20} />
                            <span className="font-medium">Tax Collected</span>
                        </div>
                        <span className="text-xl font-bold">${summary.taxCollected.toFixed(2)}</span>
                    </div>
                    <p className="text-xs text-zinc-500 mt-1">
                        Note: Tax is collected on behalf of the organizer and should be remitted to the appropriate tax authority.
                    </p>
                </Card>
            )}

            {/* Transaction History */}
            <div className="space-y-4">
                <h2 className="text-xl font-bold text-gray-900 dark:text-white flex items-center gap-2">
                    <Receipt className="text-primary" /> Transaction History
                </h2>

                <div className="bg-white dark:bg-black border border-zinc-200 dark:border-zinc-800 rounded-xl overflow-hidden">
                    <div className="overflow-x-auto">
                        <table className="w-full text-left text-sm">
                            <thead className="bg-zinc-100 dark:bg-zinc-900 border-b border-zinc-200 dark:border-zinc-800 text-zinc-500 uppercase font-bold text-xs">
                                <tr>
                                    <th className="p-4">Date</th>
                                    <th className="p-4">Attendee</th>
                                    <th className="p-4">Type</th>
                                    <th className="p-4 text-right">Gross</th>
                                    <th className="p-4 text-right">Fees</th>
                                    <th className="p-4 text-right">Net</th>
                                    <th className="p-4 text-center">Status</th>
                                    <th className="p-4 text-center">Payout</th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-zinc-200 dark:divide-zinc-800">
                                {transactions.length === 0 ? (
                                    <tr>
                                        <td colSpan={8} className="p-8 text-center text-zinc-500">
                                            No transactions yet.
                                        </td>
                                    </tr>
                                ) : (
                                    transactions.map((tx) => {
                                        const isRefund = tx.gross_amount < 0;
                                        const totalFees = tx.platform_fee + tx.stripe_fee;

                                        return (
                                            <tr key={tx.id} className="hover:bg-zinc-50 dark:hover:bg-zinc-900/50 transition-colors">
                                                <td className="p-4 text-zinc-500">
                                                    {new Date(tx.created_at).toLocaleDateString()}
                                                </td>
                                                <td className="p-4">
                                                    <div className="font-medium text-gray-900 dark:text-white">
                                                        {tx.registration?.attendee_name || 'N/A'}
                                                    </div>
                                                    <div className="text-xs text-zinc-500">
                                                        {tx.registration?.attendee_email || ''}
                                                    </div>
                                                </td>
                                                <td className="p-4">
                                                    <Badge color={isRefund ? 'red' : 'blue'}>
                                                        {tx.transaction_type === 'refund' ? 'Refund' : 'Sale'}
                                                    </Badge>
                                                </td>
                                                <td className={`p-4 text-right font-mono ${isRefund ? 'text-red-500' : ''}`}>
                                                    {isRefund ? '-' : ''}${Math.abs(tx.gross_amount).toFixed(2)}
                                                </td>
                                                <td className="p-4 text-right font-mono text-zinc-500">
                                                    {isRefund ? '-' : `-$${totalFees.toFixed(2)}`}
                                                </td>
                                                <td className={`p-4 text-right font-mono font-bold ${isRefund ? 'text-red-500' : 'text-green-600 dark:text-green-400'}`}>
                                                    {isRefund ? '-' : ''}${Math.abs(tx.organizer_net).toFixed(2)}
                                                </td>
                                                <td className="p-4 text-center">
                                                    <Badge color={
                                                        tx.status === 'succeeded' ? 'green' :
                                                        tx.status === 'refunded' ? 'red' :
                                                        'yellow'
                                                    }>
                                                        {tx.status}
                                                    </Badge>
                                                </td>
                                                <td className="p-4 text-center">
                                                    <Badge color={
                                                        tx.payout_status === 'paid' ? 'green' :
                                                        tx.payout_status === 'pending' ? 'yellow' :
                                                        'gray'
                                                    }>
                                                        {tx.payout_status}
                                                    </Badge>
                                                </td>
                                            </tr>
                                        );
                                    })
                                )}
                            </tbody>
                        </table>
                    </div>
                </div>
            </div>
        </div>
    );
};

export default EventFinance;
