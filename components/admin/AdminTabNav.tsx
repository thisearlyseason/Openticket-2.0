import React from 'react';
import { Users, Calendar, Ticket, DollarSign, UserCheck, Shield, TrendingUp, Megaphone, Tag, Building2, Settings as SettingsIcon, FileText } from 'lucide-react';

interface TabItem {
    id: string;
    label: string;
    icon: React.ComponentType<{ size?: number }>;
}

export const adminTabs: TabItem[] = [
    { id: 'users', label: 'Users', icon: Users },
    { id: 'events', label: 'Events', icon: Calendar },
    { id: 'registrations', label: 'Registrations', icon: Ticket },
    { id: 'finance', label: 'Finance', icon: DollarSign },
    { id: 'affiliates', label: 'Affiliates', icon: UserCheck },
    { id: 'security', label: 'Security', icon: Shield },
    { id: 'analytics', label: 'Analytics', icon: TrendingUp },
    { id: 'broadcast', label: 'Broadcast', icon: Megaphone },
    { id: 'promo', label: 'Promo Codes', icon: Tag },
    { id: 'nonprofit', label: 'Nonprofits', icon: Building2 },
    { id: 'onboarding', label: 'Onboarding', icon: FileText },
    { id: 'settings', label: 'Settings', icon: SettingsIcon }
];

interface AdminTabNavProps {
    activeTab: string;
    onTabChange: (tab: string) => void;
}

export const AdminTabNav: React.FC<AdminTabNavProps> = ({ activeTab, onTabChange }) => {
    return (
        <div className="bg-white dark:bg-zinc-900 border-b border-zinc-200 dark:border-zinc-800 sticky top-0 z-10 px-6 overflow-x-auto">
            <div className="flex gap-2 min-w-max">
                {adminTabs.map(tab => {
                    const Icon = tab.icon;
                    return (
                        <button
                            key={tab.id}
                            onClick={() => onTabChange(tab.id)}
                            className={`flex items-center gap-2 px-6 py-3 rounded-xl font-bold capitalize transition-all whitespace-nowrap ${
                                activeTab === tab.id
                                    ? 'bg-primary text-white'
                                    : 'text-zinc-600 dark:text-zinc-400 hover:bg-zinc-100 dark:hover:bg-zinc-800'
                            }`}
                        >
                            <Icon size={18} />
                            {tab.label}
                        </button>
                    );
                })}
            </div>
        </div>
    );
};
