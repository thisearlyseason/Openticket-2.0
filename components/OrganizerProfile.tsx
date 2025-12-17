
import React, { useEffect, useState } from 'react';
import { useParams, Link } from 'react-router-dom';
import { Calendar, MapPin, Share2, Globe, Facebook, Instagram, Twitter, Youtube, Smartphone } from 'lucide-react';
import { StorageService } from '../services/storageService';
import { Event, User } from '../types';
import { Card, Badge, Button, ShareButtons, formatTime } from './UI';

export const OrganizerProfile = () => {
  const { id } = useParams<{ id: string }>();
  const [events, setEvents] = useState<Event[]>([]);
  const [organizer, setOrganizer] = useState<User | null>(null);
  const [showShare, setShowShare] = useState(false);

  useEffect(() => {
    const loadData = async () => {
        if (id) {
          // Fetch Organizer Details
          const user = await StorageService.getUserById(id);
          if (user) setOrganizer(user);

          // Fetch Events
          const allEvents = await StorageService.getEvents();
          const orgEvents = allEvents.filter(e => e.ownerId === id && e.visibility === 'public');
          setEvents(orgEvents.sort((a, b) => b.createdAt - a.createdAt));
        }
    };
    loadData();
  }, [id]);

  if (!id) {
      return <div className="text-center py-20 text-gray-500">Organizer not found.</div>;
  }

  const organizerName = organizer?.businessName || organizer?.name || 'Organizer';

  return (
    <div className="max-w-6xl mx-auto space-y-8 pb-20">
      {/* Profile Header */}
      <Card className="p-8 bg-gradient-to-r from-gray-900 to-gray-800 text-white border-none relative overflow-hidden" style={organizer?.headerImageUrl ? { backgroundImage: `url(${organizer.headerImageUrl})`, backgroundSize: 'cover', backgroundPosition: 'center' } : {}}>
        {/* Background Overlay */}
        <div className={`absolute inset-0 ${organizer?.headerImageUrl ? 'bg-black/60' : ''}`}></div>
        
        {/* Background Blur Effect (Only if no image) */}
        {!organizer?.headerImageUrl && (
            <div className="absolute top-0 right-0 w-64 h-64 bg-primary rounded-full mix-blend-overlay filter blur-[80px] opacity-20"></div>
        )}
        
        <div className="relative z-10 flex flex-col md:flex-row items-center md:items-start justify-between gap-6">
            <div className="flex flex-col items-center md:items-start text-center md:text-left">
                {organizer?.logoUrl ? (
                    <img src={organizer.logoUrl} alt={organizerName} className="w-24 h-24 rounded-full object-cover border-4 border-white/10 mb-4 bg-white" />
                ) : (
                    <div className="w-24 h-24 rounded-full bg-white/10 flex items-center justify-center text-3xl font-bold mb-4 border-4 border-white/10">
                        {organizerName.charAt(0)}
                    </div>
                )}
                
                <h1 className="text-4xl font-black mb-2 tracking-tight">{organizerName}</h1>
                <p className="text-gray-400 max-w-lg mb-6">{organizer?.businessType || 'Event Organizer'} • {events.length} Active Events</p>
                
                {/* Social Links */}
                {organizer?.socials && (
                    <div className="flex flex-wrap justify-center md:justify-start gap-3">
                        {organizer.socials.website && (
                            <a href={organizer.socials.website} target="_blank" rel="noreferrer" className="p-2 bg-white/10 rounded-full hover:bg-white/20 transition-colors text-white" title="Website">
                                <Globe size={20}/>
                            </a>
                        )}
                        {organizer.socials.instagram && (
                            <a href={organizer.socials.instagram} target="_blank" rel="noreferrer" className="p-2 bg-white/10 rounded-full hover:bg-white/20 transition-colors text-white" title="Instagram">
                                <Instagram size={20}/>
                            </a>
                        )}
                        {organizer.socials.facebook && (
                            <a href={organizer.socials.facebook} target="_blank" rel="noreferrer" className="p-2 bg-white/10 rounded-full hover:bg-white/20 transition-colors text-white" title="Facebook">
                                <Facebook size={20}/>
                            </a>
                        )}
                        {organizer.socials.tiktok && (
                            <a href={organizer.socials.tiktok} target="_blank" rel="noreferrer" className="p-2 bg-white/10 rounded-full hover:bg-white/20 transition-colors text-white" title="TikTok">
                                <Smartphone size={20}/>
                            </a>
                        )}
                        {organizer.socials.youtube && (
                            <a href={organizer.socials.youtube} target="_blank" rel="noreferrer" className="p-2 bg-white/10 rounded-full hover:bg-white/20 transition-colors text-white" title="YouTube">
                                <Youtube size={20}/>
                            </a>
                        )}
                        {organizer.socials.x && (
                            <a href={organizer.socials.x} target="_blank" rel="noreferrer" className="p-2 bg-white/10 rounded-full hover:bg-white/20 transition-colors text-white" title="X (Twitter)">
                                <Twitter size={20}/>
                            </a>
                        )}
                    </div>
                )}
            </div>

            <div className="relative">
                <Button variant="secondary" onClick={() => setShowShare(!showShare)} className="flex items-center shadow-lg">
                    <Share2 size={18} className="mr-2" /> Share Profile
                </Button>
                {showShare && (
                    <div className="absolute top-full right-0 mt-2 p-2 bg-white dark:bg-zinc-900 rounded-xl shadow-2xl z-20 w-72 border border-zinc-200 dark:border-zinc-800 animate-in fade-in slide-in-from-top-2">
                        <ShareButtons title={`Check out events by ${organizerName} on OpenTicket`} url={window.location.href} />
                    </div>
                )}
            </div>
        </div>
      </Card>

      <h2 className="text-2xl font-bold text-gray-900 dark:text-white px-1">Upcoming Events</h2>

      {events.length === 0 ? (
          <div className="text-center py-20 bg-zinc-50 dark:bg-zinc-900/50 rounded-3xl border-2 border-dashed border-zinc-200 dark:border-zinc-800">
              <Calendar className="mx-auto h-12 w-12 text-zinc-400 mb-4" />
              <p className="text-zinc-500 font-medium">No upcoming events listed.</p>
          </div>
      ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {events.map(event => (
              <Link key={event.id} to={`/event/${event.id}`} className="group">
                <Card className="h-full hover:shadow-xl transition-all duration-300 hover:-translate-y-1">
                  <div className="relative h-48 overflow-hidden">
                    <img 
                        src={event.imageUrl} 
                        alt={event.title} 
                        className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500" 
                    />
                    <div className="absolute top-3 right-3">
                        <Badge color={event.priceType === 'free' ? 'green' : event.priceType === 'donation' ? 'purple' : 'blue'}>
                            {event.priceType === 'free' ? 'Free' : event.priceType === 'donation' ? 'Donation' : `$${event.price}`}
                        </Badge>
                    </div>
                  </div>
                  <div className="p-5 flex flex-col h-[calc(100%-12rem)]">
                    <div className="text-xs font-bold text-primary mb-2 uppercase tracking-wide">
                        {new Date(event.date).toLocaleDateString(undefined, { month: 'short', day: 'numeric' })} • {formatTime(event.time, event.timeFormat)}
                    </div>
                    <h3 className="text-xl font-bold text-gray-900 dark:text-white mb-2 line-clamp-2 group-hover:text-primary transition-colors">
                        {event.title}
                    </h3>
                    <div className="flex items-center text-gray-500 text-sm mb-4">
                        <MapPin size={14} className="mr-1 shrink-0" />
                        <span className="truncate">{event.location}</span>
                    </div>
                    <div className="mt-auto pt-4 border-t border-gray-100 dark:border-zinc-800 flex justify-between items-center">
                        <span className="text-sm text-gray-500 font-medium">
                            {event.registeredCount > 0 ? `${event.registeredCount} going` : 'Be the first'}
                        </span>
                        <span className="text-sm font-bold text-primary flex items-center">
                            Get Tickets &rarr;
                        </span>
                    </div>
                  </div>
                </Card>
              </Link>
            ))}
          </div>
      )}
    </div>
  );
};