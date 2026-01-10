
import React, { useState, useEffect } from 'react';
import { useNavigate, useSearchParams, useLocation } from 'react-router-dom';
import { CheckCircle, XCircle, Loader2, Gift, ArrowRight, Shield } from 'lucide-react';
import { Button, Card } from './UI';
import { StorageService } from '../services/storageService';

export const NonprofitUpgrade = () => {
    const navigate = useNavigate();
    const location = useLocation();
    const [searchParams] = useSearchParams();
    const [status, setStatus] = useState<'loading' | 'valid' | 'invalid' | 'error' | 'needs-auth'>('loading');
    const [discountCode, setDiscountCode] = useState<string>('');
    const [organizationName, setOrganizationName] = useState<string>('');
    const [userEmail, setUserEmail] = useState<string>('');
    const [error, setError] = useState<string>('');
    const currentUser = StorageService.getCurrentUser();

    // Try to get params from both searchParams and hash
    const getParams = () => {
        let token = searchParams.get('token');
        let code = searchParams.get('code');
        
        // If not found in search params, try to parse from the full URL
        if (!token || !code) {
            const fullUrl = window.location.href;
            const tokenMatch = fullUrl.match(/token=([^&]+)/);
            const codeMatch = fullUrl.match(/code=([^&]+)/);
            if (tokenMatch) token = tokenMatch[1];
            if (codeMatch) code = codeMatch[1];
        }
        
        return { token, code };
    };

    useEffect(() => {
        const verifyMagicLink = async () => {
            const { token, code } = getParams();
            
            if (!token || !code) {
                setStatus('invalid');
                setError('Invalid or missing link parameters');
                return;
            }

            try {
                const response = await fetch(`/api/onboarding/nonprofit/verify-magic-link?token=${token}&code=${code}`);
                const data = await response.json();

                if (response.ok && data.valid) {
                    setDiscountCode(data.discountCode);
                    setOrganizationName(data.organizationName || 'Your Organization');
                    setUserEmail(data.user?.email || '');
                    
                    // Check if user is authenticated
                    if (!currentUser) {
                        setStatus('needs-auth');
                    } else if (data.user && currentUser.email !== data.user.email) {
                        // Logged in as different user
                        setStatus('needs-auth');
                    } else {
                        // User is authenticated and email matches
                        setStatus('valid');
                    }
                } else {
                    setStatus('invalid');
                    setError(data.error || 'Invalid or expired magic link');
                }
            } catch (err) {
                setStatus('error');
                setError('Failed to verify link. Please try again.');
            }
        };

        verifyMagicLink();
    }, [location, currentUser]);

    const handleSignIn = () => {
        // Store the magic link params and discount code
        const { token, code } = getParams();
        localStorage.setItem('nonprofitDiscountCode', discountCode);
        localStorage.setItem('nonprofitMagicLink', JSON.stringify({ token, code }));
        
        // Redirect to auth page with return URL
        navigate(`/auth?email=${encodeURIComponent(userEmail)}&redirect=/nonprofit-upgrade?token=${token}&code=${code}`);
    };

    const handleGoToPricing = () => {
        // Store the discount code in localStorage for use during checkout
        if (discountCode) {
            localStorage.setItem('nonprofitDiscountCode', discountCode);
        }
        navigate('/pricing');
    };

    return (
        <div className="min-h-screen bg-zinc-50 dark:bg-zinc-950 flex items-center justify-center p-4">
            <Card className="max-w-lg w-full p-8">
                {status === 'loading' && (
                    <div className="text-center">
                        <Loader2 size={48} className="animate-spin text-[#E0FF20] mx-auto mb-4" />
                        <h2 className="text-xl font-bold text-zinc-900 dark:text-white mb-2">
                            Verifying Your Link
                        </h2>
                        <p className="text-zinc-500">Please wait...</p>
                    </div>
                )}

                {status === 'valid' && (
                    <div className="text-center">
                        <div className="w-20 h-20 bg-green-100 dark:bg-green-900/30 rounded-full flex items-center justify-center mx-auto mb-6">
                            <CheckCircle size={48} className="text-green-500" />
                        </div>
                        <h2 className="text-2xl font-bold text-zinc-900 dark:text-white mb-2">
                            Congratulations!
                        </h2>
                        <p className="text-zinc-600 dark:text-zinc-400 mb-6">
                            Your non-profit status for <strong>{organizationName}</strong> has been approved!
                        </p>
                        
                        <div className="bg-gradient-to-r from-emerald-900/20 to-teal-900/20 border border-emerald-500/30 rounded-xl p-6 mb-6">
                            <Gift size={32} className="text-emerald-400 mx-auto mb-3" />
                            <p className="text-lg text-emerald-400 font-bold mb-2">
                                Your 20% Discount Code
                            </p>
                            <div className="bg-black/30 rounded-lg px-6 py-4 inline-block">
                                <code className="text-2xl font-mono font-bold text-[#E0FF20]">
                                    {discountCode}
                                </code>
                            </div>
                            <p className="text-sm text-zinc-500 mt-3">
                                This code is valid for Pro and Premium subscriptions
                            </p>
                        </div>

                        <Button 
                            onClick={handleGoToPricing}
                            variant="secondary"
                            className="w-full"
                        >
                            <span>View Plans & Subscribe</span>
                            <ArrowRight size={18} className="ml-2" />
                        </Button>
                    </div>
                )}

                {status === 'needs-auth' && (
                    <div className="text-center">
                        <div className="w-20 h-20 bg-blue-100 dark:bg-blue-900/30 rounded-full flex items-center justify-center mx-auto mb-6">
                            <Shield size={48} className="text-blue-500" />
                        </div>
                        <h2 className="text-2xl font-bold text-zinc-900 dark:text-white mb-2">
                            Sign In Required
                        </h2>
                        <p className="text-zinc-600 dark:text-zinc-400 mb-4">
                            Your non-profit application for <strong>{organizationName}</strong> has been approved!
                        </p>
                        <p className="text-zinc-600 dark:text-zinc-400 mb-6">
                            Please sign in to {userEmail ? `your account (${userEmail})` : 'continue'} and claim your 20% discount.
                        </p>
                        
                        <div className="bg-gradient-to-r from-emerald-900/20 to-teal-900/20 border border-emerald-500/30 rounded-xl p-4 mb-6">
                            <p className="text-sm text-emerald-400 font-semibold">
                                Your 20% discount will be automatically applied after sign-in
                            </p>
                        </div>

                        <Button 
                            onClick={handleSignIn}
                            variant="secondary"
                            className="w-full"
                        >
                            <span>Sign In to Continue</span>
                            <ArrowRight size={18} className="ml-2" />
                        </Button>
                    </div>
                )}

                {(status === 'invalid' || status === 'error') && (
                    <div className="text-center">
                        <div className="w-20 h-20 bg-red-100 dark:bg-red-900/30 rounded-full flex items-center justify-center mx-auto mb-6">
                            <XCircle size={48} className="text-red-500" />
                        </div>
                        <h2 className="text-2xl font-bold text-zinc-900 dark:text-white mb-2">
                            Link Invalid
                        </h2>
                        <p className="text-zinc-600 dark:text-zinc-400 mb-6">
                            {error}
                        </p>
                        <p className="text-sm text-zinc-500 mb-6">
                            This link may have expired or already been used. Please contact support if you believe this is an error.
                        </p>
                        <div className="flex gap-3">
                            <Button 
                                onClick={() => navigate('/')}
                                variant="outline"
                                className="flex-1"
                            >
                                Go Home
                            </Button>
                            <Button 
                                onClick={() => navigate('/contact')}
                                variant="secondary"
                                className="flex-1"
                            >
                                Contact Support
                            </Button>
                        </div>
                    </div>
                )}
            </Card>
        </div>
    );
};
