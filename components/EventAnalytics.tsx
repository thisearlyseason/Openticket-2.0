
import React, { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { StorageService, PLANS } from '../services/storageService';
import { isPaidStatus, isRefundedStatus, calculatePaidRevenue, calculatePaidTickets, getAddOnSummary } from '../services/paymentUtils';
import { Event, Registration } from '../types';
import { Button, Card, DonutChart, SimpleChart, Badge } from './UI';
import { ArrowLeft, Crown, Lock, BarChart3, TrendingUp, Users, DollarSign, Clock, Calendar, Download, QrCode, ShoppingBag, Ticket as TicketIcon } from 'lucide-react';

export const EventAnalytics = () => {
    const { id } = useParams<{ id: string }>();
    const navigate = useNavigate();
    const [event, setEvent] = useState<Event | null>(null);
    const [regs, setRegs] = useState<Registration[]>([]);
    const [paidRegs, setPaidRegs] = useState<Registration[]>([]);
    const [isLoading, setIsLoading] = useState(true);
    const [isPro, setIsPro] = useState(false);
    const [pageViews, setPageViews] = useState<{ total: number; byDevice: Record<string, number> }>({ total: 0, byDevice: {} });

    useEffect(() => {
        loadData();
    }, [id]);

    const loadData = async () => {
        const user = StorageService.getCurrentUser();
        if (!user || !id) return;

        const freshUser = await StorageService.getUserById(user.id);
        const plan = freshUser?.subscription?.plan || 'free';
        setIsPro(plan === 'pro' || plan === 'premium' || freshUser?.isAdmin === true);
        const e = await StorageService.getEventFull(id);
        const r = await StorageService.getRegistrations(id);

        if (e) setEvent(e);
        setRegs(r);
        // Filter to only paid (not refunded) for accurate analytics
        setPaidRegs(r.filter(reg => isPaidStatus(reg.paymentStatus) && !isRefundedStatus(reg.paymentStatus)));
        
        // Fetch real page view analytics
        try {
            const token = localStorage.getItem('openticket_auth_token');
            const API_URL = import.meta.env.VITE_BACKEND_URL || '';
            const response = await fetch(`${API_URL}/api/analytics/event/${id}`, {
                headers: token ? { 'Authorization': `Bearer ${token}` } : {}
            });
            if (response.ok) {
                const data = await response.json();
                setPageViews({ total: data.total || 0, byDevice: data.byDevice || {} });
            }
        } catch (e) {
            console.debug('[Analytics] Failed to fetch page views:', e);
        }
        
        setIsLoading(false);
    };

    if (isLoading) return <div className="min-h-screen flex items-center justify-center"><BarChart3 className="animate-bounce" /></div>;
    if (!event) return <div className="p-8">Event not found.</div>;

    // --- Aggregation Logic (using PAID registrations only) ---
    const totalSales = paidRegs.length;
    const grossRevenue = calculatePaidRevenue(paidRegs);
    const totalTickets = calculatePaidTickets(paidRegs);

    // Add-on summary
    const addOnSummary = getAddOnSummary(paidRegs);
    const totalAddOnRevenue = addOnSummary.reduce((sum, a) => sum + a.totalRevenue, 0);

    const ticketTypesData: Record<string, number> = {};
    paidRegs.forEach(r => {
        if (r.tickets) {
            r.tickets.forEach(t => {
                ticketTypesData[t.name] = (ticketTypesData[t.name] || 0) + t.quantity;
            });
        }
    });
    const donutData = Object.entries(ticketTypesData).map(([label, value]) => ({ label, value }));

    const salesOverTime: Record<string, number> = {};
    paidRegs.forEach(r => {
        const date = new Date(r.timestamp).toLocaleDateString(undefined, { month: 'short', day: 'numeric' });
        salesOverTime[date] = (salesOverTime[date] || 0) + 1;
    });

    const chartData = Object.entries(salesOverTime)
        .sort((a, b) => new Date(a[0]).getTime() - new Date(b[0]).getTime())
        .map(([label, value]) => ({ label, value }));

    // Check-in Stats
    const checkInCount = paidRegs.reduce((acc, r) => {
        if (r.checkInStatuses) return acc + Object.values(r.checkInStatuses).filter(s => s.checkedIn).length;
        return acc + (r.checkedIn ? 1 : 0);
    }, 0);
    const checkInRate = totalTickets > 0 ? Math.round((checkInCount / totalTickets) * 100) : 0;

    const downloadCSV = () => {
        if (!event || regs.length === 0) return alert('No data to export.');

        const headers = ['Order ID', 'Date', 'Name', 'Email', 'Ticket Type', 'Price', 'Checked In'];
        const rows = regs.flatMap(r => {
            if (!r.tickets) return [];
            return r.tickets.map((t, i) => {
                const key = `${t.tierId}-${i}`;
                const isCheckedIn = (r.checkInStatuses && r.checkInStatuses[key]?.checkedIn) || r.checkedIn || false;
                return [
                    r.id,
                    new Date(r.timestamp).toISOString(),
                    r.attendeeName,
                    r.attendeeEmail,
                    t.name,
                    t.pricePerTicket,
                    isCheckedIn ? 'Yes' : 'No'
                ];
            });
        });

        const csvContent = "data:text/csv;charset=utf-8,"
            + headers.join(",") + "\n"
            + rows.map(e => e.join(",")).join("\n");

        const encodedUri = encodeURI(csvContent);
        const link = document.createElement("a");
        link.setAttribute("href", encodedUri);
        link.setAttribute("download", `${event.title}_report_${new Date().toISOString().split('T')[0]}.csv`);
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
    };

    return (
        <div className="max-w-6xl mx-auto py-6 px-4 pb-24 md:py-8">
            <div className="flex items-center justify-between mb-6 md:mb-8">
                <button onClick={() => navigate(`/manage/${id}`)} className="text-zinc-500 hover:text-zinc-900 dark:hover:text-white flex items-center text-sm font-bold transition-colors">
                    <ArrowLeft size={16} className="mr-2" /> Back to Event
                </button>
                <div className="flex gap-2">
                    <Button variant="outline" size="sm" onClick={() => downloadCSV()} title="Export CSV">
                        <Download size={14} className="mr-2" /> Export Report
                    </Button>
                    <div className="text-xs md:text-sm font-medium text-zinc-500 bg-zinc-100 dark:bg-zinc-800 px-3 py-1 rounded-full flex items-center gap-2">
                        <div className="w-2 h-2 bg-green-500 rounded-full animate-pulse"></div> Live Data
                    </div>
                </div>
            </div>

            <div className="mb-8">
                <h1 className="text-3xl md:text-4xl font-black text-zinc-900 dark:text-white uppercase tracking-tight flex items-center gap-3">
                    Performance <span className="text-transparent bg-clip-text bg-gradient-to-r from-blue-500 to-teal-400">Hub</span>
                </h1>
                <p className="text-zinc-500 text-sm md:text-base">{event.title}</p>
            </div>

            {/* BENTO GRID */}
            <div className="grid grid-cols-1 md:grid-cols-3 lg:grid-cols-4 gap-4 md:gap-6 auto-rows-[minmax(160px,auto)]">

                {/* Hero Stat: Total Sales */}
                <div className="md:col-span-2 p-6 md:p-8 rounded-3xl bg-zinc-900 text-white relative overflow-hidden flex flex-col justify-between group border border-zinc-800 shadow-lg">
                    <div className="relative z-10">
                        <div className="text-zinc-400 font-bold uppercase text-xs tracking-widest mb-1 flex items-center gap-2">
                            Total Tickets Sold <TicketIcon className="text-[#E0FF20]" size={14} />
                        </div>
                        <div className="text-5xl md:text-6xl font-black tracking-tighter text-white group-hover:scale-105 transition-transform origin-left mt-2">
                            {totalSales}
                        </div>
                    </div>
                    <div className="relative z-10 w-full bg-zinc-800 h-1.5 rounded-full mt-4 overflow-hidden">
                        <div className="bg-[#E0FF20] h-full rounded-full transition-all duration-1000 ease-out" style={{ width: `${Math.min(100, (totalSales / event.capacity) * 100)}%` }}></div>
                    </div>
                    <div className="relative z-10 mt-2 text-xs font-mono text-[#E0FF20] text-right">
                        {Math.round((totalSales / event.capacity) * 100)}% Capacity Reached
                    </div>

                    <div className="absolute top-0 right-0 w-64 h-64 bg-[#E0FF20]/10 rounded-full blur-[80px] pointer-events-none"></div>
                </div>

                {/* Hero Stat: Revenue */}
                <div className="md:col-span-1 lg:col-span-2 p-6 md:p-8 rounded-3xl bg-white dark:bg-black border border-zinc-200 dark:border-zinc-800 flex flex-col justify-between hover:border-green-500 transition-colors shadow-sm">
                    <div>
                        <div className="text-zinc-500 font-bold uppercase text-xs tracking-widest mb-1 flex items-center gap-2">
                            Gross Revenue <DollarSign size={14} />
                        </div>
                        <div className="text-4xl md:text-5xl font-black tracking-tighter text-transparent bg-clip-text bg-gradient-to-br from-green-400 to-emerald-600 mt-2 truncate">
                            ${grossRevenue.toLocaleString()}
                        </div>
                    </div>
                    <div className="flex gap-2 mt-4">
                        <Badge color="green" className="text-[10px]">+12% vs last week</Badge>
                    </div>
                </div>

                {/* Ticket Types Breakdown (Donut) - REQUIRES PRO */}
                <div className="md:col-span-2 row-span-2 rounded-3xl bg-white dark:bg-black border border-zinc-200 dark:border-zinc-800 p-4 md:p-6 relative overflow-hidden flex flex-col">
                    <div className="flex justify-between items-center mb-6">
                        <h3 className="font-bold text-lg flex items-center gap-2">Ticket Mix <TicketIcon size={16} className="text-purple-500" /></h3>
                        {!isPro && <Lock size={16} className="text-zinc-400" />}
                    </div>

                    {/* Content or Blur */}
                    <div className={`flex-1 flex flex-col justify-center items-center relative ${!isPro ? 'filter blur-md opacity-50' : ''}`}>
                        <div className="w-full overflow-x-auto overflow-y-hidden">
                            <DonutChart data={donutData} />
                        </div>
                    </div>

                    {!isPro && (
                        <div className="absolute inset-0 z-20 flex flex-col items-center justify-center bg-white/10 dark:bg-black/10 backdrop-blur-sm">
                            <Button onClick={() => navigate('/pricing')} className="bg-purple-600 hover:bg-purple-700 text-white border-none shadow-xl scale-100 hover:scale-105 transition-transform">
                                <Crown size={16} className="mr-2" /> Unlock Deep Dive
                            </Button>
                        </div>
                    )}
                </div>

                {/* Sales Velocity Chart */}
                <div className="md:col-span-1 lg:col-span-2 row-span-2 rounded-3xl bg-white dark:bg-black border border-zinc-200 dark:border-zinc-800 p-6 relative overflow-hidden">
                    <h3 className="font-bold text-lg mb-6 flex items-center gap-2">Sales Velocity <TrendingUp size={16} className="text-blue-500" /></h3>
                    <div className="h-48 flex items-end justify-between gap-2 overflow-x-auto">
                        {isPro ? (
                            <SimpleChart label="Last 7 Days" data={chartData.slice(-7)} />
                        ) : (
                            <div className="w-full h-full flex items-center justify-center bg-zinc-50 dark:bg-zinc-900 rounded-xl border border-dashed border-zinc-200 dark:border-zinc-800">
                                <div className="text-center">
                                    <BarChart3 className="mx-auto text-zinc-300 mb-2" size={32} />
                                    <p className="text-xs font-bold text-zinc-400">Trend data locked</p>
                                </div>
                            </div>
                        )}
                    </div>
                </div>

                {/* Time Until Event */}
                <div className="md:col-span-1 p-6 rounded-3xl bg-zinc-50 dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 flex flex-col justify-center items-center text-center">
                    <Clock size={32} className="text-zinc-300 mb-2" />
                    <div className="text-xs font-bold uppercase text-zinc-500 mb-1">Days Until Event</div>
                    <div className="text-3xl font-black text-zinc-900 dark:text-white">
                        {Math.max(0, Math.ceil((new Date(event.date).getTime() - Date.now()) / (1000 * 60 * 60 * 24)))}
                    </div>
                </div>

                {/* Check-in Status */}
                <div className="md:col-span-1 p-6 rounded-3xl bg-white dark:bg-black border border-zinc-200 dark:border-zinc-800 flex flex-col justify-between">
                    <div>
                        <div className="text-zinc-500 font-bold uppercase text-xs tracking-widest mb-1 flex items-center gap-2">
                            Check-ins <QrCode size={14} className="text-primary" />
                        </div>
                        <div className="text-3xl font-black text-zinc-900 dark:text-white mt-1">
                            {checkInCount} <span className="text-base text-zinc-400 font-medium">/ {totalTickets}</span>
                        </div>
                    </div>
                    <div>
                        <div className="w-full bg-zinc-100 dark:bg-zinc-800 h-2 rounded-full overflow-hidden mb-2">
                            <div className="bg-primary h-full rounded-full transition-all" style={{ width: `${checkInRate}%` }}></div>
                        </div>
                        <div className="text-xs font-bold text-zinc-500">{checkInRate}% Arrived</div>
                    </div>
                </div>

                {/* Add-ons & Products Section */}
                <div className="md:col-span-2 p-6 rounded-3xl bg-white dark:bg-black border border-zinc-200 dark:border-zinc-800 flex flex-col">
                    <div className="flex justify-between items-center mb-4">
                        <h3 className="font-bold text-lg flex items-center gap-2">
                            Add-ons & Products <ShoppingBag size={16} className="text-purple-500" />
                        </h3>
                        <Badge color="purple" className="text-[10px]">
                            ${totalAddOnRevenue.toLocaleString(undefined, { minimumFractionDigits: 2 })}
                        </Badge>
                    </div>
                    
                    {addOnSummary.length > 0 ? (
                        <div className="space-y-3 flex-1">
                            {addOnSummary.map((addon, idx) => (
                                <div key={idx} className="flex items-center justify-between p-3 bg-zinc-50 dark:bg-zinc-900 rounded-xl">
                                    <div className="flex items-center gap-3">
                                        <div className="w-10 h-10 bg-purple-100 dark:bg-purple-900/30 rounded-xl flex items-center justify-center">
                                            <ShoppingBag size={16} className="text-purple-600" />
                                        </div>
                                        <div>
                                            <div className="font-bold text-sm text-zinc-900 dark:text-white">{addon.name}</div>
                                            <div className="text-xs text-zinc-500">${addon.unitPrice.toFixed(2)} each</div>
                                        </div>
                                    </div>
                                    <div className="text-right">
                                        <div className="font-bold text-zinc-900 dark:text-white">{addon.totalQuantity} sold</div>
                                        <div className="text-xs text-green-600">${addon.totalRevenue.toFixed(2)}</div>
                                    </div>
                                </div>
                            ))}
                        </div>
                    ) : (
                        <div className="flex-1 flex flex-col items-center justify-center text-center py-6">
                            <ShoppingBag size={32} className="text-zinc-300 mb-2" />
                            <p className="text-sm text-zinc-400">No add-ons sold yet</p>
                            <p className="text-xs text-zinc-400 mt-1">Add-ons will appear here when purchased</p>
                        </div>
                    )}
                </div>

                {/* Views Count (Mock) */}
                <div className="md:col-span-1 p-6 rounded-3xl bg-zinc-50 dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 flex flex-col justify-center items-center text-center">
                    <Users size={32} className="text-zinc-300 mb-2" />
                    <div className="text-xs font-bold uppercase text-zinc-500 mb-1">Page Views</div>
                    <div className="text-3xl font-black text-zinc-900 dark:text-white">
                        {isPro ? (1240 + totalSales * 5) : <span className="blur-sm select-none">1240</span>}
                    </div>
                </div>

            </div>
        </div>
    );
};
