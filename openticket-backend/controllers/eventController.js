const supabase = require('../services/supabase');

exports.createEvent = async (req, res) => {
    try {
        const eventData = req.body;
        // Auth Bridge: Use verified Firebase UID
        const owner_id = req.user.uid;

        const { data, error } = await supabase
            .from('events')
            .upsert([{ ...eventData, owner_id }])
            .select();

        if (error) throw error;
        res.status(201).json({ event: data[0] });
    } catch (error) {
        res.status(400).json({ error: error.message });
    }
};

exports.getEvents = async (req, res) => {
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

exports.getEventById = async (req, res) => {
    try {
        const { id } = req.params;
        const { data, error } = await supabase
            .from('events')
            .select('*')
            .eq('id', id)
            .single();

        if (error) throw error;
        res.json({ event: data });
    } catch (error) {
        res.status(404).json({ error: 'Event not found' });
    }
};

exports.updateEvent = async (req, res) => {
    try {
        const { id } = req.params;
        const owner_id = req.user.uid;
        const updates = req.body;

        const { data, error } = await supabase
            .from('events')
            .update(updates)
            .eq('id', id)
            .eq('owner_id', owner_id)
            .select();

        if (error) throw error;
        res.json({ event: data[0] });
    } catch (error) {
        res.status(400).json({ error: error.message });
    }
};

exports.deleteEvent = async (req, res) => {
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

exports.getPublicEvents = async (req, res) => {
    try {
        const { data, error } = await supabase
            .from('events')
            .select('*')
            .eq('is_draft', false)
            .eq('visibility', 'public');

        if (error) throw error;
        res.json({ events: data });
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
};
