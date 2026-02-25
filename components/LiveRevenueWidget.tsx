import React, { useMemo } from 'react';
import { Card } from './UI';
import { CurrencyService } from '../services/currencyService';
import { StorageService } from '../services/storageService';
import { isPaidStatus, isRefundedStatus, calculateRegistrationRevenue, calculateRegistrationTickets } from '../services/paymentUtils';
import { Event, Registration } from '../types';
import { TrendingUp, DollarSign, Ticket, Zap, Clock } from 'lucide-react';

interface LiveRevenueWidgetProps {
    events: Event[];
    registrations: Registration[];
}

export const LiveRevenueWidget = ({ events, registrations }: LiveRevenueWidgetProps) => {
    const user = StorageService.getCurrentUser();
    const currency = user?.defaultCurrency || 'USD';

    const { recentSales, todayRevenue, todayTickets, lastHourSales } = useMemo(() => {
        const eventMap: Record<string, string> = {};
        events.forEach(e => { eventMap[e.id] = e.title || 'Unknown Event'; });

        const paidRegs = registrations.filter(r =>
            isPaidStatus(r.paymentStatus) && !isRefundedStatus(r.paymentStatus)
        );

        const now = Date.now();
        const todayStartMs = (() => { const d = new Date(); d.setHours(0, 0, 0, 0); return d.getTime(); })();
        const lastHourMs = now - 60 * 60 * 1000;
        const last48hMs = now - 48 * 60 * 60 * 1000;

        const todayRegs = paidRegs.filter(r => (r.timestamp || 0) >= todayStartMs);
        const todayRevenue = todayRegs.reduce((sum, r) => sum + calculateRegistrationRevenue(r), 0);
        const todayTickets = todayRegs.reduce((sum, r) => sum + calculateRegistrationTickets(r), 0);
        const lastHourSales = paidRegs.filter(r => (r.timestamp || 0) >= lastHourMs).length;

        const recentSales = paidRegs
            .filter(r => (r.timestamp || 0) >= last48hMs)
            .sort((a, b) => (b.timestamp || 0) - (a.timestamp || 0))
            .slice(0, 10)
            .map(r => ({
                id: r.id,
                eventTitle: eventMap[r.eventId] || 'Unknown Event',
                attendeeName: r.attendeeName || 'Guest',
                amount: calculateRegistrationRevenue(r),
                ticketCount: calculateRegistrationTickets(r),
                timestamp: r.timestamp || 0,
            }));

        return { recentSales, todayRevenue, todayTickets, lastHourSales };
    }, [events, registrations]);

    const formatTimeAgo = (timestampMs: number) => {
        if (!timestampMs) return '';
        const diffMins = Math.floor((Date.now() - timestampMs) / 60000);
        if (diffMins < 1) return 'Just now';
        if (diffMins < 60) return `${diffMins}m ago`;
        const diffHours = Math.floor(diffMins / 60);
        if (diffHours < 24) return `${diffHours}h ago`;
        return new Date(timestampMs).toLocaleDateString();
    };

    if (registrations.length === 0) {
        return (
            <Card className="p-6">
                <div className="flex items-center gap-3 mb-4">
                    <div className="w-10 h-10 bg-zinc-100 dark:bg-zinc-800 rounded-xl flex items-center justify-center">
                        <Zap size={20} className="text-zinc-400" />
                    </div>
                    <div>
                        <h3 className="font-bold text-zinc-900 dark:text-white">Live Sales</h3>
                        <p className="text-xs text-zinc-500">Real-time sales data</p>
                    </div>
                </div>
                <div className="text-center py-8">
                    <TrendingUp size={32} className="mx-auto mb-3 text-zinc-300 dark:text-zinc-700" />
                    <p className="text-sm font-medium text-zinc-500 mb-1">No sales data yet</p>
                    <p className="text-xs text-zinc-400">Sales will appear here once tickets are purchased.</p>
                </div>
            </Card>
        );
    }

    return (
        <Card className="p-6 bg-gradient-to-br from-emerald-500/5 to-teal-500/5 border-emerald-500/20" data-testid="live-revenue-widget">
            {/* Header */}
            <div className="flex items-center justify-between mb-6">
                <div className="flex items-center gap-3">
                    <div className="w-10 h-10 bg-emerald-500/10 rounded-xl flex items-center justify-center">
                        <Zap size={20} className="text-emerald-500" />
                    </div>
                    <div>
                        <h3 className="font-bold text-zinc-900 dark:text-white">Live Sales</h3>
                        <p className="text-xs text-zinc-500 flex items-center gap-1">
                            <Clock size={10} /> Live
                        </p>
                    </div>
                </div>
                <div className="flex items-center gap-1">
                    <span className="w-2 h-2 bg-emerald-500 rounded-full animate-pulse"></span>
                    <span className="text-xs text-emerald-600 dark:text-emerald-400 font-bold">LIVE</span>
                </div>
            </div>

            {/* Stats Grid */}
            <div className="grid grid-cols-3 gap-4 mb-6">
                <div className="text-center p-3 bg-white dark:bg-zinc-900 rounded-xl border border-zinc-100 dark:border-zinc-800">
                    <DollarSign size={16} className="mx-auto text-emerald-500 mb-1" />
                    <div className="text-lg font-black text-zinc-900 dark:text-white">
                        {CurrencyService.formatChargeCurrency(todayRevenue, currency)}
                    </div>
                    <div className="text-[10px] uppercase font-bold text-zinc-400">Today</div>
                </div>
                <div className="text-center p-3 bg-white dark:bg-zinc-900 rounded-xl border border-zinc-100 dark:border-zinc-800">
                    <Ticket size={16} className="mx-auto text-blue-500 mb-1" />
                    <div className="text-lg font-black text-zinc-900 dark:text-white">
                        {todayTickets}
                    </div>
                    <div className="text-[10px] uppercase font-bold text-zinc-400">Tickets Today</div>
                </div>
                <div className="text-center p-3 bg-white dark:bg-zinc-900 rounded-xl border border-zinc-100 dark:border-zinc-800">
                    <TrendingUp size={16} className="mx-auto text-orange-500 mb-1" />
                    <div className="text-lg font-black text-zinc-900 dark:text-white">
                        {lastHourSales}/hr
                    </div>
                    <div className="text-[10px] uppercase font-bold text-zinc-400">Velocity</div>
                </div>
            </div>

            {/* Recent Sales Feed */}
            <div>
                <h4 className="text-xs font-bold text-zinc-500 uppercase mb-3">Recent Sales (48h)</h4>
                {recentSales.length === 0 ? (
                    <div className="text-center py-6 text-zinc-400 text-sm">
                        No sales in the last 48 hours
                    </div>
                ) : (
                    <div className="space-y-2 max-h-64 overflow-y-auto">
                        {recentSales.map((sale, i) => (
                            <div
                                key={sale.id || i}
                                className="flex items-center justify-between p-3 bg-white dark:bg-zinc-900 rounded-xl border border-zinc-100 dark:border-zinc-800 hover:border-emerald-200 dark:hover:border-emerald-800 transition-colors"
                            >
                                <div className="flex-1 min-w-0">
                                    <div className="font-bold text-sm text-zinc-900 dark:text-white truncate">
                                        {sale.attendeeName}
                                    </div>
                                    <div className="text-xs text-zinc-500 truncate">
                                        {sale.eventTitle} &bull; {sale.ticketCount} ticket{sale.ticketCount !== 1 ? 's' : ''}
                                    </div>
                                </div>
                                <div className="text-right ml-3">
                                    <div className="font-black text-emerald-600 dark:text-emerald-400">
                                        +{CurrencyService.formatChargeCurrency(sale.amount, currency)}
                                    </div>
                                    <div className="text-[10px] text-zinc-400">
                                        {formatTimeAgo(sale.timestamp)}
                                    </div>
                                </div>
                            </div>
                        ))}
                    </div>
                )}
            </div>
        </Card>
    );
};

export default LiveRevenueWidget;
