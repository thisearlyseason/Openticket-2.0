
import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { StorageService } from '../services/storageService';
import { Button, Input, Card, FileDropZone, Badge, Switch, Select } from './UI';
import { 
    Save, User, CreditCard, Users, Lock, LogOut, Gift, 
    Globe, Instagram, Facebook, Twitter, Camera, AlertTriangle, 
    Monitor, Briefcase, Mail, CheckCircle2, ChevronRight, HelpCircle,
    Palette, BarChart3, MessageSquare, DollarSign, Key, ArrowLeft, Crown, Calendar, MapPin
} from 'lucide-react';
import { User as UserType } from '../types';

interface SettingsTab {
    id: string;
    label: string;
    icon: React.ElementType;
    description: string;
    roles: string[]; // 'attendee' | 'affiliate' | 'organizer' | 'admin'
}

const TABS: SettingsTab[] = [
    { id: 'profile', label: 'Personal Profile', icon: User, description: 'Manage your avatar, name, and contact details', roles: ['attendee', 'affiliate', 'organizer', 'admin'] },
    { id: 'org', label: 'Organization Details', icon: Briefcase, description: 'Event business details and social links', roles: ['organizer', 'admin'] },
    { id: 'billing', label: 'Subscription', icon: CreditCard, description: 'Manage your platform plan', roles: ['organizer', 'admin'] },
    { id: 'branding', label: 'Branding & Theme', icon: Palette, description: 'Customize your event page look', roles: ['organizer', 'admin'] },
    { id: 'payouts', label: 'Payouts', icon: DollarSign, description: 'Connect Stripe to get paid', roles: ['organizer', 'affiliate', 'admin'] },
    { id: 'team', label: 'Team Members', icon: Users, description: 'Manage access for your staff', roles: ['organizer', 'admin'] },
    { id: 'analytics', label: 'Tracking & Pixels', icon: BarChart3, description: 'Tracking pixels and analytics', roles: ['organizer', 'admin'] },
    { id: 'security', label: 'Security', icon: Lock, description: 'Password and session management', roles: ['attendee', 'affiliate', 'organizer', 'admin'] },
];

export const Settings = () => {
    const navigate = useNavigate();
    const isMobile = window.innerWidth < 1024;
    const [activeTab, setActiveTab] = useState<string | null>(isMobile ? null : 'profile');
    const [isLoading, setIsLoading] = useState(true);
    const [isSaving, setIsSaving] = useState(false);
    
    // User State
    const [user, setUser] = useState<UserType | null>(null);
    
    // Form States
    const [name, setName] = useState('');
    const [email, setEmail] = useState('');
    const [logoUrl, setLogoUrl] = useState('');
    const [headerUrl, setHeaderUrl] = useState('');
    
    // Org
    const [businessName, setBusinessName] = useState('');
    const [website, setWebsite] = useState('');
    const [instagram, setInstagram] = useState('');
    const [facebook, setFacebook] = useState('');
    const [twitter, setTwitter] = useState('');
    
    // Branding
    const [primaryColor, setPrimaryColor] = useState('#ec4899');

    // Analytics
    const [gaPixel, setGaPixel] = useState('');
    const [fbPixel, setFbPixel] = useState('');

    // Payouts
    const [stripeId, setStripeId] = useState('');
    
    // Prefs
    const [desktopCamera, setDesktopCamera] = useState(false);

    // Team
    const [newMemberName, setNewMemberName] = useState('');
    const [newMemberEmail, setNewMemberEmail] = useState('');

    // Plan check
    const isPro = user?.subscription?.plan === 'pro' || user?.subscription?.plan === 'premium' || user?.isAdmin;

    useEffect(() => {
        loadUserData();
        const handleResize = () => {
            if (window.innerWidth >= 1024 && !activeTab) {
                setActiveTab('profile');
            }
        };
        window.addEventListener('resize', handleResize);
        return () => window.removeEventListener('resize', handleResize);
    }, []);

    const loadUserData = async () => {
        setIsLoading(true);
        const currentUser = StorageService.getCurrentUser();
        if (!currentUser) {
            navigate('/auth');
            return;
        }

        // SAFE_UPDATE: Handle potential null return from getUserById
        let freshUser: UserType | undefined | null = null;
        try {
            freshUser = await StorageService.getUserById(currentUser.id);
        } catch (e) {
            console.error("Failed to load detailed user data", e);
        }

        const effectiveUser = freshUser || currentUser; // Fallback to local session data if DB fetch fails

        if (effectiveUser) {
            setUser(effectiveUser);
            // Hydrate state
            setName(effectiveUser.name || '');
            setEmail(effectiveUser.email || '');
            setLogoUrl(effectiveUser.logoUrl || '');
            setHeaderUrl(effectiveUser.headerImageUrl || '');
            setBusinessName(effectiveUser.businessName || '');
            setWebsite(effectiveUser.socials?.website || '');
            setInstagram(effectiveUser.socials?.instagram || '');
            setFacebook(effectiveUser.socials?.facebook || '');
            setTwitter(effectiveUser.socials?.x || '');
            setStripeId(effectiveUser.stripeConnectId || '');
            setPrimaryColor(effectiveUser.primaryColor || '#ec4899');
            
            const pixels = effectiveUser.trackingPixels || {};
            setGaPixel(pixels.ga || '');
            setFbPixel(pixels.fb || '');
            
            setDesktopCamera(localStorage.getItem('openticket_desktop_camera') === 'true');
        } else {
            // Should theoretically never happen if currentUser exists, but just in case
            navigate('/auth');
        }
        setIsLoading(false);
    };

    const handleSave = async () => {
        if (!user) return;
        setIsSaving(true);
        try {
            await StorageService.updateUser(user.id, {
                name,
                logoUrl,
                headerImageUrl: headerUrl,
                businessName,
                stripeConnectId: stripeId,
                primaryColor,
                socials: { website, instagram, facebook, x: twitter },
                trackingPixels: { ga: gaPixel, fb: fbPixel }
            });
            
            localStorage.setItem('openticket_desktop_camera', String(desktopCamera));
            document.documentElement.style.setProperty('--color-primary', primaryColor);

            const btn = document.getElementById('save-btn');
            if(btn) {
                const originalText = btn.innerText;
                btn.innerText = "Saved!";
                setTimeout(() => btn.innerText = originalText, 2000);
            }
        } catch (e) {
            alert("Failed to save settings.");
        } finally {
            setIsSaving(false);
        }
    };

    const handleAddTeamMember = async () => {
        if (!user || !newMemberEmail) return;
        const newMember = {
            id: `tm-${Date.now()}`,
            name: newMemberName || 'Team Member',
            email: newMemberEmail,
            role: 'editor' as const
        };
        const updatedTeam = [...(user.teamMembers || []), newMember];
        await StorageService.updateUser(user.id, { teamMembers: updatedTeam });
        setNewMemberName('');
        setNewMemberEmail('');
        loadUserData();
    };

    const handleRemoveTeamMember = async (memberId: string) => {
        if (!user) return;
        const updatedTeam = user.teamMembers?.filter(m => m.id !== memberId) || [];
        await StorageService.updateUser(user.id, { teamMembers: updatedTeam });
        loadUserData();
    };

    const handleLogout = () => {
        try {
            StorageService.logout();
            window.location.href = '/';
        } catch (e) {
            window.location.href = '/';
        }
    };

    if (isLoading || !user) {
        return <div className="min-h-screen flex items-center justify-center bg-zinc-50 dark:bg-black"><div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div></div>;
    }

    const userRole = user.isAdmin ? 'admin' : user.role;
    const allowedTabs = TABS.filter(tab => tab.roles.includes(userRole) || (userRole === 'admin'));

    if (!activeTab && window.innerWidth < 1024) {
        return (
            <div className="min-h-screen bg-zinc-50 dark:bg-black text-zinc-900 dark:text-white pb-24 px-4 py-8">
                <h1 className="text-3xl font-black font-display uppercase tracking-tight mb-8">Settings</h1>
                
                <div className="bg-white dark:bg-zinc-900 p-6 rounded-2xl mb-6 flex items-center gap-4 shadow-sm border border-zinc-200 dark:border-zinc-800">
                    <div className="w-16 h-16 rounded-full overflow-hidden bg-zinc-100 dark:bg-black">
                        {logoUrl ? <img src={logoUrl} className="w-full h-full object-cover"/> : <User className="w-full h-full p-4 text-zinc-300"/>}
                    </div>
                    <div>
                        <div className="font-bold text-lg">{name}</div>
                        <div className="text-sm text-zinc-500">{email}</div>
                    </div>
                </div>

                <div className="space-y-2">
                    {allowedTabs.map(tab => (
                        <button
                            key={tab.id}
                            onClick={() => setActiveTab(tab.id)}
                            className="w-full p-4 bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-xl flex items-center justify-between shadow-sm active:scale-95 transition-transform"
                        >
                            <div className="flex items-center gap-4">
                                <div className="w-10 h-10 rounded-full bg-zinc-100 dark:bg-black flex items-center justify-center text-primary">
                                    <tab.icon size={20} />
                                </div>
                                <div className="text-left">
                                    <div className="font-bold">{tab.label}</div>
                                    <div className="text-xs text-zinc-500">{tab.description}</div>
                                </div>
                            </div>
                            <ChevronRight size={16} className="text-zinc-400"/>
                        </button>
                    ))}
                    
                    <button 
                        type="button"
                        onClick={handleLogout}
                        className="w-full p-4 mt-6 bg-red-50 dark:bg-red-900/10 border border-red-100 dark:border-red-900/30 rounded-xl flex items-center justify-between text-red-600 dark:text-red-400 font-bold active:scale-95 transition-transform"
                    >
                        <div className="flex items-center gap-4">
                            <LogOut size={20}/>
                            <span>Log Out</span>
                        </div>
                    </button>
                </div>
            </div>
        );
    }

    return (
        <div className="min-h-screen bg-zinc-50 dark:bg-black text-zinc-900 dark:text-white pb-20">
            <div className="max-w-7xl mx-auto px-4 py-8">
                <div className="flex items-center justify-between mb-8">
                    <div className="flex items-center gap-2">
                        <button 
                            onClick={() => setActiveTab(null)} 
                            className="lg:hidden p-2 -ml-2 rounded-full hover:bg-zinc-100 dark:hover:bg-zinc-800"
                        >
                            <ArrowLeft size={24}/>
                        </button>
                        <div>
                            <h1 className="text-3xl font-black font-display uppercase tracking-tight">
                                {activeTab ? allowedTabs.find(t => t.id === activeTab)?.label : 'Settings'}
                            </h1>
                            <p className="text-zinc-500 hidden lg:block">Manage your account preferences and configurations.</p>
                        </div>
                    </div>
                    <Button onClick={handleSave} isLoading={isSaving} id="save-btn" className="px-8 shadow-lg shadow-primary/20">
                        <Save size={18} className="mr-2"/> Save Changes
                    </Button>
                </div>

                <div className="flex flex-col lg:flex-row gap-8">
                    <div className="hidden lg:block w-64 shrink-0 space-y-1">
                        {allowedTabs.map(tab => (
                            <button
                                key={tab.id}
                                onClick={() => setActiveTab(tab.id)}
                                className={`w-full text-left px-4 py-3 rounded-xl flex items-center gap-3 transition-all font-medium whitespace-nowrap ${
                                    activeTab === tab.id 
                                    ? 'bg-white dark:bg-zinc-900 shadow-sm text-primary ring-1 ring-zinc-200 dark:ring-zinc-800' 
                                    : 'text-zinc-500 hover:bg-zinc-100 dark:hover:bg-zinc-900/50 hover:text-zinc-900 dark:hover:text-white'
                                }`}
                            >
                                <tab.icon size={18} />
                                <span>{tab.label}</span>
                            </button>
                        ))}
                        <div className="h-px bg-zinc-200 dark:bg-zinc-800 my-2"></div>
                        <button onClick={handleLogout} className="w-full text-left px-4 py-3 rounded-xl flex items-center gap-3 transition-all font-medium text-red-500 hover:bg-red-50 dark:hover:bg-red-900/10 whitespace-nowrap">
                            <LogOut size={18} /> Log Out
                        </button>
                    </div>

                    <div className="flex-1">
                        <Card className="p-6 md:p-8 min-h-[500px] border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-900 shadow-sm">
                            
                            {/* PROFILE */}
                            {activeTab === 'profile' && (
                                <div className="space-y-8 animate-in fade-in">
                                    <div className="flex flex-col md:flex-row gap-8 items-start">
                                        <div className="w-32 h-32 shrink-0 mx-auto md:mx-0">
                                            <div className="w-full h-full rounded-full overflow-hidden bg-zinc-100 dark:bg-black border-2 border-zinc-200 dark:border-zinc-800 mb-2 relative group">
                                                {logoUrl ? <img src={logoUrl} className="w-full h-full object-cover"/> : <User className="w-full h-full p-8 text-zinc-300"/>}
                                            </div>
                                            <FileDropZone 
                                                label=""
                                                onFileSelect={(b64) => setLogoUrl(b64 as string)}
                                                onClear={() => setLogoUrl('')}
                                                currentImage={null} 
                                            />
                                        </div>
                                        <div className="flex-1 space-y-4 w-full">
                                            <Input label="Full Name" value={name} onChange={e => setName(e.target.value)} className="bg-zinc-50 dark:bg-black border-zinc-200 dark:border-zinc-800"/>
                                            <Input label="Email Address" value={email} disabled className="bg-zinc-100 dark:bg-zinc-800/50 cursor-not-allowed opacity-70"/>
                                        </div>
                                    </div>
                                    <div className="bg-zinc-50 dark:bg-black p-4 rounded-xl border border-zinc-200 dark:border-zinc-800 flex justify-between items-center">
                                        <div>
                                            <h3 className="font-bold text-sm">Desktop Camera</h3>
                                            <p className="text-xs text-zinc-500">Enable webcam for ticket scanning on this device.</p>
                                        </div>
                                        <Switch checked={desktopCamera} onChange={setDesktopCamera} />
                                    </div>
                                </div>
                            )}

                            {/* ORGANIZATION */}
                            {activeTab === 'org' && (
                                <div className="space-y-8 animate-in fade-in">
                                    <Input label="Business / Org Name" value={businessName} onChange={e => setBusinessName(e.target.value)} placeholder="e.g. Acme Events Co." />
                                    <div>
                                        <h3 className="font-bold text-sm uppercase text-zinc-500 mb-4">Social Links</h3>
                                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                            <Input icon={Globe} placeholder="Website URL" value={website} onChange={e => setWebsite(e.target.value)} containerClassName="mb-0"/>
                                            <Input icon={Instagram} placeholder="Instagram" value={instagram} onChange={e => setInstagram(e.target.value)} containerClassName="mb-0"/>
                                            <Input icon={Facebook} placeholder="Facebook" value={facebook} onChange={e => setFacebook(e.target.value)} containerClassName="mb-0"/>
                                            <Input icon={Twitter} placeholder="X (Twitter)" value={twitter} onChange={e => setTwitter(e.target.value)} containerClassName="mb-0"/>
                                        </div>
                                    </div>
                                </div>
                            )}

                            {/* BILLING */}
                            {activeTab === 'billing' && (
                                <div className="space-y-8 animate-in fade-in">
                                    <div className="bg-gradient-to-br from-zinc-900 to-black text-white p-6 rounded-2xl border border-zinc-700 relative overflow-hidden">
                                        <div className="relative z-10 flex justify-between items-start">
                                            <div>
                                                <Badge className="mb-2 bg-primary text-white border-none">{user.subscription?.plan || 'Free'} Plan</Badge>
                                                <h3 className="text-2xl font-black">${user.subscription?.plan === 'free' ? '0' : '39'} <span className="text-sm font-normal text-zinc-400">/ mo</span></h3>
                                                <p className="text-sm text-zinc-400 mt-2">Next billing: {new Date(user.subscription?.nextBillingDate || Date.now()).toLocaleDateString()}</p>
                                            </div>
                                            <Button onClick={() => navigate('/pricing')} variant="white" size="sm">Change Plan</Button>
                                        </div>
                                        <div className="absolute top-0 right-0 w-64 h-64 bg-primary/20 rounded-full blur-[80px]"></div>
                                    </div>
                                </div>
                            )}

                            {/* BRANDING */}
                            {activeTab === 'branding' && (
                                <div className="space-y-8 animate-in fade-in">
                                    {!isPro && (
                                        <div className="bg-purple-100 dark:bg-purple-900/20 border border-purple-200 dark:border-purple-800 p-4 rounded-xl flex items-start gap-4 mb-6">
                                            <Crown className="text-purple-600 dark:text-purple-400 shrink-0" size={24}/>
                                            <div>
                                                <h3 className="font-bold text-purple-700 dark:text-purple-300">Pro Feature Locked</h3>
                                                <p className="text-sm text-zinc-600 dark:text-zinc-400 mb-2">
                                                    Custom branding, colors, and header images are available on the Pro plan.
                                                </p>
                                                <Button size="sm" onClick={() => navigate('/pricing')} className="bg-purple-600 hover:bg-purple-700 text-white border-none">Upgrade to Pro</Button>
                                            </div>
                                        </div>
                                    )}

                                    <div className={`grid grid-cols-1 lg:grid-cols-2 gap-8 ${!isPro ? 'opacity-50 pointer-events-none' : ''}`}>
                                        <div className="space-y-6">
                                            <div>
                                                <label className="text-sm font-bold text-zinc-700 dark:text-zinc-300 mb-2 block">Theme Color</label>
                                                <div className="flex items-center gap-4">
                                                    <input 
                                                        type="color" 
                                                        value={primaryColor} 
                                                        onChange={e => setPrimaryColor(e.target.value)}
                                                        className="w-12 h-12 rounded-xl cursor-pointer border-none bg-transparent p-0"
                                                    />
                                                    <div className="flex-1 font-mono text-sm bg-zinc-100 dark:bg-black border border-zinc-200 dark:border-zinc-800 px-3 py-2 rounded-lg uppercase">
                                                        {primaryColor}
                                                    </div>
                                                </div>
                                            </div>

                                            <div>
                                                <label className="text-sm font-bold text-zinc-700 dark:text-zinc-300 mb-2 block">Brand Logo</label>
                                                <div className="flex items-center gap-4">
                                                    <div className="w-16 h-16 rounded-full border border-zinc-200 dark:border-zinc-800 overflow-hidden bg-zinc-50 dark:bg-black">
                                                        {logoUrl ? <img src={logoUrl} className="w-full h-full object-cover"/> : <div className="w-full h-full flex items-center justify-center text-xs text-zinc-400">Logo</div>}
                                                    </div>
                                                    <div className="flex-1">
                                                        <FileDropZone 
                                                            onFileSelect={(b64) => setLogoUrl(b64 as string)}
                                                            onClear={() => setLogoUrl('')}
                                                            currentImage={null}
                                                            label="" 
                                                        />
                                                    </div>
                                                </div>
                                            </div>

                                            <div>
                                                <label className="text-sm font-bold text-zinc-700 dark:text-zinc-300 mb-2 block">Header Image</label>
                                                <FileDropZone 
                                                    onFileSelect={(b64) => setHeaderUrl(b64 as string)}
                                                    onClear={() => setHeaderUrl('')}
                                                    currentImage={headerUrl}
                                                />
                                            </div>
                                        </div>

                                        {/* Live Preview Card */}
                                        <div className="border border-zinc-200 dark:border-zinc-800 rounded-2xl overflow-hidden shadow-lg bg-white dark:bg-black flex flex-col">
                                            <div className="h-32 relative bg-zinc-200 dark:bg-zinc-800">
                                                {headerUrl && <img src={headerUrl} className="w-full h-full object-cover" />}
                                                <div className="absolute top-2 right-2">
                                                    <Badge className="bg-white/20 backdrop-blur text-white border-none">Event Page</Badge>
                                                </div>
                                            </div>
                                            <div className="p-4 relative">
                                                <div className="absolute -top-10 left-4 w-20 h-20 rounded-full border-4 border-white dark:border-black overflow-hidden bg-white dark:bg-zinc-900 shadow-md">
                                                    {logoUrl ? <img src={logoUrl} className="w-full h-full object-cover"/> : <div className="w-full h-full flex items-center justify-center font-bold text-zinc-400">Logo</div>}
                                                </div>
                                                <div className="mt-10">
                                                    <h3 className="font-bold text-lg">Event Title</h3>
                                                    <p className="text-xs text-zinc-500 mb-4 flex items-center gap-1"><Calendar size={10}/> Sat, Oct 12 • <MapPin size={10}/> The Venue</p>
                                                    <div 
                                                        className="w-full py-2 rounded-lg text-center text-sm font-bold text-white shadow-lg"
                                                        style={{ backgroundColor: primaryColor }}
                                                    >
                                                        Get Tickets
                                                    </div>
                                                </div>
                                            </div>
                                            <div className="bg-zinc-50 dark:bg-zinc-900 p-2 text-center text-[10px] text-zinc-400 font-mono uppercase border-t border-zinc-200 dark:border-zinc-800">
                                                Live Preview
                                            </div>
                                        </div>
                                    </div>
                                </div>
                            )}

                            {/* PAYOUTS */}
                            {activeTab === 'payouts' && (
                                <div className="space-y-8 animate-in fade-in">
                                    <div className="bg-[#635BFF]/5 border border-[#635BFF]/20 p-6 rounded-2xl">
                                        <div className="flex items-center gap-3 mb-6">
                                            <div className="p-3 bg-[#635BFF] text-white rounded-xl">
                                                <CreditCard size={24} />
                                            </div>
                                            <div>
                                                <h3 className="font-bold text-[#635BFF]">Stripe Connect</h3>
                                                <p className="text-xs text-zinc-500">Secure payments processing.</p>
                                            </div>
                                            {stripeId && <Badge color="green" className="ml-auto">Active</Badge>}
                                        </div>
                                        
                                        <Input 
                                            label="Stripe Connect Account ID" 
                                            placeholder="acct_..." 
                                            value={stripeId} 
                                            onChange={e => setStripeId(e.target.value)}
                                            className="font-mono"
                                        />
                                        <div className="mt-4 text-xs text-zinc-500 bg-white dark:bg-black p-3 rounded-lg border border-zinc-200 dark:border-zinc-800 flex gap-2">
                                            <HelpCircle size={14} className="mt-0.5 shrink-0"/>
                                            <span>Find this in your Stripe Dashboard under Settings {'>'} Account Details.</span>
                                        </div>
                                    </div>
                                </div>
                            )}

                            {/* ANALYTICS */}
                            {activeTab === 'analytics' && (
                                <div className="space-y-8 animate-in fade-in">
                                    <div className="space-y-4">
                                        <div className="bg-zinc-50 dark:bg-black p-4 rounded-xl border border-zinc-200 dark:border-zinc-800">
                                            <h3 className="font-bold text-sm uppercase text-zinc-500 mb-3 flex items-center gap-2"><BarChart3 size={16}/> Google Analytics</h3>
                                            <Input 
                                                placeholder="G-XXXXXXXXXX" 
                                                value={gaPixel} 
                                                onChange={e => setGaPixel(e.target.value)}
                                                label="Measurement ID"
                                                containerClassName="mb-0"
                                            />
                                        </div>

                                        <div className="bg-zinc-50 dark:bg-black p-4 rounded-xl border border-zinc-200 dark:border-zinc-800">
                                            <h3 className="font-bold text-sm uppercase text-zinc-500 mb-3 flex items-center gap-2"><Globe size={16}/> Meta Pixel</h3>
                                            <Input 
                                                placeholder="1234567890" 
                                                value={fbPixel} 
                                                onChange={e => setFbPixel(e.target.value)}
                                                label="Pixel ID"
                                                containerClassName="mb-0"
                                            />
                                        </div>
                                    </div>
                                </div>
                            )}

                            {/* TEAM */}
                            {activeTab === 'team' && (
                                <div className="space-y-8 animate-in fade-in">
                                    <div className="flex justify-between items-center">
                                        <h2 className="text-xl font-bold">Team Members</h2>
                                        <Badge>{user.teamMembers?.length || 0} Members</Badge>
                                    </div>

                                    <div className="space-y-3">
                                        {user.teamMembers?.map(member => (
                                            <div key={member.id} className="flex justify-between items-center p-4 border border-zinc-200 dark:border-zinc-800 rounded-xl bg-zinc-50 dark:bg-zinc-900/50">
                                                <div>
                                                    <div className="font-bold">{member.name}</div>
                                                    <div className="text-xs text-zinc-500">{member.email}</div>
                                                </div>
                                                <Button size="sm" variant="danger" onClick={() => handleRemoveTeamMember(member.id)}>Remove</Button>
                                            </div>
                                        ))}
                                        {(!user.teamMembers || user.teamMembers.length === 0) && (
                                            <div className="text-center py-8 text-zinc-400 italic bg-zinc-50 dark:bg-zinc-900/30 rounded-xl border-2 border-dashed border-zinc-200 dark:border-zinc-800">
                                                No team members yet.
                                            </div>
                                        )}
                                    </div>

                                    <div className="bg-zinc-50 dark:bg-black p-4 rounded-xl border border-zinc-200 dark:border-zinc-800">
                                        <h3 className="font-bold text-sm uppercase text-zinc-500 mb-3">Invite New Member</h3>
                                        <div className="flex flex-col md:flex-row gap-3">
                                            <Input placeholder="Name" value={newMemberName} onChange={e => setNewMemberName(e.target.value)} containerClassName="mb-0 flex-1"/>
                                            <Input placeholder="Email" value={newMemberEmail} onChange={e => setNewMemberEmail(e.target.value)} containerClassName="mb-0 flex-1"/>
                                            <Button onClick={handleAddTeamMember} disabled={!newMemberEmail}>Invite</Button>
                                        </div>
                                    </div>
                                </div>
                            )}

                            {/* SECURITY */}
                            {activeTab === 'security' && (
                                <div className="space-y-8 animate-in fade-in">
                                    <div className="bg-yellow-50 dark:bg-yellow-900/10 border border-yellow-200 dark:border-yellow-800 p-4 rounded-xl flex gap-3">
                                        <AlertTriangle className="text-yellow-600 shrink-0" />
                                        <div>
                                            <h3 className="font-bold text-yellow-800 dark:text-yellow-200 text-sm">Change Password</h3>
                                            <p className="text-xs text-yellow-700 dark:text-yellow-300 mt-1">
                                                To change your password, please log out and use the "Forgot Password" link on the login screen.
                                            </p>
                                        </div>
                                    </div>

                                    <div>
                                        <h3 className="font-bold text-sm mb-2">Active Sessions</h3>
                                        <div className="flex items-center justify-between p-3 bg-zinc-50 dark:bg-black rounded-lg border border-zinc-200 dark:border-zinc-800">
                                            <div className="flex items-center gap-2">
                                                <Monitor size={16} className="text-zinc-400"/>
                                                <span className="text-sm font-medium">This Browser</span>
                                            </div>
                                            <Badge color="green">Active</Badge>
                                        </div>
                                    </div>
                                </div>
                            )}

                        </Card>
                    </div>
                </div>
            </div>
        </div>
    );
};
