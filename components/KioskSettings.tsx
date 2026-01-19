import React, { useState, useEffect } from 'react';
import { Button, Card, Badge, Input, Switch } from './UI';
import { Lock, Key, QrCode, Copy, CheckCircle2, XCircle, Loader2, ExternalLink, Clock, Shield } from 'lucide-react';
import { QRCodeSVG } from 'qrcode.react';

const API_URL = process.env.REACT_APP_BACKEND_URL || 'http://localhost:8001';

interface KioskSettingsProps {
    eventId: string;
}

export const KioskSettings: React.FC<KioskSettingsProps> = ({ eventId }) => {
    const [isLoading, setIsLoading] = useState(true);
    const [currentToken, setCurrentToken] = useState<any>(null);
    const [kioskUrl, setKioskUrl] = useState('');
    const [paymentEnabled, setPaymentEnabled] = useState(true);
    const [pinCode, setPinCode] = useState('');
    const [showQR, setShowQR] = useState(false);
    const [isGenerating, setIsGenerating] = useState(false);
    const [isRevoking, setIsRevoking] = useState(false);

    useEffect(() => {
        loadCurrentToken();
    }, [eventId]);

    const loadCurrentToken = async () => {
        setIsLoading(true);
        try {
            const token = localStorage.getItem('firebase_token');
            const response = await fetch(`${API_URL}/api/kiosk/token/${eventId}`, {
                headers: {
                    'Authorization': `Bearer ${token}`
                }
            });

            if (response.ok) {
                const data = await response.json();
                if (data.token) {
                    setCurrentToken(data.token);
                    const frontendUrl = window.location.origin;
                    setKioskUrl(`${frontendUrl}/#/kiosk/${eventId}?token=${data.token.tokenId}`);
                }
            }
        } catch (error) {
            console.error('[KioskSettings] Load error:', error);
        } finally {
            setIsLoading(false);
        }
    };

    const handleGenerate = async () => {
        setIsGenerating(true);
        try {
            const token = localStorage.getItem('firebase_token');
            const response = await fetch(`${API_URL}/api/kiosk/generate`, {
                method: 'POST',
                headers: {
                    'Authorization': `Bearer ${token}`,
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({
                    eventId,
                    paymentEnabled,
                    pinCode: pinCode || null
                })
            });

            if (!response.ok) {
                throw new Error('Failed to generate token');
            }

            const data = await response.json();
            setKioskUrl(data.kioskUrl);
            await loadCurrentToken();
            setShowQR(true);
        } catch (error: any) {
            alert(error.message || 'Failed to generate kiosk token');
        } finally {
            setIsGenerating(false);
        }
    };

    const handleRevoke = async () => {
        if (!window.confirm('Are you sure you want to revoke the kiosk token? This will immediately lock all kiosk devices.')) {
            return;
        }

        setIsRevoking(true);
        try {
            const token = localStorage.getItem('firebase_token');
            const response = await fetch(`${API_URL}/api/kiosk/revoke`, {
                method: 'POST',
                headers: {
                    'Authorization': `Bearer ${token}`,
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({
                    eventId,
                    tokenId: currentToken?.tokenId
                })
            });

            if (!response.ok) {
                throw new Error('Failed to revoke token');
            }

            setCurrentToken(null);
            setKioskUrl('');
            setShowQR(false);
        } catch (error: any) {
            alert(error.message || 'Failed to revoke token');
        } finally {
            setIsRevoking(false);
        }
    };

    const copyToClipboard = (text: string) => {
        navigator.clipboard.writeText(text);
        alert('Copied to clipboard!');
    };

    if (isLoading) {
        return (
            <div className="text-center py-12">
                <Loader2 className="animate-spin mx-auto text-primary" size={48} />
                <p className="text-zinc-500 mt-4">Loading kiosk settings...</p>
            </div>
        );
    }

    return (
        <div className="space-y-6">
            <div>
                <h2 className="text-2xl font-bold mb-2 flex items-center gap-2">
                    <Lock className="text-primary" />
                    Kiosk Mode
                </h2>
                <p className="text-zinc-500">
                    Enable secure, event-scoped kiosk mode for iPad/tablet check-in at the door.
                </p>
            </div>

            {currentToken && !currentToken.isExpired ? (
                <Card className="p-6">
                    <div className="flex items-center justify-between mb-4">
                        <div className="flex items-center gap-3">
                            <CheckCircle2 className="text-green-500" size={24} />
                            <div>
                                <h3 className="font-bold text-lg">Kiosk Active</h3>
                                <p className="text-sm text-zinc-500">
                                    Expires: {new Date(currentToken.expiresAt).toLocaleString()}
                                </p>
                            </div>
                        </div>
                        <Badge variant="success">Active</Badge>
                    </div>

                    <div className="space-y-4">
                        <div>
                            <label className="block text-sm font-bold mb-2">Kiosk URL</label>
                            <div className="flex gap-2">
                                <Input
                                    value={kioskUrl}
                                    readOnly
                                    className="flex-1 font-mono text-sm"
                                />
                                <Button
                                    onClick={() => copyToClipboard(kioskUrl)}
                                    variant="secondary"
                                    size="sm"
                                >
                                    <Copy size={16} />
                                </Button>
                                <Button
                                    onClick={() => setShowQR(!showQR)}
                                    variant="secondary"
                                    size="sm"
                                >
                                    <QrCode size={16} />
                                </Button>
                            </div>
                        </div>

                        {showQR && (
                            <div className="text-center p-6 bg-white dark:bg-zinc-800 rounded-lg">
                                <QRCodeSVG value={kioskUrl} size={256} />
                                <p className="text-sm text-zinc-600 dark:text-zinc-400 mt-4">Scan with iPad/tablet</p>
                            </div>
                        )}

                        <div className="flex gap-4 pt-4 border-t border-zinc-200 dark:border-zinc-700">
                            <Button
                                onClick={() => window.open(kioskUrl, '_blank')}
                                variant="secondary"
                                className="flex-1"
                            >
                                <ExternalLink size={16} className="mr-2" />
                                Test Kiosk
                            </Button>
                            <Button
                                onClick={handleRevoke}
                                disabled={isRevoking}
                                variant="destructive"
                                className="flex-1"
                            >
                                {isRevoking ? (
                                    <Loader2 className="animate-spin mr-2" size={16} />
                                ) : (
                                    <XCircle size={16} className="mr-2" />
                                )}
                                Revoke Token
                            </Button>
                        </div>
                    </div>
                </Card>
            ) : (
                <Card className="p-6">
                    <div className="text-center py-6">
                        <Shield className="mx-auto mb-4 text-zinc-500" size={48} />
                        <h3 className="text-lg font-bold mb-2">Kiosk Mode Not Active</h3>
                        <p className="text-zinc-500 mb-6">
                            Generate a secure kiosk token to enable door check-in.
                        </p>

                        <div className="max-w-md mx-auto space-y-4 mb-6">
                            <div className="flex items-center justify-between p-4 bg-zinc-100 dark:bg-zinc-800 rounded-lg">
                                <div className="text-left">
                                    <p className="font-bold text-sm">Enable Door Payments</p>
                                    <p className="text-xs text-zinc-500">Allow cash/card payments</p>
                                </div>
                                <Switch
                                    checked={paymentEnabled}
                                    onChange={setPaymentEnabled}
                                />
                            </div>

                            <div>
                                <label className="block text-sm font-bold mb-2 text-left">Exit PIN (Optional)</label>
                                <Input
                                    type="text"
                                    value={pinCode}
                                    onChange={(e) => setPinCode(e.target.value)}
                                    placeholder="Leave empty for no PIN"
                                    maxLength={6}
                                />
                            </div>
                        </div>

                        <Button
                            onClick={handleGenerate}
                            disabled={isGenerating}
                            size="lg"
                        >
                            {isGenerating ? (
                                <Loader2 className="animate-spin mr-2" size={20} />
                            ) : (
                                <Key size={20} className="mr-2" />
                            )}
                            Generate Kiosk Token
                        </Button>
                    </div>
                </Card>
            )}
        </div>
    );
};
