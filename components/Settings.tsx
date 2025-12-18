
import React, { useState, useEffect } from 'react';
import { StorageService } from '../services/storageService';
import { User } from '../types';
import { Button, Input, Card, Switch, FileDropZone } from './UI';
import { User as UserIcon, Settings as SettingsIcon, LogOut, Camera, Bell, ChevronRight } from 'lucide-react';

export const Settings = () => {
    const [user, setUser] = useState<User | null>(null);
    const [activeTab, setActiveTab] = useState<'profile' | 'preferences'>('profile');
    
    // Profile State
    const [name, setName] = useState('');
    const [email, setEmail] = useState('');
    const [logoUrl, setLogoUrl] = useState('');
    
    // Preferences State
    const [desktopCamera, setDesktopCamera] = useState(false);
    const [notifications, setNotifications] = useState({ newOrder: true, reminder: true });

    const [isSaving, setIsSaving] = useState(false);

    useEffect(() => {
        const currentUser = StorageService.getCurrentUser();
        if (currentUser) {
            setUser(currentUser);
            setName(currentUser.name || '');
            setEmail(currentUser.email || '');
            setLogoUrl(currentUser.logoUrl || '');
            
            // Load local preferences
            const savedCamera = localStorage.getItem('openticket_desktop_camera') === 'true';
            setDesktopCamera(savedCamera);
            
            if (currentUser.notifications) {
                setNotifications(currentUser.notifications);
            }
        }
    }, []);

    const handleSave = async () => {
        if (!user) return;
        setIsSaving(true);
        try {
            await StorageService.updateUser(user.id, {
                name,
                logoUrl,
                notifications
            });
            
            // Save local preferences
            localStorage.setItem('openticket_desktop_camera', String(desktopCamera));
            
            alert("Settings saved successfully!");
        } catch (e) {
            console.error(e);
            alert("Failed to save settings.");
        } finally {
            setIsSaving(false);
        }
    };

    const handleLogout = () => {
        if (confirm("Are you sure you want to log out?")) {
            StorageService.logout();
            window.location.reload();
        }
    };

    if (!user) return <div className="p-8 text-center text-zinc-500">Loading settings...</div>;

    return (
        <div className="max-w-4xl mx-auto py-12 px-4 pb-24">
            <h1 className="text-3xl font-black text-zinc-900 dark:text-white mb-8 uppercase tracking-tight">Settings</h1>
            
            <div className="flex flex-col md:flex-row gap-8">
                {/* Sidebar */}
                <div className="w-full md:w-64 space-y-2">
                    <button 
                        onClick={() => setActiveTab('profile')}
                        className={`w-full text-left px-4 py-3 rounded-xl font-bold flex items-center gap-3 transition-colors ${activeTab === 'profile' ? 'bg-zinc-900 dark:bg-white text-white dark:text-black' : 'text-zinc-500 hover:bg-zinc-100 dark:hover:bg-zinc-900'}`}
                    >
                        <UserIcon size={18}/> Profile
                    </button>
                    <button 
                        onClick={() => setActiveTab('preferences')}
                        className={`w-full text-left px-4 py-3 rounded-xl font-bold flex items-center gap-3 transition-colors ${activeTab === 'preferences' ? 'bg-zinc-900 dark:bg-white text-white dark:text-black' : 'text-zinc-500 hover:bg-zinc-100 dark:hover:bg-zinc-900'}`}
                    >
                        <SettingsIcon size={18}/> Preferences
                    </button>
                </div>

                {/* Content */}
                <div className="flex-1 space-y-8">
                    <Card className="p-6 border-zinc-200 dark:border-zinc-800">
                        {activeTab === 'profile' && (
                            <div className="space-y-6 animate-in fade-in">
                                <h2 className="text-xl font-bold mb-4 text-zinc-900 dark:text-white">Profile Settings</h2>
                                
                                <div className="flex flex-col items-center md:flex-row gap-6 mb-6">
                                    <div className="w-24 h-24 rounded-full overflow-hidden bg-zinc-100 dark:bg-zinc-800 relative group shrink-0 border-2 border-zinc-200 dark:border-zinc-700">
                                        {logoUrl ? (
                                            <img src={logoUrl} alt="Profile" className="w-full h-full object-cover"/>
                                        ) : (
                                            <div className="w-full h-full flex items-center justify-center text-zinc-400">
                                                <UserIcon size={32}/>
                                            </div>
                                        )}
                                        <div className="absolute inset-0 bg-black/50 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity cursor-pointer pointer-events-none">
                                            <Camera className="text-white" size={24}/>
                                        </div>
                                    </div>
                                    <div className="flex-1 w-full">
                                        <FileDropZone 
                                            label="Update Profile Picture"
                                            currentImage={null}
                                            onFileSelect={(b64) => setLogoUrl(b64 as string)}
                                            onClear={() => setLogoUrl('')}
                                        />
                                    </div>
                                </div>

                                <Input 
                                    label="Full Name" 
                                    value={name} 
                                    onChange={e => setName(e.target.value)} 
                                />
                                <Input 
                                    label="Email Address" 
                                    value={email} 
                                    disabled 
                                    className="opacity-60 cursor-not-allowed bg-zinc-100 dark:bg-zinc-800"
                                />
                            </div>
                        )}

                        {activeTab === 'preferences' && (
                            <div className="space-y-6 animate-in fade-in">
                                <h2 className="text-xl font-bold mb-4 text-zinc-900 dark:text-white">App Preferences</h2>
                                
                                <div className="flex justify-between items-center p-4 bg-zinc-50 dark:bg-zinc-900/50 rounded-xl border border-zinc-200 dark:border-zinc-800">
                                    <div>
                                        <div className="font-bold text-sm text-zinc-900 dark:text-white">Desktop Camera</div>
                                        <div className="text-xs text-zinc-500">Enable webcam for ticket scanning on this device.</div>
                                    </div>
                                    <Switch checked={desktopCamera} onChange={setDesktopCamera} />
                                </div>

                                <div className="flex justify-between items-center p-4 bg-zinc-50 dark:bg-zinc-900/50 rounded-xl border border-zinc-200 dark:border-zinc-800">
                                    <div>
                                        <div className="font-bold text-sm text-zinc-900 dark:text-white">Email Notifications</div>
                                        <div className="text-xs text-zinc-500">Receive updates about new orders.</div>
                                    </div>
                                    <Switch checked={notifications.newOrder} onChange={c => setNotifications({...notifications, newOrder: c})} />
                                </div>
                            </div>
                        )}

                        <div className="mt-8 pt-6 border-t border-zinc-200 dark:border-zinc-800 flex justify-end">
                            <Button onClick={handleSave} isLoading={isSaving}>Save Changes</Button>
                        </div>
                    </Card>

                    {/* Explicit Logout Button for Mobile */}
                    <div className="pt-4">
                        <Button 
                            variant="danger" 
                            onClick={handleLogout} 
                            className="w-full py-4 text-lg font-bold bg-red-500/10 hover:bg-red-500 border-red-500/20 text-red-500 hover:text-white transition-colors"
                        >
                            <LogOut size={20} className="mr-2"/> Log Out
                        </Button>
                    </div>
                </div>
            </div>
        </div>
    );
};
