import React, { useState, useEffect } from 'react';
import { Tag, Trash2 } from 'lucide-react';
import { StorageService } from '../../../services/storageService';
import Button from '../../ui/Button';
import Input from '../../ui/Input';
import Card from '../../ui/Card';
import Badge from '../../ui/Badge';

interface PromoCodesTabProps {
    confirm: (options: {
        title: string;
        message: string;
        confirmText: string;
        variant?: 'danger' | 'primary';
    }) => Promise<boolean>;
}

export const PromoCodesTab: React.FC<PromoCodesTabProps> = ({ confirm }) => {
    const [promoCodes, setPromoCodes] = useState<PromoCode[]>([]);
    const [newPromo, setNewPromo] = useState({
        code: '',
        type: 'percentage' as 'percentage' | 'fixed',
        value: 10,
        target: 'all' as 'subscription' | 'ticket' | 'all',
        targetPlans: [] as string[],
        usageLimit: 0,
        expiresAt: ''
    });

    useEffect(() => {
        loadPromoCodes();
    }, []);

    const loadPromoCodes = async () => {
        try {
            const codes = await StorageService.getPromoCodes();
            setPromoCodes(codes || []);
        } catch (e) {
            console.error("Failed to load promo codes", e);
        }
    };

    const handleCreatePromoCode = async () => {
        if (!newPromo.code.trim()) {
            window.alert('Please enter a promo code');
            return;
        }

        const promoCode = {
            id: `promo-${Date.now()}`,
            code: newPromo.code.toUpperCase(),
            type: newPromo.type,
            value: newPromo.value,
            target: newPromo.target,
            targetPlans: newPromo.targetPlans,
            usageLimit: newPromo.usageLimit || 0,
            usageCount: 0,
            expiresAt: newPromo.expiresAt || undefined,
            isActive: true,
            createdAt: new Date().toISOString()
        };

        await StorageService.createPromoCode(promoCode);
        loadPromoCodes();
        setNewPromo({
            code: '',
            type: 'percentage',
            value: 10,
            target: 'all',
            targetPlans: [],
            usageLimit: 0,
            expiresAt: ''
        });
        window.alert('Promo code created successfully!');
    };

    const handleTogglePromoCode = async (promo: any) => {
        const currentStatus = promo.is_active ?? promo.active;
        await StorageService.updatePromoCode(promo.id, { isActive: !currentStatus });
        loadPromoCodes();
    };

    const handleDeletePromoCode = async (promo: PromoCode) => {
        const confirmed = await confirm({
            title: 'Delete Promo Code',
            message: `Delete promo code "${promo.code}"?`,
            confirmText: 'Delete',
            variant: 'danger'
        });

        if (confirmed) {
            await StorageService.deletePromoCode(promo.id);
            loadPromoCodes();
        }
    };

    return (
        <div className="p-8">
            <h2 className="text-xl font-bold text-white mb-6 flex items-center gap-2">
                <Tag size={24} className="text-[#E0FF20]" /> Promo Code Management
            </h2>

            {/* Create New Promo Code */}
            <Card className="p-6 border-zinc-700 bg-zinc-800/30 mb-8">
                <h3 className="font-bold text-white mb-4">Create New Promo Code</h3>
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-4">
                    <Input
                        label="Promo Code"
                        placeholder="e.g., SUMMER2026"
                        value={newPromo.code}
                        onChange={e => setNewPromo({ ...newPromo, code: e.target.value.toUpperCase() })}
                        className="bg-black border-zinc-700"
                    />
                    <div>
                        <label className="block text-xs font-bold text-zinc-500 uppercase mb-2">Discount Type</label>
                        <select
                            value={newPromo.type}
                            onChange={e => setNewPromo({ ...newPromo, type: e.target.value as any })}
                            className="w-full bg-black border border-zinc-700 rounded-xl px-4 py-3 text-white"
                        >
                            <option value="percentage">Percentage (%)</option>
                            <option value="fixed">Fixed Amount ($)</option>
                        </select>
                    </div>
                    <Input
                        label={newPromo.type === 'percentage' ? 'Discount %' : 'Discount $'}
                        type="number"
                        value={newPromo.value}
                        onChange={e => setNewPromo({ ...newPromo, value: Number(e.target.value) })}
                        className="bg-black border-zinc-700"
                    />
                </div>
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-4">
                    <div>
                        <label className="block text-xs font-bold text-zinc-500 uppercase mb-2">Applies To</label>
                        <select
                            value={newPromo.target}
                            onChange={e => setNewPromo({ ...newPromo, target: e.target.value as any })}
                            className="w-full bg-black border border-zinc-700 rounded-xl px-4 py-3 text-white"
                        >
                            <option value="all">All (Subscriptions & Tickets)</option>
                            <option value="subscription">Subscriptions Only (Pro/Premium)</option>
                            <option value="ticket">Tickets Only</option>
                        </select>
                    </div>
                    <Input
                        label="Usage Limit (0 = unlimited)"
                        type="number"
                        value={newPromo.usageLimit}
                        onChange={e => setNewPromo({ ...newPromo, usageLimit: Number(e.target.value) })}
                        className="bg-black border-zinc-700"
                    />
                    <Input
                        label="Expires At (optional)"
                        type="date"
                        value={newPromo.expiresAt}
                        onChange={e => setNewPromo({ ...newPromo, expiresAt: e.target.value })}
                        className="bg-black border-zinc-700"
                    />
                </div>
                <Button onClick={handleCreatePromoCode}>
                    <Tag size={16} className="mr-2" /> Create Promo Code
                </Button>
            </Card>

            {/* Existing Promo Codes */}
            <div className="bg-zinc-900 border border-zinc-800 rounded-xl overflow-hidden">
                <div className="p-4 border-b border-zinc-800 font-bold">
                    Active Promo Codes ({promoCodes.length})
                </div>
                <table className="w-full text-left text-sm text-zinc-400">
                    <thead className="bg-black text-zinc-500 uppercase font-bold text-xs">
                        <tr>
                            <th className="p-4">Code</th>
                            <th className="p-4">Discount</th>
                            <th className="p-4">Applies To</th>
                            <th className="p-4">Usage</th>
                            <th className="p-4">Status</th>
                            <th className="p-4">Actions</th>
                        </tr>
                    </thead>
                    <tbody>
                        {promoCodes.map(promo => (
                            <tr key={promo.id} className="border-t border-zinc-800">
                                <td className="p-4 font-mono font-bold text-[#E0FF20]">{promo.code}</td>
                                <td className="p-4">
                                    {promo.type === 'percentage' ? `${promo.value}%` : `$${promo.value}`}
                                </td>
                                <td className="p-4 capitalize">{promo.target}</td>
                                <td className="p-4">
                                    {promo.usage_count || promo.usageCount || 0}/{promo.usage_limit || promo.usageLimit || '∞'}
                                </td>
                                <td className="p-4">
                                    <Badge color={(promo.is_active ?? promo.active) ? 'green' : 'gray'}>
                                        {(promo.is_active ?? promo.active) ? 'Active' : 'Inactive'}
                                    </Badge>
                                </td>
                                <td className="p-4 flex gap-2">
                                    <Button 
                                        size="sm" 
                                        variant="outline" 
                                        onClick={() => handleTogglePromoCode(promo)}
                                    >
                                        {(promo.is_active ?? promo.active) ? 'Disable' : 'Enable'}
                                    </Button>
                                    <button 
                                        onClick={() => handleDeletePromoCode(promo)} 
                                        className="p-2 hover:bg-red-900/30 text-red-500 rounded"
                                    >
                                        <Trash2 size={14} />
                                    </button>
                                </td>
                            </tr>
                        ))}
                        {promoCodes.length === 0 && (
                            <tr><td colSpan={6} className="p-8 text-center text-zinc-500">No promo codes created yet.</td></tr>
                        )}
                    </tbody>
                </table>
            </div>
        </div>
    );
};
