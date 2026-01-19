import React, { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { StorageService } from '../services/storageService';
import { GeminiService } from '../services/geminiService';
import { Event } from '../types';
import { Button, Card, Badge, Switch, Input, Select } from './UI';
import { ArrowLeft, Sparkles, Instagram, Twitter, Linkedin, Facebook, Copy, Loader2, Download, Share2, Code, Monitor, Smartphone, Moon, Sun, CheckCircle, Image as ImageIcon, Calendar, MapPin } from 'lucide-react';
import { SocialCaptionSection } from './EventMarketingSocial';

export const EventMarketing = () => {
    const { id } = useParams<{ id: string }>();
    const navigate = useNavigate();
    const [event, setEvent] = useState<Event | null>(null);
    const [activeTab, setActiveTab] = useState<'widget' | 'social'>('widget');

    useEffect(() => {
        const load = async () => {
            if (id) {
                const e = await StorageService.getEventFull(id);
                if (e) setEvent(e);
            }
        };
        load();
    }, [id]);

    if (!event) {
        return (
            <div className="min-h-screen flex items-center justify-center">
                <Loader2 className="animate-spin text-primary" size={32} />
            </div>
        );
    }

    return (
        <div className="min-h-screen bg-zinc-50 dark:bg-zinc-950 p-6">
            <div className="max-w-6xl mx-auto space-y-6">
                {/* Header */}
                <div className="flex items-center justify-between">
                    <div className="flex items-center gap-4">
                        <Button
                            variant="ghost"
                            onClick={() => navigate(`/dashboard/events/${id}`)}
                            className="flex items-center gap-2"
                        >
                            <ArrowLeft size={20} />
                            Back
                        </Button>
                        <div>
                            <h1 className="text-3xl font-bold text-gray-900 dark:text-white flex items-center gap-2">
                                <Sparkles className="text-purple-500" />
                                AI Marketing
                            </h1>
                            <p className="text-sm text-zinc-500">Generate widgets and social content for {event.title}</p>
                        </div>
                    </div>
                </div>

                {/* Tab Navigation */}
                <div className="flex gap-2 border-b border-zinc-200 dark:border-zinc-800">
                    <button
                        onClick={() => setActiveTab('widget')}
                        className={`px-6 py-3 font-semibold transition-colors ${
                            activeTab === 'widget'
                                ? 'text-primary border-b-2 border-primary'
                                : 'text-zinc-500 hover:text-zinc-900 dark:hover:text-zinc-100'
                        }`}
                    >
                        <Code size={18} className="inline mr-2" />
                        Marketing Widgets
                    </button>
                    <button
                        onClick={() => setActiveTab('social')}
                        className={`px-6 py-3 font-semibold transition-colors ${
                            activeTab === 'social'
                                ? 'text-primary border-b-2 border-primary'
                                : 'text-zinc-500 hover:text-zinc-900 dark:hover:text-zinc-100'
                        }`}
                    >
                        <Sparkles size={18} className="inline mr-2" />
                        Social Caption + Image
                    </button>
                </div>

                {/* Content */}
                {activeTab === 'widget' ? (
                    <WidgetSection event={event} />
                ) : (
                    <SocialCaptionSection event={event} />
                )}
            </div>
        </div>
    );
};

// Widget Section Component
const WidgetSection: React.FC<{ event: Event }> = ({ event }) => {
    const [widgetType, setWidgetType] = useState<'banner' | 'registration'>('banner');
    const [width, setWidth] = useState(500);
    const [height, setHeight] = useState(250);
    const [theme, setTheme] = useState<'light' | 'dark'>('light');
    const [embedCode, setEmbedCode] = useState('');

    // Update height based on widget type
    useEffect(() => {
        if (widgetType === 'banner') {
            setHeight(Math.min(height, 400)); // Banner max height
        } else {
            setHeight(Math.max(height, 500)); // Registration min height
        }
    }, [widgetType]);

    useEffect(() => {
        generateEmbedCode();
    }, [widgetType, width, height, theme]);

    const generateEmbedCode = () => {
        const baseUrl = `${window.location.origin}/#/event/${event.id}`;
        const code = `<iframe src="${baseUrl}?widget=${widgetType}&theme=${theme}" width="${width}" height="${height}" frameborder="0" style="border-radius: 12px; overflow: hidden;"></iframe>`;
        setEmbedCode(code);
    };

    const copyEmbedCode = () => {
        navigator.clipboard.writeText(embedCode);
        alert('Embed code copied to clipboard!');
    };

    // Size presets
    const applyPreset = (preset: 'small' | 'medium' | 'large') => {
        if (widgetType === 'banner') {
            if (preset === 'small') { setWidth(300); setHeight(150); }
            else if (preset === 'medium') { setWidth(500); setHeight(250); }
            else { setWidth(700); setHeight(350); }
        } else {
            if (preset === 'small') { setWidth(350); setHeight(500); }
            else if (preset === 'medium') { setWidth(450); setHeight(650); }
            else { setWidth(600); setHeight(800); }
        }
    };

    return (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            {/* Controls */}
            <Card className="p-6 space-y-6">
                <div>
                    <h3 className="text-xl font-bold text-gray-900 dark:text-white mb-4">Widget Settings</h3>
                    
                    {/* Widget Type */}
                    <div className="space-y-2 mb-4">
                        <label className="block text-sm font-medium text-gray-700 dark:text-gray-300">
                            Widget Type
                        </label>
                        <div className="grid grid-cols-2 gap-2">
                            <button
                                onClick={() => setWidgetType('banner')}
                                className={`p-3 rounded-lg border-2 transition-colors ${
                                    widgetType === 'banner'
                                        ? 'border-primary bg-primary/10 text-primary'
                                        : 'border-zinc-200 dark:border-zinc-700 text-zinc-700 dark:text-zinc-300'
                                }`}
                            >
                                <Monitor className="inline mr-2" size={18} />
                                Banner
                            </button>
                            <button
                                onClick={() => setWidgetType('registration')}
                                className={`p-3 rounded-lg border-2 transition-colors ${
                                    widgetType === 'registration'
                                        ? 'border-primary bg-primary/10 text-primary'
                                        : 'border-zinc-200 dark:border-zinc-700 text-zinc-700 dark:text-zinc-300'
                                }`}
                            >
                                <Smartphone className="inline mr-2" size={18} />
                                Registration
                            </button>
                        </div>
                    </div>

                    {/* Size Presets */}
                    <div className="space-y-2 mb-4">
                        <label className="block text-sm font-medium text-gray-700 dark:text-gray-300">
                            Size Presets
                        </label>
                        <div className="grid grid-cols-3 gap-2">
                            <button
                                onClick={() => applyPreset('small')}
                                className="p-2 rounded-lg border border-zinc-200 dark:border-zinc-700 text-sm hover:bg-zinc-100 dark:hover:bg-zinc-800 transition-colors"
                            >
                                Small
                            </button>
                            <button
                                onClick={() => applyPreset('medium')}
                                className="p-2 rounded-lg border border-zinc-200 dark:border-zinc-700 text-sm hover:bg-zinc-100 dark:hover:bg-zinc-800 transition-colors"
                            >
                                Medium
                            </button>
                            <button
                                onClick={() => applyPreset('large')}
                                className="p-2 rounded-lg border border-zinc-200 dark:border-zinc-700 text-sm hover:bg-zinc-100 dark:hover:bg-zinc-800 transition-colors"
                            >
                                Large
                            </button>
                        </div>
                    </div>

                    {/* Width Slider */}
                    <div className="space-y-2 mb-4">
                        <label className="block text-sm font-medium text-gray-700 dark:text-gray-300">
                            Width: <span className="font-bold text-primary">{width}px</span>
                        </label>
                        <input
                            type="range"
                            min="250"
                            max="900"
                            value={width}
                            onChange={(e) => setWidth(Number(e.target.value))}
                            className="w-full h-2 bg-zinc-200 dark:bg-zinc-700 rounded-lg appearance-none cursor-pointer accent-primary"
                        />
                        <div className="flex justify-between text-xs text-zinc-500">
                            <span>250px</span>
                            <span>900px</span>
                        </div>
                    </div>

                    {/* Height Slider */}
                    <div className="space-y-2 mb-4">
                        <label className="block text-sm font-medium text-gray-700 dark:text-gray-300">
                            Height: <span className="font-bold text-primary">{height}px</span>
                        </label>
                        <input
                            type="range"
                            min={widgetType === 'banner' ? '100' : '400'}
                            max={widgetType === 'banner' ? '500' : '1000'}
                            value={height}
                            onChange={(e) => setHeight(Number(e.target.value))}
                            className="w-full h-2 bg-zinc-200 dark:bg-zinc-700 rounded-lg appearance-none cursor-pointer accent-primary"
                        />
                        <div className="flex justify-between text-xs text-zinc-500">
                            <span>{widgetType === 'banner' ? '100' : '400'}px</span>
                            <span>{widgetType === 'banner' ? '500' : '1000'}px</span>
                        </div>
                    </div>

                    {/* Theme */}
                    <div className="space-y-2 mb-4">
                        <label className="block text-sm font-medium text-gray-700 dark:text-gray-300">
                            Theme
                        </label>
                        <div className="grid grid-cols-2 gap-2">
                            <button
                                onClick={() => setTheme('light')}
                                className={`p-3 rounded-lg border-2 transition-colors ${
                                    theme === 'light'
                                        ? 'border-primary bg-primary/10 text-primary'
                                        : 'border-zinc-200 dark:border-zinc-700 text-zinc-700 dark:text-zinc-300'
                                }`}
                            >
                                <Sun className="inline mr-2" size={18} />
                                Light
                            </button>
                            <button
                                onClick={() => setTheme('dark')}
                                className={`p-3 rounded-lg border-2 transition-colors ${
                                    theme === 'dark'
                                        ? 'border-primary bg-primary/10 text-primary'
                                        : 'border-zinc-200 dark:border-zinc-700 text-zinc-700 dark:text-zinc-300'
                                }`}
                            >
                                <Moon className="inline mr-2" size={18} />
                                Dark
                            </button>
                        </div>
                    </div>

                    {/* Embed Code */}
                    <div className="space-y-2">
                        <label className="block text-sm font-medium text-gray-700 dark:text-gray-300">
                            Embed Code
                        </label>
                        <div className="relative">
                            <textarea
                                value={embedCode}
                                readOnly
                                rows={4}
                                className="w-full p-3 bg-zinc-100 dark:bg-zinc-900 rounded-lg font-mono text-xs"
                            />
                            <Button
                                size="sm"
                                onClick={copyEmbedCode}
                                className="absolute top-2 right-2"
                            >
                                <Copy size={14} className="mr-1" />
                                Copy
                            </Button>
                        </div>
                    </div>
                </div>
            </Card>

            {/* Live Preview */}
            <Card className="p-6">
                <h3 className="text-xl font-bold text-gray-900 dark:text-white mb-4">Live Preview</h3>
                <p className="text-sm text-zinc-500 mb-4">Preview shows how the widget will appear on your website</p>
                <div 
                    className={`rounded-xl overflow-hidden border-2 transition-all ${
                        theme === 'dark' ? 'border-zinc-800 bg-zinc-900' : 'border-zinc-200 bg-white'
                    }`}
                    style={{ 
                        width: Math.min(width, 600), // Cap preview width for display
                        height: Math.min(height, 500), // Cap preview height for display
                        maxWidth: '100%'
                    }}
                >
                    <WidgetPreview
                        event={event}
                        type={widgetType}
                        width={width}
                        height={height}
                        theme={theme}
                    />
                </div>
                <p className="text-xs text-zinc-400 mt-2">
                    Actual size: {width}px × {height}px
                </p>
            </Card>
        </div>
    );
};

// Widget Preview Component
const WidgetPreview: React.FC<{
    event: Event;
    type: 'banner' | 'registration';
    width: number;
    height: number;
    theme: 'light' | 'dark';
}> = ({ event, type, width, height, theme }) => {
    const isDark = theme === 'dark';
    const isCompact = width < 400;
    
    // Format date nicely
    const eventDate = new Date(event.date).toLocaleDateString('en-US', {
        weekday: 'short',
        month: 'short',
        day: 'numeric',
        year: 'numeric'
    });

    if (type === 'banner') {
        return (
            <div className={`h-full p-4 ${isDark ? 'bg-zinc-900 text-white' : 'bg-white text-gray-900'}`}>
                <div className="flex flex-col h-full">
                    {/* Event Image (if available) */}
                    {event.imageUrl && height > 150 && (
                        <div className="mb-3 rounded-lg overflow-hidden" style={{ height: Math.min(height * 0.4, 150) }}>
                            <img 
                                src={event.imageUrl} 
                                alt={event.title}
                                className="w-full h-full object-cover"
                            />
                        </div>
                    )}
                    
                    <h3 className={`font-bold line-clamp-2 ${isCompact ? 'text-base' : 'text-xl'}`}>
                        {event.title}
                    </h3>
                    
                    <div className={`mt-2 space-y-1 ${isDark ? 'text-zinc-400' : 'text-zinc-600'}`}>
                        <p className={`flex items-center gap-1 ${isCompact ? 'text-xs' : 'text-sm'}`}>
                            <Calendar size={isCompact ? 12 : 14} />
                            {eventDate} {event.time && `• ${event.time}`}
                        </p>
                        {event.location && (
                            <p className={`flex items-center gap-1 ${isCompact ? 'text-xs' : 'text-sm'}`}>
                                <MapPin size={isCompact ? 12 : 14} />
                                <span className="line-clamp-1">{event.location}</span>
                            </p>
                        )}
                    </div>
                    
                    {/* Price display */}
                    {event.ticketTiers && event.ticketTiers.length > 0 && (
                        <p className={`mt-2 font-bold text-primary ${isCompact ? 'text-sm' : 'text-base'}`}>
                            {event.ticketTiers[0].price === 0 
                                ? 'FREE' 
                                : `From $${Math.min(...event.ticketTiers.map(t => t.price || 0)).toFixed(2)}`
                            }
                        </p>
                    )}
                    
                    <button className={`mt-auto px-4 py-2 rounded-lg font-semibold transition-colors bg-primary text-white hover:bg-primary/90 ${isCompact ? 'text-xs' : 'text-sm'}`}>
                        Get Tickets
                    </button>
                </div>
            </div>
        );
    }

    // Registration widget - show actual ticket tiers
    const tiers = event.ticketTiers || [];
    
    return (
        <div className={`h-full overflow-y-auto p-4 ${isDark ? 'bg-zinc-900 text-white' : 'bg-white text-gray-900'}`}>
            <div className="space-y-4">
                {/* Event Header */}
                <div className="text-center pb-3 border-b border-zinc-200 dark:border-zinc-700">
                    <h3 className={`font-bold ${isCompact ? 'text-base' : 'text-lg'}`}>
                        {event.title}
                    </h3>
                    <p className={`${isDark ? 'text-zinc-400' : 'text-zinc-600'} ${isCompact ? 'text-xs' : 'text-sm'}`}>
                        {eventDate} {event.time && `• ${event.time}`}
                    </p>
                </div>
                
                {/* Ticket Tiers - Actual event data */}
                <div className="space-y-2">
                    <p className={`font-semibold ${isCompact ? 'text-xs' : 'text-sm'} ${isDark ? 'text-zinc-300' : 'text-zinc-700'}`}>
                        Select Tickets
                    </p>
                    
                    {tiers.length > 0 ? (
                        tiers.slice(0, 3).map((tier, idx) => (
                            <div 
                                key={tier.id || idx}
                                className={`p-3 rounded-lg border ${isDark ? 'border-zinc-700 bg-zinc-800' : 'border-zinc-200 bg-zinc-50'}`}
                            >
                                <div className="flex justify-between items-center">
                                    <div>
                                        <p className={`font-semibold ${isCompact ? 'text-sm' : 'text-base'}`}>
                                            {tier.name || 'General Admission'}
                                        </p>
                                        {tier.description && (
                                            <p className={`${isDark ? 'text-zinc-400' : 'text-zinc-500'} line-clamp-1 ${isCompact ? 'text-xs' : 'text-sm'}`}>
                                                {tier.description}
                                            </p>
                                        )}
                                    </div>
                                    <div className="text-right">
                                        <p className={`font-bold text-primary ${isCompact ? 'text-sm' : 'text-base'}`}>
                                            {tier.price === 0 ? 'FREE' : `$${(tier.price || 0).toFixed(2)}`}
                                        </p>
                                        {tier.quantity !== undefined && tier.quantity > 0 && (
                                            <p className={`${isDark ? 'text-zinc-500' : 'text-zinc-400'} ${isCompact ? 'text-[10px]' : 'text-xs'}`}>
                                                {tier.soldCount || 0}/{tier.quantity} sold
                                            </p>
                                        )}
                                    </div>
                                </div>
                            </div>
                        ))
                    ) : (
                        <div className={`p-3 rounded-lg border ${isDark ? 'border-zinc-700 bg-zinc-800' : 'border-zinc-200 bg-zinc-50'}`}>
                            <p className={`font-semibold ${isCompact ? 'text-sm' : 'text-base'}`}>General Admission</p>
                            <p className={`font-bold text-primary ${isCompact ? 'text-sm' : 'text-base'}`}>FREE</p>
                        </div>
                    )}
                    
                    {tiers.length > 3 && (
                        <p className={`text-center ${isDark ? 'text-zinc-500' : 'text-zinc-400'} ${isCompact ? 'text-xs' : 'text-sm'}`}>
                            +{tiers.length - 3} more ticket types
                        </p>
                    )}
                </div>
                
                {/* Attendee Info Preview */}
                <div className="space-y-2">
                    <p className={`font-semibold ${isCompact ? 'text-xs' : 'text-sm'} ${isDark ? 'text-zinc-300' : 'text-zinc-700'}`}>
                        Your Information
                    </p>
                    <input
                        type="text"
                        placeholder="Full Name"
                        disabled
                        className={`w-full p-2 rounded border ${isCompact ? 'text-xs' : 'text-sm'} ${
                            isDark
                                ? 'bg-zinc-800 border-zinc-700 text-white placeholder-zinc-500'
                                : 'bg-white border-zinc-300 text-gray-900 placeholder-zinc-400'
                        }`}
                    />
                    <input
                        type="email"
                        placeholder="Email Address"
                        disabled
                        className={`w-full p-2 rounded border ${isCompact ? 'text-xs' : 'text-sm'} ${
                            isDark
                                ? 'bg-zinc-800 border-zinc-700 text-white placeholder-zinc-500'
                                : 'bg-white border-zinc-300 text-gray-900 placeholder-zinc-400'
                        }`}
                    />
                </div>
                
                {/* Register Button */}
                <button className={`w-full px-4 py-3 rounded-lg font-semibold transition-colors bg-primary text-white hover:bg-primary/90 ${isCompact ? 'text-sm' : 'text-base'}`}>
                    Register Now
                </button>
                
                {/* Powered By */}
                <p className={`text-center ${isDark ? 'text-zinc-600' : 'text-zinc-400'} text-[10px]`}>
                    Powered by OpenTicket
                </p>
            </div>
        </div>
    );
};