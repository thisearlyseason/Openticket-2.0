import React, { useState, useEffect } from 'react';
import { useParams, useNavigate, useSearchParams, useLocation } from 'react-router-dom';
import { kioskService } from '../services/kioskService';
import { Button, Card, Badge } from './UI';
import { QrCode, Users, DollarSign, Lock, X, AlertTriangle } from 'lucide-react';

export const KioskHome: React.FC = () => {
    const { eventId } = useParams<{ eventId: string }>();
    const [searchParams] = useSearchParams();
    const navigate = useNavigate();
    const location = useLocation();

    const [isLoading, setIsLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);
    const [token, setToken] = useState<any>(null);
    const [event, setEvent] = useState<any>(null);
    const [showPinPrompt, setShowPinPrompt] = useState(false);
    const [enteredPin, setEnteredPin] = useState('');
    const [pinError, setPinError] = useState('');
    const [isFullscreen, setIsFullscreen] = useState(false);

    useEffect(() => {
        initializeKiosk();
        lockKioskMode();
        requestFullscreen();
        
        // Monitor fullscreen changes
        const handleFullscreenChange = () => {
            setIsFullscreen(!!document.fullscreenElement);
            // If user exits fullscreen, try to re-enter
            if (!document.fullscreenElement) {
                setTimeout(() => requestFullscreen(), 100);
            }
        };
        
        document.addEventListener('fullscreenchange', handleFullscreenChange);
        
        return () => {
            document.removeEventListener('fullscreenchange', handleFullscreenChange);
            unlockKioskMode();
        };
    }, [eventId]);

    // CRITICAL: Block all navigation attempts except via Close button
    useEffect(() => {
        const blockNavigation = (e: BeforeUnloadEvent) => {
            e.preventDefault();
            e.returnValue = '';
        };
        
        window.addEventListener('beforeunload', blockNavigation);
        
        return () => {
            window.removeEventListener('beforeunload', blockNavigation);
        };
    }, []);

    const lockKioskMode = () => {
        // Prevent back/forward navigation
        window.history.pushState(null, '', window.location.href);
        window.onpopstate = () => {
            window.history.pushState(null, '', window.location.href);
        };

        // Disable context menu
        document.addEventListener('contextmenu', preventDefaultAction);
        
        // Disable ALL keyboard shortcuts
        document.addEventListener('keydown', preventKeyboardShortcuts);
        
        // Disable text selection (prevents copy/paste)
        document.body.style.userSelect = 'none';
        document.body.style.webkitUserSelect = 'none';
    };

    const unlockKioskMode = () => {
        window.onpopstate = null;
        document.removeEventListener('contextmenu', preventDefaultAction);
        document.removeEventListener('keydown', preventKeyboardShortcuts);
        document.body.style.userSelect = 'auto';
        document.body.style.webkitUserSelect = 'auto';
    };

    const preventDefaultAction = (e: Event) => {
        e.preventDefault();
        e.stopPropagation();
        return false;
    };

    const preventKeyboardShortcuts = (e: KeyboardEvent) => {
        // Block ALL common escape shortcuts
        const blockedKeys = [
            'F11',           // Fullscreen toggle
            'F5',            // Refresh
            'Escape',        // Exit fullscreen
        ];
        
        const blockedCombos = [
            { ctrl: true, key: 'w' },      // Close tab
            { ctrl: true, key: 't' },      // New tab
            { ctrl: true, key: 'n' },      // New window
            { ctrl: true, key: 'r' },      // Refresh
            { ctrl: true, shift: true, key: 'i' }, // Dev tools
            { ctrl: true, shift: true, key: 'j' }, // Dev tools
            { ctrl: true, shift: true, key: 'c' }, // Dev tools
            { alt: true, key: 'F4' },      // Close window
            { alt: true, key: 'Tab' },     // Switch apps
            { meta: true, key: 'w' },      // Close tab (Mac)
            { meta: true, key: 'q' },      // Quit (Mac)
        ];
        
        // Check blocked keys
        if (blockedKeys.includes(e.key)) {
            e.preventDefault();
            e.stopPropagation();
            return false;
        }
        
        // Check blocked combinations
        for (const combo of blockedCombos) {
            let matches = true;
            if (combo.ctrl && !e.ctrlKey) matches = false;
            if (combo.shift && !e.shiftKey) matches = false;
            if (combo.alt && !e.altKey) matches = false;
            if (combo.meta && !e.metaKey) matches = false;
            if (combo.key && e.key.toLowerCase() !== combo.key.toLowerCase()) matches = false;
            
            if (matches) {
                e.preventDefault();
                e.stopPropagation();
                return false;
            }
        }
    };

    const requestFullscreen = () => {
        try {
            const elem = document.documentElement;
            if (!document.fullscreenElement) {
                if (elem.requestFullscreen) {
                    elem.requestFullscreen().catch(err => {
                        console.log('[Kiosk] Fullscreen request failed:', err);
                    });
                }
            }
        } catch (err) {
            console.log('[Kiosk] Fullscreen not supported:', err);
        }
    };

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
        // Check if PIN is required
        if (token?.pinCode) {
            setShowPinPrompt(true);
            setEnteredPin('');
            setPinError('');
        } else {
            confirmExit();
        }
    };

    const handlePinSubmit = () => {
        if (enteredPin === token?.pinCode) {
            setShowPinPrompt(false);
            confirmExit();
        } else {
            setPinError('Incorrect PIN. Please try again.');
            setEnteredPin('');
        }
    };

    const confirmExit = () => {
        // Unlock kiosk before navigating away
        unlockKioskMode();
        
        // Clear kiosk session
        kioskService.clearSession();
        
        // Exit fullscreen
        if (document.exitFullscreen && document.fullscreenElement) {
            document.exitFullscreen().catch(err => console.log('Exit fullscreen error:', err));
        }
        
        // Navigate to home
        window.location.href = '/';
    };

    const handleCheckIn = () => {
        const tokenId = searchParams.get('token');
        navigate(`/kiosk/${eventId}/checkin?token=${tokenId}`);
    };

    const handleSearch = () => {
        const tokenId = searchParams.get('token');
        navigate(`/kiosk/${eventId}/checkin?mode=search&token=${tokenId}`);
    };

    const handlePayment = () => {
        const tokenId = searchParams.get('token');
        navigate(`/kiosk/${eventId}/payment?token=${tokenId}`);
    };

    if (isLoading) {
        return (
            <div className="min-h-screen bg-zinc-950 flex items-center justify-center">
                <div className="text-center">
                    <div className="animate-spin rounded-full h-16 w-16 border-b-4 border-primary mx-auto mb-4" />
                    <p className="text-zinc-400 text-lg">Initializing Kiosk Mode...</p>
                </div>
            </div>
        );
    }

    if (error) {
        return (
            <div className="min-h-screen bg-zinc-950 flex items-center justify-center p-6">
                <Card className="max-w-md w-full p-8 bg-zinc-900 border-zinc-800 text-center">
                    <div className="w-20 h-20 bg-red-500/10 rounded-full flex items-center justify-center mx-auto mb-6">
                        <AlertTriangle className="text-red-500" size={40} />
                    </div>
                    <h2 className="text-2xl font-bold text-white mb-4">Kiosk Error</h2>
                    <p className="text-zinc-400 mb-6">{error}</p>
                    <Button
                        onClick={() => window.location.href = '/'}
                        variant="secondary"
                    >
                        Go Home
                    </Button>
                </Card>
            </div>
        );
    }

    return (
        <div className="min-h-screen bg-zinc-950 text-white">
            {/* Fixed Header with Exit Button */}
            <div className="fixed top-0 left-0 right-0 z-50 bg-zinc-900 border-b border-zinc-800 shadow-lg">
                <div className="max-w-7xl mx-auto px-6 py-4 flex items-center justify-between">
                    <div className="flex items-center gap-4">
                        <div className="w-3 h-3 bg-green-500 rounded-full animate-pulse" />
                        <div>
                            <h1 className="text-xl font-bold">{event?.title || 'Kiosk Mode'}</h1>
                            <p className="text-sm text-zinc-400">Check-In Terminal</p>
                        </div>
                    </div>
                    <Button
                        onClick={handleExitKiosk}
                        variant="destructive"
                        size="sm"
                        className="flex items-center gap-2"
                    >
                        {token?.pinCode && <Lock size={16} />}
                        <X size={16} />
                        Exit Kiosk
                    </Button>
                </div>
            </div>

            {/* Main Content */}
            <div className="pt-24 pb-12 px-6">
                <div className="max-w-4xl mx-auto">
                    {/* Welcome Message */}
                    <div className="text-center mb-12">
                        <h2 className="text-4xl font-bold mb-4">Welcome to Check-In</h2>
                        <p className="text-zinc-400 text-lg">Select an option below to get started</p>
                    </div>

                    {/* Action Cards */}
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-12">
                        {/* Scan Ticket */}
                        <Card
                            className="p-8 bg-gradient-to-br from-blue-600 to-blue-700 border-none cursor-pointer hover:scale-105 transition-transform"
                            onClick={handleCheckIn}
                        >
                            <div className="text-center">
                                <div className="w-20 h-20 bg-white/20 rounded-full flex items-center justify-center mx-auto mb-4">
                                    <QrCode className="text-white" size={40} />
                                </div>
                                <h3 className="text-2xl font-bold text-white mb-2">Scan Ticket</h3>
                                <p className="text-blue-100">Use camera to scan QR codes</p>
                            </div>
                        </Card>

                        {/* Manual Search */}
                        <Card
                            className="p-8 bg-gradient-to-br from-purple-600 to-purple-700 border-none cursor-pointer hover:scale-105 transition-transform"
                            onClick={handleSearch}
                        >
                            <div className="text-center">
                                <div className="w-20 h-20 bg-white/20 rounded-full flex items-center justify-center mx-auto mb-4">
                                    <Users className="text-white" size={40} />
                                </div>
                                <h3 className="text-2xl font-bold text-white mb-2">Manual Lookup</h3>
                                <p className="text-purple-100">Search by name or email</p>
                            </div>
                        </Card>

                        {/* Door Payment */}
                        {token?.paymentEnabled && (
                            <Card
                                className="p-8 bg-gradient-to-br from-green-600 to-green-700 border-none cursor-pointer hover:scale-105 transition-transform"
                                onClick={handlePayment}
                            >
                                <div className="text-center">
                                    <div className="w-20 h-20 bg-white/20 rounded-full flex items-center justify-center mx-auto mb-4">
                                        <DollarSign className="text-white" size={40} />
                                    </div>
                                    <h3 className="text-2xl font-bold text-white mb-2">Door Payment</h3>
                                    <p className="text-green-100">Process payments at the door</p>
                                </div>
                            </Card>
                        )}
                    </div>

                    {/* Status Footer */}
                    <div className="text-center">
                        <p className="text-zinc-500 text-sm mb-2">
                            Session expires: {token && new Date(token.expiresAt).toLocaleString()}
                        </p>
                        <Badge variant="success" className="text-xs">
                            Kiosk Active
                        </Badge>
                    </div>
                </div>
            </div>

            {/* PIN Prompt Modal */}
            {showPinPrompt && (
                <div className="fixed inset-0 bg-black/90 backdrop-blur-sm flex items-center justify-center z-[100] p-4">
                    <Card className="max-w-md w-full p-8 bg-zinc-900 border-zinc-800">
                        <div className="text-center mb-6">
                            <div className="w-20 h-20 bg-primary/10 rounded-full flex items-center justify-center mx-auto mb-4">
                                <Lock className="text-primary" size={40} />
                            </div>
                            <h3 className="text-2xl font-bold text-white mb-2">Enter PIN to Exit</h3>
                            <p className="text-zinc-400 text-sm">
                                This kiosk is PIN protected. Enter the 4-digit PIN to exit kiosk mode.
                            </p>
                        </div>

                        <div className="space-y-4">
                            <input
                                type="password"
                                inputMode="numeric"
                                pattern="[0-9]*"
                                maxLength={4}
                                value={enteredPin}
                                onChange={(e) => {
                                    setEnteredPin(e.target.value.replace(/\D/g, ''));
                                    setPinError('');
                                }}
                                onKeyPress={(e) => e.key === 'Enter' && enteredPin.length === 4 && handlePinSubmit()}
                                placeholder="••••"
                                className="w-full text-center text-4xl font-mono tracking-widest bg-zinc-800 border-2 border-zinc-700 rounded-lg p-6 text-white focus:ring-2 focus:ring-primary focus:border-primary outline-none"
                                autoFocus
                            />

                            {pinError && (
                                <div className="flex items-center gap-2 text-red-500 text-sm bg-red-500/10 p-4 rounded-lg border border-red-500/20">
                                    <AlertTriangle size={16} />
                                    <span>{pinError}</span>
                                </div>
                            )}

                            <div className="flex gap-3">
                                <Button
                                    onClick={() => {
                                        setShowPinPrompt(false);
                                        setEnteredPin('');
                                        setPinError('');
                                    }}
                                    variant="ghost"
                                    className="flex-1"
                                >
                                    Cancel
                                </Button>
                                <Button
                                    onClick={handlePinSubmit}
                                    disabled={enteredPin.length !== 4}
                                    className="flex-1"
                                >
                                    Exit Kiosk
                                </Button>
                            </div>
                        </div>
                    </Card>
                </div>
            )}

            {/* Fullscreen Warning Overlay */}
            {!isFullscreen && (
                <div className="fixed bottom-4 right-4 z-50">
                    <Card className="p-4 bg-yellow-500/10 border-yellow-500/20">
                        <div className="flex items-center gap-3">
                            <AlertTriangle className="text-yellow-500" size={20} />
                            <div>
                                <p className="text-sm font-semibold text-yellow-500">Not in Fullscreen</p>
                                <button
                                    onClick={requestFullscreen}
                                    className="text-xs text-yellow-400 hover:text-yellow-300 underline"
                                >
                                    Click to enter fullscreen
                                </button>
                            </div>
                        </div>
                    </Card>
                </div>
            )}
        </div>
    );
};
