
import React, { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { StorageService } from '../services/storageService';
import { Event } from '../types';
import { Button, Input, Card, Switch, RichTextarea, Select } from './UI';
import { ArrowLeft, Save, Globe, Lock, Search, Users, AlertTriangle, Eye, Shield } from 'lucide-react';

export const EventSettings = () => {
    const { id } = useParams<{ id: string }>();
    const navigate = useNavigate();
    const [event, setEvent] = useState<Event | null>(null);
    const [isLoading, setIsLoading] = useState(true);
    const [isSaving, setIsSaving] = useState(false);

    // Form State
    const [formData, setFormData] = useState<Partial<Event>>({});

    useEffect(() => {
        loadEvent();
    }, [id]);

    const loadEvent = async () => {
        if (!id) return;
        const e = await StorageService.getEventById(id);
        if (e) {
            setEvent(e);
            setFormData(e);
        }
        setIsLoading(false);
    };

    const handleSave = async () => {
        if (!event || !formData) return;
        setIsSaving(true);
        try {
            await StorageService.saveEvent({ ...event, ...formData });
            alert("Settings saved successfully!");
            // Refresh to ensure sync
            const fresh = await StorageService.getEventById(event.id);
            if (fresh) {
                setEvent(fresh);
                setFormData(fresh);
            }
        } catch (e) {
            alert("Error saving settings");
            console.error(e);
        } finally {
            setIsSaving(false);
        }
    };

    if (isLoading) return <div className="p-8 text-center"><div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary mx-auto"></div></div>;
    if (!event) return <div className="p-8 text-center">Event not found.</div>;

    return (
        <div className="max-w-4xl mx-auto py-8 px-4 pb-24">
            <div className="flex items-center justify-between mb-8">
                <button onClick={() => navigate(`/manage/${id}`)} className="text-zinc-500 hover:text-zinc-900 dark:hover:text-white flex items-center text-sm font-bold transition-colors">
                    <ArrowLeft size={16} className="mr-2" /> Back to Dashboard
                </button>
            </div>

            <div className="flex items-center justify-between mb-8">
                <div>
                    <h1 className="text-3xl font-black text-zinc-900 dark:text-white uppercase tracking-tight">Event Settings</h1>
                    <p className="text-zinc-500">{event.title}</p>
                </div>
                <Button onClick={handleSave} isLoading={isSaving} className="shadow-lg shadow-primary/20">
                    <Save size={16} className="mr-2" /> Save Changes
                </Button>
            </div>

            <div className="space-y-8">

                {/* 1. Visibility & Access */}
                <Card className="p-6">
                    <h2 className="text-xl font-bold mb-6 flex items-center gap-2"><Eye className="text-primary" /> Visibility & Access</h2>

                    <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
                        <button
                            onClick={() => setFormData({ ...formData, visibility: 'public' })}
                            className={`p-4 rounded-xl border-2 text-left transition-all ${formData.visibility === 'public' ? 'border-primary bg-primary/5' : 'border-zinc-200 dark:border-zinc-800 hover:border-zinc-300'}`}
                        >
                            <div className="flex items-center gap-2 font-bold mb-1"><Globe size={16} /> Public</div>
                            <div className="text-xs text-zinc-500">Listed on your profile and search engines.</div>
                        </button>
                        <button
                            onClick={() => setFormData({ ...formData, visibility: 'hidden' })}
                            className={`p-4 rounded-xl border-2 text-left transition-all ${formData.visibility === 'hidden' ? 'border-primary bg-primary/5' : 'border-zinc-200 dark:border-zinc-800 hover:border-zinc-300'}`}
                        >
                            <div className="flex items-center gap-2 font-bold mb-1"><Lock size={16} /> Unlisted</div>
                            <div className="text-xs text-zinc-500">Only accessible via direct link. Hidden from profile.</div>
                        </button>
                        <button
                            onClick={() => setFormData({ ...formData, visibility: 'private' })}
                            className={`p-4 rounded-xl border-2 text-left transition-all ${formData.visibility === 'private' ? 'border-primary bg-primary/5' : 'border-zinc-200 dark:border-zinc-800 hover:border-zinc-300'}`}
                        >
                            <div className="flex items-center gap-2 font-bold mb-1"><Shield size={16} /> Private</div>
                            <div className="text-xs text-zinc-500">Invite only or password protected (Coming Soon).</div>
                        </button>
                    </div>

                    <div className="space-y-4">
                        <div className="flex items-center justify-between p-4 bg-zinc-50 dark:bg-zinc-900 rounded-xl border border-zinc-200 dark:border-zinc-800">
                            <div>
                                <div className="font-bold text-sm">Require Approval</div>
                                <div className="text-xs text-zinc-500">Manually approve each attendee before they receive a ticket.</div>
                            </div>
                            <Switch checked={formData.requiresApproval || false} onChange={c => setFormData({ ...formData, requiresApproval: c })} />
                        </div>
                    </div>
                </Card>

                {/* 2. Capacity & Registration */}
                <Card className="p-6">
                    <h2 className="text-xl font-bold mb-6 flex items-center gap-2"><Users className="text-primary" /> Capacity & Registration</h2>

                    <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-6">
                        <Input
                            label="Global Capacity"
                            type="number"
                            value={formData.capacity || ''}
                            onChange={e => setFormData({ ...formData, capacity: parseInt(e.target.value) })}
                        />
                        <p className="-mt-4 text-xs text-zinc-500">Total maximum tickets across all tiers. Leave 0 for unlimited.</p>
                        <div className="flex items-center justify-between p-4 bg-zinc-50 dark:bg-zinc-900 rounded-xl border border-zinc-200 dark:border-zinc-800 h-[74px] md:mt-[26px]">
                            <div>
                                <div className="font-bold text-sm">Collect Guest Info</div>
                                <div className="text-xs text-zinc-500">Ask for name/email for every single ticket holder.</div>
                            </div>
                            <Switch checked={formData.collectGuestInfo !== false} onChange={c => setFormData({ ...formData, collectGuestInfo: c })} />
                        </div>
                        <div className="flex items-center justify-between p-4 bg-zinc-50 dark:bg-zinc-900 rounded-xl border border-zinc-200 dark:border-zinc-800 h-[74px]">
                            <div>
                                <div className="font-bold text-sm">Require Waiver</div>
                                <div className="text-xs text-zinc-500">Force attendees to accept your waiver before checking out.</div>
                            </div>
                            <Switch checked={formData.waiverConfig?.enabled || false} onChange={c => setFormData({ ...formData, waiverConfig: { ...(formData.waiverConfig || { text: '' }), enabled: c } })} />
                        </div>
                    </div>

                    <div className="border-t border-zinc-200 dark:border-zinc-800 pt-6">
                        <h3 className="font-bold text-sm text-zinc-500 uppercase mb-4">Waitlist Configuration</h3>
                        <div className="flex items-center justify-between mb-4">
                            <span className="font-bold">Enable Waitlist</span>
                            <Switch
                                checked={formData.waitlistConfig?.enabled || false}
                                onChange={c => setFormData({ ...formData, waitlistConfig: { ...(formData.waitlistConfig || { startDate: '', endDate: '' }), enabled: c } })}
                            />
                        </div>
                        {formData.waitlistConfig?.enabled && (
                            <div className="grid grid-cols-2 gap-4 animate-in fade-in">
                                <Input
                                    label="Start Date"
                                    type="date"
                                    value={formData.waitlistConfig?.startDate || ''}
                                    onChange={e => setFormData({ ...formData, waitlistConfig: { ...formData.waitlistConfig!, startDate: e.target.value } })}
                                />
                                <Input
                                    label="End Date"
                                    type="date"
                                    value={formData.waitlistConfig?.endDate || ''}
                                    onChange={e => setFormData({ ...formData, waitlistConfig: { ...formData.waitlistConfig!, endDate: e.target.value } })}
                                />
                            </div>
                        )}
                    </div>
                </Card>

                {/* 3. SEO Settings */}
                <Card className="p-6">
                    <h2 className="text-xl font-bold mb-6 flex items-center gap-2"><Search className="text-primary" /> SEO & Social Sharing</h2>
                    <div className="space-y-4">
                        <Input
                            label="Meta Title"
                            placeholder={event.title}
                            value={formData.seo?.metaTitle || ''}
                            onChange={e => setFormData({ ...formData, seo: { ...(formData.seo || {}), metaTitle: e.target.value } })}
                        />
                        <RichTextarea
                            label="Meta Description"
                            placeholder={event.subtitle || "Event description..."}
                            value={formData.seo?.metaDescription || ''}
                            onChange={(e: any) => setFormData({ ...formData, seo: { ...(formData.seo || {}), metaDescription: e.target.value } })}
                        />
                        <div className="flex items-center justify-between p-4 bg-zinc-50 dark:bg-zinc-900 rounded-xl border border-zinc-200 dark:border-zinc-800">
                            <div>
                                <div className="font-bold text-sm">Hide from Search Engines (NoIndex)</div>
                                <div className="text-xs text-zinc-500">Prevent Google from indexing this event page.</div>
                            </div>
                            <Switch checked={formData.seo?.noIndex || false} onChange={c => setFormData({ ...formData, seo: { ...(formData.seo || {}), noIndex: c } })} />
                        </div>
                    </div>
                </Card>

                {/* 4. Danger Zone */}
                <Card className="p-6 border-red-200 dark:border-red-900/30">
                    <h2 className="text-xl font-bold mb-6 flex items-center gap-2 text-red-500"><AlertTriangle /> Danger Zone</h2>
                    <div className="flex items-center justify-between">
                        <div>
                            <div className="font-bold">Delete Event</div>
                            <div className="text-sm text-zinc-500">This action cannot be undone. All data will be lost.</div>
                        </div>
                        <Button variant="danger" onClick={() => {
                            if (confirm(`Are you sure you want to delete "${event.title}"?`)) {
                                StorageService.deleteEvent(event.id).then(() => navigate('/dashboard'));
                            }
                        }}>Delete Event</Button>
                    </div>
                </Card>

            </div>
        </div>
    );
};
