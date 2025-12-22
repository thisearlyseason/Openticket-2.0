
import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { StorageService } from '../services/storageService';
import { Button, Input, Card } from './UI';
import { Gift, ArrowRight, CheckCircle2, Zap, DollarSign, Globe, TrendingUp, User, Lock, Mail, ArrowLeft } from 'lucide-react';

export const AffiliateAuth = () => {
    const navigate = useNavigate();
    const [isLogin, setIsLogin] = useState(true);
    const [formData, setFormData] = useState({ name: '', email: '', password: '' });
    const [isLoading, setIsLoading] = useState(false);
    const [error, setError] = useState('');

    useEffect(() => {
        if (StorageService.getCurrentUser()) {
            navigate('/affiliate');
        }
    }, [navigate]);

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        setError('');
        setIsLoading(true);

        try {
            if (isLogin) {
                const { user, error } = await StorageService.login(formData.email, formData.password);
                if (error) throw new Error(error);
                if (user) navigate('/affiliate');
            } else {
                const result = await StorageService.signup({
                    name: formData.name,
                    email: formData.email,
                    password: formData.password,
                    role: 'affiliate' // Assign dedicated Affiliate Role
                });
                if (typeof result === 'string') throw new Error(result);
                navigate('/affiliate');
            }
        } catch (e: any) {
            setError(e.message);
            setIsLoading(false);
        }
    };

    return (
        <div className="min-h-screen bg-black text-white flex flex-col">
            <div className="p-6">
                <button onClick={() => navigate('/')} className="text-zinc-500 hover:text-white flex items-center transition-colors text-sm font-bold">
                    <ArrowLeft size={16} className="mr-1" /> Back to Home
                </button>
            </div>

            <div className="flex-1 flex items-center justify-center p-4">
                <div className="w-full max-w-5xl grid grid-cols-1 md:grid-cols-2 gap-12 items-center">

                    {/* Marketing Side */}
                    <div className="space-y-8 animate-in fade-in slide-in-from-left-4 hidden md:block">
                        <div>
                            <div className="inline-flex items-center gap-2 bg-[#E0FF20]/10 text-[#E0FF20] px-4 py-1.5 rounded-full font-bold text-xs uppercase tracking-wider mb-6 border border-[#E0FF20]/20">
                                <Gift size={14} /> Partner Program
                            </div>
                            <h1 className="text-5xl lg:text-6xl font-black font-display tracking-tight leading-none mb-6">
                                EARN <span className="text-[#E0FF20]">15%</span> ON<br />
                                EVERY SALE.
                            </h1>
                            <p className="text-xl text-zinc-400 max-w-md">
                                Join the OpenTicket partner network. Refer organizers and earn recurring commissions on all Pro and Premium plans.
                            </p>
                        </div>

                        <div className="space-y-4">
                            <div className="flex items-center gap-4 p-4 rounded-2xl bg-zinc-900/50 border border-zinc-800">
                                <div className="w-12 h-12 rounded-full bg-green-500/10 flex items-center justify-center text-green-500">
                                    <DollarSign size={24} />
                                </div>
                                <div>
                                    <h3 className="font-bold text-white">Recurring Revenue</h3>
                                    <p className="text-sm text-zinc-500">Get paid every time your referral renews.</p>
                                </div>
                            </div>
                            <div className="flex items-center gap-4 p-4 rounded-2xl bg-zinc-900/50 border border-zinc-800">
                                <div className="w-12 h-12 rounded-full bg-blue-500/10 flex items-center justify-center text-blue-500">
                                    <Zap size={24} />
                                </div>
                                <div>
                                    <h3 className="font-bold text-white">Instant Payouts</h3>
                                    <p className="text-sm text-zinc-500">Connect Stripe for automated monthly transfers.</p>
                                </div>
                            </div>
                            <div className="flex items-center gap-4 p-4 rounded-2xl bg-zinc-900/50 border border-zinc-800">
                                <div className="w-12 h-12 rounded-full bg-purple-500/10 flex items-center justify-center text-purple-500">
                                    <TrendingUp size={24} />
                                </div>
                                <div>
                                    <h3 className="font-bold text-white">Real-time Analytics</h3>
                                    <p className="text-sm text-zinc-500">Track clicks, signups, and earnings live.</p>
                                </div>
                            </div>
                        </div>
                    </div>

                    {/* Auth Form Side */}
                    <div className="animate-in fade-in slide-in-from-right-4">
                        <Card className="p-8 bg-zinc-900 border-zinc-800 shadow-[0_0_50px_rgba(224,255,32,0.1)]">
                            <div className="text-center mb-8">
                                <h2 className="text-2xl font-black text-white uppercase mb-2">
                                    {isLogin ? 'Partner Login' : 'Become a Partner'}
                                </h2>
                                <p className="text-zinc-500 text-sm">
                                    {isLogin ? 'Welcome back! Ready to check your stats?' : 'Create an account to start earning today.'}
                                </p>
                            </div>

                            <form onSubmit={handleSubmit} className="space-y-4">
                                {!isLogin && (
                                    <>
                                        <button
                                            type="button"
                                            onClick={async () => {
                                                setError('');
                                                setIsLoading(true);
                                                const { user, error } = await StorageService.loginWithGoogle('affiliate');
                                                if (error) { setError(error); setIsLoading(false); }
                                                else if (user) navigate('/affiliate');
                                            }}
                                            disabled={isLoading}
                                            className="w-full py-3 mb-4 bg-white text-zinc-900 border border-zinc-200 rounded-xl hover:bg-zinc-100 font-bold flex items-center justify-center gap-3 transition-colors"
                                        >
                                            <svg className="w-5 h-5" viewBox="0 0 24 24">
                                                <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" />
                                                <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" />
                                                <path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.84z" />
                                                <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" />
                                            </svg>
                                            Sign Up with Google
                                        </button>

                                        <div className="relative flex items-center justify-center mb-4">
                                            <span className="absolute w-full h-px bg-zinc-800"></span>
                                            <span className="relative bg-zinc-900 px-3 text-xs text-zinc-500 uppercase">Or with email</span>
                                        </div>

                                        <Input
                                            icon={User}
                                            placeholder="Full Name"
                                            required
                                            value={formData.name}
                                            onChange={e => setFormData({ ...formData, name: e.target.value })}
                                            className="bg-black border-zinc-800"
                                        />
                                    </>
                                )}
                                {isLogin && (
                                    <button
                                        type="button"
                                        onClick={async () => {
                                            setError('');
                                            setIsLoading(true);
                                            // Login logic handles existing user role retrieval
                                            const { user, error } = await StorageService.loginWithGoogle();
                                            if (error) { setError(error); setIsLoading(false); }
                                            else if (user) navigate('/affiliate');
                                        }}
                                        disabled={isLoading}
                                        className="w-full py-3 mb-4 bg-white text-zinc-900 border border-zinc-200 rounded-xl hover:bg-zinc-100 font-bold flex items-center justify-center gap-3 transition-colors"
                                    >
                                        <svg className="w-5 h-5" viewBox="0 0 24 24">
                                            <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" />
                                            <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" />
                                            <path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.84z" />
                                            <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" />
                                        </svg>
                                        Continue with Google
                                    </button>
                                )}
                                {isLogin && (
                                    <div className="relative flex items-center justify-center mb-4">
                                        <span className="absolute w-full h-px bg-zinc-800"></span>
                                        <span className="relative bg-zinc-900 px-3 text-xs text-zinc-500 uppercase">Or with email</span>
                                    </div>
                                )}

                                {error && (
                                    <div className="p-3 rounded-xl bg-red-500/10 border border-red-500/20 text-red-500 text-xs font-bold text-center">
                                        {error}
                                    </div>
                                )}

                                <Button
                                    type="submit"
                                    className="w-full py-4 text-lg bg-[#E0FF20] text-black hover:bg-[#d4f542] border-none font-black shadow-[0_0_20px_rgba(224,255,32,0.4)]"
                                    isLoading={isLoading}
                                >
                                    {isLogin ? 'Access Dashboard' : 'Join Program'} <ArrowRight size={20} className="ml-2" />
                                </Button>
                            </form>

                            <div className="mt-6 pt-6 border-t border-zinc-800 text-center">
                                <button
                                    onClick={() => { setIsLogin(!isLogin); setError(''); }}
                                    className="text-sm text-zinc-400 hover:text-white transition-colors"
                                >
                                    {isLogin ? "New here? " : "Already a partner? "}
                                    <span className="text-[#E0FF20] font-bold hover:underline">
                                        {isLogin ? "Apply Now" : "Sign In"}
                                    </span>
                                </button>
                            </div>
                        </Card>
                    </div>

                </div>
            </div>
        </div>
    );
};
