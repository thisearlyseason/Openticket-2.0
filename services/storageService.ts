import { Event, Registration, User, PlanType, PaymentMethod, Invoice, ContactSubmission, DebitCard, SystemNotification, AuditLog, Broadcast } from '../types';
import { auth, storage, googleProvider } from './firebaseConfig';
// Removed: Firestore imports
// Removed: ShadowService import (integrated)

// @ts-ignore
import { ref, uploadString, getDownloadURL } from 'firebase/storage';
// @ts-ignore
import { signInWithEmailAndPassword, createUserWithEmailAndPassword, signOut, signInWithPopup } from 'firebase/auth';

const CURRENT_USER_KEY = 'openticket_current_user';
const SYSTEM_NOTE_KEY = 'openticket_system_notification';

// Local Storage Keys for Fallback
const LS_EVENTS_KEY = 'openticket_events_data';
const LS_USERS_KEY = 'openticket_users_data';
const LS_REGS_KEY = 'openticket_registrations_data';
const LS_WAITLIST_KEY = 'openticket_waitlist_data';
const LS_AUDIT_KEY = 'openticket_audit_logs';

// Internal State
let isOffline = false;
let isDemoMode = false;
let initError: Error | null = null;

// Backend Configuration
// Use relative path for Vercel deployment (rewrites handle /api -> backend)
const isProduction = import.meta.env.PROD || window.location.hostname !== 'localhost' && window.location.hostname !== '127.0.0.1';
const SUPABASE_API_BASE = isProduction ? '/api' : (import.meta.env.VITE_API_URL || '/api');

const fetchSupabase = async (endpoint: string, authenticated = true): Promise<any> => {
    const headers: any = { 'Content-Type': 'application/json' };
    if (authenticated) {
        // Use Firebase Auth token to authenticate with Backend
        const { getAuthToken } = await import('./firebaseConfig');
        const token = await getAuthToken();
        if (token) headers['Authorization'] = `Bearer ${token}`;
    }
    const res = await fetch(`${SUPABASE_API_BASE}${endpoint}`, { headers });
    if (!res.ok) {
        let errorMsg = `Backend API error: ${res.status} ${res.statusText}`;
        try {
            const errorBody = await res.json();
            if (errorBody.error) errorMsg += ` - ${errorBody.error}`;
        } catch (e) {
            // ignore json parse error
        }
        console.error(errorMsg);
        throw new Error(errorMsg);
    }
    return res.json();
};

const postSupabase = async (endpoint: string, method: 'POST' | 'PUT' | 'DELETE', body?: any): Promise<any> => {
    const headers: any = { 'Content-Type': 'application/json' };

    // Always authenticate writes
    const { getAuthToken } = await import('./firebaseConfig');
    const token = await getAuthToken();
    if (token) headers['Authorization'] = `Bearer ${token}`;

    const options: RequestInit = {
        method,
        headers,
    };
    if (body) options.body = JSON.stringify(body);

    const res = await fetch(`${SUPABASE_API_BASE}${endpoint}`, options);
    // DELETE operations might return 204 No Content
    if (res.status === 204) return null;
    if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        throw new Error(err.error || `Backend API error: ${res.statusText}`);
    }
    return res.json().catch(() => ({}));
};

// Caching State
let _eventsCache: { data: Event[], timestamp: number } | null = null;
const CACHE_TTL = 60000; // 1 Minute

const clearCache = (type: 'events' | 'regs' | 'all' = 'all') => {
    if (type === 'events' || type === 'all') _eventsCache = null;
};

export const PLANS = {
    free: {
        name: 'Free',
        priceMonthly: 0,
        priceYearly: 0,
        feePercent: 0.0275, // 2.75%
        feeFixed: 0.99, // $0.99
        ticketLimit: 50,
        eventLimit: 3, // per month
        showDonationButton: true,
        features: ['50 Tickets per Event', '3 Events per Month', 'Standard Support', 'Platform Donation Button']
    },
    pro: {
        name: 'Pro',
        priceMonthly: 39,
        priceYearly: 390,
        feePercent: 0.015, // 1.5%
        feeFixed: 0.75, // $0.75
        ticketLimit: 250,
        eventLimit: 9999, // Unlimited
        showDonationButton: false,
        features: ['250 Tickets per Event', 'Unlimited Events', 'Priority Support', 'Advanced Analytics']
    },
    premium: {
        name: 'Premium',
        priceMonthly: 110,
        priceYearly: 1100,
        feePercent: 0.0075, // 0.75%
        feeFixed: 0,
        ticketLimit: 999999, // Unlimited
        eventLimit: 9999,
        showDonationButton: false,
        features: ['Unlimited Tickets', 'Unlimited Events', 'Dedicated Support', 'White Labeling', 'Lowest Fees']
    }
};

const safeStringify = (obj: any) => {
    const cache = new Set();
    return JSON.stringify(obj, (key, value) => {
        if (typeof value === 'object' && value !== null) {
            if (cache.has(value)) {
                return;
            }
            cache.add(value);
        }
        return value;
    });
};

const sanitizeInput = (input: any): any => {
    if (typeof input === 'string') {
        return input
            .replace(/<script\b[^>]*>([\s\S]*?)<\/script>/gim, "")
            .replace(/on\w+="[^"]*"/g, "")
            .replace(/javascript:/g, "");
    }
    if (Array.isArray(input)) {
        return input.map(i => sanitizeInput(i));
    }
    if (typeof input === 'object' && input !== null) {
        const newObj: any = {};
        for (const key in input) {
            if (Object.prototype.hasOwnProperty.call(input, key)) {
                newObj[key] = sanitizeInput(input[key]);
            }
        }
        return newObj;
    }
    return input;
};

const isRegistrationExpired = (reg: Registration, event: Event): boolean => {
    if (!event.paymentTimeLimit || event.paymentTimeLimit <= 0) return false;
    if (reg.paymentStatus === 'offline_pending' || reg.paymentStatus === 'pending') {
        const expireTime = reg.timestamp + (event.paymentTimeLimit * 3600 * 1000);
        return Date.now() > expireTime;
    }
    return false;
};

const calculateRealRegisteredCount = (event: Event, allRegs: Registration[]): number => {
    const eventRegs = allRegs.filter(r => r.eventId === event.id);
    let total = 0;
    eventRegs.forEach(r => {
        if (r.paymentStatus === 'refunded' || r.approvalStatus === 'rejected') return;
        if (!isRegistrationExpired(r, event)) {
            if (r.tickets && r.tickets.length > 0) {
                total += r.tickets.reduce((acc, t) => acc + (t.status === 'refunded' ? 0 : t.quantity), 0);
            } else {
                total += 1;
            }
        }
    });
    return total;
};

const getLocal = <T>(key: string): T[] => {
    try {
        return JSON.parse(localStorage.getItem(key) || '[]');
    } catch { return []; }
};

const setLocal = <T>(key: string, data: T[]) => {
    try {
        localStorage.setItem(key, safeStringify(data));
    } catch (e) {
        console.error("LocalStorage write failed", e);
    }
};

const logAuditEvent = (action: string, details: string, userId?: string, resourceId?: string) => {
    const log: AuditLog = {
        id: `audit-${Date.now()}-${Math.random().toString(36).substr(2, 5)}`,
        action,
        details,
        timestamp: Date.now(),
        ip: 'client-side'
    };
    const logs = getLocal<AuditLog>(LS_AUDIT_KEY);
    logs.push(log);
    setLocal(LS_AUDIT_KEY, logs);
};

const verifyOrganizerAccess = async (resourceOwnerId: string): Promise<boolean> => {
    const currentUser = StorageService.getCurrentUser();
    if (!currentUser) return false;
    if (currentUser.isAdmin) return true;
    if (currentUser.id === resourceOwnerId) return true;
    const owner = await StorageService.getUserById(resourceOwnerId);
    if (owner && owner.teamMembers) {
        const isMember = owner.teamMembers.some(m => m.email === currentUser.email && (m.role === 'admin' || m.role === 'editor'));
        if (isMember) return true;
    }
    return false;
};

const populateDummyData = () => {
    // Only used for offline/demo mode
    const events = getLocal<Event>(LS_EVENTS_KEY);
    const now = Date.now();
    const day = 86400000;

    const requiredEvents: Event[] = [
        {
            id: 'demo-evt-1',
            ownerId: 'user1',
            title: 'Summer Music Festival',
            subtitle: 'Live music under the stars',
            description: '<p>Join us for the biggest music event of the summer!</p>',
            date: new Date(now + day * 14).toISOString().split('T')[0],
            time: '14:00',
            location: 'Central Park, New York',
            venueName: 'The Great Lawn',
            imageUrl: 'https://images.unsplash.com/photo-1533174072545-e8d4aa97edf9?w=800&q=80',
            price: 45,
            priceType: 'fixed',
            capacity: 500,
            registeredCount: 120,
            createdAt: now - day * 10,
            isDraft: false,
            visibility: 'public',
            organizer: 'City Beats',
            organizerEmail: 'info@citybeats.com',
            paymentConfig: { method: 'online' },
            questions: [], gallery: [], reminders: [],
            eventType: 'in_person',
            category: 'music',
            isRecurring: false
        }
    ];

    const mergedEvents = [...events];
    requiredEvents.forEach(req => {
        if (!mergedEvents.some(e => e.id === req.id)) {
            mergedEvents.push(req);
        }
    });
    setLocal(LS_EVENTS_KEY, mergedEvents);

    const dummyUser: User = {
        id: 'user1',
        name: 'Demo Organizer',
        email: 'demo@example.com',
        password: 'password',
        role: 'organizer',
        isAdmin: false,
        balanceDue: 0,
        availablePayout: 1250.50,
        paymentMethods: [],
        invoices: [],
        subscription: { plan: 'pro', cycle: 'monthly', status: 'active', nextBillingDate: now + day * 20 },
        businessName: 'Neon Events Co.'
    };

    setLocal(LS_USERS_KEY, [dummyUser]);
};

const StripeService = {
    processSplitPayment: async (amount: number, fee: number, organizerConnectId: string) => {
        return { paymentIntentId: `pi_${Math.random().toString(36).substr(2, 20)}`, transferId: `tr_${Math.random().toString(36).substr(2, 20)}`, success: true };
    },
    processSubscriptionPayment: async (amount: number, userId: string, planName: string, cycle: 'monthly' | 'yearly' = 'monthly'): Promise<boolean> => {
        try {
            const user = StorageService.getCurrentUser();
            const res = await fetch(`${SUPABASE_API_BASE}/subscription/create-checkout`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    userId,
                    userEmail: user?.email,
                    planName,
                    cycle,
                    amount
                })
            });

            const data = await res.json();
            if (data.url) {
                window.location.href = data.url;
                return true; // Will redirect
            } else {
                throw new Error(data.error || "Failed to initiate checkout");
            }
        } catch (e: any) {
            console.error("Subscription Checkout Failed", e);
            throw new Error(`Subscription initialization failed: ${e.message}`);
        }
    },
    refundSplitPayment: async (paymentIntentId: string) => true
};

const normalizeEvent = (raw: any): Event => {
    if (!raw) return raw;
    // If already normalized (has imageUrl), just return
    if (raw.imageUrl && !raw.image_url) return raw;

    return {
        ...raw,
        id: raw.id,
        ownerId: raw.owner_id || raw.ownerId,
        title: raw.title,
        description: raw.description,
        category: raw.category,
        eventType: raw.event_type || raw.eventType,
        date: raw.date,
        time: raw.time,
        location: raw.location,
        venueName: raw.venue_name || raw.venueName,
        imageUrl: raw.image_url || raw.imageUrl, // Fixes image issue
        price: Number(raw.price),
        priceType: raw.price_type || raw.priceType,
        capacity: raw.capacity,
        isDraft: raw.is_draft ?? raw.isDraft,
        visibility: raw.visibility,
        paymentConfig: raw.payment_config || raw.paymentConfig,
        waiverConfig: raw.waiver_config || raw.waiverConfig,
        questions: raw.questions,
        ticketTiers: raw.ticket_tiers || raw.ticketTiers,
        addOns: raw.add_ons || raw.addOns,
        customFees: raw.custom_fees || raw.customFees,
        absorbFees: raw.absorb_fees ?? raw.absorbFees,
        createdAt: new Date(raw.created_at || raw.createdAt).getTime(),
        registeredCount: raw.registeredCount || 0
    };
};

const normalizeRegistration = (r: any): Registration => {
    return {
        id: r.id,
        eventId: r.event_id,
        attendeeName: r.attendee_name,
        attendeeEmail: r.attendee_email,
        paymentStatus: r.payment_status,
        approvalStatus: r.approval_status,
        tickets: r.tickets || [], // Ensure this is not a string
        answers: r.answers || {},
        serviceFee: r.service_fee || 0,
        donationAmount: r.donation_amount || 0,
        addOns: r.add_ons || [],
        promoCodeUsed: r.promo_code_used,
        timestamp: new Date(r.created_at || Date.now()).getTime(),
        taxAmount: r.tax_amount || 0,
        customFeesAmount: r.custom_fees_amount || 0,
        stripePaymentIntentId: r.stripe_payment_intent_id,
        // Map joined financial data
        stripeFee: (r.financial_transactions && r.financial_transactions.length > 0) ? r.financial_transactions[0].stripe_fee : 0
    };
};

export const StorageService = {
    isOfflineMode: () => isOffline,
    isDemoMode: () => isDemoMode,
    getLastError: () => initError,
    Stripe: StripeService,

    init: async () => {
        // Wait for Firebase Auth to initialize before rendering app
        return new Promise<void>((resolve) => {
            console.log("StorageService: Waiting for Auth...");
            const unsubscribe = auth.onAuthStateChanged(async (firebaseUser) => {
                unsubscribe(); // Run once

                if (firebaseUser) {
                    console.log("StorageService: Auth Restored for", firebaseUser.email);
                    // Sync: Ensure LocalStorage matches Firebase Auth
                    const localUser = StorageService.getCurrentUser();
                    if (!localUser || localUser.id !== firebaseUser.uid) {
                        try {
                            console.log("StorageService: Syncing Profile from Backend...");
                            const profile = await StorageService.getUserById(firebaseUser.uid);
                            if (profile) {
                                localStorage.setItem(CURRENT_USER_KEY, safeStringify(profile));
                            }
                        } catch (e) {
                            console.error("StorageService: Profile Sync Failed", e);
                        }
                    }
                } else {
                    console.log("StorageService: No Active Session");
                }
                resolve();
            });

            // Fallback: If Firebase hangs, verify offline mode
            setTimeout(() => {
                if (!auth) {
                    console.warn("StorageService: Auth Timed Out, falling back to offline");
                    isOffline = true;
                    populateDummyData();
                }
                resolve();
            }, 4000);
        });
    },

    setSystemNotification: (message: string, type: 'info' | 'warning' | 'success' = 'info') => {
        const currentUser = StorageService.getCurrentUser();
        if (!currentUser?.isAdmin) return;
        const note: SystemNotification = { id: `note-${Date.now()}`, message, type, active: true, timestamp: Date.now() };
        localStorage.setItem(SYSTEM_NOTE_KEY, safeStringify(note));
    },

    getSystemNotification: (): SystemNotification | null => {
        const data = localStorage.getItem(SYSTEM_NOTE_KEY);
        if (!data) return null;
        try { const note = JSON.parse(data); return note.active ? note : null; } catch { return null; }
    },

    clearSystemNotification: () => {
        const currentUser = StorageService.getCurrentUser();
        if (!currentUser?.isAdmin) return;
        localStorage.removeItem(SYSTEM_NOTE_KEY);
    },

    saveContactMessage: async (data: any) => {
        if (isOffline) return true;
        try {
            // Post to backend
            await postSupabase('/contacts', 'POST', { timestamp: Date.now(), ...sanitizeInput(data) });
            return true;
        } catch { return false; }
    },

    uploadFile: async (base64Data: string, path: string): Promise<string> => {
        if (isOffline || !storage) {
            // Mock upload in offline mode
            return base64Data;
        }
        try {
            const storageRef = ref(storage, path);
            await uploadString(storageRef, base64Data, 'data_url');
            const url = await getDownloadURL(storageRef);
            return url;
        } catch (e: any) {
            console.error("Upload failed", e);
            throw new Error(`Upload failed: ${e.message}`);
        }
    },

    calculateFees: (subtotal: number, planType: PlanType = 'free') => {
        if (subtotal <= 0) return 0; // Fix: No fees on free events
        const plan = PLANS[planType] || PLANS.free;
        const fixed = plan.feeFixed;
        const percent = subtotal * plan.feePercent;
        return Math.round((fixed + percent) * 100) / 100;
    },

    getUserById: async (id: string): Promise<User | null> => {
        if (isOffline) return getLocal<User>(LS_USERS_KEY).find(u => u.id === id) || null;
        try {
            const { profile } = await fetchSupabase(`/auth/profiles/${id}`);
            if (profile) {
                // Map snake_case to camelCase
                return {
                    ...profile,
                    isAdmin: profile.is_admin,
                    businessName: profile.business_name,
                    availablePayout: profile.available_payout,
                    balanceDue: profile.balance_due,
                    affiliateCode: profile.affiliate_code,
                    teamMembers: profile.team_members,
                    stripeConnectId: profile.stripe_connect_id,
                    stripeOnboardingComplete: profile.stripe_onboarding_complete,
                    stripePublishableKey: profile.stripe_publishable_key,
                    stripeSecretKey: profile.stripe_secret_key
                } as User;
            }
            return null;
        } catch (e: any) {
            // Check if it's a 404 (Not Found)
            if (e.message && e.message.includes('404')) {
                return null;
            }
            console.error("Frontend: Supabase profile read failed", e);
            throw e; // Re-throw real errors to prevent accidental overwrite
        }
    },

    // --- ADMIN METHODS ---
    getAllEventsAdmin: async (): Promise<Event[]> => {
        try {
            const events = await fetchSupabase('/admin/events');
            return (events || []).map(normalizeEvent);
        } catch (e) {
            console.error("Admin fetch events failed", e);
            throw e;
        }
    },

    getAllRegistrationsAdmin: async (): Promise<Registration[]> => {
        try {
            const regs = await fetchSupabase('/admin/registrations');
            return regs || [];
        } catch (e) {
            console.error("Admin fetch registrations failed", e);
            throw e;
        }
    },

    getAllUsersAdmin: async (): Promise<User[]> => {
        try {
            const users = await fetchSupabase('/admin/users');
            // Normalize if needed, mostly consistent
            return users || [];
        } catch (e) {
            console.error("Admin fetch users failed", e);
            throw e;
        }
    },

    getAdminFinancials: async (): Promise<{ totalVolume: number, platformFees: number, organizerNet: number, recentTransactions: any[] }> => {
        try {
            return await fetchSupabase('/admin/financials');
        } catch (e) {
            console.error("Admin fetch financials failed", e);
            // Return zeroed structure on failure to prevent dashboard crash
            return { totalVolume: 0, platformFees: 0, organizerNet: 0, recentTransactions: [] };
        }
    },

    getSuperAdmin: async (): Promise<User | undefined> => {
        // Return current user if admin
        const u = StorageService.getCurrentUser();
        return u?.isAdmin ? u : undefined;
    },

    checkAffiliateCodeUnique: async (code: string) => {
        // Can be implemented via backend check if needed
        return true;
    },

    login: async (email: string, password: string): Promise<{ user: User | null, error?: string }> => {
        if (isOffline) {
            const user = getLocal<User>(LS_USERS_KEY).find(u => u.email === email && u.password === password);
            if (user) {
                localStorage.setItem(CURRENT_USER_KEY, safeStringify(user));
                return { user };
            }
            return { user: null, error: "Invalid credentials" };
        }
        try {
            const userCredential = await signInWithEmailAndPassword(auth, email, password);
            // Fetch profile from Backend to confirm it exists
            const user = await StorageService.getUserById(userCredential.user.uid);
            if (user) {
                localStorage.setItem(CURRENT_USER_KEY, safeStringify(user));
                return { user };
            }
            // Should verify why user exists in Auth but not DB. For now, try to sync?
            // Since we removed ShadowService, the backend needs to handle creation on triggers.
            // If manual sync needed:
            await postSupabase('/auth/sync', 'POST', {
                id: userCredential.user.uid,
                email: userCredential.user.email,
                name: userCredential.user.email?.split('@')[0]
            });
            const retried = await StorageService.getUserById(userCredential.user.uid);
            if (retried) {
                localStorage.setItem(CURRENT_USER_KEY, safeStringify(retried));
                return { user: retried };
            }

            return { user: null, error: "User profile not found." };
        } catch (e: any) { return { user: null, error: `Login Error: ${e.message || e.code}` }; }
    },

    loginWithGoogle: async (desiredRole: 'attendee' | 'organizer' | 'affiliate' = 'attendee'): Promise<{ user: User | null, error?: string }> => {
        if (isOffline) return StorageService.login('demo@example.com', 'password');
        try {
            const result = await signInWithPopup(auth, googleProvider);
            const uid = result.user.uid;

            // Check if user exists first to avoid overwriting role (CRITICAL FIX)
            let existingUser = null;
            try {
                existingUser = await StorageService.getUserById(uid);
            } catch (err: any) {
                console.error("Critical Login Error:", err);
                // If checking user fails (network error), ABORT. Do not overwrite.
                return { user: null, error: `Login failed: Unable to verify account status (${err.message || "Connection Error"}). Please check connection.` };
            }

            if (existingUser) {
                // If user exists, log them in without overwriting their data
                localStorage.setItem(CURRENT_USER_KEY, safeStringify(existingUser));
                return { user: existingUser };
            }

            // Sync user to Backend (Create new)
            const payload = {
                id: uid,
                email: result.user.email,
                name: result.user.displayName || 'User',
                role: desiredRole,
                image_url: result.user.photoURL
            };

            // Post to sync endpoint which handles "create if not exists"
            await postSupabase('/auth/sync', 'POST', payload);

            const user = await StorageService.getUserById(uid);
            if (user) {
                localStorage.setItem(CURRENT_USER_KEY, safeStringify(user));
                return { user };
            }
            return { user: null, error: "Profile creation failed" };
        } catch (e: any) {
            return { user: null, error: e.message || "Google Login Failed" };
        }
    },

    signup: async (userData: Partial<User>) => {
        const cleanData = sanitizeInput(userData);
        if (isOffline) {
            const newUser = { id: `u-${Date.now()}`, ...cleanData, role: cleanData.role || 'attendee' } as User;
            setLocal(LS_USERS_KEY, [newUser]);
            return newUser;
        }
        try {
            const userCredential = await createUserWithEmailAndPassword(auth, cleanData.email, cleanData.password);
            const uid = userCredential.user.uid;

            // Sync to backend
            const payload = {
                id: uid,
                email: cleanData.email,
                name: cleanData.name,
                role: cleanData.role || 'attendee',
                business_name: cleanData.businessName
            };

            await postSupabase('/auth/sync', 'POST', payload);

            // Get full object
            const newUser = await StorageService.getUserById(uid);
            if (newUser) {
                localStorage.setItem(CURRENT_USER_KEY, safeStringify(newUser));
                return newUser;
            }
            throw new Error("Profile creation failed");
        } catch (e: any) { return e.message || "Signup failed"; }
    },

    updateUser: async (userId: string, updates: Partial<User>) => {
        if (isOffline) return null; // Simplified

        // Map to snake_case for backend
        const payload: any = {};
        if (updates.name) payload.name = updates.name;
        if (updates.businessName) payload.business_name = updates.businessName;
        if (updates.availablePayout !== undefined) payload.available_payout = updates.availablePayout;
        if (updates.balanceDue !== undefined) payload.balance_due = updates.balanceDue;
        if (updates.role) payload.role = updates.role;
        if (updates.subscription) payload.subscription = updates.subscription;
        if (updates.onboardingStep !== undefined) payload.onboarding_step = updates.onboardingStep;
        if (updates.socials) payload.socials = updates.socials;
        if (updates.address) payload.address = updates.address;
        if (updates.favoriteOrganizers) payload.favorite_organizers = updates.favoriteOrganizers;
        if (updates.stripeConnectId !== undefined) payload.stripe_connect_id = updates.stripeConnectId;
        if (updates.stripeOnboardingComplete !== undefined) payload.stripe_onboarding_complete = updates.stripeOnboardingComplete;
        if (updates.stripePublishableKey !== undefined) payload.stripe_publishable_key = updates.stripePublishableKey;
        if (updates.stripeSecretKey !== undefined) payload.stripe_secret_key = updates.stripeSecretKey;

        // Settings Overrides
        if (updates.defaultTaxRate !== undefined) payload.default_tax_rate = updates.defaultTaxRate;
        if (updates.defaultCustomFees !== undefined) payload.default_custom_fees = updates.defaultCustomFees;
        if (updates.geminiApiKey !== undefined) payload.gemini_api_key = updates.geminiApiKey;

        // Payment methods usually handled separately, but if passed:
        if (updates.paymentMethods) payload.payment_methods = updates.paymentMethods; // API handles this?

        // Missing Fields
        if (updates.notifications) payload.notifications = updates.notifications;
        if (updates.emailTemplates) payload.email_templates = updates.emailTemplates;
        if (updates.defaultConfirmationTemplate) payload.default_confirmation_template = updates.defaultConfirmationTemplate;
        if (updates.defaultWaiver) payload.default_waiver = updates.defaultWaiver;
        if (updates.defaultRefundPolicy) payload.default_refund_policy = updates.defaultRefundPolicy;
        if (updates.defaultRefundPolicyEnabled !== undefined) payload.default_refund_policy_enabled = updates.defaultRefundPolicyEnabled;
        if (updates.logoUrl) payload.logo_url = updates.logoUrl;
        if (updates.headerImageUrl) payload.header_image_url = updates.headerImageUrl;
        if (updates.primaryColor) payload.primary_color = updates.primaryColor;
        if (updates.organizerSubtitle) payload.organizer_subtitle = updates.organizerSubtitle;
        if (updates.businessType) payload.business_type = updates.businessType;
        if (updates.commissionRate !== undefined) payload.commission_rate = updates.commissionRate;
        if (updates.organizerWebsite) payload.website = updates.organizerWebsite;
        if (updates.affiliateCode) payload.affiliate_code = updates.affiliateCode;

        try {
            // Use dedicated Update endpoint for robustness
            await postSupabase(`/auth/profiles/${userId}`, 'PUT', payload);

            // Update local storage
            const updated = await StorageService.getUserById(userId);
            if (updated) localStorage.setItem(CURRENT_USER_KEY, safeStringify(updated));
            return updated;
        } catch (e) {
            console.error("StorageService.updateUser failed:", e);
            throw e;
        }
    },

    toggleFavoriteOrganizer: async (organizerId: string) => {
        const user = StorageService.getCurrentUser();
        if (!user) return null;

        const currentFavorites = user.favoriteOrganizers || [];
        const isFavorited = currentFavorites.includes(organizerId);

        let newFavorites: string[];
        if (isFavorited) {
            newFavorites = currentFavorites.filter(id => id !== organizerId);
        } else {
            newFavorites = [...currentFavorites, organizerId];
        }

        // Optimistic update locally? 
        // We'll let updateUser handle the state update via response
        return await StorageService.updateUser(user.id, { favoriteOrganizers: newFavorites });
    },

    deleteEvent: async (id: string) => {
        if (isOffline) {
            const list = getLocal<Event>(LS_EVENTS_KEY).filter(e => e.id !== id);
            setLocal(LS_EVENTS_KEY, list);
            return;
        }
        await postSupabase(`/events/${id}`, 'DELETE');
        clearCache('events');
    },

    logout: async () => { if (!isOffline && auth) await signOut(auth); localStorage.removeItem(CURRENT_USER_KEY); },
    getCurrentUser: (): User | null => { try { const data = localStorage.getItem(CURRENT_USER_KEY); return data ? JSON.parse(data) : null; } catch { return null; } },

    // For Dashboard/Manage
    getMyEvents: async (): Promise<Event[]> => {
        if (isOffline) return getLocal<Event>(LS_EVENTS_KEY).filter(e => e.ownerId === StorageService.getCurrentUser()?.id);
        try {
            const { events } = await fetchSupabase('/events', true);
            return (events || []).map(normalizeEvent);
        } catch (e) { console.warn("My Events read failed", e); return []; }
    },

    // For Explore Page
    getPublicEvents: async (): Promise<Event[]> => {
        if (isOffline) return getLocal<Event>(LS_EVENTS_KEY).filter(e => !e.isDraft && e.visibility === 'public');
        try {
            // Always hit public endpoint
            const { events } = await fetchSupabase('/events/public', false);
            return (events || []).map(normalizeEvent);
        } catch (e) { console.warn("Public Events read failed", e); return []; }
    },

    // DEPRECATED: Use getMyEvents or getPublicEvents
    getEvents: async (): Promise<Event[]> => {
        return StorageService.getMyEvents();
    },
    saveEvent: async (event: Event) => {
        const clean = sanitizeInput(event);
        if (isOffline) {
            const list = getLocal<Event>(LS_EVENTS_KEY);
            const idx = list.findIndex(e => e.id === clean.id);
            if (idx >= 0) list[idx] = clean; else list.push(clean);
            setLocal(LS_EVENTS_KEY, list);
            return;
        }

        // Use POST (create) or PUT (update)
        // Check if event exists? Or rely on ID.
        // Usually POST is for new (no ID or ignored ID), PUT for existing.
        // Map to snake_case
        const payload = {
            id: clean.id,
            title: clean.title,
            description: clean.description,
            category: clean.category,
            event_type: clean.eventType,
            date: clean.date,
            time: clean.time,
            location: clean.location,
            venue_name: clean.venueName,
            image_url: clean.imageUrl,
            price: clean.price,
            price_type: clean.priceType,
            capacity: clean.capacity,
            is_draft: clean.isDraft,
            visibility: clean.visibility,
            payment_config: clean.paymentConfig,
            waiver_config: clean.waiverConfig,
            questions: clean.questions,
            ticket_tiers: clean.ticketTiers,
            add_ons: clean.addOns,
            custom_fees: clean.customFees,
            absorb_fees: clean.absorbFees
        };

        // Determine if update or create.
        // We can try to fetch it first, or just hit PUT if we have an ID?
        // Backend /events POST likely creates.
        // Backend /events/:id PUT updates.

        // Helper: Check if known in cache
        const all = await StorageService.getEvents();
        const exists = all.some(e => e.id === clean.id);

        if (exists) {
            await postSupabase(`/events/${clean.id}`, 'PUT', payload);
        } else {
            await postSupabase('/events', 'POST', payload);
        }
        clearCache('events');
    },

    getRegistrations: async (eventId?: string): Promise<Registration[]> => {
        if (isOffline) { const list = getLocal<Registration>(LS_REGS_KEY); return eventId ? list.filter(r => r.eventId === eventId) : list; }

        try {
            const endpoint = eventId ? `/registrations/event/${eventId}` : `/registrations`;
            console.log(`[StorageService] Fetching registrations from ${endpoint}`);
            const { registrations } = await fetchSupabase(endpoint, true);
            console.log('[StorageService] Raw DB response:', registrations);

            // Map snake_case to camelCase
            const mapped = (registrations || []).map((r: any) => normalizeRegistration(r));
            console.log('[StorageService] Mapped registrations:', mapped);
            return mapped;
        } catch (e) {
            console.error('[StorageService] Fetch Error:', e);
            return [];
        }
    },

    getRegistrationBySessionId: async (sessionId: string): Promise<Registration | null> => {
        try {
            console.log(`[StorageService] Fetching registration by session ID: ${sessionId}`);
            // ALWAYS try network first, regardless of isOffline state, because this is a server-side confirmation.
            // If the user is in "offline mode" (demo), they wouldn't have a Stripe Session ID anyway.

            const response = await fetchSupabase(`/registrations?stripe_checkout_session_id=${sessionId}`, false);
            console.log('[StorageService] Polling Response:', response);

            const list = response.registrations || (Array.isArray(response) ? response : []);

            if (Array.isArray(list) && list.length > 0) {
                const reg = normalizeRegistration(list[0]);
                console.log(`[StorageService] Matched Reg: ${reg.id}, Status: ${reg.paymentStatus}`);
                return reg;
            }
            return null;
        } catch (e) {
            console.error('[StorageService] Get Reg By Session Failed:', e);
            // Fallback to local storage ONLY if network/backend fails significantly
            const local = getLocal<Registration>(LS_REGS_KEY).find(r => r.stripePaymentIntentId === sessionId || (r as any).stripeCheckoutSessionId === sessionId);
            if (local) return local;

            return null;
        }
    },

    getRegistrationsByEmail: async (email: string) => {
        console.log(`[StorageService] Fetching registrations for email: ${email}`);

        try {
            // Use backend filtering secure endpoint
            const { registrations } = await fetchSupabase(`/registrations?email=${encodeURIComponent(email)}`, true);

            const userRegs = (registrations || []).map((r: any) => normalizeRegistration(r));
            console.log(`[StorageService] Found ${userRegs.length} matches for ${email}`);

            const allEvents = await StorageService.getEvents();
            return userRegs.map((reg: Registration) => ({ reg, event: allEvents.find(e => e.id === reg.eventId)! })).filter((x: any) => x.event);
        } catch (e) {
            console.error('[StorageService] Fetch by email failed:', e);
            return [];
        }
    },

    saveRegistration: async (reg: Registration) => {
        try {
            // This is primarily used for manual registration creation by organizer or offline
            // Public registration goes through /orders/create usually?
            // If we use this, map fields:
            const payload = {
                id: reg.id,
                event_id: reg.eventId,
                attendee_name: reg.attendeeName,
                attendee_email: reg.attendeeEmail,
                payment_status: reg.paymentStatus,
                approval_status: reg.approvalStatus,
                tickets: reg.tickets, // Backend logic to handle json
                answers: reg.answers,
                promo_code_used: reg.promoCodeUsed
            };
            await postSupabase('/registrations', 'POST', payload);
            return { success: true };
        } catch (e: any) {
            console.error("Save registration failed:", e);
            throw new Error(`Failed to save registration: ${e.message}`);
        }
    },

    updateTicketHolder: async (regId: string, ticketIndex: number, name: string, email: string) => {
        try {
            await postSupabase(`/registrations/${regId}/transfer`, 'POST', { ticketIndex, name, email });
            return { success: true };
        } catch (e) {
            console.error("Transfer failed:", e);
            throw e;
        }
    },

    updateRegistration: async (id: string, updates: Partial<Registration>) => {
        if (isOffline) return;

        const payload: any = {};
        if (updates.paymentStatus) payload.payment_status = updates.paymentStatus;
        if (updates.approvalStatus) payload.approval_status = updates.approvalStatus;
        if (updates.tickets) payload.tickets = updates.tickets;
        if (updates.addOns) payload.add_ons = updates.addOns;

        await postSupabase(`/registrations/${id}`, 'PUT', payload);
        clearCache('regs'); // We need cache clearing
    },

    trackAffiliateClick: async (eventId: string, code: string) => {
        // Skip for now or implement backend endpoint
    },

    trackAffiliateConversion: async (eventId: string, code: string) => {
        // Skip for now
    },

    Payment: {
        addPaymentMethod: async (uid: string, m: any) => {
            // Map to update user
            const user = await StorageService.getUserById(uid);
            if (user) {
                const current = user.paymentMethods || [];
                // This should technically update a payment_methods table via backend
                // For now, update user profile JSON/array
                await StorageService.updateUser(uid, { paymentMethods: [...current, { id: `pm-${Date.now()}`, ...m }] });
            }
        },
        addInstantCard: async (uid: string, card: DebitCard) => {
            const user = await StorageService.getUserById(uid);
            if (user) {
                await StorageService.updateUser(uid, { payoutSettings: { ...user.payoutSettings, instantCard: card } });
            }
        },
        payOutstandingBalance: async (uid: string) => { await StorageService.updateUser(uid, { balanceDue: 0 }); return true; },
        requestPayout: async (uid: string, mode: string) => {
            try {
                const res = await postSupabase('/stripe/request-payout', 'POST', { mode });
                if (res.success) {
                    return { success: true, amount: res.amount, fee: res.fee, deducted: 0 };
                }
                return { success: false, amount: 0, fee: 0, deducted: 0 };
            } catch (e) {
                console.error("Payout Request Failed:", e);
                return { success: false, amount: 0, fee: 0, deducted: 0 };
            }
        }
    },

    logAIUsage: async (userId: string, type: 'text' | 'image', tokens: number) => {
        logAuditEvent('AI_GENERATION', `Generated ${type}`, 'system');
    },

    connectStripeAccount: async (userId: string, type: 'standard' | 'express') => {
        await new Promise(resolve => setTimeout(resolve, 1500));
        // Use 'mock_' prefix to signal backend to skip transfer_data
        const mockStripeId = `mock_acct_${Math.random().toString(36).substr(2, 8)}`;
        const updated = await StorageService.updateUser(userId, {
            stripeConnectId: mockStripeId,
            stripeOnboardingComplete: true
        });

        if (!updated) {
            throw new Error("Failed to save Stripe connection to user profile. Ensure database columns exist.");
        }

        return { success: true, stripeId: mockStripeId };
    },

    sendEventBroadcast: async (eventId: string, subject: string, message: string, templateId?: string) => {
        const event = await StorageService.getEventById(eventId);
        if (!event) throw new Error("Event not found");

        // We can just update the event broadcasts array for now
        // Ideally backend handles email sending
        const broadcast: Broadcast = { id: `br-${Date.now()}`, subject, message, sentAt: Date.now(), templateId };
        const updatedBroadcasts = [...(event.broadcasts || []), broadcast];

        await StorageService.saveEvent({ ...event, broadcasts: updatedBroadcasts });

        // Mock return
        return 10;
    },

    // --- Waitlist Methods ---
    joinWaitlist: async (eventId: string, name: string, email: string) => {
        // Implement via backend
        await postSupabase('/waitlist', 'POST', { event_id: eventId, name, email });
        return { success: true };
    },

    getWaitlist: async (eventId: string) => {
        try {
            // Assuming endpoint exists
            const { waitlist } = await fetchSupabase(`/waitlist/${eventId}`, true);
            return waitlist || [];
        } catch { return []; }
    },

    updateWaitlistEntry: async (id: string, status: 'promoted' | 'expired' | 'pending') => {
        await postSupabase(`/waitlist/${id}`, 'PUT', { status });
    },

    refundRegistration: async (id: string, updatedTickets: PurchasedTicket[], reason: string) => {
        if (isOffline) return;
        await postSupabase(`/registrations/${id}/refund`, 'POST', { tickets: updatedTickets, reason });
        clearCache('regs');
    },

    refundAddon: async (id: string, addonIndex: number, reason: string) => {
        if (isOffline) return;
        await postSupabase(`/registrations/${id}/refund-addon`, 'POST', { addonIndex, reason });
        clearCache('regs');
    },

    updateRegistrationTickets: async (regId: string, updatedTickets: any[], newStatus?: 'pending' | 'completed' | 'offline_pending' | 'refunded', refundReason?: string) => {
        const updates: any = { tickets: updatedTickets };
        if (newStatus) {
            updates.paymentStatus = newStatus;
            if (newStatus === 'refunded') updates.approvalStatus = 'rejected';
        }
        if (refundReason) updates.refundReason = refundReason;

        await StorageService.updateRegistration(regId, updates);
    }
};