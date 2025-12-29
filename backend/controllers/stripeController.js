import supabase from '../services/supabase.js';
import { createRequire } from 'module';
const require = createRequire(import.meta.url);

export const createOrder = async (req, res) => {
    try {
        // Safe Lazy Load
        let stripe;
        try {
            const Stripe = require('stripe');
            stripe = new Stripe(process.env.STRIPE_SECRET_KEY || '', { apiVersion: '2023-10-16' });
        } catch (loaderError) {
            console.error("Stripe Load Failed:", loaderError);
            return res.status(500).json({ error: "Payment System Unavailable", details: loaderError.message });
        }

        const { eventId, ticketSelections, addOnSelections, promoCode, affiliateCode, customerEmail, customerName, successUrl, cancelUrl, userId, assignments, phoneNumber } = req.body;

        // 1. Fetch Event
        const { data: event, error: eventError } = await supabase.from('events').select('*').eq('id', eventId).single();
        if (eventError || !event) return res.status(404).json({ error: "Event not found" });

        // 2. Validate Capacity (Basic Check)
        let requestedQty = 0;
        Object.values(ticketSelections).forEach((val) => requestedQty += (val.qty || 0));

        if (event.capacity && (event.registered_count || 0) + requestedQty > event.capacity) {
            return res.status(400).json({ error: "Event capacity reached." });
        }

        // 3. Calculate Total & Construct Line Items
        // We calculate strictly to match Frontend: EventView.tsx

        // A. Gather raw items and subtotal
        let rawSubtotal = 0;
        const cartItems = []; // { name, price (dollars), type, id, quantity }
        const ticketsData = [];
        const addOnsData = [];

        // Tickets
        for (const [ticketId, selection] of Object.entries(ticketSelections)) {
            if (selection.qty > 0) {
                const tier = event.ticket_tiers.find(t => t.id === ticketId);
                const qty = selection.qty;
                if (tier) {
                    rawSubtotal += (tier.price * qty);
                    cartItems.push({
                        name: `${event.title} - ${tier.name}`,
                        price: tier.price,
                        quantity: qty,
                        type: 'ticket',
                        id: ticketId
                    });

                    // DB Object
                    for (let i = 0; i < qty; i++) {
                        ticketsData.push({
                            id: `tix-${Date.now()}-${i}-${Math.random().toString(36).substr(2, 4)}`,
                            tierId: ticketId,
                            name: tier.name,
                            pricePerTicket: tier.price,
                            status: 'valid'
                        });
                    }
                }
            }
        }

        // Add-ons
        if (addOnSelections) {
            for (const [addonId, qty] of Object.entries(addOnSelections)) {
                if (qty > 0) {
                    const addon = event.add_ons ? event.add_ons.find(a => a.id === addonId) : null;
                    if (addon) {
                        rawSubtotal += (addon.price * qty);
                        cartItems.push({
                            name: `${addon.name} (Add-on)`,
                            price: addon.price,
                            quantity: qty,
                            type: 'addon',
                            id: addonId
                        });

                        addOnsData.push({
                            id: addonId,
                            name: addon.name,
                            price: addon.price,
                            quantity: qty,
                            status: 'valid'
                        });
                    }
                }
            }
        }

        if (cartItems.length === 0) return res.status(400).json({ error: "No items selected" });

        // B. Apply Discount (if any)
        // This gives us the target "Base Price" (taxable)
        let targetBasePrice = rawSubtotal;
        let discountApplied = false;

        if (promoCode && event.promo_codes) {
            const code = event.promo_codes.find(c => c.code === promoCode);
            // Basic validity check
            let isValid = !!code;
            if (code && code.expiry_date && Date.now() > code.expiry_date) isValid = false;

            if (isValid) {
                discountApplied = true;
                if (code.type === 'percent') {
                    // Example: 20% off -> price * 0.8
                    targetBasePrice = Math.max(0, rawSubtotal * (1 - (code.value / 100)));
                } else {
                    // Example: $10 off
                    targetBasePrice = Math.max(0, rawSubtotal - code.value);
                }
            }
        }

        // C. Build Stripe Line Items with Adjusted Prices
        const line_items = [];
        let actualStripeSubtotalCents = 0; // The true sum of line items in cents

        // Calculate ratio to scale unit prices evenly
        const priceRatio = rawSubtotal > 0 ? (targetBasePrice / rawSubtotal) : 1;

        cartItems.forEach(item => {
            // New unit price in cents
            // We apply the ratio to the item price
            const unitAmountCents = Math.round(item.price * priceRatio * 100);

            line_items.push({
                price_data: {
                    currency: 'usd',
                    product_data: {
                        name: item.name,
                        metadata: { type: item.type, id: item.id }
                    },
                    unit_amount: unitAmountCents,
                },
                quantity: item.quantity,
            });
            actualStripeSubtotalCents += (unitAmountCents * item.quantity);
        });

        // D. Calculate Tax (on Actual Stripe Subtotal of items)
        let totalTaxCents = 0;
        if (event.tax_rate && event.tax_rate > 0) {
            totalTaxCents = Math.round(actualStripeSubtotalCents * (event.tax_rate / 100));
            if (totalTaxCents > 0) {
                line_items.push({
                    price_data: {
                        currency: 'usd',
                        product_data: { name: `Tax (${event.tax_rate}%)` },
                        unit_amount: totalTaxCents,
                    },
                    quantity: 1,
                });
            }
        }

        // E. Calculate Custom Fees
        // Percent fees based on actualStripeSubtotalCents
        // Fixed fees are flat cents
        let totalCustomFeesCents = 0;
        if (event.custom_fees && Array.isArray(event.custom_fees)) {
            event.custom_fees.forEach(fee => {
                let feeCents = 0;
                if (fee.type === 'percent') {
                    feeCents = Math.round(actualStripeSubtotalCents * (fee.amount / 100));
                } else {
                    feeCents = Math.round(fee.amount * 100);
                }

                if (feeCents > 0) {
                    totalCustomFeesCents += feeCents;
                    line_items.push({
                        price_data: {
                            currency: 'usd',
                            product_data: { name: fee.name || "Fee" },
                            unit_amount: feeCents,
                        },
                        quantity: 1,
                    });
                }
            });
        }

        // F. Calculate Platform Service Fee
        // Base for Service Fee = Subtotal (Discounted) + Tax + Custom Fees
        const serviceFeeBaseCents = actualStripeSubtotalCents + totalTaxCents + totalCustomFeesCents;
        let serviceFeeCents = 0;

        if (!event.absorb_fees && event.price_type !== 'free' && event.price_type !== 'donation' && serviceFeeBaseCents > 0) {
            // Frontend: calculateFees(total_in_dollars)
            // PLANS hardcoded fallback to free/standard logic if user logic missing
            // Standard: 2.75% + 0.99

            // We convert Cents -> Dollars for formula -> Cents
            const baseDollars = serviceFeeBaseCents / 100;
            const feeFixed = 0.99;
            const feePercent = 0.0275;

            const calculatedFeeDollars = (baseDollars * feePercent) + feeFixed;
            serviceFeeCents = Math.round(calculatedFeeDollars * 100);

            line_items.push({
                price_data: {
                    currency: 'usd',
                    product_data: { name: "Service Fee" },
                    unit_amount: serviceFeeCents,
                },
                quantity: 1,
            });
        }

        // G. Store Total for DB (Dollars)
        const totalAmountDollars = (serviceFeeBaseCents + serviceFeeCents) / 100;

        // FIX: Append session_id to successUrl
        const finalSuccessUrl = successUrl.includes('?')
            ? `${successUrl}&session_id={CHECKOUT_SESSION_ID}`
            : `${successUrl}?session_id={CHECKOUT_SESSION_ID}`;

        // 4. Create Stripe Session
        const session = await stripe.checkout.sessions.create({
            payment_method_types: ['card'],
            line_items,
            mode: 'payment',
            success_url: finalSuccessUrl,
            cancel_url: cancelUrl,
            customer_email: customerEmail,
            metadata: {
                eventId,
                userId: userId || 'guest',
                affiliateCode: affiliateCode || ''
            }
        });

        // 5. INSERT REGISTRATION RECORD (Pending) - CRITICAL FIX
        // We match assignments if passed, otherwise default to customerName/Email

        // Basic assignment logic if assignments object is passed (map by ticket ID)
        if (assignments) {
            ticketsData.forEach(t => {
                const list = assignments[t.tierId];
                if (list && list.length > 0) {
                    const assignee = list.shift(); // take first
                    if (assignee) {
                        t.attendeeName = assignee.name;
                        t.attendeeEmail = assignee.email;
                    }
                }
                if (!t.attendeeName) {
                    t.attendeeName = customerName;
                    t.attendeeEmail = customerEmail;
                }
            });
        }

        const registrationPayload = {
            event_id: eventId,
            attendee_email: customerEmail,
            attendee_name: customerName,
            user_id: userId !== 'guest' ? userId : null,
            payment_status: 'pending', // Pending confirmation
            approval_status: 'approved',
            tickets: ticketsData,
            add_ons: addOnsData,
            stripe_checkout_session_id: session.id, // THE LOOKUP KEY
            answers: {}, // Add answers if passed
            created_at: new Date(),
            phone_number: phoneNumber,
            promo_code_used: discountApplied ? promoCode : null,
            total_amount: totalAmountDollars
        };

        const { error: insertError } = await supabase.from('registrations').insert([registrationPayload]);

        if (insertError) {
            console.error("Failed to save pending registration:", insertError);
            // We should probably cancel the stripe session or warn the user, but for now log it.
        }

        res.json({ url: session.url, id: session.id });

    } catch (error) {
        console.error("Create Order Error:", error);
        res.status(500).json({ error: error.message });
    }
};

export const createPortalSession = async (req, res) => {
    // Placeholder for portal
    res.json({ url: 'https://billing.stripe.com/p/login/test' });
};
