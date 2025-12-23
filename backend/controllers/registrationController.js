const supabase = require('../services/supabase');

exports.createRegistration = async (req, res) => {
    try {
        const registrationData = req.body;
        const { data, error } = await supabase
            .from('registrations')
            .insert([registrationData])
            .select();

        if (error) throw error;
        res.status(201).json({ registration: data[0] });
    } catch (error) {
        res.status(400).json({ error: error.message });
    }
};

exports.getRegistrationsByEvent = async (req, res) => {
    try {
        const { eventId } = req.params;
        const owner_id = req.user.uid;

        // Verify that the user owns the event
        const { data: event, error: eventError } = await supabase
            .from('events')
            .select('owner_id')
            .eq('id', eventId)
            .single();

        if (eventError || event.owner_id !== owner_id) {
            return res.status(403).json({ error: 'Unauthorized to view registrations for this event' });
        }

        const { data, error } = await supabase
            .from('registrations')
            .select('*')
            .eq('event_id', eventId);

        if (error) throw error;
        res.json({ registrations: data });
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
};

exports.updateRegistration = async (req, res) => {
    try {
        const { id } = req.params;
        const owner_id = req.user.uid;
        const updates = req.body;

        // Verify ownership of the event associated with this registration
        const { data: reg, error: regError } = await supabase
            .from('registrations')
            .select('event_id')
            .eq('id', id)
            .single();

        if (regError) throw regError;

        const { data: event, error: eventError } = await supabase
            .from('events')
            .select('owner_id')
            .eq('id', reg.event_id)
            .single();

        if (eventError || event.owner_id !== owner_id) {
            return res.status(403).json({ error: 'Unauthorized to update this registration' });
        }

        const { data, error } = await supabase
            .from('registrations')
            .update(updates)
            .eq('id', id)
            .select();

        if (error) throw error;
        res.json({ registration: data[0] });
    } catch (error) {
        res.status(400).json({ error: error.message });
    }
};
