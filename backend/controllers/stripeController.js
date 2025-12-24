import Stripe from 'stripe';

export const createCheckoutSession = async (req, res) => {
    try {
        if (!process.env.STRIPE_SECRET_KEY) {
            throw new Error('STRIPE_SECRET_KEY is missing in the backend .env file');
        }

        const stripe = new Stripe(process.env.STRIPE_SECRET_KEY, {
            apiVersion: '2023-10-16',
        });

        const {
            eventId,
            eventTitle,
            tickets,
            addOns,
            promoCode,
            customerEmail,
            customerName,
            successUrl,
            cancelUrl,
            organizerStripeId,
            applicationFee // passed from frontend
        } = req.body;



        const line_items = [];

        // Add Tickets
        if (tickets && Array.isArray(tickets)) {
            tickets.forEach((ticket) => {
                line_items.push({
                    price_data: {
                        currency: 'usd',
                        product_data: {
                            name: `${eventTitle} - ${ticket.name}`,
                        },
                        unit_amount: Math.round(ticket.pricePerTicket * 100),
                    },
                    quantity: ticket.quantity || 1,
                });
            });
        }

        // Add Add-ons
        if (addOns && Array.isArray(addOns)) {
            addOns.forEach((addon) => {
                line_items.push({
                    price_data: {
                        currency: 'usd',
                        product_data: {
                            name: `Add-on: ${addon.name}`,
                        },
                        unit_amount: Math.round(addon.price * 100),
                    },
                    quantity: addon.quantity || 1,
                });
            });
        }

        const sessionParams = {
            payment_method_types: ['card'],
            line_items,
            mode: 'payment',
            customer_email: customerEmail,
            success_url: successUrl,
            cancel_url: cancelUrl,
            metadata: {
                eventId,
                customerName,
                promoCode: promoCode || 'none',
                orderType: 'event_registration',
            },
        };

        if (organizerStripeId && !organizerStripeId.startsWith('acct_1M')) {
            // Ensure application fee is at least some minimum or 0, and convert to cents
            const feeAmount = applicationFee ? Math.round(applicationFee * 100) : 100;

            sessionParams.payment_intent_data = {
                application_fee_amount: feeAmount,
                transfer_data: {
                    destination: organizerStripeId,
                },
            };
        }

        const session = await stripe.checkout.sessions.create(sessionParams);

        res.json({
            sessionId: session.id,
            url: session.url,
        });
    } catch (error) {
        console.error('Stripe Checkout Error:', error);
        res.status(500).json({ error: error.message || 'Failed to create checkout session' });
    }
};
