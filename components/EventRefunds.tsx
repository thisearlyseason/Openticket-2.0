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

    // Generate refund confirmation email
    const generateRefundEmail = (reg: Registration, refundAmount: number, ticketsRefunded: number, reason: string) => {
        const eventTitle = event?.title || 'Event';
        const eventDate = event?.date ? new Date(event.date).toLocaleDateString('en-US', { 
            weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' 
        }) : 'TBD';
        const eventLocation = event?.location || event?.venueName || 'TBD';
        
        const subject = `Refund Confirmation - ${eventTitle}`;
        
        const body = `
<!DOCTYPE html>
<html>
<head>
    <meta charset="utf-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
</head>
<body style="margin: 0; padding: 0; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif; background-color: #f5f5f5;">
    <table width="100%" cellpadding="0" cellspacing="0" style="background-color: #f5f5f5; padding: 40px 20px;">
        <tr>
            <td align="center">
                <table width="100%" style="max-width: 600px; background-color: #ffffff; border-radius: 12px; overflow: hidden; box-shadow: 0 4px 6px rgba(0, 0, 0, 0.1);">
                    <!-- Header -->
                    <tr>
                        <td style="background: linear-gradient(135deg, #dc2626 0%, #b91c1c 100%); padding: 40px 30px; text-align: center;">
                            <h1 style="color: #ffffff; margin: 0; font-size: 28px; font-weight: 700;">Refund Confirmation</h1>
                            <p style="color: rgba(255,255,255,0.9); margin: 10px 0 0 0; font-size: 16px;">Your refund has been processed</p>
                        </td>
                    </tr>
                    
                    <!-- Content -->
                    <tr>
                        <td style="padding: 40px 30px;">
                            <p style="color: #374151; font-size: 16px; line-height: 1.6; margin: 0 0 20px 0;">
                                Hi <strong>${reg.attendeeName || 'Guest'}</strong>,
                            </p>
                            <p style="color: #374151; font-size: 16px; line-height: 1.6; margin: 0 0 30px 0;">
                                We've processed a refund for your ticket(s) to <strong>${eventTitle}</strong>. Here are the details:
                            </p>
                            
                            <!-- Refund Details Box -->
                            <table width="100%" style="background-color: #fef2f2; border: 1px solid #fecaca; border-radius: 8px; margin-bottom: 30px;">
                                <tr>
                                    <td style="padding: 20px;">
                                        <table width="100%">
                                            <tr>
                                                <td style="padding: 8px 0; border-bottom: 1px solid #fecaca;">
                                                    <span style="color: #6b7280; font-size: 14px;">Refund Amount</span>
                                                </td>
                                                <td style="padding: 8px 0; border-bottom: 1px solid #fecaca; text-align: right;">
                                                    <strong style="color: #dc2626; font-size: 18px;">$${refundAmount.toFixed(2)}</strong>
                                                </td>
                                            </tr>
                                            <tr>
                                                <td style="padding: 8px 0; border-bottom: 1px solid #fecaca;">
                                                    <span style="color: #6b7280; font-size: 14px;">Tickets Refunded</span>
                                                </td>
                                                <td style="padding: 8px 0; border-bottom: 1px solid #fecaca; text-align: right;">
                                                    <strong style="color: #374151;">${ticketsRefunded}</strong>
                                                </td>
                                            </tr>
                                            <tr>
                                                <td style="padding: 8px 0;">
                                                    <span style="color: #6b7280; font-size: 14px;">Order ID</span>
                                                </td>
                                                <td style="padding: 8px 0; text-align: right;">
                                                    <strong style="color: #374151; font-family: monospace;">${reg.id.substring(0, 8).toUpperCase()}</strong>
                                                </td>
                                            </tr>
                                        </table>
                                    </td>
                                </tr>
                            </table>
                            
                            ${reason ? `
                            <!-- Reason -->
                            <div style="background-color: #f9fafb; border-radius: 8px; padding: 15px; margin-bottom: 30px;">
                                <p style="color: #6b7280; font-size: 12px; text-transform: uppercase; margin: 0 0 5px 0;">Reason</p>
                                <p style="color: #374151; font-size: 14px; margin: 0;">${reason}</p>
                            </div>
                            ` : ''}
                            
                            <!-- Event Details -->
                            <table width="100%" style="background-color: #f9fafb; border-radius: 8px; margin-bottom: 30px;">
                                <tr>
                                    <td style="padding: 20px;">
                                        <p style="color: #6b7280; font-size: 12px; text-transform: uppercase; margin: 0 0 10px 0;">Event Details</p>
                                        <p style="color: #111827; font-size: 18px; font-weight: 600; margin: 0 0 10px 0;">${eventTitle}</p>
                                        <p style="color: #6b7280; font-size: 14px; margin: 0;">📅 ${eventDate}</p>
                                        <p style="color: #6b7280; font-size: 14px; margin: 5px 0 0 0;">📍 ${eventLocation}</p>
                                    </td>
                                </tr>
                            </table>
                            
                            <!-- Notice -->
                            <p style="color: #6b7280; font-size: 14px; line-height: 1.6; margin: 0;">
                                Your refund should appear in your account within 5-10 business days, depending on your payment provider. If you have any questions, please contact the event organizer.
                            </p>
                        </td>
                    </tr>
                    
                    <!-- Footer -->
                    <tr>
                        <td style="background-color: #f9fafb; padding: 30px; text-align: center; border-top: 1px solid #e5e7eb;">
                            <p style="color: #9ca3af; font-size: 12px; margin: 0;">
                                This is an automated message from OpenTicket
                            </p>
                        </td>
                    </tr>
                </table>
            </td>
        </tr>
    </table>
</body>
</html>`;

        return { subject, body };
    };

    const handleSelectOrder = (reg: Registration) => {
        if (!reg.tickets) return;
        
        // Select all non-refunded and non-refunding tickets
        const ticketIndices = reg.tickets
            .map((t, idx) => (t.status !== 'refunded' && t.status !== 'refunding') ? idx : -1)
            .filter(idx => idx !== -1);
        
        if (ticketIndices.length === 0) {
            window.alert('No refundable tickets in this order');
            return;
        }
        
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
            
            // Validate we're not processing an already-refunding order
            if (registration.refundStatus === 'refunding') {
                throw new Error('A refund is already being processed for this order. Please wait.');
            }
            
            // Determine if full order or partial based on active (non-refunded) tickets
            const activeTickets = registration.tickets?.filter(t => t.status !== 'refunded' && t.status !== 'refunding') || [];
            const isFullOrder = selectedTickets.length === activeTickets.length;
            
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

            // Check response for errors
            if (response && response.error) {
                // Enhanced error handling with diagnostics
                let errorMessage = response.error;
                if (response.stripeError) {
                    errorMessage += `\n\nStripe Error: ${response.stripeError}`;
                }
                if (response.diagnostics) {
                    console.error('[Refund] Diagnostics:', response.diagnostics);
                }
                throw new Error(errorMessage);
            }
            
            // Check for canRefund flag (Stripe-first enforcement)
            if (response && response.canRefund === false) {
                let errorMessage = response.error || 'Refund cannot be processed';
                if (response.diagnostics) {
                    errorMessage += `\n\nDetails: ${JSON.stringify(response.diagnostics, null, 2)}`;
                }
                throw new Error(errorMessage);
            }

            // Success!
            setSuccessDetails(response);
            setShowSuccess(true);
            
            // NOTE: Refund confirmation email is sent by the Stripe webhook (refund.succeeded)
            // when the refund is actually processed by Stripe. This ensures email is only sent
            // after confirmed Stripe refund, not just after UI action.
            // See: backend/controllers/stripeWebhookController.js -> handleRefund()
            
            // Reload data
            await loadData();
            
            // Auto-close success after 5 seconds
            setTimeout(() => {
                setShowSuccess(false);
                setSelectedRefund(null);
                setRefundReason('');
            }, 5000);

        } catch (error: any) {
            // Show detailed error in a user-friendly way
            console.error('[Refund] Error:', error);
            
            // Parse error message for better display
            const errorParts = error.message.split('\n\n');
            const mainError = errorParts[0] || 'An error occurred';
            const stripeError = errorParts.find((p: string) => p.startsWith('Stripe Error:'));
            
            // Create a more informative error message
            let userMessage = `❌ Refund Failed\n\n${mainError}`;
            
            if (stripeError) {
                userMessage += `\n\n${stripeError}`;
                
                // Add helpful hints based on common Stripe errors
                if (error.message.includes('charge_already_refunded')) {
                    userMessage += '\n\n💡 This payment has already been refunded in Stripe.';
                } else if (error.message.includes('charge_not_found')) {
                    userMessage += '\n\n💡 The original payment could not be found in Stripe.';
                } else if (error.message.includes('insufficient_funds')) {
                    userMessage += '\n\n💡 Your Stripe account has insufficient funds for this refund.';
                }
            }
            
            window.alert(userMessage);
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
                        filteredRegistrations.map(reg => {
                            const isRefunding = reg.refundStatus === 'refunding';
                            
                            return (
                                <Card 
                                    key={reg.id} 
                                    className={`p-6 hover:border-primary/50 transition-colors ${isRefunding ? 'border-yellow-500 bg-yellow-500/5' : ''}`}
                                    data-testid={`refund-order-card-${reg.id}`}
                                >
                                    <div className="flex items-start justify-between mb-4">
                                        <div>
                                            <div className="flex items-center gap-2">
                                                <h4 className="font-bold text-white text-lg">{reg.attendeeName}</h4>
                                                {isRefunding && (
                                                    <Badge className="bg-yellow-500 text-black border-none animate-pulse">
                                                        Processing...
                                                    </Badge>
                                                )}
                                            </div>
                                            <p className="text-sm text-zinc-400">{reg.attendeeEmail}</p>
                                            <p className="text-xs text-zinc-500 mt-1">Order ID: {reg.id.substring(0, 8)}</p>
                                        </div>
                                        <Button
                                            onClick={() => handleSelectOrder(reg)}
                                            className="bg-red-500 hover:bg-red-600 text-white border-none"
                                            disabled={isRefunding}
                                            data-testid={`refund-order-btn-${reg.id}`}
                                        >
                                            {isRefunding ? (
                                                <>
                                                    <Loader className="animate-spin mr-2" size={18} />
                                                    Refunding...
                                                </>
                                            ) : (
                                                <>
                                                    <DollarSign size={18} className="mr-2" />
                                                    Refund Order
                                                </>
                                            )}
                                        </Button>
                                    </div>

                                {/* Tickets */}
                                {reg.tickets && reg.tickets.length > 0 && (
                                    <div className="mt-4 space-y-2">
                                        <p className="text-xs font-bold text-zinc-400 uppercase">Tickets</p>
                                        {reg.tickets.map((ticket, idx) => {
                                            if (!ticket) return null;  // Safety check
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
                            );
                        })
                    )}
                </div>
            </div>
        </div>
    );
};
