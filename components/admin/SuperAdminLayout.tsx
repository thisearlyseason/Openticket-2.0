import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { StorageService } from '../../services/storageService';
import { User } from '../../types';
import { AdminTabNav } from './AdminTabNav';
import type { AdminTab } from './types';

interface SuperAdminLayoutProps {
    embedded?: boolean;
    children: (props: AdminLayoutContext) => React.ReactNode;
}

export interface AdminLayoutContext {
    currentUser: User;
    activeTab: AdminTab;
    setActiveTab: (tab: AdminTab) => void;
    users: User[];
    events: any[];
    registrations: any[];
    loading: boolean;
    searchTerm: string;
    setSearchTerm: (term: string) => void;
    refreshData: () => Promise<void>;
}

export const SuperAdminLayout: React.FC<SuperAdminLayoutProps> = ({ embedded = false, children }) => {
    const navigate = useNavigate();
    const [currentUser, setCurrentUser] = useState<User | null>(null);
    const [activeTab, setActiveTab] = useState<AdminTab>('users');
    const [unauthorized, setUnauthorized] = useState(false);
    
    // Core data
    const [users, setUsers] = useState<User[]>([]);
    const [events, setEvents] = useState<any[]>([]);
    const [registrations, setRegistrations] = useState<any[]>([]);
    const [loading, setLoading] = useState(true);
    const [searchTerm, setSearchTerm] = useState('');

    useEffect(() => {
        const user = StorageService.getCurrentUser();
        if (!user) {
            if (!embedded) navigate('/auth');
            return;
        }

        if (!user.isAdmin) {
            setUnauthorized(true);
            return;
        }

        setCurrentUser(user);
        loadInitialData();
    }, [navigate, embedded]);

    const loadInitialData = async () => {
        setLoading(true);
        try {
            const [usersData, eventsData, regsData] = await Promise.all([
                StorageService.getAllUsersAdmin(),
                StorageService.getAllEventsAdmin(),
                StorageService.getAllRegistrationsAdmin()
            ]);

            setUsers(usersData);
            setEvents(eventsData);
            setRegistrations(regsData);
        } catch (error) {
            console.error('Failed to load admin data:', error);
        } finally {
            setLoading(false);
        }
    };

    const refreshData = async () => {
        await loadInitialData();
    };

    if (unauthorized) {
        return (
            <div className="min-h-screen bg-gradient-to-br from-gray-900 via-zinc-900 to-black flex items-center justify-center p-4">
                <div className="text-center">
                    <h1 className="text-4xl font-black text-white mb-4">Access Denied</h1>
                    <p className="text-zinc-400 mb-6">You need Admin privileges to access this page.</p>
                    <button
                        onClick={() => navigate('/dashboard')}
                        className="bg-primary text-black font-bold px-6 py-3 rounded-xl hover:bg-[#c8e01c] transition-colors"
                    >
                        Go to Dashboard
                    </button>
                </div>
            </div>
        );
    }

    if (!currentUser) {
        return (
            <div className="min-h-screen bg-gradient-to-br from-gray-900 via-zinc-900 to-black flex items-center justify-center">
                <div className="text-white text-xl">Loading...</div>
            </div>
        );
    }

    const context: AdminLayoutContext = {
        currentUser,
        activeTab,
        setActiveTab,
        users,
        events,
        registrations,
        loading,
        searchTerm,
        setSearchTerm,
        refreshData
    };

    return (
        <div className={`${embedded ? '' : 'min-h-screen'} bg-gradient-to-br from-gray-900 via-zinc-900 to-black text-white`}>
            {!embedded && (
                <div className="bg-black/50 backdrop-blur-md border-b border-zinc-800 sticky top-0 z-20">
                    <div className="max-w-[1600px] mx-auto px-6 py-4 flex items-center justify-between">
                        <div>
                            <h1 className="text-2xl font-black text-[#E0FF20]">Super Admin Dashboard</h1>
                            <p className="text-xs text-zinc-500 uppercase tracking-wider">Platform Control Center</p>
                        </div>
                        <button
                            onClick={() => navigate('/dashboard')}
                            className="text-sm text-zinc-400 hover:text-white transition-colors"
                        >
                            ← Back to Dashboard
                        </button>
                    </div>
                </div>
            )}

            <div className="max-w-[1600px] mx-auto">
                <AdminTabNav activeTab={activeTab} onTabChange={(tab) => setActiveTab(tab as AdminTab)} />
                
                <div className="p-6">
                    {children(context)}
                </div>
            </div>
        </div>
    );
};
