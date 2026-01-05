import supabase from '../services/supabase.js';

export const getAllUsers = async (req, res) => {
    try {
        const { data, error } = await supabase.from('profiles').select('*');
        if (error) throw error;
        
        // Map snake_case to camelCase for frontend compatibility
        const mappedUsers = (data || []).map(user => ({
            id: user.id,
            email: user.email,
            name: user.name,
            role: user.role,
            isAdmin: user.is_admin || false,
            businessName: user.business_name,
            businessType: user.business_type,
            imageUrl: user.image_url,
            bio: user.bio,
            socials: user.socials,
            location: user.location,
            website: user.website,
            subscription: user.subscription,
            stripeConnectId: user.stripe_connect_id,
            stripeOnboardingComplete: user.stripe_onboarding_complete,
            stripePublishableKey: user.stripe_publishable_key,
            stripeSecretKey: user.stripe_secret_key,
            affiliateCode: user.affiliate_code,
            affiliateClicks: user.affiliate_clicks || 0,
            commissionRate: user.commission_rate || 10,
            totalPaidOut: user.total_paid_out || 0,
            availablePayout: user.available_payout || 0,
            balanceDue: user.balance_due || 0,
            referredBy: user.referred_by,
            createdAt: user.created_at,
            onboardingStep: user.onboarding_step,
            invoices: user.invoices || [],
            teamMembers: user.team_members || [],
            notifications: user.notifications,
            primaryColor: user.primary_color,
            logoUrl: user.logo_url,
            headerImageUrl: user.header_image_url,
            organizerSubtitle: user.organizer_subtitle
        }));
        
        res.json(mappedUsers);
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
};

export const getAllEvents = async (req, res) => {
    try {
        const { data, error } = await supabase.from('events').select(`
            *,
            owner:profiles!owner_id(id, name, email, business_name)
        `);
        if (error) throw error;
        
        // Map snake_case to camelCase for frontend compatibility
        const mappedEvents = (data || []).map(event => ({
            id: event.id,
            title: event.title,
            description: event.description,
            ownerId: event.owner_id,
            ownerName: event.owner?.name || event.owner?.business_name || event.owner?.email || 'Unknown',
            location: event.location,
            date: event.date,
            time: event.time,
            imageUrl: event.image_url,
            status: event.status,
            visibility: event.visibility,
            category: event.category,
            ticketTiers: event.ticket_tiers || [],
            addOns: event.add_ons || [],
            registeredCount: event.registered_count || 0,
            capacity: event.capacity,
            customQuestions: event.custom_questions || [],
            waiverEnabled: event.waiver_enabled,
            createdAt: event.created_at,
            updatedAt: event.updated_at
        }));
        
        res.json(mappedEvents);
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
};

export const getAllRegistrations = async (req, res) => {
    try {
        const { data, error } = await supabase
            .from('registrations')
            .select(`
                *,
                event:events(id, title, owner_id)
            `)
            .order('created_at', { ascending: false });

        if (error) throw error;
        
        // Map snake_case to camelCase for frontend compatibility
        const mappedData = (data || []).map(reg => ({
            id: reg.id,
            eventId: reg.event_id,
            attendeeName: reg.attendee_name,
            attendeeEmail: reg.attendee_email,
            phoneNumber: reg.phone_number,
            donationAmount: reg.donation_amount || 0,
            platformDonationAmount: reg.platform_donation_amount || 0,
            serviceFee: reg.service_fee || 0,
            taxAmount: reg.tax_amount || 0,
            customFeesAmount: reg.custom_fees_amount || 0,
            totalAmount: reg.total_amount || 0,
            answers: reg.answers || {},
            selectedDates: reg.selected_dates,
            tickets: reg.tickets || [],
            addOns: reg.add_ons || [],
            promoCodeUsed: reg.promo_code_used,
            affiliateCode: reg.affiliate_code,
            discountAmount: reg.discount_amount || 0,
            timestamp: reg.created_at ? new Date(reg.created_at).getTime() : Date.now(),
            paymentStatus: reg.payment_status || 'pending',
            approvalStatus: reg.approval_status || 'pending',
            checkedIn: reg.checked_in || false,
            checkInTime: reg.check_in_time,
            checkInStatuses: reg.check_in_statuses || {},
            waiverAgreed: reg.waiver_agreed || false,
            refundedAmount: reg.refunded_amount || 0,
            refundReason: reg.refund_reason,
            source: reg.source || 'online',
            stripePaymentIntentId: reg.stripe_payment_intent_id,
            stripeCheckoutSessionId: reg.stripe_checkout_session_id,
            stripeFee: reg.stripe_fee || 0,
            // Include nested event data
            eventTitle: reg.event?.title || 'Unknown Event',
            eventOwnerId: reg.event?.owner_id
        }));
        
        res.json(mappedData);
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
};

/**
 * Get comprehensive financial statistics for admin dashboard
 */
export const getFinancialStats = async (req, res) => {
    try {
        // 1. Try to use RPC for aggregated stats
        let stats = {
            totalVolume: 0,
            platformFees: 0,
            organizerNet: 0,
            refundTotal: 0,
            platformDonations: 0,
        };

        try {
            const { data: rpcStats, error: rpcError } = await supabase.rpc('get_admin_financial_stats');
            if (!rpcError && rpcStats) {
                stats = {
                    totalVolume: Number(rpcStats.totalVolume) || 0,
                    platformFees: Number(rpcStats.platformFees) || 0,
                    organizerNet: Number(rpcStats.organizerNet) || 0,
                    refundTotal: Number(rpcStats.refundTotal) || 0,
                    platformDonations: Number(rpcStats.platformDonations) || 0,
                };
            }
        } catch (rpcErr) {
            console.warn('RPC stats not available, falling back to manual calculation:', rpcErr.message);
            
            // Fallback: Manual aggregation
            const { data: transactions } = await supabase
                .from('financial_transactions')
                .select('gross_amount, platform_fee, organizer_net');

            if (transactions) {
                transactions.forEach(tx => {
                    if (tx.gross_amount > 0) {
                        stats.totalVolume += Number(tx.gross_amount) || 0;
                        stats.platformFees += Number(tx.platform_fee) || 0;
                        stats.organizerNet += Number(tx.organizer_net) || 0;
                    } else {
                        stats.refundTotal += Math.abs(Number(tx.gross_amount) || 0);
                    }
                });
            }
        }

        // 1b. Get platform donations from registrations
        try {
            const { data: donationData } = await supabase
                .from('registrations')
                .select('platform_donation_amount')
                .not('platform_donation_amount', 'is', null);

            if (donationData) {
                stats.platformDonations = donationData.reduce((sum, r) => 
                    sum + (Number(r.platform_donation_amount) || 0), 0);
            }
        } catch (donErr) {
            console.warn('Donation stats not available:', donErr.message);
        }

        // 2. Get recent transactions
        const { data: recentTransactions, error: recentError } = await supabase
            .from('financial_transactions')
            .select(`
                *,
                registration:registrations(attendee_name, attendee_email),
                event:events(title, owner_id)
            `)
            .order('created_at', { ascending: false })
            .limit(50);

        // 3. Get per-organizer breakdown
        const { data: organizerStats } = await supabase
            .from('financial_transactions')
            .select('event:events(owner_id, owner:profiles!owner_id(name, email)), organizer_net, platform_fee, gross_amount')
            .gt('gross_amount', 0);

        const organizerBreakdown = {};
        if (organizerStats) {
            organizerStats.forEach(tx => {
                const ownerId = tx.event?.owner_id;
                if (!ownerId) return;
                
                if (!organizerBreakdown[ownerId]) {
                    organizerBreakdown[ownerId] = {
                        organizerId: ownerId,
                        organizerName: tx.event?.owner?.name || 'Unknown',
                        organizerEmail: tx.event?.owner?.email || '',
                        totalVolume: 0,
                        platformFees: 0,
                        netEarnings: 0,
                        transactionCount: 0,
                    };
                }
                
                organizerBreakdown[ownerId].totalVolume += Number(tx.gross_amount) || 0;
                organizerBreakdown[ownerId].platformFees += Number(tx.platform_fee) || 0;
                organizerBreakdown[ownerId].netEarnings += Number(tx.organizer_net) || 0;
                organizerBreakdown[ownerId].transactionCount += 1;
            });
        }

        res.json({
            ...stats,
            recentTransactions: recentTransactions || [],
            organizerBreakdown: Object.values(organizerBreakdown),
        });

    } catch (error) {
        console.error("Financial Stats Error:", error);
        res.status(500).json({ error: "Failed to fetch financials" });
    }
};

/**
 * Get financial details for a specific event (for organizer dashboard)
 */
export const getEventFinancials = async (req, res) => {
    try {
        const { eventId } = req.params;
        const userId = req.user.uid;

        // Verify ownership
        const { data: event, error: eventError } = await supabase
            .from('events')
            .select('owner_id')
            .eq('id', eventId)
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

        // Try RPC first
        let financials = null;
        try {
            const { data: rpcData, error: rpcError } = await supabase.rpc('get_organizer_event_financials', {
                p_event_id: eventId
            });
            if (!rpcError && rpcData) {
                financials = rpcData;
            }
        } catch (e) {
            console.warn('RPC not available, falling back');
        }

        // Fallback to manual calculation
        if (!financials) {
            const { data: transactions } = await supabase
                .from('financial_transactions')
                .select('*')
                .eq('event_id', eventId);

            financials = {
                grossSales: 0,
                platformFees: 0,
                stripeFees: 0,
                taxCollected: 0,
                netEarnings: 0,
                refundedAmount: 0,
                transactionCount: 0,
                refundCount: 0,
            };

            if (transactions) {
                transactions.forEach(tx => {
                    if (tx.gross_amount > 0) {
                        financials.grossSales += Number(tx.gross_amount) || 0;
                        financials.platformFees += Number(tx.platform_fee) || 0;
                        financials.stripeFees += Number(tx.stripe_fee) || 0;
                        financials.taxCollected += Number(tx.tax_amount) || 0;
                        financials.netEarnings += Number(tx.organizer_net) || 0;
                        financials.transactionCount += 1;
                    } else {
                        financials.refundedAmount += Math.abs(Number(tx.gross_amount) || 0);
                        financials.refundCount += 1;
                    }
                });
            }
        }

        // Get transaction list
        const { data: transactionList } = await supabase
            .from('financial_transactions')
            .select('*, registration:registrations(attendee_name, attendee_email)')
            .eq('event_id', eventId)
            .order('created_at', { ascending: false });

        res.json({
            summary: financials,
            transactions: transactionList || [],
        });

    } catch (error) {
        console.error("Event Financials Error:", error);
        res.status(500).json({ error: error.message });
    }
};
