import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { StorageService } from '../services/storageService';
import { Registration, Event, User } from '../types';
import { Badge, formatTime, Button, Input, ReceiptModal } from './UI';
import { useConfirm } from './ConfirmContext';
import { Calendar, MapPin, Clock, Ticket as TicketIcon, Printer, ArrowLeft, Send, Archive, RotateCcw, Trash2, Ghost, ShoppingBag } from 'lucide-react';

export const MyTickets = () => {
    const { confirm } = useConfirm();
    interface DisplayTicket {
        reg: Registration;
        event: Event;
        ticketInfo: { name: string, quantity: number, date?: string };
        uniqueIndex: number;
        uniqueQrData: string;
        ticketIdDisplay: string;
        ticketKey: string;
        ticketArrayIndex: number; // Index in reg.tickets array
        status: 'valid' | 'expired' | 'pay_at_door' | 'pending' | 'refunded' | 'hidden';
        hostName: string;
        isAddOn: boolean;
        addOnAnswer?: string;
        timestamp: number;
        transferStatus?: 'transferred_out' | 'transferred_in';
        transferredFrom?: string;
        transferredTo?: string;
        attendeeName?: string; // Individual attendee name
        originalAttendeeName?: string; // Original name before transfer
        checkedIn?: boolean; // Check-in status
    }

    interface EventGroup {
        eventId: string;
        event: Event;
        totalTickets: number;
        tickets: DisplayTicket[];
        mostRecentTimestamp: number;
    }

    const [activeTab, setActiveTab] = useState<'active' | 'past' | 'archived'>('active');
    const [eventGroups, setEventGroups] = useState<EventGroup[]>([]);
    const [selectedGroupId, setSelectedGroupId] = useState<string | null>(null);
    const [user, setUser] = useState<User | null>(null);
    const [transferModal, setTransferModal] = useState<{ isOpen: boolean, ticket: DisplayTicket | null, name: string, email: string }>({ isOpen: false, ticket: null, name: '', email: '' });
    const [receiptModal, setReceiptModal] = useState<{ isOpen: boolean, reg: Registration | null, event: Event | null }>({ isOpen: false, reg: null, event: null });
    
    // Transfer Undo Modal State
    const [undoModal, setUndoModal] = useState<{ 
        isOpen: boolean, 
        transferId: string | null, 
        countdown: number,
        registrationId: string | null 
    }>({ isOpen: false, transferId: null, countdown: 5, registrationId: null });
    
    const navigate = useNavigate();

    // Derived State
    const selectedGroup = eventGroups.find(g => g.eventId === selectedGroupId) || null;

    // Show undo modal with countdown
    const showUndoModal = (transferId: string, undoExpiresAt: string) => {
        const expiresAt = new Date(undoExpiresAt).getTime();
        const now = Date.now();
        const remainingSeconds = Math.max(0, Math.ceil((expiresAt - now) / 1000));
        
        setUndoModal({
            isOpen: true,
            transferId,
            countdown: remainingSeconds,
            registrationId: transferModal.ticket?.reg.id || null
        });

        // Start countdown
        const interval = setInterval(async () => {
            setUndoModal(prev => {
                if (prev.countdown <= 1) {
                    clearInterval(interval);
                    // Auto-finalize transfer (don't await in setState, call separately)
                    setTimeout(() => {
                        finalizeTransfer(transferId);
                    }, 100);
                    return { ...prev, isOpen: false, countdown: 0 };
                }
                return { ...prev, countdown: prev.countdown - 1 };
            });
        }, 1000);
    };

    // Undo transfer
    const handleUndoTransfer = async () => {
        if (!undoModal.transferId || !undoModal.registrationId) return;
        
        try {
            await StorageService.undoTicketTransfer(undoModal.registrationId, undoModal.transferId);
            setUndoModal({ isOpen: false, transferId: null, countdown: 0, registrationId: null });
            await confirm({
                title: 'Transfer Cancelled',
                message: 'The transfer has been cancelled. Your ticket is restored.',
                confirmText: 'OK',
                variant: 'info'
            });
            if (user) loadTickets(user.email);
        } catch (e: any) {
            await confirm({
                title: 'Error',
                message: 'Failed to undo transfer: ' + e.message,
                confirmText: 'OK',
                variant: 'danger'
            });
        }
    };

    // Finalize transfer after countdown
    const finalizeTransfer = async (transferId: string) => {
        try {
            await StorageService.finalizeTicketTransfer(transferId);
            await confirm({
                title: 'Transfer Complete',
                message: 'The ticket has been successfully transferred.',
                confirmText: 'OK',
                variant: 'info'
            });
            if (user) loadTickets(user.email);
        } catch (e: any) {
            console.error('Finalize transfer error:', e);
        }
    };

    useEffect(() => {
        const currentUser = StorageService.getCurrentUser();
        if (!currentUser) { navigate('/auth'); return; }
        setUser(currentUser);
        loadTickets(currentUser.email);
    }, [navigate, activeTab]);

    const loadTickets = async (email: string) => {
        const userRegistrations = await StorageService.getRegistrationsByEmail(email);
        const now = Date.now();
        const groups: Record<string, { event: Event, tickets: DisplayTicket[], timestamp: number }> = {};

        for (const { reg, event } of userRegistrations) {
            const isRegHidden = reg.hiddenForAttendee === true;
            const isRefunded = reg.paymentStatus === 'refunded';
            let isExpired = false;
            if ((reg.paymentStatus === 'offline_pending' || reg.paymentStatus === 'pending') && event.paymentTimeLimit && event.paymentTimeLimit > 0) {
                if (Date.now() > reg.timestamp + (event.paymentTimeLimit * 3600 * 1000)) isExpired = true;
            }

            const eventDateStr = event.date + 'T' + (event.time || '00:00');
            const eventTimestamp = new Date(eventDateStr).getTime();
            const isPastEvent = !isNaN(eventTimestamp) && eventTimestamp < now;

            // View Filtering Logic
            if (activeTab === 'archived') {
                if (!isRegHidden && !isRefunded && !isExpired) continue;
            } else if (activeTab === 'past') {
                if (isRegHidden || isRefunded || isExpired || !isPastEvent) continue;
            } else { // active
                if (isRegHidden || isRefunded || isExpired || isPastEvent) continue;
            }

            if (!groups[event.id]) groups[event.id] = { event, tickets: [], timestamp: 0 };
            if (reg.timestamp > groups[event.id].timestamp) groups[event.id].timestamp = reg.timestamp;

            const ticketList: DisplayTicket[] = [];
            let baseStatus: DisplayTicket['status'] = 'valid';
            if (isRefunded) baseStatus = 'refunded';
            else if (isExpired) baseStatus = 'expired';
            else if (reg.paymentStatus === 'offline_pending') baseStatus = 'pay_at_door';
            else if (reg.paymentStatus === 'pending') baseStatus = 'pending';

            // Process Tickets
            if (reg.tickets && reg.tickets.length > 0) {
                reg.tickets.forEach((t, tIdx) => {
                    // Check if this entire ticket is transferred out
                    const isTransferredOut = t.transferStatus === 'transferred_out';
                    const isTransferredIn = t.transferStatus === 'transferred_in';
                    
                    // Skip transferred_out tickets unless in archived view
                    if (isTransferredOut && activeTab !== 'archived') {
                        return;
                    }
                    
                    // NEW: Check if ticket has unique ID structure (quantity should be 1 for each)
                    const hasUniqueId = t.ticketId && t.ticketNumber;
                    
                    if (hasUniqueId) {
                        // NEW TICKET STRUCTURE: Each ticket is already unique
                        const isTicketHidden = reg.hiddenTicketKeys?.includes(t.ticketId);
                        if (activeTab !== 'archived' && isTicketHidden) return;
                        
                        ticketList.push({
                            reg, event,
                            ticketInfo: { 
                                name: t.name, 
                                quantity: 1, // Always 1 for unique tickets
                                date: t.date 
                            },
                            uniqueIndex: 0,
                            uniqueQrData: t.qrCodeData || t.ticketId, // Use unique ticket ID for QR
                            ticketIdDisplay: t.ticketNumber, // Display ticket number (e.g., "TKT-A7F3X9")
                            ticketKey: t.ticketId, // Use ticket ID as key
                            ticketArrayIndex: tIdx,
                            status: isTicketHidden ? 'hidden' : baseStatus,
                            hostName: event.organizer,
                            isAddOn: false,
                            timestamp: reg.timestamp,
                            transferStatus: t.transferStatus,
                            transferredFrom: isTransferredIn ? t.transferredFromEmail : undefined,
                            transferredTo: isTransferredOut ? t.transferredToEmail : undefined,
                            attendeeName: t.attendeeName || reg.attendeeName, // Individual ticket name
                            originalAttendeeName: t.originalAttendeeName, // For transfer history
                            checkedIn: t.checkedIn || false
                        });
                    } else {
                        // LEGACY TICKET STRUCTURE: Tickets with quantity > 1
                        const quantity = t.quantity || 1;
                        for (let i = 0; i < quantity; i++) {
                            const key = `${t.tierId}-${i}`;
                            const isTicketHidden = reg.hiddenTicketKeys?.includes(key);
                            if (activeTab !== 'archived' && isTicketHidden) continue;

                            // Determine status
                            let ticketStatus = isTicketHidden ? 'hidden' : baseStatus;
                            
                            ticketList.push({
                                reg, event,
                                ticketInfo: { 
                                    name: t.name, 
                                    quantity: quantity, 
                                    date: t.date 
                                },
                                uniqueIndex: i,
                                uniqueQrData: `TICKET:${reg.id}:${t.tierId}:${i}`, // Legacy format
                                ticketIdDisplay: `${reg.id.slice(-6).toUpperCase()}-${t.tierId.slice(0, 3).toUpperCase()}-${i + 1}`,
                                ticketKey: key,
                                ticketArrayIndex: tIdx,
                                status: ticketStatus,
                                hostName: event.organizer,
                                isAddOn: false,
                                timestamp: reg.timestamp,
                                transferStatus: t.transferStatus,
                                transferredFrom: isTransferredIn ? t.transferredFromEmail : undefined,
                                transferredTo: isTransferredOut ? t.transferredToEmail : undefined
                            });
                        }
                    }
                });
            } else {
                // Fallback for legacy
                ticketList.push({
                    reg, event,
                    ticketInfo: { name: 'General Admission', quantity: 1 },
                    uniqueIndex: 0,
                    uniqueQrData: `TICKET:${reg.id}:general:0`,
                    ticketIdDisplay: `${reg.id.slice(-6).toUpperCase()}-GEN-1`,
                    ticketKey: 'general-0',
                    status: baseStatus,
                    hostName: event.organizer,
                    isAddOn: false,
                    timestamp: reg.timestamp,
                    ticketArrayIndex: 0 // Fallback
                });
            }

            // Process Addons as tickets for display if needed
            if (reg.addOns && reg.addOns.length > 0) {
                reg.addOns.forEach(addon => {
                    for (let i = 0; i < addon.quantity; i++) {
                        ticketList.push({
                            reg, event,
                            ticketInfo: { name: addon.name, quantity: addon.quantity },
                            uniqueIndex: i,
                            uniqueQrData: `ADDON:${reg.id}:${addon.id}:${i}`,
                            ticketIdDisplay: `${reg.id.slice(-6).toUpperCase()}-ADD-${i + 1}`,
                            ticketKey: `${addon.id}-${i}`,
                            status: baseStatus,
                            hostName: event.organizer,
                            isAddOn: true,
                            addOnAnswer: addon.answer,
                            timestamp: reg.timestamp,
                            ticketArrayIndex: -1 // Add-ons are not in tickets array
                        });
                    }
                });
            }
            groups[event.id].tickets.push(...ticketList);
        }

        const result: EventGroup[] = Object.entries(groups)
            .filter(([_, g]) => g.tickets.length > 0)
            .map(([eventId, g]) => ({
                eventId,
                event: g.event,
                totalTickets: g.tickets.length,
                tickets: g.tickets.sort((a, b) => b.timestamp - a.timestamp),
                mostRecentTimestamp: g.timestamp
            }));

        setEventGroups(result.sort((a, b) => b.mostRecentTimestamp - a.mostRecentTimestamp));
    };

    const handlePrint = async (ticketsToPrint: DisplayTicket[] | undefined = undefined) => {
        if (!selectedGroup && !ticketsToPrint) return;

        const tickets = ticketsToPrint || selectedGroup?.tickets;
        if (!tickets || tickets.length === 0) return;

        const printWindow = window.open('', '_blank');
        if (!printWindow) return;

        const ticketsHtml = tickets.map(ticket => {
            const qrUrl = `https://api.qrserver.com/v1/create-qr-code/?size=300x300&data=${encodeURIComponent(ticket.uniqueQrData)}`;
            const dateDisplay = new Date(ticket.event.date).toLocaleDateString(undefined, { weekday: 'short', month: 'long', day: 'numeric', year: 'numeric' });
            const timeDisplay = formatTime(ticket.event.time, ticket.event.timeFormat);

            const addOns = ticket.reg.addOns?.map(a =>
                `<li class="addon-item"><strong>${a.quantity}x</strong> ${a.name}</li>`
            ).join('') || '';

            return `
                <div class="ticket-wrapper">
                    <div class="ticket">
                        <div class="stub">
                            <div class="stub-header">
                                <span class="brand">OPENTICKET</span>
                                <span class="admit">ADMIT ONE</span>
                            </div>
                            <div class="stub-body">
                                <div class="stub-qr"><img src="${qrUrl}" /></div>
                                <div class="stub-id">${ticket.ticketIdDisplay}</div>
                            </div>
                        </div>
                        <div class="main">
                            <div class="main-header">
                                <div class="event-title">${ticket.event.title}</div>
                                <div class="event-subtitle">${ticket.event.subtitle || ''}</div>
                            </div>
                            <div class="main-info">
                                <div class="info-row">
                                    <div class="info-group">
                                        <label>DATE</label>
                                        <div class="value">${dateDisplay}</div>
                                    </div>
                                    <div class="info-group">
                                        <label>TIME</label>
                                        <div class="value">${timeDisplay}</div>
                                    </div>
                                    <div class="info-group">
                                        <label>LOCATION</label>
                                        <div class="value">${ticket.event.location}</div>
                                    </div>
                                </div>
                                <div class="info-row highlight-row">
                                    <div class="info-group">
                                        <label>TICKET TYPE</label>
                                        <div class="value badge" style="${ticket.isAddOn ? 'background: #ec4899 !important;' : ''}">${ticket.isAddOn ? 'ADD-ON: ' + ticket.ticketInfo.name : ticket.ticketInfo.name}</div>
                                        ${ticket.addOnAnswer ? `<div class="value" style="font-size: 10px; margin-top: 4px; color: #666;">${ticket.addOnAnswer}</div>` : ''}
                                    </div>
                                    <div class="info-group">
                                        <label>ATTENDEE</label>
                                        <div class="value">${ticket.reg.attendeeName}</div>
                                    </div>
                                </div>
                                ${addOns ? `
                                <div class="extras-section">
                                    <label>INCLUDED EXTRAS</label>
                                    <ul>${addOns}</ul>
                                </div>` : ''}
                            </div>
                            <div class="main-footer">
                                <span>ORDER: #${ticket.reg.id.slice(-8).toUpperCase()}</span>
                                <span>ORGANIZER: ${ticket.hostName}</span>
                            </div>
                        </div>
                    </div>
                </div>
            `;
        }).join('');

        printWindow.document.write(`
            <html>
                <head>
                    <title>Print Tickets - ${selectedGroup?.event.title || 'OpenTicket'}</title>
                    <link href="https://fonts.googleapis.com/css2?family=Inter:wght@400;600;800&family=Space+Grotesk:wght@700&display=swap" rel="stylesheet">
                    <style>
                        body { background: #f4f4f5; font-family: 'Inter', sans-serif; margin: 0; padding: 40px; -webkit-print-color-adjust: exact; }
                        .ticket-wrapper { margin-bottom: 40px; page-break-inside: avoid; display: flex; justify-content: center; }
                        .ticket { display: flex; width: 800px; height: 300px; background: white; border-radius: 20px; overflow: hidden; box-shadow: 0 10px 30px rgba(0,0,0,0.1); border: 1px solid #e4e4e7; }
                        
                        /* STUB SIDE */
                        .stub { width: 250px; background: #000; color: white; display: flex; flex-direction: column; justify-content: space-between; padding: 25px; position: relative; border-right: 2px dashed #333; }
                        .stub::after { content: ''; position: absolute; right: -10px; top: 50%; width: 20px; height: 20px; background: #f4f4f5; border-radius: 50%; transform: translateY(-50%); z-index: 10; }
                        .stub-header { display: flex; justify-content: space-between; align-items: center; font-family: 'Space Grotesk', sans-serif; font-size: 12px; letter-spacing: 1px; color: #E0FF20; font-weight: bold; }
                        .stub-body { flex: 1; display: flex; flex-direction: column; align-items: center; justify-content: center; gap: 15px; }
                        .stub-qr img { width: 140px; height: 140px; border-radius: 10px; border: 4px solid white; }
                        .stub-id { font-family: monospace; color: #a1a1aa; font-size: 14px; background: #27272a; padding: 4px 8px; border-radius: 4px; }

                        /* MAIN SIDE */
                        .main { flex: 1; padding: 30px; display: flex; flex-direction: column; position: relative; }
                        .main::before { content: ''; position: absolute; left: -10px; top: 50%; width: 20px; height: 20px; background: #f4f4f5; border-radius: 50%; transform: translateY(-50%); z-index: 10; }
                        .main-header { margin-bottom: 20px; border-bottom: 2px solid #f4f4f5; padding-bottom: 15px; }
                        .event-title { font-size: 32px; font-weight: 900; text-transform: uppercase; color: #18181b; line-height: 1; margin-bottom: 5px; }
                        .event-subtitle { font-size: 16px; color: #ec4899; font-weight: 600; }
                        
                        .main-info { flex: 1; display: flex; flex-direction: column; gap: 15px; }
                        .info-row { display: grid; grid-template-columns: repeat(3, 1fr); gap: 20px; }
                        .info-group label { display: block; font-size: 10px; font-weight: 800; color: #a1a1aa; text-transform: uppercase; margin-bottom: 4px; letter-spacing: 0.5px; }
                        .info-group .value { font-size: 14px; font-weight: 700; color: #18181b; }
                        .highlight-row .value { font-size: 16px; }
                        .badge { display: inline-block; background: #18181b; color: white !important; padding: 4px 10px; border-radius: 6px; font-size: 12px !important; text-transform: uppercase; }
                        
                        .extras-section { background: #f4f4f5; padding: 10px 15px; border-radius: 8px; margin-top: auto; }
                        .extras-section label { font-size: 9px; font-weight: 800; color: #a1a1aa; text-transform: uppercase; }
                        .extras-section ul { margin: 5px 0 0 0; padding: 0; list-style: none; display: flex; flex-wrap: wrap; gap: 15px; }
                        .extras-section li { font-size: 12px; color: #3f3f46; }

                        .main-footer { margin-top: auto; display: flex; justify-content: space-between; font-size: 10px; color: #a1a1aa; font-weight: 600; text-transform: uppercase; border-top: 2px solid #f4f4f5; padding-top: 15px; }

                        @media print {
                            body { background: white; padding: 0; margin: 0; }
                            .ticket-wrapper { height: 100vh; align-items: center; margin: 0; page-break-after: always; }
                            .ticket { box-shadow: none; border: 2px solid #000; }
                        }
                    </style>
                </head>
                <body>
                    ${ticketsHtml}
                    <script>window.onload = function() { window.print(); }</script>
                </body>
            </html>
        `);
        printWindow.document.close();
    };

    return (
        <div className="max-w-4xl mx-auto py-12 px-4">
            <h1 className="text-4xl font-black text-zinc-900 dark:text-white mb-8 font-display uppercase tracking-tight">Your Tickets</h1>

            <div className="flex gap-2 mb-8 border-b border-zinc-200 dark:border-zinc-800 pb-1 overflow-x-auto">
                {['active', 'past', 'archived'].map((tab) => (
                    <button
                        key={tab}
                        onClick={() => { setActiveTab(tab as any); setSelectedGroupId(null); }}
                        className={`px-6 py-2 rounded-lg font-bold capitalize transition-all whitespace-nowrap ${activeTab === tab ? 'bg-zinc-900 dark:bg-white text-white dark:text-black' : 'text-zinc-500 hover:text-zinc-900 dark:hover:text-zinc-300'}`}
                    >
                        {tab}
                    </button>
                ))}
            </div>

            {!selectedGroup ? (
                // --- EVENT LIST VIEW ---
                <div className="grid gap-6">
                    {eventGroups.length === 0 ? (
                        <div className="text-center py-20 bg-zinc-50 dark:bg-zinc-900 rounded-3xl border-2 border-dashed border-zinc-200 dark:border-zinc-800">
                            <Ghost className="mx-auto h-12 w-12 text-zinc-300 mb-4" />
                            <p className="text-zinc-500 font-bold">No {activeTab} tickets found.</p>
                        </div>
                    ) : (
                        eventGroups.map((group) => (
                            <div key={group.eventId} onClick={() => setSelectedGroupId(group.eventId)} className="group bg-white dark:bg-black border border-zinc-200 dark:border-zinc-800 rounded-3xl overflow-hidden hover:border-primary transition-all cursor-pointer flex flex-col sm:flex-row h-full sm:h-48 shadow-sm hover:shadow-xl">
                                <div className="h-48 sm:h-full sm:w-48 relative shrink-0">
                                    <img src={group.event.imageUrl} className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500" />
                                    <div className="absolute top-0 left-0 bg-black/60 text-white text-xs font-bold px-3 py-1 rounded-br-xl backdrop-blur-sm">
                                        {group.totalTickets} Ticket{group.totalTickets > 1 ? 's' : ''}
                                    </div>
                                </div>
                                <div className="p-6 flex-1 flex flex-col justify-center">
                                    <h3 className="text-2xl font-black text-zinc-900 dark:text-white mb-2 line-clamp-1">{group.event.title}</h3>
                                    <div className="flex items-center gap-4 text-sm text-zinc-500 mb-4">
                                        <div className="flex items-center gap-1"><Calendar size={14} /> {new Date(group.event.date).toLocaleDateString()}</div>
                                        <div className="flex items-center gap-1"><Clock size={14} /> {formatTime(group.event.time, group.event.timeFormat)}</div>
                                    </div>
                                    <div className="flex items-center gap-1 text-primary font-bold text-sm mt-auto">
                                        View Tickets <ArrowLeft size={16} className="rotate-180 group-hover:translate-x-1 transition-transform" />
                                    </div>
                                </div>
                            </div>
                        ))
                    )}
                </div>
            ) : (
                // --- DETAILED TICKET VIEW ---
                <div className="animate-in fade-in slide-in-from-right-4">
                    <div className="flex justify-between items-center mb-6">
                        <Button variant="ghost" onClick={() => setSelectedGroupId(null)} className="pl-0 text-zinc-500 hover:text-zinc-900 dark:hover:text-white">
                            <ArrowLeft size={18} className="mr-2" /> Back to Events
                        </Button>
                        <Button onClick={() => handlePrint()} variant="outline" size="sm">
                            <Printer size={16} className="mr-2" /> Print All
                        </Button>
                        <Button onClick={() => setReceiptModal({ isOpen: true, reg: selectedGroup.tickets[0].reg, event: selectedGroup.event })} variant="secondary" size="sm" className="ml-2 font-black shadow-lg shadow-primary/10">
                            <Printer size={16} className="mr-2" /> View Receipt
                        </Button>
                    </div>

                    <div className="space-y-6">
                        {selectedGroup.tickets.map((ticket, i) => (
                            <div key={i} className={`rounded-3xl overflow-hidden shadow-lg flex flex-col md:flex-row relative transition-all hover:shadow-xl ${ticket.isAddOn ? 'bg-zinc-50 dark:bg-zinc-900/40 border-2 border-dashed border-zinc-200 dark:border-zinc-800' : 'bg-white dark:bg-black border border-zinc-200 dark:border-zinc-800'}`}>
                                {/* Status Banner */}
                                {ticket.status === 'refunded' && <div className="absolute top-4 right-4 bg-red-500 text-white px-3 py-1 rounded-full text-xs font-black uppercase z-10">Refunded</div>}
                                {ticket.status === 'pay_at_door' && <div className="absolute top-4 right-4 bg-yellow-400 text-black px-3 py-1 rounded-full text-xs font-black uppercase z-10">Pay at Door</div>}
                                {ticket.transferStatus === 'transferred_in' && <div className="absolute top-4 right-4 bg-green-500 text-white px-3 py-1 rounded-full text-xs font-black uppercase z-10">Transferred In</div>}

                                <div className="flex-1 p-6 md:p-8">
                                    <div className="flex justify-between items-start mb-6">
                                        <div>
                                            <div className="flex items-center gap-2 mb-1">
                                                <div className={`text-xs font-bold uppercase tracking-wider ${ticket.isAddOn ? 'text-pink-500' : 'text-zinc-500'}`}>{ticket.isAddOn ? 'Add-On Item' : ticket.ticketInfo.name}</div>
                                                {ticket.isAddOn && <Badge className="bg-pink-100 text-pink-600 dark:bg-pink-900/30 dark:text-pink-400 text-[10px]">EXTRA</Badge>}
                                                {ticket.transferStatus === 'transferred_in' && ticket.transferredFrom && (
                                                    <Badge className="bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400 text-[10px]">
                                                        FROM: {ticket.transferredFrom}
                                                    </Badge>
                                                )}
                                            </div>
                                            <h2 className="text-3xl font-black text-zinc-900 dark:text-white leading-none mb-1">{ticket.event.title}</h2>
                                            {ticket.isAddOn && <div className="text-lg font-bold text-zinc-900 dark:text-white mt-2">{ticket.ticketInfo.name}</div>}
                                            {ticket.addOnAnswer && <div className="text-sm font-medium text-zinc-500 mt-1">Option: <span className="text-zinc-900 dark:text-white font-bold">{ticket.addOnAnswer}</span></div>}
                                        </div>
                                    </div>

                                    <div className="grid grid-cols-2 gap-y-6 gap-x-4 mb-6">
                                        <div>
                                            <label className="text-[10px] font-bold text-zinc-400 uppercase block mb-1">Date</label>
                                            <div className="font-bold text-zinc-900 dark:text-white">{new Date(ticket.event.date).toLocaleDateString()}</div>
                                        </div>
                                        <div>
                                            <label className="text-[10px] font-bold text-zinc-400 uppercase block mb-1">Time</label>
                                            <div className="font-bold text-zinc-900 dark:text-white">{formatTime(ticket.event.time, ticket.event.timeFormat)}</div>
                                        </div>
                                        <div>
                                            <label className="text-[10px] font-bold text-zinc-400 uppercase block mb-1">Location</label>
                                            <div className="font-bold text-zinc-900 dark:text-white truncate" title={ticket.event.location}>{ticket.event.location?.split(',')[0]}</div>
                                        </div>
                                        <div>
                                            <label className="text-[10px] font-bold text-zinc-400 uppercase block mb-1">Attendee</label>
                                            <div className="font-bold text-zinc-900 dark:text-white">
                                                {ticket.originalAttendeeName && (
                                                    <div className="line-through text-zinc-400 text-sm mb-1">
                                                        {ticket.originalAttendeeName}
                                                    </div>
                                                )}
                                                <div className="truncate">
                                                    {ticket.attendeeName || ticket.reg.attendeeName}
                                                </div>
                                            </div>
                                        </div>
                                        <div>
                                            <label className="text-[10px] font-bold text-zinc-400 uppercase block mb-1">Ticket #</label>
                                            <div className="font-mono font-bold text-zinc-900 dark:text-white">{ticket.ticketIdDisplay}</div>
                                        </div>
                                        <div>
                                            <label className="text-[10px] font-bold text-zinc-400 uppercase block mb-1">Order #</label>
                                            <div className="font-mono text-xs font-bold text-zinc-900 dark:text-white truncate" title={ticket.reg.id}>
                                                {ticket.reg.id.slice(-8).toUpperCase()}
                                            </div>
                                        </div>
                                        <div>
                                            <label className="text-[10px] font-bold text-zinc-400 uppercase block mb-1">Purchased</label>
                                            <div className="text-sm font-bold text-zinc-900 dark:text-white">
                                                {new Date(ticket.reg.timestamp).toLocaleDateString()}
                                            </div>
                                        </div>
                                        <div>
                                            <label className="text-[10px] font-bold text-zinc-400 uppercase block mb-1">Status</label>
                                            <div className="font-bold text-zinc-900 dark:text-white">
                                                {ticket.transferStatus === 'transferred_in' && <span className="text-green-600">Transferred In</span>}
                                                {ticket.transferStatus === 'transferred_out' && <span className="text-orange-600">Transferred Out</span>}
                                                {!ticket.transferStatus && ticket.status === 'valid' && <span className="text-green-600">Active</span>}
                                                {ticket.status === 'refunded' && <span className="text-red-600">Refunded</span>}
                                                {ticket.status === 'pay_at_door' && <span className="text-yellow-600">Pay at Door</span>}
                                                {ticket.checkedIn && <span className="text-blue-600">Used</span>}
                                            </div>
                                        </div>
                                    </div>

                                    {/* Add-ons Display */}
                                    {ticket.reg.addOns && ticket.reg.addOns.length > 0 && !ticket.isAddOn && (
                                        <div className="bg-zinc-50 dark:bg-zinc-900/50 p-3 rounded-xl border border-zinc-100 dark:border-zinc-800">
                                            <div className="text-[10px] font-bold text-zinc-400 uppercase mb-2 flex items-center gap-1"><ShoppingBag size={10} /> Included Extras</div>
                                            <div className="flex flex-wrap gap-2">
                                                {ticket.reg.addOns.map((addon, idx) => (
                                                    <span key={idx} className="text-xs font-bold bg-white dark:bg-black px-2 py-1 rounded border border-zinc-200 dark:border-zinc-700">
                                                        {addon.quantity}x {addon.name}
                                                    </span>
                                                ))}
                                            </div>
                                        </div>
                                    )}
                                </div>

                                {/* QR Section */}
                                <div className="bg-zinc-100 dark:bg-zinc-900 p-8 flex flex-col items-center justify-center border-l border-zinc-200 dark:border-zinc-800 border-dashed relative w-full md:w-64">
                                    <div className="absolute -left-3 top-1/2 w-6 h-6 bg-white dark:bg-black rounded-full -translate-y-1/2 hidden md:block"></div>
                                    <div className="bg-white p-2 rounded-xl shadow-sm mb-4">
                                        <img
                                            src={`https://api.qrserver.com/v1/create-qr-code/?size=150x150&data=${encodeURIComponent(ticket.uniqueQrData)}`}
                                            className={`w-32 h-32 ${ticket.status !== 'valid' && ticket.status !== 'pay_at_door' ? 'opacity-20 blur-sm' : ''}`}
                                        />
                                    </div>
                                    <div className="text-center">
                                        <div className="text-[10px] font-bold text-zinc-400 uppercase mb-1">Order ID</div>
                                        <div className="font-mono text-sm font-bold tracking-wider mb-2">{ticket.ticketIdDisplay}</div>
                                        <div className="flex flex-col gap-2">
                                            <button onClick={() => handlePrint([ticket])} className="text-xs text-pink-600 dark:text-pink-400 hover:underline flex items-center justify-center gap-1">
                                                <Printer size={12} /> Print Ticket
                                            </button>
                                            {!ticket.isAddOn && !ticket.transferStatus && (
                                                <button onClick={() => setTransferModal({ isOpen: true, ticket: ticket, name: '', email: '' })} className="text-xs text-primary hover:underline flex items-center justify-center gap-1">
                                                    <Send size={12} /> Transfer Ticket
                                                </button>
                                            )}
                                        </div>
                                    </div>
                                </div>
                            </div>
                        ))}
                    </div>
                </div>
            )}

            {/* Transfer Modal */}
            {transferModal.isOpen && transferModal.ticket && (
                <div className="fixed inset-0 bg-black/80 backdrop-blur-sm z-50 flex items-center justify-center p-4 animate-in fade-in">
                    <div className="bg-white dark:bg-zinc-900 w-full max-w-md p-8 rounded-[2.5rem] shadow-2xl space-y-6">
                        <div className="text-center">
                            <h3 className="text-2xl font-black uppercase tracking-tighter mb-2">Transfer Ticket</h3>
                            <p className="text-zinc-500 font-bold text-sm">Send this ticket to a friend.</p>
                        </div>
                        <div className="space-y-4">
                            <Input label="New Holder Name" value={transferModal.name} onChange={e => setTransferModal({ ...transferModal, name: e.target.value })} placeholder="Enter full name" />
                            <Input label="New Holder Email" type="email" value={transferModal.email} onChange={e => setTransferModal({ ...transferModal, email: e.target.value })} placeholder="Enter email address" />
                        </div>
                        <div className="flex gap-4">
                            <Button variant="outline" onClick={() => setTransferModal({ ...transferModal, isOpen: false })} className="flex-1 rounded-xl font-black">Cancel</Button>
                            <Button className="flex-1 rounded-xl font-black" onClick={async () => {
                                if (!transferModal.email) {
                                    await confirm({
                                        title: 'Missing Information',
                                        message: 'Please enter the recipient email address',
                                        confirmText: 'OK',
                                        variant: 'warning'
                                    });
                                    return;
                                }

                                try {
                                    // Initiate transfer via new API
                                    const result = await StorageService.initiateTicketTransfer(
                                        transferModal.ticket!.reg.id,
                                        transferModal.ticket!.ticketKey,
                                        transferModal.email,
                                        transferModal.name
                                    );

                                    if (result.success) {
                                        // Show undo modal with countdown
                                        setTransferModal({ ...transferModal, isOpen: false });
                                        showUndoModal(result.transferId, result.undoExpiresAt);
                                    }
                                } catch (e: any) {
                                    await confirm({
                                        title: 'Transfer Failed',
                                        message: e.message || 'Failed to initiate transfer',
                                        confirmText: 'OK',
                                        variant: 'danger'
                                    });
                                }
                            }}>Initiate Transfer</Button>
                        </div>
                    </div>
                </div>
            )
            }

            {
                receiptModal.isOpen && receiptModal.reg && receiptModal.event && (
                    <ReceiptModal
                        isOpen={receiptModal.isOpen}
                        onClose={() => setReceiptModal({ ...receiptModal, isOpen: false })}
                        registration={receiptModal.reg}
                        event={receiptModal.event}
                        organizer={undefined} // We don't have organizer user obj here easily, but receipt modal handles undefined with defaults
                    />
                )
            }

            {/* Transfer Undo Modal */}
            {undoModal.isOpen && (
                <div className="fixed inset-0 bg-black/80 backdrop-blur-sm z-50 flex items-center justify-center p-4 animate-in fade-in">
                    <div className="bg-white dark:bg-zinc-900 w-full max-w-sm p-8 rounded-[2.5rem] shadow-2xl text-center space-y-6">
                        <div className="w-20 h-20 mx-auto bg-amber-100 dark:bg-amber-900/30 rounded-full flex items-center justify-center">
                            <Send size={32} className="text-amber-600" />
                        </div>
                        <div>
                            <h3 className="text-2xl font-black uppercase tracking-tighter mb-2">Transfer Pending</h3>
                            <p className="text-zinc-500 text-sm">
                                Your ticket is being transferred. You can undo this action.
                            </p>
                        </div>
                        <div className="text-5xl font-black text-amber-500">
                            {undoModal.countdown}s
                        </div>
                        <div className="w-full bg-zinc-200 dark:bg-zinc-700 rounded-full h-2 overflow-hidden">
                            <div 
                                className="h-full bg-amber-500 transition-all duration-1000 ease-linear"
                                style={{ width: `${(undoModal.countdown / 5) * 100}%` }}
                            />
                        </div>
                        <Button 
                            onClick={handleUndoTransfer}
                            variant="outline"
                            className="w-full rounded-xl font-black border-2 border-amber-500 text-amber-600 hover:bg-amber-50 dark:hover:bg-amber-900/20"
                        >
                            Undo Transfer ({undoModal.countdown}s)
                        </Button>
                        <p className="text-xs text-zinc-400">
                            Transfer will complete automatically when timer expires
                        </p>
                    </div>
                </div>
            )}
        </div >
    );
};