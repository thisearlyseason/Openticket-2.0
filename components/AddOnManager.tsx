
import React, { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { StorageService } from '../services/storageService';
import { Registration, Event, PurchasedAddOn } from '../types';
import { Button, Input, Card, Badge } from './UI';
import { ArrowLeft, Search, ShoppingBag, Receipt, Ticket, User, ExternalLink, Calendar, Trash2, DollarSign, AlertTriangle, Check } from 'lucide-react';
import { DataTable, Column } from './DataTable';

interface AddOnItem {
    id: string; // registration id
    attendeeName: string;
    attendeeEmail: string;
    addOn: PurchasedAddOn;
    timestamp: number;
    fulfilled: boolean;
    index: number; // Index in the source registration array
}

export const AddOnManager = () => {
    const { id } = useParams<{ id: string }>();
    const navigate = useNavigate();
    const [event, setEvent] = useState<Event | null>(null);
    const [addOnItems, setAddOnItems] = useState<AddOnItem[]>([]);
    const [searchTerm, setSearchTerm] = useState('');
    const [isLoading, setIsLoading] = useState(true);
    // Modal State
    const [confirmationModal, setConfirmationModal] = useState<{
        title: string;
        message: string;
        onConfirm: () => void;
        confirmText?: string;
        isDestructive?: boolean;
    } | null>(null);

    // DataTable columns for add-ons
    const addOnColumns: Column<AddOnItem>[] = [
        {
            key: 'attendee',
            header: 'Guest',
            sortable: true,
            filterable: true,
            render: (item) => (
                <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-full bg-gradient-to-br from-zinc-200 to-zinc-300 dark:from-zinc-700 dark:to-zinc-800 flex items-center justify-center text-zinc-600 dark:text-zinc-300 font-bold text-sm">
                        {item.attendeeName?.split(' ').map(n => n[0]).join('').slice(0, 2).toUpperCase() || 'G'}
                    </div>
                    <div>
                        <div className="font-bold text-sm text-zinc-900 dark:text-white">{item.attendeeName}</div>
                        <div className="text-xs text-zinc-500">{item.attendeeEmail}</div>
                    </div>
                </div>
            ),
            exportValue: (item) => `${item.attendeeName} (${item.attendeeEmail})`
        },
        {
            key: 'type',
            header: 'Add-On Type',
            sortable: true,
            filterable: true,
            render: (item) => (
                <div className="flex items-center gap-2">
                    <div className="w-8 h-8 rounded-lg bg-emerald-100 dark:bg-emerald-900/30 flex items-center justify-center">
                        <ShoppingBag size={14} className="text-emerald-600 dark:text-emerald-400" />
                    </div>
                    <div className="font-bold text-sm text-zinc-900 dark:text-white">{item.addOn.name}</div>
                </div>
            ),
            exportValue: (item) => item.addOn.name
        },
        {
            key: 'details',
            header: 'Details',
            sortable: true,
            render: (item) => (
                <div className="text-sm text-zinc-600 dark:text-zinc-400">
                    <div className="flex items-center gap-1">
                        <DollarSign size={12} className="text-zinc-400" />
                        <span>${item.addOn.price.toFixed(2)} each</span>
                    </div>
                    {item.addOn.answer && (
                        <div className="mt-1 text-xs text-emerald-600 dark:text-emerald-400 bg-emerald-50 dark:bg-emerald-900/20 px-2 py-1 rounded-md inline-block">
                            Note: {item.addOn.answer}
                        </div>
                    )}
                    <div className="text-[10px] text-zinc-400 mt-1">
                        Purchased: {new Date(item.timestamp).toLocaleDateString()}
                    </div>
                </div>
            ),
            exportValue: (item) => `$${item.addOn.price.toFixed(2)} - ${item.addOn.answer || 'No note'} - ${new Date(item.timestamp).toLocaleDateString()}`
        },
        {
            key: 'quantity',
            header: 'Qty',
            sortable: true,
            render: (item) => <Badge color="zinc" className="font-mono font-bold">×{item.addOn.quantity}</Badge>,
            exportValue: (item) => String(item.addOn.quantity)
        },
        {
            key: 'total',
            header: 'Total',
            sortable: true,
            render: (item) => (
                <div className="font-black text-sm text-emerald-600 dark:text-emerald-400">
                    ${(item.addOn.price * item.addOn.quantity).toFixed(2)}
                </div>
            ),
            exportValue: (item) => `$${(item.addOn.price * item.addOn.quantity).toFixed(2)}`
        },
        {
            key: 'fulfilled',
            header: 'Received',
            sortable: true,
            filterable: true,
            filterType: 'select',
            filterOptions: [
                { label: 'Received', value: 'true' },
                { label: 'Pending', value: 'false' }
            ],
            render: (item) => (
                <button 
                    onClick={() => toggleFulfillment(item)} 
                    className={`inline-flex items-center gap-2 px-3 py-2 rounded-xl transition-all font-bold text-xs uppercase tracking-wide ${
                        item.fulfilled 
                            ? 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/40 dark:text-emerald-400 ring-2 ring-emerald-500/20' 
                            : 'bg-zinc-100 text-zinc-500 dark:bg-zinc-800 dark:text-zinc-400 hover:bg-amber-100 hover:text-amber-700 dark:hover:bg-amber-900/30 dark:hover:text-amber-400'
                    }`}
                >
                    {item.fulfilled ? <><Check size={14} /> Received</> : <>Pending</>}
                </button>
            ),
            exportValue: (item) => item.fulfilled ? 'Received' : 'Pending'
        },
        {
            key: 'actions',
            header: 'Actions',
            render: (item) => (
                <div className="flex justify-end gap-2 items-center">
                    <Button size="sm" variant="outline" className="h-8 text-[10px] uppercase font-bold" onClick={() => navigate(`/manage/${id}/attendees?search=${encodeURIComponent(item.attendeeEmail)}`)}>
                        <Ticket size={12} className="mr-1" /> View Ticket
                    </Button>

                    <button
                        onClick={() => handleRefund(item)}
                        className="p-1.5 text-zinc-400 hover:text-red-500 transition-colors"
                        title="Refund Add-On"
                    >
                        <DollarSign size={16} />
                    </button>

                    <button
                        onClick={() => handleDeleteAddOn(item)}
                        className="p-1.5 text-zinc-400 hover:text-red-500 transition-colors"
                        title="Delete Add-On"
                    >
                        <Trash2 size={16} />
                    </button>
                </div>
            )
        }
    ];

    useEffect(() => {
        loadData();
    }, [id]);

    const loadData = async () => {
        if (!id) return;
        
        // Fetch event and registrations for this specific event
        const [evt, regs] = await Promise.all([
            StorageService.getEventFull(id),
            StorageService.getRegistrations(id) // Pass event ID to filter on server
        ]);

        if (evt) setEvent(evt);

        // Build add-on items from registrations
        const items: AddOnItem[] = [];

        // Include paid registrations - check for common paid statuses
        const paidStatuses = ['paid', 'succeeded', 'completed'];
        const eventRegs = regs.filter(r => paidStatuses.includes(r.paymentStatus?.toLowerCase() || ''));
        
        console.log('[AddOnManager] Found paid registrations:', eventRegs.length);

        eventRegs.forEach(reg => {
            console.log('[AddOnManager] Checking reg:', reg.id, 'addOns:', reg.addOns);
            
            if (reg.addOns && Array.isArray(reg.addOns) && reg.addOns.length > 0) {
                reg.addOns.forEach((addon, idx) => {
                    // Skip refunded or cancelled add-ons only
                    const addonStatus = addon.status?.toLowerCase() || 'valid';
                    if (addonStatus === 'refunded' || addonStatus === 'cancelled') {
                        console.log('[AddOnManager] Skipping refunded/cancelled addon:', addon.name);
                        return;
                    }

                    console.log('[AddOnManager] Adding addon:', addon.name, 'status:', addonStatus);
                    items.push({
                        id: reg.id,
                        attendeeName: reg.attendeeName,
                        attendeeEmail: reg.attendeeEmail,
                        addOn: addon,
                        timestamp: reg.timestamp,
                        fulfilled: addon.fulfilled || false,
                        index: idx
                    });
                });
            }
        });

        console.log('[AddOnManager] Total add-on items to display:', items.length);
        setAddOnItems(items.sort((a, b) => b.timestamp - a.timestamp));
        setIsLoading(false);
    };

    const toggleFulfillment = async (item: AddOnItem) => {
        try {
            const regList = await StorageService.getRegistrations(id!);
            const reg = regList.find(r => r.id === item.id);
            if (!reg || !reg.addOns) return;

            // Find index of add-on. We match strictly by reference or content since ID might be missing on addon object itself?
            // PurchasedAddOn has `id` property from type definition.
            const idx = reg.addOns.findIndex(a => a.id === item.addOn.id);
            if (idx === -1) return;

            const updatedAddOns = [...reg.addOns];
            updatedAddOns[idx] = { ...updatedAddOns[idx], fulfilled: !item.fulfilled };

            await StorageService.updateRegistration(reg.id, { addOns: updatedAddOns });

            // Optimistic Update
            setAddOnItems(prev => prev.map(p => p === item ? { ...p, fulfilled: !item.fulfilled } : p));
        } catch (e) { console.error(e); }
    };

    const handleDeleteAddOn = (item: AddOnItem) => {
        setConfirmationModal({
            title: "Delete Add-On?",
            message: `Are you sure you want to remove "${item.addOn.name}" for ${item.attendeeName}? This cannot be undone.`,
            confirmText: "Delete",
            isDestructive: true,
            onConfirm: async () => {
                try {
                    const regList = await StorageService.getRegistrations(id!);
                    const reg = regList.find(r => r.id === item.id);
                    if (!reg || !reg.addOns) return;

                    const updatedAddOns = [...reg.addOns];
                    updatedAddOns.splice(item.index, 1); // Remove it

                    await StorageService.updateRegistration(reg.id, { addOns: updatedAddOns });
                    loadData();
                } catch (e: any) {
                    window.alert("Failed to delete: " + e.message);
                }
            }
        });
    };

    const handleDelete = (item: AddOnItem) => {
        setConfirmationModal({
            title: "Delete Add-On?",
            message: `Are you sure you want to remove "${item.addOn.name}" for ${item.attendeeName}? This cannot be undone.`,
            confirmText: "Delete",
            isDestructive: true,
            onConfirm: async () => {
                try {
                    const regList = await StorageService.getRegistrations(id!);
                    const reg = regList.find(r => r.id === item.id);
                    if (!reg || !reg.addOns) return;

                    const updatedAddOns = [...reg.addOns];
                    updatedAddOns.splice(item.index, 1); // Remove it

                    await StorageService.updateRegistration(reg.id, { addOns: updatedAddOns });
                    loadData();
                } catch (e: any) {
                    window.alert("Failed to delete: " + e.message);
                }
            }
        });
    };

    const handleRefund = (item: AddOnItem) => {
        setConfirmationModal({
            title: "Refund Add-On?",
            message: `Refund $${(item.addOn.price * item.addOn.quantity).toFixed(2)} for "${item.addOn.name}"? This will return funds to the customer via Stripe.`,
            confirmText: "Refund & Remove",
            isDestructive: true,
            onConfirm: async () => {
                try {
                    await StorageService.refundAddon(item.id, item.index, "Requested via AddOn Manager");
                    loadData();
                } catch (e: any) {
                    window.alert("Failed to refund: " + e.message);
                }
            }
        });
    };

    const filteredItems = addOnItems.filter(item =>
        item.attendeeName.toLowerCase().includes(searchTerm.toLowerCase()) ||
        item.addOn.name.toLowerCase().includes(searchTerm.toLowerCase())
    );

    if (isLoading) return <div className="p-8 text-center"><div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary mx-auto"></div></div>;

    return (
        <div className="max-w-6xl mx-auto py-8 px-4 pb-24">
            {confirmationModal && (
                <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm animate-in fade-in">
                    <Card className="w-full max-w-sm p-6">
                        <div className="flex flex-col items-center text-center">
                            <div className={`w-16 h-16 rounded-full flex items-center justify-center mb-4 ${confirmationModal.isDestructive ? 'bg-red-100 dark:bg-red-900/30 text-red-500' : 'bg-primary/10 text-primary'}`}>
                                {confirmationModal.isDestructive ? <AlertTriangle size={32} /> : <Check size={32} />}
                            </div>
                            <h3 className="text-xl font-bold mb-2 text-zinc-900 dark:text-white">{confirmationModal.title}</h3>
                            <p className="text-zinc-500 mb-6 font-medium">
                                {confirmationModal.message}
                            </p>
                            <div className="flex gap-3 w-full">
                                <Button variant="outline" className="flex-1" onClick={() => setConfirmationModal(null)}>Cancel</Button>
                                <Button
                                    className={`flex-1 ${confirmationModal.isDestructive ? 'bg-red-500 hover:bg-red-600 border-none text-white' : ''}`}
                                    onClick={() => { confirmationModal.onConfirm(); setConfirmationModal(null); }}
                                >
                                    {confirmationModal.confirmText || 'Confirm'}
                                </Button>
                            </div>
                        </div>
                    </Card>
                </div>
            )}

            <div className="flex items-center justify-between mb-8">
                <button onClick={() => navigate(`/manage/${id}`)} className="text-zinc-500 hover:text-zinc-900 dark:hover:text-white flex items-center text-sm font-bold transition-colors">
                    <ArrowLeft size={16} className="mr-2" /> Back to Dashboard
                </button>
            </div>

            <div className="flex flex-col md:flex-row md:items-center justify-between gap-6 mb-8">
                <div>
                    <h1 className="text-3xl font-black text-zinc-900 dark:text-white uppercase tracking-tight flex items-center gap-3">
                        <ShoppingBag className="text-emerald-500" /> Add-ons & Products
                    </h1>
                    <p className="text-zinc-500">{event?.title} • {addOnItems.length} items sold</p>
                </div>
                <div className="relative w-full md:w-96">
                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-zinc-400" size={18} />
                    <Input
                        placeholder="Search by name or product..."
                        value={searchTerm}
                        onChange={e => setSearchTerm(e.target.value)}
                        className="pl-10"
                    />
                </div>
            </div>

            <Card className="overflow-hidden border-zinc-200 dark:border-zinc-800">
                <div className="p-6">
                    <DataTable
                        data={filteredItems}
                        columns={addOnColumns}
                        searchPlaceholder="Search add-ons by guest name or type..."
                        emptyMessage="No add-ons found. Add-ons purchased by guests will appear here."
                        exportFilename={`${event?.title?.replace(/\s+/g, '_')}_addons`}
                        getRowId={(item) => `${item.id}-${item.index}`}
                    />
                </div>
            </Card>

            <div className="mt-8 text-center text-xs text-zinc-500">
                All prices include applicable taxes and service fees processed at time of purchase.
            </div>
        </div>
    );
};
