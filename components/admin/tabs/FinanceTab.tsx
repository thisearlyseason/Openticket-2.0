/**
 * FinanceTab - Financial Overview for Super Admin Dashboard
 * Extracted from SuperAdminDashboard.tsx for maintainability
 */
import React from 'react';
import { DollarSign, Download, TrendingUp, Users, CreditCard, Building2, Wallet } from 'lucide-react';
import { Button } from '../../UI';

interface FinancialTransaction {
    id: string;
    gross_amount: number;
    platform_fee: number;
    stripe_fee: number;
    organizer_net: number;
    affiliate_code?: string;
    affiliate_commission?: number;
    stripe_session_id?: string;
    event_id?: string;
    created_at: string;
    registration?: {
        attendee_name: string;
        attendee_email: string;
    };
    event?: {
        title: string;
        owner_id: string;
    };
}

interface OrganizerBreakdown {
    organizerId: string;
    organizerName: string;
    organizerEmail: string;
    totalVolume: number;
    platformFees: number;
    netEarnings: number;
    transactionCount: number;
}

interface FilteredFinanceStats {
    totalVolume: number;
    platformFees: number;
    stripeFees: number;
    affiliateCommissions: number;
    organizerPayouts: number;
    transactionCount: number;
    avgTicketPrice: number;
    organizerBreakdown: OrganizerBreakdown[];
}

interface FinanceTabProps {
    financeDateRange: '30d' | '60d' | '90d' | 'all' | 'custom';
    setFinanceDateRange: (range: '30d' | '60d' | '90d' | 'all' | 'custom') => void;
    financeCustomStart: string;
    setFinanceCustomStart: (date: string) => void;
    financeCustomEnd: string;
    setFinanceCustomEnd: (date: string) => void;
    getDateRangeLabel: () => string;
    filteredFinanceStats: FilteredFinanceStats;
    financialTransactions: FinancialTransaction[];
    exportFinancialsCSV: () => void;
    stats: {
        subscriptionRevenue: number;
        monthlyRecurring: number;
        yearlyRecurring: number;
        pendingPayouts: number;
        refunds: { total: number; count: number };
        tips: {
            total: number;
            count: number;
            byAmount: Record<string, number>;
            recent: any[];
            thisMonth: number;
            lastMonth: number;
        };
    };
    subscriptions: any[];
    showPayoutModal: boolean;
    setShowPayoutModal: (show: boolean) => void;
    payoutType: 'platform_fees' | 'subscriptions' | 'combined';
    setPayoutType: (type: 'platform_fees' | 'subscriptions' | 'combined') => void;
    platformPayoutNotes: string;
    setPlatformPayoutNotes: (notes: string) => void;
    isProcessingPlatformPayout: boolean;
    handlePlatformPayout: () => void;
    pendingPayoutSummary: any;
    platformPayouts: any[];
}

const StatCard = ({ icon: Icon, title, value, subtitle, color = 'text-[#E0FF20]' }: { 
    icon: any; 
    title: string; 
    value: string | number; 
    subtitle?: string;
    color?: string;
}) => (
    <div className="bg-zinc-800/50 rounded-2xl p-5 border border-zinc-700">
        <div className="flex items-center gap-3 mb-3">
            <div className={`w-10 h-10 rounded-xl ${color.includes('#E0FF20') ? 'bg-[#E0FF20]/20' : 'bg-zinc-700'} flex items-center justify-center`}>
                <Icon size={20} className={color} />
            </div>
            <span className="text-sm text-zinc-400">{title}</span>
        </div>
        <p className="text-2xl font-black text-white">{typeof value === 'number' ? `$${value.toFixed(2)}` : value}</p>
        {subtitle && <p className="text-xs text-zinc-500 mt-1">{subtitle}</p>}
    </div>
);

export const FinanceTab: React.FC<FinanceTabProps> = ({
    financeDateRange,
    setFinanceDateRange,
    financeCustomStart,
    setFinanceCustomStart,
    financeCustomEnd,
    setFinanceCustomEnd,
    getDateRangeLabel,
    filteredFinanceStats,
    financialTransactions,
    exportFinancialsCSV,
    stats,
    subscriptions,
    showPayoutModal,
    setShowPayoutModal,
    payoutType,
    setPayoutType,
    platformPayoutNotes,
    setPlatformPayoutNotes,
    isProcessingPlatformPayout,
    handlePlatformPayout,
    pendingPayoutSummary,
    platformPayouts
}) => {
    return (
        <div className="p-8">
            {/* Header with Date Range Filter */}
            <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4 mb-6">
                <h2 className="text-xl font-bold text-white flex items-center gap-2">
                    <DollarSign size={24} className="text-[#E0FF20]" /> Financial Overview
                </h2>
                
                <div className="flex flex-wrap items-center gap-2">
                    <span className="text-xs text-zinc-500 mr-2">Period:</span>
                    {[
                        { value: '30d', label: '30 Days' },
                        { value: '60d', label: '60 Days' },
                        { value: '90d', label: '90 Days' },
                        { value: 'all', label: 'All Time' },
                    ].map(opt => (
                        <button
                            key={opt.value}
                            onClick={() => setFinanceDateRange(opt.value as any)}
                            className={`px-3 py-1.5 text-xs font-bold rounded-lg transition-all ${
                                financeDateRange === opt.value
                                    ? 'bg-[#E0FF20] text-black'
                                    : 'bg-zinc-800 text-zinc-400 hover:bg-zinc-700'
                            }`}
                        >
                            {opt.label}
                        </button>
                    ))}
                    <button
                        onClick={() => setFinanceDateRange('custom')}
                        className={`px-3 py-1.5 text-xs font-bold rounded-lg transition-all ${
                            financeDateRange === 'custom'
                                ? 'bg-[#E0FF20] text-black'
                                : 'bg-zinc-800 text-zinc-400 hover:bg-zinc-700'
                        }`}
                    >
                        Custom
                    </button>
                    <Button size="sm" onClick={exportFinancialsCSV} className="ml-2">
                        <Download size={14} className="mr-2" /> Export CSV
                    </Button>
                </div>
            </div>

            {/* Custom Date Range Inputs */}
            {financeDateRange === 'custom' && (
                <div className="flex flex-wrap items-center gap-3 mb-6 p-4 bg-zinc-800/50 rounded-xl border border-zinc-700">
                    <div className="flex items-center gap-2">
                        <label className="text-xs text-zinc-400">From:</label>
                        <input
                            type="date"
                            value={financeCustomStart}
                            onChange={e => setFinanceCustomStart(e.target.value)}
                            className="bg-black border border-zinc-700 rounded-lg px-3 py-2 text-white text-sm"
                        />
                    </div>
                    <div className="flex items-center gap-2">
                        <label className="text-xs text-zinc-400">To:</label>
                        <input
                            type="date"
                            value={financeCustomEnd}
                            onChange={e => setFinanceCustomEnd(e.target.value)}
                            className="bg-black border border-zinc-700 rounded-lg px-3 py-2 text-white text-sm"
                        />
                    </div>
                </div>
            )}

            {/* Date Range Indicator */}
            <div className="mb-4 text-sm text-zinc-400">
                Showing data for: <span className="text-white font-medium">{getDateRangeLabel()}</span>
                {financeDateRange !== 'all' && (
                    <span className="ml-2 text-zinc-500">({filteredFinanceStats.transactionCount} transactions)</span>
                )}
            </div>

            {/* Stats Grid */}
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-8">
                <StatCard
                    icon={DollarSign}
                    title="Total Volume"
                    value={filteredFinanceStats.totalVolume}
                    subtitle={`${filteredFinanceStats.transactionCount} transactions`}
                />
                <StatCard
                    icon={TrendingUp}
                    title="Platform Fees"
                    value={filteredFinanceStats.platformFees}
                    subtitle="Commission earned"
                    color="text-green-400"
                />
                <StatCard
                    icon={CreditCard}
                    title="Stripe Fees"
                    value={filteredFinanceStats.stripeFees}
                    subtitle="Payment processing"
                    color="text-purple-400"
                />
                <StatCard
                    icon={Users}
                    title="Affiliate Payouts"
                    value={filteredFinanceStats.affiliateCommissions}
                    subtitle="Commission paid"
                    color="text-orange-400"
                />
            </div>

            {/* Subscription Revenue Section */}
            <div className="mb-8">
                <h3 className="text-lg font-bold text-white mb-4 flex items-center gap-2">
                    <Building2 size={20} className="text-purple-400" /> Subscription Revenue
                </h3>
                <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                    <StatCard
                        icon={Wallet}
                        title="Total Subscription Revenue"
                        value={stats.subscriptionRevenue}
                        color="text-purple-400"
                    />
                    <StatCard
                        icon={TrendingUp}
                        title="Monthly Recurring"
                        value={stats.monthlyRecurring}
                        subtitle="Active monthly plans"
                        color="text-blue-400"
                    />
                    <StatCard
                        icon={TrendingUp}
                        title="Yearly Recurring"
                        value={stats.yearlyRecurring}
                        subtitle="Active yearly plans"
                        color="text-green-400"
                    />
                    <StatCard
                        icon={DollarSign}
                        title="Active Subscribers"
                        value={subscriptions.length.toString()}
                        subtitle="Paid plans"
                        color="text-[#E0FF20]"
                    />
                </div>
            </div>

            {/* Tips Section */}
            {stats.tips.total > 0 && (
                <div className="mb-8 bg-gradient-to-r from-amber-900/30 to-amber-800/20 rounded-2xl p-6 border border-amber-700/50">
                    <h3 className="text-lg font-bold text-white mb-4 flex items-center gap-2">
                        ❤️ Tips & Donations
                    </h3>
                    <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-4">
                        <div className="text-center">
                            <p className="text-2xl font-black text-amber-400">${stats.tips.total.toFixed(2)}</p>
                            <p className="text-xs text-zinc-400">Total Tips</p>
                        </div>
                        <div className="text-center">
                            <p className="text-2xl font-black text-white">{stats.tips.count}</p>
                            <p className="text-xs text-zinc-400">Tip Count</p>
                        </div>
                        <div className="text-center">
                            <p className="text-2xl font-black text-green-400">${stats.tips.thisMonth.toFixed(2)}</p>
                            <p className="text-xs text-zinc-400">This Month</p>
                        </div>
                        <div className="text-center">
                            <p className="text-2xl font-black text-zinc-400">${stats.tips.lastMonth.toFixed(2)}</p>
                            <p className="text-xs text-zinc-400">Last Month</p>
                        </div>
                    </div>
                    
                    {/* Tip Distribution */}
                    <div className="flex flex-wrap gap-2 mt-4">
                        {Object.entries(stats.tips.byAmount).map(([amount, count]) => (
                            <div key={amount} className="bg-black/30 rounded-lg px-3 py-2 text-center">
                                <p className="text-white font-bold">{amount}</p>
                                <p className="text-xs text-zinc-500">{count} tips</p>
                            </div>
                        ))}
                    </div>
                </div>
            )}

            {/* Organizer Breakdown */}
            <div className="mb-8">
                <h3 className="text-lg font-bold text-white mb-4">Revenue by Organizer</h3>
                <div className="bg-zinc-800/50 rounded-xl border border-zinc-700 overflow-hidden">
                    <div className="overflow-x-auto">
                        <table className="w-full">
                            <thead>
                                <tr className="border-b border-zinc-700">
                                    <th className="text-left p-4 text-xs text-zinc-400 font-medium">Organizer</th>
                                    <th className="text-right p-4 text-xs text-zinc-400 font-medium">Volume</th>
                                    <th className="text-right p-4 text-xs text-zinc-400 font-medium">Platform Fees</th>
                                    <th className="text-right p-4 text-xs text-zinc-400 font-medium">Net Earnings</th>
                                    <th className="text-right p-4 text-xs text-zinc-400 font-medium">Transactions</th>
                                </tr>
                            </thead>
                            <tbody>
                                {filteredFinanceStats.organizerBreakdown.slice(0, 10).map((org) => (
                                    <tr key={org.organizerId} className="border-b border-zinc-800 hover:bg-zinc-800/30">
                                        <td className="p-4">
                                            <p className="font-medium text-white">{org.organizerName || 'Unknown'}</p>
                                            <p className="text-xs text-zinc-500">{org.organizerEmail}</p>
                                        </td>
                                        <td className="p-4 text-right text-white font-medium">${org.totalVolume.toFixed(2)}</td>
                                        <td className="p-4 text-right text-green-400">${org.platformFees.toFixed(2)}</td>
                                        <td className="p-4 text-right text-[#E0FF20]">${org.netEarnings.toFixed(2)}</td>
                                        <td className="p-4 text-right text-zinc-400">{org.transactionCount}</td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>
                </div>
            </div>

            {/* Platform Payout Button */}
            <div className="flex justify-end">
                <Button onClick={() => setShowPayoutModal(true)} className="bg-green-600 hover:bg-green-700">
                    <Wallet size={16} className="mr-2" /> Record Platform Payout
                </Button>
            </div>

            {/* Payout Modal */}
            {showPayoutModal && (
                <div className="fixed inset-0 bg-black/80 flex items-center justify-center z-50 p-4">
                    <div className="bg-zinc-900 rounded-2xl p-6 max-w-lg w-full border border-zinc-700">
                        <h3 className="text-xl font-bold text-white mb-4">Record Platform Payout</h3>
                        
                        <div className="space-y-4">
                            <div>
                                <label className="text-sm text-zinc-400 block mb-2">Payout Type</label>
                                <select
                                    value={payoutType}
                                    onChange={(e) => setPayoutType(e.target.value as any)}
                                    className="w-full bg-black border border-zinc-700 rounded-xl px-4 py-3 text-white"
                                >
                                    <option value="platform_fees">Platform Fees Only</option>
                                    <option value="subscriptions">Subscriptions Only</option>
                                    <option value="combined">Combined</option>
                                </select>
                            </div>
                            
                            {pendingPayoutSummary && (
                                <div className="bg-zinc-800 rounded-xl p-4">
                                    <p className="text-sm text-zinc-400 mb-2">Pending Amount:</p>
                                    <p className="text-2xl font-black text-[#E0FF20]">
                                        ${(
                                            payoutType === 'platform_fees' ? pendingPayoutSummary.platformFees :
                                            payoutType === 'subscriptions' ? pendingPayoutSummary.subscriptions :
                                            pendingPayoutSummary.total
                                        ).toFixed(2)}
                                    </p>
                                </div>
                            )}
                            
                            <div>
                                <label className="text-sm text-zinc-400 block mb-2">Notes</label>
                                <textarea
                                    value={platformPayoutNotes}
                                    onChange={(e) => setPlatformPayoutNotes(e.target.value)}
                                    placeholder="Optional notes about this payout..."
                                    className="w-full bg-black border border-zinc-700 rounded-xl px-4 py-3 text-white resize-none h-24"
                                />
                            </div>
                            
                            <div className="flex gap-3">
                                <Button
                                    onClick={() => setShowPayoutModal(false)}
                                    variant="outline"
                                    className="flex-1"
                                >
                                    Cancel
                                </Button>
                                <Button
                                    onClick={handlePlatformPayout}
                                    isLoading={isProcessingPlatformPayout}
                                    className="flex-1 bg-green-600 hover:bg-green-700"
                                >
                                    Record Payout
                                </Button>
                            </div>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
};

export default FinanceTab;
