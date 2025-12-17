
import React, { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { StorageService } from '../services/storageService';
import { GeminiService } from '../services/geminiService';
import { Event } from '../types';
import { Button, Card, Badge } from './UI';
import { ArrowLeft, Sparkles, Instagram, Twitter, Linkedin, Facebook, Copy, Loader2, RefreshCw, Mail, Wand2, Hash, Zap, Image as ImageIcon, Share2, Download, Type } from 'lucide-react';

export const EventMarketing = () => {
    const { id } = useParams<{ id: string }>();
    const navigate = useNavigate();
    const [event, setEvent] = useState<Event | null>(null);
    
    // UI State
    const [activeTab, setActiveTab] = useState<'text' | 'visuals'>('text');
    
    // Text Gen State
    const [platform, setPlatform] = useState<'instagram' | 'twitter' | 'linkedin' | 'facebook' | 'email'>('instagram');
    const [tone, setTone] = useState<'hype' | 'professional' | 'minimal' | 'urgent'>('hype');
    const [generatedContent, setGeneratedContent] = useState('');
    const [isGenerating, setIsGenerating] = useState(false);

    // Image Gen State
    const [generatedImage, setGeneratedImage] = useState<string | null>(null);
    const [isGeneratingImage, setIsGeneratingImage] = useState(false);

    useEffect(() => {
        const load = async () => {
            if (id) {
                const e = await StorageService.getEventById(id);
                if (e) setEvent(e);
            }
        };
        load();
    }, [id]);

    const handleGenerate = async () => {
        if (!event) return;
        
        if (activeTab === 'text') {
            setIsGenerating(true);
            const details = `${new Date(event.date).toLocaleDateString()} at ${event.location}`;
            const contextWithTone = `Tone: ${tone}. ${details}`;
            const content = await GeminiService.generateMarketingContent(event.title, event.description, contextWithTone, platform as any);
            setGeneratedContent(content);
            setIsGenerating(false);
        } else {
            setIsGeneratingImage(true);
            const imageBase64 = await GeminiService.generateEventImage(event.title, event.description);
            setGeneratedImage(imageBase64);
            setIsGeneratingImage(false);
        }
    };

    const handleShare = async () => {
        if (!event) return;
        const shareData: any = {
            title: event.title,
            text: generatedContent || `Check out ${event.title}!`,
            url: window.location.href.replace('manage', 'event').replace('/marketing', '')
        };

        // Note: Sharing files (images) via navigator.share is subject to strict browser support/policies
        // For broad compatibility, we mainly share text/url, but if we have a file object we can try.
        
        try {
            await navigator.share(shareData);
        } catch (err) {
            console.log('Error sharing:', err);
            // Fallback
            navigator.clipboard.writeText(`${shareData.text} ${shareData.url}`);
            alert("Share content copied to clipboard!");
        }
    };

    if (!event) return <div className="min-h-screen flex items-center justify-center"><Loader2 className="animate-spin text-primary" size={32} /></div>;

    const platforms = [
        { id: 'instagram', icon: Instagram, label: 'Instagram', color: 'text-pink-500' },
        { id: 'twitter', icon: Twitter, label: 'X / Twitter', color: 'text-blue-400' },
        { id: 'linkedin', icon: Linkedin, label: 'LinkedIn', color: 'text-blue-700' },
        { id: 'facebook', icon: Facebook, label: 'Facebook', color: 'text-blue-600' },
        { id: 'email', icon: Mail, label: 'Email', color: 'text-yellow-500' },
    ];

    return (
        <div className="max-w-6xl mx-auto py-6 px-4 pb-32">
            <div className="flex items-center justify-between mb-8">
                <button onClick={() => navigate(`/manage/${id}`)} className="text-zinc-500 hover:text-zinc-900 dark:hover:text-white flex items-center text-sm font-bold transition-colors">
                    <ArrowLeft size={16} className="mr-2"/> Back to Event
                </button>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-12 gap-8">
                {/* LEFT PANEL: Controls */}
                <div className="lg:col-span-5 space-y-8">
                    <div>
                        <h1 className="text-4xl md:text-5xl font-black text-zinc-900 dark:text-white uppercase tracking-tight mb-2">
                            AI <span className="text-transparent bg-clip-text bg-gradient-to-r from-purple-500 to-pink-500">Marketing</span>
                        </h1>
                        <p className="text-zinc-500 text-lg">Generate viral content for <strong>{event.title}</strong>.</p>
                    </div>

                    {/* Tabs */}
                    <div className="bg-zinc-100 dark:bg-zinc-900/50 p-1 rounded-xl flex gap-1 border border-zinc-200 dark:border-zinc-800">
                        <button 
                            onClick={() => setActiveTab('text')}
                            className={`flex-1 py-3 rounded-lg text-sm font-bold flex items-center justify-center gap-2 transition-all ${activeTab === 'text' ? 'bg-white dark:bg-black text-black dark:text-white shadow-sm' : 'text-zinc-500 hover:text-zinc-800 dark:hover:text-zinc-300'}`}
                        >
                            <Type size={16}/> Captions
                        </button>
                        <button 
                            onClick={() => setActiveTab('visuals')}
                            className={`flex-1 py-3 rounded-lg text-sm font-bold flex items-center justify-center gap-2 transition-all ${activeTab === 'visuals' ? 'bg-white dark:bg-black text-black dark:text-white shadow-sm' : 'text-zinc-500 hover:text-zinc-800 dark:hover:text-zinc-300'}`}
                        >
                            <ImageIcon size={16}/> Visuals
                        </button>
                    </div>

                    {activeTab === 'text' ? (
                        <div className="space-y-6 animate-in fade-in slide-in-from-left-2">
                            <div>
                                <label className="text-xs font-bold text-zinc-500 uppercase tracking-wider mb-3 block">Target Platform</label>
                                <div className="grid grid-cols-3 gap-2">
                                    {platforms.map(p => (
                                        <button
                                            key={p.id}
                                            onClick={() => setPlatform(p.id as any)}
                                            className={`flex flex-col items-center justify-center p-4 rounded-xl border transition-all ${
                                                platform === p.id 
                                                ? `border-primary bg-primary/5 text-zinc-900 dark:text-white` 
                                                : 'border-zinc-200 dark:border-zinc-800 text-zinc-400 hover:bg-zinc-50 dark:hover:bg-zinc-900'
                                            }`}
                                        >
                                            <p.icon size={24} className={`mb-2 ${platform === p.id ? p.color : 'opacity-50'}`} />
                                            <span className="text-xs font-bold">{p.label}</span>
                                        </button>
                                    ))}
                                </div>
                            </div>

                            <div>
                                <label className="text-xs font-bold text-zinc-500 uppercase tracking-wider mb-3 block">Vibe Check</label>
                                <div className="flex gap-2 overflow-x-auto pb-2 custom-scrollbar">
                                    {['hype', 'professional', 'minimal', 'urgent'].map(t => (
                                        <button
                                            key={t}
                                            onClick={() => setTone(t as any)}
                                            className={`px-6 py-3 rounded-full text-sm font-bold border transition-all capitalize ${
                                                tone === t 
                                                ? 'bg-zinc-900 dark:bg-white text-white dark:text-black border-transparent' 
                                                : 'bg-transparent border-zinc-200 dark:border-zinc-800 text-zinc-500 hover:border-zinc-400'
                                            }`}
                                        >
                                            {t}
                                        </button>
                                    ))}
                                </div>
                            </div>
                        </div>
                    ) : (
                        <div className="space-y-6 animate-in fade-in slide-in-from-right-2">
                            <div className="p-6 bg-purple-500/10 border border-purple-500/20 rounded-2xl">
                                <h3 className="font-bold text-purple-500 mb-2 flex items-center gap-2"><Sparkles size={18}/> AI Image Generator</h3>
                                <p className="text-sm text-purple-900 dark:text-purple-200 mb-4">
                                    Create a unique promotional image for <strong>{event.title}</strong> based on your event description.
                                </p>
                                <div className="text-xs text-zinc-500 dark:text-zinc-400">
                                    Note: Generation may take up to 10 seconds.
                                </div>
                            </div>
                        </div>
                    )}

                    {/* Desktop Generate Button */}
                    <div className="hidden lg:block">
                        <Button 
                            onClick={handleGenerate} 
                            isLoading={isGenerating || isGeneratingImage}
                            className="w-full py-4 text-lg shadow-xl shadow-purple-500/20 bg-gradient-to-r from-purple-600 to-pink-600 hover:to-pink-500 text-white border-none relative overflow-hidden group"
                        >
                            <span className="relative z-10 flex items-center justify-center gap-2">
                                <Wand2 size={20} className={isGenerating || isGeneratingImage ? "animate-spin" : "group-hover:rotate-12 transition-transform"}/> 
                                {activeTab === 'text' ? 'Generate Caption' : 'Generate Visual'}
                            </span>
                        </Button>
                    </div>
                </div>

                {/* RIGHT PANEL: Output */}
                <div id="marketing-result" className="lg:col-span-7">
                    <div className="h-full min-h-[500px] bg-zinc-100 dark:bg-zinc-900/50 rounded-[2rem] border border-zinc-200 dark:border-zinc-800 p-2 flex flex-col relative overflow-hidden shadow-inner">
                        {/* Header */}
                        <div className="flex items-center justify-between px-6 py-4 border-b border-zinc-200 dark:border-zinc-800/50">
                            <div className="flex items-center gap-2">
                                <div className="w-3 h-3 rounded-full bg-red-500"></div>
                                <div className="w-3 h-3 rounded-full bg-yellow-500"></div>
                                <div className="w-3 h-3 rounded-full bg-green-500"></div>
                            </div>
                            <div className="text-xs font-mono text-zinc-400 uppercase tracking-widest">
                                {activeTab === 'text' ? 'Output.txt' : 'Output.png'}
                            </div>
                        </div>

                        {/* Content Area */}
                        <div className="flex-1 relative bg-white dark:bg-black rounded-b-[1.5rem] overflow-hidden">
                            {(activeTab === 'text' && isGenerating) || (activeTab === 'visuals' && isGeneratingImage) ? (
                                <div className="absolute inset-0 flex flex-col items-center justify-center text-zinc-400">
                                    <div className="w-20 h-20 mb-6 relative">
                                        <div className="absolute inset-0 border-4 border-zinc-100 dark:border-zinc-800 rounded-full"></div>
                                        <div className="absolute inset-0 border-4 border-t-primary rounded-full animate-spin"></div>
                                        <Sparkles className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 text-primary animate-pulse" size={32}/>
                                    </div>
                                    <p className="animate-pulse font-mono text-sm tracking-widest uppercase">Creativity Loading...</p>
                                </div>
                            ) : (
                                <>
                                    {activeTab === 'text' ? (
                                        <textarea 
                                            className="w-full h-full p-6 text-lg resize-none focus:outline-none text-zinc-800 dark:text-zinc-200 font-medium leading-relaxed bg-transparent"
                                            placeholder="Your generated caption will appear here..."
                                            value={generatedContent}
                                            onChange={(e) => setGeneratedContent(e.target.value)}
                                        ></textarea>
                                    ) : (
                                        <div className="w-full h-full flex items-center justify-center bg-zinc-50 dark:bg-zinc-900">
                                            {generatedImage ? (
                                                <img src={generatedImage} alt="Generated Event Asset" className="max-w-full max-h-full object-contain shadow-2xl" />
                                            ) : (
                                                <div className="text-center text-zinc-400">
                                                    <ImageIcon size={48} className="mx-auto mb-4 opacity-20"/>
                                                    <p>No image generated yet.</p>
                                                </div>
                                            )}
                                        </div>
                                    )}
                                </>
                            )}
                        </div>

                        {/* Footer Actions */}
                        {((activeTab === 'text' && generatedContent) || (activeTab === 'visuals' && generatedImage)) && (
                            <div className="absolute bottom-6 right-6 flex gap-3">
                                <Button size="sm" variant="ghost" onClick={handleGenerate} className="bg-zinc-200/80 dark:bg-zinc-800/80 backdrop-blur">
                                    <RefreshCw size={16} className="mr-2"/> Regen
                                </Button>
                                
                                {activeTab === 'visuals' && generatedImage && (
                                    <a href={generatedImage} download={`event-${event.id}-promo.png`} className="inline-flex items-center justify-center px-4 py-2 bg-zinc-900 dark:bg-white text-white dark:text-black rounded-full font-bold text-xs shadow-lg hover:scale-105 transition-transform">
                                        <Download size={16} className="mr-2"/> Download
                                    </a>
                                )}

                                <Button size="sm" onClick={handleShare} className="shadow-lg bg-blue-600 text-white border-none hover:bg-blue-700">
                                    <Share2 size={16} className="mr-2"/> Share
                                </Button>
                            </div>
                        )}
                    </div>
                </div>
            </div>

            {/* Mobile Sticky Generate Button - RAISED Z-INDEX above Nav */}
            <div className="fixed bottom-20 left-4 right-4 z-[60] lg:hidden">
                <Button 
                    onClick={handleGenerate} 
                    isLoading={isGenerating || isGeneratingImage}
                    className="w-full py-4 text-lg shadow-2xl bg-primary text-white border-none rounded-2xl"
                >
                    {isGenerating || isGeneratingImage ? 'Creating...' : activeTab === 'text' ? 'Generate Caption' : 'Generate Image'}
                </Button>
            </div>
        </div>
    );
};
