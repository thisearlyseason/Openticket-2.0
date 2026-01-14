import React, { useState, useEffect } from 'react';
import { Card, Button } from './UI';
import { Sparkles, Loader2, CheckCircle, Clock, Mail } from 'lucide-react';
import { StorageService } from '../services/storageService';

interface SMMSignupCardProps {
    userType: 'affiliate' | 'organizer';
    affiliateCode?: string;
}

export const SMMSignupCard: React.FC<SMMSignupCardProps> = ({ userType, affiliateCode }) => {
    const [loading, setLoading] = useState(false);
    const [signupStatus, setSignupStatus] = useState<any>(null);
    const [checkingStatus, setCheckingStatus] = useState(true);

    const user = StorageService.getCurrentUser();

    useEffect(() => {
        checkSignupStatus();
    }, []);

    const checkSignupStatus = async () => {
        try {
            const token = await StorageService.getAuthToken();
            const response = await fetch('/api/smm/status', {
                headers: {
                    'Authorization': `Bearer ${token}`
                }
            });
            const data = await response.json();
            setSignupStatus(data.signup);
        } catch (error) {
            console.error('Error checking SMM status:', error);
        } finally {
            setCheckingStatus(false);
        }
    };

    const handleSignup = async () => {
        setLoading(true);
        try {
            // For organizer, check if they want to proceed with payment
            if (userType === 'organizer') {
                const confirmed = window.confirm(
                    'Social Media Management is $49/month. You\'ll be redirected to Stripe to set up your subscription. Continue?'
                );
                if (!confirmed) {
                    setLoading(false);
                    return;
                }

                // Create Stripe checkout for SMM subscription
                const amount = 49;
                const planName = 'Social Media Management';
                
                await StorageService.Stripe.processSubscriptionPayment(
                    amount,
                    user!.id,
                    planName,
                    'monthly'
                );
                
                // After payment, submit signup
                // This will be called again after successful payment via webhook
                return;
            }

            // For affiliate, directly submit signup
            const token = await StorageService.getAuthToken();
            const response = await fetch('/api/smm/signup', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${token}`
                },
                body: JSON.stringify({ userType })
            });

            const data = await response.json();

            if (!response.ok) {
                throw new Error(data.error || 'Failed to submit signup');
            }

            window.alert(`✅ ${data.message}\n\nYou'll receive your Magic Login link within ${userType === 'affiliate' ? '10 hours' : '6 hours'}.`);
            await checkSignupStatus();
        } catch (error: any) {
            console.error('SMM signup error:', error);
            window.alert(`❌ Error: ${error.message}`);
        } finally {
            setLoading(false);
        }
    };

    if (checkingStatus) {
        return (
            <Card className="p-6">
                <div className="flex items-center justify-center">
                    <Loader2 className="animate-spin mr-2" size={20} />
                    <span>Loading...</span>
                </div>
            </Card>
        );
    }

    // If already signed up, show status
    if (signupStatus) {
        return (
            <Card className="p-6 bg-gradient-to-br from-green-50 to-emerald-50 dark:from-green-900/20 dark:to-emerald-900/20 border-green-200 dark:border-green-800">
                <div className="flex items-start gap-4">
                    <div className="p-3 bg-green-100 dark:bg-green-900 rounded-xl">
                        {signupStatus.status === 'sent' ? (
                            <CheckCircle size={24} className="text-green-600 dark:text-green-400" />
                        ) : (
                            <Clock size={24} className="text-green-600 dark:text-green-400" />
                        )}
                    </div>
                    <div className="flex-1">
                        <h3 className="font-bold text-lg text-green-900 dark:text-green-100 mb-2">
                            {signupStatus.status === 'sent' ? '✅ Magic Link Sent!' : '⏳ Request Pending'}
                        </h3>
                        {signupStatus.status === 'sent' ? (
                            <p className="text-green-800 dark:text-green-200 text-sm">
                                Your Magic Login link was sent to <strong>{signupStatus.user_email}</strong> on{' '}
                                {new Date(signupStatus.magic_link_sent_date).toLocaleDateString()}.
                                <br />
                                <span className="flex items-center gap-1 mt-2">
                                    <Mail size={14} />
                                    Don't see it? Check your spam folder!
                                </span>
                            </p>
                        ) : (
                            <p className="text-green-800 dark:text-green-200 text-sm">
                                Your request was submitted on {new Date(signupStatus.signup_date).toLocaleDateString()}.
                                <br />
                                You'll receive your Magic Login link within {userType === 'affiliate' ? '10 hours' : '6 hours'}.
                            </p>
                        )}
                    </div>
                </div>
            </Card>
        );
    }

    // Show signup card
    return (
        <Card className="p-6 bg-gradient-to-br from-purple-50 to-pink-50 dark:from-purple-900/20 dark:to-pink-900/20 border-purple-200 dark:border-purple-800">
            <div className="flex items-start gap-4">
                <div className="p-3 bg-gradient-to-br from-purple-500 to-pink-500 rounded-xl">
                    <Sparkles size={24} className="text-white" />
                </div>
                <div className="flex-1">
                    <h3 className="font-bold text-lg text-purple-900 dark:text-purple-100 mb-2">
                        {userType === 'affiliate' 
                            ? 'Join the Social Media Management Program' 
                            : 'Add Social Media Management'}
                    </h3>
                    
                    {userType === 'affiliate' ? (
                        <>
                            <p className="text-purple-800 dark:text-purple-200 text-sm mb-4">
                                <strong>Grow your audience. Boost your earnings. We make it easy.</strong>
                                <br /><br />
                                As an affiliate, you get <strong>FREE access</strong> to our Social Media Management Program — designed to help you share events, promote your link, and make more money with less effort.
                                <br /><br />
                                Click below to join. Setup is quick, adding your affiliate code is simple, and we'll help you get rolling fast 🚀
                                <br /><br />
                                Once you join, you'll receive a Magic Login link from <strong>Viral Spark Media</strong> within up to <strong>10 hours</strong>.
                                <br />
                                📬 Don't see it? Be sure to check your spam folder!
                            </p>
                            {affiliateCode && (
                                <div className="mb-4 p-3 bg-purple-100 dark:bg-purple-900 rounded-lg">
                                    <p className="text-xs text-purple-700 dark:text-purple-300">
                                        Your Affiliate Code: <strong className="font-mono">{affiliateCode}</strong>
                                    </p>
                                </div>
                            )}
                        </>
                    ) : (
                        <>
                            <p className="text-purple-800 dark:text-purple-200 text-sm mb-4">
                                <strong>More visibility. More ticket sales. Less work.</strong>
                                <br /><br />
                                Our Social Media Management Program helps you promote your events, stay active on social, and grow your audience — without the stress.
                                <br /><br />
                                Join for <strong className="text-purple-900 dark:text-purple-100">$49/month</strong>, get set up fast, connect your socials, and start spreading the word like a pro 🚀
                                <br /><br />
                                After joining, you'll receive a Magic Login link from <strong>Viral Spark Media</strong> within up to <strong>6 hours</strong>.
                                <br />
                                📬 Don't forget to check your spam folder if it doesn't arrive!
                            </p>
                        </>
                    )}
                    
                    <Button
                        onClick={handleSignup}
                        disabled={loading}
                        className="bg-gradient-to-r from-purple-600 to-pink-600 hover:from-purple-700 hover:to-pink-700 text-white border-none"
                    >
                        {loading ? (
                            <>
                                <Loader2 className="animate-spin mr-2" size={16} />
                                Processing...
                            </>
                        ) : (
                            <>
                                <Sparkles size={16} className="mr-2" />
                                {userType === 'affiliate' ? 'Join Free Program' : 'Subscribe ($49/month)'}
                            </>
                        )}
                    </Button>
                </div>
            </div>
        </Card>
    );
};

export default SMMSignupCard;
