
import React, { useState, useEffect } from 'react';
import { StorageService } from '../services/storageService';
import { GeminiService } from '../services/geminiService';
import { User, Invoice } from '../types';
import { Card, Button, Input, CodeBlock, Badge } from './UI';
import { DollarSign, Users, Link2, Copy, Sparkles, Twitter, Linkedin, Instagram, ExternalLink, Download, Gift, Zap, ShieldCheck, ArrowLeft, Loader2, CheckCircle2, ChevronRight, Star, Crown, Facebook, MapPin, Music, CreditCard, Save, Edit2 } from 'lucide-react';
import { useNavigate } from 'react-router-dom';

export const AffiliateDashboard = () => {
    const navigate = useNavigate();
    const [user, setUser] = useState<User | null>(null);
    const [stats, setStats] = useState({
        referrals: 0,
        activeSubs: 0,
        totalEarnings: 0,
        pending: 0,
        proCount: 0,
        premiumCount: 0,
        recentCommissions: [] as Invoice[]
    });
    const [generatedContent, setGeneratedContent] = useState('');
    const [isGenerating, setIsGenerating] = useState(false);
    const [stripeId, setStripeId] = useState('');
    const [isEditingStripe, setIsEditingStripe] = useState(false);
    const [isLoading, setIsLoading] = useState(true);

    // Marketing Lab State
    const [selectedPlatform, setSelectedPlatform] = useState<'twitter' | 'linkedin' | 'instagram' | 'facebook' | 'tiktok'>('twitter');

    // Onboarding State
    const [view, setView] = useState<'loading' | 'onboarding' | 'dashboard'>('loading');
    const [customCode, setCustomCode] = useState('');
    const [isActivating, setIsActivating] = useState(false);
    const [codeError, setCodeError] = useState('');

    useEffect(() => {
        const init = async () => {
            const currentUser = StorageService.getCurrentUser();
            if (!currentUser) {
                navigate('/affiliate-login');
                return;
            }

            // SECURITY CHECK: Attendees shouldn't be here unless they are upgrading
            if (currentUser.role === 'attendee') {
                navigate('/browse', { replace: true });
                return;
            }

            await refreshData(currentUser.id);
        };
        init();
    }, [navigate]);

    const refreshData = async (userId: string) => {
        setIsLoading(true);
        try {
            const userData = await StorageService.getUserById(userId);
            if (userData) {
                setUser(userData);
                setStripeId(userData.stripeConnectId || '');

                if (userData.affiliateCode) {
                    setView('dashboard');
                    // Calculate Affiliate Stats
                    const commissions = userData.invoices?.filter(inv => inv.description && inv.description.includes('Affiliate Commission')) || [];
                    const total = commissions.reduce((sum, inv) => sum + (inv.amount || 0), 0);

                    // Parse Plan Types for confirmation
                    const proCount = commissions.filter(c => c.description.toLowerCase().includes('pro')).length;
                    const premiumCount = commissions.filter(c => c.description.toLowerCase().includes('premium')).length;

                    setStats({
                        referrals: Math.max(commissions.length, Math.floor(total / 5)),
                        activeSubs: commissions.length,
                        totalEarnings: total,
                        pending: 0,
                        proCount,
                        premiumCount,
                        recentCommissions: commissions.sort((a, b) => b.date - a.date).slice(0, 5)
                    });
                } else {
                    setView('onboarding');
                }
            }
        } catch (e) {
            console.error("Error loading affiliate data", e);
        } finally {
            setIsLoading(false);
        }
    };

    const handleJoinProgram = async () => {
        if (!user || !customCode) return;
        setIsActivating(true);
        setCodeError('');

        // Validate Code Format
        const formattedCode = customCode.trim().toUpperCase().replace(/[^A-Z0-9]/g, '');
        if (formattedCode.length < 3) {
            setCodeError("Code must be at least 3 characters.");
            setIsActivating(false);
            return;
        }

        // Validate Uniqueness
        const isUnique = await StorageService.checkAffiliateCodeUnique(formattedCode);
        if (!isUnique) {
            setCodeError("This code is already taken. Please try another.");
            setIsActivating(false);
            return;
        }

        // Activate
        await StorageService.updateUser(user.id, { affiliateCode: formattedCode });
        await refreshData(user.id);
        setIsActivating(false);
    };

    const handleSaveStripeId = async () => {
        if (!user || !stripeId) return;

        if (!stripeId.startsWith('acct_')) {
            alert("Invalid ID. Must start with 'acct_'.");
            return;
        }

        await StorageService.updateUser(user.id, { stripeConnectId: stripeId });
        setIsEditingStripe(false);
        alert("Payout details updated successfully!");
        await refreshData(user.id);
    };

    const generatePost = async () => {
        if (!user || !user.affiliateCode) return;
        setIsGenerating(true);
        const code = user.affiliateCode;
        const content = await GeminiService.generateAffiliateContent(code, selectedPlatform);
        setGeneratedContent(content);
        setIsGenerating(false);
    };

    if (isLoading) {
        return (
            <div className="min-h-screen flex items-center justify-center">
                <Loader2 className="animate-spin text-primary" size={48} />
            </div>
        );
    }

    if (view === 'onboarding') {
        return (
            <div className="min-h-screen flex flex-col items-center justify-center p-4 max-w-2xl mx-auto text-center">
                <div className="bg-gradient-to-r from-[#E0FF20] to-green-400 p-1 rounded-full mb-8 shadow-[0_0_50px_rgba(224,255,32,0.4)]">
                    <div className="bg-black p-6 rounded-full">
                        <Gift size={48} className="text-[#E0FF20]" />
                    </div>
                </div>

                <h1 className="text-4xl md:text-5xl font-black text-zinc-900 dark:text-white mb-6 uppercase font-display tracking-tight">
                    Partner with <span className="text-[#E0FF20]">OpenTicket</span>
                </h1>

                <p className="text-xl text-zinc-500 mb-10 max-w-lg mx-auto">
                    Help creators ditch ticket fees and get paid instantly. You earn <span className="text-white font-bold">15% recurring commission</span> on every Pro & Premium subscription you refer.
                </p>

                <Card className="w-full p-8 border-2 border-zinc-800 bg-zinc-900">
                    <h3 className="text-lg font-bold text-white mb-4">Choose your unique code</h3>
                    <div className="flex flex-col gap-4">
                        <div className="relative">
                            <Input
                                placeholder="e.g. MIKE2024"
                                value={customCode}
                                onChange={e => { setCustomCode(e.target.value.toUpperCase()); setCodeError(''); }}
                                className="text-center text-2xl font-black tracking-widest uppercase py-6"
                                maxLength={15}
                            />
                            {codeError && <div className="text-red-500 text-sm font-bold mt-2">{codeError}</div>}
                        </div>
                        <Button
                            onClick={handleJoinProgram}
                            isLoading={isActivating}
                            className="py-4 text-lg bg-[#E0FF20] text-black hover:bg-[#d4f542]"
                            disabled={!customCode}
                        >
                            Activate Affiliate Account <ChevronRight size={20} />
                        </Button>
                    </div>
                    <p className="text-xs text-zinc-500 mt-4">
                        By joining, you agree to our Affiliate Terms. Payouts are processed monthly via Stripe.
                    </p>
                </Card>
            </div>
        );
    }

    const referralLink = user && user.affiliateCode ? `${window.location.origin}/#/auth?ref=${user.affiliateCode}&plan=pro` : '';

    return (
        <div className="max-w-6xl mx-auto py-8 px-4 pb-24">
            <button onClick={() => navigate('/browse')} className="mb-6 flex items-center text-zinc-500 hover:text-zinc-900 dark:hover:text-white transition-colors font-bold text-sm">
                <ArrowLeft size={18} className="mr-1" /> Back to Events
            </button>

            <div className="text-center mb-12 animate-in fade-in slide-in-from-bottom-4">
                <div className="inline-flex items-center gap-2 bg-[#E0FF20] text-black px-4 py-1 rounded-full font-black uppercase text-xs tracking-wider mb-4 shadow-[0_0_20px_rgba(224,255,32,0.4)]">
                    <Zap size={14} fill="currentColor" /> Active Partner
                </div>
                <h1 className="text-5xl font-black text-zinc-900 dark:text-white mb-4 uppercase font-display tracking-tight">
                    Affiliate <span className="text-transparent bg-clip-text bg-gradient-to-r from-[#E0FF20] to-[#00ff9d]">Portal</span>
                </h1>
                <p className="text-zinc-500 dark:text-zinc-400 text-xl max-w-2xl mx-auto">
                    Track your referrals and earnings in real-time.
                </p>
            </div>

            {/* Stats Grid */}
            <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-8 animate-in fade-in slide-in-from-bottom-5">
                <Card className="p-6 border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-900/50">
                    <div className="text-zinc-500 text-xs font-bold uppercase mb-2">Total Referrals</div>
                    <div className="text-3xl font-black text-zinc-900 dark:text-white flex items-center gap-2">
                        <Users className="text-blue-500" size={24} /> {stats.referrals}
                    </div>
                </Card>
                <Card className="p-6 border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-900/50">
                    <div className="text-zinc-500 text-xs font-bold uppercase mb-2">Active Subscriptions</div>
                    <div className="text-3xl font-black text-zinc-900 dark:text-white flex items-center gap-2">
                        <ShieldCheck className="text-green-500" size={24} /> {stats.activeSubs}
                    </div>
                </Card>
                <Card className="p-6 border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-900/50">
                    <div className="text-zinc-500 text-xs font-bold uppercase mb-2">Lifetime Earnings</div>
                    <div className="text-3xl font-black text-primary dark:text-[#E0FF20] flex items-center gap-2">
                        <DollarSign size={24} /> {stats.totalEarnings.toFixed(2)}
                    </div>
                </Card>

                {/* Stripe Payout Card */}
                <Card className="p-6 border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-900/50 relative overflow-hidden flex flex-col justify-center border-l-4 border-l-[#635BFF]">
                    <div className="text-zinc-500 text-xs font-bold uppercase mb-2 flex items-center justify-between">
                        Payout Setup
                        {user?.stripeConnectId && <span className="bg-green-500/20 text-green-500 text-[10px] px-2 py-0.5 rounded-full flex items-center gap-1"><CheckCircle2 size={10} /> Active</span>}
                    </div>

                    {isEditingStripe || !user?.stripeConnectId ? (
                        <div className="animate-in fade-in space-y-3">
                            <p className="text-[10px] text-zinc-500 leading-tight">
                                Connect your Stripe account to receive automatic monthly payouts.
                            </p>
                            <Button
                                size="sm"
                                onClick={async () => {
                                    if (!user) return;
                                    const res = await StorageService.connectStripeAccount(user.id, 'express');
                                    if (res.success) {
                                        window.location.reload();
                                    }
                                }}
                                className="w-full bg-[#635BFF] text-white hover:bg-[#534ac2] border-none text-xs shadow-lg shadow-[#635BFF]/20"
                            >
                                Connect Payouts
                            </Button>
                            {user?.stripeConnectId && <Button size="sm" variant="ghost" onClick={() => setIsEditingStripe(false)} className="w-full text-xs h-6">Cancel</Button>}
                        </div>
                    ) : (
                        <div>
                            <div className="flex items-center justify-between">
                                <div className="text-sm font-mono text-zinc-300 bg-black/20 p-2 rounded border border-zinc-700 mb-2 truncate max-w-[120px]">
                                    {user.stripeConnectId}
                                </div>
                                <button onClick={() => setIsEditingStripe(true)} className="p-2 hover:bg-white/10 rounded-full transition-colors">
                                    <Edit2 size={14} />
                                </button>
                            </div>
                            <div className="text-[10px] text-zinc-500">Payouts are automated monthly.</div>
                        </div>
                    )}
                </Card>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-3 gap-8 animate-in fade-in slide-in-from-bottom-6">
                {/* LEFT: Tools & Earnings */}
                <div className="lg:col-span-2 space-y-8">
                    {/* Link Generator */}
                    <Card className="p-8 border-[#E0FF20]/30 bg-gradient-to-br from-zinc-900 to-black text-white">
                        <h2 className="text-2xl font-bold text-white mb-4 flex items-center gap-2">
                            <Link2 className="text-[#E0FF20]" /> Your Referral Link
                        </h2>
                        <div className="bg-black p-4 rounded-xl border border-zinc-800 flex items-center justify-between gap-4 overflow-hidden">
                            <code className="text-[#E0FF20] font-mono text-sm truncate flex-1">{referralLink}</code>
                            <Button size="sm" onClick={() => { navigator.clipboard.writeText(referralLink); alert("Copied!") }} className="shrink-0">
                                <Copy size={16} className="mr-2" /> Copy
                            </Button>
                        </div>
                        <div className="mt-4 flex items-center gap-2 text-sm text-zinc-400">
                            <span className="font-bold text-white">Code:</span>
                            <span className="font-mono bg-zinc-800 px-2 py-1 rounded">{user?.affiliateCode}</span>
                        </div>
                    </Card>

                    {/* AI Marketing Lab */}
                    <Card className="p-0 border-zinc-200 dark:border-zinc-800 overflow-hidden">
                        <div className="p-6 border-b border-zinc-200 dark:border-zinc-800 flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
                            <div>
                                <h2 className="text-xl font-bold flex items-center gap-2 text-zinc-900 dark:text-white">
                                    <Sparkles className="text-purple-500" /> AI Marketing Lab
                                </h2>
                                <p className="text-sm text-zinc-500">Generate high-converting posts in seconds.</p>
                            </div>
                            <div className="flex gap-2 bg-zinc-100 dark:bg-black p-1 rounded-lg">
                                {['twitter', 'linkedin', 'instagram', 'facebook'].map(p => (
                                    <button
                                        key={p}
                                        onClick={() => setSelectedPlatform(p as any)}
                                        className={`p-2 rounded-md transition-colors ${selectedPlatform === p ? 'bg-white dark:bg-zinc-800 text-black dark:text-white shadow-sm' : 'text-zinc-400 hover:text-zinc-600 dark:hover:text-zinc-300'}`}
                                        title={p.charAt(0).toUpperCase() + p.slice(1)}
                                    >
                                        {p === 'twitter' && <Twitter size={18} />}
                                        {p === 'linkedin' && <Linkedin size={18} />}
                                        {p === 'instagram' && <Instagram size={18} />}
                                        {p === 'facebook' && <Facebook size={18} />}
                                    </button>
                                ))}
                            </div>
                        </div>
                        <div className="p-6 bg-zinc-50 dark:bg-zinc-900/30">
                            <div className="relative">
                                <textarea
                                    className="w-full h-48 bg-white dark:bg-black border border-zinc-200 dark:border-zinc-800 rounded-xl p-4 text-sm resize-none focus:ring-2 focus:ring-primary outline-none text-zinc-900 dark:text-white"
                                    placeholder="Your AI-generated content will appear here..."
                                    value={generatedContent}
                                    onChange={(e) => setGeneratedContent(e.target.value)}
                                ></textarea>
                                {generatedContent && (
                                    <button
                                        onClick={() => { navigator.clipboard.writeText(generatedContent); alert("Content Copied!") }}
                                        className="absolute bottom-4 right-4 p-2 bg-zinc-100 dark:bg-zinc-800 rounded-lg text-zinc-500 hover:text-black dark:hover:text-white transition-colors"
                                        title="Copy to Clipboard"
                                    >
                                        <Copy size={16} />
                                    </button>
                                )}
                            </div>
                            <Button
                                onClick={generatePost}
                                isLoading={isGenerating}
                                className="w-full mt-4 bg-purple-600 hover:bg-purple-700 text-white border-none shadow-lg shadow-purple-500/20"
                            >
                                <Sparkles size={18} className="mr-2" /> Generate {selectedPlatform.charAt(0).toUpperCase() + selectedPlatform.slice(1)} Post
                            </Button>
                        </div>
                    </Card>

                    {/* Recent Earnings Table */}
                    <Card className="p-6 border-zinc-200 dark:border-zinc-800">
                        <h3 className="font-bold text-lg mb-4 text-zinc-900 dark:text-white">Recent Earnings</h3>
                        {stats.recentCommissions.length > 0 ? (
                            <div className="space-y-3">
                                {stats.recentCommissions.map(inv => (
                                    <div key={inv.id} className="flex justify-between items-center p-3 bg-zinc-50 dark:bg-zinc-900/50 rounded-xl">
                                        <div>
                                            <div className="font-bold text-sm text-zinc-900 dark:text-white">{inv.description}</div>
                                            <div className="text-xs text-zinc-500">{new Date(inv.date).toLocaleDateString()}</div>
                                        </div>
                                        <div className="text-green-600 dark:text-green-400 font-bold font-mono">
                                            +${inv.amount.toFixed(2)}
                                        </div>
                                    </div>
                                ))}
                            </div>
                        ) : (
                            <div className="text-center py-8 text-zinc-500 text-sm italic">
                                No commissions yet. Start sharing your link!
                            </div>
                        )}
                    </Card>
                </div>

                {/* RIGHT: Assets & Tips */}
                <div className="space-y-8">
                    <Card className="p-6 border-zinc-200 dark:border-zinc-800 bg-[#E0FF20]/5 border-[#E0FF20]/20">
                        <h3 className="font-bold text-lg mb-4 flex items-center gap-2">
                            <Star className="text-[#E0FF20]" fill="currentColor" /> Pro Tips
                        </h3>
                        <ul className="space-y-3 text-sm text-zinc-600 dark:text-zinc-400">
                            <li className="flex items-start gap-2">
                                <CheckCircle2 size={16} className="text-[#E0FF20] mt-0.5 shrink-0" />
                                <span>Target event organizers, not attendees. You earn when they upgrade to Pro.</span>
                            </li>
                            <li className="flex items-start gap-2">
                                <CheckCircle2 size={16} className="text-[#E0FF20] mt-0.5 shrink-0" />
                                <span>Mention "Zero fees for free events" - it's our best hook.</span>
                            </li>
                            <li className="flex items-start gap-2">
                                <CheckCircle2 size={16} className="text-[#E0FF20] mt-0.5 shrink-0" />
                                <span>Share in Facebook Groups for event planners and DJs.</span>
                            </li>
                        </ul>
                    </Card>

                    <Card className="p-6 border-zinc-200 dark:border-zinc-800">
                        <h3 className="font-bold text-lg mb-4">Marketing Assets</h3>
                        <div className="space-y-2">
                            <button className="w-full flex items-center justify-between p-3 bg-zinc-50 dark:bg-zinc-900 rounded-xl hover:bg-zinc-100 dark:hover:bg-zinc-800 transition-colors group">
                                <div className="flex items-center gap-3">
                                    <div className="w-8 h-8 bg-black rounded-lg flex items-center justify-center text-white"><Download size={16} /></div>
                                    <div className="text-left">
                                        <div className="text-sm font-bold text-zinc-900 dark:text-white">Brand Logos</div>
                                        <div className="text-xs text-zinc-500">PNG, SVG</div>
                                    </div>
                                </div>
                                <ExternalLink size={16} className="text-zinc-400 group-hover:text-zinc-900 dark:group-hover:text-white" />
                            </button>
                            <button className="w-full flex items-center justify-between p-3 bg-zinc-50 dark:bg-zinc-900 rounded-xl hover:bg-zinc-100 dark:hover:bg-zinc-800 transition-colors group">
                                <div className="flex items-center gap-3">
                                    <div className="w-8 h-8 bg-purple-600 rounded-lg flex items-center justify-center text-white"><Download size={16} /></div>
                                    <div className="text-left">
                                        <div className="text-sm font-bold text-zinc-900 dark:text-white">Social Templates</div>
                                        <div className="text-xs text-zinc-500">Canva, Figma</div>
                                    </div>
                                </div>
                                <ExternalLink size={16} className="text-zinc-400 group-hover:text-zinc-900 dark:group-hover:text-white" />
                            </button>
                        </div>
                    </Card>
                </div>
            </div>
        </div>
    );
};
