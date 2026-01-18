
import React, { useState, useEffect, useRef } from 'react';
import { useParams, useNavigate, useLocation } from 'react-router-dom';
import { useGlobalUI } from './GlobalUIProvider';
import { StorageService } from '../services/storageService';
import { EmailService } from '../services/emailService';
import { isPaidStatus, isRefundedStatus, isRefundingStatus, getPaymentStatusLabel, calculatePaidRevenue, calculatePaidTickets, getAddOnSummary } from '../services/paymentUtils';
import { Event, Registration, WaitlistEntry } from '../types';
import { Button, Input, Select, Card, Badge } from './UI';
import { ArrowLeft, Search, Download, Plus, Check, Edit, Printer, AlertTriangle, MoreHorizontal, User, Mail, Ticket, Clock, Filter, Trash2, Hourglass, DollarSign, X, ShoppingBag, Eye, EyeOff } from 'lucide-react';

interface AttendeeItem {
    id: string;
    regId: string;
    tierId: string;
    ticketIndex: number;
    itemType: 'ticket' | 'addon';
    name: string;
    email: string;
    ticketType: string; // Name of the ticket tier OR the add-on name
    price: number;
    orderDate: number;
    status: 'paid' | 'pending' | 'refunded' | 'refunding' | 'comp' | 'active' | 'cancelled';
    approvalStatus: 'pending' | 'approved' | 'rejected' | 'waitlist';
    checkedIn: boolean; // For tickets: check-in. For addons: fulfilled.
    fulfilled?: boolean;
    addOns?: { name: string; quantity: number; price: number }[]; // Add-ons for this guest
}

export const AttendeeManager = () => {
    const { id } = useParams<{ id: string }>();
    const navigate = useNavigate();
    const location = useLocation();
    const [event, setEvent] = useState<Event | null>(null);
    const [attendees, setAttendees] = useState<AttendeeItem[]>([]);
    const [filteredAttendees, setFilteredAttendees] = useState<AttendeeItem[]>([]);
    const [isLoading, setIsLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);
    const { showToast, showConfirm } = useGlobalUI();
    const [searchTerm, setSearchTerm] = useState('');
    const [filterStatus, setFilterStatus] = useState('all');
    // Show/hide add-ons toggle
    const [showAddOns, setShowAddOns] = useState(false);
    // Waitlist Support
    const [activeTab, setActiveTab] = useState<'attendees' | 'waitlist'>('attendees');
    const [waitlist, setWaitlist] = useState<WaitlistEntry[]>([]);
    // Financial summary state
    const [allRegistrations, setAllRegistrations] = useState<Registration[]>([]);

    // Bulk Selection
    const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());

    // Dropdown State
    const [dropdownState, setDropdownState] = useState<{
        isOpen: boolean;
        x: number;
        y: number;
        item: AttendeeItem | null;
    }>({ isOpen: false, x: 0, y: 0, item: null });

    // Modal States
    const [showAddModal, setShowAddModal] = useState(false);
    const [showEditModal, setShowEditModal] = useState<AttendeeItem | null>(null);
    const [newGuestData, setNewGuestData] = useState({ name: '', email: '', tierId: '', quantity: 1, type: 'comp', waitlistId: '' });
    const [editGuestData, setEditGuestData] = useState({ name: '', email: '' });

    // Refund Modal State
    const [showRefundModal, setShowRefundModal] = useState<AttendeeItem | null>(null);
    const [refundAmount, setRefundAmount] = useState(0);
    const [refundReason, setRefundReason] = useState('');
    const [refundMode, setRefundMode] = useState<'ticket' | 'order'>('ticket'); // ticket = single, order = full reg

    useEffect(() => {
        if (!id) return;
        loadData();

        // Support URL search parameter
        const params = new URLSearchParams(location.search);
        const search = params.get('search');
        if (search) setSearchTerm(search);
    }, [id, location.search]);

    // Close dropdown on scroll or click outside
    useEffect(() => {
        const closeDropdown = () => setDropdownState(prev => ({ ...prev, isOpen: false }));
        window.addEventListener('click', closeDropdown);
        window.addEventListener('scroll', closeDropdown, true);
        return () => {
            window.removeEventListener('click', closeDropdown);
            window.removeEventListener('scroll', closeDropdown, true);
        };
    }, []);

    const loadData = async () => {
        setIsLoading(true);
        setError(null);
        try {
            if (!id) throw new Error("Event ID missing");
            const e = await StorageService.getEventFull(id);
            if (!e) throw new Error("Event not found");
            setEvent(e);
            const regs = await StorageService.getRegistrations(id);
            setAllRegistrations(regs); // Store for financial calculations
            const wl = await StorageService.getWaitlist(id);
            setWaitlist(wl);
            processAttendees(regs, e);
        } catch (err: any) {
            console.error("Failed to load attendees:", err);
            setError(err.message || "Failed to load attendee data.");
        } finally {
            setIsLoading(false);
        }
    };

    const processAttendees = (regs: Registration[], evt: Event | null) => {
        try {
            const list: AttendeeItem[] = [];
            regs.forEach(reg => {
                // Use centralized payment status check
                const paid = isPaidStatus(reg.paymentStatus);
                const refunded = isRefundedStatus(reg.paymentStatus);
                const isRefunding = reg.refundStatus === 'refunding' || reg.paymentStatus === 'refunding';
                
                // Get add-ons for this registration to attach to guest
                const regAddOns = reg.addOns && Array.isArray(reg.addOns) 
                    ? reg.addOns.map(a => ({ name: a.name, quantity: a.quantity || 1, price: a.price || 0 }))
                    : [];

                if (reg.tickets && Array.isArray(reg.tickets) && reg.tickets.length > 0) {
                    reg.tickets.forEach((t, tIdx) => {
                        if (!t) return;
                        for (let i = 0; i < t.quantity; i++) {
                            const ticketKey = `${t.tierId}-${i}`;
                            const isCheckedIn = (reg.checkInStatuses && reg.checkInStatuses[ticketKey]?.checkedIn) || reg.checkedIn || false;

                            // Check specific ticket status or fallback to order status
                            // Priority: ticket.status > reg.refundStatus > reg.paymentStatus
                            let status: string;
                            if (t.status === 'refunded') {
                                status = 'refunded';
                            } else if (t.status === 'refunding' || isRefunding) {
                                status = 'refunding';
                            } else if (refunded) {
                                status = 'refunded';
                            } else if (paid) {
                                status = 'paid';
                            } else {
                                status = 'pending';
                            }

                            list.push({
                                id: `${reg.id}-${t.tierId}-${i}`,
                                regId: reg.id,
                                tierId: t.tierId,
                                ticketIndex: tIdx,
                                itemType: 'ticket',
                                name: t.attendeeName || reg.attendeeName || 'Unknown',
                                email: t.attendeeEmail || reg.attendeeEmail || '',
                                ticketType: t.name,
                                price: t.pricePerTicket || 0,
                                orderDate: reg.timestamp,
                                status: status as any,
                                approvalStatus: reg.approvalStatus || 'approved',
                                checkedIn: isCheckedIn,
                                // Attach add-ons to first ticket of each order for display
                                addOns: i === 0 && tIdx === 0 ? regAddOns : []
                            });
                        }
                    });
                } else {
                    if (!refunded) {
                        list.push({
                            id: `${reg.id}-gen`,
                            regId: reg.id,
                            tierId: 'general',
                            ticketIndex: 0,
                            itemType: 'ticket',
                            name: reg.attendeeName || 'Unknown',
                            email: reg.attendeeEmail || '',
                            ticketType: evt?.ticketName || 'General Admission',
                            price: evt?.price || 0,
                            orderDate: reg.timestamp,
                            status: isRefunding ? 'refunding' : (paid ? 'paid' : 'pending'),
                            approvalStatus: reg.approvalStatus || 'approved',
                            checkedIn: reg.checkedIn || false,
                            addOns: regAddOns
                        });
                    }
                }

                // Only add add-ons as separate rows if showAddOns is enabled
                // This keeps the guest list clean by default
                if (showAddOns && reg.addOns && Array.isArray(reg.addOns) && reg.addOns.length > 0) {
                    reg.addOns.forEach((a, aIdx) => {
                        if (!a) return;
                        let status: any = refunded ? 'refunded' : (paid ? 'paid' : 'pending');
                        if (a.status) status = a.status;
                        const isFulfilled = a.fulfilled || false;

                        list.push({
                            id: `${reg.id}-addon-${aIdx}`,
                            regId: reg.id,
                            tierId: a.id,
                            ticketIndex: aIdx,
                            itemType: 'addon',
                            name: reg.attendeeName || 'Unknown',
                            email: reg.attendeeEmail || '',
                            ticketType: `ADD-ON: ${a.name} (x${a.quantity || 1})`,
                            price: (a.price || 0) * (a.quantity || 1),
                            orderDate: reg.timestamp,
                            status: status,
                            approvalStatus: 'approved',
                            checkedIn: isFulfilled,
                            fulfilled: isFulfilled
                        });
                    });
                }
            });
            const sorted = list.sort((a, b) => b.orderDate - a.orderDate);
            setAttendees(sorted);
            setFilteredAttendees(sorted);
        } catch (e) {
            setError("Error processing attendee data.");
        }
    };

    useEffect(() => {
        let res = attendees;
        
        // Filter out add-ons from main list unless showAddOns is enabled
        if (!showAddOns) {
            res = res.filter(a => a.itemType === 'ticket');
        }
        
        if (searchTerm) {
            const lower = searchTerm.toLowerCase();
            res = res.filter(a => (a.name || '').toLowerCase().includes(lower) || (a.email || '').toLowerCase().includes(lower) || (a.regId || '').toLowerCase().includes(lower));
        }

        if (filterStatus === 'refunded') {
            // Show refunded and cancelled items
            res = res.filter(a => a.status === 'refunded' || a.status === 'cancelled');
        } else if (filterStatus === 'refunding') {
            // Show items being processed for refund
            res = res.filter(a => a.status === 'refunding');
        } else {
            // For all other statuses, exclude refunded/cancelled from the view
            // BUT keep "refunding" visible so organizers can see pending refunds
            res = res.filter(a => a.status !== 'refunded' && a.status !== 'cancelled');

            if (filterStatus === 'checkedIn') res = res.filter(a => a.checkedIn);
            else if (filterStatus === 'notCheckedIn') res = res.filter(a => !a.checkedIn);
            else if (filterStatus === 'approvalPending') res = res.filter(a => a.approvalStatus === 'pending');
            else if (filterStatus === 'paid') res = res.filter(a => a.status === 'paid');
            else if (filterStatus === 'pending') res = res.filter(a => a.status === 'pending');
            // 'all' passes through here (just with refunded excluded)
        }

        setFilteredAttendees(res);
    }, [searchTerm, filterStatus, attendees, showAddOns]);

    const handleSelectRow = (id: string) => {
        const newSelected = new Set(selectedIds);
        if (newSelected.has(id)) newSelected.delete(id);
        else newSelected.add(id);
        setSelectedIds(newSelected);
    };

    const handleSelectAll = () => {
        if (selectedIds.size === filteredAttendees.length) {
            setSelectedIds(new Set());
        } else {
            setSelectedIds(new Set(filteredAttendees.map(a => a.id)));
        }
    };

    const handleBulkDelete = async () => {
        if (selectedIds.size === 0) return;

        // Check if any paid or refunding attendees are selected
        const selectedItems = Array.from(selectedIds).map(id => attendees.find(a => a.id === id)).filter(Boolean) as AttendeeItem[];
        
        // Items that cannot be deleted
        const paidItems = selectedItems.filter(item => item.status === 'paid');
        const refundingItems = selectedItems.filter(item => item.status === 'refunding');
        const refundedItems = selectedItems.filter(item => item.status === 'refunded');
        
        if (paidItems.length > 0) {
            showToast(`❌ Cannot delete ${paidItems.length} paid ticket(s). Please refund them first.`, "error");
            return;
        }
        
        if (refundingItems.length > 0) {
            showToast(`⚠️ ${refundingItems.length} ticket(s) are being refunded. Please wait for refund to complete.`, "warning");
            return;
        }

        // Allow deletion of pending, free, and refunded tickets
        const deletableItems = selectedItems.filter(item => 
            item.status === 'pending' || item.status === 'comp' || item.status === 'refunded'
        );
        
        if (deletableItems.length === 0) {
            showToast("❌ No deletable tickets selected. Only pending, free, or refunded tickets can be deleted.", "error");
            return;
        }

        showConfirm({
            title: "Delete Selected Attendees?",
            message: `Are you sure you want to delete ${deletableItems.length} selected attendee(s)? This cannot be undone.\n\n${refundedItems.length > 0 ? `• ${refundedItems.length} refunded ticket(s) will be removed from records.\n` : ''}${selectedItems.length - deletableItems.length > 0 ? `• ${selectedItems.length - deletableItems.length} ticket(s) cannot be deleted (paid or processing).` : ''}`,
            confirmText: "Delete All",
            variant: "danger",
            onConfirm: async () => {
                let successCount = 0;
                let failCount = 0;
                let errors: string[] = [];

                try {
                    for (const item of deletableItems) {
                        try {
                            // Final safety check
                            if (item.status === 'paid' || item.status === 'refunding') {
                                failCount++;
                                errors.push(`${item.name}: Cannot delete - ticket is ${item.status}`);
                                continue;
                            }

                            // Delete based on type
                            if (item.itemType === 'addon') {
                                await StorageService.deleteAddOn(item.regId, item.ticketIndex);
                            } else {
                                await StorageService.deleteTicket(item.regId, item.ticketIndex);
                            }
                            
                            successCount++;
                        } catch (e: any) {
                            failCount++;
                            errors.push(`${item.name}: ${e.message}`);
                        }
                    }

                    await loadData();
                    setSelectedIds(new Set());

                    if (failCount === 0) {
                        showToast(`✅ Successfully deleted ${successCount} attendee(s)!`, "success");
                    } else if (successCount === 0) {
                        showToast(`❌ Failed to delete all ${failCount} attendee(s). Check console for details.`, "error");
                        console.error('Bulk delete errors:', errors);
                    } else {
                        showToast(`⚠️ Partial success: ${successCount} deleted, ${failCount} failed. Check console for details.`, "warning");
                        console.error('Bulk delete errors:', errors);
                    }
                } catch (e: any) {
                    showToast("❌ Bulk delete operation failed: " + e.message, "error");
                }
            }
        });
    };

    const handleBulkRefund = async () => {
        if (selectedIds.size === 0) return;

        // Get all selected items
        const selectedItems = Array.from(selectedIds).map(id => {
            const item = attendees.find(a => a.id === id);
            return item;
        }).filter(Boolean) as AttendeeItem[];

        // Validate: Cannot refund items that are already refunded or refunding
        const invalidItems = selectedItems.filter(item => 
            item.status === 'refunded' || item.status === 'refunding'
        );
        
        if (invalidItems.length > 0) {
            showToast(`❌ ${invalidItems.length} ticket(s) are already refunded or being refunded.`, "error");
            return;
        }

        // Validate: Can only refund paid items (not pending/free)
        const unpaidItems = selectedItems.filter(item => 
            item.status !== 'paid' && item.status !== 'comp'
        );
        
        if (unpaidItems.length === selectedItems.length) {
            showToast(`⚠️ Selected tickets have not been paid. Nothing to refund.`, "warning");
            return;
        }

        // Group by registration ID
        const regIds = [...new Set(selectedItems.map(item => item.regId))];

        if (regIds.length > 1) {
            showToast("⚠️ Cannot refund tickets from multiple orders at once. Please select from one order at a time.", "warning");
            return;
        }

        if (regIds.length === 0) {
            showToast("❌ No valid orders found for refund.", "error");
            return;
        }

        // Navigate to refunds page with pre-selected registration
        navigate(`/manage/${event!.id}/refunds?selectedReg=${regIds[0]}`);
    };

    const handleCheckInToggle = async (item: AttendeeItem) => {
        if (!event) return;
        try {
            const regList = await StorageService.getRegistrations(event.id);
            const reg = regList.find(r => r.id === item.regId);
            if (!reg) return;

            if (item.itemType === 'addon') {
                // Addon Logic
                const updatedAddOns = [...(reg.addOns || [])];
                const addon = updatedAddOns[item.ticketIndex]; // Index is reliable because we map mapped straight from array
                if (addon) {
                    addon.fulfilled = !addon.fulfilled;
                    await StorageService.updateRegistration(reg.id, { addOns: updatedAddOns });
                    // Optimistic update
                    setAttendees(prev => prev.map(a => a.id === item.id ? { ...a, checkedIn: addon.fulfilled!, fulfilled: addon.fulfilled } : a));
                }
            } else {
                // Ticket Logic
                const parts = item.id.split('-');
                const index = parseInt(parts[parts.length - 1]);
                const ticketKey = `${item.tierId}-${index}`;
                const newStatus = !item.checkedIn;
                const statuses = reg.checkInStatuses || {};
                statuses[ticketKey] = { checkedIn: newStatus, timestamp: Date.now() };
                await StorageService.updateRegistration(reg.id, { checkInStatuses: statuses, checkedIn: Object.values(statuses).some((s: any) => s.checkedIn) });

                // Optimistic update
                setAttendees(prev => prev.map(a => a.id === item.id ? { ...a, checkedIn: newStatus } : a));
            }
        } catch (e) { console.error(e); }
    };

    const handleDeleteGuest = async (item: AttendeeItem) => {
        if (!event) return;

        showConfirm({
            title: "Delete Guest",
            message: `Are you sure you want to delete ${item.name}? This will remove them from the guest list.`,
            confirmText: "Delete Guest",
            variant: "danger",
            onConfirm: async () => {
                try {
                    const regList = await StorageService.getRegistrations(event.id);
                    const reg = regList.find(r => r.id === item.regId);

                    if (!reg) return;

                    // Scenario A: Add-on Deletion
                    if (item.itemType === 'addon') {
                        if (reg.addOns && reg.addOns[item.ticketIndex]) {
                            const updatedAddOns = [...reg.addOns];
                            updatedAddOns.splice(item.ticketIndex, 1);
                            await StorageService.updateRegistration(reg.id, { addOns: updatedAddOns });
                        }
                    }
                    // Scenario B: Multi-ticket order (using tickets array)
                    else if (reg.tickets && reg.tickets.length > 0) {
                        const updatedTickets = [...reg.tickets];
                        const targetTicket = updatedTickets[item.ticketIndex];

                        if (targetTicket) {
                            if (targetTicket.quantity > 1) {
                                // Split ticket logic: Decrease quantity of active, add new refunded entry
                                updatedTickets[item.ticketIndex] = { ...targetTicket, quantity: targetTicket.quantity - 1 };
                                updatedTickets.push({ ...targetTicket, quantity: 1, status: 'refunded' });
                            } else {
                                // Single quantity, just mark as refunded
                                updatedTickets[item.ticketIndex] = { ...targetTicket, status: 'refunded' };
                            }
                            await StorageService.refundRegistration(reg.id, updatedTickets, 'Deleted by Organizer');
                        }
                    } else {
                        // Scenario C: Simple/Legacy order (mark whole reg)
                        await StorageService.refundRegistration(reg.id, [], 'Deleted by Organizer');
                    }

                    await loadData(); // Reload UI
                    showToast(`${item.name} deleted from list`, "info");
                } catch (e: any) {
                    showToast("Failed to delete guest: " + e.message, "error");
                }
            }
        });
    };

    const handleApproveAttendee = async (item: AttendeeItem) => {
        if (!event) return;
        try {
            await StorageService.updateRegistration(item.regId, { approvalStatus: 'approved' });
            if (event.ownerId) {
                EmailService.sendEmail(event.ownerId, item.email, `Approved: ${event.title}`, `Hi ${item.name}, your registration for ${event.title} has been approved!`).catch(console.error);
            }
            await loadData();
        } catch (e: any) { window.alert("Approval failed: " + e.message); }
    };

    const handleAddGuest = async () => {
        if (!event || !newGuestData.name) return;
        const tier = event.ticketTiers?.find(t => t.id === newGuestData.tierId) || { id: 'general', name: event.ticketName || 'General', price: event.price };
        try {
            const newReg: Registration = {
                id: `reg-man-${Date.now()}`,
                eventId: event.id,
                attendeeName: newGuestData.name,
                attendeeEmail: newGuestData.email,
                donationAmount: 0,
                answers: {},
                tickets: [{ tierId: tier.id, name: tier.name, pricePerTicket: newGuestData.type === 'comp' ? 0 : tier.price, quantity: newGuestData.quantity }],
                timestamp: Date.now(),
                paymentStatus: 'completed',
                approvalStatus: 'approved',
                source: 'manual',
                internalNotes: newGuestData.type === 'comp' ? 'Manual Comp' : 'Manual Paid Entry'
            };
            await StorageService.saveRegistration(newReg);

            // Handle Waitlist Promotion
            if (newGuestData.waitlistId) {
                await StorageService.updateWaitlistEntry(newGuestData.waitlistId, 'promoted');
            }

            await loadData();
            setShowAddModal(false);
            setNewGuestData({ name: '', email: '', tierId: '', quantity: 1, type: 'comp', waitlistId: '' });
            showToast("Guest added successfully", "success");
        } catch (e: any) { showToast("Failed to add guest: " + e.message, "error"); }
    };

    const handlePromoteWaitlist = (entry: WaitlistEntry) => {
        setNewGuestData({
            name: entry.name,
            email: entry.email,
            tierId: '',
            quantity: 1,
            type: 'comp',
            waitlistId: entry.id
        });
        setShowAddModal(true);
    };

    const handleSaveEdit = async () => {
        if (!showEditModal || !editGuestData.name || !event) return;
        try {
            const regList = await StorageService.getRegistrations(event.id);
            const reg = regList.find(r => r.id === showEditModal.regId);
            if (reg && reg.tickets) {
                const updatedTickets = [...reg.tickets];
                if (updatedTickets[showEditModal.ticketIndex]) {
                    updatedTickets[showEditModal.ticketIndex] = { ...updatedTickets[showEditModal.ticketIndex], attendeeName: editGuestData.name, attendeeEmail: editGuestData.email };
                    await StorageService.updateRegistration(reg.id, { tickets: updatedTickets });
                    if (showEditModal.ticketIndex === 0) await StorageService.updateRegistration(reg.id, { attendeeName: editGuestData.name, attendeeEmail: editGuestData.email });
                    await loadData();
                    setShowEditModal(null);
                    showToast("Guest details updated", "success");
                }
            }
        } catch (e: any) { showToast("Failed to save: " + e.message, "error"); }
    };

    const handleResendEmail = async (item: AttendeeItem) => {
        if (!event || !item.email) return showToast("No email address for this attendee.", "error");

        showConfirm({
            title: "Resend Confirmation?",
            message: `Resend confirmation email to ${item.email}?`,
            confirmText: "Send Email",
            onConfirm: async () => {
                try {
                    const regList = await StorageService.getRegistrations(event.id);
                    const reg = regList.find(r => r.id === item.regId);
                    if (!reg) throw new Error("Registration not found");

                    const organizerUser = await StorageService.getUserById(event.ownerId);
                    const templateId = event.emailSettings?.confirmationTemplateId;
                    let subject = `Confirmation: ${event.title}`;
                    let body = `Hi ${item.name},<br><br>Here is your ticket for ${event.title}.<br><br>Date: ${new Date(event.date).toLocaleDateString()}<br>Location: ${event.location}<br><br>Thanks,<br>${event.organizer}`;

                    if (organizerUser && templateId) {
                        const template = organizerUser.emailTemplates?.find((t: any) => t.id === templateId);
                        if (template) {
                            subject = template.subject;
                            body = EmailService.renderTemplate(template.body, {
                                name: item.name,
                                event: event.title,
                                date: new Date(event.date).toLocaleDateString(),
                                location: event.location,
                                ticketType: item.ticketType
                            });
                        }
                    }

                    await EmailService.sendEmail(event.ownerId, item.email, subject, body);
                    showToast("Email sent successfully!", "success");
                } catch (e: any) {
                    showToast("Failed to send email: " + e.message, "error");
                }
            }
        });
    };

    const handleOpenRefundModal = (item: AttendeeItem) => {
        if (item.status === 'refunded') {
            return window.alert("This ticket is already refunded.");
        }

        // Navigate to refunds page with this registration pre-selected
        navigate(`/manage/${event!.id}/refunds?selectedReg=${item.regId}`);
    };

    const handlePrintBadge = (item: AttendeeItem) => {
        const printWindow = window.open('', '_blank', 'width=400,height=300');
        if (printWindow) {
            printWindow.document.write(`<html><body onload="window.print()"><div style="text-align:center; padding:20px; border:2px solid black; border-radius:10px;"><h1>${event?.title}</h1><h2>${item.name}</h2><div>${item.ticketType.toUpperCase()}</div></div></body></html>`);
            printWindow.document.close();
        }
    };

    const exportCSV = () => {
        const headers = ['Order ID', 'Name', 'Email', 'Ticket Type', 'Status', 'Checked In'];
        const rows = attendees.map(a => [a.regId, a.name, a.email, a.ticketType, a.status, a.checkedIn ? 'Yes' : 'No']);
        const csvContent = "data:text/csv;charset=utf-8," + [headers, ...rows].map(e => e.join(",")).join("\n");
        const encodedUri = encodeURI(csvContent);
        const link = document.createElement("a");
        link.setAttribute("href", encodedUri);
        link.setAttribute("download", `attendees_${event?.title || 'export'}.csv`);
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
    };

    const openDropdown = (e: React.MouseEvent, item: AttendeeItem) => {
        e.stopPropagation();
        const rect = e.currentTarget.getBoundingClientRect();
        // Position dropdown to the right of the button, and align top
        setDropdownState({
            isOpen: true,
            x: rect.right,
            y: rect.bottom,
            item
        });
    };

    if (isLoading) return <div className="min-h-screen flex items-center justify-center"><div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div></div>;

    // Calculate accurate financial totals using paid registrations only
    const paidRegs = allRegistrations.filter(r => isPaidStatus(r.paymentStatus) && !isRefundedStatus(r.paymentStatus));
    const totalRevenue = calculatePaidRevenue(paidRegs);
    const totalTickets = calculatePaidTickets(paidRegs);
    const addOnSummary = getAddOnSummary(paidRegs);
    const totalAddOnRevenue = addOnSummary.reduce((sum, a) => sum + a.totalRevenue, 0);
    const checkInCount = attendees.filter(a => a.checkedIn && a.status !== 'refunded' && a.status !== 'cancelled' && a.itemType === 'ticket').length;

    return (
        <div className="max-w-7xl mx-auto py-6 px-4 pb-24 md:py-8">
            {/* Header */}
            <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4 mb-6">
                <div className="w-full md:w-auto">
                    <button onClick={() => navigate(`/manage/${id}`)} className="text-zinc-500 hover:text-zinc-900 dark:hover:text-white flex items-center text-sm mb-2 transition-colors">
                        <ArrowLeft size={16} className="mr-1" /> Back to Event
                    </button>
                    <div className="flex items-center justify-between">
                        <div>
                            <h1 className="text-3xl md:text-4xl font-black text-zinc-900 dark:text-white uppercase tracking-tight">Guest List</h1>
                            <div className="flex flex-wrap gap-2 mt-2">
                                <Badge color="gray" className="truncate max-w-[200px]">{event?.title}</Badge>
                                <Badge color="purple">{attendees.length} Guests</Badge>
                            </div>
                        </div>
                    </div>
                </div>

                <div className="flex gap-2 w-full md:w-auto">
                    <Button variant="outline" onClick={exportCSV} className="bg-white dark:bg-black border-zinc-200 dark:border-zinc-800 flex-1 md:flex-none justify-center">
                        <Download size={16} className="mr-2" /> Export
                    </Button>
                    <Button onClick={() => setShowAddModal(true)} className="shadow-lg shadow-primary/20 flex-1 md:flex-none justify-center">
                        <Plus size={16} className="mr-2" /> Add Guest
                    </Button>
                </div>
            </div>

            {/* Quick Stats */}
            {(() => {
                // Use accurate calculations from paid registrations
                const ticketGuests = attendees.filter(a => a.itemType === 'ticket' && a.status !== 'refunded' && a.status !== 'cancelled');
                const ticketCheckInCount = ticketGuests.filter(a => a.checkedIn).length;

                return (
                    <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6 md:mb-8">
                        <div className="p-4 rounded-2xl bg-gradient-to-br from-green-50 to-white dark:from-zinc-900 dark:to-black border border-green-100 dark:border-zinc-800">
                            <div className="text-xs font-bold text-zinc-500 uppercase mb-1">Check-in Status</div>
                            <div className="text-2xl font-black text-green-600 dark:text-green-400 flex items-end gap-2">
                                {ticketCheckInCount} <span className="text-sm font-medium text-zinc-400 mb-1">/ {totalTickets}</span>
                            </div>
                            <div className="w-full bg-zinc-200 dark:bg-zinc-800 h-1.5 rounded-full mt-2 overflow-hidden">
                                <div className="bg-green-500 h-full rounded-full transition-all" style={{ width: `${totalTickets > 0 ? (ticketCheckInCount / totalTickets) * 100 : 0}%` }}></div>
                            </div>
                        </div>
                        <div className="p-4 rounded-2xl bg-white dark:bg-black border border-zinc-200 dark:border-zinc-800">
                            <div className="text-xs font-bold text-zinc-500 uppercase mb-1">Ticket Revenue</div>
                            <div className="text-2xl font-black text-zinc-900 dark:text-white truncate">${totalRevenue.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</div>
                        </div>
                        <div className="p-4 rounded-2xl bg-white dark:bg-black border border-zinc-200 dark:border-zinc-800">
                            <div className="text-xs font-bold text-zinc-500 uppercase mb-1">Add-on Revenue</div>
                            <div className="text-2xl font-black text-purple-600 dark:text-purple-400 truncate">${totalAddOnRevenue.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</div>
                        </div>
                        <div className="p-4 rounded-2xl bg-white dark:bg-black border border-zinc-200 dark:border-zinc-800">
                            <div className="text-xs font-bold text-zinc-500 uppercase mb-1">Tickets Sold</div>
                            <div className="text-2xl font-black text-zinc-900 dark:text-white truncate">{totalTickets}</div>
                        </div>
                    </div>
                );
            })()}

            {/* Main Content Card */}
            <div className="flex gap-6 mb-4 border-b border-zinc-200 dark:border-zinc-800">
                <button
                    onClick={() => setActiveTab('attendees')}
                    className={`pb-3 px-2 font-bold text-sm transition-colors relative ${activeTab === 'attendees' ? 'text-zinc-900 dark:text-white' : 'text-zinc-500 hover:text-zinc-700'}`}
                >
                    Attendee List
                    {activeTab === 'attendees' && <div className="absolute bottom-0 left-0 right-0 h-0.5 bg-zinc-900 dark:bg-white rounded-t-full" />}
                </button>
                <button
                    onClick={() => setActiveTab('waitlist')}
                    className={`pb-3 px-2 font-bold text-sm transition-colors relative ${activeTab === 'waitlist' ? 'text-zinc-900 dark:text-white' : 'text-zinc-500 hover:text-zinc-700'}`}
                >
                    Waitlist
                    {waitlist.length > 0 && <Badge color="gray" className="ml-2 scale-75">{waitlist.filter(w => w.status === 'pending').length}</Badge>}
                    {activeTab === 'waitlist' && <div className="absolute bottom-0 left-0 right-0 h-0.5 bg-zinc-900 dark:bg-white rounded-t-full" />}
                </button>
            </div>

            <Card className="p-0 border-zinc-200 dark:border-zinc-800 bg-white dark:bg-black shadow-xl h-auto min-h-[400px]">

                {activeTab === 'attendees' ? (
                    <>
                        {/* Toolbar */}
                        <div className="p-4 border-b border-zinc-200 dark:border-zinc-800 bg-zinc-50/50 dark:bg-zinc-900/50 flex flex-col gap-3">
                            <div className="flex gap-3">
                                <div className="relative flex-1">
                                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-zinc-400" size={16} />
                                    <input
                                        type="text"
                                        placeholder="Search name, email, order ID..."
                                        value={searchTerm}
                                        onChange={e => setSearchTerm(e.target.value)}
                                        className="w-full pl-10 h-12 bg-white dark:bg-black border border-zinc-200 dark:border-zinc-800 rounded-xl outline-none focus:ring-2 focus:ring-primary/50 text-sm"
                                    />
                                </div>
                                {/* Show/Hide Add-ons Toggle */}
                                <button
                                    onClick={() => {
                                        setShowAddOns(!showAddOns);
                                        // Re-process to include/exclude add-ons
                                        if (event) processAttendees(allRegistrations, event);
                                    }}
                                    className={`px-4 h-12 rounded-xl text-xs font-bold uppercase tracking-wider transition-all border flex items-center gap-2 whitespace-nowrap ${
                                        showAddOns
                                            ? 'bg-purple-100 dark:bg-purple-900/30 text-purple-700 dark:text-purple-400 border-purple-300 dark:border-purple-700'
                                            : 'bg-white dark:bg-black text-zinc-500 border-zinc-200 dark:border-zinc-800 hover:border-zinc-400'
                                    }`}
                                >
                                    <ShoppingBag size={14} />
                                    {showAddOns ? <EyeOff size={14} /> : <Eye size={14} />}
                                    Add-ons
                                </button>
                            </div>
                            <div className="flex gap-2 overflow-x-auto pb-1 custom-scrollbar">
                                {['all', 'approvalPending', 'checkedIn', 'notCheckedIn', 'paid', 'pending', 'refunded'].map(f => (
                                    <button
                                        key={f}
                                        onClick={() => setFilterStatus(f)}
                                        className={`px-4 py-2 rounded-lg text-xs font-bold uppercase tracking-wider transition-colors whitespace-nowrap border ${filterStatus === f
                                            ? 'bg-zinc-900 dark:bg-white text-white dark:text-black border-transparent'
                                            : 'bg-white dark:bg-black text-zinc-500 border-zinc-200 dark:border-zinc-800 hover:border-zinc-400'
                                            }`}
                                    >
                                        {f === 'checkedIn' ? 'Checked In' : f === 'notCheckedIn' ? 'Not In' : f === 'approvalPending' ? 'Needs Approval' : f}
                                    </button>
                                ))}
                            </div>
                        </div>

                        {/* List View */}
                        <div className="divide-y divide-zinc-100 dark:divide-zinc-900 max-h-[600px] overflow-y-auto">
                            {filteredAttendees.length === 0 ? (
                                <div className="p-12 text-center text-zinc-500">
                                    <User className="mx-auto h-12 w-12 opacity-20 mb-3" />
                                    <p>No attendees found matching your filters.</p>
                                </div>
                            ) : (
                                filteredAttendees.map(item => (
                                    <div
                                        key={item.id}
                                        className={`group p-4 flex flex-col md:flex-row md:items-center gap-3 md:gap-4 hover:bg-zinc-50 dark:hover:bg-zinc-900/50 transition-colors ${item.checkedIn ? 'bg-green-50/30 dark:bg-green-900/5' : item.approvalStatus === 'pending' ? 'bg-amber-50/30 dark:bg-amber-900/5' : ''}`}
                                    >
                                        {/* Top Row Mobile / Left Desktop */}
                                        <div className="flex items-center gap-3 w-full md:w-auto">
                                            <div onClick={(e) => { e.stopPropagation(); handleSelectRow(item.id); }} className="cursor-pointer shrink-0">
                                                <div className={`w-5 h-5 rounded border flex items-center justify-center transition-colors ${selectedIds.has(item.id) ? 'bg-primary border-primary text-white' : 'border-zinc-300 dark:border-zinc-600 bg-white dark:bg-zinc-800'}`}>
                                                    {selectedIds.has(item.id) && <Check size={12} strokeWidth={4} />}
                                                </div>
                                            </div>
                                            {/* Check-in status indicator (read-only - check-in only via Check-In Portal) */}
                                            <div className="shrink-0">
                                                <div className={`w-10 h-10 rounded-full flex items-center justify-center transition-all ${item.checkedIn
                                                    ? 'bg-green-500 text-white shadow-md shadow-green-500/30'
                                                    : 'bg-zinc-100 dark:bg-zinc-800 text-zinc-300'
                                                    }`} title={item.checkedIn ? 'Checked In' : 'Not Checked In'}>
                                                    {item.checkedIn ? <Check size={18} strokeWidth={3} /> : <User size={18} />}
                                                </div>
                                            </div>

                                            {/* Info */}
                                            <div className="flex-1 min-w-0">
                                                <div className="flex flex-col">
                                                    <div className="flex items-center gap-2 mb-0.5">
                                                        <h3 className={`font-bold text-sm md:text-base truncate ${item.checkedIn ? 'text-zinc-900 dark:text-white' : 'text-zinc-700 dark:text-zinc-300'}`}>
                                                            {item.name}
                                                        </h3>
                                                        {item.approvalStatus === 'pending' && <Badge color="yellow" className="text-[10px] px-1.5 py-0 h-4">Pending Approval</Badge>}
                                                        {item.status === 'refunding' && <Badge color="orange" className="text-[10px] px-1.5 py-0 h-4 animate-pulse">Refunding...</Badge>}
                                                        {item.status === 'refunded' && <Badge color="red" className="text-[10px] px-1.5 py-0 h-4">Refunded</Badge>}
                                                        {item.status !== 'paid' && item.status !== 'refunded' && item.status !== 'refunding' && <Badge color="yellow" className="text-[10px] px-1.5 py-0 h-4">{item.status}</Badge>}
                                                    </div>
                                                    <div className="text-xs text-zinc-500 flex flex-wrap items-center gap-x-2 gap-y-1">
                                                        <span className="flex items-center gap-1 truncate max-w-[120px]"><Ticket size={10} /> {item.ticketType}</span>
                                                        <span className="hidden md:inline w-1 h-1 rounded-full bg-zinc-300 dark:bg-zinc-700"></span>
                                                        <span className="flex items-center gap-1 truncate max-w-[150px]"><Mail size={10} /> {item.email}</span>
                                                    </div>
                                                </div>
                                            </div>

                                            {/* Mobile Menu Trigger */}
                                            <div className="md:hidden relative">
                                                <button onClick={(e) => openDropdown(e, item)} className="p-2 text-zinc-400 hover:text-zinc-600 dark:hover:text-zinc-200">
                                                    <MoreHorizontal size={24} />
                                                </button>
                                            </div>
                                        </div>

                                        {/* Desktop Actions */}
                                        <div className="hidden md:flex gap-1 opacity-100 md:opacity-0 group-hover:opacity-100 transition-opacity ml-auto items-center">
                                            {item.approvalStatus === 'pending' && (
                                                <Button size="sm" variant="secondary" onClick={() => handleApproveAttendee(item)} className="h-8 px-3 text-[10px] font-black uppercase">Approve</Button>
                                            )}
                                            <button onClick={() => handleCheckInToggle(item)} className="px-3 py-1.5 bg-white dark:bg-black border border-zinc-200 dark:border-zinc-700 rounded-lg text-xs font-bold hover:bg-zinc-50 dark:hover:bg-zinc-800 transition-colors whitespace-nowrap">
                                                {item.itemType === 'addon' ? (item.checkedIn ? 'Completed' : 'Complete') : (item.checkedIn ? 'Undo Check-in' : 'Check In')}
                                            </button>
                                            <button onClick={() => { setEditGuestData({ name: item.name, email: item.email }); setShowEditModal(item); }} className="p-1.5 text-zinc-400 hover:text-zinc-900 dark:hover:text-white transition-colors" title="Edit">
                                                <Edit size={16} />
                                            </button>
                                            <button onClick={() => handleResendEmail(item)} className="p-1.5 text-zinc-400 hover:text-zinc-900 dark:hover:text-white transition-colors" title="Resend Email">
                                                <Mail size={16} />
                                            </button>
                                            <button onClick={() => handlePrintBadge(item)} className="p-1.5 text-zinc-400 hover:text-zinc-900 dark:hover:text-white transition-colors" title="Print">
                                                <Printer size={16} />
                                            </button>
                                            <button onClick={() => handleDeleteGuest(item)} className="p-1.5 text-zinc-400 hover:text-red-500 transition-colors" title="Delete">
                                                <Trash2 size={16} />
                                            </button>
                                            {item.status === 'paid' && (
                                                <button onClick={() => handleOpenRefundModal(item)} className="p-1.5 text-zinc-400 hover:text-red-500 transition-colors" title="Refund">
                                                    <DollarSign size={16} />
                                                </button>
                                            )}
                                        </div>
                                    </div>
                                ))
                            )}
                        </div>
                    </>
                ) : (
                    // Waitlist Logic
                    <div className="divide-y divide-zinc-100 dark:divide-zinc-900">
                        {waitlist.length === 0 ? (
                            <div className="p-12 text-center text-zinc-500">
                                <Hourglass className="mx-auto h-12 w-12 opacity-20 mb-3" />
                                <p>Waitlist is empty.</p>
                            </div>
                        ) : (
                            waitlist.map(w => (
                                <div key={w.id} className="p-4 flex justify-between items-center hover:bg-zinc-50 dark:hover:bg-zinc-900/50">
                                    <div className="flex gap-4 items-center">
                                        <div className="w-10 h-10 rounded-full bg-zinc-100 dark:bg-zinc-800 flex items-center justify-center text-zinc-400">
                                            <Hourglass size={18} />
                                        </div>
                                        <div>
                                            <div className="font-bold flex items-center gap-2">
                                                {w.name}
                                                {w.status === 'promoted' && <Badge color="green" className="text-xs">Promoted</Badge>}
                                                {w.status === 'expired' && <Badge color="red" className="text-xs">Expired</Badge>}
                                            </div>
                                            <div className="text-sm text-zinc-500">{w.email} • Joined {new Date(w.dateJoined).toLocaleDateString()}</div>
                                        </div>
                                    </div>
                                    <div>
                                        {w.status === 'pending' && (
                                            <Button size="sm" onClick={() => handlePromoteWaitlist(w)}>Promote to Guest</Button>
                                        )}
                                    </div>
                                </div>
                            ))

                        )}
                    </div>
                )}
            </Card>

            {/* Bulk Action Bar */}
            {selectedIds.size > 0 && (
                <div className="fixed bottom-6 left-1/2 -translate-x-1/2 bg-zinc-900 text-white dark:bg-white dark:text-black px-6 py-3 rounded-full shadow-2xl z-40 flex items-center gap-4 animate-in slide-in-from-bottom-10 fade-in">
                    <span className="font-bold text-sm">{selectedIds.size} selected</span>
                    <div className="h-4 w-px bg-white/20 dark:bg-black/20"></div>
                    <button onClick={handleBulkRefund} className="font-bold text-sm text-red-500 hover:text-red-400 dark:text-red-600 dark:hover:text-red-700 flex items-center gap-2">
                        <DollarSign size={16} /> Refund Selected
                    </button>
                    <button onClick={handleBulkDelete} className="font-bold text-sm text-red-500 hover:text-red-400 dark:text-red-600 dark:hover:text-red-700 flex items-center gap-2">
                        <Trash2 size={16} /> Delete Selected
                    </button>
                    <button onClick={() => setSelectedIds(new Set())} className="ml-2 hover:opacity-70">
                        <X size={16} />
                    </button>
                </div>
            )}

            {/* Global Fixed Dropdown - Renders outside of overflow containers */}
            {dropdownState.isOpen && dropdownState.item && (
                <>
                    <div className="fixed inset-0 z-40" onClick={() => setDropdownState({ ...dropdownState, isOpen: false })}></div>
                    <div
                        style={{ top: dropdownState.y + 5, left: Math.min(window.innerWidth - 200, dropdownState.x - 180) }}
                        className="fixed w-48 bg-white dark:bg-zinc-800 border border-zinc-200 dark:border-zinc-700 shadow-xl rounded-xl z-50 overflow-hidden py-1 animate-in fade-in zoom-in-95"
                    >
                        <button onClick={() => { handleCheckInToggle(dropdownState.item!); setDropdownState(prev => ({ ...prev, isOpen: false })); }} className="w-full text-left px-4 py-3 text-sm hover:bg-zinc-100 dark:hover:bg-zinc-700 font-bold flex items-center gap-2">
                            <Check size={16} /> {dropdownState.item.checkedIn ? 'Undo Check-in' : 'Check In'}
                        </button>
                        <button onClick={() => { setEditGuestData({ name: dropdownState.item!.name, email: dropdownState.item!.email }); setShowEditModal(dropdownState.item); setDropdownState(prev => ({ ...prev, isOpen: false })); }} className="w-full text-left px-4 py-3 text-sm hover:bg-zinc-100 dark:hover:bg-zinc-700 flex items-center gap-2">
                            <Edit size={16} /> Edit Details
                        </button>
                        <button onClick={() => { handleResendEmail(dropdownState.item!); setDropdownState(prev => ({ ...prev, isOpen: false })); }} className="w-full text-left px-4 py-3 text-sm hover:bg-zinc-100 dark:hover:bg-zinc-700 flex items-center gap-2">
                            <Mail size={16} /> Resend Email
                        </button>
                        <button onClick={() => { handlePrintBadge(dropdownState.item!); setDropdownState(prev => ({ ...prev, isOpen: false })); }} className="w-full text-left px-4 py-3 text-sm hover:bg-zinc-100 dark:hover:bg-zinc-700 flex items-center gap-2">
                            <Printer size={16} /> Print Badge
                        </button>
                        <button onClick={() => { handleDeleteGuest(dropdownState.item!); setDropdownState(prev => ({ ...prev, isOpen: false })); }} className="w-full text-left px-4 py-3 text-sm text-red-600 hover:bg-red-50 dark:hover:bg-red-900/10 font-bold flex items-center gap-2 border-t border-zinc-100 dark:border-zinc-700">
                            <Trash2 size={16} /> Remove Guest
                        </button>
                        {dropdownState.item?.status === 'paid' && (
                            <button onClick={() => { handleOpenRefundModal(dropdownState.item!); setDropdownState(prev => ({ ...prev, isOpen: false })); }} className="w-full text-left px-4 py-3 text-sm text-red-600 hover:bg-red-50 dark:hover:bg-red-900/10 font-bold flex items-center gap-2 border-t border-zinc-100 dark:border-zinc-700">
                                <DollarSign size={16} /> Refund
                            </button>
                        )}
                    </div>
                </>
            )}

            {/* Modals */}
            {showAddModal && (
                <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm animate-in fade-in">
                    <Card className="w-full max-w-md p-6">
                        <h3 className="text-xl font-bold mb-4">Add Guest Manually</h3>
                        <div className="space-y-4">
                            <Input label="Name" value={newGuestData.name} onChange={e => setNewGuestData({ ...newGuestData, name: e.target.value })} />
                            <Input label="Email" value={newGuestData.email} onChange={e => setNewGuestData({ ...newGuestData, email: e.target.value })} />
                            <Select
                                label="Ticket Type"
                                value={newGuestData.tierId}
                                onChange={e => setNewGuestData({ ...newGuestData, tierId: e.target.value })}
                                options={event?.ticketTiers?.map(t => ({ value: t.id, label: `${t.name} ($${t.price})` })) || [{ value: 'general', label: 'General' }]}
                            />
                            <div className="flex gap-2 justify-end mt-6">
                                <Button variant="ghost" onClick={() => setShowAddModal(false)}>Cancel</Button>
                                <Button onClick={handleAddGuest}>Add Guest</Button>
                            </div>
                        </div>
                    </Card>
                </div>
            )
            }

            {
                showEditModal && (
                    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm animate-in fade-in">
                        <Card className="w-full max-w-md p-6">
                            <h3 className="text-xl font-bold mb-4">Edit Attendee</h3>
                            <div className="space-y-4">
                                <Input label="Name" value={editGuestData.name} onChange={e => setEditGuestData({ ...editGuestData, name: e.target.value })} />
                                <Input label="Email" value={editGuestData.email} onChange={e => setEditGuestData({ ...editGuestData, email: e.target.value })} />
                                <div className="flex gap-2 justify-end mt-6">
                                    <Button variant="ghost" onClick={() => setShowEditModal(null)}>Cancel</Button>
                                    <Button onClick={handleSaveEdit}>Save Changes</Button>
                                </div>
                            </div>
                        </Card>
                    </div>
                )
            }

            {/* Refund Modal removed - now redirects to refunds page */}
        </div >
    );
};
