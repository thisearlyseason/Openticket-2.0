import React, { useEffect, useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { CheckCircle, Loader2, XCircle } from 'lucide-react';
import { Button } from './UI';
import { StorageService } from '../services/storageService';

export const SubscriptionSuccess = () => {
    const [searchParams] = useSearchParams();
    const navigate = useNavigate();
    const [status, setStatus] = useState<'loading' | 'success' | 'error'>('loading');
    const [plan, setPlan] = useState('');
    const [error, setError] = useState('');

    useEffect(() => {
        const verifySubscription = async () => {
            const sessionId = searchParams.get('session_id');
            
            if (!sessionId) {
                setStatus('error');
                setError('No session ID found');
                return;
            }

            try {
                const result = await StorageService.Stripe.verifySubscription(sessionId);
                
                if (result.success) {
                    setPlan(result.plan);
                    setStatus('success');
                    
                    // Refresh user data
                    const user = StorageService.getCurrentUser();
                    if (user) {
                        const updatedUser = await StorageService.getUserById(user.id);
                        if (updatedUser) {
                            localStorage.setItem('openticket_current_user', JSON.stringify(updatedUser));
                        }
                    }
                } else {
                    setStatus('error');
                    setError(result.error || 'Verification failed');
                }
            } catch (e: any) {
                setStatus('error');
                setError(e.message || 'Failed to verify subscription');
            }
        };

        verifySubscription();
    }, [searchParams]);

    if (status === 'loading') {
        return (
            <div className="min-h-screen flex items-center justify-center bg-zinc-50 dark:bg-black">
                <div className="text-center">
                    <Loader2 size={48} className="animate-spin text-primary mx-auto mb-4" />
                    <h2 className="text-xl font-bold text-zinc-900 dark:text-white">Verifying your subscription...</h2>
                    <p className="text-zinc-500 mt-2">Please wait while we confirm your payment.</p>
                </div>
            </div>
        );
    }

    if (status === 'error') {
        return (
            <div className="min-h-screen flex items-center justify-center bg-zinc-50 dark:bg-black p-4">
                <div className="max-w-md w-full text-center">
                    <div className="w-20 h-20 bg-red-500/20 rounded-full flex items-center justify-center mx-auto mb-6">
                        <XCircle size={40} className="text-red-500" />
                    </div>
                    <h2 className="text-2xl font-bold text-zinc-900 dark:text-white mb-2">Subscription Failed</h2>
                    <p className="text-zinc-500 mb-6">{error}</p>
                    <div className="flex gap-3 justify-center">
                        <Button variant="outline" onClick={() => navigate('/pricing')}>
                            Try Again
                        </Button>
                        <Button onClick={() => navigate('/dashboard')}>
                            Go to Dashboard
                        </Button>
                    </div>
                </div>
            </div>
        );
    }

    return (
        <div className="min-h-screen flex items-center justify-center bg-zinc-50 dark:bg-black p-4">
            <div className="max-w-md w-full text-center">
                <div className="w-20 h-20 bg-green-500/20 rounded-full flex items-center justify-center mx-auto mb-6">
                    <CheckCircle size={40} className="text-green-500" />
                </div>
                <h2 className="text-2xl font-bold text-zinc-900 dark:text-white mb-2">
                    Welcome to {plan.charAt(0).toUpperCase() + plan.slice(1)}!
                </h2>
                <p className="text-zinc-500 mb-6">
                    Your subscription has been activated. You now have access to all {plan} features.
                </p>
                <div className="bg-zinc-100 dark:bg-zinc-900 rounded-2xl p-6 mb-6 text-left">
                    <h3 className="font-bold text-zinc-900 dark:text-white mb-3">What's next?</h3>
                    <ul className="space-y-2 text-sm text-zinc-600 dark:text-zinc-400">
                        <li>• Create your first event</li>
                        <li>• Set up your organizer profile</li>
                        <li>• Connect your Stripe account for payouts</li>
                        <li>• Explore all your new features</li>
                    </ul>
                </div>
                <Button onClick={() => navigate('/dashboard')} className="w-full">
                    Go to Dashboard
                </Button>
            </div>
        </div>
    );
};
