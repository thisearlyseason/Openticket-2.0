
import React, { useEffect, useRef } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { Ticket, Shield, BarChart3, Globe, Heart, CheckCircle2, ArrowRight, Zap, PlayCircle, Star, Instagram, Twitter, Linkedin, Facebook } from 'lucide-react';
import { Button, Card } from './UI';

export const LandingPage = () => {
    const navigate = useNavigate();
    const marqueeRef = useRef<HTMLDivElement>(null);

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
        <div className="bg-black text-white min-h-screen font-sans selection:bg-[#E0FF20] selection:text-black overflow-x-hidden">
            {/* Nav Mockup */}
            <nav className="absolute top-0 left-0 right-0 p-6 flex justify-between items-center z-50">
                <div className="text-2xl font-black font-display tracking-tighter">
                    OPEN<span className="text-[#E0FF20]">TICKET</span>
                </div>
                <div className="flex gap-4">
                    <button onClick={() => navigate('/browse')} className="hidden md:block font-bold hover:text-[#E0FF20]">Explore</button>
                    <button onClick={() => navigate('/auth')} className="font-bold hover:text-[#E0FF20]">Sign In</button>
                </div>
            </nav>

            {/* Hero */}
            <header className="relative pt-32 pb-20 px-4 text-center">
                <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[600px] h-[600px] bg-[#E0FF20] rounded-full blur-[150px] opacity-20 pointer-events-none"></div>
                <div className="relative z-10">
                    <div className="inline-block border border-white/20 rounded-full px-4 py-1 text-sm font-bold mb-6 bg-white/5 backdrop-blur-md animate-in fade-in slide-in-from-top-4 duration-700">
                        <span className="text-[#E0FF20]">●</span> THE FUTURE OF EVENTS
                    </div>
                    <h1 className="text-7xl md:text-9xl font-black font-display tracking-tighter leading-none mb-6">
                        SELL <span className="text-transparent bg-clip-text bg-gradient-to-r from-[#E0FF20] to-[#00ff9d]">TICKETS</span><br/>
                        NOT YOUR SOUL
                    </h1>
                    <p className="text-xl md:text-2xl text-zinc-400 max-w-2xl mx-auto mb-10 font-medium">
                        The boldest ticketing platform for creators. Zero hidden fees. 
                        Instant payouts. <span className="text-white">100% Vibes.</span>
                    </p>
                    <div className="flex flex-col sm:flex-row gap-4 justify-center items-center">
                        <button onClick={() => navigate('/auth')} className="px-8 py-4 bg-[#E0FF20] text-black font-black text-xl rounded-full hover:scale-105 transition-transform shadow-[0_0_30px_rgba(224,255,32,0.4)]">
                            START SELLING
                        </button>
                        <button onClick={() => navigate('/browse')} className="px-8 py-4 border border-zinc-700 text-white font-bold text-xl rounded-full hover:bg-zinc-900 transition-colors">
                            FIND EVENTS
                        </button>
                    </div>
                </div>
            </header>

            {/* Zero Fees Pop Banner */}
            <div className="relative z-20 max-w-5xl mx-auto px-4 -mt-8 mb-16 transform hover:scale-105 transition-transform duration-300">
                <div className="bg-gradient-to-r from-pink-500 via-purple-500 to-indigo-500 p-1 rounded-3xl shadow-[0_0_50px_rgba(236,72,153,0.5)]">
                    <div className="bg-black rounded-[1.3rem] p-8 text-center relative overflow-hidden">
                         <div className="absolute top-0 right-0 w-32 h-32 bg-pink-500 rounded-full blur-[60px] opacity-40"></div>
                         <h2 className="text-4xl md:text-6xl font-black font-display italic uppercase leading-none relative z-10">
                            NO FEES ON <span className="text-pink-500">FREE EVENTS</span> <br/>
                            <span className="text-transparent bg-clip-text bg-gradient-to-r from-white to-zinc-400">EVER. SERIOUSLY.</span>
                         </h2>
                         <p className="text-zinc-400 mt-4 font-bold tracking-wide">
                            Hosting a free meetup? We won't charge you a dime. Not now, not ever.
                         </p>
                    </div>
                </div>
            </div>

            {/* Scroll-Driven Marquee */}
            <div className="bg-[#E0FF20] py-4 rotate-1 scale-105 mb-20 overflow-hidden">
                <div 
                    ref={marqueeRef}
                    className="flex gap-8 whitespace-nowrap text-black font-black text-2xl uppercase tracking-tighter will-change-transform"
                >
                    {Array(20).fill("• No Hidden Fees • Instant Payouts • Custom Branding • QR Check-in • Real-time Analytics ").map((text, i) => (
                        <span key={i}>{text}</span>
                    ))}
                </div>
            </div>

            {/* Features Grid */}
            <section className="max-w-7xl mx-auto px-4 py-20">
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                    <div className="bg-zinc-900 rounded-[2.5rem] p-8 border border-zinc-800 hover:border-[#E0FF20] transition-colors group">
                        <div className="w-14 h-14 bg-[#E0FF20] rounded-2xl flex items-center justify-center mb-6 text-black group-hover:rotate-12 transition-transform">
                            <Zap size={28} fill="currentColor"/>
                        </div>
                        <h3 className="text-2xl font-black mb-2 font-display uppercase">Instant Payouts</h3>
                        <p className="text-zinc-400">Get paid directly to your bank account via Stripe or Square. No waiting for the event to end.</p>
                    </div>
                    
                    <div className="bg-zinc-900 rounded-[2.5rem] p-8 border border-zinc-800 hover:border-[#ff00ff] transition-colors group">
                         <div className="w-14 h-14 bg-[#ff00ff] rounded-2xl flex items-center justify-center mb-6 text-white group-hover:-rotate-12 transition-transform">
                            <Star size={28} fill="currentColor"/>
                        </div>
                        <h3 className="text-2xl font-black mb-2 font-display uppercase">Premium Brand</h3>
                        <p className="text-zinc-400">Customize your event page with your colors, logo, and custom domain. Make it yours.</p>
                    </div>

                    <div className="bg-zinc-900 rounded-[2.5rem] p-8 border border-zinc-800 hover:border-[#00ff9d] transition-colors group">
                         <div className="w-14 h-14 bg-[#00ff9d] rounded-2xl flex items-center justify-center mb-6 text-black group-hover:scale-110 transition-transform">
                            <CheckCircle2 size={28}/>
                        </div>
                        <h3 className="text-2xl font-black mb-2 font-display uppercase">Easy Check-in</h3>
                        <p className="text-zinc-400">Scan tickets at the door with any device using our ultra-fast check-in portal.</p>
                    </div>
                </div>
            </section>

            {/* Big CTA */}
            <section className="py-32 px-4 text-center relative overflow-hidden">
                 <div className="absolute top-0 left-0 w-full h-full bg-[url('https://www.transparenttextures.com/patterns/cubes.png')] opacity-10"></div>
                 <div className="relative z-10">
                     <h2 className="text-6xl md:text-8xl font-black font-display tracking-tighter mb-8 leading-none">
                        READY TO <span className="text-transparent bg-clip-text bg-gradient-to-br from-[#E0FF20] to-[#ff00ff]">POP?</span>
                     </h2>
                     <button onClick={() => navigate('/auth')} className="px-12 py-6 bg-white text-black font-black text-2xl rounded-full hover:bg-[#E0FF20] transition-colors shadow-2xl">
                         CREATE EVENT FREE
                     </button>
                 </div>
            </section>

             {/* Footer */}
            <footer className="bg-zinc-900 border-t border-zinc-800 pt-20 pb-10 px-4 mt-20">
                <div className="max-w-7xl mx-auto grid grid-cols-1 md:grid-cols-4 gap-12 mb-16">
                    <div className="col-span-1 md:col-span-2">
                        <div className="text-2xl font-black font-display tracking-tighter mb-4">
                            OPEN<span className="text-[#E0FF20]">TICKET</span>
                        </div>
                        <p className="text-zinc-500 max-w-sm">
                            The future of event ticketing. Built for creators, organizers, and party-starters who demand more control and less fees.
                        </p>
                    </div>
                    <div>
                        <h4 className="font-bold text-white mb-6 uppercase tracking-wider">Platform</h4>
                        <ul className="space-y-4 text-zinc-400">
                            <li><button onClick={() => navigate('/browse')} className="hover:text-[#E0FF20] transition-colors">Explore Events</button></li>
                            <li><button onClick={() => navigate('/pricing')} className="hover:text-[#E0FF20] transition-colors">Pricing</button></li>
                            <li><button onClick={() => navigate('/auth')} className="hover:text-[#E0FF20] transition-colors">Sign In</button></li>
                            <li><button onClick={() => navigate('/auth')} className="hover:text-[#E0FF20] transition-colors">Start Selling</button></li>
                            <li><button onClick={() => navigate('/affiliate-login')} className="hover:text-[#E0FF20] transition-colors text-[#E0FF20]">Affiliate Program</button></li>
                        </ul>
                    </div>
                    <div>
                        <h4 className="font-bold text-white mb-6 uppercase tracking-wider">Support</h4>
                        <ul className="space-y-4 text-zinc-400">
                            <li><button onClick={() => navigate('/contact')} className="hover:text-[#E0FF20] transition-colors">Contact Us</button></li>
                            <li><button onClick={() => navigate('/refunds')} className="hover:text-[#E0FF20] transition-colors">Refund Policy</button></li>
                            <li><Link to="/terms" className="hover:text-[#E0FF20] transition-colors">Terms of Service</Link></li>
                            <li><Link to="/privacy" className="hover:text-[#E0FF20] transition-colors">Privacy Policy</Link></li>
                        </ul>
                    </div>
                </div>
                <div className="max-w-7xl mx-auto border-t border-zinc-800 pt-8 flex flex-col md:flex-row justify-between items-center gap-4 text-zinc-600 text-sm">
                    <p>&copy; {new Date().getFullYear()} OpenTicket. All rights reserved.</p>
                    <div className="flex gap-6">
                        <a href="#" className="hover:text-white transition-colors"><Instagram size={20}/></a>
                        <a href="#" className="hover:text-white transition-colors"><Twitter size={20}/></a>
                        <a href="#" className="hover:text-white transition-colors"><Linkedin size={20}/></a>
                    </div>
                </div>
            </footer>
        </div>
    );
};
