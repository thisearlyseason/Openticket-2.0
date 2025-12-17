
// ... existing imports
import { Event, Registration, User, PlanType, PaymentMethod, Invoice, ContactSubmission, DebitCard, SystemNotification, AuditLog, Broadcast } from '../types';
import { db } from './firebaseConfig';
import { collection, doc, getDoc, getDocs, setDoc, updateDoc, deleteDoc, query, where, addDoc, limit, disableNetwork } from 'firebase/firestore';

// ... existing state variables (CURRENT_USER_KEY etc) ...
const CURRENT_USER_KEY = 'openticket_current_user';
const SYSTEM_NOTE_KEY = 'openticket_system_notification';

// Local Storage Keys for Fallback
const LS_EVENTS_KEY = 'openticket_events_data';
const LS_USERS_KEY = 'openticket_users_data';
const LS_REGS_KEY = 'openticket_registrations_data';
const LS_AUDIT_KEY = 'openticket_audit_logs';

// Internal State
let isOffline = true;
let isDemoMode = false;
let initError: Error | null = null;

// Caching State
let _eventsCache: { data: Event[], timestamp: number } | null = null;
let _regsCache: { data: Registration[], timestamp: number } | null = null;
const CACHE_TTL = 300000; // 5 Minutes

const clearCache = (type: 'events' | 'regs' | 'all' = 'all') => {
    if (type === 'events' || type === 'all') _eventsCache = null;
    if (type === 'regs' || type === 'all') _regsCache = null;
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

// ... existing helper functions (safeStringify, sanitizeInput, sanitizeForFirestore etc.) ...
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

const sanitizeForFirestore = (obj: any, seen = new WeakSet()): any => {
    if (obj === undefined) return null; 
    if (obj === null) return null;
    
    if (typeof obj !== 'object') return obj;
    
    if (obj instanceof Date) return obj.toISOString();

    if (seen.has(obj)) return null;
    seen.add(obj);

    if (Array.isArray(obj)) {
        return obj.map(v => {
            const sanitized = sanitizeForFirestore(v, seen);
            if (Array.isArray(sanitized)) {
                console.warn("Nested array detected during save. Stringifying to prevent Firestore error.", sanitized);
                return JSON.stringify(sanitized); 
            }
            return sanitized;
        });
    }
    
    const newObj: any = {};
    for (const key in obj) {
        if (Object.prototype.hasOwnProperty.call(obj, key)) {
            const val = sanitizeForFirestore(obj[key], seen);
            if (val !== undefined) {
                newObj[key] = val; // Already sanitized recursively
            }
        }
    }
    return newObj;
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
        // FILTER: Remove if Refunded or Rejected
        if (r.paymentStatus === 'refunded' || r.approvalStatus === 'rejected') {
            return;
        }

        if (!isRegistrationExpired(r, event)) {
            if (r.tickets && r.tickets.length > 0) {
                // Sum only tickets that are NOT refunded within the order
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
        ip: 'client-side' // Placeholder
    };
    const logs = getLocal<AuditLog>(LS_AUDIT_KEY);
    logs.push(log);
    setLocal(LS_AUDIT_KEY, logs);
    console.log(`[AUDIT] ${action}: ${details}`);
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
    const events = getLocal<Event>(LS_EVENTS_KEY);
    const now = Date.now();
    const day = 86400000;
    
    // 1. Create Default Events
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
        },
        {
            id: 'demo-evt-2',
            ownerId: 'user1',
            title: 'Tech Founders Meetup',
            subtitle: 'Networking for startups',
            description: '<p>Weekly meetup for local founders.</p>',
            date: new Date(now + day * 2).toISOString().split('T')[0],
            time: '19:00',
            location: 'Innovation Hub, Tech District',
            venueName: 'Innovation Hub',
            imageUrl: 'https://images.unsplash.com/photo-1515187029135-18ee286d815b?w=800&q=80',
            price: 0,
            priceType: 'free',
            capacity: 50,
            registeredCount: 42,
            createdAt: now,
            isDraft: false,
            visibility: 'public',
            organizer: 'Startup Grind',
            organizerEmail: 'meetup@startupgrind.com',
            paymentConfig: { method: 'none' },
            questions: [], gallery: [], reminders: [],
            eventType: 'in_person',
            category: 'business',
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

    // 2. Create Demo User
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
    
    // 3. Create Super Admin
    const adminUser: User = {
        id: 'super-admin',
        name: 'Super Admin',
        email: 'admin@openticket.com',
        password: 'admin',
        role: 'admin',
        isAdmin: true,
        balanceDue: 0,
        availablePayout: 0,
        paymentMethods: [],
        invoices: [],
        subscription: { plan: 'premium', cycle: 'yearly', status: 'active', nextBillingDate: now + day * 365 }
    };

    const existingUsers = getLocal<User>(LS_USERS_KEY);
    let updatedUsers = [...existingUsers];

    if (!updatedUsers.some(u => u.id === 'user1')) updatedUsers.push(dummyUser);
    if (!updatedUsers.some(u => u.email === 'admin@openticket.com')) updatedUsers.push(adminUser);

    setLocal(LS_USERS_KEY, updatedUsers);
};

const StripeService = {
    connectAccount: async (userId: string): Promise<string> => {
        return `acct_${Math.random().toString(36).substr(2, 14)}`;
    },

    processSplitPayment: async (
        amount: number, 
        fee: number, 
        organizerConnectId: string
    ): Promise<{ paymentIntentId: string, transferId: string, success: boolean }> => {
        console.log(`[Stripe Connect] Processing Split Payment.`);
        return {
            paymentIntentId: `pi_${Math.random().toString(36).substr(2, 20)}`,
            transferId: `tr_${Math.random().toString(36).substr(2, 20)}`,
            success: true
        };
    },

    processSubscriptionPayment: async (amount: number, userId: string, planName: string): Promise<boolean> => {
        const admin = await StorageService.getSuperAdmin();
        const platformAccountId = admin?.stripeConnectId || 'platform_default_account';

        console.log(`[Stripe Subscription] Processing SaaS Fee Charge.`);
        console.log(`> Payer (Organizer): ${userId}`);
        console.log(`> Plan: ${planName}`);
        console.log(`> Amount: $${amount}`);
        console.log(`> Destination: Super Admin Account (${platformAccountId})`);
        
        // 1. Collect Payment from Organizer (Simulated)
        // 2. Credit Super Admin Account
        if (admin) {
             const newAdminBalance = (admin.availablePayout || 0) + amount;
             const adminInvoice: Invoice = {
                 id: `inv-inc-${Date.now()}`,
                 date: Date.now(),
                 amount: amount,
                 status: 'paid',
                 description: `Subscription Income: ${planName} from ${userId}`,
                 items: [{ desc: 'Subscription Fee', amount }],
                 type: 'subscription'
             };
             
             await StorageService.updateUser(admin.id, {
                 availablePayout: newAdminBalance,
                 invoices: [...(admin.invoices || []), adminInvoice]
             });
        }
        
        // AFFILIATE COMMISSION LOGIC
        // If this user was referred, calculate 15% commission
        const user = await StorageService.getUserById(userId);
        if (user && (user as any).referredBy) {
            const referrerId = (user as any).referredBy; 
            const commission = amount * 0.15;
            console.log(`[Affiliate System] Paying 15% commission ($${commission}) to referrer: ${referrerId}`);
            
            // Update Referrer's Wallet
            const referrer = await StorageService.getUserById(referrerId);
            if (referrer) {
                await StorageService.updateUser(referrerId, {
                    availablePayout: (referrer.availablePayout || 0) + commission,
                    invoices: [...(referrer.invoices || []), {
                        id: `comm-${Date.now()}`,
                        date: Date.now(),
                        amount: commission,
                        status: 'paid',
                        description: `Affiliate Commission: ${user.name} - ${planName}`,
                        items: [{desc: '15% Commission', amount: commission}],
                        type: 'payout' // abusing type slightly for display
                    }]
                });
            }
        }
        
        logAuditEvent('STRIPE_SUBSCRIPTION', `Collected $${amount} from ${userId} for ${planName} -> ${platformAccountId}`, 'system');
        return true;
    },

    refundSplitPayment: async (paymentIntentId: string, refundApplicationFee: boolean = false) => {
        console.log(`[Stripe Connect] Refunding PaymentIntent: ${paymentIntentId}. Reverse Fee: ${refundApplicationFee}`);
        logAuditEvent('STRIPE_REFUND', `Refunded ${paymentIntentId}. Fees Retained: ${!refundApplicationFee}`, 'system');
        return true;
    }
};

export const StorageService = {
  // ... existing methods ...
  isOfflineMode: () => isOffline,
  isDemoMode: () => isDemoMode,
  getLastError: () => initError,
  Stripe: StripeService,

  init: async () => {
    try {
        if (!db) throw new Error("Firebase DB not initialized.");
        const timeout = new Promise((_, reject) => setTimeout(() => reject(new Error("Connection Timeout (4s)")), 4000));
        const connectionPromise = (async () => {
            try {
                const q = query(collection(db, 'events'), limit(1));
                await getDocs(q);
                return true;
            } catch (err) {
                throw err;
            }
        })();

        try {
            await Promise.race([connectionPromise, timeout]);
            console.log("Firebase Connected Successfully");
            isOffline = false;
        } catch (err) {
            connectionPromise.catch(() => {});
            throw err;
        }
    } catch (e: any) {
        initError = e;
        console.error("StorageService Init Error:", e);
        if (e.code === 'permission-denied' || e.message?.includes('permission-denied')) {
            console.warn("Firestore Permission Denied. Switching to Demo Mode.");
            initError = new Error("Firestore API Permission Denied.");
            isDemoMode = true;
        } else {
            console.warn("Firebase Unavailable (Offline Mode Active):", e.message);
        }
        isOffline = true;
        try {
            if (db) await disableNetwork(db);
        } catch (netErr) {}
        populateDummyData();
    }
  },

  setSystemNotification: (message: string, type: 'info' | 'warning' | 'success' = 'info') => {
      const currentUser = StorageService.getCurrentUser();
      if (!currentUser?.isAdmin) return; // RBAC
      const note: SystemNotification = { id: `note-${Date.now()}`, message, type, active: true, timestamp: Date.now() };
      localStorage.setItem(SYSTEM_NOTE_KEY, safeStringify(note));
  },

  getSystemNotification: (): SystemNotification | null => {
      const data = localStorage.getItem(SYSTEM_NOTE_KEY);
      if (!data) return null;
      try {
          const note = JSON.parse(data) as SystemNotification;
          return note.active ? note : null;
      } catch { return null; }
  },

  clearSystemNotification: () => {
      const currentUser = StorageService.getCurrentUser();
      if (!currentUser?.isAdmin) return;
      localStorage.removeItem(SYSTEM_NOTE_KEY);
  },

  saveContactMessage: async (data: Omit<ContactSubmission, 'id' | 'timestamp'>): Promise<boolean> => {
    const cleanData = sanitizeInput(data);
    if (isOffline) {
        console.log("Offline: Contact message logged", cleanData);
        return true;
    }
    try {
        await addDoc(collection(db, 'contacts'), { timestamp: Date.now(), ...cleanData });
        return true;
    } catch { return false; }
  },

  calculateFees: (subtotal: number, planType: PlanType = 'free'): number => {
      if (subtotal <= 0) return 0;
      const plan = PLANS[planType];
      return (subtotal * plan.feePercent) + plan.feeFixed;
  },

  getUserById: async (id: string): Promise<User | undefined> => {
      if (isOffline) {
          const users = getLocal<User>(LS_USERS_KEY);
          return users.find(u => u.id === id);
      }
      try {
        const docSnap = await getDoc(doc(db, 'users', id));
        return docSnap.exists() ? docSnap.data() as User : undefined;
      } catch { return undefined; }
  },

  getSuperAdmin: async (): Promise<User | undefined> => {
      if (isOffline) {
          const users = getLocal<User>(LS_USERS_KEY);
          return users.find(u => u.isAdmin);
      }
      try {
          const q = query(collection(db, 'users'), where('isAdmin', '==', true), limit(1));
          const snap = await getDocs(q);
          if (!snap.empty) return snap.docs[0].data() as User;
          return undefined;
      } catch { return undefined; }
  },

  checkAffiliateCodeUnique: async (code: string): Promise<boolean> => {
    const cleanCode = code.trim().toUpperCase();
    if (isOffline) {
        const users = getLocal<User>(LS_USERS_KEY);
        return !users.some(u => u.affiliateCode === cleanCode);
    }
    try {
        const q = query(collection(db, 'users'), where('affiliateCode', '==', cleanCode));
        const snap = await getDocs(q);
        return snap.empty;
    } catch { return true; } 
  },

  login: async (email: string, password: string): Promise<{ user: User | null, error?: string }> => {
    if (isOffline) {
        const users = getLocal<User>(LS_USERS_KEY);
        const user = users.find(u => u.email === email && u.password === password);
        if (user) {
            if (user.isBanned) return { user: null, error: "Account Suspended." };
            localStorage.setItem(CURRENT_USER_KEY, safeStringify(user));
            logAuditEvent('LOGIN', `User ${user.id} logged in (Offline)`, user.id);
            return { user };
        }
        return { user: null };
    }
    try {
        if (!db) return { user: null, error: "Database not initialized." };
        const q = query(collection(db, 'users'), where('email', '==', email));
        const querySnapshot = await getDocs(q);
        let foundUser: User | null = null;
        querySnapshot.forEach((doc) => {
            const userData = doc.data() as User;
            if (userData.password === password) foundUser = userData;
        });
        
        if (foundUser) {
            const user = foundUser as User;
            if (user.isBanned) return { user: null, error: "Account Suspended." };
            localStorage.setItem(CURRENT_USER_KEY, safeStringify(user));
            logAuditEvent('LOGIN', `User ${user.id} logged in`, user.id);
            return { user };
        } else {
             if (querySnapshot.empty) return { user: null, error: "User not found." };
             return { user: null, error: "Invalid password." };
        }
    } catch (e: any) { 
        return { user: null, error: `Login Error: ${e.message || e.code}` };
    }
  },

  signup: async (userData: Partial<User>): Promise<User | string> => {
    const sanitizedData = sanitizeInput(userData);
    let newUser: User = {
        id: `u-${Date.now()}`,
        isAdmin: false,
        role: sanitizedData.role || 'attendee',
        balanceDue: 0,
        availablePayout: 0,
        paymentMethods: [],
        invoices: [],
        subscription: { plan: 'free', cycle: 'monthly', status: 'active', nextBillingDate: Date.now() + 2592000000 },
        ...sanitizedData as User
    };

    newUser = sanitizeForFirestore(newUser);

    if (isOffline) {
        const users = getLocal<User>(LS_USERS_KEY);
        if (users.some(u => u.email === sanitizedData.email)) return "Email already exists";
        
        if ((userData as any).referredBy) {
             const referrer = users.find(u => u.id === (userData as any).referredBy);
        }

        users.push(newUser);
        setLocal(LS_USERS_KEY, users);
        localStorage.setItem(CURRENT_USER_KEY, safeStringify(newUser));
        logAuditEvent('SIGNUP', `User ${newUser.id} signed up (Offline)`, newUser.id);
        return newUser;
    }

    try {
        if (!db) return "Database not initialized properly.";
        const q = query(collection(db, 'users'), where('email', '==', sanitizedData.email));
        const querySnapshot = await getDocs(q);
        if (!querySnapshot.empty) return "Email already exists";

        await setDoc(doc(db, 'users', newUser.id), newUser);
        localStorage.setItem(CURRENT_USER_KEY, safeStringify(newUser));
        logAuditEvent('SIGNUP', `User ${newUser.id} signed up`, newUser.id);
        return newUser;
    } catch (e: any) { 
        if (e.code === 'permission-denied') return "Permission Denied: Firestore Rules block writing.";
        return `Database Error: ${e.message || e.code || e}`;
    }
  },

  updateUser: async (userId: string, updates: Partial<User>): Promise<User | null> => {
    const currentUser = StorageService.getCurrentUser();
    if (!currentUser || (currentUser.id !== userId && !currentUser.isAdmin)) {
        console.error("RBAC: Update User Denied");
        return null;
    }

    const cleanUpdates = sanitizeForFirestore(sanitizeInput(updates));

    if (isOffline) {
        const users = getLocal<User>(LS_USERS_KEY);
        const idx = users.findIndex(u => u.id === userId);
        if (idx !== -1) {
            users[idx] = { ...users[idx], ...cleanUpdates };
            setLocal(LS_USERS_KEY, users);
            if (currentUser.id === userId) {
                localStorage.setItem(CURRENT_USER_KEY, safeStringify(users[idx]));
            }
            logAuditEvent('UPDATE_USER', `Updated user ${userId}`, currentUser.id);
            return users[idx];
        }
        return null;
    }

    try {
        const userRef = doc(db, 'users', userId);
        await setDoc(userRef, cleanUpdates, { merge: true });
        const updatedSnap = await getDoc(userRef);
        if (updatedSnap.exists()) {
            const updatedUser = updatedSnap.data() as User;
            if (currentUser.id === userId) {
                localStorage.setItem(CURRENT_USER_KEY, safeStringify(updatedUser));
            }
            logAuditEvent('UPDATE_USER', `Updated user ${userId}`, currentUser.id);
            return updatedUser;
        }
        return null;
    } catch { return null; }
  },

  deleteEvent: async (eventId: string) => {
      const event = await StorageService.getEventById(eventId);
      if (!event) return;
      
      const hasAccess = await verifyOrganizerAccess(event.ownerId);
      if (!hasAccess) {
          alert("Unauthorized access. Action blocked.");
          return;
      }

      clearCache('events');
      if (isOffline) {
          const events = getLocal<Event>(LS_EVENTS_KEY);
          const filtered = events.filter(e => e.id !== eventId);
          setLocal(LS_EVENTS_KEY, filtered);
          logAuditEvent('DELETE_EVENT', `Deleted event ${eventId}`, StorageService.getCurrentUser()?.id, eventId);
          return;
      }
      try { 
          await deleteDoc(doc(db, 'events', eventId)); 
          logAuditEvent('DELETE_EVENT', `Deleted event ${eventId}`, StorageService.getCurrentUser()?.id, eventId);
      } catch (e) { console.error(e); }
  },

  deleteRegistration: async (id: string) => {
      const reg = (await StorageService.getRegistrations()).find(r => r.id === id);
      if (!reg) return;
      const event = await StorageService.getEventById(reg.eventId);
      if (event) {
          const hasAccess = await verifyOrganizerAccess(event.ownerId);
          if (!hasAccess) {
              alert("Unauthorized access. Action blocked.");
              return;
          }
      }

      clearCache('all');
      if (isOffline) {
          const regs = getLocal<Registration>(LS_REGS_KEY);
          const filtered = regs.filter(r => r.id !== id);
          setLocal(LS_REGS_KEY, filtered);
          logAuditEvent('DELETE_REG', `Deleted reg ${id}`, StorageService.getCurrentUser()?.id, id);
          return;
      }
      try { 
          await deleteDoc(doc(db, 'registrations', id)); 
          logAuditEvent('DELETE_REG', `Deleted reg ${id}`, StorageService.getCurrentUser()?.id, id);
      } catch (e) { console.error(e); }
  },

  logout: () => localStorage.removeItem(CURRENT_USER_KEY),

  getCurrentUser: (): User | null => {
    try {
        const data = localStorage.getItem(CURRENT_USER_KEY);
        return data ? JSON.parse(data) : null;
    } catch { return null; }
  },

  getEvents: async (): Promise<Event[]> => {
    if (!isOffline && _eventsCache && Date.now() - _eventsCache.timestamp < CACHE_TTL) {
        return _eventsCache.data;
    }

    let events: Event[] = [];
    if (isOffline) {
        events = getLocal<Event>(LS_EVENTS_KEY);
    } else {
        try {
            const querySnapshot = await getDocs(collection(db, 'events'));
            querySnapshot.forEach((doc) => events.push(doc.data() as Event));
        } catch { return []; }
    }
    
    const regs = await StorageService.getRegistrations();
    const processedEvents = events.map(e => ({ ...e, registeredCount: calculateRealRegisteredCount(e, regs) }));
    
    _eventsCache = { data: processedEvents, timestamp: Date.now() };
    return processedEvents;
  },

  getEventById: async (id: string): Promise<Event | undefined> => {
    if (!isOffline && _eventsCache && Date.now() - _eventsCache.timestamp < CACHE_TTL) {
        const cachedEvent = _eventsCache.data.find(e => e.id === id);
        if (cachedEvent) return cachedEvent;
    }

    let event: Event | undefined;
    if (isOffline) {
        const events = getLocal<Event>(LS_EVENTS_KEY);
        event = events.find(e => e.id === id);
    } else {
        try {
            const docSnap = await getDoc(doc(db, 'events', id));
            if (docSnap.exists()) event = docSnap.data() as Event;
        } catch { return undefined; }
    }

    if (event) {
        const regs = await StorageService.getRegistrations(id);
        return { ...event, registeredCount: calculateRealRegisteredCount(event, regs) };
    }
    return undefined;
  },

  saveEvent: async (event: Event): Promise<void> => {
    const currentUser = StorageService.getCurrentUser();
    if (!currentUser) throw new Error("Must be logged in.");
    if (event.ownerId && event.ownerId !== currentUser.id && !currentUser.isAdmin) throw new Error("Unauthorized to edit this event.");

    const cleanEvent = sanitizeForFirestore(sanitizeInput(event));
    clearCache('events');

    if (isOffline) {
        const events = getLocal<Event>(LS_EVENTS_KEY);
        const idx = events.findIndex(e => e.id === cleanEvent.id);
        if (idx >= 0) events[idx] = cleanEvent; else events.push(cleanEvent);
        setLocal(LS_EVENTS_KEY, events);
        logAuditEvent('SAVE_EVENT', `Saved event ${cleanEvent.id}`, currentUser.id, cleanEvent.id);
        return;
    }
    try { 
        await setDoc(doc(db, 'events', cleanEvent.id), cleanEvent); 
        logAuditEvent('SAVE_EVENT', `Saved event ${cleanEvent.id}`, currentUser.id, cleanEvent.id);
    } catch (e: any) { 
        console.error("Save Event Error:", e);
        throw new Error(e.message || "Database Error"); 
    }
  },

  // ... sendEventBroadcast, getRegistrations, getRegistrationsByEmail, saveRegistration, updateRegistration, trackAffiliateClick, trackAffiliateConversion, Payment ...
  sendEventBroadcast: async (eventId: string, subject: string, message: string): Promise<number> => {
      // 1. Get Event and User
      const event = await StorageService.getEventById(eventId);
      if (!event) throw new Error("Event not found");
      const hasAccess = await verifyOrganizerAccess(event.ownerId);
      if (!hasAccess) throw new Error("Unauthorized");

      // 2. Get Attendees (Only non-refunded/active)
      const allRegs = await StorageService.getRegistrations(eventId);
      const activeRegs = allRegs.filter(r => 
          r.paymentStatus !== 'refunded' && 
          r.paymentStatus !== 'offline_pending' && 
          r.approvalStatus !== 'rejected'
      );
      
      const recipientCount = activeRegs.length;
      if (recipientCount === 0) return 0;

      // 3. Create Broadcast Object
      const broadcast: Broadcast = {
          id: `br-${Date.now()}`,
          subject,
          message,
          sentAt: Date.now()
      };

      // 4. Save to Event
      const updatedBroadcasts = [...(event.broadcasts || []), broadcast];
      
      // Update locally first for speed
      event.broadcasts = updatedBroadcasts;
      await StorageService.saveEvent(event);

      // 5. Log
      logAuditEvent('SEND_BROADCAST', `Sent "${subject}" to ${recipientCount} attendees`, event.ownerId, eventId);
      
      return recipientCount;
  },

  getRegistrations: async (eventId?: string): Promise<Registration[]> => {
    if (eventId && !isOffline && _regsCache && Date.now() - _regsCache.timestamp < CACHE_TTL) {
        return _regsCache.data.filter(r => r.eventId === eventId);
    }
    if (!eventId && !isOffline && _regsCache && Date.now() - _regsCache.timestamp < CACHE_TTL) {
        return _regsCache.data;
    }

    if (isOffline) {
        const regs = getLocal<Registration>(LS_REGS_KEY);
        return eventId ? regs.filter(r => r.eventId === eventId) : regs;
    }
    try {
        let q = eventId ? query(collection(db, 'registrations'), where('eventId', '==', eventId)) : collection(db, 'registrations');
        const querySnapshot = await getDocs(q);
        const regs: Registration[] = [];
        querySnapshot.forEach((doc) => regs.push(doc.data() as Registration));
        
        if (!eventId) {
            _regsCache = { data: regs, timestamp: Date.now() };
        }
        return regs;
    } catch { return []; }
  },

  getRegistrationsByEmail: async (email: string): Promise<{ reg: Registration, event: Event }[]> => {
      let userRegs: Registration[] = [];
      if (isOffline) {
          const allRegs = getLocal<Registration>(LS_REGS_KEY);
          userRegs = allRegs.filter(r => r.attendeeEmail === email);
      } else {
          try {
              const q = query(collection(db, 'registrations'), where('attendeeEmail', '==', email));
              const snap = await getDocs(q);
              snap.forEach(doc => userRegs.push(doc.data() as Registration));
          } catch (e) { return []; }
      }

      const results: { reg: Registration, event: Event }[] = [];
      const allEvents = await StorageService.getEvents(); 
      for (const reg of userRegs) {
          const event = allEvents.find(e => e.id === reg.eventId);
          if (event) results.push({ reg, event });
      }
      return results;
  },

  saveRegistration: async (registration: Registration): Promise<{ success: boolean, newAccount?: { email: string, password: string } }> => {
    const cleanReg = sanitizeForFirestore(sanitizeInput(registration));
    clearCache('all');

    if (cleanReg.paymentStatus === 'completed' || cleanReg.source === 'manual') {
        const event = await StorageService.getEventById(cleanReg.eventId);
        if (event) {
             const isAuthorized = await verifyOrganizerAccess(event.ownerId);
             if (!isAuthorized) throw new Error("Unauthorized: Only organizers can create manual/confirmed registrations.");
             logAuditEvent('MANUAL_ENTRY', `Manual registration created for Event ${cleanReg.eventId}`, StorageService.getCurrentUser()?.id, cleanReg.id);
        }
    }

    const processRegistration = async () => {
        const event = await StorageService.getEventById(cleanReg.eventId);
        if (event) {
            const owner = await StorageService.getUserById(event.ownerId);
            if (owner) {
                const ticketTotal = cleanReg.tickets?.reduce((sum: number, t: any) => sum + (t.status === 'refunded' ? 0 : (t.pricePerTicket * t.quantity)), 0) || 0;
                
                if (ticketTotal > 0 && cleanReg.paymentStatus === 'completed' && cleanReg.source !== 'manual') {
                    const plan = owner.subscription?.plan || 'free';
                    const feeAmount = StorageService.calculateFees(ticketTotal, plan);
                    
                    if (event.paymentConfig.method === 'online') {
                        // CREDIT SUPER ADMIN WITH FEES
                        const admin = await StorageService.getSuperAdmin();
                        if (admin) {
                            await StorageService.updateUser(admin.id, {
                                availablePayout: (admin.availablePayout || 0) + feeAmount,
                                invoices: [...(admin.invoices || []), {
                                    id: `inv-fee-${Date.now()}`,
                                    date: Date.now(),
                                    amount: feeAmount,
                                    status: 'paid',
                                    description: `Platform Fee: Order ${cleanReg.id}`,
                                    items: [{ desc: 'Processing Fee', amount: feeAmount }],
                                    type: 'fee'
                                }]
                            });
                        }

                        if (owner.stripeConnectId) {
                            const netRevenue = ticketTotal - feeAmount;
                            const splitResult = await StripeService.processSplitPayment(ticketTotal, feeAmount, owner.stripeConnectId);
                            
                            if (splitResult.success) {
                                cleanReg.stripePaymentIntentId = splitResult.paymentIntentId;
                                cleanReg.stripeTransferId = splitResult.transferId;
                                cleanReg.stripeFee = feeAmount;

                                const splitInvoice: Invoice = {
                                    id: `inv-${Date.now()}`,
                                    date: Date.now(),
                                    amount: netRevenue, 
                                    status: 'paid',
                                    description: `Ticket Sale (Stripe Split) - ${cleanReg.attendeeName}`,
                                    items: [
                                        { desc: 'Gross Ticket Sales', amount: ticketTotal },
                                        { desc: 'Platform Fee (Split to Admin)', amount: -feeAmount }
                                    ],
                                    type: 'stripe_split'
                                };
                                await StorageService.updateUser(owner.id, { 
                                    invoices: [...(owner.invoices || []), splitInvoice] 
                                });
                                
                                logAuditEvent('STRIPE_ROUTING', `Routed $${netRevenue.toFixed(2)} to ${owner.id} | Fee $${feeAmount.toFixed(2)} to Platform`, 'system', cleanReg.id);
                            }
                        } else {
                            const netEarnings = event.absorbFees ? ticketTotal - feeAmount : ticketTotal;
                            await StorageService.updateUser(owner.id, { availablePayout: (owner.availablePayout || 0) + netEarnings });
                        }
                    } else if (event.paymentConfig.method === 'offline' || event.paymentConfig.method === 'none') {
                        // For offline payments, just track what is owed
                        await StorageService.updateUser(owner.id, { balanceDue: (owner.balanceDue || 0) + feeAmount });
                    }
                }
            }
        }

        let newAccount = undefined;
        let userExists = false;
        if (cleanReg.attendeeEmail) {
            if (isOffline) {
                userExists = getLocal<User>(LS_USERS_KEY).some(u => u.email === cleanReg.attendeeEmail.trim());
            } else {
                const q = query(collection(db, 'users'), where('email', '==', cleanReg.attendeeEmail.trim()));
                const snap = await getDocs(q);
                userExists = !snap.empty;
            }

            if (!userExists) {
                const tempPassword = Math.random().toString(36).slice(-8);
                const newUser: User = {
                    id: `u-${Date.now()}`, name: cleanReg.attendeeName, email: cleanReg.attendeeEmail, password: tempPassword, role: 'attendee', isAdmin: false,
                    balanceDue: 0, availablePayout: 0, paymentMethods: [], invoices: [],
                    subscription: { plan: 'free', cycle: 'monthly', status: 'active', nextBillingDate: Date.now() + 2592000000 }
                };
                if (isOffline) {
                    const users = getLocal<User>(LS_USERS_KEY);
                    users.push(newUser);
                    setLocal(LS_USERS_KEY, users);
                } else {
                    await setDoc(doc(db, 'users', newUser.id), newUser);
                }
                newAccount = { email: newUser.email, password: tempPassword };
            }
        }
        return { success: true, newAccount };
    };

    if (isOffline) {
        const regs = getLocal<Registration>(LS_REGS_KEY);
        const idx = regs.findIndex(r => r.id === cleanReg.id);
        if (idx >= 0) regs[idx] = cleanReg; else regs.push(cleanReg);
        setLocal(LS_REGS_KEY, regs);
        logAuditEvent('SAVE_REG', `Created registration ${cleanReg.id}`, 'system', cleanReg.id);
        return await processRegistration();
    }

    try {
        await setDoc(doc(db, 'registrations', cleanReg.id), cleanReg);
        logAuditEvent('SAVE_REG', `Created registration ${cleanReg.id}`, 'system', cleanReg.id);
        return await processRegistration();
    } catch { throw new Error("Save failed"); }
  },

  updateRegistration: async (id: string, updates: Partial<Registration>): Promise<void> => {
    const currentUser = StorageService.getCurrentUser();
    const existingReg = (await StorageService.getRegistrations()).find(r => r.id === id);
    if (!existingReg) throw new Error("Registration not found.");

    const event = await StorageService.getEventById(existingReg.eventId);
    if (!event) throw new Error("Associated event not found.");

    const isAuthorized = await verifyOrganizerAccess(event.ownerId); 
    if (!isAuthorized) {
        if (!currentUser?.isAdmin) throw new Error("Unauthorized: Insufficient permissions to update registration.");
    }

    if (existingReg.paymentStatus === 'completed' && updates.paymentStatus && updates.paymentStatus !== 'completed' && updates.paymentStatus !== 'refunded') {
        console.warn(`Security Block: Attempt to revert completed payment for Reg ${id}`);
        throw new Error("Cannot revert a completed payment. Use refund instead.");
    }

    if (updates.paymentStatus && updates.paymentStatus !== existingReg.paymentStatus) {
        if (updates.paymentStatus === 'completed') {
            logAuditEvent('PAYMENT_CONFIRMED', `Manual/Offline Payment confirmed for Reg ${id}`, currentUser?.id, id);
        } else if (updates.paymentStatus === 'refunded') {
            logAuditEvent('REFUND_PROCESSED', `Refund recorded for Reg ${id}`, currentUser?.id, id);
            
            if (existingReg.stripePaymentIntentId) {
                await StripeService.refundSplitPayment(existingReg.stripePaymentIntentId, false);
                
                const owner = await StorageService.getUserById(event.ownerId);
                if (owner) {
                    const refundInvoice: Invoice = {
                        id: `inv-ref-${Date.now()}`,
                        date: Date.now(),
                        amount: -(updates.refundedAmount || existingReg.refundedAmount || 0),
                        status: 'paid',
                        description: `REFUND: ${existingReg.attendeeName}`,
                        items: [{ desc: 'Stripe Refund Processed (Fees Retained)', amount: -(updates.refundedAmount || existingReg.refundedAmount || 0) }],
                        type: 'stripe_split'
                    };
                    await StorageService.updateUser(owner.id, { invoices: [...(owner.invoices || []), refundInvoice] });
                }
            }
        }
    }

    const cleanUpdates = sanitizeForFirestore(sanitizeInput(updates));
    clearCache('regs');

    if (isOffline) {
        const regs = getLocal<Registration>(LS_REGS_KEY);
        const idx = regs.findIndex(r => r.id === id);
        if (idx >= 0) {
            regs[idx] = { ...regs[idx], ...cleanUpdates };
            setLocal(LS_REGS_KEY, regs);
            logAuditEvent('UPDATE_REG', `Updated reg ${id}`, currentUser?.id, id);
        }
        return;
    }
    try { 
        await setDoc(doc(db, 'registrations', id), cleanUpdates, { merge: true }); 
        logAuditEvent('UPDATE_REG', `Updated reg ${id}`, currentUser?.id, id);
    } catch (e) { console.error(e); }
  },

  trackAffiliateClick: async (eventId: string, code: string) => {
      const event = await StorageService.getEventById(eventId);
      if (!event || !event.affiliates) return;

      const idx = event.affiliates.findIndex(a => a.code === code);
      if (idx !== -1) {
          const affiliates = [...event.affiliates];
          affiliates[idx] = { ...affiliates[idx], clicks: (affiliates[idx].clicks || 0) + 1 };
          
          if (isOffline) {
              const events = getLocal<Event>(LS_EVENTS_KEY);
              const eIdx = events.findIndex(e => e.id === eventId);
              if (eIdx !== -1) {
                  events[eIdx].affiliates = affiliates;
                  setLocal(LS_EVENTS_KEY, events);
              }
          } else {
              try {
                  await updateDoc(doc(db, 'events', eventId), { affiliates });
              } catch (e) { console.error("Track click error", e); }
          }
      }
  },

  trackAffiliateConversion: async (eventId: string, code: string) => {
      const event = await StorageService.getEventById(eventId);
      if (!event || !event.affiliates) return;

      const idx = event.affiliates.findIndex(a => a.code === code);
      if (idx !== -1) {
          const affiliates = [...event.affiliates];
          affiliates[idx] = { ...affiliates[idx], conversions: (affiliates[idx].conversions || 0) + 1 };
          
          if (isOffline) {
              const events = getLocal<Event>(LS_EVENTS_KEY);
              const eIdx = events.findIndex(e => e.id === eventId);
              if (eIdx !== -1) {
                  events[eIdx].affiliates = affiliates;
                  setLocal(LS_EVENTS_KEY, events);
              }
          } else {
              try {
                  await updateDoc(doc(db, 'events', eventId), { affiliates });
              } catch (e) { console.error("Track conversion error", e); }
          }
      }
  },
  
  Payment: {
      addPaymentMethod: async (userId: string, method: Omit<PaymentMethod, 'id'>) => {
          if (method.type !== 'stripe') {
              throw new Error("Only Stripe Connect is supported for payouts.");
          }

          const user = await StorageService.getUserById(userId);
          if (!user) return;
          const newMethod: PaymentMethod = { id: `pm-${Date.now()}`, ...method };
          if (user.paymentMethods.length === 0) newMethod.isDefault = true;
          await StorageService.updateUser(userId, { paymentMethods: [...user.paymentMethods, newMethod] });
      },

      removePaymentMethod: async (userId: string, methodId: string) => {
          const user = await StorageService.getUserById(userId);
          if (!user) return;
          await StorageService.updateUser(userId, { paymentMethods: user.paymentMethods.filter(m => m.id !== methodId) });
      },

      addInstantCard: async (userId: string, card: Omit<DebitCard, 'id'>) => {
        const user = await StorageService.getUserById(userId);
        if (!user) return;
        const newCard: DebitCard = { id: `card-${Date.now()}`, ...card };
        await StorageService.updateUser(userId, { payoutSettings: { ...user.payoutSettings, instantCard: newCard } });
      },

      payOutstandingBalance: async (userId: string): Promise<boolean> => {
          const user = await StorageService.getUserById(userId);
          if (!user || user.balanceDue <= 0) return false;
          await StorageService.updateUser(userId, { balanceDue: 0 });
          return true;
      },
      
      requestPayout: async (userId: string, mode: 'standard' | 'instant'): Promise<{ success: boolean, amount: number, fee: number, deducted: number }> => {
          const user = await StorageService.getUserById(userId);
          if (!user || user.availablePayout <= 0) return { success: false, amount: 0, fee: 0, deducted: 0 };
          
          const balanceDue = user.balanceDue || 0;
          const netPayoutBase = user.availablePayout - balanceDue;

          if (netPayoutBase <= 0) {
              const newBalance = balanceDue - user.availablePayout;
              await StorageService.updateUser(userId, {
                  availablePayout: 0,
                  balanceDue: newBalance,
                  invoices: [...(user.invoices || []), {
                      id: `inv-${Date.now()}`, date: Date.now(), amount: 0, status: 'paid',
                      description: 'Payout offset against balance due',
                      items: [{ desc: 'Available Payout used for Balance', amount: user.availablePayout }],
                      type: 'fee'
                  }]
              });
              return { success: true, amount: 0, fee: 0, deducted: user.availablePayout };
          }

          let amount = netPayoutBase;
          let fee = 0;
          if (mode === 'instant') { fee = amount * 0.015; amount = amount - fee; }

          const newInvoice: Invoice = {
              id: `inv-${Date.now()}`, date: Date.now(), amount: user.availablePayout, status: 'payout',
              description: mode === 'instant' ? 'Instant Payout to Debit Card' : 'Standard Bank Transfer',
              items: [
                  { desc: 'Gross Payout', amount: user.availablePayout },
                  { desc: 'Less: Outstanding Balance', amount: -balanceDue },
                  ...(fee > 0 ? [{ desc: 'Instant Payout Fee', amount: -fee }] : [])
              ],
              type: 'payout'
          };
          
          await StorageService.updateUser(userId, { 
              availablePayout: 0, 
              balanceDue: 0, 
              invoices: [...(user.invoices || []), newInvoice] 
          });
          
          logAuditEvent('PAYOUT', `User ${userId} requested ${mode} payout: $${amount}`, userId);
          return { success: true, amount, fee, deducted: balanceDue };
      }
  }
};
