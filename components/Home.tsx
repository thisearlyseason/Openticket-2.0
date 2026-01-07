
import React, { useEffect, useState } from 'react';
import { Link, useNavigate, useLocation } from 'react-router-dom';
import { MapPin, Search, Filter, Ticket, Image as ImageIcon, Heart, Users } from 'lucide-react';
import { StorageService } from '../services/storageService';
import { Event, User } from '../types';
import { Card, Badge, Button, formatTime } from './UI';
import { HotelCTA } from './HotelCTA';

const CATEGORIES = [
    { value: 'all', label: 'All' },
    { value: 'music', label: 'Music' },
    { value: 'nightlife', label: 'Nightlife' },
    { value: 'arts', label: 'Arts' },
    { value: 'food', label: 'Food' },
    { value: 'business', label: 'Business' },
    { value: 'classes', label: 'Classes' },
    { value: 'sports', label: 'Sports' },
    { value: 'community', label: 'Community' },
];

export const Home = () => {
    const [events, setEvents] = useState<Event[]>([]);
    const [filteredEvents, setFilteredEvents] = useState<Event[]>([]);
    const [searchTerm, setSearchTerm] = useState('');
    const [filterType, setFilterType] = useState('all');
    const [selectedCategory, setSelectedCategory] = useState('all');
    const [showFavoriteOrganizers, setShowFavoriteOrganizers] = useState(false);
    const [currentUser, setCurrentUser] = useState<User | null>(null);
    const navigate = useNavigate();
    const location = useLocation();

    useEffect(() => {
        // Load current user initially and on location change (to catch updates from other pages)
        const loadUser = () => {
            const user = StorageService.getCurrentUser();
            setCurrentUser(user);
        };
        loadUser();

        // Listen for storage changes (when favorites are updated from other tabs/pages)
        const handleStorageChange = () => {
            loadUser();
        };
        window.addEventListener('storage', handleStorageChange);
        
        // Also check periodically for local updates
        const interval = setInterval(loadUser, 2000);
        
        return () => {
            window.removeEventListener('storage', handleStorageChange);
            clearInterval(interval);
        };
    }, [location.key]);

    useEffect(() => {
        const loadEvents = async () => {
            // Use dedicated Public Events endpoint
            const rawEvents = await StorageService.getPublicEvents();
            // Backend already filters draft/visibility, but client sort and extra date check is good
            const today = new Date();
            today.setHours(0, 0, 0, 0);

            const allEvents = rawEvents
                .filter(e => {
                    if (!e.date) return false;
                    // Handle ISO strings or YYYY-MM-DD
                    const eventDate = new Date(e.date);
                    // Adjust to local? Or just simplified comparison. 
                    // e.date is usually YYYY-MM-DD string from backend.
                    // new Date("2024-01-01") is UTC. 
                    // Let's stick to string comparison for YYYY-MM-DD if possible or standard date obj.
                    // Safest is to set eventDate to midnight local time effectively.
                    // Actually, let's just use the timestamp comparison.
                    return eventDate >= today;
                })
                .sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime()); // Sort by nearest date, not created at

            setEvents(allEvents);
            setFilteredEvents(allEvents);
        };
        loadEvents();
    }, [location.key]);

    useEffect(() => {
        let results = events;
        if (searchTerm) {
            const lower = searchTerm.toLowerCase();
            results = results.filter(e =>
                e.title.toLowerCase().includes(lower) ||
                e.location.toLowerCase().includes(lower) ||
                (e.organizer && e.organizer.toLowerCase().includes(lower)) || // Search by Organizer Name
                (e.category && e.category.toLowerCase().includes(lower)) ||
                e.tags?.some(tag => tag.toLowerCase().includes(lower))
            );
        }
        if (filterType !== 'all') {
            if (filterType === 'free') results = results.filter(e => e.priceType === 'free' || e.priceType === 'donation');
            else if (filterType === 'paid') results = results.filter(e => e.priceType === 'fixed' || e.priceType === 'tiered');
        }
        if (selectedCategory !== 'all') {
            results = results.filter(e => e.category === selectedCategory);
        }
        // Filter by favorite organizers
        if (showFavoriteOrganizers && currentUser?.favoriteOrganizers?.length) {
            results = results.filter(e => currentUser.favoriteOrganizers?.includes(e.ownerId));
        }
        setFilteredEvents(results);
    }, [searchTerm, filterType, selectedCategory, events, showFavoriteOrganizers, currentUser]);

    return (
        <div className="space-y-8 min-h-screen">

            {/* Pop Modern Header */}
            <div className="relative py-12 px-6 bg-gradient-to-r from-primary via-purple-600 to-[#E0FF20] rounded-[3rem] overflow-hidden shadow-[0_0_40px_rgba(255,77,140,0.3)]">
                <div className="absolute top-0 right-0 w-64 h-64 bg-[#E0FF20] rounded-full mix-blend-multiply filter blur-3xl opacity-50 animate-blob"></div>
                <div className="absolute bottom-0 left-0 w-64 h-64 bg-accent rounded-full mix-blend-multiply filter blur-3xl opacity-50 animate-blob animation-delay-2000"></div>

                <div className="relative z-10 text-center max-w-2xl mx-auto">
                    <h1 className="text-4xl md:text-6xl font-black text-white mb-4 tracking-tighter drop-shadow-sm font-display uppercase italic transform -rotate-1">
                        Find Your <span className="text-[#E0FF20]">Vibe</span>
                    </h1>

                    {/* Search Pill */}
                    <div className="mt-8 relative max-w-lg mx-auto">
                        <div className="absolute inset-y-0 left-4 flex items-center pointer-events-none">
                            <Search className="text-black/50" size={20} />
                        </div>
                        <input
                            type="text"
                            placeholder="Search event, location, or tag..."
                            className="w-full pl-12 pr-4 py-4 rounded-full bg-white text-black font-bold placeholder-black/40 focus:outline-none focus:ring-4 focus:ring-[#E0FF20]/50 shadow-xl"
                            value={searchTerm}
                            onChange={(e) => setSearchTerm(e.target.value)}
                        />
                    </div>

                    <div className="flex justify-center gap-3 mt-6">
                        {['all', 'free', 'paid'].map(ft => (
                            <button
                                key={ft}
                                onClick={() => setFilterType(ft)}
                                className={`px-5 py-2 rounded-full text-sm font-bold uppercase tracking-wider transition-all border-2 border-white/20 ${filterType === ft ? 'bg-[#E0FF20] text-black border-transparent' : 'bg-black/20 text-white hover:bg-black/40'}`}
                            >
                                {ft === 'paid' ? 'Ticketed' : ft}
                            </button>
                        ))}
                        
                        {/* Favorite Organizers Button - Show for logged in users */}
                        {currentUser && (
                            <button
                                onClick={() => setShowFavoriteOrganizers(!showFavoriteOrganizers)}
                                className={`px-5 py-2 rounded-full text-sm font-bold uppercase tracking-wider transition-all duration-300 border-2 flex items-center gap-2 ${
                                    showFavoriteOrganizers 
                                        ? 'bg-pink-500 text-white border-pink-500 shadow-[0_0_20px_rgba(236,72,153,0.5)]' 
                                        : currentUser.favoriteOrganizers && currentUser.favoriteOrganizers.length > 0
                                            ? 'bg-pink-500/20 text-pink-400 hover:bg-pink-500/30 border-pink-500/50 hover:border-pink-500'
                                            : 'bg-black/20 text-white/70 hover:bg-black/40 border-white/20 hover:border-white/40'
                                }`}
                            >
                                <Heart size={16} className={showFavoriteOrganizers || (currentUser.favoriteOrganizers && currentUser.favoriteOrganizers.length > 0) ? 'fill-current' : ''} />
                                Favorites {currentUser.favoriteOrganizers && currentUser.favoriteOrganizers.length > 0 ? `(${currentUser.favoriteOrganizers.length})` : ''}
                            </button>
                        )}
                    </div>
                </div>
            </div>

            {/* Category Scroll Bar */}
            <div className="flex gap-2 overflow-x-auto pb-4 custom-scrollbar">
                {CATEGORIES.map(cat => (
                    <button
                        key={cat.value}
                        onClick={() => setSelectedCategory(cat.value)}
                        className={`px-4 py-2 rounded-xl text-sm font-bold whitespace-nowrap transition-colors border ${selectedCategory === cat.value
                            ? 'bg-zinc-900 dark:bg-white text-white dark:text-black border-transparent'
                            : 'bg-white dark:bg-zinc-900 text-zinc-500 border-zinc-200 dark:border-zinc-800 hover:border-zinc-400'
                            }`}
                    >
                        {cat.label}
                    </button>
                ))}
            </div>

            {/* Grid */}
            <div className="flex flex-wrap justify-center gap-6">
                {filteredEvents.length > 0 ? (
                    filteredEvents.map((event, idx) => {
                        const dateObj = new Date(event.date);
                        const isValidDate = !isNaN(dateObj.getTime());

                        return (
                            <Link key={event.id} to={`/event/${event.id}`} className="group block w-full md:w-[calc(50%-12px)] lg:w-[calc(33.333%-16px)]">
                                <div className="bg-surface border border-zinc-200 dark:border-zinc-800 rounded-[2rem] overflow-hidden hover:border-secondary transition-all duration-300 hover:shadow-xl hover:-translate-y-1 h-full flex flex-col relative isolate transform-gpu">
                                    {/* Image */}
                                    <div className="relative h-64 overflow-hidden bg-zinc-100 dark:bg-zinc-800">
                                        {event.imageUrl ? (
                                            <img
                                                src={event.imageUrl}
                                                alt={event.title}
                                                className="w-full h-full object-cover group-hover:scale-110 transition-transform duration-700"
                                            />
                                        ) : (
                                            <div className="w-full h-full flex items-center justify-center text-zinc-400">
                                                <ImageIcon size={48} />
                                            </div>
                                        )}
                                        <div className="absolute inset-0 bg-gradient-to-t from-black/60 to-transparent opacity-60"></div>

                                        {/* Floating Date Badge - Pop Style */}
                                        <div className="absolute top-4 left-4 bg-white/10 backdrop-blur-md border border-white/20 rounded-2xl p-2 text-center min-w-[3.5rem] flex flex-col items-center shadow-lg">
                                            {event.isRecurring ? (
                                                <>
                                                    <span className="text-xs font-bold text-secondary uppercase block">MULTI</span>
                                                    <span className="text-lg font-black text-white block leading-none">DAY</span>
                                                </>
                                            ) : (
                                                <>
                                                    <span className="text-xs font-bold text-secondary uppercase block">
                                                        {isValidDate ? dateObj.toLocaleDateString('en-US', { month: 'short' }) : 'TBA'}
                                                    </span>
                                                    <span className="text-xl font-black text-white block leading-none">
                                                        {isValidDate ? dateObj.getDate() : '--'}
                                                    </span>
                                                </>
                                            )}
                                        </div>

                                        {/* Price Tag Sticker */}
                                        <div className={`absolute top-4 right-4 px-3 py-1 rounded-full font-black text-sm uppercase transform rotate-3 shadow-lg ${event.priceType === 'free' ? 'bg-secondary text-black' :
                                            event.priceType === 'donation' ? 'bg-accent text-white' :
                                                'bg-primary text-white'
                                            }`}>
                                            {event.priceType === 'free' ? 'FREE' : event.priceType === 'donation' ? 'DONATE' : `$${event.price}`}
                                        </div>
                                    </div>

                                    {/* Content */}
                                    <div className="p-6 flex-1 flex flex-col relative">
                                        {/* Overlapping Content Fix - Location Chip */}
                                        <div className="-mt-12 mb-4 relative z-10 flex flex-wrap gap-2">
                                            <div className="inline-block bg-white dark:bg-black border border-zinc-200 dark:border-zinc-700 px-3 py-1 rounded-lg text-xs font-bold text-zinc-900 dark:text-zinc-300 uppercase tracking-wider shadow-sm">
                                                {event.location ? event.location.split(',')[0] : 'Location TBA'}
                                            </div>
                                            {event.tags && event.tags.length > 0 && (
                                                <div className="inline-block bg-zinc-900 dark:bg-zinc-800 border border-zinc-700 px-2 py-1 rounded-lg text-xs font-bold text-white uppercase tracking-wider shadow-sm">
                                                    {event.tags[0]} {event.tags.length > 1 && `+${event.tags.length - 1}`}
                                                </div>
                                            )}
                                        </div>

                                        <h3 className="text-2xl font-black font-display text-zinc-900 dark:text-white mb-2 leading-tight group-hover:text-primary transition-colors">
                                            {event.title}
                                        </h3>

                                        <div className="text-sm text-zinc-500 dark:text-zinc-400 mb-6 line-clamp-2 font-medium">
                                            {formatTime(event.time, event.timeFormat)} • {event.location || 'Location TBA'}
                                        </div>

                                        <div className="mt-auto border-t border-zinc-100 dark:border-zinc-800 pt-4 flex justify-between items-center">
                                            <div className="flex -space-x-2">
                                                {[1, 2, 3].map(i => (
                                                    <div key={i} className="w-8 h-8 rounded-full bg-zinc-100 dark:bg-zinc-800 border-2 border-white dark:border-black flex items-center justify-center text-xs text-zinc-500">
                                                        <Ticket size={12} />
                                                    </div>
                                                ))}
                                            </div>
                                            <span className="text-black dark:text-secondary text-sm font-bold flex items-center group-hover:translate-x-1 transition-transform">
                                                GET TICKET &rarr;
                                            </span>
                                        </div>
                                    </div>
                                </div>
                            </Link>
                        )
                    })
                ) : (
                    <div className="w-full py-20 text-center">
                        <div className="w-20 h-20 bg-zinc-900 rounded-full flex items-center justify-center mx-auto mb-4">
                            <Search className="text-zinc-700" size={32} />
                        </div>
                        <p className="text-zinc-500 font-bold text-lg">No events found.</p>
                        <Button onClick={() => { setSearchTerm(''); setFilterType('all'); setSelectedCategory('all'); }} variant="ghost" className="mt-4">Reset Filters</Button>
                    </div>
                )}
            </div>

            {/* Hotel CTA Banner */}
            <HotelCTA />
        </div>
    );
};
