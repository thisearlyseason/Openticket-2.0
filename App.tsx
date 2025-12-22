
import React, { useState, useEffect } from 'react';
import { HashRouter, Routes, Route, Link, useLocation, useNavigate } from 'react-router-dom';
import { Plus, Ticket, User, LayoutDashboard, Settings as SettingsIcon, Home as HomeIcon, Search, Sun, Moon, LogOut, Gift, Loader2, WifiOff, Info } from 'lucide-react';
import { EventBuilder } from './components/EventBuilder';
import { EventView } from './components/EventView';
import { Dashboard } from './components/Dashboard';
import { ManageEvent } from './components/ManageEvent';
import { Home } from './components/Home';
import { Auth } from './components/Auth';
import { AffiliateAuth } from './components/AffiliateAuth';
import { OrganizerProfile } from './components/OrganizerProfile';
import { Settings } from './components/Settings';
import { MyTickets } from './components/MyTickets';
import { Pricing } from './components/Pricing';
import { Billing } from './components/Billing';
import { LandingPage } from './components/LandingPage';
import { Contact } from './components/Contact';
import { CheckInPortal } from './components/CheckInPortal';
import { RefundsPage } from './components/RefundsPage';
import { AffiliateDashboard } from './components/AffiliateDashboard';
import { AttendeeManager } from './components/AttendeeManager';
import { EventMarketing } from './components/EventMarketing';
import { EventAnalytics } from './components/EventAnalytics';
import { EventSettings } from './components/EventSettings';
import { AddOnManager } from './components/AddOnManager';
import { EventFinance } from './components/EventFinance';
import { SuperAdminDashboard } from './components/SuperAdminDashboard';
import { Terms } from './components/Terms';
import { StorageService } from './services/storageService';
import { ErrorBoundary } from './components/ErrorBoundary';

const Layout = ({ children }: { children?: React.ReactNode }) => {
    const navigate = useNavigate();
    const location = useLocation();
    const user = StorageService.getCurrentUser();
    const isOrganizer = user?.role === 'organizer' || user?.isAdmin;
    const isAffiliate = user?.role === 'affiliate' || user?.isAdmin;
    const isOffline = StorageService.isOfflineMode();
    const isDemoMode = StorageService.isDemoMode();

    const isEmbed = window.location.hash.includes('embed=true');
    const isLanding = location.pathname === '/';
    const isAffiliateAuth = location.pathname === '/affiliate-login';

    const [isDark, setIsDark] = useState(() => {
        const savedTheme = localStorage.getItem('openticket_theme');
        return savedTheme ? savedTheme === 'dark' : true;
    });

    useEffect(() => {
        const primaryColor = user?.primaryColor;
        if (primaryColor) {
            document.documentElement.style.setProperty('--color-primary', primaryColor);
        } else {
            document.documentElement.style.removeProperty('--color-primary');
        }
    }, [user?.primaryColor]);

    useEffect(() => {
        if (isDark) {
            document.documentElement.classList.add('dark');
            document.documentElement.classList.remove('light');
        } else {
            document.documentElement.classList.remove('dark');
            document.documentElement.classList.add('light');
        }
    }, [isDark]);

    const toggleTheme = () => {
        const newTheme = !isDark;
        setIsDark(newTheme);
        localStorage.setItem('openticket_theme', newTheme ? 'dark' : 'light');
    };

    const handleLogout = async () => {
        try {
            await StorageService.logout();
        } finally {
            window.location.href = '/';
        }
    };

    useEffect(() => {
        window.scrollTo(0, 0);
    }, [location.pathname]);

    return (
        <div className={`min-h-screen bg-background text-zinc-900 dark:text-white flex flex-col font-sans selection:bg-secondary selection:text-black relative overflow-x-hidden transition-colors duration-300 ${isEmbed ? 'bg-transparent' : ''}`}>

            {!isLanding && !isEmbed && !isAffiliateAuth && (
                <div className="fixed inset-0 z-0 pointer-events-none overflow-hidden">
                    <div className="absolute top-[-10%] right-[-10%] w-[500px] h-[500px] bg-primary rounded-full mix-blend-screen filter blur-[100px] opacity-20 animate-blob"></div>
                    <div className="absolute bottom-[-10%] left-[-10%] w-[500px] h-[500px] bg-secondary rounded-full mix-blend-screen filter blur-[100px] opacity-20 animate-blob animation-delay-2000"></div>
                    <div className="absolute inset-0 bg-[url('https://www.transparenttextures.com/patterns/cubes.png')] opacity-[0.03]"></div>
                </div>
            )}

            {(isOffline || isDemoMode) && !isLanding && !isEmbed && !isAffiliateAuth && (
                <div className={`${isDemoMode ? 'bg-blue-600 text-white' : 'bg-yellow-400 text-black'} text-xs font-bold py-1 px-4 text-center sticky top-0 z-[60] flex items-center justify-center gap-2`}>
                    {isDemoMode ? <Info size={14} /> : <WifiOff size={14} />}
                    <span>
                        {isDemoMode
                            ? "DEMO MODE — Firebase backend is not enabled. Saving data locally."
                            : "OFFLINE MODE — Connection to backend failed. Using local storage."}
                    </span>
                    <button onClick={() => alert(StorageService.getLastError()?.message)} className="underline ml-2 opacity-80 hover:opacity-100 uppercase text-[10px]">Details</button>
                </div>
            )}

            {!isLanding && !isEmbed && !isAffiliateAuth && (
                <nav className={`fixed left-0 right-0 z-50 glass ${isOffline || isDemoMode ? 'top-6' : 'top-0'}`}>
                    <div className="max-w-7xl mx-auto px-4">
                        <div className="flex justify-between items-center h-16">
                            <Link to={user ? "/browse" : "/"} className="flex items-center space-x-2 group">
                                <div className="w-8 h-8 bg-secondary rounded-lg flex items-center justify-center rotate-3 group-hover:rotate-12 transition-transform shadow-[0_0_15px_rgba(224,255,32,0.5)]">
                                    <Ticket className="text-black w-5 h-5" />
                                </div>
                                <span className="text-xl font-bold font-display tracking-tight text-zinc-900 dark:text-white">
                                    Open<span className="text-secondary">Ticket</span>
                                </span>
                            </Link>

                            <div className="hidden md:flex items-center space-x-6">
                                <Link to="/pricing" className="text-sm font-bold text-zinc-600 dark:text-zinc-300 hover:text-secondary transition-colors">Pricing</Link>
                                <Link to="/browse" className="text-sm font-bold text-zinc-600 dark:text-zinc-300 hover:text-secondary transition-colors">Explore</Link>

                                <button onClick={toggleTheme} className="p-2 rounded-full hover:bg-black/5 dark:hover:bg-white/10" aria-label="Toggle Theme">
                                    {isDark ? <Sun size={20} className="text-yellow-400" /> : <Moon size={20} className="text-zinc-600" />}
                                </button>

                                {user ? (
                                    <>
                                        {isOrganizer && <Link to="/dashboard" className="text-sm font-bold text-zinc-600 dark:text-zinc-300 hover:text-secondary">Dashboard</Link>}
                                        <Link to="/my-tickets" className="text-sm font-bold text-zinc-600 dark:text-zinc-300 hover:text-secondary">My Tickets</Link>
                                        <div className="h-4 w-px bg-zinc-300 dark:bg-zinc-700"></div>
                                        {(isAffiliate || isOrganizer) && <Link to="/affiliate" className="text-zinc-500 dark:text-zinc-400 hover:text-secondary" title="Affiliate Program"><Gift size={20} /></Link>}
                                        <Link to="/settings" className="text-zinc-500 dark:text-zinc-400 hover:text-secondary" title="Settings"><SettingsIcon size={20} /></Link>
                                        <button onClick={handleLogout} className="text-zinc-500 dark:text-zinc-400 hover:text-red-500" title="Logout"><LogOut size={20} /></button>
                                        {isOrganizer && (
                                            <button onClick={() => navigate('/create')} className="bg-secondary text-black px-4 py-2 rounded-full font-bold text-sm hover:bg-[#d2f800] transition-colors shadow-lg">
                                                + Create Event
                                            </button>
                                        )}
                                    </>
                                ) : (
                                    <div className="flex items-center space-x-4">
                                        <Link to="/pricing" className="text-sm font-bold text-zinc-600 dark:text-zinc-300 hover:text-secondary">Pricing</Link>
                                        <Link to="/auth" className="bg-white dark:bg-white text-black px-5 py-2 rounded-full font-bold text-sm hover:bg-zinc-200 transition-colors shadow-lg border border-zinc-200 dark:border-transparent">Sign In</Link>
                                    </div>
                                )}
                            </div>

                            <div className="md:hidden flex items-center gap-2">
                                <button onClick={toggleTheme} className="p-2 rounded-full hover:bg-black/5 dark:hover:bg-white/10">
                                    {isDark ? <Sun size={20} className="text-yellow-400" /> : <Moon size={20} className="text-zinc-600" />}
                                </button>
                            </div>
                        </div>
                    </div>
                </nav>
            )}

            <main className={`flex-1 w-full ${isLanding && !isEmbed ? 'p-0' : isEmbed ? 'p-0' : isAffiliateAuth ? 'p-0' : 'max-w-7xl mx-auto px-4 pt-24 pb-24 md:pb-12'} relative z-10`}>
                {children}
            </main>

            {!isLanding && !isEmbed && !isAffiliateAuth && (
                <div className="md:hidden fixed bottom-0 left-0 right-0 glass border-t border-white/5 z-50 pb-safe">
                    <div className="flex justify-around items-center h-16 text-xs font-medium">
                        <Link to="/browse" className={`flex flex-col items-center justify-center w-full h-full ${location.pathname === '/browse' ? 'text-secondary' : 'text-zinc-500 dark:text-zinc-400'}`}>
                            <HomeIcon size={24} strokeWidth={location.pathname === '/browse' ? 3 : 2} />
                        </Link>

                        {user ? (
                            <>
                                <Link to="/my-tickets" className={`flex flex-col items-center justify-center w-full h-full ${location.pathname === '/my-tickets' ? 'text-secondary' : 'text-zinc-500 dark:text-zinc-400'}`}>
                                    <Ticket size={24} strokeWidth={location.pathname === '/my-tickets' ? 3 : 2} />
                                </Link>

                                {isOrganizer ? (
                                    <div className="relative -top-5">
                                        <button onClick={() => navigate('/create')} className="w-14 h-14 bg-secondary rounded-full flex items-center justify-center text-black shadow-[0_0_15px_rgba(210,248,0,0.4)] border-4 border-background">
                                            <Plus size={28} strokeWidth={3} />
                                        </button>
                                    </div>
                                ) : (
                                    <div className="w-10"></div>
                                )}

                                {isOrganizer ? (
                                    <Link to="/dashboard" className={`flex flex-col items-center justify-center w-full h-full ${location.pathname === '/dashboard' ? 'text-secondary' : 'text-zinc-500 dark:text-zinc-400'}`}>
                                        <LayoutDashboard size={24} strokeWidth={location.pathname === '/dashboard' ? 3 : 2} />
                                    </Link>
                                ) : (
                                    <Link to="/settings" className={`flex flex-col items-center justify-center w-full h-full ${location.pathname === '/settings' ? 'text-secondary' : 'text-zinc-500 dark:text-zinc-400'}`}>
                                        <User size={24} strokeWidth={location.pathname === '/settings' ? 3 : 2} />
                                    </Link>
                                )}

                                {isOrganizer && (
                                    <Link to="/settings" className={`flex flex-col items-center justify-center w-full h-full ${location.pathname === '/settings' ? 'text-secondary' : 'text-zinc-500 dark:text-zinc-400'}`}>
                                        <SettingsIcon size={24} strokeWidth={location.pathname === '/settings' ? 3 : 2} />
                                    </Link>
                                )}
                            </>
                        ) : (
                            <Link to="/auth" className={`flex flex-col items-center justify-center w-full h-full ${location.pathname === '/auth' ? 'text-secondary' : 'text-zinc-500 dark:text-zinc-400'}`}>
                                <User size={24} />
                            </Link>
                        )}
                    </div>
                </div>
            )}
        </div>
    );
};

const MainContent = () => {
    const location = useLocation();

    return (
        <Layout>
            <Routes>
                <Route path="/" element={<LandingPage />} />
                <Route path="/browse" element={<Home />} />
                <Route path="/contact" element={<Contact />} />
                <Route path="/refunds" element={<RefundsPage />} />
                <Route path="/terms" element={<Terms />} />
                <Route path="/privacy" element={<Terms />} />
                <Route path="/admin" element={<SuperAdminDashboard />} />
                <Route path="/dashboard" element={<Dashboard />} />
                <Route path="/manage/:id" element={<ManageEvent />} />
                <Route path="/manage/:id/attendees" element={<AttendeeManager />} />
                <Route path="/manage/:id/marketing" element={<EventMarketing />} />
                <Route path="/manage/:id/analytics" element={<EventAnalytics />} />
                <Route path="/manage/:id/settings" element={<EventSettings />} />
                <Route path="/manage/:id/addons" element={<AddOnManager />} />
                <Route path="/manage/:id/finance" element={<EventFinance />} />
                <Route path="/my-tickets" element={<MyTickets />} />
                <Route path="/pricing" element={<Pricing />} />
                <Route path="/billing" element={<Billing />} />
                <Route path="/checkin/:id" element={<CheckInPortal />} />
                <Route path="/affiliate" element={<AffiliateDashboard />} />
                <Route path="/affiliate-login" element={<AffiliateAuth />} />
                <Route path="/create" element={<EventBuilder key={location.key} />} />
                <Route path="/edit/:id" element={<EventBuilder key={location.key} />} />
                <Route path="/event/:id" element={<EventView />} />
                <Route path="/auth" element={<Auth />} />
                <Route path="/organizer/:id" element={<OrganizerProfile />} />
                <Route path="/settings" element={<Settings />} />
            </Routes>
        </Layout>
    );
};

const App = () => {
    const [isInitializing, setIsInitializing] = useState(true);

    useEffect(() => {
        const initApp = async () => {
            try {
                await StorageService.init();
            } catch (e: any) {
                console.error("Initialization error:", e);
            } finally {
                setIsInitializing(false);
            }
        };
        initApp();
    }, []);

    if (isInitializing) {
        return (
            <div className="min-h-screen bg-zinc-50 dark:bg-black flex items-center justify-center">
                <Loader2 size={48} className="animate-spin text-primary" />
            </div>
        );
    }

    return (
        <ErrorBoundary>
            <HashRouter future={{ v7_startTransition: true, v7_relativeSplatPath: true }}>
                <MainContent />
            </HashRouter>
        </ErrorBoundary>
    );
};

export default App;
