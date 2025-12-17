
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
                    <ArrowLeft size={16} className="mr-1"/> Back to Home
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
                                EARN <span className="text-[#E0FF20]">15%</span> ON<br/>
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
                                    <Input 
                                        icon={User}
                                        placeholder="Full Name" 
                                        required 
                                        value={formData.name} 
                                        onChange={e => setFormData({...formData, name: e.target.value})}
                                        className="bg-black border-zinc-800"
                                    />
                                )}
                                <Input 
                                    icon={Mail}
                                    type="email" 
                                    placeholder="Email Address" 
                                    required 
                                    value={formData.email} 
                                    onChange={e => setFormData({...formData, email: e.target.value})}
                                    className="bg-black border-zinc-800"
                                />
                                <Input 
                                    icon={Lock}
                                    type="password" 
                                    placeholder="Password" 
                                    required 
                                    value={formData.password} 
                                    onChange={e => setFormData({...formData, password: e.target.value})} 
                                    className="bg-black border-zinc-800"
                                />

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
                                    {isLogin ? 'Access Dashboard' : 'Join Program'} <ArrowRight size={20} className="ml-2"/>
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
