import React, { useState, useEffect } from 'react';
import { Card, Badge, Button } from './UI';
import { BarChart3, TrendingUp, Clock, AlertTriangle, RefreshCw, Download, Calendar, Users, Zap, Activity, Wifi, WifiOff } from 'lucide-react';
import { getAuthToken } from '../services/firebaseConfig';
// import { useWebSocket } from '../hooks/useWebSocket'; // Temporarily disabled for Vercel deployment
import { HourlyScansChart, DailyTrendsChart, ScanMethodsChart, SuccessRateTrendChart, PerformanceMetricsChart } from './AnalyticsCharts';

interface EventAnalytics {
    eventId: string;
    eventTitle: string;
    totalScans: number;
    successfulScans: number;
    failedScans: number;
    successRate: number;
    avgDuration: number;
    lastScanAt: string;
}

export const AdminAnalyticsDashboard: React.FC = () => {
    const [loading, setLoading] = useState(true);
    const [refreshing, setRefreshing] = useState(false);
    const [eventAnalytics, setEventAnalytics] = useState<EventAnalytics[]>([]);
    const [globalStats, setGlobalStats] = useState({
        totalEvents: 0,
        totalScans: 0,
        avgSuccessRate: 0,
        avgScanTime: 0
    });
    const [selectedPeriod, setSelectedPeriod] = useState<'7d' | '30d' | '90d' | 'all'>('30d');
    const [showCharts, setShowCharts] = useState(false);
    const [chartData, setChartData] = useState<any>({
        hourly: [],
        daily: [],
        methods: {}
    });

    // Temporarily disabled WebSocket for Vercel deployment
    // const { isConnected, connectionError } = useWebSocket({
    //     subscribeGlobal: true,
    //     onAnalyticsUpdate: (data) => {
    //         console.log('[Admin Analytics] Real-time update received:', data);
    //         loadAnalytics(); // Refresh data when update received
    //     }
    // });
    const isConnected = false;
    const connectionError = null;

    useEffect(() => {
        loadAnalytics();
    }, [selectedPeriod]);

    const loadAnalytics = async () => {
        setLoading(true);
        try {
            const token = await getAuthToken();
            
            // Get all events with analytics
            const response = await fetch(`/api/admin/analytics/overview?period=${selectedPeriod}`, {
                headers: {
                    'Authorization': `Bearer ${token}`
                }
            });

            if (response.ok) {
                const data = await response.json();
                setEventAnalytics(data.events || []);
                setGlobalStats(data.globalStats || {});
                
                // Load chart data if charts are visible
                if (showCharts) {
                    await loadChartData(token);
                }
            }
        } catch (error) {
            console.error('Error loading analytics:', error);
        } finally {
            setLoading(false);
        }
    };

    const loadChartData = async (token: string) => {
        try {
            // Load aggregated chart data from materialized views
            const [hourlyRes, dailyRes] = await Promise.all([
                fetch('/api/admin/analytics/hourly-data', {
                    headers: { 'Authorization': `Bearer ${token}` }
                }),
                fetch('/api/admin/analytics/daily-data', {
                    headers: { 'Authorization': `Bearer ${token}` }
                })
            ]);

            if (hourlyRes.ok && dailyRes.ok) {
                const hourlyData = await hourlyRes.json();
                const dailyData = await dailyRes.json();

                setChartData({
                    hourly: hourlyData.data || [],
                    daily: dailyData.data || [],
                    methods: globalStats // Use global stats for methods
                });
            }
        } catch (error) {
            console.error('Error loading chart data:', error);
        }
    };

    const refreshMaterializedViews = async () => {
        setRefreshing(true);
        try {
            const token = await getAuthToken();
            const response = await fetch('/api/admin/analytics/refresh-views', {
                method: 'POST',
                headers: {
                    'Authorization': `Bearer ${token}`
                }
            });

            if (response.ok) {
                await loadAnalytics();
                alert('Materialized views refreshed successfully!');
            }
        } catch (error) {
            console.error('Error refreshing views:', error);
            alert('Failed to refresh views');
        } finally {
            setRefreshing(false);
        }
    };

    const exportAllAnalytics = async () => {
        try {
            const token = await getAuthToken();
            const response = await fetch('/api/admin/analytics/export-all', {
                headers: {
                    'Authorization': `Bearer ${token}`
                }
            });

            if (response.ok) {
                const blob = await response.blob();
                const url = window.URL.createObjectURL(blob);
                const a = document.createElement('a');
                a.href = url;
                a.download = `analytics-export-${Date.now()}.csv`;
                document.body.appendChild(a);
                a.click();
                window.URL.revokeObjectURL(url);
                document.body.removeChild(a);
            }
        } catch (error) {
            console.error('Error exporting analytics:', error);
        }
    };

    if (loading) {
        return (
            <div className="flex items-center justify-center h-96">
                <div className="text-center">
                    <RefreshCw className="animate-spin mx-auto mb-4 text-[#ec4899]" size={48} />
                    <p className="text-zinc-400">Loading analytics...</p>
                </div>
            </div>
        );
    }

    return (
        <div className="space-y-6">
            {/* Header */}
            <div className="flex justify-between items-center">
                <div>
                    <h2 className="text-2xl font-black text-white mb-2 flex items-center gap-2">
                        <BarChart3 size={32} className="text-[#ec4899]" />
                        Scan Analytics Dashboard
                        {isConnected ? (
                            <Badge className="bg-green-600 text-white border-none text-xs">
                                <Wifi size={12} /> Live
                            </Badge>
                        ) : (
                            <Badge className="bg-zinc-600 text-white border-none text-xs">
                                <WifiOff size={12} /> Offline
                            </Badge>
                        )}
                    </h2>
                    <p className="text-zinc-400 text-sm">System-wide scanner performance metrics</p>
                </div>
                <div className="flex gap-3">
                    <Button
                        onClick={() => setShowCharts(!showCharts)}
                        className="bg-purple-600 hover:bg-purple-700 border-none"
                    >
                        <TrendingUp size={16} />
                        {showCharts ? 'Hide' : 'Show'} Charts
                    </Button>
                    <Button
                        onClick={refreshMaterializedViews}
                        disabled={refreshing}
                        className="bg-blue-600 hover:bg-blue-700 border-none"
                    >
                        <RefreshCw size={16} className={refreshing ? 'animate-spin' : ''} />
                        Refresh Views
                    </Button>
                    <Button
                        onClick={exportAllAnalytics}
                        className="bg-green-600 hover:bg-green-700 border-none"
                    >
                        <Download size={16} />
                        Export All
                    </Button>
                </div>
            </div>

            {/* Period Filter */}
            <div className="flex gap-2">
                {(['7d', '30d', '90d', 'all'] as const).map(period => (
                    <button
                        key={period}
                        onClick={() => setSelectedPeriod(period)}
                        className={`px-4 py-2 rounded-lg font-bold text-sm transition-all ${
                            selectedPeriod === period
                                ? 'bg-[#ec4899] text-white'
                                : 'bg-zinc-900 text-zinc-400 hover:bg-zinc-800'
                        }`}
                    >
                        {period === 'all' ? 'All Time' : period.toUpperCase()}
                    </button>
                ))}
            </div>

            {/* Global Stats */}
            <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
                <Card className="p-6 bg-zinc-900 border-zinc-800">
                    <div className="flex items-center justify-between mb-2">
                        <span className="text-sm text-zinc-500">Total Events</span>
                        <Calendar className="text-blue-500" size={20} />
                    </div>
                    <div className="text-3xl font-black text-white">{globalStats.totalEvents}</div>
                </Card>

                <Card className="p-6 bg-zinc-900 border-zinc-800">
                    <div className="flex items-center justify-between mb-2">
                        <span className="text-sm text-zinc-500">Total Scans</span>
                        <Activity className="text-[#ec4899]" size={20} />
                    </div>
                    <div className="text-3xl font-black text-white">{globalStats.totalScans.toLocaleString()}</div>
                </Card>

                <Card className="p-6 bg-zinc-900 border-zinc-800">
                    <div className="flex items-center justify-between mb-2">
                        <span className="text-sm text-zinc-500">Avg Success Rate</span>
                        <TrendingUp className="text-green-500" size={20} />
                    </div>
                    <div className="text-3xl font-black text-white">{globalStats.avgSuccessRate.toFixed(1)}%</div>
                </Card>

                <Card className="p-6 bg-zinc-900 border-zinc-800">
                    <div className="flex items-center justify-between mb-2">
                        <span className="text-sm text-zinc-500">Avg Scan Time</span>
                        <Zap className="text-orange-500" size={20} />
                    </div>
                    <div className="text-3xl font-black text-white">{globalStats.avgScanTime}ms</div>
                </Card>
            </div>

            {/* Charts Section */}
            {showCharts && (
                <div className="space-y-6">
                    <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                        <DailyTrendsChart data={chartData.daily} />
                        <SuccessRateTrendChart data={chartData.daily} />
                    </div>
                    
                    <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                        <HourlyScansChart data={chartData.hourly} />
                        <PerformanceMetricsChart data={eventAnalytics} />
                    </div>
                </div>
            )}

            {/* Events Table */}
            <Card className="bg-zinc-900 border-zinc-800 overflow-hidden">
                <div className="p-6 border-b border-zinc-800">
                    <h3 className="font-bold text-lg text-white flex items-center gap-2">
                        <Users size={20} className="text-[#ec4899]" />
                        Event Analytics
                    </h3>
                </div>

                <div className="overflow-x-auto">
                    <table className="w-full">
                        <thead className="bg-black text-left">
                            <tr>
                                <th className="p-4 text-xs text-zinc-500 uppercase font-bold">Event</th>
                                <th className="p-4 text-xs text-zinc-500 uppercase font-bold">Total Scans</th>
                                <th className="p-4 text-xs text-zinc-500 uppercase font-bold">Success Rate</th>
                                <th className="p-4 text-xs text-zinc-500 uppercase font-bold">Avg Time</th>
                                <th className="p-4 text-xs text-zinc-500 uppercase font-bold">Failed</th>
                                <th className="p-4 text-xs text-zinc-500 uppercase font-bold">Last Scan</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-zinc-800">
                            {(!eventAnalytics || eventAnalytics.length === 0) ? (
                                <tr>
                                    <td colSpan={6} className="p-8 text-center text-zinc-500">
                                        No analytics data available for selected period
                                    </td>
                                </tr>
                            ) : (
                                (eventAnalytics || []).map((event) => (
                                    <tr key={event.eventId} className="hover:bg-zinc-800/50 transition-colors">
                                        <td className="p-4">
                                            <div className="font-bold text-white truncate max-w-xs">
                                                {event.eventTitle}
                                            </div>
                                            <div className="text-xs text-zinc-500 font-mono">
                                                {event.eventId.substring(0, 8)}...
                                            </div>
                                        </td>
                                        <td className="p-4">
                                            <span className="text-white font-bold">
                                                {event.totalScans.toLocaleString()}
                                            </span>
                                        </td>
                                        <td className="p-4">
                                            <Badge
                                                className={
                                                    event.successRate >= 95
                                                        ? 'bg-green-600 text-white'
                                                        : event.successRate >= 85
                                                        ? 'bg-orange-600 text-white'
                                                        : 'bg-red-600 text-white'
                                                }
                                            >
                                                {event.successRate.toFixed(1)}%
                                            </Badge>
                                        </td>
                                        <td className="p-4 text-white">
                                            {event.avgDuration}ms
                                        </td>
                                        <td className="p-4">
                                            {event.failedScans > 0 ? (
                                                <span className="flex items-center gap-1 text-red-500">
                                                    <AlertTriangle size={14} />
                                                    {event.failedScans}
                                                </span>
                                            ) : (
                                                <span className="text-zinc-600">0</span>
                                            )}
                                        </td>
                                        <td className="p-4 text-zinc-400 text-sm">
                                            {event.lastScanAt ? new Date(event.lastScanAt).toLocaleDateString() : 'N/A'}
                                        </td>
                                    </tr>
                                ))
                            )}
                        </tbody>
                    </table>
                </div>
            </Card>
        </div>
    );
};

export default AdminAnalyticsDashboard;
