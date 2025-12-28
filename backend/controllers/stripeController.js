import Stripe from 'stripe';
import supabase from '../services/supabase.js';

// Fee Configuration (should match frontend/storageService logic)
const PLANS = {
    free: { feePercent: 0.0275, feeFixed: 0.99 }, // 2.75% + $0.99
    pro: { feePercent: 0.015, feeFixed: 0.75 }, // 1.5% + $0.75
    premium: { feePercent: 0.0075, feeFixed: 0 }, // 0.75% + $0
};

const calculateFees = (amount, planName) => {
    const plan = PLANS[planName] || PLANS['free'];
    if (amount <= 0) return 0;
    return Math.round(((amount * plan.feePercent) + plan.feeFixed) * 100) / 100;
};

export const createCheckoutSession = async (req, res) => {
    try {
        if (!process.env.STRIPE_SECRET_KEY) {
            throw new Error('STRIPE_SECRET_KEY is missing');
        }

        const stripe = new Stripe(process.env.STRIPE_SECRET_KEY, { apiVersion: '2023-10-16' });

        const {
            eventId,
            ticketSelections, // { [tierId]: quantity }
            addOnSelections,  // { [addonId]: quantity }
            promoCode,
            affiliateCode, // <--- Capture Affiliate Code
            customerEmail,
            customerName,
            userId // Extract userId to prevent ReferenceError
        } = req.body;

        const origin = req.headers.origin || 'http://localhost:3000';
        // Respect Frontend Routing (Hash vs Path) by using body param if available, else fallback to Hash (default for this app)
        const successUrl = req.body.successUrl || `${origin}/#/event/${eventId}?success=true`;
        const cancelUrl = req.body.cancelUrl || `${origin}/#/event/${eventId}?canceled=true`;

        // 1. Fetch Event & Owner from DB
        const { data: event, error: eventError } = await supabase
            .from('events')
            .select(`*, owner:owner_id (*)`) // Fetch full owner profile for plan/stripeId
            .eq('id', eventId)

            .single();

        if (eventError || !event) throw new Error('Event not found');

        // CAPACITY CHECK
        const totalRequested = Object.values(ticketSelections || {}).reduce((a, b) => a + Number(b), 0);
        if (event.capacity && (event.registered_count || 0) + totalRequested > event.capacity) {
            throw new Error("Event is sold out. Please refresh the page.");
        }

        const organizer = event.owner; // This might be an object if relation works, or we need separate fetch

        // If owner didn't load (depending on schema/RLS), fetch manually
        let ownerProfile = organizer;
        if (!ownerProfile || !ownerProfile.stripe_connect_id) {
            const { data: owner } = await supabase.from('profiles').select('*').eq('id', event.owner_id).single();
            ownerProfile = owner;
        }

        if (!ownerProfile) throw new Error('Organizer not found');
        if (!ownerProfile.stripe_connect_id) throw new Error('Organizer not connected to Stripe');

        // 2. Calculate Totals (Server-Side)
        let subtotal = 0;
        const line_items = [];
        const ticketSummary = [];

        // Tickets & Assignments
        const tickets = []; // Detailed array for DB

        if (ticketSelections) {
            const tiers = event.tickets || [];

            // Legacy/Simple Check
            if (tiers.length === 0 && event.price > 0 && ticketSelections['general']) {
                const qty = ticketSelections['general'];
                const price = (event.price_type === 'donation' || event.price_type === 'free') ? 0 : event.price;
                if (price > 0) {
                    subtotal += price * qty;
                    line_items.push({
                        price_data: { currency: 'usd', product_data: { name: `${event.title} - General Admission` }, unit_amount: Math.round(price * 100) },
                        quantity: qty
                    });
                    ticketSummary.push({ tierId: 'general', name: 'General Admission', quantity: qty, pricePerTicket: price });

                    // Build Detailed Tickets
                    const tierAssignments = req.body.assignments?.['general'] || [];
                    for (let i = 0; i < qty; i++) {
                        tickets.push({
                            tierId: 'general',
                            name: 'General Admission',
                            pricePerTicket: price,
                            attendeeName: tierAssignments[i]?.name || (i === 0 ? customerName : 'Guest'),
                            attendeeEmail: tierAssignments[i]?.email || (i === 0 ? customerEmail : ''),
                            status: 'pending'
                        });
                    }
                }
            } else {
                // Tiered
                for (const stats of tiers) {
                    const qty = ticketSelections[stats.id];
                    if (qty > 0) {
                        subtotal += stats.price * qty;
                        line_items.push({
                            price_data: { currency: 'usd', product_data: { name: `${event.title} - ${stats.name}` }, unit_amount: Math.round(stats.price * 100) },
                            quantity: qty
                        });
                        ticketSummary.push({ tierId: stats.id, name: stats.name, quantity: qty, pricePerTicket: stats.price });

                        // Build Detailed Tickets
                        const tierAssignments = req.body.assignments?.[stats.id] || [];
                        for (let i = 0; i < qty; i++) {
                            tickets.push({
                                tierId: stats.id,
                                name: stats.name,
                                pricePerTicket: stats.price,
                                attendeeName: tierAssignments[i]?.name || (i === 0 ? customerName : 'Guest'),
                                attendeeEmail: tierAssignments[i]?.email || (i === 0 ? customerEmail : ''),
                                status: 'pending'
                            });
                        }
                    }
                }
            }
        }

        // Add-ons
        const addOnSummary = [];
        if (addOnSelections && event.add_ons) {
            for (const addon of event.add_ons) {
                const qty = addOnSelections[addon.id];
                if (qty > 0) {
                    subtotal += addon.price * qty;
                    line_items.push({
                        price_data: { currency: 'usd', product_data: { name: `Add-on: ${addon.name}` }, unit_amount: Math.round(addon.price * 100) },
                        quantity: qty
                    });
                    addOnSummary.push({ id: addon.id, name: addon.name, price: addon.price, quantity: qty });
                }
            }
        }

        // Promo Code
        let discountAmount = 0;
        if (promoCode && event.promo_codes) {
            const promo = event.promo_codes.find(p => p.code === promoCode);
            if (promo) {
                if (promo.type === 'percent') discountAmount = subtotal * (promo.value / 100);
                else discountAmount = Math.min(subtotal, promo.value);

                const coupon = await stripe.coupons.create({
                    amount_off: promo.type === 'fixed' ? Math.round(discountAmount * 100) : undefined,
                    percent_off: promo.type === 'percent' ? promo.value : undefined,
                    currency: 'usd',
                    duration: 'once',
                    name: promoCode
                });
                sessionParams.discounts = [{ coupon: coupon.id }];
            }
        }

        // Recalculate Base for Tax/Fees (Subtotal - Discount)
        const baseForTax = Math.max(0, subtotal - discountAmount);

        // Tax
        let taxAmount = 0;
        if (event.tax_rate > 0) {
            taxAmount = baseForTax * (event.tax_rate / 100);
            if (taxAmount > 0) {
                line_items.push({
                    price_data: { currency: 'usd', product_data: { name: 'Sales Tax' }, unit_amount: Math.round(taxAmount * 100) },
                    quantity: 1
                });
            }
        }

        // Custom Fees
        let customFeesAmount = 0;
        if (event.custom_fees) {
            event.custom_fees.forEach(fee => {
                const feeAmt = fee.type === 'percent' ? (baseForTax * (fee.amount / 100)) : fee.amount;
                customFeesAmount += feeAmt;
                line_items.push({
                    price_data: { currency: 'usd', product_data: { name: 'Fees & Surcharges' }, unit_amount: Math.round(feeAmt * 100) },
                    quantity: 1
                });
            });
        }

        // Service Fee (Platform)
        // Calculated on Total (Base + Tax + Custom)
        const totalBeforeServiceFee = baseForTax + taxAmount + customFeesAmount;
        const plan = ownerProfile?.subscription?.plan || 'free';

        // Calculate the Fee regardless of who pays
        const calculatedFee = (event.price_type !== 'free') ? calculateFees(totalBeforeServiceFee, plan) : 0;

        let serviceFeeLineItem = 0;
        if (!event.absorb_fees && event.price_type !== 'free') {
            serviceFeeLineItem = calculatedFee;
            if (serviceFeeLineItem > 0) {
                line_items.push({
                    price_data: { currency: 'usd', product_data: { name: 'Service Fee' }, unit_amount: Math.round(serviceFeeLineItem * 100) },
                    quantity: 1
                });
            }
        } else {
            // If fees are absorbed, we DO NOT add a line item for the user.
            // The user pays 'totalBeforeServiceFee'.
            // The Platform must still collect 'calculatedFee' from that total via application_fee_amount.
        }

        const finalTotal = totalBeforeServiceFee + serviceFeeLineItem;

        if (finalTotal <= 0) {
            // Free order - handle differently? Frontend should handle free orders without Stripe.
            // But if we are here, frontend requested stripe.
            throw new Error("Total amount is 0. Please use free checkout.");
        }

        // 3. Create Stripe Session
        const sessionParams = {
            payment_method_types: ['card'],
            line_items,
            mode: 'payment',
            customer_email: customerEmail,
            success_url: `${successUrl}&session_id={CHECKOUT_SESSION_ID}`,
            cancel_url: cancelUrl,
            metadata: {
                eventId,
                userId: req.body.userId || 'guest',
                customerName,
                customerEmail,
                ticketSummary: JSON.stringify(ticketSummary),
                addOnSummary: JSON.stringify(addOnSummary),
                promoCode: promoCode || 'none',
                affiliateCode: affiliateCode || '', // <--- Add to Metadata
                serviceFee: calculatedFee.toFixed(2), // Metadata tracks the REAL platform fee
                taxAmount: taxAmount.toFixed(2),
                feesPaidBy: event.absorb_fees ? 'organizer' : 'attendee'
            },
        };

        // Only add transfer data if it's a REAL Stripe Connect account
        if (ownerProfile.stripe_connect_id && !ownerProfile.stripe_connect_id.startsWith('mock_')) {
            // CRITICAL FIX: Always collect the platform fee
            // If absorbed: User pays 100. Platform takes ~3.74. Organizer gets ~96.26.
            // If passed: User pays 103.74. Platform takes 3.74. Organizer gets 100.
            sessionParams.payment_intent_data = {
                application_fee_amount: Math.round(calculatedFee * 100),
                transfer_data: { destination: ownerProfile.stripe_connect_id },
            };
        }


        // Attach Coupon if created
        if (discountAmount > 0 && sessionParams.discounts?.length === 0) {
            // (handled in promo block)
        }

        const session = await stripe.checkout.sessions.create(sessionParams);

        // 4. Create PENDING Registration in DB
        // This ensures that when webhook fires, we update THIS record.
        const registrationData = {
            id: `reg_${session.id.slice(-10)}`, // Generate ID or let DB? DB usually has uuid. We construct one or use payload?
            // "reg-" + Date.now() style from frontend. We should stick to that or let DB handle it.
            // Let's fallback to DB default if possible, or generate one. "reg-<timestamp>"
            event_id: eventId,
            attendee_name: customerName,
            attendee_email: customerEmail,
            payment_status: 'pending_payment',
            approval_status: 'approved', // or pending
            tickets: tickets, // USE DETAILED TICKETS ARRAY
            add_ons: addOnSummary,
            service_fee: serviceFeeLineItem,
            tax_amount: taxAmount,
            custom_fees_amount: customFeesAmount,
            stripe_checkout_session_id: session.id,
            total_amount: finalTotal,
            // Link to User Account (Fix for "Tickets not saved")
            user_id: userId || null
        };

        const { error: regError } = await supabase.from('registrations').insert([registrationData]);
        if (regError) {
            console.error('Failed to create pending registration:', regError);
            throw new Error('System Error: Failed to initialize order. Please contact support.');
        }

        res.json({ sessionId: session.id, url: session.url });

    } catch (error) {
        console.error('Stripe Checkout Error:', error);
        res.status(500).json({ error: error.message || 'Failed to create checkout session' });
    }
};

export const processRefund = async (req, res) => {
    try {
        const { registrationId, updatedTickets, reason } = req.body;
        const ownerId = req.user.uid;

        // 1. Fetch Registration
        const { data: reg, error: regError } = await supabase
            .from('registrations')
            .select('*')
            .eq('id', registrationId)
            .single();

        if (regError || !reg) throw new Error("Registration not found");

        // 2. Verify Ownership (via Event)
        const { data: event, error: eventError } = await supabase
            .from('events')
            .select('owner_id')
            .eq('id', reg.event_id)
            .single();

        if (eventError || event.owner_id !== ownerId) throw new Error("Unauthorized");

        // 3. Validation
        const canRefundViaStripe = !!reg.stripe_payment_intent_id;
        const stripe = new Stripe(process.env.STRIPE_SECRET_KEY, { apiVersion: '2023-10-16' });

        // Helper to calc ticket value
        const calcValue = (tickets) => tickets.reduce((acc, t) => {
            const qty = t.status === 'refunded' ? 0 : t.quantity;
            return acc + (qty * (t.pricePerTicket || 0));
        }, 0);

        const isFullRefund = !updatedTickets || updatedTickets.length === 0;
        let refundAmount = 0;
        let newStatus = reg.payment_status;

        if (isFullRefund) {
            // Full Refund: Calculate current valid value
            refundAmount = calcValue(reg.tickets || []);

            // Refund via Stripe
            if (canRefundViaStripe && refundAmount > 0) {
                await stripe.refunds.create({
                    payment_intent: reg.stripe_payment_intent_id,
                    reason: 'requested_by_customer',
                    metadata: { reason, registrationId: reg.id }
                });
            }

            // Update DB
            newStatus = 'refunded';
            await supabase.from('registrations')
                .update({
                    payment_status: 'refunded',
                    approval_status: 'rejected',
                    refund_reason: reason
                })
                .eq('id', reg.id);
        } else {
            // Partial Refund
            const oldValue = calcValue(reg.tickets || []);
            const newValue = calcValue(updatedTickets);
            refundAmount = Math.max(0, oldValue - newValue); // Ensure positive diff

            if (refundAmount > 0.01 && canRefundViaStripe) {
                await stripe.refunds.create({
                    payment_intent: reg.stripe_payment_intent_id,
                    amount: Math.round(refundAmount * 100),
                    reason: 'requested_by_customer',
                    metadata: { reason, registrationId: reg.id }
                });
            }

            // Check if fully refunded
            const isNowFullyRefunded = updatedTickets.every(t => t.status === 'refunded');
            newStatus = isNowFullyRefunded ? 'refunded' : reg.payment_status;

            await supabase.from('registrations')
                .update({
                    tickets: updatedTickets, // Save the updated ticket statuses
                    payment_status: newStatus,
                    approval_status: isNowFullyRefunded ? 'rejected' : reg.approval_status
                })
                .eq('id', reg.id);
        }

        // 4. RECORD FINANCIAL TRANSACTION (LEDGER) - CRITICAL FIX
        if (refundAmount > 0) {
            const negativeAmount = -Math.abs(refundAmount);

            // Note: We are assuming for now that Platform Fees are NOT refunded to the organizer automatically.
            // If Stripe refunds the Application Fee, we should record that.
            // But usually, Stripe keeps their fee. 
            // So: Gross = -Audit, OrganizerNet = -Amount.
            // We set others to 0 unless we know otherwise.

            await supabase.from('financial_transactions').insert({
                event_id: reg.event_id,
                registration_id: reg.id,
                stripe_payment_intent_id: reg.stripe_payment_intent_id,
                transaction_type: 'refund',
                gross_amount: negativeAmount,
                organizer_net: negativeAmount, // The organizer loses this revenue
                platform_fee: 0, // We keep the fee? Or do we refund it? Safer to assume 0 change for now unless policy says otherwise.
                stripe_fee: 0,
                tax_amount: 0, // TODO: Calculate tax refund share
                status: 'succeeded',
                currency: 'usd'
            });
        }

        res.json({ success: true, message: canRefundViaStripe ? "Refund processed" : "Registration cancelled (No payment record)" });

    } catch (error) {
        console.error("Refund Error:", error);
        res.status(500).json({ error: error.message });
    }
};
// 5. Manual Payout Request (For Balances)
export const requestPayout = async (req, res) => {
    try {
        const ownerId = req.user.uid;
        const { mode } = req.body; // 'standard' or 'instant'

        // 1. Fetch Profile to check balance
        const { data: user, error: userError } = await supabase
            .from('profiles')
            .select('*')
            .eq('id', ownerId)
            .single();

        if (userError || !user) throw new Error("User not found");

        const available = user.available_payout || 0;
        const owed = user.balance_due || 0;
        const net = available - owed;

        if (net <= 0) {
            return res.status(400).json({ error: "No funds available for payout." });
        }

        // 2. Calculate Fees
        let amountToSend = net;
        let pF = 0;
        if (mode === 'instant') {
            pF = net * 0.015; // 1.5% Instant Fee
            amountToSend = net - pF;
        }

        // 3. Update Profile (Deduct Balance)
        // We set available_payout to 0 and balance_due to 0 (since they netted out)
        // If there was excess owed (net < 0), we wouldn't be here.
        const { error: updateError } = await supabase
            .from('profiles')
            .update({
                available_payout: 0,
                balance_due: 0,
                updated_at: new Date()
            })
            .eq('id', ownerId);

        if (updateError) throw updateError;

        // 4. Record Payout Transaction (Ledger)
        await supabase.from('financial_transactions').insert({
            event_id: null, // Payout is global usually, or we link to latest event? Null is fine.
            registration_id: null,
            transaction_type: 'payout',
            gross_amount: -amountToSend, // Money leaving system
            organizer_net: -amountToSend,
            platform_fee: pF,
            status: 'processing', // Manual payouts are processing
            currency: 'usd'
        });

        res.json({ success: true, amount: amountToSend, fee: pF });

    } catch (error) {
        console.error("Payout Request Error:", error);
        res.status(500).json({ error: error.message });
    }
};
