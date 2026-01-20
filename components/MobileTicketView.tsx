import React, { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { ArrowLeft, Calendar, MapPin, Clock, Download, Share2, Ticket, User, Mail, QrCode, ChevronDown, ChevronUp, Wallet } from 'lucide-react';
import QRCode from 'qrcode';
import { StorageService } from '../services/storageService';
import { Registration, Event } from '../types';
import { Button, Badge } from './UI';

interface TicketDisplayProps {
    registration: Registration;
    event: Event;
    ticket: any; // Individual ticket object with unique ID
}

const TicketCard: React.FC<TicketDisplayProps> = ({ 
    registration, 
    event, 
    ticket
}) => {
    const [qrCodeUrl, setQrCodeUrl] = useState<string>('');
    const [isExpanded, setIsExpanded] = useState(true);

    useEffect(() => {
        // Generate QR code with UNIQUE ticket ID
        // Use ticket.id directly (e.g., "tix-1768706525528-0-7woa")
        const ticketData = ticket.id || ticket.ticketId || ticket.ticketNumber || ticket.qrCodeData;
        
        if (ticketData) {
            QRCode.toDataURL(ticketData, {
                width: 300,
                margin: 2,
                color: {
                    dark: '#000000',
                    light: '#ffffff'
                },
                errorCorrectionLevel: 'H'
            }).then(setQrCodeUrl);
        }
    }, [ticket.id, ticket.ticketId, ticket.qrCodeData, ticket.ticketNumber]);

    const eventDate = new Date(event.date);
    const formattedDate = eventDate.toLocaleDateString('en-US', {
        weekday: 'long',
        month: 'long',
        day: 'numeric',
        year: 'numeric'
    });
    const formattedTime = event.time || eventDate.toLocaleTimeString('en-US', {
        hour: 'numeric',
        minute: '2-digit',
        hour12: true
    });

    const isCheckedIn = ticket.checkedIn || false;
    const attendeeName = ticket.attendeeName || registration.attendeeName;
    const ticketName = ticket.name || 'General Admission';

    const handleShare = async () => {
        if (navigator.share) {
            try {
                await navigator.share({
                    title: `${event.title} - Ticket`,
                    text: `My ticket for ${event.title}`,
                    url: window.location.href
                });
            } catch (err) {
                console.log('Share cancelled');
            }
        }
    };

    const handleAddToWallet = () => {
        if (qrCodeUrl) {
            const link = document.createElement('a');
            link.download = `ticket-${event.title}-${ticket.ticketNumber || ticket.ticketId}.png`;
            link.href = qrCodeUrl;
            link.click();
        }
    };

    return (
        <div className={`bg-white dark:bg-zinc-900 rounded-3xl overflow-hidden shadow-xl border ${
            isCheckedIn 
                ? 'border-green-500/30 bg-green-50 dark:bg-green-900/10' 
                : 'border-zinc-200 dark:border-zinc-800'
        }`}>
            {/* Header */}
            <div className="bg-gradient-to-r from-[#ec4899] to-[#f472b6] p-5 text-white">
                <div className="flex items-start justify-between">
                    <div>
                        <h3 className="font-black text-lg leading-tight">{event.title}</h3>
                        <p className="text-white/80 text-sm mt-1">{ticketName}</p>
                    </div>
                    {isCheckedIn && (
                        <Badge className="bg-white text-green-600 font-bold">CHECKED IN</Badge>
                    )}
                </div>
            </div>

            {/* QR Code Section */}
            <div 
                className="p-6 flex flex-col items-center cursor-pointer"
                onClick={() => setIsExpanded(!isExpanded)}
            >
                {isExpanded && qrCodeUrl ? (
                    <div className="relative">
                        <img 
                            src={qrCodeUrl} 
                            alt="Ticket QR Code" 
                            className={`w-56 h-56 rounded-xl ${isCheckedIn ? 'opacity-50' : ''}`}
                        />
                        {isCheckedIn && (
                            <div className="absolute inset-0 flex items-center justify-center">
                                <div className="bg-green-500 text-white px-4 py-2 rounded-full font-bold text-sm transform -rotate-12">
                                    ✓ USED
                                </div>
                            </div>
                        )}
                    </div>
                ) : (
                    <div className="w-56 h-16 flex items-center justify-center">
                        <QrCode size={24} className="text-zinc-400" />
                        <span className="ml-2 text-zinc-500 font-medium">Tap to show QR code</span>
                    </div>
                )}
                
                <button className="mt-3 flex items-center gap-1 text-zinc-400 text-sm">
                    {isExpanded ? <ChevronUp size={16} /> : <ChevronDown size={16} />}
                    {isExpanded ? 'Tap to minimize' : 'Tap to expand'}
                </button>
            </div>

            {/* Ticket Details */}
            <div className="border-t border-dashed border-zinc-200 dark:border-zinc-700 mx-4" />
            
            <div className="p-5 space-y-4">
                <div className="flex items-center gap-3">
                    <div className="w-10 h-10 bg-zinc-100 dark:bg-zinc-800 rounded-full flex items-center justify-center">
                        <User size={18} className="text-zinc-500" />
                    </div>
                    <div>
                        <p className="text-xs text-zinc-500 uppercase font-bold">Attendee</p>
                        <p className="font-bold text-zinc-900 dark:text-white">{attendeeName}</p>
                    </div>
                </div>

                <div className="flex items-center gap-3">
                    <div className="w-10 h-10 bg-zinc-100 dark:bg-zinc-800 rounded-full flex items-center justify-center">
                        <Calendar size={18} className="text-zinc-500" />
                    </div>
                    <div>
                        <p className="text-xs text-zinc-500 uppercase font-bold">Date & Time</p>
                        <p className="font-bold text-zinc-900 dark:text-white">{formattedDate}</p>
                        <p className="text-sm text-zinc-500">{formattedTime}</p>
                    </div>
                </div>

                {event.location && (
                    <div className="flex items-center gap-3">
                        <div className="w-10 h-10 bg-zinc-100 dark:bg-zinc-800 rounded-full flex items-center justify-center">
                            <MapPin size={18} className="text-zinc-500" />
                        </div>
                        <div>
                            <p className="text-xs text-zinc-500 uppercase font-bold">Location</p>
                            <p className="font-bold text-zinc-900 dark:text-white">{event.location}</p>
                        </div>
                    </div>
                )}
                
                {/* Ticket ID Display */}
                {(ticket.ticketNumber || ticket.ticketId) && (
                    <div className="flex items-center gap-3">
                        <div className="w-10 h-10 bg-zinc-100 dark:bg-zinc-800 rounded-full flex items-center justify-center">
                            <Ticket size={18} className="text-zinc-500" />
                        </div>
                        <div>
                            <p className="text-xs text-zinc-500 uppercase font-bold">Ticket #</p>
                            <p className="font-bold text-zinc-900 dark:text-white font-mono">{ticket.ticketNumber || ticket.ticketId}</p>
                        </div>
                    </div>
                )}
            </div>

            {/* Actions */}
            <div className="p-4 bg-zinc-50 dark:bg-zinc-800/50 flex gap-2">
                <Button 
                    onClick={handleAddToWallet}
                    variant="ghost" 
                    className="flex-1 flex items-center justify-center gap-2"
                >
                    <Download size={18} /> Save
                </Button>
                {navigator.share && (
                    <Button 
                        onClick={handleShare}
                        variant="ghost" 
                        className="flex-1 flex items-center justify-center gap-2"
                    >
                        <Share2 size={18} /> Share
                    </Button>
                )}
            </div>

            {/* Order ID */}
            <div className="px-5 pb-4 text-center">
                <p className="text-xs text-zinc-400 font-mono">
                    Order: {registration.id.slice(0, 8).toUpperCase()}
                </p>
            </div>
        </div>
    );
};

export const MobileTicketView = () => {
    const { registrationId } = useParams<{ registrationId: string }>();
    const navigate = useNavigate();
    const [registration, setRegistration] = useState<Registration | null>(null);
    const [event, setEvent] = useState<Event | null>(null);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string>('');

    useEffect(() => {
        const loadTicket = async () => {
            if (!registrationId) {
                setError('No ticket ID provided');
                setLoading(false);
                return;
            }

            try {
                // Fetch registration
                const reg = await StorageService.getRegistration(registrationId);
                if (!reg) {
                    setError('Ticket not found');
                    setLoading(false);
                    return;
                }
                setRegistration(reg);

                // Fetch event
                const evt = await StorageService.getEventById(reg.eventId);
                if (!evt) {
                    setError('Event not found');
                    setLoading(false);
                    return;
                }
                setEvent(evt);
                setLoading(false);
            } catch (err: any) {
                setError(err.message || 'Failed to load ticket');
                setLoading(false);
            }
        };

        loadTicket();
    }, [registrationId]);

    if (loading) {
        return (
            <div className="min-h-screen bg-zinc-100 dark:bg-black flex items-center justify-center">
                <div className="animate-spin rounded-full h-10 w-10 border-b-2 border-[#ec4899]" />
            </div>
        );
    }

    if (error || !registration || !event) {
        return (
            <div className="min-h-screen bg-zinc-100 dark:bg-black flex flex-col items-center justify-center p-4 text-center">
                <div className="w-20 h-20 bg-red-100 dark:bg-red-900/20 rounded-full flex items-center justify-center mb-4">
                    <Ticket size={32} className="text-red-500" />
                </div>
                <h2 className="text-xl font-bold text-zinc-900 dark:text-white mb-2">Ticket Not Found</h2>
                <p className="text-zinc-500 mb-6">{error || 'This ticket could not be found'}</p>
                <Button onClick={() => navigate('/')}>Go Home</Button>
            </div>
        );
    }

    // Use the NEW ticket structure directly (each ticket is already unique)
    const tickets = registration.tickets || [];

    return (
        <div className="min-h-screen bg-zinc-100 dark:bg-black pb-safe">
            {/* Header */}
            <div className="sticky top-0 z-10 bg-white/80 dark:bg-black/80 backdrop-blur-lg border-b border-zinc-200 dark:border-zinc-800">
                <div className="max-w-lg mx-auto px-4 py-4 flex items-center justify-between">
                    <button 
                        onClick={() => navigate(-1)}
                        className="flex items-center gap-1 text-zinc-500 hover:text-zinc-900 dark:hover:text-white transition-colors"
                    >
                        <ArrowLeft size={20} />
                        <span className="font-medium">Back</span>
                    </button>
                    <div className="flex items-center gap-2">
                        <Ticket size={20} className="text-[#ec4899]" />
                        <span className="font-bold text-zinc-900 dark:text-white">My Tickets</span>
                    </div>
                </div>
            </div>

            {/* Tickets List */}
            <div className="max-w-lg mx-auto p-4 space-y-6">
                {tickets.length > 1 && (
                    <p className="text-center text-zinc-500 text-sm">
                        {tickets.length} tickets in this order
                    </p>
                )}
                
                {tickets.length > 0 ? (
                    tickets.map((ticket, idx) => (
                        <TicketCard
                            key={ticket.ticketId || `ticket-${idx}`}
                            registration={registration}
                            event={event}
                            ticket={ticket}
                        />
                    ))
                ) : (
                    <TicketCard
                        key="default-ticket"
                        registration={registration}
                        event={event}
                        ticket={{
                            ticketNumber: 'GENERAL-001',
                            ticketId: registration.id,
                            qrCodeData: registration.id,
                            name: 'General Admission',
                            attendeeName: registration.attendeeName,
                            checkedIn: registration.checkedIn || false
                        }}
                    />
                )}

                {/* Event Info Card */}
                <div className="bg-white dark:bg-zinc-900 rounded-2xl p-5 border border-zinc-200 dark:border-zinc-800">
                    <h4 className="font-bold text-zinc-900 dark:text-white mb-3">Event Information</h4>
                    {event.description && (
                        <p className="text-zinc-600 dark:text-zinc-400 text-sm mb-4">{event.description}</p>
                    )}
                </div>
            </div>
        </div>
    );
};
