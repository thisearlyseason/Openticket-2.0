
import dotenv from 'dotenv';
import { createClient } from '@supabase/supabase-js';
import { createRequire } from 'module';
const require = createRequire(import.meta.url);

dotenv.config();

// const stripe = new Stripe(process.env.STRIPE_SECRET_KEY);
const supabase = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY);

const DOMAIN = process.env.VITE_API_URL ? process.env.VITE_API_URL.replace('/api', '') : 'http://localhost:5173';

// Helper: Ensure Products Exist
const ensureStripeProducts = async (stripe) => {
    // We expect products named "Pro Plan" and "Premium Plan"
    // We check if they exist, if not create them.
    // This allows the system to auto-bootstrap.

    // Cache or check simply? We'll check by searching.
    const plans = [
        { name: 'Pro Plan', priceMonthly: 2900, priceYearly: 29000 }, // in cents
        { name: 'Premium Plan', priceMonthly: 9900, priceYearly: 99000 }
    ];

    const pricesMap = {};

    for (const plan of plans) {
        let product;
        const products = await stripe.products.search({ query: `name:'${plan.name}'` });

        if (products.data.length > 0) {
            product = products.data[0];
        } else {
            console.log(`Creating Product: ${plan.name}`);
            product = await stripe.products.create({ name: plan.name });
        }

        // Now ensure prices exist (Monthly & Yearly)
        // We do a loose check. If we can't find a price for this product with this amount, create it.
        const prices = await stripe.prices.list({ product: product.id, active: true });

        // Monthly
        let monthlyPrice = prices.data.find(p => p.unit_amount === plan.priceMonthly && p.recurring.interval === 'month');
        if (!monthlyPrice) {
            console.log(`Creating Monthly Price for ${plan.name}`);
            monthlyPrice = await stripe.prices.create({
                product: product.id,
                unit_amount: plan.priceMonthly,
                currency: 'cad',
                recurring: { interval: 'month' }
            });
        }

        // Yearly
        let yearlyPrice = prices.data.find(p => p.unit_amount === plan.priceYearly && p.recurring.interval === 'year');
        if (!yearlyPrice) {
            console.log(`Creating Yearly Price for ${plan.name}`);
            yearlyPrice = await stripe.prices.create({
                product: product.id,
                unit_amount: plan.priceYearly,
                currency: 'cad',
                recurring: { interval: 'year' }
            });
        }

        pricesMap[`${plan.name}_monthly`] = monthlyPrice.id;
        pricesMap[`${plan.name}_yearly`] = yearlyPrice.id;
    }

    return pricesMap;
};

export const createSubscriptionCheckout = async (req, res) => {
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

        const { planName, cycle, userId, userEmail } = req.body;

        if (!['Pro Plan', 'Premium Plan'].includes(planName)) {
            return res.status(400).json({ error: "Invalid Plan" });
        }

        const prices = await ensureStripeProducts(stripe);
        const priceId = prices[`${planName}_${cycle}`];

        if (!priceId) throw new Error("Price not found");

        const session = await stripe.checkout.sessions.create({
            mode: 'subscription',
            payment_method_types: ['card'],
            line_items: [
                {
                    price: priceId,
                    quantity: 1,
                },
            ],
            customer_email: userEmail,
            client_reference_id: userId,
            metadata: {
                userId: userId,
                planName: planName,
                cycle: cycle,
                type: 'subscription_upgrade'
            },
            success_url: `${DOMAIN}/#/billing?success=true&session_id={CHECKOUT_SESSION_ID}`,
            cancel_url: `${DOMAIN}/#/pricing?canceled=true`,
        });

        res.json({ url: session.url });

    } catch (error) {
        console.error("Subscription Checkout Error:", error);
        res.status(500).json({ error: error.message });
    }
};
