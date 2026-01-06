import React, { useState, useEffect, useRef, useCallback } from 'react';
import { Html5Qrcode, Html5QrcodeScanner } from 'html5-qrcode';
import { Camera, Upload, X, CheckCircle2, AlertCircle, Loader2, RotateCcw, Flashlight, SwitchCamera } from 'lucide-react';
import { Button } from './UI';

interface QRScannerProps {
    onScan: (result: string) => void;
    onClose: () => void;
    isOpen: boolean;
}

export const QRScanner: React.FC<QRScannerProps> = ({ onScan, onClose, isOpen }) => {
    const [mode, setMode] = useState<'camera' | 'upload'>('camera');
    const [error, setError] = useState<string>('');
    const [isScanning, setIsScanning] = useState(false);
    const [lastResult, setLastResult] = useState<string>('');
    const [facingMode, setFacingMode] = useState<'environment' | 'user'>('environment');
    const [hasFlash, setHasFlash] = useState(false);
    const [flashOn, setFlashOn] = useState(false);
    
    const scannerRef = useRef<Html5Qrcode | null>(null);
    const containerRef = useRef<HTMLDivElement>(null);
    const fileInputRef = useRef<HTMLInputElement>(null);

    // Initialize camera scanner
    const startCameraScanner = useCallback(async () => {
        if (!containerRef.current || scannerRef.current) return;
        
        setError('');
        setIsScanning(true);
        
        try {
            const html5QrCode = new Html5Qrcode('qr-reader');
            scannerRef.current = html5QrCode;
            
            const config = {
                fps: 10,
                qrbox: { width: 250, height: 250 },
                aspectRatio: 1,
                disableFlip: false,
            };
            
            await html5QrCode.start(
                { facingMode },
                config,
                (decodedText) => {
                    // Prevent duplicate scans
                    if (decodedText !== lastResult) {
                        setLastResult(decodedText);
                        // Vibrate on successful scan (mobile)
                        if (navigator.vibrate) {
                            navigator.vibrate(200);
                        }
                        onScan(decodedText);
                    }
                },
                () => {} // Ignore QR not found errors
            );
            
            // Check for flash support
            try {
                const track = html5QrCode.getRunningTrackSettings();
                // @ts-ignore
                setHasFlash(!!track?.torch);
            } catch {
                setHasFlash(false);
            }
            
        } catch (err: any) {
            console.error('[QRScanner] Camera error:', err);
            setError(err.message || 'Failed to access camera');
            setIsScanning(false);
        }
    }, [facingMode, lastResult, onScan]);

    // Stop camera scanner
    const stopCameraScanner = useCallback(async () => {
        if (scannerRef.current) {
            try {
                await scannerRef.current.stop();
                scannerRef.current.clear();
            } catch (err) {
                console.warn('[QRScanner] Error stopping scanner:', err);
            }
            scannerRef.current = null;
        }
        setIsScanning(false);
    }, []);

    // Toggle flash
    const toggleFlash = async () => {
        if (scannerRef.current && hasFlash) {
            try {
                // @ts-ignore
                await scannerRef.current.applyVideoConstraints({
                    advanced: [{ torch: !flashOn }]
                });
                setFlashOn(!flashOn);
            } catch (err) {
                console.warn('[QRScanner] Flash toggle failed:', err);
            }
        }
    };

    // Switch camera
    const switchCamera = async () => {
        await stopCameraScanner();
        setFacingMode(prev => prev === 'environment' ? 'user' : 'environment');
    };

    // Handle file upload
    const handleFileUpload = async (event: React.ChangeEvent<HTMLInputElement>) => {
        const file = event.target.files?.[0];
        if (!file) return;
        
        setError('');
        
        try {
            const html5QrCode = new Html5Qrcode('qr-reader-upload');
            const result = await html5QrCode.scanFile(file, true);
            
            if (navigator.vibrate) {
                navigator.vibrate(200);
            }
            onScan(result);
            
            html5QrCode.clear();
        } catch (err: any) {
            console.error('[QRScanner] File scan error:', err);
            setError('No QR code found in image. Please try another image.');
        }
        
        // Reset file input
        if (fileInputRef.current) {
            fileInputRef.current.value = '';
        }
    };

    // Effect to handle scanner lifecycle
    useEffect(() => {
        if (isOpen && mode === 'camera') {
            startCameraScanner();
        }
        
        return () => {
            stopCameraScanner();
        };
    }, [isOpen, mode, facingMode]);

    // Reset last result when closing
    useEffect(() => {
        if (!isOpen) {
            setLastResult('');
            setError('');
        }
    }, [isOpen]);

    if (!isOpen) return null;

    return (
        <div className="fixed inset-0 z-50 bg-black">
            {/* Header */}
            <div className="absolute top-0 left-0 right-0 z-10 p-4 flex items-center justify-between bg-gradient-to-b from-black/80 to-transparent">
                <button
                    onClick={() => { stopCameraScanner(); onClose(); }}
                    className="p-2 rounded-full bg-white/10 backdrop-blur-sm text-white hover:bg-white/20 transition-colors"
                >
                    <X size={24} />
                </button>
                
                <div className="flex gap-2">
                    {mode === 'camera' && (
                        <>
                            {hasFlash && (
                                <button
                                    onClick={toggleFlash}
                                    className={`p-2 rounded-full backdrop-blur-sm transition-colors ${
                                        flashOn ? 'bg-yellow-500 text-black' : 'bg-white/10 text-white hover:bg-white/20'
                                    }`}
                                >
                                    <Flashlight size={20} />
                                </button>
                            )}
                            <button
                                onClick={switchCamera}
                                className="p-2 rounded-full bg-white/10 backdrop-blur-sm text-white hover:bg-white/20 transition-colors"
                            >
                                <SwitchCamera size={20} />
                            </button>
                        </>
                    )}
                </div>
            </div>

            {/* Mode Toggle */}
            <div className="absolute top-20 left-1/2 -translate-x-1/2 z-10 flex gap-2 p-1 bg-white/10 backdrop-blur-sm rounded-full">
                <button
                    onClick={() => { stopCameraScanner(); setMode('camera'); }}
                    className={`px-4 py-2 rounded-full text-sm font-bold transition-all flex items-center gap-2 ${
                        mode === 'camera' 
                            ? 'bg-[#ec4899] text-white' 
                            : 'text-white/70 hover:text-white'
                    }`}
                >
                    <Camera size={16} /> Camera
                </button>
                <button
                    onClick={() => { stopCameraScanner(); setMode('upload'); }}
                    className={`px-4 py-2 rounded-full text-sm font-bold transition-all flex items-center gap-2 ${
                        mode === 'upload' 
                            ? 'bg-[#ec4899] text-white' 
                            : 'text-white/70 hover:text-white'
                    }`}
                >
                    <Upload size={16} /> Upload
                </button>
            </div>

            {/* Scanner Area */}
            <div className="absolute inset-0 flex items-center justify-center">
                {mode === 'camera' ? (
                    <div className="relative w-full h-full">
                        {/* Camera feed container */}
                        <div 
                            id="qr-reader" 
                            ref={containerRef}
                            className="w-full h-full"
                            style={{ 
                                position: 'absolute',
                                inset: 0
                            }}
                        />
                        
                        {/* Scan overlay */}
                        <div className="absolute inset-0 pointer-events-none">
                            <div className="absolute inset-0 flex items-center justify-center">
                                <div className="relative w-64 h-64">
                                    {/* Corner markers */}
                                    <div className="absolute top-0 left-0 w-8 h-8 border-t-4 border-l-4 border-[#ec4899] rounded-tl-lg" />
                                    <div className="absolute top-0 right-0 w-8 h-8 border-t-4 border-r-4 border-[#ec4899] rounded-tr-lg" />
                                    <div className="absolute bottom-0 left-0 w-8 h-8 border-b-4 border-l-4 border-[#ec4899] rounded-bl-lg" />
                                    <div className="absolute bottom-0 right-0 w-8 h-8 border-b-4 border-r-4 border-[#ec4899] rounded-br-lg" />
                                    
                                    {/* Scan line animation */}
                                    {isScanning && (
                                        <div className="absolute inset-x-2 h-0.5 bg-gradient-to-r from-transparent via-[#ec4899] to-transparent animate-scan" />
                                    )}
                                </div>
                            </div>
                            
                            {/* Dark overlay outside scan area */}
                            <div className="absolute inset-0 bg-black/50" style={{
                                clipPath: 'polygon(0 0, 100% 0, 100% 100%, 0 100%, 0 0, calc(50% - 128px) calc(50% - 128px), calc(50% - 128px) calc(50% + 128px), calc(50% + 128px) calc(50% + 128px), calc(50% + 128px) calc(50% - 128px), calc(50% - 128px) calc(50% - 128px))'
                            }} />
                        </div>
                        
                        {!isScanning && !error && (
                            <div className="absolute inset-0 flex items-center justify-center bg-black/80">
                                <Loader2 className="w-12 h-12 text-[#ec4899] animate-spin" />
                            </div>
                        )}
                    </div>
                ) : (
                    <div className="flex flex-col items-center justify-center p-8 text-center">
                        <div id="qr-reader-upload" className="hidden" />
                        
                        <div 
                            onClick={() => fileInputRef.current?.click()}
                            className="w-64 h-64 border-2 border-dashed border-white/30 rounded-2xl flex flex-col items-center justify-center cursor-pointer hover:border-[#ec4899] hover:bg-white/5 transition-all"
                        >
                            <Upload size={48} className="text-white/50 mb-4" />
                            <p className="text-white/70 font-medium">Tap to upload QR code</p>
                            <p className="text-white/40 text-sm mt-2">JPG, PNG, or HEIC</p>
                        </div>
                        
                        <input
                            ref={fileInputRef}
                            type="file"
                            accept="image/*"
                            onChange={handleFileUpload}
                            className="hidden"
                        />
                    </div>
                )}
            </div>

            {/* Error Display */}
            {error && (
                <div className="absolute bottom-32 left-4 right-4 p-4 bg-red-500/90 backdrop-blur-sm rounded-xl flex items-center gap-3">
                    <AlertCircle size={24} className="text-white flex-shrink-0" />
                    <p className="text-white text-sm font-medium">{error}</p>
                    <button
                        onClick={() => { setError(''); if (mode === 'camera') startCameraScanner(); }}
                        className="ml-auto p-2 bg-white/20 rounded-lg"
                    >
                        <RotateCcw size={16} className="text-white" />
                    </button>
                </div>
            )}

            {/* Instructions */}
            <div className="absolute bottom-8 left-4 right-4 text-center">
                <p className="text-white/60 text-sm">
                    {mode === 'camera' 
                        ? 'Point camera at QR code on ticket' 
                        : 'Upload a photo of the QR code'}
                </p>
            </div>

            {/* Scan line animation styles */}
            <style>{`
                @keyframes scan {
                    0%, 100% { top: 0.5rem; opacity: 0; }
                    50% { opacity: 1; }
                    100% { top: calc(100% - 0.5rem); opacity: 0; }
                }
                .animate-scan {
                    animation: scan 2s ease-in-out infinite;
                }
                #qr-reader video {
                    width: 100% !important;
                    height: 100% !important;
                    object-fit: cover !important;
                }
                #qr-reader {
                    border: none !important;
                }
                #qr-reader__scan_region {
                    display: none !important;
                }
                #qr-reader__dashboard {
                    display: none !important;
                }
            `}</style>
        </div>
    );
};

export default QRScanner;
