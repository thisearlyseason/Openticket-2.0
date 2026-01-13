import React, { useState, useEffect } from 'react';
import { Shield, RefreshCw, AlertTriangle, Clock, CheckCircle2, Eye } from 'lucide-react';
import { Card, Badge, Button, Select } from '../../UI';
import { safeMap } from '../../../utils/safeMap';

interface SecurityTabProps {
    activeTab: string;
}

interface SuspiciousActivity {
    id: string;
    action: string;
    severity: 'info' | 'warning' | 'critical';
    user_email: string;
    user_id: string;
    entity_type: string;
    entity_id: string;
    details: any;
    created_at: string;
}

export const SecurityTab: React.FC<SecurityTabProps> = ({ activeTab }) => {
    const [suspiciousActivities, setSuspiciousActivities] = useState<SuspiciousActivity[]>([]);
    const [loadingSuspicious, setLoadingSuspicious] = useState(false);
    const [suspiciousSeverityFilter, setSuspiciousSeverityFilter] = useState<'all' | 'info' | 'warning' | 'critical'>('all');

    const loadSuspiciousActivities = async () => {
        setLoadingSuspicious(true);
        try {
            const { getAuthToken } = await import('../../../services/firebaseConfig');
            const token = await getAuthToken();
            const severityParam = suspiciousSeverityFilter !== 'all' ? `?severity=${suspiciousSeverityFilter}` : '';
            const response = await fetch(`/api/admin/security-audit-logs/suspicious${severityParam}`, {
                headers: {
                    'Authorization': `Bearer ${token}`
                }
            });

            if (response.ok) {
                const data = await response.json();
                // Ensure we ALWAYS set an array, never undefined/null
                const logs = Array.isArray(data?.logs) ? data.logs : [];
                console.log('[SecurityTab] Setting suspiciousActivities:', logs);
                setSuspiciousActivities(logs);
            } else {
                console.error('Failed to load suspicious activities:', await response.text());
                setSuspiciousActivities([]);
            }
        } catch (error) {
            console.error('Error loading suspicious activities:', error);
            setSuspiciousActivities([]);
        } finally {
            setLoadingSuspicious(false);
        }
    };

    useEffect(() => {
        if (activeTab === 'security') {
            console.log('[SecurityTab] Tab active, loading data...');
            loadSuspiciousActivities().catch(console.error);
        }
    }, [activeTab, suspiciousSeverityFilter]);

    // Safety check - don't render if not on security tab
    if (activeTab !== 'security') {
        return null;
    }

    // Extra safety: ensure suspiciousActivities is always an array
    const safeActivities = Array.isArray(suspiciousActivities) ? suspiciousActivities : [];
    console.log('[SecurityTab] Rendering with safeActivities:', safeActivities.length, 'items');

    return (
        <div className="p-8">
            <div className="flex justify-between items-center mb-6">
                <div>
                    <h2 className="text-2xl font-bold text-white mb-2 flex items-center gap-2">
                        <Shield size={28} className="text-red-500" /> Security & Fraud Detection
                    </h2>
                    <p className="text-zinc-400 text-sm">Monitor suspicious ticket transfer activities and fraud attempts</p>
                </div>
                <div className="flex gap-4 items-center">
                    <Select
                        value={suspiciousSeverityFilter}
                        onChange={(e) => setSuspiciousSeverityFilter(e.target.value as any)}
                        className="bg-zinc-900 border-zinc-800"
                    >
                        <option value="all">All Severity</option>
                        <option value="info">Info</option>
                        <option value="warning">Warning</option>
                        <option value="critical">Critical</option>
                    </Select>
                    <Button
                        onClick={loadSuspiciousActivities}
                        size="sm"
                        className="bg-red-600 hover:bg-red-700 border-none"
                    >
                        <RefreshCw size={16} className="mr-2" /> Refresh
                    </Button>
                </div>
            </div>

            {/* Summary Cards */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
                <Card className="p-6 bg-zinc-900 border-zinc-800">
                    <div className="flex items-center justify-between mb-2">
                        <span className="text-sm text-zinc-500">Total Suspicious Events</span>
                        <AlertTriangle className="text-yellow-500" size={20} />
                    </div>
                    <div className="text-3xl font-bold text-white">
                        {safeActivities.length}
                    </div>
                </Card>
                <Card className="p-6 bg-zinc-900 border-zinc-800">
                    <div className="flex items-center justify-between mb-2">
                        <span className="text-sm text-zinc-500">Rate Limit Violations</span>
                        <Clock className="text-orange-500" size={20} />
                    </div>
                    <div className="text-3xl font-bold text-white">
                        {safeActivities.filter(a => a.action === 'SUSPICIOUS_TRANSFER_RATE').length}
                    </div>
                </Card>
                <Card className="p-6 bg-zinc-900 border-zinc-800">
                    <div className="flex items-center justify-between mb-2">
                        <span className="text-sm text-zinc-500">Circular Transfers</span>
                        <RefreshCw className="text-red-500" size={20} />
                    </div>
                    <div className="text-3xl font-bold text-white">
                        {safeActivities.filter(a => a.action === 'SUSPICIOUS_CIRCULAR_TRANSFER').length}
                    </div>
                </Card>
            </div>

            {/* Suspicious Activities Table */}
            <Card className="bg-zinc-900 border-zinc-800 overflow-hidden">
                <div className="overflow-x-auto">
                    <table className="w-full">
                        <thead className="bg-black text-left">
                            <tr>
                                <th className="p-4 text-xs text-zinc-500 uppercase font-bold">Timestamp</th>
                                <th className="p-4 text-xs text-zinc-500 uppercase font-bold">Action</th>
                                <th className="p-4 text-xs text-zinc-500 uppercase font-bold">Severity</th>
                                <th className="p-4 text-xs text-zinc-500 uppercase font-bold">User</th>
                                <th className="p-4 text-xs text-zinc-500 uppercase font-bold">Entity</th>
                                <th className="p-4 text-xs text-zinc-500 uppercase font-bold">Details</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-zinc-800">
                            {loadingSuspicious ? (
                                <tr>
                                    <td colSpan={6} className="p-8 text-center text-zinc-500">
                                        <RefreshCw className="animate-spin mx-auto mb-2" size={24} />
                                        <div>Loading suspicious activities...</div>
                                    </td>
                                </tr>
                            ) : safeActivities.length === 0 ? (
                                <tr>
                                    <td colSpan={6} className="p-8 text-center text-zinc-500">
                                        <CheckCircle2 className="mx-auto mb-2 text-green-500" size={32} />
                                        <div className="text-lg font-bold text-white">No Suspicious Activity Detected</div>
                                        <div className="text-sm mt-1">All ticket transfers are within normal parameters</div>
                                    </td>
                                </tr>
                            ) : (
                                safeMap(safeActivities, "SecurityTab:safeActivities", (activity) => (
                                    <tr key={activity.id} className="hover:bg-zinc-800/50 transition-colors">
                                        <td className="p-4 text-sm text-zinc-400">
                                            {new Date(activity.created_at).toLocaleString()}
                                        </td>
                                        <td className="p-4">
                                            <div className="flex items-center gap-2">
                                                {activity.action === 'SUSPICIOUS_TRANSFER_RATE' && (
                                                    <Clock size={16} className="text-orange-500" />
                                                )}
                                                {activity.action === 'SUSPICIOUS_CIRCULAR_TRANSFER' && (
                                                    <RefreshCw size={16} className="text-red-500" />
                                                )}
                                                <span className="text-sm font-medium text-white">
                                                    {activity.action.replace('SUSPICIOUS_', '').replace(/_/g, ' ')}
                                                </span>
                                            </div>
                                        </td>
                                        <td className="p-4">
                                            <Badge
                                                className={
                                                    activity.severity === 'critical'
                                                        ? 'bg-red-600 text-white'
                                                        : activity.severity === 'warning'
                                                        ? 'bg-orange-600 text-white'
                                                        : 'bg-blue-600 text-white'
                                                }
                                            >
                                                {activity.severity?.toUpperCase() || 'INFO'}
                                            </Badge>
                                        </td>
                                        <td className="p-4">
                                            <div className="text-sm text-white font-mono">
                                                {activity.user_email || 'Unknown'}
                                            </div>
                                            <div className="text-xs text-zinc-500 truncate max-w-[150px]">
                                                {activity.user_id}
                                            </div>
                                        </td>
                                        <td className="p-4">
                                            <div className="text-sm text-zinc-300">
                                                {activity.entity_type}: {activity.entity_id}
                                            </div>
                                        </td>
                                        <td className="p-4">
                                            <details className="text-xs">
                                                <summary className="cursor-pointer text-[#E0FF20] hover:text-[#d4f542]">
                                                    View Details
                                                </summary>
                                                <pre className="mt-2 p-2 bg-black rounded text-zinc-400 overflow-auto max-w-md">
                                                    {JSON.stringify(activity.details, null, 2)}
                                                </pre>
                                            </details>
                                        </td>
                                    </tr>
                                ))
                            )}
                        </tbody>
                    </table>
                </div>
            </Card>

            {/* Additional Info */}
            <Card className="mt-6 p-6 bg-zinc-900 border-zinc-800 border-l-4 border-l-blue-500">
                <h3 className="text-lg font-bold text-white mb-3 flex items-center gap-2">
                    <Eye size={20} className="text-blue-500" /> Fraud Detection Rules
                </h3>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-sm text-zinc-300">
                    <div>
                        <div className="font-bold text-white mb-1">🚦 Rate Limiting</div>
                        <div className="text-zinc-400">
                            Maximum 5 transfer attempts per ticket within 1 hour. Exceeding this triggers a warning and blocks further transfers.
                        </div>
                    </div>
                    <div>
                        <div className="font-bold text-white mb-1">🔄 Circular Transfer Detection</div>
                        <div className="text-zinc-400">
                            Prevents A→B→A transfers within 24 hours. System detects and blocks attempts to return tickets to the original owner.
                        </div>
                    </div>
                </div>
            </Card>
        </div>
    );
};

export default SecurityTab;
