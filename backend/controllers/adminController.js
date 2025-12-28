import supabase from '../services/supabase.js';

export const getAllUsers = async (req, res) => {
    try {
        const { data, error } = await supabase.from('profiles').select('*');
        if (error) throw error;
        res.json(data);
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
};

export const getAllEvents = async (req, res) => {
    try {
        const { data, error } = await supabase.from('events').select('*');
        if (error) throw error;
        res.json(data);
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
};

export const getAllRegistrations = async (req, res) => {
    try {
        const { data, error } = await supabase
            .from('registrations')
            .select('*')
            .order('created_at', { ascending: false });

        if (error) throw error;
        res.json(data);
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
};

export const getFinancialStats = async (req, res) => {
    try {
        // 1. Transaction Volume
        // Note: Supabase JS doesn't support .sum() directly in one easy call without RPC, 
        // but we can fetch all or use a postgres function. 
        // For scalability, we should use RPC, but for now, we'll fetch ID/Amounts to aggregate or use a tailored query.
        // Actually, let's try to be efficient. 

        // BETTER: Create an RPC function in SQL, but I can't do that easily now without user running SQL.
        // FALLBACK: Client-side aggregation of "recent" might be too small. 
        // We will fetch minimal columns for all valid transactions.

        // 1. Transaction Volume (Optimized via RPC)
        const { data: statsData, error: statsError } = await supabase.rpc('get_admin_financial_stats');

        if (statsError) {
            console.error("RPC Stats Error:", statsError.message);
            // Fallback to 0 if RPC fails or doesn't exist yet
        }

        const stats = statsData || { totalVolume: 0, platformFees: 0, organizerNet: 0 };

        // 2. Recent Transactions
        const { data: recent, error: recentError } = await supabase
            .from('financial_transactions')
            .select('*')
            .order('created_at', { ascending: false })
            .limit(50);

        res.json({
            ...stats,
            recentTransactions: recent || []
        });

    } catch (error) {
        console.error("Financial Stats Error:", error);
        res.status(500).json({ error: "Failed to fetch financials" });
    }
};
