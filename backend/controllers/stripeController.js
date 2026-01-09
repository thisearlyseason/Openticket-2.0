import supabase from '../services/supabase.js';
import { createRequire } from 'module';
import { calculateOrderBreakdown, buildStripeLineItems } from '../utils/priceCalculator.js';
import { EmailService } from '../services/serverEmail.js';
const require = createRequire(import.meta.url);

/**
 * STRIPE CHECKOUT CONTROLLER
 * Creates Stripe Checkout sessions with proper Connect destination
 */

const getStripe = () => {
    const Stripe = require('stripe');
    return new Stripe(process.env.STRIPE_SECRET_KEY || '', { apiVersion: '2023-10-16' });
};

export const createOrder = async (req, res) => {
    try {
        const stripe = getStripe();

        const {
            eventId,
            ticketSelections,
            addOnSelections,
            promoCode,
            affiliateCode,
            platformDonationAmount,
            customerEmail,
            customerName,
            successUrl,
            cancelUrl,
            userId,
            assignments,
            phoneNumber,
            // Attendee's selected currency - if provided, we'll convert and charge in this currency
            attendeeCurrency,
        } = req.body;

        console.log(`[Stripe] createOrder called for event: ${eventId}`);
        console.log(`[Stripe] successUrl: ${successUrl}`);
        console.log(`[Stripe] cancelUrl: ${cancelUrl}`);

        // Validate URLs
        if (!successUrl || !cancelUrl) {
            return res.status(400).json({ error: "Missing success or cancel URL" });
        }

        // Ensure URLs are valid (Stripe doesn't accept hash routes)
        const validateUrl = (url) => {
            try {
                const parsed = new URL(url);
                // Stripe requires http or https
                if (!['http:', 'https:'].includes(parsed.protocol)) {
                    return false;
                }
                return true;
            } catch (e) {
                return false;
            }
        };

        if (!validateUrl(successUrl) || !validateUrl(cancelUrl)) {
            console.error(`[Stripe] Invalid URLs - success: ${successUrl}, cancel: ${cancelUrl}`);
            return res.status(400).json({ error: "Invalid success or cancel URL format" });
        }

        // 1. Fetch Event with owner info
        const { data: event, error: eventError } = await supabase
            .from('events')
            .select('*, owner:profiles!owner_id(id, stripe_connect_id, stripe_onboarding_complete, subscription)')
            .eq('id', eventId)
            .single();

        if (eventError || !event) {
            console.error(`[Stripe] Event not found: ${eventId}`, eventError);
            return res.status(404).json({ error: "Event not found" });
        }

        // ========== AUTO LOCAL CURRENCY FEATURE ==========
        // ATTENDEE CURRENCY: Attendees can be charged in their local/selected currency
        // ORGANIZER CURRENCY: All organizer views remain in their configured default currency
        // 
        // Priority for charge currency:
        // 1. Attendee's selected currency (if valid and supported)
        // 2. Organization's global default currency (fallback)
        // 3. Platform default / USD (ultimate fallback)
        
        const supportedCurrencies = ['usd', 'eur', 'gbp', 'cad', 'aud'];
        
        // Get organization's global default currency from event owner's profile (source of truth for organizer)
        const ownerDefaultCurrency = event.owner?.subscription?.settings?.default_currency?.toLowerCase() || 'usd';
        
        // Platform default currency (ultimate fallback)
        const backendDefaultCurrency = process.env.DEFAULT_CURRENCY?.toLowerCase() || 'usd';
        
        // Organizer's currency is what prices are stored in
        let organizerCurrency = 'usd';
        if (supportedCurrencies.includes(ownerDefaultCurrency)) {
            organizerCurrency = ownerDefaultCurrency;
        } else if (supportedCurrencies.includes(backendDefaultCurrency)) {
            organizerCurrency = backendDefaultCurrency;
        }
        
        // Determine actual charge currency:
        // If attendee selected a valid currency, use that; otherwise use organizer's
        let chargeCurrency = organizerCurrency;
        let currencyConversionRate = 1; // rate from organizerCurrency to chargeCurrency
        let needsConversion = false;
        
        const normalizedAttendeeCurrency = attendeeCurrency?.toLowerCase();
        if (normalizedAttendeeCurrency && 
            supportedCurrencies.includes(normalizedAttendeeCurrency) && 
            normalizedAttendeeCurrency !== organizerCurrency) {
            
            chargeCurrency = normalizedAttendeeCurrency;
            needsConversion = true;
            
            // Fetch live exchange rate for currency conversion
            try {
                const FIXER_API_KEY = process.env.FIXER_API_KEY;
                if (FIXER_API_KEY) {
                    const response = await fetch(
                        `http://data.fixer.io/api/latest?access_key=${FIXER_API_KEY}&symbols=USD,EUR,GBP,CAD,AUD`
                    );
                    
                    if (response.ok) {
                        const data = await response.json();
                        if (data.success && data.rates) {
                            // Fixer returns rates with EUR as base, need to convert
                            const eurToOrg = data.rates[organizerCurrency.toUpperCase()];
                            const eurToTarget = data.rates[chargeCurrency.toUpperCase()];
                            
                            if (eurToOrg && eurToTarget) {
                                // Convert: organizerCurrency -> EUR -> targetCurrency
                                currencyConversionRate = eurToTarget / eurToOrg;
                                console.log(`[Stripe] Live conversion rate ${organizerCurrency.toUpperCase()} -> ${chargeCurrency.toUpperCase()}: ${currencyConversionRate.toFixed(4)}`);
                            }
                        }
                    }
                }
            } catch (rateError) {
                console.warn(`[Stripe] Failed to fetch live rates, using fallback: ${rateError.message}`);
            }
            
            // Fallback rates if live fetch failed
            if (currencyConversionRate === 1) {
                const fallbackRates = { usd: 1, eur: 0.92, gbp: 0.79, cad: 1.36, aud: 1.53 };
                const orgRate = fallbackRates[organizerCurrency] || 1;
                const targetRate = fallbackRates[chargeCurrency] || 1;
                currencyConversionRate = targetRate / orgRate;
                console.log(`[Stripe] Using fallback conversion rate ${organizerCurrency.toUpperCase()} -> ${chargeCurrency.toUpperCase()}: ${currencyConversionRate.toFixed(4)}`);
            }
        }
        
        console.log(`[Stripe] Currency resolution: organizer=${organizerCurrency.toUpperCase()}, charge=${chargeCurrency.toUpperCase()}, conversion=${needsConversion}, rate=${currencyConversionRate.toFixed(4)}`);

        // 2. Validate Capacity
        let requestedQty = 0;
        Object.values(ticketSelections || {}).forEach((val) => requestedQty += (Number(val) || 0));

        if (event.capacity && (event.registered_count || 0) + requestedQty > event.capacity) {
            return res.status(400).json({ error: "Event capacity reached." });
        }

        // 3. Validate promo code if provided
        let validPromoCode = null;
        if (promoCode && event.promo_codes) {
            const code = event.promo_codes.find(c => c.code === promoCode);
            if (code) {
                let isValid = true;
                if (code.max_usage && code.usage_count >= code.max_usage) isValid = false;
                if (code.expiry_date && Date.now() > code.expiry_date) isValid = false;
                if (isValid) validPromoCode = code;
            }
        }

        // 4. Calculate order using SINGLE SOURCE OF TRUTH
        const organizerPlan = event.owner?.subscription?.plan || 'free';
        
        // For donation-type events, get the donation amount from the request
        // This is different from platformDonationAmount which is for platform support
        const ticketDonationAmount = event.price_type === 'donation' 
            ? Number(req.body.donationAmount) || 0 
            : 0;

        const breakdown = calculateOrderBreakdown({
            event,
            ticketSelections: ticketSelections || {},
            addOnSelections: addOnSelections || {},
            promoCode: validPromoCode,
            organizerPlan,
            donationAmount: ticketDonationAmount, // For donation-type tickets
        });

        if (breakdown.items.length === 0) {
            return res.status(400).json({ error: "No items selected" });
        }

        // 5. Build Stripe line items with currency conversion if needed
        const lineItems = buildStripeLineItems(breakdown, event.title, chargeCurrency, currencyConversionRate);

        // 5b. Add platform donation as a separate line item (if applicable)
        // Platform donation also needs to be converted to charge currency
        const donationAmount = Number(platformDonationAmount) || 0;
        if (donationAmount > 0) {
            const convertedDonation = Math.round(donationAmount * currencyConversionRate * 100); // cents
            lineItems.push({
                price_data: {
                    currency: chargeCurrency,
                    product_data: {
                        name: 'Support OpenTicket',
                        description: 'Platform donation to keep fees low',
                    },
                    unit_amount: convertedDonation,
                },
                quantity: 1,
            });
        }

        // 6. Build tickets data for DB
        const ticketsData = [];
        for (const item of breakdown.items) {
            if (item.type !== 'ticket') continue;
            for (let i = 0; i < item.quantity; i++) {
                // Get assignment if available
                const assignment = assignments?.[item.id]?.[i] || {};
                ticketsData.push({
                    id: `tix-${Date.now()}-${i}-${Math.random().toString(36).substr(2, 4)}`,
                    tierId: item.id,
                    name: item.name,
                    pricePerTicket: item.unitPrice,
                    quantity: 1,
                    status: 'valid',
                    attendeeName: assignment.name || customerName,
                    attendeeEmail: assignment.email || customerEmail,
                });
            }
        }

        // 7. Build add-ons data for DB
        const addOnsData = [];
        for (const item of breakdown.items) {
            if (item.type !== 'addon') continue;
            addOnsData.push({
                id: item.id,
                name: item.name,
                price: item.unitPrice,
                quantity: item.quantity,
                status: 'valid',
            });
        }

        // 8. Prepare Checkout Session options
        const finalSuccessUrl = successUrl.includes('?')
            ? `${successUrl}&session_id={CHECKOUT_SESSION_ID}`
            : `${successUrl}?session_id={CHECKOUT_SESSION_ID}`;

        const sessionOptions = {
            payment_method_types: ['card'],
            line_items: lineItems,
            mode: 'payment',
            currency: chargeCurrency, // Attendee's selected or organizer's default currency
            success_url: finalSuccessUrl,
            cancel_url: cancelUrl,
            customer_email: customerEmail,
            metadata: {
                eventId,
                userId: userId || 'guest',
                affiliateCode: affiliateCode || '',
                platformDonationAmount: donationAmount.toString(),
                chargeCurrency: chargeCurrency.toUpperCase(), // Currency used for this charge
                organizerCurrency: organizerCurrency.toUpperCase(), // Organizer's original currency
                conversionRate: currencyConversionRate.toString(), // Rate used for conversion
                // Store breakdown for webhook reconciliation (in organizer's currency)
                platformFee: breakdown.platformFee.toString(),
                taxAmount: breakdown.taxAmount.toString(),
                discountAmount: breakdown.discountAmount.toString(),
                promoCode: validPromoCode?.code || '',
            },
        };

        // 9. CRITICAL: Add Stripe Connect destination for split payments
        const organizerStripeId = event.owner?.stripe_connect_id;
        const isRealStripeAccount = organizerStripeId && 
            !organizerStripeId.startsWith('mock_') &&
            event.owner?.stripe_onboarding_complete;

        if (isRealStripeAccount && breakdown.grandTotal > 0) {
            // Calculate application fee (platform commission) - MUST be in charge currency
            // Convert platform fee and donation to charge currency
            const convertedPlatformFee = breakdown.platformFee * currencyConversionRate;
            const convertedDonation = donationAmount * currencyConversionRate;
            const applicationFeeAmount = Math.round((convertedPlatformFee + convertedDonation) * 100); // cents in charge currency

            sessionOptions.payment_intent_data = {
                application_fee_amount: applicationFeeAmount,
                transfer_data: {
                    destination: organizerStripeId,
                },
                metadata: {
                    eventId,
                    organizerId: event.owner_id,
                },
            };

            console.log(`[Stripe] Creating session with Connect destination: ${organizerStripeId}, app_fee: ${chargeCurrency.toUpperCase()} ${(applicationFeeAmount/100).toFixed(2)}`);
        } else {
            console.log(`[Stripe] Creating session WITHOUT Connect (mock account or no account)`);
        }

        // 10. Create Stripe Checkout Session
        const session = await stripe.checkout.sessions.create(sessionOptions);

        // 11. Create pending registration record
        const registrationPayload = {
            event_id: eventId,
            attendee_email: customerEmail,
            attendee_name: customerName,
            user_id: userId !== 'guest' ? userId : null,
            payment_status: 'pending',
            approval_status: event.requires_approval ? 'pending' : 'approved',
            tickets: ticketsData,
            add_ons: addOnsData,
            stripe_checkout_session_id: session.id,
            answers: {},
            created_at: new Date(),
            phone_number: phoneNumber,
            promo_code_used: validPromoCode?.code || null,
            discount_amount: breakdown.discountAmount,
            total_amount: breakdown.grandTotal + donationAmount, // Include donation in total
            service_fee: breakdown.platformFee,
            tax_amount: breakdown.taxAmount,
            custom_fees_amount: breakdown.customFeesAmount,
            affiliate_code: affiliateCode || null,
            platform_donation_amount: donationAmount, // Track separately
        };

        const { error: insertError } = await supabase
            .from('registrations')
            .insert([registrationPayload]);

        if (insertError) {
            console.error("Failed to save pending registration:", insertError);
            // Don't fail the checkout - webhook will handle verification
        }

        console.log(`[Stripe] Checkout session created: ${session.id}`);
        res.json({ url: session.url, id: session.id });

    } catch (error) {
        console.error("Create Order Error:", error);
        // Provide more detailed error message
        const errorMessage = error.raw?.message || error.message || 'Unknown error';
        res.status(500).json({ error: errorMessage });
    }
};

export const createPortalSession = async (req, res) => {
    try {
        const stripe = getStripe();
        const userId = req.user.uid;

        const { data: profile } = await supabase
            .from('profiles')
            .select('stripe_customer_id')
            .eq('id', userId)
            .single();

        if (!profile?.stripe_customer_id) {
            return res.status(400).json({ error: 'No billing account found' });
        }

        const session = await stripe.billingPortal.sessions.create({
            customer: profile.stripe_customer_id,
            return_url: `${req.headers.origin}/#/billing`,
        });

        res.json({ url: session.url });
    } catch (error) {
        console.error("Portal Session Error:", error);
        res.status(500).json({ error: error.message });
    }
};

/**
 * Create a PaymentIntent for at-door payments
 * POST /api/stripe/create-payment-intent
 */
export const createPaymentIntent = async (req, res) => {
    try {
        const stripe = getStripe();
        const { registrationId, amount } = req.body;

        // Fetch registration with event owner
        const { data: reg, error: regError } = await supabase
            .from('registrations')
            .select('*, event:events(*, owner:profiles!owner_id(stripe_connect_id, stripe_onboarding_complete))')
            .eq('id', registrationId)
            .single();

        if (regError || !reg) {
            return res.status(404).json({ error: 'Registration not found' });
        }

        const organizerStripeId = reg.event?.owner?.stripe_connect_id;
        const isRealAccount = organizerStripeId && 
            !organizerStripeId.startsWith('mock_') && 
            reg.event?.owner?.stripe_onboarding_complete;

        const paymentIntentData = {
            amount: Math.round(amount * 100), // cents
            currency: 'usd',
            metadata: {
                registrationId,
                eventId: reg.event_id,
                source: 'checkin_portal',
            },
        };

        if (isRealAccount) {
            // Calculate platform fee (simplified - use same structure)
            const platformFeePercent = 0.0275; // Default free plan
            const platformFee = Math.round(amount * platformFeePercent * 100);

            paymentIntentData.application_fee_amount = platformFee;
            paymentIntentData.transfer_data = {
                destination: organizerStripeId,
            };
        }

        const paymentIntent = await stripe.paymentIntents.create(paymentIntentData);

        res.json({
            clientSecret: paymentIntent.client_secret,
            paymentIntentId: paymentIntent.id,
        });
    } catch (error) {
        console.error("Create PaymentIntent Error:", error);
        res.status(500).json({ error: error.message });
    }
};

/**
 * Get order calculation preview (for frontend validation)
 * POST /api/stripe/calculate-order
 */
export const calculateOrder = async (req, res) => {
    try {
        const { eventId, ticketSelections, addOnSelections, promoCode, donationAmount } = req.body;

        const { data: event, error } = await supabase
            .from('events')
            .select('*, owner:profiles!owner_id(subscription)')
            .eq('id', eventId)
            .single();

        if (error || !event) {
            return res.status(404).json({ error: 'Event not found' });
        }

        // Validate promo code
        let validPromoCode = null;
        if (promoCode && event.promo_codes) {
            const code = event.promo_codes.find(c => c.code === promoCode);
            if (code) {
                let isValid = true;
                if (code.max_usage && code.usage_count >= code.max_usage) isValid = false;
                if (code.expiry_date && Date.now() > code.expiry_date) isValid = false;
                if (isValid) validPromoCode = code;
            }
        }

        const organizerPlan = event.owner?.subscription?.plan || 'free';
        const breakdown = calculateOrderBreakdown({
            event,
            ticketSelections: ticketSelections || {},
            addOnSelections: addOnSelections || {},
            promoCode: validPromoCode,
            organizerPlan,
            donationAmount: donationAmount || 0, // Pass donation amount for donation-type events
        });

        res.json(breakdown);
    } catch (error) {
        console.error("Calculate Order Error:", error);
        res.status(500).json({ error: error.message });
    }
};

/**
 * Verify a checkout session and update registration status
 * POST /api/stripe/verify-session
 * This is used when webhooks don't fire (e.g., development environment)
 */
export const verifySession = async (req, res) => {
    try {
        const stripe = getStripe();
        const { sessionId } = req.body;

        if (!sessionId) {
            return res.status(400).json({ error: 'Session ID required' });
        }

        console.log(`[Stripe] Verifying session: ${sessionId}`);

        // Retrieve the session from Stripe with expanded payment intent
        const session = await stripe.checkout.sessions.retrieve(sessionId, {
            expand: ['payment_intent.latest_charge.balance_transaction']
        });

        if (!session) {
            return res.status(404).json({ error: 'Session not found' });
        }

        // Check payment status
        if (session.payment_status !== 'paid') {
            return res.status(200).json({ 
                status: 'pending',
                message: 'Payment not yet completed'
            });
        }

        // Find the registration with event data
        const { data: reg, error: regError } = await supabase
            .from('registrations')
            .select('*, event:events(*)')
            .eq('stripe_checkout_session_id', sessionId)
            .single();

        if (regError || !reg) {
            console.error('[Stripe] Registration not found for session:', sessionId);
            return res.status(404).json({ error: 'Registration not found' });
        }

        // IDEMPOTENCY: If already paid, return success without re-processing
        if (reg.payment_status === 'paid' || reg.payment_status === 'completed') {
            return res.json({ 
                status: 'success',
                registration: reg
            });
        }

        // ========== FULL POST-PAYMENT PROCESSING ==========
        console.log(`[Stripe] Processing full payment for registration: ${reg.id}`);

        // 1. Finalize Tickets with unique IDs
        const finalizedTickets = (reg.tickets || []).map(ticket => ({
            ...ticket,
            id: ticket.id || `tix-${Date.now()}-${Math.random().toString(36).substr(2, 6)}`,
            status: 'valid',
            purchaseDate: new Date().toISOString()
        }));

        // 2. Calculate financial breakdown
        const centsToDollars = (cents) => (cents ? cents / 100 : 0);
        let grossAmount = centsToDollars(session.amount_total);
        
        // Get actual Stripe fee from balance transaction
        let stripeFee = 0;
        try {
            const paymentIntent = session.payment_intent;
            if (paymentIntent && typeof paymentIntent === 'object') {
                const charge = paymentIntent.latest_charge;
                if (charge && typeof charge === 'object' && charge.balance_transaction) {
                    const bt = charge.balance_transaction;
                    if (typeof bt === 'object' && bt.fee) {
                        stripeFee = centsToDollars(bt.fee);
                        console.log(`[Stripe] Actual fee from balance_transaction: $${stripeFee}`);
                    }
                }
            }
        } catch (feeError) {
            console.warn("[Stripe] Could not retrieve actual fee:", feeError.message);
        }

        // Fallback fee estimation if actual fee not available
        if (stripeFee === 0 && grossAmount > 0) {
            stripeFee = Number(((grossAmount * 0.029) + 0.30).toFixed(2));
            console.log(`[Stripe] Estimated fee: $${stripeFee}`);
        }

        // Parse metadata for financial reconciliation
        const platformFee = Number(session.metadata?.platformFee || reg.service_fee || 0);
        const taxAmount = Number(session.metadata?.taxAmount || reg.tax_amount || 0);
        const discountAmount = Number(session.metadata?.discountAmount || reg.discount_amount || 0);
        const affiliateCode = session.metadata?.affiliateCode || reg.affiliate_code || null;

        // NOTE: Affiliate commissions are ONLY for subscriptions, NOT ticket sales
        // Affiliates earn 15% recurring commission on subscription payments only
        const affiliateCommission = 0;
        if (affiliateCode) {
            console.log(`[Stripe] Affiliate code ${affiliateCode} tracked for analytics only. No ticket commission.`);
        }

        // Calculate organizer net earnings (no affiliate commission deducted for tickets)
        const organizerNet = Number((grossAmount - platformFee - stripeFee).toFixed(2));

        // 3. Update registration with all data
        const paymentIntentId = typeof session.payment_intent === 'object' 
            ? session.payment_intent.id 
            : session.payment_intent;

        const { data: updatedReg, error: updateError } = await supabase
            .from('registrations')
            .update({
                payment_status: 'paid',
                stripe_payment_intent_id: paymentIntentId,
                tickets: finalizedTickets,
                total_amount: grossAmount,
                service_fee: platformFee,
                tax_amount: taxAmount,
                discount_amount: discountAmount
            })
            .eq('id', reg.id)
            .select()
            .single();

        if (updateError) {
            console.error('[Stripe] Failed to update registration:', updateError);
            return res.status(500).json({ error: 'Failed to update registration' });
        }

        // 4. Insert financial transaction record
        const { error: txError } = await supabase.from('financial_transactions').insert({
            registration_id: reg.id,
            event_id: reg.event_id,
            stripe_session_id: session.id,
            stripe_payment_intent_id: paymentIntentId,
            gross_amount: grossAmount,
            platform_fee: platformFee,
            stripe_fee: stripeFee,
            tax_amount: taxAmount,
            organizer_net: organizerNet,
            currency: session.currency || 'usd',
            status: 'succeeded',
            payout_status: 'pending',
            transaction_type: 'ticket_sale',
            discount_amount: discountAmount,
            affiliate_code: affiliateCode,
            affiliate_commission: affiliateCommission,
            created_at: new Date().toISOString()
        });

        if (txError) {
            console.error('[Stripe] Failed to insert financial transaction:', txError);
            // Don't fail the request - registration is already paid
        } else {
            console.log(`[Stripe] Financial transaction created for ${sessionId}`);
        }

        // 5. Update event's registered count
        const ticketCount = finalizedTickets.length;
        if (ticketCount > 0 && reg.event_id) {
            const { error: countError } = await supabase.rpc('increment_registered_count', {
                p_event_id: reg.event_id,
                p_count: ticketCount
            });
            
            if (countError) {
                // Fallback: direct update
                console.warn('[Stripe] RPC increment failed, trying direct update:', countError);
                const { data: eventData } = await supabase
                    .from('events')
                    .select('registered_count')
                    .eq('id', reg.event_id)
                    .single();
                
                if (eventData) {
                    await supabase
                        .from('events')
                        .update({ registered_count: (eventData.registered_count || 0) + ticketCount })
                        .eq('id', reg.event_id);
                }
            }
            console.log(`[Stripe] Updated event registered count (+${ticketCount})`);
        }

        // 6. Insert audit log
        try {
            await supabase.from('audit_logs').insert({
                timestamp: new Date().toISOString(),
                actor_id: session.metadata?.userId || 'guest',
                actor_type: session.metadata?.userId ? 'user' : 'guest',
                actor_email: reg.attendee_email,
                action: 'ticket_purchase',
                target_type: 'registration',
                target_id: reg.id,
                details: {
                    eventId: reg.event_id,
                    eventTitle: reg.event?.title,
                    grossAmount: grossAmount,
                    stripeFee: stripeFee,
                    platformFee: platformFee,
                    netAmount: organizerNet,
                    currency: session.currency || 'usd',
                    ticketCount: ticketCount,
                    stripeSessionId: session.id,
                    stripePaymentIntentId: paymentIntentId
                }
            });
            console.log(`[Stripe] Audit log created for ${sessionId}`);
        } catch (auditError) {
            console.error('[Stripe] Failed to create audit log:', auditError);
        }

        console.log(`[Stripe] Full payment processing complete for session: ${sessionId}`);
        console.log(`[Stripe] Breakdown: Gross=$${grossAmount}, StripeFee=$${stripeFee}, PlatformFee=$${platformFee}, OrganizerNet=$${organizerNet}`);

        // 7. Send affiliate conversion notification if applicable
        if (affiliateCode && affiliateCommission > 0) {
            try {
                const { data: affiliate } = await supabase
                    .from('profiles')
                    .select('email, name')
                    .eq('affiliate_code', affiliateCode)
                    .single();

                if (affiliate?.email) {
                    console.log(`[Stripe] Sending affiliate conversion email to: ${affiliate.email}`);
                    await EmailService.sendAffiliateConversionNotification(
                        affiliate.email,
                        affiliate.name,
                        reg.attendee_name,
                        reg.event?.title,
                        grossAmount.toFixed(2),
                        affiliateCommission
                    );
                }
            } catch (affEmailError) {
                console.error('[Stripe] Failed to send affiliate notification:', affEmailError.message);
            }
        }

        res.json({ 
            status: 'success',
            registration: updatedReg
        });

    } catch (error) {
        console.error("Verify Session Error:", error);
        res.status(500).json({ error: error.message });
    }
};

/**
 * Record an at-door payment (cash, card, or transfer)
 * POST /api/stripe/record-at-door-payment
 * This creates a financial transaction record for offline payments
 */
export const recordAtDoorPayment = async (req, res) => {
    try {
        const { registrationId, amount, method } = req.body;

        if (!registrationId || !amount || !method) {
            return res.status(400).json({ error: 'Missing required fields' });
        }

        // Get registration with event data
        const { data: reg, error: regError } = await supabase
            .from('registrations')
            .select('*, event:events(*, owner:profiles!owner_id(subscription))')
            .eq('id', registrationId)
            .single();

        if (regError || !reg) {
            return res.status(404).json({ error: 'Registration not found' });
        }

        // Calculate platform fee based on organizer's plan
        const organizerPlan = reg.event?.owner?.subscription?.plan || 'free';
        const PLAN_FEES = {
            free: { percent: 0.0275, fixed: 0.99 },
            pro: { percent: 0.015, fixed: 0.75 },
            premium: { percent: 0.0075, fixed: 0.30 }
        };
        const planFee = PLAN_FEES[organizerPlan] || PLAN_FEES.free;
        const platformFee = Number((amount * planFee.percent + planFee.fixed).toFixed(2));
        
        // No Stripe fee for cash/transfer payments
        const stripeFee = method === 'card' ? Number((amount * 0.029 + 0.30).toFixed(2)) : 0;
        
        const organizerNet = Number((amount - platformFee - stripeFee).toFixed(2));

        // Insert financial transaction record
        const { data: tx, error: txError } = await supabase
            .from('financial_transactions')
            .insert({
                registration_id: registrationId,
                event_id: reg.event_id,
                gross_amount: amount,
                platform_fee: platformFee,
                stripe_fee: stripeFee,
                tax_amount: reg.tax_amount || 0,
                organizer_net: organizerNet,
                currency: 'usd',
                status: 'succeeded',
                payout_status: method === 'cash' ? 'collected' : 'pending',
                transaction_type: 'at_door_payment',
                payment_method: method,
                affiliate_code: reg.affiliate_code || null,
                affiliate_commission: 0, // At-door payments don't typically carry affiliate commission
                created_at: new Date().toISOString()
            })
            .select()
            .single();

        if (txError) {
            console.error('[At-Door Payment] Failed to record transaction:', txError);
            // Don't fail - the payment was collected
        }

        // Create audit log
        try {
            await supabase.from('audit_logs').insert({
                timestamp: new Date().toISOString(),
                actor_id: req.user?.uid || 'staff',
                actor_type: 'staff',
                action: 'at_door_payment',
                target_type: 'registration',
                target_id: registrationId,
                details: {
                    eventId: reg.event_id,
                    amount: amount,
                    method: method,
                    platformFee: platformFee,
                    organizerNet: organizerNet
                }
            });
        } catch (auditError) {
            console.error('[At-Door Payment] Audit log failed:', auditError);
        }

        console.log(`[At-Door Payment] Recorded ${method} payment of $${amount} for registration ${registrationId}`);
        
        res.json({
            recorded: true,
            transactionId: tx?.id,
            breakdown: {
                gross: amount,
                platformFee: platformFee,
                stripeFee: stripeFee,
                organizerNet: organizerNet
            }
        });

    } catch (error) {
        console.error('Record At-Door Payment Error:', error);
        res.status(500).json({ error: error.message });
    }
};

/**
 * Get currency conversion rates from Fixer.io
 * GET /api/stripe/exchange-rates
 * Returns current exchange rates for supported currencies
 */
export const getExchangeRates = async (req, res) => {
    try {
        const baseCurrency = 'USD';
        const supportedCurrencies = ['EUR', 'GBP', 'CAD', 'AUD'];
        const FIXER_API_KEY = process.env.FIXER_API_KEY;
        
        // Try Fixer.io first (primary source)
        if (FIXER_API_KEY) {
            try {
                // Fixer.io free plan only supports EUR as base, so we need to convert
                const response = await fetch(
                    `http://data.fixer.io/api/latest?access_key=${FIXER_API_KEY}&symbols=USD,EUR,GBP,CAD,AUD`
                );
                
                if (response.ok) {
                    const data = await response.json();
                    if (data.success && data.rates) {
                        // Fixer returns rates with EUR as base, convert to USD base
                        const eurToUsd = data.rates.USD;
                        const rates = {
                            USD: 1,
                            EUR: Number((1 / eurToUsd).toFixed(4)),
                            GBP: Number((data.rates.GBP / eurToUsd).toFixed(4)),
                            CAD: Number((data.rates.CAD / eurToUsd).toFixed(4)),
                            AUD: Number((data.rates.AUD / eurToUsd).toFixed(4))
                        };
                        
                        console.log('[ExchangeRates] Fetched live rates from Fixer.io:', rates);
                        
                        return res.json({
                            success: true,
                            base: baseCurrency,
                            rates,
                            source: 'fixer.io',
                            timestamp: data.timestamp || Date.now()
                        });
                    } else {
                        console.warn('[ExchangeRates] Fixer.io API error:', data.error?.info || 'Unknown error');
                    }
                }
            } catch (fixerError) {
                console.warn('[ExchangeRates] Fixer.io fetch failed:', fixerError.message);
            }
        }
        
        // Fallback: Try exchangerate.host (free, no API key required)
        try {
            const response = await fetch(
                `https://api.exchangerate.host/latest?base=${baseCurrency}&symbols=${supportedCurrencies.join(',')}`
            );
            
            if (response.ok) {
                const data = await response.json();
                if (data.success !== false && data.rates) {
                    const rates = {
                        USD: 1,
                        ...data.rates
                    };
                    
                    console.log('[ExchangeRates] Fetched live rates from exchangerate.host:', rates);
                    
                    return res.json({
                        success: true,
                        base: baseCurrency,
                        rates,
                        source: 'exchangerate.host',
                        timestamp: data.timestamp || Date.now()
                    });
                }
            }
        } catch (fallbackError) {
            console.warn('[ExchangeRates] Fallback API failed:', fallbackError.message);
        }
        
        // Ultimate fallback to static rates if all APIs fail
        // These are approximate rates and should be updated periodically
        const fallbackRates = {
            USD: 1,
            EUR: 0.92,
            GBP: 0.79,
            CAD: 1.36,
            AUD: 1.53
        };
        
        console.log('[ExchangeRates] Using static fallback rates');
        
        res.json({
            success: true,
            base: baseCurrency,
            rates: fallbackRates,
            source: 'static_fallback',
            timestamp: Date.now()
        });
        
    } catch (error) {
        console.error('Get Exchange Rates Error:', error);
        res.status(500).json({ error: error.message });
    }
};

/**
 * Convert price to target currency
 * POST /api/stripe/convert-price
 * Body: { amountUSD, targetCurrency }
 */
export const convertPrice = async (req, res) => {
    try {
        const { amountUSD, targetCurrency = 'USD' } = req.body;
        
        if (typeof amountUSD !== 'number' || amountUSD < 0) {
            return res.status(400).json({ error: 'Invalid amount' });
        }
        
        const currency = targetCurrency.toUpperCase();
        const supportedCurrencies = ['USD', 'EUR', 'GBP', 'CAD', 'AUD'];
        
        if (!supportedCurrencies.includes(currency)) {
            return res.json({
                originalAmount: amountUSD,
                convertedAmount: amountUSD,
                currency: 'USD',
                rate: 1,
                message: 'Unsupported currency, defaulting to USD'
            });
        }
        
        if (currency === 'USD') {
            return res.json({
                originalAmount: amountUSD,
                convertedAmount: amountUSD,
                currency: 'USD',
                rate: 1
            });
        }
        
        // Fetch current rate
        try {
            const response = await fetch(
                `https://api.exchangerate.host/convert?from=USD&to=${currency}&amount=${amountUSD}`
            );
            
            if (response.ok) {
                const data = await response.json();
                if (data.success && data.result) {
                    return res.json({
                        originalAmount: amountUSD,
                        convertedAmount: Math.round(data.result * 100) / 100,
                        currency,
                        rate: data.info?.rate || data.result / amountUSD,
                        source: 'live'
                    });
                }
            }
        } catch (fetchError) {
            console.warn('[Stripe] Price conversion API failed:', fetchError.message);
        }
        
        // Fallback rates
        const fallbackRates = { EUR: 0.92, GBP: 0.79, CAD: 1.36, AUD: 1.53 };
        const rate = fallbackRates[currency] || 1;
        const convertedAmount = Math.round(amountUSD * rate * 100) / 100;
        
        res.json({
            originalAmount: amountUSD,
            convertedAmount,
            currency,
            rate,
            source: 'fallback'
        });
        
    } catch (error) {
        console.error('Convert Price Error:', error);
        res.status(500).json({ error: error.message });
    }
};


/**
 * CREATE PAYMENT INTENT FOR AT-DOOR CARD PAYMENTS
 * Used in Check-In Portal for in-app card processing via Stripe Payment Element
 */
export const createAtDoorPaymentIntent = async (req, res) => {
    try {
        const stripe = getStripe();
        const { registrationId, amount, currency = 'usd' } = req.body;

        if (!registrationId || !amount) {
            return res.status(400).json({ error: 'Registration ID and amount are required' });
        }

        // Validate amount
        const amountInCents = Math.round(parseFloat(amount) * 100);
        if (amountInCents < 50) {
            return res.status(400).json({ error: 'Amount must be at least $0.50' });
        }

        // Get registration with event details
        const { data: registration, error: regError } = await supabase
            .from('registrations')
            .select(`
                *,
                event:events (
                    id,
                    title,
                    owner_id,
                    owner:profiles!events_owner_id_fkey (
                        id,
                        stripe_connect_id,
                        stripe_onboarding_complete
                    )
                )
            `)
            .eq('id', registrationId)
            .single();

        if (regError || !registration) {
            console.error('[Stripe] Registration not found:', regError);
            return res.status(404).json({ error: 'Registration not found' });
        }

        // Prevent duplicate payments
        if (registration.payment_status === 'completed') {
            return res.status(400).json({ error: 'This registration is already paid' });
        }

        // Get organizer's Stripe Connect ID for destination charge
        const organizerStripeId = registration.event?.owner?.stripe_connect_id;
        const isRealStripeAccount = organizerStripeId && 
            !organizerStripeId.startsWith('mock_') &&
            registration.event?.owner?.stripe_onboarding_complete;

        // Calculate platform fee (same as regular checkout)
        const platformFeePercent = 0.029; // 2.9% platform fee
        const platformFeeAmount = Math.round(amountInCents * platformFeePercent);

        // Build PaymentIntent options
        const paymentIntentOptions = {
            amount: amountInCents,
            currency: currency.toLowerCase(),
            automatic_payment_methods: {
                enabled: true,
            },
            metadata: {
                registrationId,
                eventId: registration.event_id,
                attendeeEmail: registration.attendee_email,
                attendeeName: registration.attendee_name,
                paymentType: 'at_door_card',
            },
        };

        // Add Connect destination if organizer has connected account
        if (isRealStripeAccount) {
            paymentIntentOptions.application_fee_amount = platformFeeAmount;
            paymentIntentOptions.transfer_data = {
                destination: organizerStripeId,
            };
            console.log(`[Stripe] At-door PI with Connect destination: ${organizerStripeId}, fee: ${platformFeeAmount} cents`);
        } else {
            console.log(`[Stripe] At-door PI without Connect (no real account)`);
        }

        // Create the PaymentIntent
        const paymentIntent = await stripe.paymentIntents.create(paymentIntentOptions);

        console.log(`[Stripe] Created at-door PaymentIntent: ${paymentIntent.id} for reg: ${registrationId}`);

        res.json({
            clientSecret: paymentIntent.client_secret,
            paymentIntentId: paymentIntent.id,
            amount: amountInCents / 100,
            currency: currency.toLowerCase(),
        });

    } catch (error) {
        console.error('[Stripe] At-door PaymentIntent error:', error);
        res.status(500).json({ error: error.message || 'Failed to create payment intent' });
    }
};

/**
 * CONFIRM AT-DOOR PAYMENT
 * Called after Stripe Payment Element confirms the payment
 * Updates registration status and creates financial records
 */
export const confirmAtDoorPayment = async (req, res) => {
    try {
        const stripe = getStripe();
        const { paymentIntentId, registrationId } = req.body;

        if (!paymentIntentId || !registrationId) {
            return res.status(400).json({ error: 'Payment Intent ID and Registration ID are required' });
        }

        // Verify the PaymentIntent status
        const paymentIntent = await stripe.paymentIntents.retrieve(paymentIntentId);

        if (paymentIntent.status !== 'succeeded') {
            return res.status(400).json({ 
                error: `Payment not completed. Status: ${paymentIntent.status}`,
                status: paymentIntent.status
            });
        }

        // Verify registration ID matches
        if (paymentIntent.metadata.registrationId !== registrationId) {
            return res.status(400).json({ error: 'Payment Intent does not match registration' });
        }

        // Update registration as paid
        const { error: updateError } = await supabase
            .from('registrations')
            .update({
                payment_status: 'completed',
                approval_status: 'approved',
                stripe_payment_intent_id: paymentIntentId,
                paid_at: new Date().toISOString(),
            })
            .eq('id', registrationId);

        if (updateError) {
            console.error('[Stripe] Failed to update registration:', updateError);
            return res.status(500).json({ error: 'Failed to update registration status' });
        }

        // Record financial transaction
        const grossAmount = paymentIntent.amount / 100;
        const currency = paymentIntent.currency.toUpperCase();

        try {
            await supabase.from('financial_transactions').insert({
                event_id: paymentIntent.metadata.eventId,
                registration_id: registrationId,
                type: 'sale',
                gross_amount: grossAmount,
                platform_fee: paymentIntent.application_fee_amount ? paymentIntent.application_fee_amount / 100 : 0,
                net_amount: paymentIntent.amount_received ? paymentIntent.amount_received / 100 : grossAmount,
                currency: currency,
                payment_method: 'card',
                payment_source: 'stripe_at_door',
                stripe_payment_intent_id: paymentIntentId,
                status: 'completed',
                created_at: new Date().toISOString(),
            });
            console.log(`[Stripe] Financial transaction recorded for at-door payment: ${registrationId}`);
        } catch (txError) {
            console.warn('[Stripe] Could not record financial transaction:', txError);
            // Non-blocking - registration is already marked as paid
        }

        // Create audit log
        try {
            await supabase.from('audit_logs').insert({
                timestamp: new Date().toISOString(),
                actor_id: 'check_in_staff',
                actor_type: 'staff',
                actor_email: null,
                action: 'at_door_card_payment',
                target_type: 'registration',
                target_id: registrationId,
                details: {
                    eventId: paymentIntent.metadata.eventId,
                    grossAmount: grossAmount,
                    currency: currency,
                    paymentIntentId: paymentIntentId,
                }
            });
        } catch (auditError) {
            console.warn('[Stripe] Could not create audit log:', auditError);
        }

        console.log(`[Stripe] At-door payment confirmed: ${paymentIntentId} for reg: ${registrationId}`);

        res.json({
            success: true,
            registrationId,
            paymentIntentId,
            amount: grossAmount,
            currency,
        });

    } catch (error) {
        console.error('[Stripe] Confirm at-door payment error:', error);
        res.status(500).json({ error: error.message || 'Failed to confirm payment' });
    }
};

