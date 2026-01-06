import React, { useState, useEffect } from 'react';
import { X, Download, Smartphone, Share, Plus } from 'lucide-react';
import { Button } from './UI';

interface BeforeInstallPromptEvent extends Event {
    prompt: () => Promise<void>;
    userChoice: Promise<{ outcome: 'accepted' | 'dismissed' }>;
}

export const InstallPrompt: React.FC = () => {
    const [deferredPrompt, setDeferredPrompt] = useState<BeforeInstallPromptEvent | null>(null);
    const [showPrompt, setShowPrompt] = useState(false);
    const [isIOS, setIsIOS] = useState(false);
    const [isStandalone, setIsStandalone] = useState(false);
    const [dismissed, setDismissed] = useState(false);

    useEffect(() => {
        // Check if already installed
        const standalone = window.matchMedia('(display-mode: standalone)').matches ||
            // @ts-ignore
            window.navigator.standalone === true;
        setIsStandalone(standalone);

        // Check if iOS
        const iOS = /iPad|iPhone|iPod/.test(navigator.userAgent);
        setIsIOS(iOS);

        // Check if dismissed recently
        const dismissedTime = localStorage.getItem('pwa_install_dismissed');
        if (dismissedTime) {
            const hoursSinceDismissed = (Date.now() - parseInt(dismissedTime)) / (1000 * 60 * 60);
            if (hoursSinceDismissed < 24) {
                setDismissed(true);
            }
        }

        // Listen for beforeinstallprompt event
        const handleBeforeInstall = (e: Event) => {
            e.preventDefault();
            setDeferredPrompt(e as BeforeInstallPromptEvent);
            
            // Show prompt after a delay (not immediately on page load)
            setTimeout(() => {
                if (!dismissed && !standalone) {
                    setShowPrompt(true);
                }
            }, 3000);
        };

        window.addEventListener('beforeinstallprompt', handleBeforeInstall);

        // Show iOS instructions after delay
        if (iOS && !standalone && !dismissed) {
            setTimeout(() => {
                setShowPrompt(true);
            }, 5000);
        }

        return () => {
            window.removeEventListener('beforeinstallprompt', handleBeforeInstall);
        };
    }, [dismissed]);

    const handleInstall = async () => {
        if (!deferredPrompt) return;

        try {
            await deferredPrompt.prompt();
            const { outcome } = await deferredPrompt.userChoice;
            
            if (outcome === 'accepted') {
                console.log('[PWA] User accepted install');
            }
            
            setDeferredPrompt(null);
            setShowPrompt(false);
        } catch (error) {
            console.error('[PWA] Install error:', error);
        }
    };

    const handleDismiss = () => {
        setShowPrompt(false);
        setDismissed(true);
        localStorage.setItem('pwa_install_dismissed', Date.now().toString());
    };

    // Don't show if already installed or dismissed
    if (isStandalone || !showPrompt) {
        return null;
    }

    return (
        <div className="fixed bottom-20 left-4 right-4 z-50 animate-in slide-in-from-bottom fade-in duration-300 md:left-auto md:right-6 md:max-w-sm">
            <div className="bg-white dark:bg-zinc-900 rounded-2xl shadow-2xl border border-zinc-200 dark:border-zinc-800 overflow-hidden">
                {/* Header */}
                <div className="bg-gradient-to-r from-[#ec4899] to-[#f472b6] p-4 text-white">
                    <div className="flex items-center justify-between">
                        <div className="flex items-center gap-3">
                            <div className="w-10 h-10 bg-white/20 rounded-xl flex items-center justify-center">
                                <Smartphone size={20} />
                            </div>
                            <div>
                                <h3 className="font-bold">Install OpenTicket</h3>
                                <p className="text-white/80 text-xs">Add to home screen</p>
                            </div>
                        </div>
                        <button 
                            onClick={handleDismiss}
                            className="p-1 hover:bg-white/20 rounded-full transition-colors"
                        >
                            <X size={20} />
                        </button>
                    </div>
                </div>

                {/* Content */}
                <div className="p-4">
                    {isIOS ? (
                        // iOS-specific instructions
                        <div className="space-y-3">
                            <p className="text-sm text-zinc-600 dark:text-zinc-400">
                                Install this app on your iPhone:
                            </p>
                            <div className="flex items-center gap-3 text-sm">
                                <div className="w-8 h-8 bg-zinc-100 dark:bg-zinc-800 rounded-full flex items-center justify-center text-zinc-600 dark:text-zinc-400">
                                    1
                                </div>
                                <div className="flex items-center gap-2">
                                    <span>Tap</span>
                                    <Share size={18} className="text-blue-500" />
                                    <span>Share</span>
                                </div>
                            </div>
                            <div className="flex items-center gap-3 text-sm">
                                <div className="w-8 h-8 bg-zinc-100 dark:bg-zinc-800 rounded-full flex items-center justify-center text-zinc-600 dark:text-zinc-400">
                                    2
                                </div>
                                <div className="flex items-center gap-2">
                                    <span>Tap</span>
                                    <Plus size={18} className="text-zinc-600 dark:text-zinc-400" />
                                    <span>"Add to Home Screen"</span>
                                </div>
                            </div>
                        </div>
                    ) : (
                        // Android/Desktop install button
                        <div className="space-y-3">
                            <p className="text-sm text-zinc-600 dark:text-zinc-400">
                                Get the full experience with offline support, push notifications, and quick access.
                            </p>
                            <div className="flex gap-2">
                                <Button 
                                    onClick={handleInstall}
                                    className="flex-1 bg-[#ec4899] hover:bg-[#db2777] text-white border-none flex items-center justify-center gap-2"
                                >
                                    <Download size={18} />
                                    Install App
                                </Button>
                                <Button 
                                    variant="ghost" 
                                    onClick={handleDismiss}
                                    className="px-4"
                                >
                                    Not now
                                </Button>
                            </div>
                        </div>
                    )}
                </div>

                {/* Features */}
                <div className="px-4 pb-4">
                    <div className="flex gap-4 text-xs text-zinc-500">
                        <span className="flex items-center gap-1">✓ Works offline</span>
                        <span className="flex items-center gap-1">✓ Push alerts</span>
                        <span className="flex items-center gap-1">✓ Fast access</span>
                    </div>
                </div>
            </div>
        </div>
    );
};

export default InstallPrompt;
