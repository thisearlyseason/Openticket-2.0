import React, { useEffect, useState, useCallback } from 'react';
import { Card } from './UI';
import { CurrencyService } from '../services/currencyService';
import { StorageService } from '../services/storageService';
import { 
    TrendingUp, 
    DollarSign, 
    Ticket, 
    Zap, 
    RefreshCw,
    Clock
} from 'lucide-react';

interface Sale {
    id: string;
    eventTitle: string;
    attendeeName: string;
    amount: number;
    ticketCount: number;
    timestamp: string;
}

interface LiveSalesData {
    recentSales: Sale[];
    todayRevenue: number;
    todayTickets: number;
    salesVelocity: number;
    lastHourSales: number;
}

export const LiveRevenueWidget = () => {
    const [data, setData] = useState<LiveSalesData | null>(null);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);
    const [lastUpdated, setLastUpdated] = useState<Date | null>(null);
    
    const user = StorageService.getCurrentUser();
    const currency = user?.defaultCurrency || 'USD';

    const fetchLiveSales = useCallback(async () => {
        try {
            const API_URL = import.meta.env.VITE_BACKEND_URL || '';
            const authToken = await StorageService.getAuthToken();

            const response = await fetch(`${API_URL}/api/admin/organizer/live-sales`, {
                headers: {
                    ...(authToken ? { 'Authorization': `Bearer ${authToken}` } : {}),
                    'Content-Type': 'application/json'
                }
            });
            
            if (!response.ok) {
                throw new Error(`API returned ${response.status}`);
            }
            
            const result = await response.json();
            setData(result);
            setLastUpdated(new Date());
            setError(null);
        } catch (err) {
            console.error('[LiveRevenue] Error:', err);
            setError('Failed to load live sales');
        } finally {
            setLoading(false);
        }
    }, []);

    useEffect(() => {
        fetchLiveSales();
        
        // Refresh every 30 seconds
        const interval = setInterval(fetchLiveSales, 30000);
        
        return () => clearInterval(interval);
    }, [fetchLiveSales]);

    const formatTimeAgo = (timestamp: string) => {
        const now = new Date();
        const time = new Date(timestamp);
        const diffMs = now.getTime() - time.getTime();
        const diffMins = Math.floor(diffMs / 60000);
        
        if (diffMins < 1) return 'Just now';
        if (diffMins < 60) return `${diffMins}m ago`;
        const diffHours = Math.floor(diffMins / 60);
        if (diffHours < 24) return `${diffHours}h ago`;
        return time.toLocaleDateString();
    };

    if (loading) {
        return (
            <Card className="p-6 animate-pulse">
                <div className="h-4 bg-zinc-200 dark:bg-zinc-800 rounded w-1/3 mb-4"></div>
                <div className="h-8 bg-zinc-200 dark:bg-zinc-800 rounded w-1/2 mb-6"></div>
                <div className="space-y-3">
                    {[1, 2, 3].map(i => (
                        <div key={i} className="h-12 bg-zinc-200 dark:bg-zinc-800 rounded"></div>
                    ))}
                </div>
            </Card>
        );
    }

    if (error || !data) {
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
                <div className="text-center py-8 text-zinc-400">
                    <TrendingUp size={32} className="mx-auto mb-3 opacity-40" />
                    <p className="text-sm font-medium text-zinc-500 mb-1">
                        {error ? 'Unable to load sales data' : 'No sales data yet'}
                    </p>
                    <p className="text-xs text-zinc-400 mb-4">
                        {error ? 'Check your connection or try refreshing.' : 'Sales will appear here once tickets are purchased.'}
                    </p>
                    <button 
                        onClick={fetchLiveSales}
                        className="text-primary text-xs font-bold hover:underline flex items-center gap-1 mx-auto"
                    >
                        <RefreshCw size={12} /> Refresh
                    </button>
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
                            <Clock size={10} />
                            {lastUpdated ? `Updated ${formatTimeAgo(lastUpdated.toISOString())}` : 'Loading...'}
                        </p>
                    </div>
                </div>
                <button 
                    onClick={fetchLiveSales}
                    className="p-2 hover:bg-zinc-100 dark:hover:bg-zinc-800 rounded-lg transition-colors"
                    title="Refresh"
                >
                    <RefreshCw size={16} className="text-zinc-400" />
                </button>
            </div>

            {/* Stats Grid */}
            <div className="grid grid-cols-3 gap-4 mb-6">
                <div className="text-center p-3 bg-white dark:bg-zinc-900 rounded-xl border border-zinc-100 dark:border-zinc-800">
                    <DollarSign size={16} className="mx-auto text-emerald-500 mb-1" />
                    <div className="text-lg font-black text-zinc-900 dark:text-white">
                        {CurrencyService.formatChargeCurrency(data.todayRevenue, currency)}
                    </div>
                    <div className="text-[10px] uppercase font-bold text-zinc-400">Today</div>
                </div>
                <div className="text-center p-3 bg-white dark:bg-zinc-900 rounded-xl border border-zinc-100 dark:border-zinc-800">
                    <Ticket size={16} className="mx-auto text-blue-500 mb-1" />
                    <div className="text-lg font-black text-zinc-900 dark:text-white">
                        {data.todayTickets}
                    </div>
                    <div className="text-[10px] uppercase font-bold text-zinc-400">Tickets Today</div>
                </div>
                <div className="text-center p-3 bg-white dark:bg-zinc-900 rounded-xl border border-zinc-100 dark:border-zinc-800">
                    <TrendingUp size={16} className="mx-auto text-orange-500 mb-1" />
                    <div className="text-lg font-black text-zinc-900 dark:text-white">
                        {data.salesVelocity}/hr
                    </div>
                    <div className="text-[10px] uppercase font-bold text-zinc-400">Velocity</div>
                </div>
            </div>

            {/* Recent Sales Feed */}
            <div>
                <h4 className="text-xs font-bold text-zinc-500 uppercase mb-3">Recent Sales</h4>
                {data.recentSales.length === 0 ? (
                    <div className="text-center py-8 text-zinc-400 text-sm">
                        No sales in the last 24 hours
                    </div>
                ) : (
                    <div className="space-y-2 max-h-64 overflow-y-auto">
                        {data.recentSales.map((sale, i) => (
                            <div 
                                key={sale.id || i}
                                className="flex items-center justify-between p-3 bg-white dark:bg-zinc-900 rounded-xl border border-zinc-100 dark:border-zinc-800 hover:border-emerald-200 dark:hover:border-emerald-800 transition-colors"
                            >
                                <div className="flex-1 min-w-0">
                                    <div className="font-bold text-sm text-zinc-900 dark:text-white truncate">
                                        {sale.attendeeName}
                                    </div>
                                    <div className="text-xs text-zinc-500 truncate">
                                        {sale.eventTitle} • {sale.ticketCount} ticket{sale.ticketCount !== 1 ? 's' : ''}
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
