
import React, { useState, useEffect } from 'react';
import { HashRouter, Routes, Route, Link, useLocation, useNavigate } from 'react-router-dom';
import { Plus, Ticket, User, LayoutDashboard, Settings as SettingsIcon, Home as HomeIcon, Search, Sun, Moon, LogOut, Gift, Loader2, WifiOff, Info, Bell, Shield, X } from 'lucide-react';
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
import { SubscriptionSuccess } from './components/SubscriptionSuccess';
import { Terms } from './components/Terms';
import { PrivacyPolicy } from './components/PrivacyPolicy';
import { MobileTicketView } from './components/MobileTicketView';
import { InstallPrompt } from './components/InstallPrompt';
import { AdvancedAnalytics } from './components/AdvancedAnalytics';
import { EmailMarketing } from './components/EmailMarketing';
import { NonprofitUpgrade } from './components/NonprofitUpgrade';
import { EnterpriseContact } from './components/EnterpriseContact';
import { StorageService } from './services/storageService';
import { ErrorBoundary } from './components/ErrorBoundary';
import { GlobalUIProvider, useGlobalUI } from './components/GlobalUIProvider';
import { ConfirmProvider } from './components/ConfirmContext';
import { NotificationService } from './services/notificationService';
import { CurrencySelector } from './components/CurrencySelector';
import { UserNotification } from './types';

const Layout = ({ children }: { children?: React.ReactNode }) => {
    const navigate = useNavigate();
    const location = useLocation();
    const user = StorageService.getCurrentUser();
    const isOrganizer = user?.role === 'organizer' || user?.isAdmin;
    const hasAffiliateCode = !!user?.affiliateCode;
    const isAffiliateOnly = user?.role === 'affiliate' && !isOrganizer;
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

    // Handle Stripe return redirect - redirect to event page with session params
    useEffect(() => {
        const params = new URLSearchParams(window.location.search);
        const stripeReturn = params.get('stripe_return');
        const eventId = params.get('event_id');
        const sessionId = params.get('session_id');
        const success = params.get('success');
        
        if (stripeReturn === 'true' && eventId) {
            // Build the event URL with success params
            let eventUrl = `/#/event/${eventId}`;
            if (success === 'true' && sessionId) {
                eventUrl += `?success=true&session_id=${sessionId}`;
            } else if (params.get('canceled') === 'true') {
                eventUrl += `?canceled=true`;
            }
            
            // Redirect to event page
            window.location.href = eventUrl;
        }
    }, []);

    // Global UI & Notifications
    const { showAlert, showConfirm } = useGlobalUI();
    const [notifications, setNotifications] = useState<UserNotification[]>([]);
    const [showNotifDropdown, setShowNotifDropdown] = useState(false);
    
    // Super Admin Panel State (only for the single super admin)
    const [showSuperAdminPanel, setShowSuperAdminPanel] = useState(false);

    useEffect(() => {
        // Override window.alert
        window.alert = (msg) => showAlert({ title: "Notice", message: String(msg) });

        // Override window.confirm
        window.confirm = (msg) => {
            // We can't actually make window.confirm sync with a React modal easily without returning a Promise
            // and using async/await everywhere. For now, since we want to avoid refactoring EVERY confirm call,
            // we will keep it as is IF we want sync behavior, OR we encourage use of useGlobalUI.
            // Actually, a better way is to provide showConfirm via context and use that.
            // But let's try to override it anyway for simple cases if possible, though it's problematic for sync.

            // Reverting the idea of overriding confirm because it's synchronous and React modals are not.
            // We will refactor the calls to useGlobalUI.showConfirm instead.
            return true;
        };
        // Restore window.confirm to native for now to avoid breaking sync logic
        delete (window as any).confirm;
    }, [showAlert]);

    useEffect(() => {
        if (user) {
            NotificationService.getNotifications(user.id).then(setNotifications);
            const interval = setInterval(() => {
                NotificationService.getNotifications(user.id).then(setNotifications);
            }, 30000);
            return () => clearInterval(interval);
        }
    }, [user?.id, location.pathname]);

    const unreadCount = notifications.filter(n => !n.read).length;

    const toggleTheme = () => {
        const newTheme = !isDark;
        setIsDark(newTheme);
        localStorage.setItem('openticket_theme', newTheme ? 'dark' : 'light');
    };

    const handleLogout = () => {
        showConfirm({
            title: "Sign Out",
            message: "Are you sure you want to log out of your account?",
            confirmText: "Log Out",
            variant: "danger",
            onConfirm: async () => {
                try {
                    await StorageService.logout();
                } finally {
                    window.location.href = '/';
                }
            }
        });
    };

    useEffect(() => {
        window.scrollTo(0, 0);
    }, [location.pathname]);

    // Handle Stripe Connect redirect
    useEffect(() => {
        const urlParams = new URLSearchParams(window.location.search);
        const stripeConnect = urlParams.get('stripe_connect');
        const redirect = urlParams.get('redirect');
        
        if (stripeConnect === 'success' && redirect === 'settings') {
            // Clear URL params and redirect to settings
            window.history.replaceState({}, '', window.location.pathname);
            navigate('/settings');
        } else if (stripeConnect === 'refresh' && redirect === 'settings') {
            // Onboarding incomplete, redirect to settings anyway
            window.history.replaceState({}, '', window.location.pathname);
            navigate('/settings');
        }
    }, [navigate]);

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
                                        {/* Notification Bell */}
                                        <div className="relative">
                                            <button
                                                onClick={() => setShowNotifDropdown(!showNotifDropdown)}
                                                className="p-2 text-zinc-500 dark:text-zinc-400 hover:text-zinc-900 dark:hover:text-white relative"
                                            >
                                                <Bell size={20} />
                                                {unreadCount > 0 && (
                                                    <span className="absolute top-1 right-1 w-2.5 h-2.5 bg-red-500 rounded-full border-2 border-white dark:border-black"></span>
                                                )}
                                            </button>

                                            {showNotifDropdown && (
                                                <>
                                                    <div className="fixed inset-0 z-30" onClick={() => setShowNotifDropdown(false)}></div>
                                                    <div className="absolute top-full right-0 mt-2 w-80 bg-white dark:bg-zinc-900 rounded-xl shadow-2xl border border-zinc-200 dark:border-zinc-800 z-40 overflow-hidden animate-in fade-in zoom-in-95">
                                                        <div className="p-3 border-b border-zinc-100 dark:border-zinc-800 flex justify-between items-center">
                                                            <span className="text-xs font-bold uppercase text-zinc-500">Notifications</span>
                                                            {unreadCount > 0 && <span className="text-xs font-bold text-red-500">{unreadCount} new</span>}
                                                        </div>
                                                        <div className="max-h-64 overflow-y-auto">
                                                            {notifications.length === 0 ? (
                                                                <div className="p-8 text-center text-zinc-400 text-xs">No notifications</div>
                                                            ) : (
                                                                notifications.map(n => (
                                                                    <div key={n.id} onClick={async () => {
                                                                        if (!n.read) {
                                                                            await NotificationService.markAsRead(n.id);
                                                                            setNotifications(prev => prev.map(x => x.id === n.id ? { ...x, read: true } : x));
                                                                        }
                                                                    }} className={`p-3 border-b border-zinc-50 dark:border-zinc-800/50 hover:bg-zinc-50 dark:hover:bg-zinc-800/50 cursor-pointer transition-colors ${!n.read ? 'bg-blue-50/50 dark:bg-blue-900/10' : ''}`}>
                                                                        <div className="font-bold text-sm mb-1">{n.title}</div>
                                                                        <div className="text-xs text-zinc-500">{n.message}</div>
                                                                        <div className="text-[10px] text-zinc-400 mt-2">{new Date(n.timestamp).toLocaleDateString()}</div>
                                                                    </div>
                                                                ))
                                                            )}
                                                        </div>
                                                    </div>
                                                </>
                                            )}
                                        </div>

                                        {user?.isAdmin && (
                                            <button 
                                                onClick={() => setShowSuperAdminPanel(true)} 
                                                className="text-sm font-bold text-red-500 hover:text-red-600 flex items-center gap-1 bg-red-500/10 px-3 py-1 rounded-full transition-all hover:bg-red-500/20"
                                                data-testid="super-admin-toggle-btn"
                                            >
                                                <Shield size={14} /> Super Admin
                                            </button>
                                        )}
                                        {isOrganizer && <Link to="/dashboard" className="text-sm font-bold text-zinc-600 dark:text-zinc-300 hover:text-secondary">Dashboard</Link>}
                                        {isAffiliateOnly && <Link to="/affiliate" className="text-sm font-bold text-zinc-600 dark:text-zinc-300 hover:text-secondary">Affiliate Dashboard</Link>}
                                        <Link to="/my-tickets" className="text-sm font-bold text-zinc-600 dark:text-zinc-300 hover:text-secondary">My Tickets</Link>
                                        <div className="h-4 w-px bg-zinc-300 dark:bg-zinc-700"></div>
                                        <Link to="/settings" className="text-zinc-500 dark:text-zinc-400 hover:text-secondary" title="Settings"><SettingsIcon size={20} /></Link>
                                        <CurrencySelector compact className="hidden md:block" />
                                        <button onClick={handleLogout} className="text-zinc-500 dark:text-zinc-400 hover:text-red-500" title="Logout"><LogOut size={20} /></button>
                                        {isOrganizer && (
                                            <button onClick={() => navigate('/create')} className="bg-secondary text-black px-4 py-2 rounded-full font-bold text-sm hover:bg-[#d2f800] transition-colors shadow-lg">
                                                + Create Event
                                            </button>
                                        )}
                                    </>
                                ) : (
                                    <div className="flex items-center space-x-4">
                                        <CurrencySelector compact className="hidden md:block" />
                                        <Link to="/auth" className="bg-white dark:bg-white text-black px-5 py-2 rounded-full font-bold text-sm hover:bg-zinc-200 transition-colors shadow-lg border border-zinc-200 dark:border-transparent">Sign In</Link>
                                    </div>
                                )}
                            </div>

                            <div className="md:hidden flex items-center gap-2">
                                <CurrencySelector compact />
                                {user?.isAdmin && (
                                    <button 
                                        onClick={() => setShowSuperAdminPanel(true)} 
                                        className="p-2 rounded-full bg-red-500/10 text-red-500"
                                        data-testid="mobile-super-admin-btn"
                                    >
                                        <Shield size={20} />
                                    </button>
                                )}
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

            {/* Super Admin Panel Overlay - Full screen modal for single super admin */}
            {showSuperAdminPanel && user?.isAdmin && (
                <div className="fixed inset-0 z-[100] bg-black/95 backdrop-blur-sm animate-in fade-in duration-200" data-testid="super-admin-panel">
                    <div className="h-full overflow-auto">
                        {/* Header with close button */}
                        <div className="sticky top-0 z-10 bg-black/90 backdrop-blur-md border-b border-zinc-800 px-6 py-4 flex items-center justify-between">
                            <div className="flex items-center gap-3">
                                <div className="w-10 h-10 bg-red-500/20 rounded-xl flex items-center justify-center">
                                    <Shield size={20} className="text-red-500" />
                                </div>
                                <div>
                                    <h1 className="text-xl font-black text-white">Super Admin Panel</h1>
                                    <p className="text-xs text-zinc-500">Platform-wide management</p>
                                </div>
                            </div>
                            <button 
                                onClick={() => setShowSuperAdminPanel(false)}
                                className="p-3 hover:bg-zinc-800 rounded-xl transition-colors text-zinc-400 hover:text-white"
                                data-testid="close-super-admin-btn"
                            >
                                <X size={24} />
                            </button>
                        </div>
                        {/* Embedded SuperAdminDashboard content */}
                        <div className="p-0">
                            <SuperAdminDashboard embedded={true} />
                        </div>
                    </div>
                </div>
            )}

            {/* PWA Install Prompt */}
            <InstallPrompt />
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
                <Route path="/privacy" element={<PrivacyPolicy />} />
                <Route path="/admin" element={<SuperAdminDashboard />} />
                <Route path="/dashboard" element={<Dashboard />} />
                <Route path="/analytics" element={<AdvancedAnalytics />} />
                <Route path="/email-marketing" element={<EmailMarketing />} />
                <Route path="/manage/:id" element={<ManageEvent />} />
                <Route path="/manage/:id/attendees" element={<AttendeeManager />} />
                <Route path="/manage/:id/marketing" element={<EventMarketing />} />
                <Route path="/manage/:id/analytics" element={<EventAnalytics />} />
                <Route path="/manage/:id/settings" element={<EventSettings />} />
                <Route path="/manage/:id/addons" element={<AddOnManager />} />
                <Route path="/manage/:id/finance" element={<EventFinance />} />
                <Route path="/my-tickets" element={<MyTickets />} />
                <Route path="/ticket/:registrationId" element={<MobileTicketView />} />
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
                <Route path="/nonprofit-upgrade" element={<NonprofitUpgrade />} />
                <Route path="/subscription-success" element={<SubscriptionSuccess />} />
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
            <GlobalUIProvider>
                <ConfirmProvider>
                    <HashRouter future={{ v7_startTransition: true, v7_relativeSplatPath: true }}>
                        <MainContent />
                    </HashRouter>
                </ConfirmProvider>
            </GlobalUIProvider>
        </ErrorBoundary>
    );
};

export default App;
