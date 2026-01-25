// Add this at the end of the file before export

export const getEventStats = async (req, res) => {
    try {
        const { id } = req.params;
        const userId = req.user.uid;

        // Verify ownership
        const { data: event, error: eventError } = await supabase
            .from('events')
            .select('owner_id')
            .eq('id', id)
            .single();

        if (eventError || !event) {
            return res.status(404).json({ error: 'Event not found' });
        }

        // Check admin or owner
        const { data: profile } = await supabase
            .from('profiles')
            .select('is_admin')
            .eq('id', userId)
            .single();

        if (event.owner_id !== userId && !profile?.is_admin) {
            return res.status(403).json({ error: 'Unauthorized' });
        }

        // Get registrations for this event
        const { data: registrations, error: regError } = await supabase
            .from('registrations')
            .select('*')
            .eq('event_id', id);

        if (regError) {
            console.error('[EventStats] Error fetching registrations:', regError);
            return res.status(500).json({ error: 'Failed to fetch stats' });
        }

        // Calculate stats - exclude refunded
        const paidRegs = registrations.filter(r => 
            ['paid', 'succeeded', 'completed'].includes(r.payment_status) &&
            r.payment_status !== 'refunded'
        );

        let total = 0;
        let checkedIn = 0;

        paidRegs.forEach(reg => {
            if (reg.tickets && Array.isArray(reg.tickets)) {
                reg.tickets.forEach(ticket => {
                    if (ticket.status !== 'refunded') {
                        total += (ticket.quantity || 1);
                        if (ticket.checkedIn) {
                            checkedIn += (ticket.quantity || 1);
                        }
                    }
                });
            } else {
                total += 1;
                if (reg.checked_in) {
                    checkedIn += 1;
                }
            }
        });

        const pending = total - checkedIn;

        res.json({
            total,
            checkedIn,
            pending
        });

    } catch (error) {
        console.error('[EventStats] Error:', error);
        res.status(500).json({ error: 'Failed to calculate stats' });
    }
};