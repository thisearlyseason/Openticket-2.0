import React, { useState, useEffect, useCallback } from 'react';
import { useParams, useNavigate, useSearchParams } from 'react-router-dom';
import { QRScanner } from './QRScanner';
import { kioskService, GuestSearchResult, ScanResult } from '../services/kioskService';
import { offlineSyncService } from '../services/offlineSyncService';
import { Button, Card, Badge, Input } from './UI';
import { QrCode, CheckCircle2, XCircle, Users, ArrowLeft, Search, Loader2, AlertTriangle, DollarSign, UserCheck } from 'lucide-react';

interface ScanHistory {
    success: boolean;
    message: string;
    attendeeName?: string;
    ticketType?: string;
    timestamp: number;
}

export const KioskCheckIn: React.FC = () => {
    const { eventId } = useParams<{ eventId: string }>();
    const [searchParams] = useSearchParams();
    const navigate = useNavigate();
    const tokenId = searchParams.get('token');

    const [showScanner, setShowScanner] = useState(searchParams.get('mode') !== 'search');
    const [showSearch, setShowSearch] = useState(searchParams.get('mode') === 'search');
    const [searchQuery, setSearchQuery] = useState('');
    const [searchResults, setSearchResults] = useState<GuestSearchResult[]>([]);
    const [isSearching, setIsSearching] = useState(false);
    const [selectedGuest, setSelectedGuest] = useState<GuestSearchResult | null>(null);
    const [scanHistory, setScanHistory] = useState<ScanHistory[]>([]);
    const [isProcessing, setIsProcessing] = useState(false);
    const [currentScan, setCurrentScan] = useState<ScanResult | null>(null);

    const handleScan = useCallback(async (qrData: string) => {
        if (isProcessing) return;

        setIsProcessing(true);
        setCurrentScan(null);
        setShowScanner(false); // STOP scanning after successful scan

        try {
            console.log('[KioskCheckIn] Scanning QR:', qrData);
            const result = await kioskService.scanTicket(qrData);

            setCurrentScan(result);

            // Add to history
            setScanHistory(prev => [{
                success: result.success && result.status === 'valid',
                message: result.message,
                attendeeName: result.attendeeName,
                ticketType: result.ticketType,
                timestamp: Date.now()
            }, ...prev.slice(0, 9)]);

            // Auto check-in if valid and paid
            if (result.success && result.status === 'valid' && result.registrationId) {
                await handleCheckIn(result.registrationId, result.attendeeName!);
            }

        } catch (error: any) {
            console.error('[KioskCheckIn] Scan error:', error);
            setCurrentScan({
                success: false,
                status: 'invalid',
                message: error.message || 'Scan failed'
            });
        } finally {
            setIsProcessing(false);
        }
    }, [isProcessing]);

    const handleSearch = async () => {
        if (!searchQuery.trim()) return;

        setIsSearching(true);
        try {
            const results = await kioskService.searchGuest(searchQuery);
            // FILTER OUT REFUNDED TICKETS
            const validResults = results.filter(r => r.paymentStatus !== 'refunded');
            setSearchResults(validResults);
        } catch (error) {
            console.error('[KioskCheckIn] Search error:', error);
        } finally {
            setIsSearching(false);
        }
    };

    const handleCheckIn = async (registrationId: string, attendeeName: string) => {
        try {
            await kioskService.checkIn(registrationId);

            // Show success
            setCurrentScan({
                success: true,
                status: 'valid',
                message: `${attendeeName} checked in successfully!`,
                attendeeName
            });

            // Clear after 3 seconds
            setTimeout(() => {
                setCurrentScan(null);
                setSelectedGuest(null);
                setSearchQuery('');
                setSearchResults([]);
            }, 3000);

        } catch (error: any) {
            console.error('[KioskCheckIn] Check-in error:', error);
            alert(error.message || 'Failed to check in');
        }
    };

    const handlePayment = (registrationId: string) => {
        navigate(`/kiosk/${eventId}/payment/${registrationId}?token=${tokenId}`);
    };

    const handleBack = () => {
        if (!tokenId) {
            console.error('[KioskCheckIn] No token found in URL');
            navigate(`/kiosk/${eventId}`);
            return;
        }
        navigate(`/kiosk/${eventId}?token=${tokenId}`);
    };

    const handleScanAnother = () => {
        setCurrentScan(null);
        setShowScanner(true);
        setShowSearch(false);
    };

    const getStatusColor = (status: string) => {
        switch (status) {
            case 'valid': return 'bg-green-500';
            case 'invalid': return 'bg-red-500';
            case 'already_checked_in': return 'bg-yellow-500';
            case 'payment_required': return 'bg-orange-500';
            default: return 'bg-zinc-500';
        }
    };

    // Check if payment is actually required (not just unpaid)
    const needsPayment = (guest: GuestSearchResult) => {
        // Only show "Pay Now" if payment_status is NOT 'paid' or 'succeeded'
        // AND price > 0
        return guest.price > 0 && 
               guest.paymentStatus !== 'paid' && 
               guest.paymentStatus !== 'succeeded';
    };

    return (
        <div className="min-h-screen bg-zinc-950 text-white">
            {/* Header */}
            <div className="bg-zinc-900 border-b border-zinc-800 px-6 py-4">
                <div className="max-w-7xl mx-auto flex items-center justify-between">
                    <Button
                        variant="ghost"
                        onClick={handleBack}
                        className="flex items-center gap-2"
                    >
                        <ArrowLeft size={20} />
                        Back
                    </Button>
                    <h1 className="text-2xl font-bold">Check In</h1>
                    <div className="w-20" /> {/* Spacer */}
                </div>
            </div>

            <div className="max-w-7xl mx-auto p-6">
                {/* Mode Toggle - Only show if no current scan result */}
                {!currentScan && (
                    <div className="flex gap-4 mb-6">
                        <Button
                            onClick={() => {
                                setShowScanner(true);
                                setShowSearch(false);
                            }}
                            variant={showScanner ? 'default' : 'secondary'}
                            className="flex-1"
                            size="lg"
                        >
                            <QrCode size={20} className="mr-2" />
                            Scan QR Code
                        </Button>
                        <Button
                            onClick={() => {
                                setShowScanner(false);
                                setShowSearch(true);
                            }}
                            variant={showSearch ? 'default' : 'secondary'}
                            className="flex-1"
                            size="lg"
                        >
                            <Search size={20} className="mr-2" />
                            Manual Search
                        </Button>
                    </div>
                )}

                {/* Scanner Mode */}
                {showScanner && !currentScan && (
                    <Card className="p-6 bg-zinc-900 border-zinc-800 mb-6">
                        <QRScanner
                            onScan={handleScan}
                            onClose={() => setShowScanner(false)}
                            isOpen={showScanner && !isProcessing}
                        />
                        {isProcessing && (
                            <div className="text-center py-4">
                                <Loader2 className="animate-spin mx-auto text-primary" size={32} />
                                <p className="text-zinc-400 mt-2">Processing...</p>
                            </div>
                        )}
                    </Card>
                )}

                {/* Search Mode */}
                {showSearch && !currentScan && (
                    <Card className="p-6 bg-zinc-900 border-zinc-800 mb-6">
                        <div className="flex gap-4 mb-6">
                            <Input
                                type="text"
                                placeholder="Search by name, email, or ticket ID..."
                                value={searchQuery}
                                onChange={(e) => setSearchQuery(e.target.value)}
                                onKeyPress={(e) => e.key === 'Enter' && handleSearch()}
                                className="flex-1 text-lg py-6"
                            />
                            <Button
                                onClick={handleSearch}
                                disabled={isSearching || !searchQuery.trim()}
                                size="lg"
                                className="px-8"
                            >
                                {isSearching ? (
                                    <Loader2 className="animate-spin" size={20} />
                                ) : (
                                    <>
                                        <Search size={20} className="mr-2" />
                                        Search
                                    </>
                                )}
                            </Button>
                        </div>

                        {/* Search Results */}
                        {searchResults.length > 0 && (
                            <div className="space-y-3">
                                <h3 className="text-lg font-bold text-zinc-400 mb-4">
                                    Found {searchResults.length} result(s)
                                </h3>
                                {searchResults.map((guest) => (
                                    <Card
                                        key={`${guest.id}-${guest.ticketId}`}
                                        className={`p-4 cursor-pointer hover:border-primary transition-colors ${
                                            guest.checkedIn ? 'bg-zinc-800/50 border-zinc-700' : 'bg-zinc-800 border-zinc-700'
                                        }`}
                                        onClick={() => !guest.checkedIn && setSelectedGuest(guest)}
                                    >
                                        <div className="flex items-center justify-between">
                                            <div className="flex-1">
                                                <h4 className="text-lg font-bold text-white">{guest.attendeeName}</h4>
                                                <p className="text-sm text-zinc-400">{guest.attendeeEmail}</p>
                                                <div className="flex items-center gap-3 mt-2">
                                                    <Badge variant="secondary" className="text-xs">
                                                        {guest.ticketType}
                                                    </Badge>
                                                    {guest.ticketId && (
                                                        <Badge variant="outline" className="text-xs font-mono">
                                                            {guest.ticketId}
                                                        </Badge>
                                                    )}
                                                    {guest.price > 0 && (
                                                        <span className="text-xs text-zinc-500">
                                                            ${guest.price.toFixed(2)}
                                                        </span>
                                                    )}
                                                </div>
                                            </div>
                                            {guest.checkedIn ? (
                                                <Badge variant="success" className="flex items-center gap-2">
                                                    <CheckCircle2 size={16} />
                                                    Checked In
                                                </Badge>
                                            ) : needsPayment(guest) ? (
                                                <Button
                                                    onClick={(e) => {
                                                        e.stopPropagation();
                                                        handlePayment(guest.id);
                                                    }}
                                                    variant="warning"
                                                    size="sm"
                                                >
                                                    <DollarSign size={16} className="mr-2" />
                                                    Pay Now
                                                </Button>
                                            ) : (
                                                <Button
                                                    onClick={(e) => {
                                                        e.stopPropagation();
                                                        handleCheckIn(guest.id, guest.attendeeName);
                                                    }}
                                                    size="sm"
                                                >
                                                    <UserCheck size={16} className="mr-2" />
                                                    Check In
                                                </Button>
                                            )}
                                        </div>
                                    </Card>
                                ))}
                            </div>
                        )}

                        {searchResults.length === 0 && searchQuery && !isSearching && (
                            <div className="text-center py-12">
                                <Users className="mx-auto mb-4 text-zinc-600" size={48} />
                                <p className="text-zinc-500">No guests found</p>
                            </div>
                        )}
                    </Card>
                )}

                {/* Current Scan Result */}
                {currentScan && (
                    <Card className={`p-8 mb-6 ${getStatusColor(currentScan.status)} border-none`}>
                        <div className="text-center">
                            {currentScan.success && currentScan.status === 'valid' ? (
                                <>
                                    <CheckCircle2 className="mx-auto mb-4 text-white" size={64} />
                                    <h2 className="text-3xl font-bold text-white mb-2">Welcome!</h2>
                                    <p className="text-2xl text-white/90 mb-2">{currentScan.attendeeName}</p>
                                    <p className="text-white/80">{currentScan.ticketType}</p>
                                    <Button
                                        onClick={handleScanAnother}
                                        variant="secondary"
                                        size="lg"
                                        className="mt-6"
                                    >
                                        Scan Another
                                    </Button>
                                </>
                            ) : currentScan.status === 'payment_required' ? (
                                <>
                                    <DollarSign className="mx-auto mb-4 text-white" size={64} />
                                    <h2 className="text-2xl font-bold text-white mb-2">Payment Required</h2>
                                    <p className="text-xl text-white/90 mb-2">{currentScan.attendeeName}</p>
                                    <p className="text-white/80 mb-4">${currentScan.price?.toFixed(2)}</p>
                                    {currentScan.registrationId && (
                                        <Button
                                            onClick={() => handlePayment(currentScan.registrationId!)}
                                            variant="secondary"
                                            size="lg"
                                        >
                                            Process Payment
                                        </Button>
                                    )}
                                </>
                            ) : currentScan.status === 'already_checked_in' ? (
                                <>
                                    <AlertTriangle className="mx-auto mb-4 text-white" size={64} />
                                    <h2 className="text-2xl font-bold text-white mb-2">Already Checked In</h2>
                                    <p className="text-xl text-white/90">{currentScan.attendeeName}</p>
                                    <Button
                                        onClick={handleScanAnother}
                                        variant="secondary"
                                        size="lg"
                                        className="mt-6"
                                    >
                                        Scan Another
                                    </Button>
                                </>
                            ) : (
                                <>
                                    <XCircle className="mx-auto mb-4 text-white" size={64} />
                                    <h2 className="text-2xl font-bold text-white mb-2">Invalid Ticket</h2>
                                    <p className="text-white/90 mb-6">{currentScan.message}</p>
                                    <Button
                                        onClick={handleScanAnother}
                                        variant="secondary"
                                        size="lg"
                                    >
                                        Try Again
                                    </Button>
                                </>
                            )}
                        </div>
                    </Card>
                )}

                {/* Scan History */}
                {scanHistory.length > 0 && (
                    <Card className="p-6 bg-zinc-900 border-zinc-800">
                        <h3 className="text-lg font-bold mb-4 flex items-center gap-2">
                            <Users size={20} />
                            Recent Activity
                        </h3>
                        <div className="space-y-2">
                            {scanHistory.slice(0, 5).map((scan, i) => (
                                <div
                                    key={i}
                                    className="flex items-center justify-between p-3 bg-zinc-800 rounded-lg"
                                >
                                    <div className="flex-1">
                                        <p className="font-semibold">{scan.attendeeName || 'Unknown'}</p>
                                        <p className="text-sm text-zinc-400">{scan.ticketType}</p>
                                    </div>
                                    <Badge variant={scan.success ? 'success' : 'destructive'} className="text-xs">
                                        {scan.success ? 'Checked In' : scan.message}
                                    </Badge>
                                </div>
                            ))}
                        </div>
                    </Card>
                )}
            </div>
        </div>
    );
};
