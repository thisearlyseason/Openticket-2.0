import React, { useState, useEffect, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { StorageService } from '../services/storageService';
import { 
    isPaidStatus, isRefundedStatus, 
    calculatePaidRevenue, calculatePaidTickets, 
    calculateRegistrationRevenue, calculateRegistrationTickets 
} from '../services/paymentUtils';
import { Event, Registration, User } from '../types';
import { Button, Card, Badge, DonutChart, SimpleChart } from './UI';
import { 
    ArrowLeft, BarChart3, TrendingUp, TrendingDown, Users, DollarSign, 
    Clock, Calendar, Download, Eye, ShoppingCart, Percent, Globe,
    Smartphone, Monitor, RefreshCw, Filter, ChevronDown, ArrowUpRight,
    Ticket, CreditCard, MapPin, Mail
} from 'lucide-react';

interface AnalyticsData {
    events: Event[];
    registrations: Registration[];
    totalRevenue: number;
    totalTicketsSold: number;
    conversionRate: number;
    avgOrderValue: number;
    topEvents: { event: Event; revenue: number; tickets: number }[];
    revenueByDay: { label: string; value: number }[];
    ticketsByType: { label: string; value: number }[];
    salesByHour: { label: string; value: number }[];
    deviceBreakdown: { label: string; value: number }[];
    locationData: { label: string; value: number }[];
}

type DateRange = '7d' | '30d' | '90d' | 'all';

export const AdvancedAnalytics = () => {
    const navigate = useNavigate();
    const [isLoading, setIsLoading] = useState(true);
    const [dateRange, setDateRange] = useState<DateRange>('30d');
    const [analyticsData, setAnalyticsData] = useState<AnalyticsData | null>(null);
    const [compareMode, setCompareMode] = useState(false);
    const [previousPeriodData, setPreviousPeriodData] = useState<AnalyticsData | null>(null);

    useEffect(() => {
        loadAnalytics();
    }, [dateRange]);

    const getDateRangeFilter = (range: DateRange): Date => {
        const now = new Date();
        switch (range) {
            case '7d': return new Date(now.setDate(now.getDate() - 7));
            case '30d': return new Date(now.setDate(now.getDate() - 30));
            case '90d': return new Date(now.setDate(now.getDate() - 90));
            default: return new Date(0);
        }
    };

    const loadAnalytics = async () => {
        setIsLoading(true);
        const user = StorageService.getCurrentUser();
        if (!user) {
            navigate('/auth');
            return;
        }

        try {
            // Fetch all events for this organizer
            const events = await StorageService.getEvents();
            const myEvents = events.filter(e => e.ownerId === user.id);
            
            // Fetch all registrations for these events
            const allRegs: Registration[] = [];
            for (const event of myEvents) {
                const regs = await StorageService.getRegistrations(event.id);
                // Only include PAID registrations (not refunded) for accurate analytics
                allRegs.push(...regs.filter(r => isPaidStatus(r.paymentStatus) && !isRefundedStatus(r.paymentStatus)));
            }

            // Filter by date range
            const startDate = getDateRangeFilter(dateRange);
            const filteredRegs = allRegs.filter(r => new Date(r.timestamp) >= startDate);

            // Fetch real page view analytics from backend
            let realAnalytics = { totalViews: 0, byDevice: {}, byCountry: [], byDay: [] };
            try {
                const token = localStorage.getItem('openticket_auth_token');
                const API_URL = import.meta.env.VITE_BACKEND_URL || '';
                const response = await fetch(`${API_URL}/api/analytics/organizer?range=${dateRange}`, {
                    headers: token ? { 'Authorization': `Bearer ${token}` } : {}
                });
                if (response.ok) {
                    realAnalytics = await response.json();
                }
            } catch (e) {
                console.debug('[Analytics] Failed to fetch page view analytics:', e);
            }

            // Calculate analytics with real page view data
            const data = calculateAnalytics(myEvents, filteredRegs, realAnalytics);
            setAnalyticsData(data);

            // Calculate previous period for comparison
            if (compareMode && dateRange !== 'all') {
                const previousStart = new Date(startDate);
                const periodLength = new Date().getTime() - startDate.getTime();
                previousStart.setTime(previousStart.getTime() - periodLength);
                
                const previousRegs = allRegs.filter(r => {
                    const regDate = new Date(r.timestamp);
                    return regDate >= previousStart && regDate < startDate;
                });
                
                const prevData = calculateAnalytics(myEvents, previousRegs);
                setPreviousPeriodData(prevData);
            }
        } catch (error) {
            console.error('Failed to load analytics:', error);
        } finally {
            setIsLoading(false);
        }
    };

    const calculateAnalytics = (events: Event[], regs: Registration[], realAnalytics?: { totalViews: number; byDevice: Record<string, number>; byCountry: { label: string; value: number }[] }): AnalyticsData => {
        // Total revenue - using utility function for consistency
        const totalRevenue = regs.reduce((sum, r) => sum + calculateRegistrationRevenue(r), 0);

        // Total tickets sold - using utility function
        const totalTicketsSold = regs.reduce((sum, r) => sum + calculateRegistrationTickets(r), 0);

        // Conversion rate - now uses real page views if available
        const totalPageViews = realAnalytics?.totalViews || 0;
        const conversionRate = totalPageViews > 0 ? (regs.length / totalPageViews) * 100 : 0;

        // Average order value
        const avgOrderValue = regs.length > 0 ? totalRevenue / regs.length : 0;

        // Top events by revenue
        const eventRevenue: Record<string, { revenue: number; tickets: number }> = {};
        regs.forEach(r => {
            if (!eventRevenue[r.eventId]) {
                eventRevenue[r.eventId] = { revenue: 0, tickets: 0 };
            }
            eventRevenue[r.eventId].revenue += calculateRegistrationRevenue(r);
            eventRevenue[r.eventId].tickets += calculateRegistrationTickets(r);
        });

        const topEvents = Object.entries(eventRevenue)
            .map(([eventId, data]) => ({
                event: events.find(e => e.id === eventId)!,
                ...data
            }))
            .filter(e => e.event)
            .sort((a, b) => b.revenue - a.revenue)
            .slice(0, 5);

        // Revenue by day
        const revenueByDay: Record<string, number> = {};
        regs.forEach(r => {
            const date = new Date(r.timestamp).toLocaleDateString(undefined, { month: 'short', day: 'numeric' });
            revenueByDay[date] = (revenueByDay[date] || 0) + calculateRegistrationRevenue(r);
        });

        const revenueByDayData = Object.entries(revenueByDay)
            .sort((a, b) => new Date(a[0]).getTime() - new Date(b[0]).getTime())
            .slice(-14) // Last 14 days
            .map(([label, value]) => ({ label, value }));

        // Tickets by type
        const ticketTypes: Record<string, number> = {};
        regs.forEach(r => {
            if (r.tickets) {
                r.tickets.forEach(t => {
                    ticketTypes[t.name || 'General'] = (ticketTypes[t.name || 'General'] || 0) + (Number(t.quantity) || 0);
                });
            }
        });
        const ticketsByType = Object.entries(ticketTypes)
            .map(([label, value]) => ({ label, value }))
            .sort((a, b) => b.value - a.value);

        // Sales by hour
        const salesByHour: Record<string, number> = {};
        for (let i = 0; i < 24; i++) {
            salesByHour[`${i.toString().padStart(2, '0')}:00`] = 0;
        }
        regs.forEach(r => {
            const hour = new Date(r.timestamp).getHours();
            const key = `${hour.toString().padStart(2, '0')}:00`;
            salesByHour[key] = (salesByHour[key] || 0) + 1;
        });
        const salesByHourData = Object.entries(salesByHour)
            .map(([label, value]) => ({ label, value }));

        // Device breakdown - now uses real analytics data
        const deviceBreakdown = realAnalytics?.byDevice && Object.keys(realAnalytics.byDevice).length > 0
            ? Object.entries(realAnalytics.byDevice).map(([label, value]) => ({ label, value }))
            : regs.length > 0 ? [{ label: 'All Devices', value: regs.length }] : [];

        // Location data - now uses real analytics data if available
        const locationData = realAnalytics?.byCountry && realAnalytics.byCountry.length > 0
            ? realAnalytics.byCountry
            : (() => {
                // Fallback to phone-based inference
                const locations: Record<string, number> = {};
                regs.forEach(r => {
                    const location = r.attendeePhone?.includes('+1') ? 'United States' : 
                                   r.attendeePhone?.includes('+44') ? 'United Kingdom' :
                                   r.attendeePhone?.includes('+61') ? 'Australia' : 'Other';
                    locations[location] = (locations[location] || 0) + 1;
                });
                return Object.entries(locations)
                    .map(([label, value]) => ({ label, value }))
                    .sort((a, b) => b.value - a.value);
            })();

        return {
            events,
            registrations: regs,
            totalRevenue,
            totalTicketsSold,
            conversionRate: Math.min(conversionRate, 100),
            avgOrderValue,
            topEvents,
            revenueByDay: revenueByDayData,
            ticketsByType,
            salesByHour: salesByHourData,
            deviceBreakdown,
            locationData
        };
    };

    const getPercentChange = (current: number, previous: number): number => {
        if (previous === 0) return current > 0 ? 100 : 0;
        return ((current - previous) / previous) * 100;
    };

    const formatCurrency = (amount: number): string => {
        return new Intl.NumberFormat('en-US', {
            style: 'currency',
            currency: 'USD',
            minimumFractionDigits: 0,
            maximumFractionDigits: 0
        }).format(amount);
    };

    const exportReport = () => {
        if (!analyticsData) return;

        const headers = ['Metric', 'Value'];
        const rows = [
            ['Total Revenue', formatCurrency(analyticsData.totalRevenue)],
            ['Total Tickets Sold', analyticsData.totalTicketsSold.toString()],
            ['Total Orders', analyticsData.registrations.length.toString()],
            ['Average Order Value', formatCurrency(analyticsData.avgOrderValue)],
            ['', ''],
            ['Top Events', ''],
            ...analyticsData.topEvents.map(e => [e.event.title, formatCurrency(e.revenue)]),
            ['', ''],
            ['Tickets by Type', ''],
            ...analyticsData.ticketsByType.map(t => [t.label, t.value.toString()])
        ];

        const csvContent = "data:text/csv;charset=utf-8,"
            + headers.join(",") + "\n"
            + rows.map(r => r.join(",")).join("\n");

        const link = document.createElement("a");
        link.setAttribute("href", encodeURI(csvContent));
        link.setAttribute("download", `analytics_report_${new Date().toISOString().split('T')[0]}.csv`);
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
    };

    if (isLoading) {
        return (
            <div className="min-h-screen flex items-center justify-center bg-zinc-50 dark:bg-black">
                <div className="text-center">
                    <BarChart3 className="w-12 h-12 text-[#ec4899] animate-pulse mx-auto mb-4" />
                    <p className="text-zinc-500">Loading analytics...</p>
                </div>
            </div>
        );
    }

    if (!analyticsData) {
        return (
            <div className="min-h-screen flex items-center justify-center bg-zinc-50 dark:bg-black">
                <div className="text-center">
                    <p className="text-zinc-500">No data available</p>
                </div>
            </div>
        );
    }

    const { totalRevenue, totalTicketsSold, avgOrderValue, registrations, topEvents, revenueByDay, ticketsByType, salesByHour, deviceBreakdown } = analyticsData;

    return (
        <div className="min-h-screen bg-zinc-50 dark:bg-black pb-24">
            {/* Header */}
            <div className="bg-white dark:bg-zinc-900 border-b border-zinc-200 dark:border-zinc-800 sticky top-0 z-20">
                <div className="max-w-7xl mx-auto px-4 py-4">
                    <div className="flex items-center justify-between">
                        <div className="flex items-center gap-4">
                            <button 
                                onClick={() => navigate('/dashboard')} 
                                className="text-zinc-500 hover:text-zinc-900 dark:hover:text-white"
                            >
                                <ArrowLeft size={20} />
                            </button>
                            <div>
                                <h1 className="text-2xl font-black text-zinc-900 dark:text-white">
                                    Analytics Dashboard
                                </h1>
                                <p className="text-sm text-zinc-500">
                                    Performance insights across all your events
                                </p>
                            </div>
                        </div>
                        
                        <div className="flex items-center gap-3">
                            {/* Date Range Selector */}
                            <div className="relative">
                                <select
                                    value={dateRange}
                                    onChange={(e) => setDateRange(e.target.value as DateRange)}
                                    className="appearance-none bg-zinc-100 dark:bg-zinc-800 border border-zinc-200 dark:border-zinc-700 rounded-xl px-4 py-2 pr-10 text-sm font-medium focus:outline-none focus:ring-2 focus:ring-[#ec4899]"
                                >
                                    <option value="7d">Last 7 days</option>
                                    <option value="30d">Last 30 days</option>
                                    <option value="90d">Last 90 days</option>
                                    <option value="all">All time</option>
                                </select>
                                <ChevronDown size={16} className="absolute right-3 top-1/2 -translate-y-1/2 text-zinc-400 pointer-events-none" />
                            </div>
                            
                            <Button variant="ghost" onClick={loadAnalytics} className="p-2">
                                <RefreshCw size={18} />
                            </Button>
                            
                            <Button onClick={exportReport} className="flex items-center gap-2">
                                <Download size={16} /> Export
                            </Button>
                        </div>
                    </div>
                </div>
            </div>

            <div className="max-w-7xl mx-auto px-4 py-6">
                {/* KPI Cards */}
                <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
                    <KPICard 
                        title="Total Revenue"
                        value={formatCurrency(totalRevenue)}
                        icon={<DollarSign size={20} />}
                        trend={previousPeriodData ? getPercentChange(totalRevenue, previousPeriodData.totalRevenue) : undefined}
                        color="green"
                    />
                    <KPICard 
                        title="Tickets Sold"
                        value={totalTicketsSold.toLocaleString()}
                        icon={<Ticket size={20} />}
                        trend={previousPeriodData ? getPercentChange(totalTicketsSold, previousPeriodData.totalTicketsSold) : undefined}
                        color="blue"
                    />
                    <KPICard 
                        title="Total Orders"
                        value={registrations.length.toLocaleString()}
                        icon={<ShoppingCart size={20} />}
                        trend={previousPeriodData ? getPercentChange(registrations.length, previousPeriodData.registrations.length) : undefined}
                        color="purple"
                    />
                    <KPICard 
                        title="Avg Order Value"
                        value={formatCurrency(avgOrderValue)}
                        icon={<CreditCard size={20} />}
                        trend={previousPeriodData ? getPercentChange(avgOrderValue, previousPeriodData.avgOrderValue) : undefined}
                        color="orange"
                    />
                </div>

                {/* Charts Row */}
                <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-8">
                    {/* Revenue Over Time */}
                    <Card className="p-6">
                        <h3 className="font-bold text-lg text-zinc-900 dark:text-white mb-4 flex items-center gap-2">
                            <TrendingUp size={18} className="text-green-500" />
                            Revenue Over Time
                        </h3>
                        {revenueByDay.length > 0 ? (
                            <div className="h-64">
                                <SimpleChart label="" data={revenueByDay} />
                            </div>
                        ) : (
                            <div className="h-64 flex items-center justify-center text-zinc-400">
                                No revenue data for this period
                            </div>
                        )}
                    </Card>

                    {/* Ticket Distribution */}
                    <Card className="p-6">
                        <h3 className="font-bold text-lg text-zinc-900 dark:text-white mb-4 flex items-center gap-2">
                            <Ticket size={18} className="text-[#ec4899]" />
                            Ticket Distribution
                        </h3>
                        {ticketsByType.length > 0 ? (
                            <DonutChart data={ticketsByType} />
                        ) : (
                            <div className="h-48 flex items-center justify-center text-zinc-400">
                                No ticket data for this period
                            </div>
                        )}
                    </Card>
                </div>

                {/* Second Row */}
                <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 mb-8">
                    {/* Sales by Hour */}
                    <Card className="p-6 lg:col-span-2">
                        <h3 className="font-bold text-lg text-zinc-900 dark:text-white mb-4 flex items-center gap-2">
                            <Clock size={18} className="text-blue-500" />
                            Sales by Hour
                        </h3>
                        <div className="h-48">
                            <SimpleChart label="" data={salesByHour.filter((_, i) => i % 2 === 0)} />
                        </div>
                        <p className="text-xs text-zinc-500 mt-2 text-center">
                            Peak hours help optimize your marketing timing
                        </p>
                    </Card>

                    {/* Device Breakdown */}
                    <Card className="p-6">
                        <h3 className="font-bold text-lg text-zinc-900 dark:text-white mb-4 flex items-center gap-2">
                            <Smartphone size={18} className="text-purple-500" />
                            Device Breakdown
                        </h3>
                        <DonutChart data={deviceBreakdown} />
                    </Card>
                </div>

                {/* Top Events Table */}
                <Card className="p-6">
                    <h3 className="font-bold text-lg text-zinc-900 dark:text-white mb-4 flex items-center gap-2">
                        <BarChart3 size={18} className="text-[#E0FF20]" />
                        Top Performing Events
                    </h3>
                    {topEvents.length > 0 ? (
                        <div className="overflow-x-auto">
                            <table className="w-full">
                                <thead>
                                    <tr className="border-b border-zinc-200 dark:border-zinc-800">
                                        <th className="text-left py-3 px-4 text-xs font-bold text-zinc-500 uppercase">Event</th>
                                        <th className="text-right py-3 px-4 text-xs font-bold text-zinc-500 uppercase">Revenue</th>
                                        <th className="text-right py-3 px-4 text-xs font-bold text-zinc-500 uppercase">Tickets</th>
                                        <th className="text-right py-3 px-4 text-xs font-bold text-zinc-500 uppercase">Avg Price</th>
                                        <th className="text-right py-3 px-4 text-xs font-bold text-zinc-500 uppercase"></th>
                                    </tr>
                                </thead>
                                <tbody>
                                    {topEvents.map((item, i) => (
                                        <tr key={item.event.id} className="border-b border-zinc-100 dark:border-zinc-800/50 hover:bg-zinc-50 dark:hover:bg-zinc-800/30 transition-colors">
                                            <td className="py-4 px-4">
                                                <div className="flex items-center gap-3">
                                                    <div className="w-8 h-8 bg-gradient-to-br from-[#ec4899] to-[#f472b6] rounded-lg flex items-center justify-center text-white font-bold text-sm">
                                                        {i + 1}
                                                    </div>
                                                    <div>
                                                        <p className="font-bold text-zinc-900 dark:text-white">{item.event.title}</p>
                                                        <p className="text-xs text-zinc-500">{new Date(item.event.date).toLocaleDateString()}</p>
                                                    </div>
                                                </div>
                                            </td>
                                            <td className="py-4 px-4 text-right font-bold text-green-600">{formatCurrency(item.revenue)}</td>
                                            <td className="py-4 px-4 text-right font-medium text-zinc-900 dark:text-white">{item.tickets}</td>
                                            <td className="py-4 px-4 text-right text-zinc-500">{formatCurrency(item.tickets > 0 ? item.revenue / item.tickets : 0)}</td>
                                            <td className="py-4 px-4 text-right">
                                                <Button 
                                                    variant="ghost" 
                                                    size="sm"
                                                    onClick={() => navigate(`/manage/${item.event.id}/analytics`)}
                                                    className="text-xs"
                                                >
                                                    Details <ArrowUpRight size={14} className="ml-1" />
                                                </Button>
                                            </td>
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                        </div>
                    ) : (
                        <div className="text-center py-12 text-zinc-400">
                            <BarChart3 size={48} className="mx-auto mb-4 opacity-50" />
                            <p>No event data for this period</p>
                        </div>
                    )}
                </Card>
            </div>
        </div>
    );
};

// KPI Card Component
const KPICard = ({ 
    title, 
    value, 
    icon, 
    trend, 
    color 
}: { 
    title: string; 
    value: string; 
    icon: React.ReactNode; 
    trend?: number;
    color: 'green' | 'blue' | 'purple' | 'orange';
}) => {
    const colorClasses = {
        green: 'from-green-500 to-emerald-600',
        blue: 'from-blue-500 to-indigo-600',
        purple: 'from-purple-500 to-pink-600',
        orange: 'from-orange-500 to-red-600'
    };

    return (
        <Card className="p-5 relative overflow-hidden group hover:shadow-lg transition-shadow">
            <div className="flex items-start justify-between mb-3">
                <div className={`w-10 h-10 rounded-xl bg-gradient-to-br ${colorClasses[color]} flex items-center justify-center text-white`}>
                    {icon}
                </div>
                {trend !== undefined && (
                    <div className={`flex items-center gap-1 text-xs font-bold ${trend >= 0 ? 'text-green-500' : 'text-red-500'}`}>
                        {trend >= 0 ? <TrendingUp size={14} /> : <TrendingDown size={14} />}
                        {Math.abs(trend).toFixed(1)}%
                    </div>
                )}
            </div>
            <p className="text-xs font-bold text-zinc-500 uppercase tracking-wide mb-1">{title}</p>
            <p className="text-2xl font-black text-zinc-900 dark:text-white">{value}</p>
        </Card>
    );
};

export default AdvancedAnalytics;
