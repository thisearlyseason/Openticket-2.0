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
    'visibility', 'is_draft', 'broadcasts' // Broadcasts are usually appended via a separate flow, but saving the array is sometimes done
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

        const { data, error } = await supabase
            .from('events')
            .upsert([{ ...safeData, owner_id }])
            .select();

        if (error) throw error;
        res.status(201).json({ event: data[0] });
    } catch (error) {
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

        res.json({ event: data });
    } catch (error) {
        res.status(404).json({ error: 'Event not found' });
    }
};

export const updateEvent = async (req, res) => {
    try {
        const { id } = req.params;
        const owner_id = req.user.uid;
        const updates = req.body;

        // SANITIZATION
        const safeUpdates = {};
        ALLOWED_EVENT_FIELDS.forEach(field => {
            if (updates[field] !== undefined) safeUpdates[field] = updates[field];
        });

        // Ensure we don't accidentally wipe out the whole record if safeUpdates is empty, 
        // though typically that just does nothing.

        const { data, error } = await supabase
            .from('events')
            .update(safeUpdates)
            .eq('id', id)
            .eq('owner_id', owner_id)
            .select();

        if (error) throw error;

        // Check if ANY row was returned (meaning update happened)
        if (!data || data.length === 0) {
            return res.status(404).json({ error: "Event not found or unauthorized" });
        }

        res.json({ event: data[0] });
    } catch (error) {
        res.status(400).json({ error: error.message });
    }
};

export const deleteEvent = async (req, res) => {
    try {
        const { id } = req.params;
        const owner_id = req.user.uid;

        const { error } = await supabase
            .from('events')
            .delete()
            .eq('id', id)
            .eq('owner_id', owner_id);

        if (error) throw error;
        res.json({ status: 'deleted' });
    } catch (error) {
        res.status(400).json({ error: error.message });
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
