
import React, { useEffect, useState } from 'react';
import { useParams, Link } from 'react-router-dom';
import { Calendar, MapPin, Share2, Globe, Facebook, Instagram, Twitter, Youtube, Smartphone, Image as ImageIcon, Mail, Phone, Heart, Users, Ticket, ChevronRight } from 'lucide-react';
import { StorageService } from '../services/storageService';
import { Event, User } from '../types';
import { Card, Badge, Button, ShareButtons, formatTime } from './UI';
import { useGlobalUI } from './GlobalUIProvider';

export const OrganizerProfile = () => {
    const { id } = useParams<{ id: string }>();
    const [events, setEvents] = useState<Event[]>([]);
    const [organizer, setOrganizer] = useState<User | null>(null);
    const [currentUser, setCurrentUser] = useState<User | null>(null);
    const [showShare, setShowShare] = useState(false);
    const [loadingFavorite, setLoadingFavorite] = useState(false);
    const { showToast } = useGlobalUI();

    useEffect(() => {
        const user = StorageService.getCurrentUser();
        setCurrentUser(user);
    }, []);

    useEffect(() => {
        const loadData = async () => {
            if (id) {
                // Fetch Organizer Details
                const user = await StorageService.getUserById(id);
                if (user) setOrganizer(user);

                // Fetch Events - only public, upcoming events
                const allEvents = await StorageService.getEvents();
                const today = new Date();
                today.setHours(0, 0, 0, 0);
                
                const orgEvents = allEvents
                    .filter(e => e.ownerId === id && e.visibility === 'public' && !e.isDraft)
                    .filter(e => new Date(e.date) >= today)
                    .sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime());
                setEvents(orgEvents);
            }
        };
        loadData();
    }, [id]);

    const toggleFavorite = async () => {
        if (!currentUser) {
            showToast("Please sign in to favorite organizers.", "info");
            return;
        }
        if (!organizer) return;
        
        setLoadingFavorite(true);
        try {
            const updated = await StorageService.toggleFavoriteOrganizer(organizer.id);
            if (updated) {
                setCurrentUser(updated);
                showToast(
                    updated.favoriteOrganizers?.includes(organizer.id) 
                        ? "Added to favorites!" 
                        : "Removed from favorites", 
                    "success"
                );
            }
        } catch (error) {
            showToast("Failed to update favorites", "error");
        }
        setLoadingFavorite(false);
    };

    const isFavorited = currentUser?.favoriteOrganizers?.includes(id || '') || false;

    if (!id) {
        return <div className="text-center py-20 text-gray-500">Organizer not found.</div>;
    }

    // Determine display name and email based on useBusinessName setting
    const displayName = organizer?.useBusinessName 
        ? (organizer.businessName || organizer.name) 
        : (organizer?.name || 'Organizer');
    
    const displayEmail = organizer?.useBusinessName 
        ? (organizer.businessEmail || organizer.email) 
        : organizer?.email;
    
    const displayPhone = organizer?.useBusinessName 
        ? (organizer.businessPhone || organizer.phone) 
        : organizer?.phone;

    // Check if organizer has any social links set (not empty strings)
    const hasSocialLinks = organizer?.socials && (
        (organizer.socials.instagram && organizer.socials.instagram.trim() !== '') ||
        (organizer.socials.facebook && organizer.socials.facebook.trim() !== '') ||
        (organizer.socials.x && organizer.socials.x.trim() !== '') ||
        (organizer.socials.youtube && organizer.socials.youtube.trim() !== '') ||
        (organizer.socials.tiktok && organizer.socials.tiktok.trim() !== '') ||
        (organizer.socials.website && organizer.socials.website.trim() !== '')
    );

    // Helper to check if a social URL is valid (not empty and not just the domain)
    const isValidSocialUrl = (url?: string): boolean => {
        if (!url || url.trim() === '') return false;
        // Don't show if it's just pointing to openticket.events
        if (url.includes('openticket.events')) return false;
        return true;
    };

    return (
        <div className="min-h-screen bg-zinc-50 dark:bg-zinc-950">
            {/* Cover Image Section */}
            <div className="relative h-64 md:h-80 lg:h-96 w-full overflow-hidden">
                {organizer?.headerImageUrl ? (
                    <img 
                        src={organizer.headerImageUrl} 
                        alt="Cover" 
                        className="w-full h-full object-cover"
                    />
                ) : (
                    <div className="w-full h-full bg-gradient-to-br from-purple-600 via-pink-500 to-orange-400"></div>
                )}
                <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-black/20 to-transparent"></div>
            </div>

                {/* Profile Content */}
                <div className="max-w-5xl mx-auto px-4 sm:px-6 -mt-24 relative z-10 pb-20">
                    {/* Profile Header Card */}
                    <Card className="p-6 md:p-8 bg-white dark:bg-zinc-900 border-none shadow-2xl rounded-[2rem] mb-8">
                        <div className="flex flex-col md:flex-row gap-6">
                            {/* Profile Image - Fixed overflow to show full image */}
                            <div className="flex-shrink-0 -mt-20 md:-mt-28 mx-auto md:mx-0 relative z-20">
                                <div className="w-36 h-36 md:w-44 md:h-44 rounded-full border-4 border-white dark:border-zinc-900 shadow-2xl bg-zinc-200 dark:bg-zinc-800 overflow-hidden">
                                    {organizer?.logoUrl ? (
                                        <img 
                                            src={organizer.logoUrl} 
                                            alt={displayName} 
                                            className="w-full h-full object-cover"
                                        />
                                    ) : (
                                        <div className="w-full h-full flex items-center justify-center text-6xl md:text-7xl font-black text-zinc-400 dark:text-zinc-600">
                                            {displayName.charAt(0).toUpperCase()}
                                        </div>
                                    )}
                            </div>
                        </div>

                        {/* Profile Info */}
                        <div className="flex-1 text-center md:text-left pt-4 md:pt-0">
                            <div className="flex flex-col md:flex-row md:items-start md:justify-between gap-4">
                                <div>
                                    <h1 className="text-3xl md:text-4xl font-black text-zinc-900 dark:text-white mb-2">
                                        {displayName}
                                    </h1>
                                    {organizer?.organizerSubtitle && organizer.organizerSubtitle.trim() !== '' && (
                                        <p className="text-lg text-zinc-500 dark:text-zinc-400 mb-4 italic">
                                            "{organizer.organizerSubtitle}"
                                        </p>
                                    )}
                                    
                                    {/* Stats Row - Only show events count */}
                                    <div className="flex flex-wrap justify-center md:justify-start gap-4 mb-4">
                                        <div className="flex items-center gap-2 text-zinc-600 dark:text-zinc-400">
                                            <Calendar size={18} />
                                            <span className="font-bold">{events.length}</span>
                                            <span className="text-sm">Upcoming Events</span>
                                        </div>
                                    </div>
                                </div>

                                {/* Action Buttons */}
                                <div className="flex gap-3 justify-center md:justify-end">
                                    <Button 
                                        variant="outline" 
                                        onClick={() => setShowShare(!showShare)} 
                                        className="flex items-center gap-2"
                                    >
                                        <Share2 size={18} /> Share
                                    </Button>
                                    <Button
                                        onClick={toggleFavorite}
                                        disabled={loadingFavorite}
                                        className={`flex items-center gap-2 transition-all duration-300 ${
                                            isFavorited 
                                                ? 'bg-pink-500 hover:bg-pink-600 text-white shadow-[0_0_25px_rgba(236,72,153,0.5)]' 
                                                : 'bg-zinc-100 dark:bg-zinc-800 hover:bg-pink-100 dark:hover:bg-pink-900/30 text-zinc-700 dark:text-zinc-300'
                                        }`}
                                    >
                                        <Heart 
                                            size={18} 
                                            fill={isFavorited ? "currentColor" : "none"}
                                            className={isFavorited ? 'animate-pulse' : ''}
                                        />
                                        {isFavorited ? 'Favorited' : 'Favorite'}
                                    </Button>
                                </div>
                            </div>

                            {/* Share Dropdown */}
                            {showShare && (
                                <div className="mt-4 p-4 bg-zinc-50 dark:bg-zinc-800 rounded-xl animate-in fade-in slide-in-from-top-2">
                                    <ShareButtons title={`Check out events by ${displayName} on OpenTicket`} url={window.location.href} />
                                </div>
                            )}
                        </div>
                    </div>
                </Card>

                {/* Two Column Layout */}
                <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
                    {/* Left Column - About & Contact */}
                    <div className="lg:col-span-1 space-y-6">
                        {/* About Section - Only show if bio exists */}
                        {organizer?.bio && organizer.bio.trim() !== '' && (
                            <Card className="p-6 bg-white dark:bg-zinc-900 rounded-2xl">
                                <h2 className="text-lg font-bold text-zinc-900 dark:text-white mb-4">About</h2>
                                <p className="text-zinc-600 dark:text-zinc-400 whitespace-pre-wrap leading-relaxed">
                                    {organizer.bio}
                                </p>
                            </Card>
                        )}

                        {/* Contact Info */}
                        <Card className="p-6 bg-white dark:bg-zinc-900 rounded-2xl">
                            <h2 className="text-lg font-bold text-zinc-900 dark:text-white mb-4">Contact</h2>
                            <div className="space-y-4">
                                {displayEmail && (
                                    <a 
                                        href={`mailto:${displayEmail}`}
                                        className="flex items-center gap-3 text-zinc-600 dark:text-zinc-400 hover:text-primary transition-colors"
                                    >
                                        <div className="w-10 h-10 bg-zinc-100 dark:bg-zinc-800 rounded-full flex items-center justify-center">
                                            <Mail size={18} />
                                        </div>
                                        <span className="text-sm">{displayEmail}</span>
                                    </a>
                                )}
                                
                                {organizer?.showPhonePublicly && displayPhone && displayPhone.trim() !== '' && (
                                    <a 
                                        href={`tel:${displayPhone}`}
                                        className="flex items-center gap-3 text-zinc-600 dark:text-zinc-400 hover:text-primary transition-colors"
                                    >
                                        <div className="w-10 h-10 bg-zinc-100 dark:bg-zinc-800 rounded-full flex items-center justify-center">
                                            <Phone size={18} />
                                        </div>
                                        <span className="text-sm">{displayPhone}</span>
                                    </a>
                                )}

                                {isValidSocialUrl(organizer?.socials?.website) && (
                                    <a 
                                        href={organizer!.socials!.website}
                                        target="_blank"
                                        rel="noreferrer"
                                        className="flex items-center gap-3 text-zinc-600 dark:text-zinc-400 hover:text-primary transition-colors"
                                    >
                                        <div className="w-10 h-10 bg-zinc-100 dark:bg-zinc-800 rounded-full flex items-center justify-center">
                                            <Globe size={18} />
                                        </div>
                                        <span className="text-sm truncate">{organizer!.socials!.website!.replace(/^https?:\/\//, '')}</span>
                                    </a>
                                )}
                            </div>
                        </Card>

                        {/* Social Links - Only show if organizer has valid social links */}
                        {hasSocialLinks && (
                            <Card className="p-6 bg-white dark:bg-zinc-900 rounded-2xl">
                                <h2 className="text-lg font-bold text-zinc-900 dark:text-white mb-4">Social</h2>
                                <div className="flex flex-wrap gap-3">
                                    {isValidSocialUrl(organizer?.socials?.instagram) && (
                                        <a 
                                            href={organizer!.socials!.instagram!} 
                                            target="_blank" 
                                            rel="noreferrer" 
                                            className="w-12 h-12 bg-gradient-to-br from-purple-500 to-pink-500 rounded-xl flex items-center justify-center text-white hover:scale-110 transition-transform"
                                            title="Instagram"
                                        >
                                            <Instagram size={22} />
                                        </a>
                                    )}
                                    {isValidSocialUrl(organizer?.socials?.facebook) && (
                                        <a 
                                            href={organizer!.socials!.facebook!} 
                                            target="_blank" 
                                            rel="noreferrer" 
                                            className="w-12 h-12 bg-blue-600 rounded-xl flex items-center justify-center text-white hover:scale-110 transition-transform"
                                            title="Facebook"
                                        >
                                            <Facebook size={22} />
                                        </a>
                                    )}
                                    {isValidSocialUrl(organizer?.socials?.x) && (
                                        <a 
                                            href={organizer!.socials!.x!} 
                                            target="_blank" 
                                            rel="noreferrer" 
                                            className="w-12 h-12 bg-black rounded-xl flex items-center justify-center text-white hover:scale-110 transition-transform"
                                            title="X (Twitter)"
                                        >
                                            <Twitter size={22} />
                                        </a>
                                    )}
                                    {isValidSocialUrl(organizer?.socials?.youtube) && (
                                        <a 
                                            href={organizer!.socials!.youtube!} 
                                            target="_blank" 
                                            rel="noreferrer" 
                                            className="w-12 h-12 bg-red-600 rounded-xl flex items-center justify-center text-white hover:scale-110 transition-transform"
                                            title="YouTube"
                                        >
                                            <Youtube size={22} />
                                        </a>
                                    )}
                                    {isValidSocialUrl(organizer?.socials?.tiktok) && (
                                        <a 
                                            href={organizer!.socials!.tiktok!} 
                                            target="_blank" 
                                            rel="noreferrer" 
                                            className="w-12 h-12 bg-black rounded-xl flex items-center justify-center text-white hover:scale-110 transition-transform"
                                            title="TikTok"
                                        >
                                            <Smartphone size={22} />
                                        </a>
                                    )}
                                </div>
                            </Card>
                        )}
                    </div>

                    {/* Right Column - Events */}
                    <div className="lg:col-span-2">
                        <div className="flex items-center justify-between mb-6">
                            <h2 className="text-2xl font-bold text-zinc-900 dark:text-white">Upcoming Events</h2>
                            <span className="text-sm text-zinc-500">{events.length} events</span>
                        </div>

                        {events.length === 0 ? (
                            <Card className="p-12 text-center bg-white dark:bg-zinc-900 rounded-2xl border-2 border-dashed border-zinc-200 dark:border-zinc-800">
                                <Calendar className="mx-auto h-16 w-16 text-zinc-300 dark:text-zinc-700 mb-4" />
                                <h3 className="text-xl font-bold text-zinc-900 dark:text-white mb-2">No Upcoming Events</h3>
                                <p className="text-zinc-500">This organizer hasn't scheduled any public events yet.</p>
                            </Card>
                        ) : (
                            <div className="space-y-4">
                                {events.map(event => (
                                    <Link key={event.id} to={`/event/${event.id}`} className="group block">
                                        <Card className="p-0 overflow-hidden bg-white dark:bg-zinc-900 hover:shadow-xl transition-all duration-300 hover:-translate-y-1 rounded-2xl">
                                            <div className="flex flex-col sm:flex-row">
                                                {/* Event Image */}
                                                <div className="relative w-full sm:w-48 h-40 sm:h-auto flex-shrink-0 overflow-hidden">
                                                    {event.imageUrl ? (
                                                        <img
                                                            src={event.imageUrl}
                                                            alt={event.title}
                                                            className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500"
                                                        />
                                                    ) : (
                                                        <div className="w-full h-full bg-zinc-100 dark:bg-zinc-800 flex items-center justify-center text-zinc-400">
                                                            <ImageIcon size={32} />
                                                        </div>
                                                    )}
                                                    <div className="absolute top-3 left-3">
                                                        <Badge color={event.priceType === 'free' ? 'green' : event.priceType === 'donation' ? 'purple' : 'blue'}>
                                                            {event.priceType === 'free' ? 'Free' : event.priceType === 'donation' ? 'Donation' : `$${event.price}`}
                                                        </Badge>
                                                    </div>
                                                </div>

                                                {/* Event Info */}
                                                <div className="flex-1 p-5 flex flex-col justify-between">
                                                    <div>
                                                        <div className="flex items-center gap-2 text-sm font-bold text-primary mb-2">
                                                            <Calendar size={14} />
                                                            {new Date(event.date).toLocaleDateString(undefined, { 
                                                                weekday: 'short',
                                                                month: 'short', 
                                                                day: 'numeric' 
                                                            })} • {formatTime(event.time, event.timeFormat)}
                                                        </div>
                                                        <h3 className="text-xl font-bold text-zinc-900 dark:text-white mb-2 group-hover:text-primary transition-colors line-clamp-2">
                                                            {event.title}
                                                        </h3>
                                                        <div className="flex items-center text-zinc-500 text-sm">
                                                            <MapPin size={14} className="mr-1 flex-shrink-0" />
                                                            <span className="truncate">{event.location}</span>
                                                        </div>
                                                    </div>

                                                    <div className="flex items-center justify-between mt-4 pt-4 border-t border-zinc-100 dark:border-zinc-800">
                                                        <div className="flex items-center gap-2 text-sm text-zinc-500">
                                                            <Ticket size={14} />
                                                            <span>{event.registeredCount || 0} attending</span>
                                                        </div>
                                                        <span className="text-sm font-bold text-primary flex items-center gap-1 group-hover:gap-2 transition-all">
                                                            Get Tickets <ChevronRight size={16} />
                                                        </span>
                                                    </div>
                                                </div>
                                            </div>
                                        </Card>
                                    </Link>
                                ))}
                            </div>
                        )}
                    </div>
                </div>
            </div>
        </div>
    );
};
