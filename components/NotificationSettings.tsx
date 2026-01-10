import React, { useState, useEffect } from 'react';
import { Bell, BellOff, BellRing, Loader2, CheckCircle2, AlertCircle, Smartphone } from 'lucide-react';
import { Button, Card } from './UI';
import PushNotificationService from '../services/pushNotificationService';
import { StorageService } from '../services/storageService';

interface NotificationSettingsProps {
    className?: string;
}

export const NotificationSettings: React.FC<NotificationSettingsProps> = ({ className = '' }) => {
    const [isSupported, setIsSupported] = useState(false);
    const [permission, setPermission] = useState<NotificationPermission>('default');
    const [isSubscribed, setIsSubscribed] = useState(false);
    const [isLoading, setIsLoading] = useState(true);
    const [testStatus, setTestStatus] = useState<'idle' | 'sending' | 'sent' | 'error'>('idle');

    useEffect(() => {
        const init = async () => {
            setIsSupported(PushNotificationService.isPushSupported());
            setPermission(PushNotificationService.getPermissionStatus());
            
            if (PushNotificationService.isPushSupported()) {
                const subscribed = await PushNotificationService.isSubscribed();
                setIsSubscribed(subscribed);
            }
            
            setIsLoading(false);
        };
        
        init();
    }, []);

    const handleSubscribe = async () => {
        setIsLoading(true);
        
        try {
            const user = StorageService.getCurrentUser();
            if (!user?.id) {
                console.warn('No user found for push subscription');
                return;
            }
            
            // Get token from Firebase or stored auth
            const token = user.token || localStorage.getItem('firebase_token') || user.id;
            
            const success = await PushNotificationService.subscribe(token);
            
            if (success) {
                setIsSubscribed(true);
                setPermission('granted');
            } else {
                window.alert('Failed to enable notifications. Please check your browser settings.');
            }
        } catch (error) {
            console.error('Subscribe error:', error);
            window.alert('Failed to enable notifications');
        } finally {
            setIsLoading(false);
        }
    };

    const handleUnsubscribe = async () => {
        setIsLoading(true);
        
        try {
            const user = StorageService.getCurrentUser();
            if (!user?.token) return;
            
            await PushNotificationService.unsubscribe(user.token);
            setIsSubscribed(false);
        } catch (error) {
            console.error('Unsubscribe error:', error);
        } finally {
            setIsLoading(false);
        }
    };

    const handleTestNotification = async () => {
        setTestStatus('sending');
        
        try {
            const user = StorageService.getCurrentUser();
            if (!user?.token) return;
            
            const success = await PushNotificationService.sendTestNotification(user.token);
            setTestStatus(success ? 'sent' : 'error');
            
            setTimeout(() => setTestStatus('idle'), 3000);
        } catch (error) {
            setTestStatus('error');
            setTimeout(() => setTestStatus('idle'), 3000);
        }
    };

    if (!isSupported) {
        return (
            <Card className={`p-6 ${className}`}>
                <div className="flex items-start gap-4">
                    <div className="w-12 h-12 bg-zinc-100 dark:bg-zinc-800 rounded-full flex items-center justify-center flex-shrink-0">
                        <BellOff size={24} className="text-zinc-400" />
                    </div>
                    <div>
                        <h3 className="font-bold text-lg text-zinc-900 dark:text-white mb-1">
                            Push Notifications
                        </h3>
                        <p className="text-zinc-500 text-sm">
                            Push notifications are not supported in this browser. 
                            Try using Chrome, Firefox, or Safari on a supported device.
                        </p>
                    </div>
                </div>
            </Card>
        );
    }

    return (
        <Card className={`p-6 ${className}`}>
            <div className="flex items-start gap-4">
                <div className={`w-12 h-12 rounded-full flex items-center justify-center flex-shrink-0 ${
                    isSubscribed 
                        ? 'bg-green-100 dark:bg-green-900/30' 
                        : 'bg-zinc-100 dark:bg-zinc-800'
                }`}>
                    {isSubscribed ? (
                        <BellRing size={24} className="text-green-600 dark:text-green-400" />
                    ) : (
                        <Bell size={24} className="text-zinc-400" />
                    )}
                </div>
                
                <div className="flex-1">
                    <div className="flex items-center justify-between mb-1">
                        <h3 className="font-bold text-lg text-zinc-900 dark:text-white">
                            Push Notifications
                        </h3>
                        {isSubscribed && (
                            <span className="text-xs font-bold text-green-600 dark:text-green-400 bg-green-100 dark:bg-green-900/30 px-2 py-1 rounded-full">
                                Enabled
                            </span>
                        )}
                    </div>
                    
                    <p className="text-zinc-500 text-sm mb-4">
                        {isSubscribed 
                            ? 'You\'ll receive notifications for event reminders, ticket confirmations, and updates.'
                            : 'Get notified about event reminders, ticket purchases, check-ins, and important updates.'}
                    </p>
                    
                    {permission === 'denied' && (
                        <div className="bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg p-3 mb-4">
                            <div className="flex items-center gap-2 text-red-600 dark:text-red-400 text-sm">
                                <AlertCircle size={16} />
                                <span className="font-medium">Notifications blocked</span>
                            </div>
                            <p className="text-red-600/80 dark:text-red-400/80 text-xs mt-1">
                                You've blocked notifications. To enable them, update your browser settings for this site.
                            </p>
                        </div>
                    )}
                    
                    <div className="flex flex-wrap gap-2">
                        {isLoading ? (
                            <Button disabled className="flex items-center gap-2">
                                <Loader2 size={16} className="animate-spin" />
                                Loading...
                            </Button>
                        ) : isSubscribed ? (
                            <>
                                <Button 
                                    variant="ghost" 
                                    onClick={handleUnsubscribe}
                                    className="flex items-center gap-2"
                                >
                                    <BellOff size={16} />
                                    Disable
                                </Button>
                                <Button 
                                    onClick={handleTestNotification}
                                    disabled={testStatus === 'sending'}
                                    className="flex items-center gap-2"
                                >
                                    {testStatus === 'sending' ? (
                                        <Loader2 size={16} className="animate-spin" />
                                    ) : testStatus === 'sent' ? (
                                        <CheckCircle2 size={16} className="text-green-500" />
                                    ) : testStatus === 'error' ? (
                                        <AlertCircle size={16} className="text-red-500" />
                                    ) : (
                                        <Bell size={16} />
                                    )}
                                    {testStatus === 'sending' ? 'Sending...' : 
                                     testStatus === 'sent' ? 'Sent!' : 
                                     testStatus === 'error' ? 'Failed' : 
                                     'Test Notification'}
                                </Button>
                            </>
                        ) : (
                            <Button 
                                onClick={handleSubscribe}
                                disabled={permission === 'denied'}
                                className="flex items-center gap-2 bg-[#ec4899] hover:bg-[#db2777] text-white border-none"
                            >
                                <Bell size={16} />
                                Enable Notifications
                            </Button>
                        )}
                    </div>
                </div>
            </div>
            
            {/* Notification Types Info */}
            {isSubscribed && (
                <div className="mt-6 pt-6 border-t border-zinc-200 dark:border-zinc-800">
                    <h4 className="font-bold text-sm text-zinc-900 dark:text-white mb-3">
                        You'll be notified about:
                    </h4>
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 text-sm">
                        {[
                            { icon: '🎟️', label: 'Ticket purchases' },
                            { icon: '⏰', label: 'Event reminders' },
                            { icon: '✅', label: 'Check-in confirmations' },
                            { icon: '📢', label: 'Event updates' },
                            { icon: '💰', label: 'Payment notifications' },
                            { icon: '👥', label: 'New registrations (organizers)' }
                        ].map((item, i) => (
                            <div key={i} className="flex items-center gap-2 text-zinc-600 dark:text-zinc-400">
                                <span>{item.icon}</span>
                                <span>{item.label}</span>
                            </div>
                        ))}
                    </div>
                </div>
            )}
            
            {/* Install App Prompt */}
            {!isSubscribed && (
                <div className="mt-6 pt-6 border-t border-zinc-200 dark:border-zinc-800">
                    <div className="flex items-center gap-3 text-sm text-zinc-500">
                        <Smartphone size={20} />
                        <span>
                            For the best experience, add OpenTicket to your home screen
                        </span>
                    </div>
                </div>
            )}
        </Card>
    );
};

export default NotificationSettings;
