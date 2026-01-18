import React, { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { StorageService } from '../services/storageService';
import { Event, Registration } from '../types';
import { Button, Card, Badge, Input } from './UI';
import {
    ArrowLeft, DollarSign, RefreshCw, AlertCircle, CheckCircle,
    ExternalLink, Mail, Loader, Search
} from 'lucide-react';

interface RefundItem {
    registration: Registration;
    selectedTickets: number[]; // indices of tickets to refund
    refundAmount: number;
}

export const EventRefunds = () => {
    const { id } = useParams<{ id: string }>();
    const navigate = useNavigate();
    const [event, setEvent] = useState<Event | null>(null);
    const [registrations, setRegistrations] = useState<Registration[]>([]);
    const [selectedRefund, setSelectedRefund] = useState<RefundItem | null>(null);
    const [refundReason, setRefundReason] = useState('');
    const [isProcessing, setIsProcessing] = useState(false);
    const [searchQuery, setSearchQuery] = useState('');
    const [showSuccess, setShowSuccess] = useState(false);
    const [successDetails, setSuccessDetails] = useState<any>(null);

    const calculateRefundAmount = (reg: Registration, ticketIndices: number[]) => {
        if (!reg.tickets) return 0;
        
        return ticketIndices.reduce((sum, idx) => {
            const ticket = reg.tickets![idx];
            if (ticket && ticket.status !== 'refunded' && ticket.status !== 'refunding') {
                const ticketPrice = ticket.pricePerTicket || ticket.price || 0;
                const ticketQty = ticket.quantity || 1;
                return sum + (ticketPrice * ticketQty);
            }
            return sum;
        }, 0);
    };

    const handleSelectOrder = (reg: Registration) => {
        if (!reg.tickets) return;
        
        // Select all non-refunded tickets
        const ticketIndices = reg.tickets
            .map((t, idx) => t.status !== 'refunded' ? idx : -1)
            .filter(idx => idx !== -1);
        
        const amount = calculateRefundAmount(reg, ticketIndices);
        
        setSelectedRefund({
            registration: reg,
            selectedTickets: ticketIndices,
            refundAmount: amount
        });
    };

    const handleSelectTicket = (reg: Registration, ticketIndex: number) => {
        const amount = calculateRefundAmount(reg, [ticketIndex]);
        
        setSelectedRefund({
            registration: reg,
            selectedTickets: [ticketIndex],
            refundAmount: amount
        });
    };

    useEffect(() => {
        const init = async () => {
            await loadData();
        };
        init();
    }, [id]);

    const loadData = async () => {
        if (!id) return;
        
        const e = await StorageService.getEventFull(id);
        if (e) setEvent(e);

        const regs = await StorageService.getRegistrations(id);
        // Only show paid registrations that aren't fully refunded
        const refundableRegs = regs.filter(r => 
            (r.paymentStatus === 'paid' || r.paymentStatus === 'completed') &&
            r.tickets?.some(t => t.status !== 'refunded')
        );
        setRegistrations(refundableRegs);

        // Check for pre-selected registration from URL
        const urlParams = new URLSearchParams(window.location.search);
        const selectedRegId = urlParams.get('selectedReg');
        
        if (selectedRegId) {
            const preSelectedReg = refundableRegs.find(r => r.id === selectedRegId);
            if (preSelectedReg) {
                // Auto-select this order for refund
                handleSelectOrder(preSelectedReg);
            }
        }
    };

    const handleProcessRefund = async () => {
        if (!selectedRefund || !refundReason.trim()) {
            window.alert('Please provide a refund reason');
            return;
        }

        setIsProcessing(true);
        try {
            const { registration, selectedTickets } = selectedRefund;
            
            // Determine if full order or partial
            const isFullOrder = selectedTickets.length === registration.tickets?.length;
            
            let response;
            if (isFullOrder) {
                // Full order refund
                response = await StorageService.refundRegistration(
                    registration.id,
                    [], // Empty array signals full refund
                    refundReason
                );
            } else {
                // Partial refund - mark selected tickets as refunded
                const updatedTickets = registration.tickets!.map((ticket, idx) => {
                    if (selectedTickets.includes(idx)) {
                        return { ...ticket, status: 'refunded' as const };
                    }
                    return ticket;
                });
                
                response = await StorageService.refundRegistration(
                    registration.id,
                    updatedTickets,
                    refundReason
                );
            }

            // Check response
            if (response && response.error) {
                throw new Error(response.error);
            }

            // Success!
            setSuccessDetails(response);
            setShowSuccess(true);
            
            // Reload data
            await loadData();
            
            // Auto-close success after 5 seconds
            setTimeout(() => {
                setShowSuccess(false);
                setSelectedRefund(null);
                setRefundReason('');
            }, 5000);

        } catch (error: any) {
            window.alert('Refund failed: ' + error.message);
        } finally {
            setIsProcessing(false);
        }
    };

    const filteredRegistrations = registrations.filter(reg => {
        if (!searchQuery) return true;
        const query = searchQuery.toLowerCase();
        return (
            reg.attendeeName?.toLowerCase().includes(query) ||
            reg.attendeeEmail?.toLowerCase().includes(query) ||
            reg.id.toLowerCase().includes(query)
        );
    });

    if (!event) {
        return (
            <div className="min-h-screen bg-gradient-to-br from-zinc-950 via-zinc-900 to-zinc-950 p-8 flex items-center justify-center">
                <Loader className="animate-spin text-primary" size={48} />
            </div>
        );
    }

    return (
        <div className="min-h-screen bg-gradient-to-br from-zinc-950 via-zinc-900 to-zinc-950 p-8">
            <div className="max-w-6xl mx-auto">
                {/* Header */}
                <div className="mb-8">
                    <Button
                        variant="ghost"
                        onClick={() => navigate(`/manage/${id}`)}
                        className="mb-4"
                    >
                        <ArrowLeft size={18} className="mr-2" /> Back to Event
                    </Button>
                    
                    <div className="flex items-center gap-4 mb-2">
                        <div className="p-3 bg-red-500/10 text-red-500 rounded-xl">
                            <DollarSign size={32} />
                        </div>
                        <div>
                            <h1 className="text-4xl font-black text-white">Refunds</h1>
                            <p className="text-zinc-400">{event.title}</p>
                        </div>
                    </div>
                </div>

                {/* Success Modal */}
                {showSuccess && successDetails && (
                    <Card className="p-6 mb-6 border-green-500 bg-green-500/5">
                        <div className="flex items-start gap-4">
                            <CheckCircle className="text-green-500 flex-shrink-0" size={32} />
                            <div className="flex-1">
                                <h3 className="text-xl font-bold text-white mb-2">Refund Successful!</h3>
                                <div className="space-y-2 text-sm">
                                    <p className="text-zinc-300">
                                        <strong>Amount:</strong> ${successDetails.refundAmount?.toFixed(2)}
                                    </p>
                                    <p className="text-zinc-300">
                                        <strong>Tickets Refunded:</strong> {successDetails.ticketsRefunded}
                                    </p>
                                    {successDetails.stripeRefundId && (
                                        <p className="text-zinc-300 flex items-center gap-2">
                                            <strong>Stripe Refund ID:</strong> 
                                            <code className="bg-zinc-800 px-2 py-1 rounded text-xs">
                                                {successDetails.stripeRefundId}
                                            </code>
                                            <a
                                                href={`https://dashboard.stripe.com/refunds/${successDetails.stripeRefundId}`}
                                                target="_blank"
                                                rel="noopener noreferrer"
                                                className="text-blue-400 hover:text-blue-300"
                                            >
                                                <ExternalLink size={14} />
                                            </a>
                                        </p>
                                    )}
                                    <p className="text-zinc-400 flex items-center gap-2 mt-4">
                                        <Mail size={14} />
                                        Refund confirmation email sent to customer
                                    </p>
                                </div>
                            </div>
                        </div>
                    </Card>
                )}

                {/* Refund Modal */}
                {selectedRefund && !showSuccess && (
                    <Card className="p-6 mb-6 border-yellow-500">
                        <h3 className="text-xl font-bold text-white mb-4">Confirm Refund</h3>
                        
                        <div className="space-y-4 mb-6">
                            <div className="bg-zinc-800/50 p-4 rounded-lg">
                                <p className="text-sm text-zinc-400 mb-2">Customer</p>
                                <p className="font-bold text-white">{selectedRefund.registration.attendeeName}</p>
                                <p className="text-sm text-zinc-400">{selectedRefund.registration.attendeeEmail}</p>
                            </div>

                            <div className="bg-zinc-800/50 p-4 rounded-lg">
                                <p className="text-sm text-zinc-400 mb-2">Refund Amount</p>
                                <p className="text-3xl font-black text-red-500">
                                    ${selectedRefund.refundAmount.toFixed(2)}
                                </p>
                                <p className="text-xs text-zinc-500 mt-1">
                                    {selectedRefund.selectedTickets.length} ticket(s) • 
                                    {selectedRefund.selectedTickets.length === selectedRefund.registration.tickets?.length 
                                        ? ' Full Order' 
                                        : ' Partial Refund'}
                                </p>
                            </div>

                            <div>
                                <label className="block text-sm font-medium text-zinc-300 mb-2">
                                    Refund Reason *
                                </label>
                                <Input
                                    value={refundReason}
                                    onChange={(e) => setRefundReason(e.target.value)}
                                    placeholder="e.g., Customer requested refund"
                                    className="w-full"
                                />
                            </div>

                            <div className="bg-blue-500/10 border border-blue-500/30 rounded-lg p-4">
                                <p className="text-sm text-blue-300">
                                    <strong>How it works:</strong>
                                </p>
                                <ul className="text-xs text-blue-200 mt-2 space-y-1 ml-4 list-disc">
                                    <li>Refund will be processed via Stripe API</li>
                                    <li>Funds return to customer's original payment method</li>
                                    <li>Processing time: 5-10 business days</li>
                                    <li>Customer receives automatic confirmation email</li>
                                </ul>
                            </div>
                        </div>

                        <div className="flex gap-3">
                            <Button
                                onClick={handleProcessRefund}
                                disabled={isProcessing || !refundReason.trim()}
                                className="flex-1 bg-red-500 hover:bg-red-600 text-white border-none"
                            >
                                {isProcessing ? (
                                    <>
                                        <Loader className="animate-spin mr-2" size={18} />
                                        Processing with Stripe...
                                    </>
                                ) : (
                                    <>
                                        <DollarSign size={18} className="mr-2" />
                                        Confirm Refund ${selectedRefund.refundAmount.toFixed(2)}
                                    </>
                                )}
                            </Button>
                            <Button
                                variant="ghost"
                                onClick={() => {
                                    setSelectedRefund(null);
                                    setRefundReason('');
                                }}
                                disabled={isProcessing}
                            >
                                Cancel
                            </Button>
                        </div>
                    </Card>
                )}

                {/* Search */}
                <div className="mb-6">
                    <div className="relative">
                        <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-zinc-500" size={18} />
                        <Input
                            value={searchQuery}
                            onChange={(e) => setSearchQuery(e.target.value)}
                            placeholder="Search by name, email, or order ID..."
                            className="pl-10"
                        />
                    </div>
                </div>

                {/* Orders List */}
                <div className="space-y-4">
                    {filteredRegistrations.length === 0 ? (
                        <Card className="p-12 text-center">
                            <AlertCircle className="mx-auto mb-4 text-zinc-500" size={48} />
                            <p className="text-zinc-400">No refundable orders found</p>
                        </Card>
                    ) : (
                        filteredRegistrations.map(reg => (
                            <Card key={reg.id} className="p-6 hover:border-primary/50 transition-colors">
                                <div className="flex items-start justify-between mb-4">
                                    <div>
                                        <h4 className="font-bold text-white text-lg">{reg.attendeeName}</h4>
                                        <p className="text-sm text-zinc-400">{reg.attendeeEmail}</p>
                                        <p className="text-xs text-zinc-500 mt-1">Order ID: {reg.id.substring(0, 8)}</p>
                                    </div>
                                    <Button
                                        onClick={() => handleSelectOrder(reg)}
                                        className="bg-red-500 hover:bg-red-600 text-white border-none"
                                    >
                                        <DollarSign size={18} className="mr-2" />
                                        Refund Order
                                    </Button>
                                </div>

                                {/* Tickets */}
                                {reg.tickets && reg.tickets.length > 0 && (
                                    <div className="mt-4 space-y-2">
                                        <p className="text-xs font-bold text-zinc-400 uppercase">Tickets</p>
                                        {reg.tickets.map((ticket, idx) => {
                                            const ticketName = ticket.name || ticket.tierId || 'Ticket';
                                            const ticketPrice = ticket.pricePerTicket || ticket.price || 0;
                                            const ticketQty = ticket.quantity || 1;
                                            
                                            return (
                                                <div
                                                    key={idx}
                                                    className="flex items-center justify-between bg-zinc-800/30 p-3 rounded-lg"
                                                >
                                                    <div className="flex-1">
                                                        <p className="text-sm text-white">
                                                            {ticketName} x {ticketQty}
                                                        </p>
                                                        <p className="text-xs text-zinc-500">
                                                            ${(ticketPrice * ticketQty).toFixed(2)}
                                                        </p>
                                                    </div>
                                                    {ticket.status === 'refunded' ? (
                                                        <Badge className="bg-red-500 text-white border-none">
                                                            REFUNDED
                                                        </Badge>
                                                    ) : ticket.status === 'refunding' ? (
                                                        <Badge className="bg-yellow-500 text-black border-none animate-pulse">
                                                            REFUNDING...
                                                        </Badge>
                                                    ) : (
                                                        <Button
                                                            size="sm"
                                                            variant="ghost"
                                                            onClick={() => handleSelectTicket(reg, idx)}
                                                            className="text-red-400 hover:text-red-300"
                                                            data-testid={`refund-ticket-${reg.id}-${idx}`}
                                                        >
                                                            Refund Ticket
                                                        </Button>
                                                    )}
                                                </div>
                                            );
                                        })}
                                    </div>
                                )}
                            </Card>
                        ))
                    )}
                </div>
            </div>
        </div>
    );
};
