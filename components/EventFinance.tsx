
import React, { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { StorageService } from '../services/storageService';
import { Registration, Event, User } from '../types';
import { Button, Card, Badge } from './UI';
import { ArrowLeft, TrendingUp, DollarSign, Wallet, CreditCard, ArrowUpRight, BarChart3, Download, Info } from 'lucide-react';

export const EventFinance = () => {
    const { id } = useParams<{ id: string }>();
    const navigate = useNavigate();
    const [event, setEvent] = useState<Event | null>(null);
    const [currentUser, setCurrentUser] = useState<User | null>(null);
    const [registrations, setRegistrations] = useState<Registration[]>([]);
    const [isLoading, setIsLoading] = useState(true);

    useEffect(() => {
        loadData();
    }, [id]);

    const loadData = async () => {
        if (!id) return;
        const [evt, regs, user] = await Promise.all([
            StorageService.getEventById(id),
            StorageService.getRegistrations(),
            StorageService.getCurrentUser()
        ]);

        if (evt) setEvent(evt);
        if (user) setCurrentUser(user);
        setRegistrations(regs.filter(r => r.eventId === id && r.paymentStatus !== 'refunded'));
        setIsLoading(false);
    };

    // Calculations
    const totalGross = registrations.reduce((sum, reg) => {
        const ticketTotal = reg.tickets?.reduce((s, t) => s + (t.pricePerTicket * t.quantity), 0) || 0;
        const addOnTotal = reg.addOns?.reduce((s, a) => s + (a.price * a.quantity), 0) || 0;
        return sum + ticketTotal + addOnTotal + (reg.donationAmount || 0);
    }, 0);

    const totalFees = registrations.reduce((sum, reg) => sum + (reg.serviceFee || 0) + (reg.stripeFee || 0), 0);
    const totalNet = totalGross - totalFees;

    if (isLoading) return <div className="p-8 text-center"><div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary mx-auto"></div></div>;

    const hasPayoutMethod = currentUser?.stripeConnectId || currentUser?.payoutSettings?.instantCard;

    return (
        <div className="max-w-6xl mx-auto py-8 px-4 pb-24">
            <div className="flex items-center justify-between mb-8">
                <button onClick={() => navigate(`/manage/${id}`)} className="text-zinc-500 hover:text-zinc-900 dark:hover:text-white flex items-center text-sm font-bold transition-colors">
                    <ArrowLeft size={16} className="mr-2" /> Back to Dashboard
                </button>
            </div>

            <div className="flex flex-col md:flex-row md:items-center justify-between gap-6 mb-8">
                <div>
                    <h1 className="text-3xl font-black text-zinc-900 dark:text-white uppercase tracking-tight flex items-center gap-3">
                        <TrendingUp className="text-primary" size={32} /> Finance & Payouts
                    </h1>
                    <p className="text-zinc-500">{event?.title} • Financial Insights</p>
                </div>
                <div className="flex gap-2">
                    <Button variant="outline" size="sm" onClick={() => window.print()}>
                        <Download size={16} className="mr-2" /> Export Report
                    </Button>
                </div>
            </div>

            {/* Stats Overview */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-8">
                <Card className="p-6 bg-gradient-to-br from-zinc-50 to-white dark:from-zinc-900 dark:to-zinc-950 border-zinc-200 dark:border-zinc-800">
                    <div className="flex justify-between items-start mb-4">
                        <div className="p-2 bg-zinc-100 dark:bg-zinc-800 rounded-lg text-zinc-400">
                            <DollarSign size={20} />
                        </div>
                    </div>
                    <div className="text-3xl font-black text-zinc-900 dark:text-white mb-1">${totalGross.toFixed(2)}</div>
                    <div className="text-xs font-bold text-zinc-500 uppercase">Gross Revenue</div>
                </Card>

                <Card className="p-6 bg-gradient-to-br from-zinc-50 to-white dark:from-zinc-900 dark:to-zinc-950 border-zinc-200 dark:border-zinc-800">
                    <div className="flex justify-between items-start mb-4">
                        <div className="p-2 bg-red-500/10 rounded-lg text-red-500">
                            <ArrowUpRight size={20} />
                        </div>
                    </div>
                    <div className="text-3xl font-black text-red-500 mb-1">-${totalFees.toFixed(2)}</div>
                    <div className="text-xs font-bold text-zinc-500 uppercase">Fees & Processing</div>
                </Card>

                <Card className="p-6 bg-zinc-900 text-white dark:bg-primary dark:text-black border-none ring-4 ring-primary/20">
                    <div className="flex justify-between items-start mb-4">
                        <div className="p-2 bg-white/10 dark:bg-black/10 rounded-lg">
                            <Wallet size={20} />
                        </div>
                    </div>
                    <div className="text-3xl font-black mb-1">${totalNet.toFixed(2)}</div>
                    <div className="text-xs font-bold opacity-60 uppercase">Net Earnings</div>
                </Card>
            </div>

            {!hasPayoutMethod && (
                <div className="bg-red-500/10 border border-red-500/50 p-6 rounded-2xl mb-8 flex flex-col md:flex-row items-center justify-between gap-4">
                    <div className="flex items-center gap-4">
                        <div className="p-3 bg-red-500 rounded-full text-white">
                            <CreditCard size={24} />
                        </div>
                        <div>
                            <h3 className="font-bold text-red-500 uppercase">Payout Method Missing</h3>
                            <p className="text-sm text-zinc-500">You must connect a bank account to receive your earnings.</p>
                        </div>
                    </div>
                    <Button onClick={() => navigate('/billing')} className="bg-red-500 hover:bg-red-600 border-none text-white whitespace-nowrap">
                        Connect Bank
                    </Button>
                </div>
            )}

            <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
                <Card className="p-6 border-zinc-200 dark:border-zinc-800">
                    <h3 className="text-lg font-bold mb-6 flex items-center gap-2">
                        <BarChart3 size={20} className="text-primary" /> Revenue Breakdown
                    </h3>
                    <div className="space-y-4">
                        <div className="flex justify-between items-center p-3 bg-zinc-50 dark:bg-zinc-900 rounded-xl">
                            <span className="text-sm font-bold">Ticket Sales</span>
                            <span className="font-mono">${(totalGross - registrations.reduce((s, r) => s + (r.addOns?.reduce((s2, a) => s2 + a.price * a.quantity, 0) || 0) + (r.donationAmount || 0), 0)).toFixed(2)}</span>
                        </div>
                        <div className="flex justify-between items-center p-3 bg-zinc-50 dark:bg-zinc-900 rounded-xl">
                            <span className="text-sm font-bold">Add-on Sales</span>
                            <span className="font-mono">${registrations.reduce((s, r) => s + (r.addOns?.reduce((s2, a) => s2 + a.price * a.quantity, 0) || 0), 0).toFixed(2)}</span>
                        </div>
                        <div className="flex justify-between items-center p-3 bg-zinc-50 dark:bg-zinc-900 rounded-xl">
                            <span className="text-sm font-bold">Donations</span>
                            <span className="font-mono">${registrations.reduce((s, r) => s + (r.donationAmount || 0), 0).toFixed(2)}</span>
                        </div>
                        <div className="mt-6 pt-6 border-t border-zinc-200 dark:border-zinc-800">
                            <div className="flex justify-between items-center">
                                <div className="flex items-center gap-2">
                                    <span className="text-sm font-bold uppercase text-zinc-500">Stripe Processing (2.9% + 30¢)</span>
                                    <Info size={12} className="text-zinc-400" />
                                </div>
                                <span className="font-mono text-red-500">-${registrations.reduce((s, r) => s + (r.stripeFee || 0), 0).toFixed(2)}</span>
                            </div>
                        </div>
                    </div>
                </Card>

                <Card className="p-6 border-zinc-200 dark:border-zinc-800">
                    <h3 className="text-lg font-bold mb-6 flex items-center gap-2">
                        <Wallet size={20} className="text-primary" /> Payout Status
                    </h3>
                    <div className="text-center py-12">
                        <div className="w-16 h-16 bg-zinc-100 dark:bg-zinc-800 rounded-full flex items-center justify-center mx-auto mb-4 text-zinc-400">
                            <CreditCard size={32} />
                        </div>
                        <h4 className="font-bold mb-2">No active payouts</h4>
                        <p className="text-sm text-zinc-500 max-w-xs mx-auto">Payouts are usually processed 2-3 business days after an order is completed.</p>
                        <Button variant="ghost" className="mt-4 text-xs font-bold uppercase text-primary" onClick={() => navigate('/billing')}>
                            View Payout Schedule
                        </Button>
                    </div>
                </Card>
            </div>
        </div>
    );
};
