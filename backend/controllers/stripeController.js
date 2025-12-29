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

        const { eventId, ticketSelections, addOnSelections, promoCode, affiliateCode, customerEmail, customerName, successUrl, cancelUrl, userId } = req.body;

        // 1. Fetch Event
        const { data: event, error: eventError } = await supabase.from('events').select('*').eq('id', eventId).single();
        if (eventError || !event) return res.status(404).json({ error: "Event not found" });

        // 2. Calculate Total & Construct Line Items
        const line_items = [];
        let subtotal = 0;

        // Tickets
        for (const [ticketId, selection] of Object.entries(ticketSelections)) {
            // @ts-ignore
            if (selection.qty > 0) {
                // Verify price/existence from DB ideally
                const tier = event.ticket_tiers.find(t => t.id === ticketId);
                if (tier) {
                    const amount = Math.round(tier.price * 100);
                    line_items.push({
                        price_data: {
                            currency: 'usd',
                            product_data: {
                                name: `${event.title} - ${tier.name}`,
                                metadata: {
                                    event_id: eventId,
                                    ticket_id: ticketId,
                                    type: 'ticket'
                                }
                            },
                            unit_amount: amount,
                        },
                        // @ts-ignore
                        quantity: selection.qty,
                    });
                    // @ts-ignore
                    subtotal += (tier.price * selection.qty);
                }
            }
        }

        // Add-ons
        if (addOnSelections) {
            for (const [addonId, qty] of Object.entries(addOnSelections)) {
                if (qty > 0) {
                    const addon = event.add_ons ? event.add_ons.find(a => a.id === addonId) : null;
                    if (addon) {
                        const amount = Math.round(addon.price * 100);
                        line_items.push({
                            price_data: {
                                currency: 'usd',
                                product_data: {
                                    name: `${addon.name} (Add-on)`,
                                },
                                unit_amount: amount,
                            },
                            quantity: qty,
                        });
                        // @ts-ignore
                        subtotal += (addon.price * qty);
                    }
                }
            }
        }

        if (line_items.length === 0) return res.status(400).json({ error: "No items selected" });

        // Calculate Fees (Logic mirroring StorageService.ts: 2.75% + $0.99)
        // Check if event absorbs fees or is free
        if (!event.absorb_fees && event.price_type !== 'free' && event.price_type !== 'donation' && subtotal > 0) {
            const feeFixed = 0.99;
            const feePercent = 0.0275;
            const calculated = (subtotal * feePercent) + feeFixed;
            const serviceFee = Math.round(calculated * 100); // in cents

            // Add Service Fee Line Item
            line_items.push({
                price_data: {
                    currency: 'usd',
                    product_data: {
                        name: "Service Fee",
                    },
                    unit_amount: serviceFee,
                },
                quantity: 1,
            });
        }

        // FIX: Append session_id to successUrl so frontend can verify
        const finalSuccessUrl = successUrl.includes('?')
            ? `${successUrl}&session_id={CHECKOUT_SESSION_ID}`
            : `${successUrl}?session_id={CHECKOUT_SESSION_ID}`;

        // 3. Create Checkout Session
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
