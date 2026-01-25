import React, { useState, useEffect, useCallback, useRef } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { QRScanner } from './QRScanner';
import { Button, Badge, Card } from './UI';
import { ArrowLeft, Camera, CheckCircle, XCircle, AlertCircle, Users, Clock, Loader2, WifiOff, CloudOff, RefreshCw, DollarSign, CreditCard } from 'lucide-react';
import { getAuthToken } from '../services/firebaseConfig';
import { offlineSyncService } from '../services/offlineSyncService';
import { scanAnalyticsService } from '../services/scanAnalyticsService';

// Get API URL from environment
const API_URL = import.meta.env.VITE_BACKEND_URL || import.meta.env.REACT_APP_BACKEND_URL || '';

// Debounce time to prevent duplicate scans (ms)
const SCAN_DEBOUNCE_MS = 3000;

interface ScanResult {
    success: boolean;
    message: string;
    attendeeName?: string;
    ticketType?: string;
    timestamp: number;
}

interface Stats {
    total: number;
    checkedIn: number;
    pending: number;
}

interface PaymentInfo {
    registrationId: string;
    ticketId: string;
    attendeeName: string;
    ticketType: string;
    price: number;
}

export const MobileCheckInScanner: React.FC = () => {
    const { id } = useParams<{ id: string }>();
    const navigate = useNavigate();
    const [showScanner, setShowScanner] = useState(false);
    const [isProcessing, setIsProcessing] = useState(false);
    const [scanResults, setScanResults] = useState<ScanResult[]>([]);
    const [stats, setStats] = useState<Stats>({ total: 0, checkedIn: 0, pending: 0 });
    const [isOnline, setIsOnline] = useState(navigator.onLine);
    const [pendingSync, setPendingSync] = useState(0);
    const lastScannedRef = useRef<{code: string; time: number} | null>(null);
    const [showPaymentModal, setShowPaymentModal] = useState(false);
    const [paymentInfo, setPaymentInfo] = useState<PaymentInfo | null>(null);

    useEffect(() => {
        const handleOnline = () => setIsOnline(true);
        const handleOffline = () => setIsOnline(false);
        window.addEventListener('online', handleOnline);
        window.addEventListener('offline', handleOffline);
        return () => {
            window.removeEventListener('online', handleOnline);
            window.removeEventListener('offline', handleOffline);
        };
    }, []);

    // Load initial stats
    useEffect(() => {
        loadStats();
    }, [id]);

    // Listen for offline sync completion
    useEffect(() => {
        const handleSyncComplete = async () => {
            await loadStats();
            const queue = await offlineSyncService.getQueuedCheckIns();
            setPendingSync(queue.length);
        };

        window.addEventListener('pwa-sync-complete', handleSyncComplete);
        return () => window.removeEventListener('pwa-sync-complete', handleSyncComplete);
    }, []);

    const loadStats = async () => {
        try {
            const token = await getAuthToken();
            const response = await fetch(`${API_URL}/api/events/${id}/stats`, {
                headers: {
                    'Authorization': `Bearer ${token}`
                }
            });

            if (response.ok) {
                const data = await response.json();
                setStats(data);
            }
        } catch (error) {
            console.error('Failed to load stats:', error);
        }
    };

    const playSuccessSound = () => {
        const audioContext = new (window.AudioContext || (window as any).webkitAudioContext)();
        const oscillator = audioContext.createOscillator();
        const gainNode = audioContext.createGain();
        
        oscillator.connect(gainNode);
        gainNode.connect(audioContext.destination);
        
        oscillator.frequency.value = 800;
        oscillator.type = 'sine';
        
        gainNode.gain.setValueAtTime(0.3, audioContext.currentTime);
        gainNode.gain.exponentialRampToValueAtTime(0.01, audioContext.currentTime + 0.1);
        
        oscillator.start(audioContext.currentTime);
        oscillator.stop(audioContext.currentTime + 0.1);
    };

    const playErrorSound = () => {
        const audioContext = new (window.AudioContext || (window as any).webkitAudioContext)();
        const oscillator = audioContext.createOscillator();
        const gainNode = audioContext.createGain();
        
        oscillator.connect(gainNode);
        gainNode.connect(audioContext.destination);
        
        oscillator.frequency.value = 400;
        oscillator.type = 'sawtooth';
        
        gainNode.gain.setValueAtTime(0.3, audioContext.currentTime);
        gainNode.gain.exponentialRampToValueAtTime(0.01, audioContext.currentTime + 0.2);
        
        oscillator.start(audioContext.currentTime);
        oscillator.stop(audioContext.currentTime + 0.2);
    };

    const trackScanAnalytics = async (success: boolean, ticketId: string, duration: number, errorMessage?: string) => {
        try {
            await scanAnalyticsService.trackScan({
                eventId: id!,
                ticketId,
                success,
                errorMessage,
                duration,
                timestamp: Date.now(),
                scanMethod: 'camera'
            });
        } catch (error) {
            console.error('Analytics tracking failed:', error);
            // Fallback: Try to log locally
            try {
                const fallbackLog = {
                    eventId: id,
                    ticketId,
                    success,
                    errorMessage,
                    duration,
                    timestamp: Date.now(),
                    method: 'camera',
                    synced: false
                };
                localStorage.setItem(`scan_log_${Date.now()}`, JSON.stringify(fallbackLog));
            } catch (fallbackError) {
                console.error('Fallback analytics failed:', fallbackError);
            }
        }
    };

    // FIX: Enhanced error handling with retry limit and scan deduplication
    const handleScan = useCallback(async (qrData: string) => {
        // Debounce duplicate scans of the same code
        const now = Date.now();
        if (lastScannedRef.current && 
            lastScannedRef.current.code === qrData && 
            now - lastScannedRef.current.time < SCAN_DEBOUNCE_MS) {
            console.log('[MobileScanner] Ignoring duplicate scan within debounce window');
            return;
        }
        
        if (isProcessing || !id) {
            console.log('[MobileScanner] Skipping scan - processing:', isProcessing, 'id:', id);
            return;
        }
        
        // Record this scan for debouncing
        lastScannedRef.current = { code: qrData, time: now };
        
        console.log('[MobileScanner] Starting scan process for:', qrData);
        setIsProcessing(true);
        // Close scanner immediately to prevent library's foreverScan from continuing
        setShowScanner(false);
        const scanStartTime = Date.now();
        
        try {
            // Extract ticket ID from QR data
            let ticketId: string;
            try {
                const parsed = JSON.parse(qrData);
                ticketId = parsed.ticketId || parsed.id || qrData;
            } catch {
                ticketId = qrData;
            }

            console.log('[MobileScanner] Extracted ticketId:', ticketId);

            // Check if online
            if (!navigator.onLine) {
                console.log('[MobileScanner] Offline mode - queueing for sync');
                // Queue for offline sync
                const token = await getAuthToken();
                await offlineSyncService.queueCheckIn(ticketId, id, token);
                
                const scanResult: ScanResult = {
                    success: true,
                    message: 'Queued for sync (offline)',
                    attendeeName: 'Offline Check-in',
                    ticketType: 'Pending Sync',
                    timestamp: Date.now()
                };
                
                setScanResults(prev => [scanResult, ...prev.slice(0, 9)]);
                setPendingSync(prev => prev + 1);
                
                await trackScanAnalytics(true, ticketId, Date.now() - scanStartTime);
                
                if (navigator.vibrate) {
                    navigator.vibrate([150, 50, 150]);
                }
                
                playSuccessSound();
                setIsProcessing(false);
                setShowScanner(false);
                console.log('[MobileScanner] Offline scan complete');
                return;
            }

            // Online - process immediately
            console.log('[MobileScanner] Online mode - calling API');
            const token = await getAuthToken();
            console.log('[MobileScanner] Got auth token, calling check-in API');
            
            const response = await fetch(`${API_URL}/api/registrations/checkin`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${token}`
                },
                body: JSON.stringify({ 
                    ticketId,
                    eventId: id 
                })
            });

            console.log('[MobileScanner] API response status:', response.status);
            
            // Handle 402 Payment Required - Show payment modal
            if (response.status === 402) {
                const result = await response.json();
                console.log('[MobileScanner] Payment required:', result);
                
                setPaymentInfo({
                    registrationId: result.registration?.id || '',
                    ticketId: ticketId,
                    attendeeName: result.ticket?.attendeeName || 'Guest',
                    ticketType: result.ticket?.ticketType || 'Ticket',
                    price: result.ticket?.price || result.registration?.totalAmount || 0
                });
                setShowPaymentModal(true);
                
                const scanResult: ScanResult = {
                    success: false,
                    message: `Payment required - $${(result.ticket?.price || 0).toFixed(2)}`,
                    attendeeName: result.ticket?.attendeeName,
                    ticketType: result.ticket?.ticketType,
                    timestamp: Date.now()
                };
                
                setScanResults(prev => [scanResult, ...prev.slice(0, 9)]);
                
                if (navigator.vibrate) {
                    navigator.vibrate([100, 100, 100]);
                }
                
                setIsProcessing(false);
                return;
            }
            
            // Handle 500 errors gracefully - NO recursive retry (causes infinite loops)
            if (response.status === 500) {
                console.error('[MobileScanner] 500 Error - Server error');
                
                // Show error immediately - don't retry (server issue, not network issue)
                const scanResult: ScanResult = {
                    success: false,
                    message: 'Server error - please try again',
                    timestamp: Date.now()
                };
                
                setScanResults(prev => [scanResult, ...prev.slice(0, 9)]);
                
                await trackScanAnalytics(false, ticketId, Date.now() - scanStartTime, 'Server error (500)');
                
                if (navigator.vibrate) {
                    navigator.vibrate([100, 50, 100, 50, 100]);
                }
                
                playErrorSound();
                setIsProcessing(false);
                
                console.log('[MobileScanner] Server error handled, scanner closed');
                return;
            }
            
            const result = await response.json();
            console.log('[MobileScanner] API response data:', result);
            
            const scanDuration = Date.now() - scanStartTime;

            if (response.ok) {
                console.log('[MobileScanner] Check-in SUCCESS');
                // Success
                const scanResult: ScanResult = {
                    success: true,
                    message: 'Check-in successful!',
                    attendeeName: result.ticket?.attendeeName || result.attendeeName || 'Guest',
                    ticketType: result.ticket?.tierName || result.ticketType || 'Ticket',
                    timestamp: Date.now()
                };
                
                setScanResults(prev => [scanResult, ...prev.slice(0, 9)]);
                setStats(prev => ({
                    ...prev,
                    checkedIn: prev.checkedIn + 1,
                    pending: Math.max(0, prev.pending - 1)
                }));
                
                await trackScanAnalytics(true, ticketId, scanDuration);
                
                if (navigator.vibrate) {
                    navigator.vibrate([200, 100, 200]);
                }
                
                playSuccessSound();
                console.log('[MobileScanner] Check-in success recorded');
            } else {
                console.log('[MobileScanner] Check-in FAILED:', result.error || result.message);
                // Error (but not 500 - those are handled above)
                const scanResult: ScanResult = {
                    success: false,
                    message: result.error || result.message || 'Check-in failed',
                    timestamp: Date.now()
                };
                
                setScanResults(prev => [scanResult, ...prev.slice(0, 9)]);
                
                await trackScanAnalytics(false, ticketId, scanDuration, result.error || result.message);
                
                if (navigator.vibrate) {
                    navigator.vibrate([100, 50, 100, 50, 100]);
                }
                
                playErrorSound();
                console.log('[MobileScanner] Check-in error recorded');
            }
        } catch (error: any) {
            console.error('[MobileScanner] Exception during scan:', error);
            
            const scanResult: ScanResult = {
                success: false,
                message: error.message || 'Network error',
                timestamp: Date.now()
            };
            
            setScanResults(prev => [scanResult, ...prev.slice(0, 9)]);
            
            if (id) {
                await trackScanAnalytics(false, 'unknown', Date.now() - scanStartTime, error.message);
            }
            
            if (navigator.vibrate) {
                navigator.vibrate([100, 50, 100, 50, 100]);
            }
            
            playErrorSound();
            console.log('[MobileScanner] Exception handled');
        } finally {
            console.log('[MobileScanner] Setting isProcessing to false');
            setIsProcessing(false);
        }
    }, [isProcessing, id]);

    const handleSyncNow = async () => {
        try {
            await offlineSyncService.syncAll();
            await loadStats();
            const queue = await offlineSyncService.getQueuedCheckIns();
            setPendingSync(queue.length);
        } catch (error) {
            console.error('Manual sync failed:', error);
        }
    };

    return (
        <div className="min-h-screen bg-gradient-to-br from-zinc-950 via-zinc-900 to-zinc-950 text-white">
            {/* Header */}
            <div className="bg-zinc-900/50 backdrop-blur-sm border-b border-zinc-800 sticky top-0 z-10">
                <div className="max-w-4xl mx-auto px-4 py-4">
                    <div className="flex items-center justify-between">
                        <Button
                            variant="ghost"
                            onClick={() => navigate(`/checkin/${id}`)}
                            className="flex items-center gap-2 text-zinc-400 hover:text-white"
                        >
                            <ArrowLeft size={16} className="mr-2" /> Back to Dashboard
                        </Button>
                        
                        <div className="flex items-center gap-2">
                            {!isOnline && (
                                <Badge className="bg-red-500/20 text-red-400 border-red-500/30">
                                    <WifiOff size={14} className="mr-1" /> Offline
                                </Badge>
                            )}
                            {pendingSync > 0 && (
                                <Button
                                    variant="outline"
                                    size="sm"
                                    onClick={handleSyncNow}
                                    className="border-amber-500/30 text-amber-400 hover:bg-amber-500/10"
                                >
                                    <RefreshCw size={14} className="mr-1" />
                                    Sync {pendingSync}
                                </Button>
                            )}
                        </div>
                    </div>
                </div>
            </div>

            <div className="max-w-4xl mx-auto px-4 py-8">
                {/* Stats */}
                <div className="grid grid-cols-3 gap-4 mb-8">
                    <Card className="bg-zinc-900/50 border-zinc-800 backdrop-blur-sm">
                        <div className="p-6 text-center">
                            <Users size={24} className="mx-auto mb-2 text-zinc-500" />
                            <div className="text-3xl font-black text-white mb-1">{stats.total}</div>
                            <div className="text-xs text-zinc-500 uppercase font-bold">Total</div>
                        </div>
                    </Card>
                    <Card className="bg-green-500/10 border-green-500/30 backdrop-blur-sm">
                        <div className="p-6 text-center">
                            <CheckCircle size={24} className="mx-auto mb-2 text-green-400" />
                            <div className="text-3xl font-black text-green-400 mb-1">{stats.checkedIn}</div>
                            <div className="text-xs text-zinc-500 uppercase font-bold">Checked In</div>
                        </div>
                    </Card>
                    <Card className="bg-amber-500/10 border-amber-500/30 backdrop-blur-sm">
                        <div className="p-6 text-center">
                            <Clock size={24} className="mx-auto mb-2 text-amber-400" />
                            <div className="text-3xl font-black text-amber-400 mb-1">{stats.pending}</div>
                            <div className="text-xs text-zinc-500 uppercase font-bold">Pending</div>
                        </div>
                    </Card>
                </div>

                {/* Scan Button */}
                {!showScanner && (
                    <div className="text-center mb-8">
                        <button
                            onClick={() => setShowScanner(true)}
                            disabled={isProcessing}
                            className="w-full max-w-md mx-auto bg-gradient-to-r from-[#E0FF20] to-[#c4e01a] text-black font-black text-xl py-6 rounded-2xl shadow-2xl hover:scale-105 transition-transform duration-200 flex items-center justify-center gap-3 disabled:opacity-50 disabled:cursor-not-allowed"
                        >
                            {isProcessing ? (
                                <>
                                    <Loader2 size={28} className="animate-spin" />
                                    Processing...
                                </>
                            ) : (
                                <>
                                    <Camera size={28} />
                                    Scan Ticket
                                </>
                            )}
                        </button>
                    </div>
                )}

                {/* Scanner */}
                {showScanner && !isProcessing && (
                    <div className="mb-8">
                        <QRScanner
                            isOpen={showScanner}
                            onClose={() => setShowScanner(false)}
                            onScan={handleScan}
                        />
                    </div>
                )}

                {/* Recent Activity */}
                {scanResults.length > 0 && (
                    <div>
                        <h3 className="text-sm font-bold text-zinc-500 uppercase mb-4 flex items-center gap-2">
                            <Users size={16} /> Recent Activity
                        </h3>
                        <div className="space-y-3">
                            {scanResults.map((result, idx) => (
                                <Card
                                    key={idx}
                                    className={`p-4 border-2 ${
                                        result.success
                                            ? 'bg-green-500/10 border-green-500/30'
                                            : 'bg-red-500/10 border-red-500/30'
                                    }`}
                                >
                                    <div className="flex items-start gap-3">
                                        {result.success ? (
                                            <CheckCircle size={24} className="text-green-400 flex-shrink-0 mt-0.5" />
                                        ) : (
                                            <XCircle size={24} className="text-red-400 flex-shrink-0 mt-0.5" />
                                        )}
                                        <div className="flex-1 min-w-0">
                                            <div className="font-bold text-white mb-1">
                                                {result.attendeeName || result.message}
                                            </div>
                                            {result.ticketType && (
                                                <div className="text-sm text-zinc-400">{result.ticketType}</div>
                                            )}
                                            {!result.attendeeName && (
                                                <div className="text-sm text-zinc-400">{result.message}</div>
                                            )}
                                            <div className="text-xs text-zinc-600 mt-1">
                                                {new Date(result.timestamp).toLocaleTimeString()}
                                            </div>
                                        </div>
                                    </div>
                                </Card>
                            ))}
                        </div>
                    </div>
                )}
            </div>

            {/* Payment Required Modal */}
            {showPaymentModal && paymentInfo && (
                <div className="fixed inset-0 bg-black/80 backdrop-blur-sm z-50 flex items-center justify-center p-4">
                    <Card className="w-full max-w-md bg-zinc-900 border-orange-500/50 p-6">
                        <div className="text-center mb-6">
                            <div className="w-16 h-16 bg-orange-500/20 rounded-full flex items-center justify-center mx-auto mb-4">
                                <DollarSign size={32} className="text-orange-400" />
                            </div>
                            <h2 className="text-2xl font-bold text-white mb-2">Payment Required</h2>
                            <p className="text-zinc-400">This ticket must be paid before check-in</p>
                        </div>
                        
                        <div className="bg-zinc-800 rounded-xl p-4 mb-6">
                            <div className="flex justify-between items-center mb-2">
                                <span className="text-zinc-400">Guest</span>
                                <span className="text-white font-bold">{paymentInfo.attendeeName}</span>
                            </div>
                            <div className="flex justify-between items-center mb-2">
                                <span className="text-zinc-400">Ticket</span>
                                <span className="text-white">{paymentInfo.ticketType}</span>
                            </div>
                            <div className="flex justify-between items-center pt-2 border-t border-zinc-700">
                                <span className="text-zinc-400">Amount Due</span>
                                <span className="text-2xl font-black text-orange-400">${paymentInfo.price.toFixed(2)}</span>
                            </div>
                        </div>
                        
                        <div className="space-y-3">
                            <Button
                                onClick={() => handleStripePayment(paymentInfo)}
                                className="w-full bg-blue-600 hover:bg-blue-700 py-4 text-lg font-bold"
                            >
                                <CreditCard size={20} className="mr-2" />
                                Pay with Card (Stripe)
                            </Button>
                            
                            <Button
                                onClick={() => {
                                    setShowPaymentModal(false);
                                    setPaymentInfo(null);
                                }}
                                variant="outline"
                                className="w-full py-3"
                            >
                                Cancel
                            </Button>
                        </div>
                    </Card>
                </div>
            )}
        </div>
    );
};

// Helper function to create Stripe payment session
async function handleStripePayment(paymentInfo: PaymentInfo) {
    try {
        const token = await getAuthToken();
        const API_URL = import.meta.env.VITE_BACKEND_URL || import.meta.env.REACT_APP_BACKEND_URL || '';
        
        // Call backend to create Stripe checkout session
        const response = await fetch(`${API_URL}/api/stripe/create-door-session`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${token}`
            },
            body: JSON.stringify({
                registrationId: paymentInfo.registrationId,
                ticketId: paymentInfo.ticketId,
                amount: paymentInfo.price,
                returnUrl: window.location.origin + window.location.pathname
            })
        });
        
        if (!response.ok) {
            const error = await response.json();
            throw new Error(error.error || 'Failed to create payment session');
        }
        
        const { url } = await response.json();
        
        // Redirect to Stripe checkout
        if (url) {
            window.location.href = url;
        }
    } catch (error: any) {
        console.error('[MobileScanner] Payment error:', error);
        alert(error.message || 'Failed to process payment');
    }
}