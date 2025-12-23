import { loadStripe } from '@stripe/stripe-js';

const key = (import.meta as any).env.VITE_STRIPE_PUBLISHABLE_KEY;

if (!key) {
    console.warn("VITE_STRIPE_PUBLISHABLE_KEY is missing in root .env file. Stripe will not initialize.");
}

const stripePromise = key ? loadStripe(key) : Promise.resolve(null);

export default stripePromise;
