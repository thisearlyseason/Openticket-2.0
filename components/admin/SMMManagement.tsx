import React, { useState, useEffect } from 'react';
import { Card, Button, Input, Badge } from '../UI';
import { Sparkles, Send, Loader2, CheckCircle, Clock, Mail, User, Calendar, Link as LinkIcon } from 'lucide-react';
import { StorageService } from '../../services/storageService';

interface SMMSignup {
    id: string;
    user_id: string;
    user_email: string;
    user_name: string;
    user_type: 'affiliate' | 'organizer';
    affiliate_code: string | null;
    signup_date: string;
    status: 'pending' | 'sent' | 'active';
    magic_link: string | null;
    magic_link_sent_date: string | null;
}

export const SMMManagement: React.FC = () => {
    const [signups, setSignups] = useState<SMMSignup[]>([]);
    const [loading, setLoading] = useState(true);
    const [magicLinks, setMagicLinks] = useState<{ [key: string]: string }>({});
    const [sending, setSending] = useState<{ [key: string]: boolean }>({});

    useEffect(() => {
        fetchSignups();
    }, []);

    const fetchSignups = async () => {
        try {
            const token = await StorageService.getAuthToken();
            const response = await fetch('/api/smm/admin/signups', {
                headers: {
                    'Authorization': `Bearer ${token}`
                }
            });
            const data = await response.json();
            console.log('[SMM Management] Fetched signups:', data);
            setSignups(data.signups || []);
        } catch (error) {
            console.error('Error fetching SMM signups:', error);
        } finally {
            setLoading(false);
        }
    };

    const handleSendMagicLink = async (signupId: string) => {
        const magicLink = magicLinks[signupId];
        if (!magicLink || !magicLink.trim()) {
            window.alert('Please enter a Magic Link URL');
            return;
        }

        // Validate URL
        try {
            new URL(magicLink);
        } catch (e) {
            window.alert('Please enter a valid URL');
            return;
        }

        setSending({ ...sending, [signupId]: true });
        try {
            const token = await StorageService.getAuthToken();
            const response = await fetch('/api/admin/smm/send-magic-link', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${token}`
                },
                body: JSON.stringify({ signupId, magicLink })
            });

            const data = await response.json();

            if (!response.ok) {
                throw new Error(data.error || 'Failed to send magic link');
            }

            window.alert(`✅ ${data.message}`);
            await fetchSignups();
            // Clear the input
            setMagicLinks({ ...magicLinks, [signupId]: '' });
        } catch (error: any) {
            console.error('Error sending magic link:', error);
            window.alert(`❌ Error: ${error.message}`);
        } finally {
            setSending({ ...sending, [signupId]: false });
        }
    };

    const affiliateSignups = signups.filter(s => s.user_type === 'affiliate');
    const organizerSignups = signups.filter(s => s.user_type === 'organizer');

    if (loading) {
        return (
            <div className="flex items-center justify-center p-12">
                <Loader2 className="animate-spin mr-2" size={24} />
                <span>Loading SMM signups...</span>
            </div>
        );
    }

    const renderSignupCard = (signup: SMMSignup) => (
        <Card key={signup.id} className="p-6 mb-4 bg-zinc-50 dark:bg-zinc-900">
            <div className="flex flex-col md:flex-row gap-4">
                {/* User Info */}
                <div className="flex-1">
                    <div className="flex items-center gap-3 mb-3">
                        <div className="p-2 bg-purple-100 dark:bg-purple-900 rounded-lg">
                            <User size={20} className="text-purple-600 dark:text-purple-400" />
                        </div>
                        <div>
                            <h4 className="font-bold text-zinc-900 dark:text-white">{signup.user_name || 'Unknown User'}</h4>
                            <p className="text-sm text-zinc-600 dark:text-zinc-400">{signup.user_email}</p>
                        </div>
                    </div>

                    <div className="grid grid-cols-2 gap-3 text-sm">
                        {signup.affiliate_code && (
                            <div>
                                <span className="text-zinc-500 dark:text-zinc-400">Affiliate Code:</span>
                                <p className="font-mono font-bold text-zinc-900 dark:text-white">{signup.affiliate_code}</p>
                            </div>
                        )}
                        <div>
                            <span className="text-zinc-500 dark:text-zinc-400">Signup Date:</span>
                            <p className="font-bold text-zinc-900 dark:text-white flex items-center gap-1">
                                <Calendar size={14} />
                                {new Date(signup.signup_date).toLocaleDateString()}
                            </p>
                        </div>
                        <div>
                            <span className="text-zinc-500 dark:text-zinc-400">Status:</span>
                            <p className="font-bold">
                                {signup.status === 'sent' ? (
                                    <Badge className="bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200">
                                        <CheckCircle size={12} className="mr-1" /> Sent
                                    </Badge>
                                ) : (
                                    <Badge className="bg-yellow-100 text-yellow-800 dark:bg-yellow-900 dark:text-yellow-200">
                                        <Clock size={12} className="mr-1" /> Pending
                                    </Badge>
                                )}
                            </p>
                        </div>
                        {signup.magic_link_sent_date && (
                            <div>
                                <span className="text-zinc-500 dark:text-zinc-400">Sent Date:</span>
                                <p className="font-bold text-zinc-900 dark:text-white flex items-center gap-1">
                                    <Mail size={14} />
                                    {new Date(signup.magic_link_sent_date).toLocaleDateString()}
                                </p>
                            </div>
                        )}
                    </div>
                </div>

                {/* Magic Link Section */}
                <div className="flex-1 border-l border-zinc-200 dark:border-zinc-700 pl-4">
                    <h5 className="font-bold text-zinc-900 dark:text-white mb-3 flex items-center gap-2">
                        <LinkIcon size={16} />
                        Magic Link
                    </h5>
                    
                    {signup.status === 'sent' && signup.magic_link ? (
                        <div className="p-3 bg-green-50 dark:bg-green-900/20 rounded-lg border border-green-200 dark:border-green-800">
                            <p className="text-xs text-green-700 dark:text-green-300 mb-2">✅ Link Sent</p>
                            <p className="text-xs font-mono text-green-900 dark:text-green-100 break-all">{signup.magic_link}</p>
                        </div>
                    ) : (
                        <>
                            <Input
                                value={magicLinks[signup.id] || ''}
                                onChange={(e) => setMagicLinks({ ...magicLinks, [signup.id]: e.target.value })}
                                placeholder="Enter Magic Link URL"
                                className="mb-3"
                            />
                            <Button
                                onClick={() => handleSendMagicLink(signup.id)}
                                disabled={sending[signup.id]}
                                className="bg-purple-600 hover:bg-purple-700 text-white border-none w-full"
                            >
                                {sending[signup.id] ? (
                                    <>
                                        <Loader2 className="animate-spin mr-2" size={16} />
                                        Sending...
                                    </>
                                ) : (
                                    <>
                                        <Send size={16} className="mr-2" />
                                        Send Magic Link
                                    </>
                                )}
                            </Button>
                        </>
                    )}
                </div>
            </div>
        </Card>
    );

    return (
        <div className="space-y-8">
            {/* Affiliates Section */}
            <div>
                <div className="flex items-center gap-3 mb-6">
                    <div className="p-3 bg-gradient-to-br from-blue-500 to-cyan-500 rounded-xl">
                        <Sparkles size={24} className="text-white" />
                    </div>
                    <div>
                        <h2 className="text-2xl font-bold text-zinc-900 dark:text-white">Affiliate SMM Signups</h2>
                        <p className="text-sm text-zinc-600 dark:text-zinc-400">Free access for affiliates</p>
                    </div>
                    <Badge className="ml-auto bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-200">
                        {affiliateSignups.length} Total
                    </Badge>
                </div>

                {affiliateSignups.length === 0 ? (
                    <Card className="p-8 text-center">
                        <p className="text-zinc-600 dark:text-zinc-400">No affiliate signups yet</p>
                    </Card>
                ) : (
                    affiliateSignups.map(renderSignupCard)
                )}
            </div>

            {/* Organizers Section */}
            <div>
                <div className="flex items-center gap-3 mb-6">
                    <div className="p-3 bg-gradient-to-br from-purple-500 to-pink-500 rounded-xl">
                        <Sparkles size={24} className="text-white" />
                    </div>
                    <div>
                        <h2 className="text-2xl font-bold text-zinc-900 dark:text-white">Organizer SMM Signups</h2>
                        <p className="text-sm text-zinc-600 dark:text-zinc-400">Paid add-on ($49/month)</p>
                    </div>
                    <Badge className="ml-auto bg-purple-100 text-purple-800 dark:bg-purple-900 dark:text-purple-200">
                        {organizerSignups.length} Total
                    </Badge>
                </div>

                {organizerSignups.length === 0 ? (
                    <Card className="p-8 text-center">
                        <p className="text-zinc-600 dark:text-zinc-400">No organizer signups yet</p>
                    </Card>
                ) : (
                    organizerSignups.map(renderSignupCard)
                )}
            </div>
        </div>
    );
};

export default SMMManagement;