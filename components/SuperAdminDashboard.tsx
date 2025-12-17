
import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { StorageService } from '../services/storageService';
import { User, Event, Registration, Invoice } from '../types';
import { Card, Button, Badge, Input, RichTextarea, Tooltip } from './UI';
import { Users, Ticket, DollarSign, Search, Shield, Lock, Trash2, Megaphone, Send, Ban, CheckCircle, ExternalLink, RefreshCw, XCircle, AlertTriangle, EyeOff, CheckCircle2, Settings, CreditCard, Crown, TrendingUp } from 'lucide-react';

export const SuperAdminDashboard = () => {
    const navigate = useNavigate();
    const [users, setUsers] = useState<User[]>([]);
    const [events, setEvents] = useState<Event[]>([]);
    const [registrations, setRegistrations] = useState<Registration[]>([]);
    const [stats, setStats] = useState({ 
        ticketRevenue: 0, 
        subscriptionRevenue: 0, 
        totalRevenue: 0,
        pendingPayouts: 0 
    });
    const [searchTerm, setSearchTerm] = useState('');
    const [activeTab, setActiveTab] = useState<'users' | 'events' | 'finance' | 'broadcast' | 'settings'>('users');
    const [unauthorized, setUnauthorized] = useState(false);
    
    // Broadcast State
    const [broadcastMsg, setBroadcastMsg] = useState('');
    const [activeNotification, setActiveNotification] = useState<any>(null);

    // Platform Settings State
    const [platformStripeId, setPlatformStripeId] = useState('');

    const currentUser = StorageService.getCurrentUser();

    useEffect(() => {
        if (!currentUser || !currentUser.isAdmin) {
            setUnauthorized(true);
            return;
        }
        setPlatformStripeId(currentUser.stripeConnectId || '');
        refreshData();
    }, [navigate]);

    const refreshData = async () => {
        try {
            // Safely parse users from local storage to get invoices
            let allUsers: User[] = [];
            try {
                const rawUsers = localStorage.getItem('openticket_users_data');
                const parsed = rawUsers ? JSON.parse(rawUsers) : [];
                if (Array.isArray(parsed)) allUsers = parsed;
            } catch (e) {
                console.warn("Failed to parse users", e);
            }

            const allEvents = await StorageService.getEvents() || [];
            const allRegs = await StorageService.getRegistrations() || [];

            setUsers(allUsers);
            setEvents(allEvents);
            setRegistrations(allRegs);

            const ticketRevenue = allRegs.reduce((acc: number, reg: Registration) => {
                return acc + (reg.stripeFee || reg.serviceFee || 0);
            }, 0);

            const subscriptionRevenue = allUsers.reduce((acc: number, user: User) => {
                const userSubInvoices = user.invoices?.filter(inv => inv.type === 'subscription' && inv.status === 'paid') || [];
                const userTotal = userSubInvoices.reduce((sum, inv) => sum + inv.amount, 0);
                return acc + userTotal;
            }, 0);

            const pending = allUsers.reduce((acc: number, u: User) => acc + (u.availablePayout || 0), 0);

            setStats({ 
                ticketRevenue, 
                subscriptionRevenue, 
                totalRevenue: ticketRevenue + subscriptionRevenue,
                pendingPayouts: pending 
            });
            
            try {
                setActiveNotification(StorageService.getSystemNotification());
            } catch (e) { console.error(e); }

        } catch (e) {
            console.error("Dashboard Refresh Error", e);
        }
    };

    const handleSendBroadcast = () => {
        if (!broadcastMsg.trim()) return;
        StorageService.setSystemNotification(broadcastMsg, 'info');
        setBroadcastMsg('');
        refreshData();
        alert("Broadcast sent to all users!");
    };

    const handleClearBroadcast = () => {
        StorageService.clearSystemNotification();
        refreshData();
    };

    const handleToggleBan = (user: User) => {
        if (user.isAdmin) return; 
        const confirmMsg = user.isBanned 
            ? `Re-activate ${user.name}?` 
            : `Are you sure you want to BAN ${user.name}? They will be unable to login.`;
            
        if (confirm(confirmMsg)) {
            StorageService.updateUser(user.id, { isBanned: !user.isBanned });
            refreshData();
        }
    };

    const handleDeleteEvent = (event: Event) => {
        if (confirm(`Delete "${event.title}"? This cannot be undone.`)) {
            StorageService.deleteEvent(event.id);
            refreshData();
        }
    };

    const handleApproveEvent = (event: Event) => {
        StorageService.saveEvent({ ...event, moderationStatus: 'approved', moderationReason: undefined });
        refreshData();
    };

    const handleRejectEvent = (event: Event) => {
        if (confirm(`Reject "${event.title}"? This will hide the event from the public and mark it as rejected.`)) {
            StorageService.saveEvent({ ...event, moderationStatus: 'rejected', visibility: 'hidden' });
            refreshData();
        }
    };

    const handleSavePlatformSettings = async () => {
        if (!currentUser) return;
        await StorageService.updateUser(currentUser.id, { stripeConnectId: platformStripeId });
        alert("Platform settings saved successfully.");
    };

    if (unauthorized) {
        return (
            <div className="min-h-[60vh] flex flex-col items-center justify-center p-4">
                <div className="bg-red-500/10 p-8 rounded-3xl border border-red-500/20 text-center max-w-md">
                    <div className="w-16 h-16 bg-red-500/20 text-red-500 rounded-full flex items-center justify-center mx-auto mb-4">
                        <Lock size={32} />
                    </div>
                    <h1 className="text-2xl font-black text-red-500 mb-2">Access Denied</h1>
                    <p className="text-zinc-500 mb-6">You need Super Admin privileges to view this dashboard.</p>
                    <Button onClick={() => { StorageService.logout(); navigate('/auth'); }}>Login as Admin</Button>
                </div>
            </div>
        );
    }

    if (!currentUser?.isAdmin) return null;

    const filteredUsers = (users || []).filter(u => 
        (u.name || '').toLowerCase().includes(searchTerm.toLowerCase()) || 
        (u.email || '').toLowerCase().includes(searchTerm.toLowerCase())
    );
    
    const filteredEvents = (events || []).filter(e => 
        (e.title || '').toLowerCase().includes(searchTerm.toLowerCase()) || 
        (e.organizer || '').toLowerCase().includes(searchTerm.toLowerCase())
    );

    return (
        <div className="max-w-7xl mx-auto py-8 px-4 pb-20">
            <div className="flex flex-col md:flex-row justify-between items-start md:items-center mb-8 gap-4">
                <div>
                    <h1 className="text-3xl font-black text-white uppercase tracking-tight flex items-center gap-3">
                        <Shield className="text-[#E0FF20]" size={32} /> Super Admin
                    </h1>
                    <p className="text-zinc-400">Platform Management Dashboard</p>
                </div>
                <div className="flex gap-4">
                    <div className="text-right bg-zinc-900 border border-zinc-800 p-4 rounded-xl">
                        <div className="text-[10px] font-bold text-zinc-500 uppercase flex items-center justify-end gap-1">
                            <Ticket size={12}/> Ticket Fees
                        </div>
                        <div className="text-xl font-bold text-white">${stats.ticketRevenue.toFixed(2)}</div>
                    </div>
                    <div className="text-right bg-zinc-900 border border-zinc-800 p-4 rounded-xl">
                        <div className="text-[10px] font-bold text-zinc-500 uppercase flex items-center justify-end gap-1">
                            <Crown size={12} className="text-purple-500"/> Subscriptions
                        </div>
                        <div className="text-xl font-bold text-purple-400">${stats.subscriptionRevenue.toFixed(2)}</div>
                    </div>
                </div>
            </div>

            <div className="flex gap-2 mb-6 overflow-x-auto pb-2">
                 {['users', 'events', 'finance', 'broadcast', 'settings'].map(tab => (
                     <button
                        key={tab}
                        onClick={() => setActiveTab(tab as any)}
                        className={`flex items-center gap-2 px-6 py-3 rounded-xl font-bold capitalize transition-all ${
                            activeTab === tab 
                            ? 'bg-[#E0FF20] text-black shadow-[0_0_20px_rgba(224,255,32,0.3)]' 
                            : 'bg-zinc-900 text-zinc-400 hover:bg-zinc-800'
                        }`}
                     >
                         {tab}
                     </button>
                 ))}
            </div>

            <div className="bg-zinc-900 border border-zinc-800 rounded-3xl overflow-hidden min-h-[500px]">
                {/* Simplified view logic for brevity, full logic in main file */}
                {activeTab === 'users' && (
                    <div className="overflow-x-auto">
                        <table className="w-full text-left text-sm text-zinc-400">
                            <thead className="bg-black text-zinc-500 uppercase font-bold text-xs">
                                <tr><th className="p-4">User</th><th className="p-4">Role</th><th className="p-4">Actions</th></tr>
                            </thead>
                            <tbody>
                                {filteredUsers.map(u => (
                                    <tr key={u.id} className="border-t border-zinc-800">
                                        <td className="p-4">{u.name} ({u.email})</td>
                                        <td className="p-4">{u.role}</td>
                                        <td className="p-4">
                                            <Button size="sm" variant="outline" onClick={() => handleToggleBan(u)}>{u.isBanned ? 'Unban' : 'Ban'}</Button>
                                        </td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>
                )}
                {/* Other tabs follow similar pattern */}
            </div>
        </div>
    );
};
