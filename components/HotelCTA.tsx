
import React from 'react';
import { Bed, MapPin } from 'lucide-react';
import { Button } from './UI';

export const HotelCTA = ({ location }: { location?: string }) => {
    const searchUrl = `https://www.google.com/travel/hotels?q=${encodeURIComponent(location || 'hotels nearby')}`;

    return (
        <div className="relative overflow-hidden rounded-3xl bg-zinc-900 border border-zinc-800 p-8 my-8 text-center md:text-left group">
            {/* Neon Background Effects */}
            <div className="absolute top-0 right-0 w-64 h-64 bg-[#E0FF20] rounded-full mix-blend-overlay filter blur-[80px] opacity-10 group-hover:opacity-20 transition-opacity"></div>
            <div className="absolute bottom-0 left-0 w-64 h-64 bg-primary rounded-full mix-blend-overlay filter blur-[80px] opacity-10 group-hover:opacity-20 transition-opacity"></div>

            <div className="relative z-10 flex flex-col md:flex-row items-center justify-between gap-6">
                <div>
                    <div className="inline-block bg-[#E0FF20] text-black text-xs font-black uppercase px-3 py-1 rounded-full mb-3 transform -rotate-2">
                        Sleep is for the weak
                    </div>
                    <h3 className="text-3xl font-black text-white font-display italic tracking-tight mb-2">
                        BUT YOU STILL NEED A BED.
                    </h3>
                    <p className="text-zinc-400 font-medium max-w-md">
                        Don't be the one sleeping in your car. Find a awesome spot to crash near the venue.
                    </p>
                </div>

                <Button
                    onClick={() => window.open(searchUrl, '_blank')}
                    className="bg-white text-black dark:text-black hover:bg-[#E0FF20] border-none shadow-[0_0_20px_rgba(255,255,255,0.2)] h-14 px-8 text-lg font-black uppercase"
                >
                    <Bed size={24} className="mr-2" /> Find Hotels
                </Button>
            </div>
        </div>
    );
};
