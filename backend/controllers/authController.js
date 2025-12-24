import supabase from '../services/supabase.js';

export const signup = async (req, res) => {
    try {
        const { email, password, firstName, lastName } = req.body;
        const { data, error } = await supabase.auth.admin.createUser({
            email,
            password,
            user_metadata: { firstName, lastName },
            email_confirm: true
        });

        if (error) throw error;
        res.status(201).json({ user: data.user });
    } catch (error) {
        res.status(400).json({ error: error.message });
    }
};

export const login = async (req, res) => {
    try {
        const { email, password } = req.body;
        const { data, error } = await supabase.auth.signInWithPassword({ email, password });
        if (error) throw error;
        res.json({ session: data.session, user: data.user });
    } catch (error) {
        res.status(401).json({ error: error.message });
    }
};
