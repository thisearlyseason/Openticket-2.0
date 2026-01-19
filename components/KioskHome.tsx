import React, { useState, useEffect } from 'react';
import { useParams, useNavigate, useSearchParams } from 'react-router-dom';
import { kioskService, KioskToken, KioskEvent } from '../services/kioskService';
import { Button, Card, Badge } from './UI';
import { QrCode, Search, DollarSign, Loader2, AlertTriangle, Lock, X } from 'lucide-react';

export const KioskHome: React.FC = () => {
    const { eventId } = useParams<{ eventId: string }>();
    const [searchParams] = useSearchParams();
    const navigate = useNavigate();

    const [isLoading, setIsLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);
    const [token, setToken] = useState<KioskToken | null>(null);
    const [event, setEvent] = useState<KioskEvent | null>(null);
    const [showPinPrompt, setShowPinPrompt] = useState(false);

    useEffect(() => {
        initializeKiosk();
    }, [eventId]);

    const initializeKiosk = async () => {
        try {
            setIsLoading(true);
            setError(null);

            const tokenParam = searchParams.get('token');
            if (!tokenParam || !eventId) {
                setError('Invalid kiosk URL. Please use the QR code provided by the organizer.');
                setIsLoading(false);
                return;
            }

            // Initialize kiosk
            const { token: validatedToken, event: eventData } = await kioskService.initialize(eventId, tokenParam);
            setToken(validatedToken);
            setEvent(eventData);

            // Check if token is expired
            if (new Date(validatedToken.expiresAt) < new Date()) {
                setError('This kiosk session has expired. Please contact the event organizer.');
                return;
            }

            setIsLoading(false);
        } catch (err: any) {
            console.error('[KioskHome] Init error:', err);
            setError(err.message || 'Failed to initialize kiosk');
            setIsLoading(false);
        }
    };

    const handleExitKiosk = () => {
        // If PIN is required, show prompt
        // For now, just clear and exit
        if (window.confirm('Are you sure you want to exit kiosk mode?')) {
            kioskService.clearSession();
            window.location.href = '/';
        }
    };

    if (isLoading) {
        return (
            <div className="min-h-screen bg-zinc-950 flex items-center justify-center">
                <div className="text-center">
                    <Loader2 className="animate-spin text-primary mx-auto mb-4" size={48} />
                    <p className="text-white text-lg">Initializing kiosk...</p>
                </div>
            </div>
        );
    }

    if (error) {
        return (
            <div className="min-h-screen bg-zinc-950 flex items-center justify-center p-6">
                <Card className="max-w-md w-full p-8 text-center bg-zinc-900 border-red-500">
                    <AlertTriangle className="text-red-500 mx-auto mb-4" size={48} />
                    <h2 className="text-2xl font-bold text-white mb-4">Kiosk Error</h2>
                    <p className="text-zinc-400 mb-6">{error}</p>
                    <Button 
                        onClick={() => window.location.href = '/'}
                        variant="secondary"
                        className="w-full"
                    >
                        Return to Home
                    </Button>
                </Card>
            </div>
        );
    }

    return (
        <div className="min-h-screen bg-zinc-950 text-white">
            {/* Header */}
            <div className="bg-zinc-900 border-b border-zinc-800 px-6 py-4">
                <div className="max-w-7xl mx-auto flex items-center justify-between">
                    <div>
                        <div className="flex items-center gap-3 mb-1">
                            <Lock className="text-primary" size={24} />
                            <h1 className="text-2xl font-bold">Kiosk Mode</h1>
                        </div>
                        {event && (
                            <p className="text-zinc-400 text-sm">{event.title}</p>
                        )}
                    </div>
                    <Button
                        variant="ghost"
                        onClick={handleExitKiosk}
                        className="text-zinc-400 hover:text-white"
                        size="sm"
                    >
                        <X size={20} className="mr-2" />
                        Exit
                    </Button>
                </div>
            </div>

            {/* Main Content */}
            <div className="max-w-4xl mx-auto p-6 py-12">
                {/* Event Info Card */}
                {event && (
                    <Card className="mb-8 p-6 bg-zinc-900 border-zinc-800">
                        <div className="flex items-center gap-4">
                            {event.imageUrl && (
                                <img 
                                    src={event.imageUrl} 
                                    alt={event.title}
                                    className="w-20 h-20 rounded-lg object-cover"
                                />
                            )}
                            <div className="flex-1">
                                <h2 className="text-xl font-bold mb-1">{event.title}</h2>
                                <p className="text-zinc-400 text-sm">
                                    {event.date} • {event.time}
                                </p>
                                <p className="text-zinc-500 text-sm">{event.location}</p>
                            </div>
                        </div>
                    </Card>
                )}

                {/* Action Buttons */}
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                    {/* Scan Ticket */}
                    <button
                        onClick={() => navigate(`/kiosk/${eventId}/checkin`)}
                        className="group relative overflow-hidden rounded-2xl bg-gradient-to-br from-primary to-primary/80 p-8 text-left hover:scale-105 transition-transform duration-200 shadow-2xl shadow-primary/20"
                    >
                        <div className="relative z-10">
                            <div className="bg-white/20 rounded-full w-16 h-16 flex items-center justify-center mb-4">
                                <QrCode size={32} className="text-white" />
                            </div>
                            <h3 className="text-2xl font-bold mb-2 text-white">Scan Ticket</h3>
                            <p className="text-white/80 text-sm">
                                Scan QR code for quick check-in
                            </p>
                        </div>
                        <div className="absolute inset-0 bg-gradient-to-tr from-white/0 to-white/10 group-hover:to-white/20 transition-colors" />
                    </button>

                    {/* Manual Search */}
                    <button
                        onClick={() => navigate(`/kiosk/${eventId}/checkin?mode=search`)}
                        className="group relative overflow-hidden rounded-2xl bg-gradient-to-br from-blue-600 to-blue-700 p-8 text-left hover:scale-105 transition-transform duration-200 shadow-2xl shadow-blue-600/20"
                    >
                        <div className="relative z-10">
                            <div className="bg-white/20 rounded-full w-16 h-16 flex items-center justify-center mb-4">
                                <Search size={32} className="text-white" />
                            </div>
                            <h3 className="text-2xl font-bold mb-2 text-white">Find Guest</h3>
                            <p className="text-white/80 text-sm">
                                Search by name, email, or ticket ID
                            </p>
                        </div>
                        <div className="absolute inset-0 bg-gradient-to-tr from-white/0 to-white/10 group-hover:to-white/20 transition-colors" />
                    </button>

                    {/* Door Payment (if enabled) */}
                    {token?.paymentEnabled && (
                        <button
                            onClick={() => navigate(`/kiosk/${eventId}/payment`)}
                            className="group relative overflow-hidden rounded-2xl bg-gradient-to-br from-green-600 to-green-700 p-8 text-left hover:scale-105 transition-transform duration-200 shadow-2xl shadow-green-600/20"
                        >
                            <div className="relative z-10">
                                <div className="bg-white/20 rounded-full w-16 h-16 flex items-center justify-center mb-4">
                                    <DollarSign size={32} className="text-white" />
                                </div>
                                <h3 className="text-2xl font-bold mb-2 text-white">Door Payment</h3>
                                <p className="text-white/80 text-sm">
                                    Accept payments at the door
                                </p>
                            </div>
                            <div className="absolute inset-0 bg-gradient-to-tr from-white/0 to-white/10 group-hover:to-white/20 transition-colors" />
                        </button>
                    )}
                </div>

                {/* Status Footer */}
                <div className="mt-12 text-center">
                    <p className="text-zinc-500 text-sm mb-2">
                        Session expires: {token && new Date(token.expiresAt).toLocaleString()}
                    </p>
                    <Badge variant="success" className="text-xs">
                        Kiosk Active
                    </Badge>
                </div>
            </div>
        </div>
    );
};
