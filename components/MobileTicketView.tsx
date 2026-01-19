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
    ticketIndex: number;
    tierId: string;
    ticketName: string;
    attendeeName: string;
    isCheckedIn: boolean;
}

const TicketCard: React.FC<TicketDisplayProps> = ({ 
    registration, 
    event, 
    ticketIndex, 
    tierId, 
    ticketName,
    attendeeName,
    isCheckedIn 
}) => {
    const [qrCodeUrl, setQrCodeUrl] = useState<string>('');
    const [isExpanded, setIsExpanded] = useState(true);

    useEffect(() => {
        // Generate QR code with ticket data
        const ticketData = `TICKET:${registration.id}:${tierId}:${ticketIndex}`;
        QRCode.toDataURL(ticketData, {
            width: 300,
            margin: 2,
            color: {
                dark: '#000000',
                light: '#ffffff'
            },
            errorCorrectionLevel: 'H'
        }).then(setQrCodeUrl);
    }, [registration.id, tierId, ticketIndex]);

    const eventDate = new Date(event.date);
    const formattedDate = eventDate.toLocaleDateString('en-US', {
        weekday: 'long',
        month: 'long',
        day: 'numeric',
        year: 'numeric'
    });
    const formattedTime = eventDate.toLocaleTimeString('en-US', {
        hour: 'numeric',
        minute: '2-digit',
        hour12: true
    });

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
        // For now, download the QR code as an image
        // In production, this would integrate with Apple Wallet / Google Wallet
        if (qrCodeUrl) {
            const link = document.createElement('a');
            link.download = `ticket-${event.title}-${ticketIndex}.png`;
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

    // Build list of individual tickets
    const tickets: Array<{
        index: number;
        tierId: string;
        name: string;
        attendeeName: string;
        isCheckedIn: boolean;
    }> = [];

    if (registration.tickets && registration.tickets.length > 0) {
        registration.tickets.forEach((ticket, tIndex) => {
            for (let i = 0; i < ticket.quantity; i++) {
                const ticketKey = `${ticket.tierId || 'general'}-${tIndex}-${i}`;
                const statusEntry = registration.checkInStatuses?.[ticketKey];
                const isCheckedIn = statusEntry ? statusEntry.checkedIn : (registration.checkedIn || false);
                
                tickets.push({
                    index: i,
                    tierId: ticket.tierId || 'general',
                    name: ticket.name || 'General Admission',
                    attendeeName: ticket.attendeeName || registration.attendeeName,
                    isCheckedIn
                });
            }
        });
    } else {
        // Fallback for registrations without tickets array
        const ticketKey = 'general-0';
        const statusEntry = registration.checkInStatuses?.[ticketKey];
        const isCheckedIn = statusEntry ? statusEntry.checkedIn : (registration.checkedIn || false);
        
        tickets.push({
            index: 0,
            tierId: 'general',
            name: 'General Admission',
            attendeeName: registration.attendeeName,
            isCheckedIn
        });
    }

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
                
                {tickets.map((ticket, idx) => (
                    <TicketCard
                        key={`${ticket.tierId}-${idx}`}
                        registration={registration}
                        event={event}
                        ticketIndex={ticket.index}
                        tierId={ticket.tierId}
                        ticketName={ticket.name}
                        attendeeName={ticket.attendeeName}
                        isCheckedIn={ticket.isCheckedIn}
                    />
                ))}

                {/* Event Info Card */}
                <div className="bg-white dark:bg-zinc-900 rounded-2xl p-5 border border-zinc-200 dark:border-zinc-800">
                    <h4 className="font-bold text-zinc-900 dark:text-white mb-3">Event Information</h4>
                    <div className="space-y-2 text-sm text-zinc-600 dark:text-zinc-400">
                        {event.description && (
                            <p className="line-clamp-3">{event.description}</p>
                        )}
                        <Button 
                            variant="ghost" 
                            onClick={() => navigate(`/event/${event.id}`)}
                            className="w-full mt-3"
                        >
                            View Event Details
                        </Button>
                    </div>
                </div>

                {/* Help Section */}
                <div className="text-center text-xs text-zinc-400 py-4">
                    <p>Show this QR code at the venue entrance</p>
                    <p className="mt-1">Having issues? Contact the event organizer</p>
                </div>
            </div>
        </div>
    );
};

export default MobileTicketView;
