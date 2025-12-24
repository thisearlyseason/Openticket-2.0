import supabase from '../services/supabase.js';

export const syncProfile = async (req, res) => {
    try {
        const { uid } = req.user;
        const updates = req.body;

        const profileData = {
            id: uid,
            ...updates,
            updated_at: new Date()
        };

        const { data, error } = await supabase
            .from('profiles')
            .upsert([profileData])
            .select();

        if (error) throw error;
        res.json({ profile: data[0] });
    } catch (error) {
        console.error('Profile Sync Error:', error);
        res.status(500).json({ error: error.message });
    }
};

export const getProfile = async (req, res) => {
    try {
        const { uid } = req.user;
        const { data, error } = await supabase
            .from('profiles')
            .select('*')
            .eq('id', uid)
            .single();

        if (error) throw error;
        res.json({ profile: data });
    } catch (error) {
        res.status(404).json({ error: 'Profile not found' });
    }
};

export const getProfileById = async (req, res) => {
    try {
        const { id } = req.params;
        const { data, error } = await supabase
            .from('profiles')
            .select('*')
            .eq('id', id)
            .single();

        if (error) throw error;
        res.json({ profile: data });
    } catch (error) {
        res.status(404).json({ error: 'Profile not found' });
    }
};
