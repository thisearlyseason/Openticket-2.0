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
            await loadCurrentToken(); // Reload to get full token details
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
    }\n\n    return (\n        <div className=\"space-y-6\">\n            {/* Header */}\n            <div>\n                <h2 className=\"text-2xl font-bold mb-2 flex items-center gap-2\">\n                    <Lock className=\"text-primary\" />\n                    Kiosk Mode\n                </h2>\n                <p className=\"text-zinc-500\">\n                    Enable secure, event-scoped kiosk mode for iPad/tablet check-in at the door.\n                </p>\n            </div>\n\n            {/* Current Status */}\n            {currentToken && !currentToken.isExpired ? (\n                <Card className=\"p-6 border-green-500/50 bg-green-500/5\">\n                    <div className=\"flex items-center justify-between mb-4\">\n                        <div className=\"flex items-center gap-3\">\n                            <CheckCircle2 className=\"text-green-500\" size={24} />\n                            <div>\n                                <h3 className=\"font-bold text-lg\">Kiosk Active</h3>\n                                <p className=\"text-sm text-zinc-500\">\n                                    Expires: {new Date(currentToken.expiresAt).toLocaleString()}\n                                </p>\n                            </div>\n                        </div>\n                        <Badge variant=\"success\">Active</Badge>\n                    </div>\n\n                    <div className=\"grid gap-4\">\n                        {/* Kiosk URL */}\n                        <div>\n                            <label className=\"block text-sm font-bold mb-2\">Kiosk URL</label>\n                            <div className=\"flex gap-2\">\n                                <Input\n                                    value={kioskUrl}\n                                    readOnly\n                                    className=\"flex-1 font-mono text-sm\"\n                                />\n                                <Button\n                                    onClick={() => copyToClipboard(kioskUrl)}\n                                    variant=\"secondary\"\n                                    size=\"sm\"\n                                >\n                                    <Copy size={16} />\n                                </Button>\n                                <Button\n                                    onClick={() => setShowQR(!showQR)}\n                                    variant=\"secondary\"\n                                    size=\"sm\"\n                                >\n                                    <QrCode size={16} />\n                                </Button>\n                            </div>\n                        </div>\n\n                        {/* QR Code */}\n                        {showQR && (\n                            <div className=\"text-center p-6 bg-white rounded-lg\">\n                                <QRCodeSVG value={kioskUrl} size={256} />\n                                <p className=\"text-sm text-zinc-600 mt-4\">Scan with iPad/tablet to open kiosk</p>\n                            </div>\n                        )}\n\n                        {/* Actions */}\n                        <div className=\"flex gap-4 pt-4 border-t border-zinc-700\">\n                            <Button\n                                onClick={() => window.open(kioskUrl, '_blank')}\n                                variant=\"secondary\"\n                                className=\"flex-1\"\n                            >\n                                <ExternalLink size={16} className=\"mr-2\" />\n                                Test Kiosk\n                            </Button>\n                            <Button\n                                onClick={handleRevoke}\n                                disabled={isRevoking}\n                                variant=\"destructive\"\n                                className=\"flex-1\"\n                            >\n                                {isRevoking ? (\n                                    <Loader2 className=\"animate-spin mr-2\" size={16} />\n                                ) : (\n                                    <XCircle size={16} className=\"mr-2\" />\n                                )}\n                                Revoke Token\n                            </Button>\n                        </div>\n                    </div>\n                </Card>\n            ) : (\n                <Card className=\"p-6\">\n                    <div className=\"text-center py-6\">\n                        <Shield className=\"mx-auto mb-4 text-zinc-500\" size={48} />\n                        <h3 className=\"text-lg font-bold mb-2\">Kiosk Mode Not Active</h3>\n                        <p className=\"text-zinc-500 mb-6\">\n                            Generate a secure kiosk token to enable door check-in.\n                        </p>\n\n                        {/* Configuration */}\n                        <div className=\"max-w-md mx-auto space-y-4 mb-6\">\n                            <div className=\"flex items-center justify-between p-4 bg-zinc-800 rounded-lg\">\n                                <div className=\"text-left\">\n                                    <p className=\"font-bold text-sm\">Enable Door Payments</p>\n                                    <p className=\"text-xs text-zinc-500\">Allow cash/card payments at kiosk</p>\n                                </div>\n                                <Switch\n                                    checked={paymentEnabled}\n                                    onChange={setPaymentEnabled}\n                                />\n                            </div>\n\n                            <div>\n                                <label className=\"block text-sm font-bold mb-2 text-left\">Exit PIN (Optional)</label>\n                                <Input\n                                    type=\"text\"\n                                    value={pinCode}\n                                    onChange={(e) => setPinCode(e.target.value)}\n                                    placeholder=\"Leave empty for no PIN\"\n                                    maxLength={6}\n                                />\n                                <p className=\"text-xs text-zinc-500 mt-1 text-left\">\n                                    Require PIN to exit kiosk mode\n                                </p>\n                            </div>\n                        </div>\n\n                        <Button\n                            onClick={handleGenerate}\n                            disabled={isGenerating}\n                            size=\"lg\"\n                            className=\"px-8\"\n                        >\n                            {isGenerating ? (\n                                <Loader2 className=\"animate-spin mr-2\" size={20} />\n                            ) : (\n                                <Key size={20} className=\"mr-2\" />\n                            )}\n                            Generate Kiosk Token\n                        </Button>\n                    </div>\n                </Card>\n            )}\n\n            {/* Setup Instructions */}\n            <Card className=\"p-6 bg-zinc-900\">\n                <h3 className=\"font-bold mb-4 flex items-center gap-2\">\n                    <Shield size={20} />\n                    Device Setup Instructions\n                </h3>\n                <div className=\"space-y-4 text-sm\">\n                    <div>\n                        <h4 className=\"font-bold mb-2\">📱 iPad Setup (Guided Access)</h4>\n                        <ol className=\"list-decimal list-inside space-y-1 text-zinc-400\">\n                            <li>Go to Settings → Accessibility → Guided Access</li>\n                            <li>Enable Guided Access and set a passcode</li>\n                            <li>Open the kiosk URL in Safari</li>\n                            <li>Triple-click the side button to start Guided Access</li>\n                            <li>Kiosk is now locked to this app</li>\n                        </ol>\n                    </div>\n\n                    <div>\n                        <h4 className=\"font-bold mb-2\">🤖 Android Setup (Screen Pinning)</h4>\n                        <ol className=\"list-decimal list-inside space-y-1 text-zinc-400\">\n                            <li>Go to Settings → Security → Screen Pinning</li>\n                            <li>Enable Screen Pinning</li>\n                            <li>Open the kiosk URL in Chrome</li>\n                            <li>Open Recent Apps and tap the app icon</li>\n                            <li>Select \"Pin\" to lock the screen</li>\n                        </ol>\n                    </div>\n\n                    <div className=\"p-3 bg-blue-500/10 rounded-lg border border-blue-500/50\">\n                        <p className=\"text-blue-400 text-xs\">\n                            <strong>Tip:</strong> Install as PWA for fullscreen experience. Tap Share → Add to Home Screen.\n                        </p>\n                    </div>\n                </div>\n            </Card>\n\n            {/* Security Features */}\n            <Card className=\"p-6 bg-zinc-900\">\n                <h3 className=\"font-bold mb-4 flex items-center gap-2\">\n                    <Clock size={20} />\n                    Security Features\n                </h3>\n                <ul className=\"space-y-2 text-sm text-zinc-400\">\n                    <li className=\"flex items-start gap-2\">\n                        <CheckCircle2 size={16} className=\"text-green-500 mt-0.5\" />\n                        <span>Token auto-expires 8 hours after event end</span>\n                    </li>\n                    <li className=\"flex items-start gap-2\">\n                        <CheckCircle2 size={16} className=\"text-green-500 mt-0.5\" />\n                        <span>Event-scoped: Can only access this event</span>\n                    </li>\n                    <li className=\"flex items-start gap-2\">\n                        <CheckCircle2 size={16} className=\"text-green-500 mt-0.5\" />\n                        <span>No dashboard or admin access</span>\n                    </li>\n                    <li className=\"flex items-start gap-2\">\n                        <CheckCircle2 size={16} className=\"text-green-500 mt-0.5\" />\n                        <span>Instant revocation locks all devices</span>\n                    </li>\n                    <li className=\"flex items-start gap-2\">\n                        <CheckCircle2 size={16} className=\"text-green-500 mt-0.5\" />\n                        <span>All actions logged for audit trail</span>\n                    </li>\n                </ul>\n            </Card>\n        </div>\n    );\n};\n