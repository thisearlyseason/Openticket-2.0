import React, { useState, useEffect, useCallback } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { QRScanner } from './QRScanner';
import { StorageService } from '../services/storageService';
import { offlineSyncService } from '../services/offlineSyncService';
import { scanAnalyticsService } from '../services/scanAnalyticsService';
import { Event, Registration } from '../types';
import { Button, Card, Badge } from './UI';
import { QrCode, CheckCircle2, XCircle, Users, Clock, Zap, AlertTriangle, Smartphone, WifiOff, ArrowLeft, BarChart3, RotateCw, Ticket, UserCheck, Database, TrendingUp } from 'lucide-react';
import { getAuthToken } from '../services/firebaseConfig';

interface ScanResult {
    success: boolean;
    message: string;
    attendeeName?: string;
    ticketType?: string;
    timestamp: number;
}

export const MobileCheckInScanner: React.FC = () => {
    const { id } = useParams<{ id: string }>();
    const navigate = useNavigate();
    const [event, setEvent] = useState<Event | null>(null);
    const [isLoading, setIsLoading] = useState(true);
    const [showScanner, setShowScanner] = useState(false);
    const [scanResults, setScanResults] = useState<ScanResult[]>([]);
    const [stats, setStats] = useState({
        total: 0,
        checkedIn: 0,
        pending: 0
    });
    const [isOnline, setIsOnline] = useState(navigator.onLine);
    const [isProcessing, setIsProcessing] = useState(false);
    const [pendingSync, setPendingSync] = useState(0);
    const [showAnalytics, setShowAnalytics] = useState(false);
    const [analytics, setAnalytics] = useState<any>(null);

    // Monitor online status
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

    // Load event and stats
    useEffect(() => {
        loadEventData();
        loadPendingSync();
        
        // Initialize offline sync
        offlineSyncService.init().catch(console.error);
    }, [id]);

    // Listen for sync completion
    useEffect(() => {
        const handleSyncComplete = (event: any) => {
            console.log('[Scanner] Sync complete:', event.detail);
            loadPendingSync();
            loadEventData(); // Refresh stats
        };

        window.addEventListener('pwa-sync-complete', handleSyncComplete);
        return () => window.removeEventListener('pwa-sync-complete', handleSyncComplete);
    }, []);

    const loadEventData = async () => {
        if (!id) return;
        
        setIsLoading(true);
        try {
            let eventData: Event | null = null;
            
            // Try online first
            if (navigator.onLine) {
                eventData = await StorageService.getEventById(id);
                if (eventData) {
                    // Cache for offline use
                    await offlineSyncService.cacheEvent(id, eventData);
                }
            } else {
                // Use cached data if offline
                eventData = await offlineSyncService.getCachedEvent(id);
            }
            
            if (!eventData) {
                throw new Error('Event not found');
            }
            setEvent(eventData);
            
            // Load registrations to calculate stats
            let registrations: any[] = [];
            if (navigator.onLine) {
                registrations = await StorageService.getRegistrations(id);
                await offlineSyncService.cacheRegistrations(id, registrations);
            } else {
                registrations = await offlineSyncService.getCachedRegistrations(id);
            }
            
            const tickets = registrations.flatMap(r => r.tickets || []);
            
            setStats({
                total: tickets.length,
                checkedIn: tickets.filter(t => t.checkedIn).length,
                pending: tickets.filter(t => !t.checkedIn).length
            });
        } catch (error) {
            console.error('Error loading event:', error);
        } finally {
            setIsLoading(false);
        }
    };

    const loadPendingSync = async () => {
        try {
            const pending = await offlineSyncService.getPendingCheckIns();
            setPendingSync(pending.length);
        } catch (error) {
            console.error('Error loading pending sync:', error);
        }
    };

    const loadAnalytics = async () => {
        if (!id) return;
        
        try {
            // Try to get from backend first (if online)
            if (navigator.onLine) {
                const token = await getAuthToken();
                const response = await fetch(`/api/analytics/scan-summary/${id}`, {
                    headers: {
                        'Authorization': `Bearer ${token}`
                    }
                });

                if (response.ok) {
                    const data = await response.json();
                    setAnalytics(data.analytics);
                    return;
                }
            }

            // Fallback to IndexedDB
            const analyticsData = await scanAnalyticsService.getAnalytics(id);
            setAnalytics(analyticsData);
        } catch (error) {
            console.error('Error loading analytics:', error);
            
            // Fallback to IndexedDB on error
            try {
                const analyticsData = await scanAnalyticsService.getAnalytics(id);
                setAnalytics(analyticsData);
            } catch (fallbackError) {
                console.error('Fallback analytics failed:', fallbackError);
            }
        }
    };

    // Handle QR scan
    const handleScan = useCallback(async (qrData: string) => {
        if (isProcessing || !id) return;
        
        setIsProcessing(true);
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

            // Check if online
            if (!navigator.onLine) {
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
                
                // Track analytics
                await scanAnalyticsService.trackScan({
                    eventId: id,
                    ticketId,
                    success: true,
                    duration: Date.now() - scanStartTime,
                    timestamp: Date.now(),
                    scanMethod: 'camera'
                });
                
                if (navigator.vibrate) {
                    navigator.vibrate([150, 50, 150]);
                }
                
                playSuccessSound();
                setIsProcessing(false);
                return;
            }

            // Online - process immediately
            const token = await getAuthToken();
            console.log('[MobileScanner] Checking in ticket:', ticketId);
            const response = await fetch('/api/registrations/checkin', {
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

            const result = await response.json();
            const scanDuration = Date.now() - scanStartTime;

            if (response.ok) {
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
                
                // Track analytics
                await scanAnalyticsService.trackScan({
                    eventId: id,
                    ticketId,
                    success: true,
                    duration: scanDuration,
                    timestamp: Date.now(),
                    scanMethod: 'camera'
                });
                
                if (navigator.vibrate) {
                    navigator.vibrate([200, 100, 200]);
                }
                
                playSuccessSound();
                
                // Close scanner after successful check-in
                setShowScanner(false);
            } else {
                // Error
                const scanResult: ScanResult = {
                    success: false,
                    message: result.error || result.message || 'Check-in failed',
                    timestamp: Date.now()
                };
                
                setScanResults(prev => [scanResult, ...prev.slice(0, 9)]);
                
                // Track analytics
                await scanAnalyticsService.trackScan({
                    eventId: id,
                    ticketId,
                    success: false,
                    errorMessage: result.error || result.message,
                    duration: scanDuration,
                    timestamp: Date.now(),
                    scanMethod: 'camera'
                });
                
                if (navigator.vibrate) {
                    navigator.vibrate([100, 50, 100, 50, 100]);
                }
                
                playErrorSound();
                
                // Close scanner to show error message
                setShowScanner(false);
            }
        } catch (error: any) {
            console.error('Check-in error:', error);
            
            const scanResult: ScanResult = {
                success: false,
                message: error.message || 'Network error',
                timestamp: Date.now()
            };
            
            setScanResults(prev => [scanResult, ...prev.slice(0, 9)]);
            
            // Track analytics
            if (id) {
                await scanAnalyticsService.trackScan({
                    eventId: id,
                    success: false,
                    errorMessage: error.message,
                    duration: Date.now() - scanStartTime,
                    timestamp: Date.now(),
                    scanMethod: 'camera'
                });
            }
            
            if (navigator.vibrate) {
                navigator.vibrate([100, 50, 100, 50, 100]);
            }
        } finally {
            setIsProcessing(false);
        }
    }, [isProcessing, id]);

    // Audio feedback
    const playSuccessSound = () => {
        const audioContext = new (window.AudioContext || (window as any).webkitAudioContext)();
        const oscillator = audioContext.createOscillator();
        const gainNode = audioContext.createGain();
        
        oscillator.connect(gainNode);
        gainNode.connect(audioContext.destination);
        
        oscillator.frequency.value = 800;
        gainNode.gain.value = 0.3;
        
        oscillator.start(audioContext.currentTime);
        oscillator.stop(audioContext.currentTime + 0.1);
    };

    const playErrorSound = () => {
        const audioContext = new (window.AudioContext || (window as any).webkitAudioContext)();
        const oscillator = audioContext.createOscillator();
        const gainNode = audioContext.createGain();
        
        oscillator.connect(gainNode);
        gainNode.connect(audioContext.destination);
        
        oscillator.frequency.value = 300;
        oscillator.type = 'square';
        gainNode.gain.value = 0.2;
        
        oscillator.start(audioContext.currentTime);
        oscillator.stop(audioContext.currentTime + 0.2);
    };

    if (isLoading) {
        return (
            <div className="min-h-screen bg-gradient-to-br from-zinc-900 via-black to-zinc-900 flex items-center justify-center">
                <div className="text-center">
                    <div className="animate-spin rounded-full h-12 w-12 border-4 border-[#ec4899] border-t-transparent mx-auto mb-4" />
                    <p className="text-white/60">Loading event...</p>
                </div>
            </div>
        );
    }

    if (!event) {
        return (
            <div className="min-h-screen bg-gradient-to-br from-zinc-900 via-black to-zinc-900 flex items-center justify-center p-4">
                <Card className="p-8 text-center bg-zinc-900 border-zinc-800">
                    <XCircle className="mx-auto mb-4 text-red-500" size={48} />
                    <h2 className="text-xl font-bold text-white mb-2">Event Not Found</h2>
                    <p className="text-zinc-400 mb-4">Unable to load event details</p>
                    <Button onClick={() => navigate('/dashboard')}>
                        <ArrowLeft size={16} className="mr-2" /> Back to Dashboard
                    </Button>
                </Card>
            </div>
        );
    }

    return (
        <div className="min-h-screen bg-gradient-to-br from-zinc-900 via-black to-zinc-900">
            {/* Header */}
            <div className="bg-black/50 backdrop-blur-md border-b border-zinc-800 sticky top-0 z-10">
                <div className="p-4">
                    <div className="flex items-center justify-between mb-3">
                        <button
                            onClick={() => navigate(`/manage/${id}`)}
                            className="p-2 rounded-lg bg-white/5 hover:bg-white/10 transition-colors"
                        >
                            <ArrowLeft size={20} className="text-white" />
                        </button>
                        
                        <div className="flex items-center gap-2">
                            {!isOnline && (
                                <Badge className="bg-orange-600 text-white border-none flex items-center gap-1">
                                    <WifiOff size={12} /> Offline
                                </Badge>
                            )}
                            {pendingSync > 0 && (
                                <Badge className="bg-blue-600 text-white border-none flex items-center gap-1">
                                    <Database size={12} /> {pendingSync} Pending
                                </Badge>
                            )}
                            <button
                                onClick={() => {
                                    loadEventData();
                                    loadPendingSync();
                                }}
                                className="p-2 rounded-lg bg-white/5 hover:bg-white/10 transition-colors"
                            >
                                <RotateCw size={20} className="text-white" />
                            </button>
                        </div>
                    </div>
                    
                    <h1 className="text-xl font-black text-white mb-1 line-clamp-1">{event.title}</h1>
                    <p className="text-sm text-zinc-400 flex items-center gap-2">
                        <Smartphone size={14} /> Mobile Check-In Scanner
                    </p>
                </div>

                {/* Stats Bar */}
                <div className="grid grid-cols-3 divide-x divide-zinc-800 bg-black/30">
                    <div className="p-3 text-center">
                        <div className="text-2xl font-black text-white">{stats.total}</div>
                        <div className="text-xs text-zinc-500 uppercase font-bold">Total</div>
                    </div>
                    <div className="p-3 text-center">
                        <div className="text-2xl font-black text-[#ec4899]">{stats.checkedIn}</div>
                        <div className="text-xs text-zinc-500 uppercase font-bold">Checked In</div>
                    </div>
                    <div className="p-3 text-center">
                        <div className="text-2xl font-black text-orange-500">{stats.pending}</div>
                        <div className="text-xs text-zinc-500 uppercase font-bold">Pending</div>
                    </div>
                </div>
            </div>

            {/* Main Content */}
            <div className="p-4 pb-24">
                {/* Scan Button */}
                <button
                    onClick={() => setShowScanner(true)}
                    className="w-full bg-gradient-to-r from-[#ec4899] to-[#8b5cf6] text-white rounded-2xl p-8 shadow-lg shadow-[#ec4899]/30 hover:shadow-xl hover:shadow-[#ec4899]/40 transition-all active:scale-95 mb-6"
                >
                    <QrCode size={64} className="mx-auto mb-4" />
                    <div className="text-2xl font-black mb-2">Scan Ticket</div>
                    <div className="text-sm opacity-90">Tap to open camera scanner</div>
                </button>

                {/* Recent Scans */}
                <div className="mb-6">
                    <h2 className="text-lg font-bold text-white mb-3 flex items-center gap-2">
                        <Clock size={20} className="text-[#ec4899]" /> Recent Activity
                    </h2>
                    
                    {scanResults.length === 0 ? (
                        <Card className="p-8 text-center bg-zinc-900/50 border-zinc-800">
                            <Ticket size={48} className="mx-auto mb-3 text-zinc-700" />
                            <p className="text-zinc-500 text-sm">No scans yet</p>
                            <p className="text-zinc-600 text-xs mt-1">Scan your first ticket to get started</p>
                        </Card>
                    ) : (
                        <div className="space-y-3">
                            {scanResults.map((result, index) => (
                                <Card
                                    key={index}
                                    className={`p-4 border-l-4 ${
                                        result.success
                                            ? 'bg-green-900/20 border-green-500'
                                            : 'bg-red-900/20 border-red-500'
                                    } border-r border-t border-b border-zinc-800`}
                                >
                                    <div className="flex items-start gap-3">
                                        <div className={`p-2 rounded-lg ${
                                            result.success ? 'bg-green-600' : 'bg-red-600'
                                        }`}>
                                            {result.success ? (
                                                <CheckCircle2 size={20} className="text-white" />
                                            ) : (
                                                <XCircle size={20} className="text-white" />
                                            )}
                                        </div>
                                        <div className="flex-1 min-w-0">
                                            <div className="font-bold text-white mb-1">
                                                {result.success ? result.attendeeName : result.message}
                                            </div>
                                            {result.success && result.ticketType && (
                                                <div className="text-sm text-zinc-400 mb-1">{result.ticketType}</div>
                                            )}
                                            <div className="text-xs text-zinc-500">
                                                {new Date(result.timestamp).toLocaleTimeString()}
                                            </div>
                                        </div>
                                    </div>
                                </Card>
                            ))}
                        </div>
                    )}
                </div>

                {/* Quick Actions */}
                <div className="grid grid-cols-2 gap-3">
                    <button
                        onClick={() => {
                            loadAnalytics();
                            setShowAnalytics(true);
                        }}
                        className="p-4 rounded-xl bg-zinc-900 border border-zinc-800 hover:border-zinc-700 transition-colors text-left"
                    >
                        <TrendingUp size={24} className="text-[#ec4899] mb-2" />
                        <div className="text-sm font-bold text-white">Scan Analytics</div>
                        <div className="text-xs text-zinc-500">View performance</div>
                    </button>
                    
                    <button
                        onClick={() => navigate(`/manage/${id}/analytics`)}
                        className="p-4 rounded-xl bg-zinc-900 border border-zinc-800 hover:border-zinc-700 transition-colors text-left"
                    >
                        <BarChart3 size={24} className="text-blue-500 mb-2" />
                        <div className="text-sm font-bold text-white">Event Analytics</div>
                        <div className="text-xs text-zinc-500">Full insights</div>
                    </button>
                </div>
            </div>

            {/* QR Scanner Modal */}
            <QRScanner
                isOpen={showScanner}
                onClose={() => setShowScanner(false)}
                onScan={handleScan}
            />

            {/* Processing Overlay */}
            {isProcessing && (
                <div className="fixed inset-0 bg-black/80 backdrop-blur-sm flex items-center justify-center z-50">
                    <div className="text-center">
                        <div className="animate-spin rounded-full h-16 w-16 border-4 border-[#ec4899] border-t-transparent mx-auto mb-4" />
                        <p className="text-white font-bold">Processing...</p>
                    </div>
                </div>
            )}

            {/* Analytics Modal */}
            {showAnalytics && analytics && (
                <div className="fixed inset-0 bg-black/90 backdrop-blur-sm z-50 overflow-y-auto">
                    <div className="min-h-screen p-4">
                        <div className="max-w-2xl mx-auto">
                            {/* Header */}
                            <div className="flex justify-between items-center mb-6 pt-4">
                                <h2 className="text-2xl font-black text-white flex items-center gap-2">
                                    <TrendingUp size={28} className="text-[#ec4899]" />
                                    Scan Analytics
                                </h2>
                                <button
                                    onClick={() => setShowAnalytics(false)}
                                    className="p-2 rounded-lg bg-white/10 hover:bg-white/20 text-white"
                                >
                                    ✕
                                </button>
                            </div>

                            {/* Stats Grid */}
                            <div className="grid grid-cols-2 gap-3 mb-6">
                                <Card className="p-4 bg-zinc-900 border-zinc-800">
                                    <div className="text-3xl font-black text-white mb-1">{analytics.totalScans}</div>
                                    <div className="text-xs text-zinc-500 uppercase font-bold">Total Scans</div>
                                </Card>
                                <Card className="p-4 bg-zinc-900 border-zinc-800">
                                    <div className="text-3xl font-black text-green-500 mb-1">{analytics.successRate}%</div>
                                    <div className="text-xs text-zinc-500 uppercase font-bold">Success Rate</div>
                                </Card>
                                <Card className="p-4 bg-zinc-900 border-zinc-800">
                                    <div className="text-3xl font-black text-blue-500 mb-1">{analytics.averageScanTime}ms</div>
                                    <div className="text-xs text-zinc-500 uppercase font-bold">Avg Scan Time</div>
                                </Card>
                                <Card className="p-4 bg-zinc-900 border-zinc-800">
                                    <div className="text-3xl font-black text-orange-500 mb-1">{analytics.scansPerMinute}</div>
                                    <div className="text-xs text-zinc-500 uppercase font-bold">Scans/Min</div>
                                </Card>
                            </div>

                            {/* Performance */}
                            <Card className="p-4 bg-zinc-900 border-zinc-800 mb-4">
                                <h3 className="font-bold text-white mb-3">Performance</h3>
                                <div className="space-y-2 text-sm">
                                    <div className="flex justify-between">
                                        <span className="text-zinc-400">Fastest Scan:</span>
                                        <span className="text-green-500 font-bold">{analytics.fastestScan}ms</span>
                                    </div>
                                    <div className="flex justify-between">
                                        <span className="text-zinc-400">Slowest Scan:</span>
                                        <span className="text-red-500 font-bold">{analytics.slowestScan}ms</span>
                                    </div>
                                    <div className="flex justify-between">
                                        <span className="text-zinc-400">Peak Time:</span>
                                        <span className="text-white font-bold">{analytics.peakScanTime}</span>
                                    </div>
                                </div>
                            </Card>

                            {/* Scan Methods */}
                            {Object.keys(analytics.scansByMethod).length > 0 && (
                                <Card className="p-4 bg-zinc-900 border-zinc-800 mb-4">
                                    <h3 className="font-bold text-white mb-3">Scan Methods</h3>
                                    <div className="space-y-2">
                                        {Object.entries(analytics.scansByMethod).map(([method, count]: [string, any]) => (
                                            <div key={method} className="flex justify-between items-center">
                                                <span className="text-zinc-400 capitalize">{method}:</span>
                                                <span className="text-white font-bold">{count}</span>
                                            </div>
                                        ))}
                                    </div>
                                </Card>
                            )}

                            {/* Error Breakdown */}
                            {Object.keys(analytics.errorBreakdown).length > 0 && (
                                <Card className="p-4 bg-zinc-900 border-zinc-800 mb-4">
                                    <h3 className="font-bold text-white mb-3">Error Breakdown</h3>
                                    <div className="space-y-2">
                                        {Object.entries(analytics.errorBreakdown).map(([error, count]: [string, any]) => (
                                            <div key={error} className="flex justify-between items-center text-sm">
                                                <span className="text-zinc-400 flex-1 truncate">{error}:</span>
                                                <span className="text-red-500 font-bold ml-2">{count}</span>
                                            </div>
                                        ))}
                                    </div>
                                </Card>
                            )}

                            <Button
                                onClick={() => setShowAnalytics(false)}
                                className="w-full bg-zinc-800 hover:bg-zinc-700 border-zinc-700"
                            >
                                Close
                            </Button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
};

export default MobileCheckInScanner;
