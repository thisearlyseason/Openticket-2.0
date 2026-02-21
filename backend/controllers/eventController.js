import supabase from '../services/supabase.js';

const ALLOWED_EVENT_FIELDS = [
    'title', 'subtitle', 'description', 'category', 'event_type',
    'date', 'time', 'end_date', 'end_time', 'duration',
    'is_recurring', 'recurring_dates', 'time_format', 'timeline',
    'location', 'venue_name', 'online_url',
    'image_url', 'cover_image_position', 'gallery',
    'price_type', 'price', 'ticket_name', 'ticket_tiers', 'add_ons',
    'capacity', 'promo_codes', 'tax_rate', 'absorb_fees', 'custom_fees',
    'questions', 'requires_approval', 'confirmation_message', 'refund_policy',
    'waiver_config', 'schedule_config',
    'tags', 'tracking_pixels', 'remarketing', 'seo',
    'ticket_design', 'email_settings', 'notifications', 'reminders',
    'payment_config', 'organizer', 'organizer_email', 'organizer_phone', 'organizer_website',
    'visibility', 'is_draft', 'broadcasts', // Broadcasts are usually appended via a separate flow, but saving the array is sometimes done
    'presale', 'waitlist_config' // Presale and waitlist configuration
];

export const createEvent = async (req, res) => {
    try {
        const eventData = req.body;
        // Auth Bridge: Use verified Firebase UID
        const owner_id = req.user.uid;

        // SANITIZATION
        const safeData = {};
        ALLOWED_EVENT_FIELDS.forEach(field => {
            if (eventData[field] !== undefined) safeData[field] = eventData[field];
        });

        let { data, error } = await supabase
            .from('events')
            .upsert([{ ...safeData, owner_id }])
            .select();

        // Handle missing column errors gracefully (until migration is run)
        // Check both error.code and error message for schema column errors
        const isMissingColumnError = error && (
            error.code === '42703' || 
            error.message?.includes('schema cache') ||
            error.message?.includes('column')
        );
        
        if (isMissingColumnError) {
            console.warn('[Event] Schema column missing, retrying with core fields only...');
            console.warn('[Event] Original error:', error);
            
            // Only use core columns that definitely exist in the database
            // Remove all potentially missing columns
            const { 
                ticket_design, email_settings, cover_image_position, gallery,
                duration, timeline, schedule_config, waiver_config,
                ticket_tiers, add_ons, promo_codes, custom_fees,
                tracking_pixels, remarketing, seo, notifications, reminders,
                payment_config, broadcasts, presale, waitlist_config,
                recurring_dates, time_format,
                ...fallbackData 
            } = safeData;
            
            const fallbackResult = await supabase
                .from('events')
                .upsert([{ ...fallbackData, owner_id }])
                .select();
            data = fallbackResult.data;
            error = fallbackResult.error;
            
            if (!error) {
                console.log('[Event] Successfully created event with core fields');
            } else {
                console.error('[Event] Fallback also failed:', error);
            }
        }

        if (error) throw error;
        res.status(201).json({ event: data[0] });
    } catch (error) {
        console.error('[Event] Create event error:', error);
        res.status(400).json({ error: error.message });
    }
};

export const getEvents = async (req, res) => {
    try {
        const owner_id = req.user.uid;
        const { data, error } = await supabase
            .from('events')
            .select('*')
            .eq('owner_id', owner_id);

        if (error) throw error;
        res.json({ events: data });
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
};

// Public Event View (Sanitized)
export const getEventById = async (req, res) => {
    try {
        const { id } = req.params;
        const { data, error } = await supabase
            .from('events')
            .select('*')
            .eq('id', id)
            .single();

        if (error) throw error;

        // SECURITY: Sanitize private fields
        if (data) {
            delete data.broadcasts;
            delete data.revenue_stats; // If exists
        }

        res.json({ event: data });
    } catch (error) {
        res.status(404).json({ error: 'Event not found' });
    }
};

// Organizer Full View (Authenticated)
export const getEventFull = async (req, res) => {
    try {
        const { id } = req.params;
        const owner_id = req.user.uid;

        const { data, error } = await supabase
            .from('events')
            .select('*')
            .eq('id', id)
            .single();

        if (error) throw error;

        // Verify Ownership
        if (data.owner_id !== owner_id) {
            // Admin override could go here
            return res.status(403).json({ error: "Unauthorized" });
        }

        console.log('[Event Full] Returning event with presale:', data.presale);
        res.json({ event: data });
    } catch (error) {
        res.status(404).json({ error: 'Event not found' });
    }
};

export const updateEvent = async (req, res) => {
    try {
        const { id } = req.params;
        const userId = req.user.uid;
        const updates = req.body;

        console.log('[Event Update] Received updates for event:', id);
        console.log('[Event Update] Presale data:', updates.presale);

        // ========== IDOR PROTECTION: Verify Ownership ==========
        const { data: existingEvent, error: fetchError } = await supabase
            .from('events')
            .select('owner_id')
            .eq('id', id)
            .single();

        if (fetchError || !existingEvent) {
            return res.status(404).json({ error: 'Event not found' });
        }

        // Check ownership or admin status
        const { data: userProfile } = await supabase
            .from('profiles')
            .select('is_admin')
            .eq('id', userId)
            .single();

        const isAdmin = userProfile?.is_admin === true;
        const isOwner = existingEvent.owner_id === userId;

        if (!isOwner && !isAdmin) {
            console.error('[Security] IDOR attempt - updateEvent', {
                userId,
                eventId: id,
                actualOwnerId: existingEvent.owner_id
            });
            return res.status(403).json({ error: 'Unauthorized' });
        }
        // ========== END IDOR PROTECTION ==========

        // SANITIZATION
        const safeUpdates = {};
        ALLOWED_EVENT_FIELDS.forEach(field => {
            if (updates[field] !== undefined) safeUpdates[field] = updates[field];
        });

        console.log('[Event Update] Safe updates keys:', Object.keys(safeUpdates));
        console.log('[Event Update] Safe updates presale:', safeUpdates.presale);

        // Ensure we don't accidentally wipe out the whole record if safeUpdates is empty, 
        // though typically that just does nothing.

        let { data, error } = await supabase
            .from('events')
            .update(safeUpdates)
            .eq('id', id)
            .eq('owner_id', owner_id)
            .select();

        // Handle missing column errors gracefully (until migration is run)
        if (error && error.code === '42703') {
            console.warn('[Event Update] Schema column missing, retrying without ticket_design/email_settings...');
            const { ticket_design, email_settings, ...fallbackUpdates } = safeUpdates;
            const fallbackResult = await supabase
                .from('events')
                .update(fallbackUpdates)
                .eq('id', id)
                .eq('owner_id', owner_id)
                .select();
            data = fallbackResult.data;
            error = fallbackResult.error;
        }

        if (error) throw error;

        // Check if ANY row was returned (meaning update happened)
        if (!data || data.length === 0) {
            return res.status(404).json({ error: "Event not found or unauthorized" });
        }

        console.log('[Event Update] Update successful. Result presale:', data?.[0]?.presale);
        res.json({ event: data[0] });
    } catch (error) {
        res.status(400).json({ error: error.message });
    }
};

export const deleteEvent = async (req, res) => {
    try {
        const { id } = req.params;
        const userId = req.user.uid;

        // ========== IDOR PROTECTION: Verify Ownership ==========
        const { data: existingEvent, error: fetchError } = await supabase
            .from('events')
            .select('owner_id')
            .eq('id', id)
            .single();

        if (fetchError || !existingEvent) {
            return res.status(404).json({ error: 'Event not found' });
        }

        // Check ownership or admin status
        const { data: userProfile } = await supabase
            .from('profiles')
            .select('is_admin')
            .eq('id', userId)
            .single();

        const isAdmin = userProfile?.is_admin === true;
        const isOwner = existingEvent.owner_id === userId;

        if (!isOwner && !isAdmin) {
            console.error('[Security] IDOR attempt - deleteEvent', {
                userId,
                eventId: id,
                actualOwnerId: existingEvent.owner_id
            });
            return res.status(403).json({ error: 'Unauthorized' });
        }
        // ========== END IDOR PROTECTION ==========

        const { error } = await supabase
            .from('events')
            .delete()
            .eq('id', id);

        if (error) throw error;
        res.json({ status: 'deleted' });
    } catch (error) {
        console.error('[Event Delete Error]', error);
        res.status(400).json({ error: 'Failed to delete event' });
    }
};

export const getPublicEvents = async (req, res) => {
    try {
        const today = new Date().toISOString().split('T')[0];
        const { data, error } = await supabase
            .from('events')
            .select('*')
            .eq('is_draft', false)
            .eq('visibility', 'public')
            .gte('date', today)
            .order('date', { ascending: true }); // Show nearest events first

        if (error) throw error;
        res.json({ events: data });
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
};


/**
 * Get event statistics (check-in status counts)
 * Used by mobile scanner and check-in interfaces
 * GET /api/events/:id/stats
 */
export const getEventStats = async (req, res) => {
    try {
        const { id } = req.params;
        const organizerId = req.user.uid;

        // Verify ownership
        const { data: event, error: eventError } = await supabase
            .from('events')
            .select('owner_id')
            .eq('id', id)
            .single();

        if (eventError || !event) {
            return res.status(404).json({ error: 'Event not found' });
        }

        if (event.owner_id !== organizerId) {
            return res.status(403).json({ error: 'Unauthorized' });
        }

        // Get all registrations for this event (EXCLUDE REFUNDED)
        // Only select 'tickets' and 'payment_status' which are guaranteed to exist
        const { data: registrations, error: regError } = await supabase
            .from('registrations')
            .select('tickets, payment_status')
            .eq('event_id', id)
            .not('payment_status', 'eq', 'refunded');

        if (regError) {
            console.error('[getEventStats] Query error:', regError);
            throw regError;
        }

        // Calculate stats from tickets array (which stores checkedIn status)
        let total = 0;
        let checkedIn = 0;

        for (const reg of registrations || []) {
            if (reg.tickets && Array.isArray(reg.tickets)) {
                for (const ticket of reg.tickets) {
                    // Skip refunded/cancelled tickets
                    if (ticket.status === 'refunded' || ticket.status === 'cancelled') {
                        continue;
                    }
                    total++;
                    if (ticket.checkedIn || ticket.status === 'used') {
                        checkedIn++;
                    }
                }
            } else {
                // Legacy registration without tickets array - count as 1 ticket, not checked in
                total++;
            }
        }

        res.json({
            total,
            checkedIn,
            pending: total - checkedIn
        });

    } catch (error) {
        console.error('[getEventStats] Error:', error);
        res.status(500).json({ error: error.message });
    }
};
