
import React, { useEffect, useRef, useState } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { Ticket, Shield, BarChart3, Globe, Heart, CheckCircle2, ArrowRight, Zap, PlayCircle, Star, Instagram, Twitter, Linkedin, Facebook, Sun, Moon } from 'lucide-react';
import { Button, Card } from './UI';
import { StorageService } from '../services/storageService';
import { Logo } from './Logo';

export const LandingPage = () => {
    const navigate = useNavigate();
    const marqueeRef = useRef<HTMLDivElement>(null);
    const [isDark, setIsDark] = useState(true);

    // Initialize theme
    useEffect(() => {
        const savedTheme = localStorage.getItem('openticket_theme');
        const prefersDark = savedTheme === 'dark' || (!savedTheme && window.matchMedia('(prefers-color-scheme: dark)').matches);
        setIsDark(prefersDark);
        document.documentElement.classList.toggle('dark', prefersDark);
    }, []);

    const toggleTheme = () => {
        const newTheme = !isDark;
        setIsDark(newTheme);
        document.documentElement.classList.toggle('dark', newTheme);
        localStorage.setItem('openticket_theme', newTheme ? 'dark' : 'light');
    };

    // Redirect logged-in users to dashboard
    useEffect(() => {
        const user = StorageService.getCurrentUser();
        if (user) {
            navigate('/dashboard', { replace: true });
        }
    }, [navigate]);

    useEffect(() => {
        const handleScroll = () => {
            if (marqueeRef.current) {
                // Move the marquee left as user scrolls down
                marqueeRef.current.style.transform = `translateX(${window.scrollY * -0.5}px)`;
            }
        };

        window.addEventListener('scroll', handleScroll, { passive: true });
        return () => window.removeEventListener('scroll', handleScroll);
    }, []);

    return (
        <div className="bg-white dark:bg-black text-zinc-900 dark:text-white min-h-screen font-sans selection:bg-accent selection:text-accent-fg overflow-x-hidden transition-colors duration-300">
            {/* Nav */}
            <nav className="sticky top-0 left-0 right-0 p-6 flex justify-between items-center z-50 backdrop-blur-md bg-white/90 dark:bg-black/90 border-b border-zinc-200 dark:border-zinc-800">
                <Logo variant={isDark ? "dark" : "light"} size="lg" />
                <div className="flex gap-4 items-center">
                    <button 
                        onClick={toggleTheme}
                        className="p-2 rounded-full hover:bg-zinc-100 dark:hover:bg-white/10 transition-colors"
                        aria-label="Toggle theme"
                    >
                        {isDark ? <Sun size={20} className="text-yellow-400" /> : <Moon size={20} className="text-zinc-700" />}
                    </button>
                    <button onClick={() => navigate('/pricing')} className="hidden md:block font-bold hover:text-accent transition-colors">Pricing</button>
                    <button onClick={() => navigate('/browse')} className="hidden md:block font-bold hover:text-accent transition-colors">Explore</button>
                    <button onClick={() => navigate('/auth')} className="font-bold hover:text-accent transition-colors">Sign In</button>
                </div>
            </nav>

            {/* Hero */}
            <header className="relative pt-20 pb-20 px-4 text-center bg-gradient-to-br from-white via-zinc-50 to-accent/10 dark:from-black dark:via-zinc-900 dark:to-black">
                <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[800px] h-[800px] bg-accent rounded-full blur-[200px] opacity-20 dark:opacity-15 pointer-events-none"></div>
                <div className="relative z-10 max-w-6xl mx-auto">
                    <div className="inline-block border-2 border-accent/30 dark:border-accent/50 rounded-full px-5 py-2 text-sm font-bold mb-8 bg-white dark:bg-white/5 backdrop-blur-md shadow-lg animate-in fade-in slide-in-from-top-4 duration-700">
                        <span className="text-accent">●</span> THE FUTURE OF EVENTS
                    </div>
                    <h1 className="text-5xl sm:text-6xl md:text-7xl lg:text-9xl font-black font-display tracking-tighter leading-[0.9] mb-8">
                        TICKETS <span className="bg-gradient-to-r from-accent via-[#00ff9d] to-primary text-transparent bg-clip-text animate-pulse-slow" style={{ WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent' }}>SOLD.</span><br />
                        <span className="text-4xl sm:text-5xl md:text-6xl lg:text-8xl">VIBES UNCOMPROMISED.</span>
                    </h1>
                    <p className="text-lg md:text-2xl text-zinc-600 dark:text-zinc-400 max-w-3xl mx-auto mb-12 font-medium leading-relaxed">
                        The boldest ticketing platform for creators. Zero hidden fees.
                        <span className="text-zinc-900 dark:text-white font-bold"> 100% Vibes.</span>
                    </p>
                    <div className="flex flex-col sm:flex-row gap-4 justify-center items-center">
                        <button onClick={() => navigate('/auth')} className="px-10 py-5 bg-accent text-accent-fg font-black text-xl rounded-full hover:scale-105 hover:shadow-2xl transition-all duration-200 shadow-lg">
                            START SELLING
                        </button>
                        <button onClick={() => navigate('/browse')} className="px-10 py-5 border-2 border-zinc-300 dark:border-zinc-700 bg-white dark:bg-transparent text-zinc-900 dark:text-white font-bold text-xl rounded-full hover:bg-zinc-50 dark:hover:bg-zinc-900 hover:border-accent transition-all duration-200">
                            FIND EVENTS
                        </button>
                    </div>
                </div>
            </header>

            {/* Zero Fees Pop Banner */}
            <div className="relative z-20 max-w-5xl mx-auto px-4 mb-20 transform hover:scale-[1.02] transition-transform duration-300">
                <div className="bg-gradient-to-r from-pink-500 via-purple-500 to-indigo-500 p-1 rounded-3xl shadow-2xl">
                    <div className="bg-zinc-900 dark:bg-black rounded-[1.3rem] p-10 text-center relative overflow-hidden">
                        <div className="absolute top-0 right-0 w-40 h-40 bg-pink-500 rounded-full blur-[80px] opacity-30"></div>
                        <h2 className="text-3xl md:text-5xl font-black font-display italic uppercase leading-tight relative z-10 text-white">
                            NO FEES ON <span className="text-pink-400">FREE EVENTS</span> <br />
                            <span className="bg-gradient-to-r from-white via-zinc-200 to-zinc-400 text-transparent bg-clip-text" style={{ WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent' }}>EVER. SERIOUSLY.</span>
                        </h2>
                        <p className="text-zinc-300 mt-4 font-medium tracking-wide text-sm md:text-base">
                            Hosting a free meetup? We won't charge you a dime. Not now, not ever.
                        </p>
                    </div>
                </div>
            </div>

            {/* Scroll-Driven Marquee */}
            <div className="bg-accent dark:bg-accent py-5 rotate-1 scale-105 mb-24 overflow-hidden shadow-xl">
                <div
                    ref={marqueeRef}
                    className="flex gap-8 whitespace-nowrap text-accent-fg font-black text-xl md:text-2xl uppercase tracking-tight will-change-transform"
                >
                    {Array(20).fill("• No Hidden Fees • Easy Payouts • Custom Branding • QR Check-in • Real-time Analytics ").map((text, i) => (
                        <span key={i}>{text}</span>
                    ))}
                </div>
            </div>

            {/* Features Grid */}
            <section className="max-w-7xl mx-auto px-4 py-20 bg-gradient-to-b from-transparent via-zinc-50/50 to-transparent dark:via-transparent">
                <h2 className="text-4xl md:text-6xl font-black text-center mb-16 font-display">Why Creators <span className="text-accent">Love Us</span></h2>
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                    <div className="bg-white dark:bg-zinc-900 rounded-3xl p-8 border-2 border-zinc-200 dark:border-zinc-800 hover:border-accent hover:shadow-2xl transition-all duration-300 group">
                        <div className="w-16 h-16 bg-accent rounded-2xl flex items-center justify-center mb-6 text-accent-fg group-hover:rotate-12 group-hover:scale-110 transition-transform shadow-lg">
                            <Zap size={32} fill="currentColor" />
                        </div>
                        <h3 className="text-2xl font-black mb-3 font-display uppercase">Easy Payouts</h3>
                        <p className="text-zinc-600 dark:text-zinc-400 leading-relaxed">Get paid directly to your bank account via Stripe. Fast, secure, hassle-free.</p>
                    </div>

                    <div className="bg-white dark:bg-zinc-900 rounded-3xl p-8 border-2 border-zinc-200 dark:border-zinc-800 hover:border-[#ff00ff] hover:shadow-2xl transition-all duration-300 group">
                        <div className="w-16 h-16 bg-[#ff00ff] rounded-2xl flex items-center justify-center mb-6 text-white group-hover:-rotate-12 group-hover:scale-110 transition-transform shadow-lg">
                            <Star size={32} fill="currentColor" />
                        </div>
                        <h3 className="text-2xl font-black mb-3 font-display uppercase">Premium Brand</h3>
                        <p className="text-zinc-600 dark:text-zinc-400 leading-relaxed">Customize your event page with your colors, logo, and custom domain. Make it yours.</p>
                    </div>

                    <div className="bg-white dark:bg-zinc-900 rounded-3xl p-8 border-2 border-zinc-200 dark:border-zinc-800 hover:border-[#00ff9d] hover:shadow-2xl transition-all duration-300 group">
                        <div className="w-16 h-16 bg-[#00ff9d] rounded-2xl flex items-center justify-center mb-6 text-black group-hover:scale-110 transition-transform shadow-lg">
                            <CheckCircle2 size={32} />
                        </div>
                        <h3 className="text-2xl font-black mb-3 font-display uppercase">Easy Check-in</h3>
                        <p className="text-zinc-600 dark:text-zinc-400 leading-relaxed">Scan tickets at the door with any device using our ultra-fast check-in portal.</p>
                    </div>
                </div>
            </section>

            {/* Big CTA */}
            <section className="py-32 px-4 text-center relative overflow-hidden">
                <div className="absolute top-0 left-0 w-full h-full bg-[url('https://www.transparenttextures.com/patterns/cubes.png')] opacity-10"></div>
                <div className="relative z-10">
                    <h2 className="text-6xl md:text-8xl font-black font-display tracking-tighter mb-8 leading-none">
                        READY TO <span className="bg-gradient-to-br from-accent to-[#ff00ff] text-transparent bg-clip-text" style={{ WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent' }}>POP?</span>
                    </h2>
                    <button onClick={() => navigate('/auth')} className="px-12 py-6 bg-white text-black font-black text-2xl rounded-full hover:bg-accent transition-colors shadow-2xl">
                        CREATE EVENT FREE
                    </button>
                </div>
            </section>

            {/* Footer */}
            <footer className="bg-zinc-900 border-t border-zinc-800 pt-20 pb-10 px-4 mt-20">
                <div className="max-w-7xl mx-auto grid grid-cols-1 md:grid-cols-4 gap-12 mb-16">
                    <div className="col-span-1 md:col-span-2">
                        <div className="mb-4">
                            <Logo variant="dark" size="lg" />
                        </div>
                        <p className="text-zinc-500 max-w-sm">
                            The future of event ticketing. Built for creators, organizers, and party-starters who demand more control and less fees.
                        </p>
                    </div>
                    <div>
                        <h4 className="font-bold text-white mb-6 uppercase tracking-wider">Platform</h4>
                        <ul className="space-y-4 text-zinc-400">
                            <li><button onClick={() => navigate('/browse')} className="hover:text-accent transition-colors">Explore Events</button></li>
                            <li><button onClick={() => navigate('/pricing')} className="hover:text-accent transition-colors">Pricing</button></li>
                            <li><button onClick={() => navigate('/auth')} className="hover:text-accent transition-colors">Sign In</button></li>
                            <li><button onClick={() => navigate('/auth')} className="hover:text-accent transition-colors">Start Selling</button></li>
                            <li><button onClick={() => navigate('/affiliate-login')} className="hover:text-accent transition-colors text-accent">Affiliate Program</button></li>
                        </ul>
                    </div>
                    <div>
                        <h4 className="font-bold text-white mb-6 uppercase tracking-wider">Support</h4>
                        <ul className="space-y-4 text-zinc-400">
                            <li><button onClick={() => navigate('/contact')} className="hover:text-accent transition-colors">Contact Us</button></li>
                            <li><button onClick={() => navigate('/refunds')} className="hover:text-accent transition-colors">Refund Policy</button></li>
                            <li><Link to="/terms" className="hover:text-accent transition-colors">Terms of Service</Link></li>
                            <li><Link to="/privacy" className="hover:text-accent transition-colors">Privacy Policy</Link></li>
                        </ul>
                    </div>
                </div>
                <div className="max-w-7xl mx-auto border-t border-zinc-800 pt-8 flex flex-col md:flex-row justify-between items-center gap-4 text-zinc-600 text-sm">
                    <p>&copy; {new Date().getFullYear()} OpenTicket. All rights reserved.</p>
                    <div className="flex items-center gap-6">
                        <a href="#" className="hover:text-white transition-colors"><Instagram size={20} /></a>
                        <a href="#" className="hover:text-white transition-colors"><Twitter size={20} /></a>
                        <a href="#" className="hover:text-white transition-colors"><Linkedin size={20} /></a>
                    </div>
                </div>
            </footer>
        </div>
    );
};
