import React, { useState, useEffect } from 'react';
import { kioskService, KioskToken } from '../services/kioskService';
import { Button, Card, Badge, Input } from './UI';
import { 
    Lock, 
    Unlock, 
    QrCode, 
    AlertTriangle, 
    CheckCircle, 
    Copy, 
    Trash2, 
    Loader2,
    Info,
    Download
} from 'lucide-react';
import QRCode from 'qrcode';

interface KioskSettingsProps {
    eventId: string;
}

export const KioskSettings: React.FC<KioskSettingsProps> = ({ eventId }) => {
    const [loading, setLoading] = useState(true);
    const [generating, setGenerating] = useState(false);
    const [revoking, setRevoking] = useState(false);
    const [token, setToken] = useState<KioskToken | null>(null);
    const [kioskUrl, setKioskUrl] = useState<string>('');
    const [qrDataUrl, setQrDataUrl] = useState<string>('');
    const [error, setError] = useState<string | null>(null);
    const [successMessage, setSuccessMessage] = useState<string | null>(null);
    
    // Settings form
    const [paymentEnabled, setPaymentEnabled] = useState(true);
    const [pinCode, setPinCode] = useState('');
    const [usePinCode, setUsePinCode] = useState(false);

    useEffect(() => {
        loadKioskStatus();
    }, [eventId]);

    const loadKioskStatus = async () => {
        try {
            setLoading(true);
            setError(null);
            
            const status = await kioskService.getKioskStatus(eventId);
            
            if (status.active && status.token) {
                setToken(status.token);
                const url = status.kioskUrl || `${window.location.origin}/#/kiosk/${eventId}?token=${status.token.tokenId}`;
                setKioskUrl(url);
                generateQRCode(url);
            }
            
            setLoading(false);
        } catch (err: any) {
            console.error('[KioskSettings] Load error:', err);
            setError(err.message || 'Failed to load kiosk status');
            setLoading(false);
        }
    };

    const generateQRCode = async (url: string) => {
        try {
            const dataUrl = await QRCode.toDataURL(url, {
                width: 300,
                margin: 2,
                color: {
                    dark: '#000000',
                    light: '#FFFFFF'
                }
            });
            setQrDataUrl(dataUrl);
        } catch (err) {
            console.error('[KioskSettings] QR generation error:', err);
        }
    };

    const handleGenerateToken = async () => {
        try {
            setGenerating(true);
            setError(null);
            setSuccessMessage(null);

            const response = await kioskService.generateToken(eventId, {
                paymentEnabled,
                pinCode: usePinCode ? pinCode : undefined
            });

            setToken(response.token as any);
            setKioskUrl(response.kioskUrl);
            generateQRCode(response.kioskUrl);
            setSuccessMessage('Kiosk mode activated successfully!');
            setGenerating(false);
        } catch (err: any) {
            console.error('[KioskSettings] Generate error:', err);
            setError(err.message || 'Failed to generate kiosk token');
            setGenerating(false);
        }
    };

    const handleRevokeToken = async () => {
        // Try to use window.confirm if available, otherwise proceed without confirmation
        const shouldRevoke = typeof window.confirm === 'function' 
            ? window.confirm('Are you sure you want to disable kiosk mode? All active kiosk devices will be immediately locked out.')
            : true;
            
        if (!shouldRevoke) {
            return;
        }

        try {
            setRevoking(true);
            setError(null);
            setSuccessMessage(null);

            await kioskService.revokeToken(eventId, token?.tokenId);

            setToken(null);
            setKioskUrl('');
            setQrDataUrl('');
            setSuccessMessage('Kiosk mode disabled successfully.');
            setRevoking(false);
        } catch (err: any) {
            console.error('[KioskSettings] Revoke error:', err);
            setError(err.message || 'Failed to revoke kiosk token');
            setRevoking(false);
        }
    };

    const handleCopyUrl = () => {
        navigator.clipboard.writeText(kioskUrl);
        setSuccessMessage('Kiosk URL copied to clipboard!');
        setTimeout(() => setSuccessMessage(null), 2000);
    };

    const handleDownloadQR = () => {
        const link = document.createElement('a');
        link.download = `kiosk-qr-${eventId}.png`;
        link.href = qrDataUrl;
        link.click();
    };

    if (loading) {
        return (
            <Card className="p-8">
                <div className="flex items-center justify-center">
                    <Loader2 className="animate-spin text-primary mr-3" size={24} />
                    <span>Loading kiosk settings...</span>
                </div>
            </Card>
        );
    }

    return (
        <div className="space-y-6">
            <div>
                <h1 className="text-3xl font-bold mb-2">Kiosk Mode Settings</h1>
                <p className="text-zinc-600 dark:text-zinc-400">
                    Configure a locked-down check-in kiosk for your event staff or volunteers.
                </p>
            </div>

            {error && (
                <Card className="p-4 bg-red-50 dark:bg-red-950 border-red-200 dark:border-red-800">
                    <div className="flex items-start gap-3">
                        <AlertTriangle className="text-red-600 dark:text-red-400 flex-shrink-0" size={20} />
                        <p className="text-red-800 dark:text-red-200 text-sm">{error}</p>
                    </div>
                </Card>
            )}

            {successMessage && (
                <Card className="p-4 bg-green-50 dark:bg-green-950 border-green-200 dark:border-green-800">
                    <div className="flex items-start gap-3">
                        <CheckCircle className="text-green-600 dark:text-green-400 flex-shrink-0" size={20} />
                        <p className="text-green-800 dark:text-green-200 text-sm">{successMessage}</p>
                    </div>
                </Card>
            )}

            <Card className="p-6 bg-blue-50 dark:bg-blue-950 border-blue-200 dark:border-blue-800">
                <div className="flex items-start gap-3">
                    <Info className="text-blue-600 dark:text-blue-400 flex-shrink-0 mt-1" size={20} />
                    <div className="text-sm text-blue-800 dark:text-blue-200">
                        <p className="font-semibold mb-1">What is Kiosk Mode?</p>
                        <p>
                            Kiosk Mode creates a secure, limited-access interface for check-in tablets or devices.
                            Staff can scan tickets, look up guests, and process door payments without accessing 
                            your admin dashboard or other sensitive areas.
                        </p>
                    </div>
                </div>
            </Card>

            {!token ? (
                <Card className="p-6">
                    <h2 className="text-xl font-semibold mb-4">Activate Kiosk Mode</h2>
                    
                    <div className="space-y-4 mb-6">
                        <div className="flex items-center gap-3">
                            <input
                                type="checkbox"
                                id="paymentEnabled"
                                checked={paymentEnabled}
                                onChange={(e) => setPaymentEnabled(e.target.checked)}
                                className="w-4 h-4"
                            />
                            <label htmlFor="paymentEnabled" className="text-sm font-medium">
                                Enable Door Payments (allow kiosk to accept walk-in purchases)
                            </label>
                        </div>

                        <div className="flex items-center gap-3">
                            <input
                                type="checkbox"
                                id="usePinCode"
                                checked={usePinCode}
                                onChange={(e) => setUsePinCode(e.target.checked)}
                                className="w-4 h-4"
                            />
                            <label htmlFor="usePinCode" className="text-sm font-medium">
                                Require PIN code to exit kiosk mode
                            </label>
                        </div>

                        {usePinCode && (
                            <div className="ml-7">
                                <Input
                                    type="text"
                                    placeholder="Enter 4-digit PIN"
                                    value={pinCode}
                                    onChange={(e) => setPinCode(e.target.value.replace(/\D/g, '').slice(0, 4))}
                                    maxLength={4}
                                    className="max-w-xs"
                                />
                                <p className="text-xs text-zinc-500 mt-1">
                                    Staff will need this PIN to exit kiosk mode
                                </p>
                            </div>
                        )}
                    </div>

                    <Button
                        onClick={handleGenerateToken}
                        disabled={generating || (usePinCode && pinCode.length !== 4)}
                        className="w-full sm:w-auto"
                    >
                        {generating ? (
                            <>
                                <Loader2 className="animate-spin mr-2" size={18} />
                                Generating...
                            </>
                        ) : (
                            <>
                                <Unlock className="mr-2" size={18} />
                                Activate Kiosk Mode
                            </>
                        )}
                    </Button>
                </Card>
            ) : (
                <>
                    <Card className="p-6 bg-green-50 dark:bg-green-950 border-green-200 dark:border-green-800">
                        <div className="flex items-center justify-between mb-4">
                            <div className="flex items-center gap-3">
                                <div className="w-10 h-10 rounded-full bg-green-600 dark:bg-green-500 flex items-center justify-center">
                                    <CheckCircle className="text-white" size={24} />
                                </div>
                                <div>
                                    <h3 className="text-lg font-semibold text-green-900 dark:text-green-100">
                                        Kiosk Mode Active
                                    </h3>
                                    <p className="text-sm text-green-700 dark:text-green-300">
                                        Expires: {new Date(token.expiresAt).toLocaleString()}
                                    </p>
                                </div>
                            </div>
                            <Button
                                variant="destructive"
                                onClick={handleRevokeToken}
                                disabled={revoking}
                            >
                                {revoking ? (
                                    <>
                                        <Loader2 className="animate-spin mr-2" size={18} />
                                        Disabling...
                                    </>
                                ) : (
                                    <>
                                        <Lock className="mr-2" size={18} />
                                        Disable Kiosk
                                    </>
                                )}
                            </Button>
                        </div>

                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-sm">
                            <div>
                                <span className="font-semibold text-green-900 dark:text-green-100">Permissions:</span>
                                <div className="mt-1 flex flex-wrap gap-2">
                                    <Badge variant="secondary">Scan Tickets</Badge>
                                    <Badge variant="secondary">Manual Check-in</Badge>
                                    {token.paymentEnabled && <Badge variant="secondary">Door Payments</Badge>}
                                </div>
                            </div>
                            <div>
                                <span className="font-semibold text-green-900 dark:text-green-100">Security:</span>
                                <div className="mt-1">
                                    {token.pinCode ? (
                                        <Badge variant="outline">PIN Protected</Badge>
                                    ) : (
                                        <Badge variant="outline">No PIN</Badge>
                                    )}
                                </div>
                            </div>
                        </div>
                    </Card>

                    <Card className="p-6">
                        <h3 className="text-lg font-semibold mb-4">Kiosk Access</h3>
                        
                        {qrDataUrl && (
                            <div className="mb-6 text-center">
                                <p className="text-sm text-zinc-600 dark:text-zinc-400 mb-3">
                                    Scan this QR code on your kiosk device:
                                </p>
                                <div className="inline-block p-4 bg-white rounded-lg">
                                    <img src={qrDataUrl} alt="Kiosk QR Code" className="w-64 h-64" />
                                </div>
                                <div className="mt-3">
                                    <Button
                                        variant="outline"
                                        onClick={handleDownloadQR}
                                        size="sm"
                                    >
                                        <Download className="mr-2" size={16} />
                                        Download QR Code
                                    </Button>
                                </div>
                            </div>
                        )}

                        <div>
                            <label className="text-sm font-medium mb-2 block">
                                Or copy the kiosk URL:
                            </label>
                            <div className="flex gap-2">
                                <Input
                                    value={kioskUrl}
                                    readOnly
                                    className="flex-1 font-mono text-sm"
                                />
                                <Button
                                    variant="outline"
                                    onClick={handleCopyUrl}
                                >
                                    <Copy size={18} />
                                </Button>
                            </div>
                            <p className="text-xs text-zinc-500 mt-2">
                                Open this URL on any tablet or device to access the kiosk interface
                            </p>
                        </div>
                    </Card>

                    <Card className="p-6 bg-yellow-50 dark:bg-yellow-950 border-yellow-200 dark:border-yellow-800">
                        <div className="flex items-start gap-3">
                            <AlertTriangle className="text-yellow-600 dark:text-yellow-400 flex-shrink-0 mt-1" size={20} />
                            <div className="text-sm text-yellow-800 dark:text-yellow-200">
                                <p className="font-semibold mb-1">Important Security Notes:</p>
                                <ul className="list-disc list-inside space-y-1 ml-2">
                                    <li>Keep the kiosk URL and QR code secure - anyone with access can use the kiosk</li>
                                    <li>The kiosk token will automatically expire 8 hours after your event ends</li>
                                    <li>You can revoke access immediately by clicking "Disable Kiosk" above</li>
                                    <li>Consider enabling fullscreen/kiosk mode on the tablet device for best security</li>
                                </ul>
                            </div>
                        </div>
                    </Card>
                </>
            )}
        </div>
    );
};
