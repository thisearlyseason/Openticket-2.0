import express from 'express';
import supabase from '../services/supabase.js';
import verifyFirebaseToken from '../middlewares/authMiddleware.js';
import { v4 as uuidv4 } from 'uuid';

const router = express.Router();

/**
 * Submit SMM signup request (Affiliate or Organizer)
 * POST /api/smm/signup
 * Body: { userType: 'affiliate' | 'organizer', subscriptionId?: string, stripeSessionId?: string }
 */
router.post('/signup', verifyFirebaseToken, async (req, res) => {
    try {
        const { uid, email, name } = req.user;
        const { userType, subscriptionId, stripeSessionId } = req.body;

        // Validate user type
        if (!['affiliate', 'organizer'].includes(userType)) {
            return res.status(400).json({ error: 'Invalid user type' });
        }

        // Check if user already signed up
        const { data: existingSignup } = await supabase
            .from('smm_signups')
            .select('*')
            .eq('user_id', uid)
            .single();

        if (existingSignup) {
            return res.status(400).json({ 
                error: 'You have already requested SMM access',
                signup: existingSignup
            });
        }

        // Get user profile for affiliate code
        let affiliateCode = null;
        if (userType === 'affiliate') {
            const { data: profile } = await supabase
                .from('profiles')
                .select('affiliate_code')
                .eq('id', uid)
                .single();
            affiliateCode = profile?.affiliate_code;
        }

        // Create signup record
        const signupData = {
            id: uuidv4(),
            user_id: uid,
            user_email: email || '',
            user_name: name || '',
            user_type: userType,
            affiliate_code: affiliateCode,
            subscription_id: subscriptionId || null,
            stripe_session_id: stripeSessionId || null,
            subscription_status: userType === 'organizer' ? 'pending_payment' : 'free',
            status: 'pending',
            signup_date: new Date().toISOString()
        };

        const { data, error } = await supabase
            .from('smm_signups')
            .insert(signupData)
            .select()
            .single();

        if (error) {
            console.error('[SMM] Signup insert error:', error);
            throw error;
        }

        console.log('[SMM] Signup created:', data.id, 'for user:', uid, 'type:', userType);

        res.json({ 
            success: true,
            message: `Your ${userType} SMM signup request has been submitted!`,
            signup: data
        });
    } catch (error) {
        console.error('[SMM] Signup error:', error);
        res.status(500).json({ error: error.message });
    }
});

/**
 * Get user's SMM signup status
 * GET /api/smm/status
 */
router.get('/status', verifyFirebaseToken, async (req, res) => {
    try {
        const { uid } = req.user;

        const { data, error } = await supabase
            .from('smm_signups')
            .select('*')
            .eq('user_id', uid)
            .single();

        if (error && error.code !== 'PGRST116') {
            throw error;
        }

        res.json({
            hasSignedUp: !!data,
            signup: data || null
        });
    } catch (error) {
        console.error('[SMM] Status error:', error);
        res.status(500).json({ error: error.message });
    }
});

/**
 * Get all SMM signups (Super Admin only)
 * GET /api/admin/smm/signups
 */
router.get('/admin/signups', verifyFirebaseToken, async (req, res) => {
    try {
        const { uid } = req.user;

        // Verify user is super admin
        const { data: profile } = await supabase
            .from('profiles')
            .select('is_admin')
            .eq('id', uid)
            .single();

        if (!profile?.is_admin) {
            return res.status(403).json({ error: 'Unauthorized: Admin access required' });
        }

        const { data, error } = await supabase
            .from('smm_signups')
            .select('*')
            .order('signup_date', { ascending: false });

        if (error) throw error;

        res.json({
            signups: data || [],
            total: data?.length || 0
        });
    } catch (error) {
        console.error('[SMM] Get signups error:', error);
        res.status(500).json({ error: error.message });
    }
});

/**
 * Send magic link email (Super Admin only)
 * POST /api/admin/smm/send-magic-link
 * Body: { signupId: string, magicLink: string }
 */
router.post('/admin/send-magic-link', verifyFirebaseToken, async (req, res) => {
    try {
        const { uid } = req.user;
        const { signupId, magicLink } = req.body;

        if (!signupId || !magicLink) {
            return res.status(400).json({ error: 'signupId and magicLink are required' });
        }

        // Verify user is super admin
        const { data: profile } = await supabase
            .from('profiles')
            .select('is_admin')
            .eq('id', uid)
            .single();

        if (!profile?.is_admin) {
            return res.status(403).json({ error: 'Unauthorized: Admin access required' });
        }

        // Get signup details
        const { data: signup, error: signupError } = await supabase
            .from('smm_signups')
            .select('*')
            .eq('id', signupId)
            .single();

        if (signupError || !signup) {
            return res.status(404).json({ error: 'Signup not found' });
        }

        // Update signup with magic link
        const { error: updateError } = await supabase
            .from('smm_signups')
            .update({
                magic_link: magicLink,
                magic_link_sent_date: new Date().toISOString(),
                status: 'sent',
                updated_at: new Date().toISOString()
            })
            .eq('id', signupId);

        if (updateError) throw updateError;

        // Send email via Resend
        try {
            const Resend = (await import('resend')).Resend;
            const resend = new Resend(process.env.RESEND_API_KEY);

            const emailSubject = '🎉 Your Social Media Manager Access Is Ready!';
            
            const emailBody = signup.user_type === 'affiliate' 
                ? `
                    <h2>Yay! You did it 🎉</h2>
                    <p>We've got your Magic Login link for the Social Media Manager for Open Ticket Events — powered by <strong>Viral Spark Media</strong>.</p>
                    <p style="margin: 20px 0;">
                        👉 <a href="${magicLink}" style="background: #E0FF20; color: #000; padding: 12px 24px; text-decoration: none; border-radius: 8px; font-weight: bold;">Your Magic Link</a>
                    </p>
                    <p>Jump in, connect your socials, start sharing, and turn your posts into earnings 💰</p>
                    <p>Have questions? We're here to help — now go make some noise!</p>
                    <hr style="margin: 30px 0; border: none; border-top: 1px solid #eee;" />
                    <p style="color: #666; font-size: 12px;">OpenTicket - Social Media Management Program</p>
                `
                : `
                    <h2>Yay! You're officially in 🎉</h2>
                    <p>Your Social Media Management access from <strong>Viral Spark Media</strong> is ready to go.</p>
                    <p style="margin: 20px 0;">
                        👉 <a href="${magicLink}" style="background: #E0FF20; color: #000; padding: 12px 24px; text-decoration: none; border-radius: 8px; font-weight: bold;">Your Magic Link</a>
                    </p>
                    <p>Log in, connect your socials, start promoting your events, and turn engagement into ticket sales 🎟️💰</p>
                    <p>Need help? Just let us know — we've got you covered!</p>
                    <hr style="margin: 30px 0; border: none; border-top: 1px solid #eee;" />
                    <p style="color: #666; font-size: 12px;">OpenTicket - Social Media Management Program</p>
                `;

            await resend.emails.send({
                from: process.env.SENDER_EMAIL || 'tickets@openticket.events',
                to: signup.user_email,
                subject: emailSubject,
                html: emailBody
            });

            console.log('[SMM] Magic link email sent to:', signup.user_email);
        } catch (emailError) {
            console.error('[SMM] Email send error:', emailError);
            // Don't fail the request if email fails - admin can manually send
        }

        res.json({
            success: true,
            message: `Magic link sent to ${signup.user_email}`,
            signup
        });
    } catch (error) {
        console.error('[SMM] Send magic link error:', error);
        res.status(500).json({ error: error.message });
    }
});

export default router;
