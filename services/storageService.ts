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
// Backend Configuration
// Use relative path for Vercel deployment (rewrites handle /api -> backend)
// For local dev, Vite proxy can handle this, or we fallback.
const SUPABASE_API_BASE = import.meta.env.VITE_API_URL || '/api';

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
    processSubscriptionPayment: async (amount: number, userId: string, planName: string): Promise<boolean> => {
        // Mock
        logAuditEvent('STRIPE_SUBSCRIPTION', `Collected $${amount} for ${planName}`, 'system');
        return true;
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

export const StorageService = {
    isOfflineMode: () => isOffline,
    isDemoMode: () => isDemoMode,
    getLastError: () => initError,
    Stripe: StripeService,

    init: async () => {
        // Minimal init for Auth
        try {
            await new Promise(r => setTimeout(r, 100)); // Tick
            if (!auth) throw new Error("Firebase Auth not initialized");
            console.log("StorageService Initialized (Supabase Backend Mode)");
        } catch (e: any) {
            initError = e;
            isOffline = true;
            populateDummyData();
        }
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
        if (subtotal <= 0) return 0;
        const plan = PLANS[planType];
        return (subtotal * plan.feePercent) + plan.feeFixed;
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
                    teamMembers: profile.team_members
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

    getSuperAdmin: async (): Promise<User | undefined> => {
        // In real SQL, accessing superadmin might be restricted or we look for a specific role
        // For now, return undefined to disable admin-specific logic on client if not auth'd
        return undefined;
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
            } catch (err) {
                // If checking user fails (network error), ABORT. Do not overwrite.
                return { user: null, error: "Login failed: Unable to verify account status. Please check connection." };
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

        // Settings Overrides
        if (updates.defaultTaxRate !== undefined) payload.default_tax_rate = updates.defaultTaxRate;
        if (updates.defaultCustomFees !== undefined) payload.default_custom_fees = updates.defaultCustomFees;
        if (updates.geminiApiKey !== undefined) payload.gemini_api_key = updates.geminiApiKey;

        // Payment methods usually handled separately, but if passed:
        if (updates.paymentMethods) payload.payment_methods = updates.paymentMethods; // API handles this?

        try {
            // Use dedicated Update endpoint for robustness
            await postSupabase(`/auth/profiles/${userId}`, 'PUT', payload);

            // Update local storage
            const updated = await StorageService.getUserById(userId);
            if (updated) localStorage.setItem(CURRENT_USER_KEY, safeStringify(updated));
            return updated;
            if (updated) localStorage.setItem(CURRENT_USER_KEY, safeStringify(updated));
            return updated;
        } catch (e) {
            console.error("StorageService.updateUser failed:", e);
            return null;
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
            return events || [];
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

    getEventById: async (id: string): Promise<Event | undefined> => {
        if (isOffline) return getLocal<Event>(LS_EVENTS_KEY).find(e => e.id === id);

        try {
            // First try public endpoint if not authenticated or just general view
            // But we actually have a dedicated GET /events/:id endpoint in eventRoutes.js
            const { event } = await fetchSupabase(`/events/${id}`, false); // false = optional auth usually? or try true if logged in.
            // Backend returns snake_case usually unless controller normalizes.
            // Let's normalize here to be safe.
            return normalizeEvent(event);
        } catch (e) {
            console.warn("Get Event By ID failed", e);
            return undefined;
        }
    },
} catch { return undefined; }
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
            const endpoint = eventId ? `/registrations/event/${eventId}` : `/registrations`; // Backend needs this route
            const { registrations } = await fetchSupabase(endpoint, true);
            return registrations || [];
        } catch { return []; }
    },

        getRegistrationsByEmail: async (email: string) => {
            // Client-side filtering for now
            const allRegs = await StorageService.getRegistrations();
            const userRegs = allRegs.filter(r => r.attendeeEmail && r.attendeeEmail.toLowerCase() === email.toLowerCase());
            const allEvents = await StorageService.getEvents();
            return userRegs.map(reg => ({ reg, event: allEvents.find(e => e.id === reg.eventId)! })).filter(x => x.event);
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
                } catch { throw new Error("Save failed"); }
            },

                updateTicketHolder: async (regId: string, ticketIndex: number, name: string, email: string) => {
                    const allRegs = await StorageService.getRegistrations();
                    const reg = allRegs.find(r => r.id === regId);
                    if (!reg) throw new Error("Registration not found");

                    if (!reg.tickets || !reg.tickets[ticketIndex]) throw new Error("Ticket not found");

                    reg.tickets[ticketIndex].attendeeName = name;
                    reg.tickets[ticketIndex].attendeeEmail = email;

                    await StorageService.updateRegistration(regId, { tickets: reg.tickets });
                    return { success: true };
                },

                    updateRegistration: async (id: string, updates: Partial<Registration>) => {
                        if (isOffline) return;

                        const payload: any = {};
                        if (updates.paymentStatus) payload.payment_status = updates.paymentStatus;
                        if (updates.approvalStatus) payload.approval_status = updates.approvalStatus;
                        if (updates.tickets) payload.tickets = updates.tickets;

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
                    const u = await StorageService.getUserById(uid);
                    if (!u || u.availablePayout <= 0) return { success: false, amount: 0, fee: 0, deducted: 0 };
                    const bal = u.balanceDue || 0;
                    const net = u.availablePayout - bal;
                    if (net <= 0) {
                        await StorageService.updateUser(uid, { availablePayout: 0, balanceDue: bal - u.availablePayout });
                        return { success: true, amount: 0, fee: 0, deducted: u.availablePayout };
                    }
                    let amt = net;
                    let fee = mode === 'instant' ? amt * 0.015 : 0;
                    amt -= fee;
                    await StorageService.updateUser(uid, { availablePayout: 0, balanceDue: 0 });
                    return { success: true, amount: amt, fee, deducted: bal };
                }
},

logAIUsage: async (userId: string, type: 'text' | 'image', tokens: number) => {
    logAuditEvent('AI_GENERATION', `Generated ${type}`, 'system');
},

    connectStripeAccount: async (userId: string, type: 'standard' | 'express') => {
        await new Promise(resolve => setTimeout(resolve, 1500));
        const mockStripeId = `acct_1M${Math.random().toString(36).substr(2, 8)}`;
        await StorageService.updateUser(userId, {
            stripeConnectId: mockStripeId,
            stripeOnboardingComplete: true
        });
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

                        refundRegistration: async (regId: string, ticketKeys: string[], refundReason: string) => {
                            // This needs a backend endpoint to be robust
                            // For now, assume backend exposes /registrations/:id/refund
                            await postSupabase(`/registrations/${regId}/refund`, 'POST', { ticket_keys: ticketKeys, reason: refundReason });
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