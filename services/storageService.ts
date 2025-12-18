import { Event, Registration, User, PlanType, PaymentMethod, Invoice, ContactSubmission, DebitCard, SystemNotification, AuditLog, Broadcast } from '../types';
import { db, auth, googleProvider } from './firebaseConfig';
import { collection, doc, getDoc, getDocs, setDoc, updateDoc, deleteDoc, query, where, addDoc, limit, disableNetwork } from 'firebase/firestore';
// @ts-ignore
import { signInWithEmailAndPassword, createUserWithEmailAndPassword, signOut, signInWithPopup } from 'firebase/auth';

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
        return obj.map(v => sanitizeForFirestore(v, seen));
    }
    const newObj: any = {};
    for (const key in obj) {
        if (Object.prototype.hasOwnProperty.call(obj, key)) {
            const val = sanitizeForFirestore(obj[key], seen);
            if (val !== undefined) {
                newObj[key] = val;
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
    processSplitPayment: async (amount: number, fee: number, organizerConnectId: string) => {
        return { paymentIntentId: `pi_${Math.random().toString(36).substr(2, 20)}`, transferId: `tr_${Math.random().toString(36).substr(2, 20)}`, success: true };
    },
    processSubscriptionPayment: async (amount: number, userId: string, planName: string): Promise<boolean> => {
        const admin = await StorageService.getSuperAdmin();
        if (admin) {
             const newAdminBalance = (admin.availablePayout || 0) + amount;
             const adminInvoice: Invoice = { id: `inv-inc-${Date.now()}`, date: Date.now(), amount: amount, status: 'paid', description: `Subscription Income: ${planName} from ${userId}`, items: [{ desc: 'Subscription Fee', amount }], type: 'subscription' };
             await StorageService.updateUser(admin.id, { availablePayout: newAdminBalance, invoices: [...(admin.invoices || []), adminInvoice] });
        }
        logAuditEvent('STRIPE_SUBSCRIPTION', `Collected $${amount} for ${planName}`, 'system');
        return true;
    },
    refundSplitPayment: async (paymentIntentId: string) => true
};

export const StorageService = {
  isOfflineMode: () => isOffline,
  isDemoMode: () => isDemoMode,
  getLastError: () => initError,
  Stripe: StripeService,

  init: async () => {
    try {
        if (!db) throw new Error("Firebase DB not initialized.");
        const timeout = new Promise((_, reject) => setTimeout(() => reject(new Error("Connection Timeout")), 4000));
        const connectionPromise = (async () => {
            try {
                const q = query(collection(db, 'events'), limit(1));
                await getDocs(q);
                return true;
            } catch (err) { throw err; }
        })();
        await Promise.race([connectionPromise, timeout]);
        isOffline = false;
        console.log("Firebase Connected");
    } catch (e: any) {
        initError = e;
        isOffline = true;
        isDemoMode = (e.code === 'permission-denied' || e.message?.includes('permission-denied'));
        try { if (db) await disableNetwork(db); } catch {}
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
    try { await addDoc(collection(db, 'contacts'), { timestamp: Date.now(), ...sanitizeInput(data) }); return true; } catch { return false; }
  },

  calculateFees: (subtotal: number, planType: PlanType = 'free') => {
      if (subtotal <= 0) return 0;
      const plan = PLANS[planType];
      return (subtotal * plan.feePercent) + plan.feeFixed;
  },

  getUserById: async (id: string): Promise<User | undefined> => {
      if (isOffline) return getLocal<User>(LS_USERS_KEY).find(u => u.id === id);
      try { const docSnap = await getDoc(doc(db, 'users', id)); return docSnap.exists() ? docSnap.data() as User : undefined; } catch { return undefined; }
  },

  getSuperAdmin: async (): Promise<User | undefined> => {
      if (isOffline) return getLocal<User>(LS_USERS_KEY).find(u => u.isAdmin);
      try { const q = query(collection(db, 'users'), where('isAdmin', '==', true), limit(1)); const snap = await getDocs(q); return !snap.empty ? snap.docs[0].data() as User : undefined; } catch { return undefined; }
  },

  checkAffiliateCodeUnique: async (code: string) => {
    const cleanCode = code.trim().toUpperCase();
    if (isOffline) return !getLocal<User>(LS_USERS_KEY).some(u => u.affiliateCode === cleanCode);
    try { const q = query(collection(db, 'users'), where('affiliateCode', '==', cleanCode)); const snap = await getDocs(q); return snap.empty; } catch { return true; }
  },

  login: async (email: string, password: string): Promise<{ user: User | null, error?: string }> => {
    if (isOffline) {
        const user = getLocal<User>(LS_USERS_KEY).find(u => u.email === email && u.password === password);
        if (user) {
            if (user.isBanned) return { user: null, error: "Account Suspended." };
            localStorage.setItem(CURRENT_USER_KEY, safeStringify(user));
            return { user };
        }
        return { user: null, error: "Invalid credentials" };
    }
    try {
        if (!auth) return { user: null, error: "Auth not initialized." };
        const userCredential = await signInWithEmailAndPassword(auth, email, password);
        const userDoc = await getDoc(doc(db, 'users', userCredential.user.uid));
        if (userDoc.exists()) {
            const userData = userDoc.data() as User;
            if (userData.isBanned) return { user: null, error: "Account Suspended." };
            localStorage.setItem(CURRENT_USER_KEY, safeStringify(userData));
            return { user: userData };
        }
        return { user: null, error: "User profile not found." };
    } catch (e: any) { return { user: null, error: `Login Error: ${e.message || e.code}` }; }
  },

  loginWithGoogle: async (): Promise<{ user: User | null, error?: string }> => {
      if (isOffline || isDemoMode) return StorageService.login('demo@example.com', 'password');
      try {
          if (!auth) throw new Error("Auth not initialized");
          const result = await signInWithPopup(auth, googleProvider);
          const uid = result.user.uid;
          const userDoc = await getDoc(doc(db, 'users', uid));
          let userData: User;
          if (userDoc.exists()) {
              userData = userDoc.data() as User;
              if (userData.isBanned) return { user: null, error: "Account Suspended." };
          } else {
              userData = { id: uid, name: result.user.displayName || 'User', email: result.user.email || '', role: 'attendee', balanceDue: 0, availablePayout: 0, paymentMethods: [], invoices: [], subscription: { plan: 'free', cycle: 'monthly', status: 'active', nextBillingDate: Date.now() + 2592000000 }, logoUrl: result.user.photoURL || undefined };
              await setDoc(doc(db, 'users', uid), userData);
          }
          localStorage.setItem(CURRENT_USER_KEY, safeStringify(userData));
          return { user: userData };
      } catch (e: any) {
          if (e.code === 'auth/unauthorized-domain' || e.code === 'auth/configuration-not-found' || e.code === 'auth/operation-not-allowed') {
              console.warn(`[Auth Fallback] Domain restricted: ${e.code}. Using Guest Session.`);
              const mockUser: User = { id: `mock-${Date.now()}`, name: 'Guest Tester', email: 'guest@openticket.dev', role: 'attendee', balanceDue: 0, availablePayout: 0, paymentMethods: [], invoices: [], subscription: { plan: 'free', cycle: 'monthly', status: 'active', nextBillingDate: Date.now() + 2592000000 }, logoUrl: 'https://ui-avatars.com/api/?name=Guest+User' };
              const users = getLocal<User>(LS_USERS_KEY); users.push(mockUser); setLocal(LS_USERS_KEY, users);
              localStorage.setItem(CURRENT_USER_KEY, safeStringify(mockUser));
              return { user: mockUser };
          }
          return { user: null, error: e.message || "Google Login Failed" };
      }
  },

  signup: async (userData: Partial<User>) => {
    const cleanData = sanitizeInput(userData);
    if (isOffline) {
        const users = getLocal<User>(LS_USERS_KEY);
        if (users.some(u => u.email === cleanData.email)) return "Email exists";
        const newUser: User = { id: `u-${Date.now()}`, isAdmin: false, role: cleanData.role || 'attendee', balanceDue: 0, availablePayout: 0, paymentMethods: [], invoices: [], subscription: { plan: 'free', cycle: 'monthly', status: 'active', nextBillingDate: Date.now() + 2592000000 }, ...cleanData as User };
        users.push(newUser); setLocal(LS_USERS_KEY, users); localStorage.setItem(CURRENT_USER_KEY, safeStringify(newUser));
        return newUser;
    }
    try {
        const userCredential = await createUserWithEmailAndPassword(auth, cleanData.email, cleanData.password);
        const { password, ...safeData } = cleanData;
        const newUser: User = { id: userCredential.user.uid, isAdmin: false, role: safeData.role || 'attendee', balanceDue: 0, availablePayout: 0, paymentMethods: [], invoices: [], subscription: { plan: 'free', cycle: 'monthly', status: 'active', nextBillingDate: Date.now() + 2592000000 }, ...safeData as User };
        await setDoc(doc(db, 'users', newUser.id), newUser); localStorage.setItem(CURRENT_USER_KEY, safeStringify(newUser));
        return newUser;
    } catch (e: any) { return e.message || "Signup failed"; }
  },

  updateUser: async (userId: string, updates: Partial<User>) => {
    const currentUser = StorageService.getCurrentUser();
    if (!currentUser || (currentUser.id !== userId && !currentUser.isAdmin)) return null;
    const cleanUpdates = sanitizeForFirestore(sanitizeInput(updates));
    if (isOffline) {
        const users = getLocal<User>(LS_USERS_KEY);
        const idx = users.findIndex(u => u.id === userId);
        if (idx !== -1) { users[idx] = { ...users[idx], ...cleanUpdates }; setLocal(LS_USERS_KEY, users); if (currentUser.id === userId) localStorage.setItem(CURRENT_USER_KEY, safeStringify(users[idx])); return users[idx]; }
        return null;
    }
    try {
        await setDoc(doc(db, 'users', userId), cleanUpdates, { merge: true });
        const snap = await getDoc(doc(db, 'users', userId));
        if (snap.exists()) { const updated = snap.data() as User; if (currentUser.id === userId) localStorage.setItem(CURRENT_USER_KEY, safeStringify(updated)); return updated; }
        return null;
    } catch { return null; }
  },

  deleteEvent: async (id: string) => {
      const event = await StorageService.getEventById(id);
      if (!event || !(await verifyOrganizerAccess(event.ownerId))) return;
      clearCache('events');
      if (isOffline) setLocal(LS_EVENTS_KEY, getLocal<Event>(LS_EVENTS_KEY).filter(e => e.id !== id));
      else await deleteDoc(doc(db, 'events', id));
  },

  logout: async () => { if (!isOffline && auth) await signOut(auth); localStorage.removeItem(CURRENT_USER_KEY); },
  getCurrentUser: (): User | null => { try { const data = localStorage.getItem(CURRENT_USER_KEY); return data ? JSON.parse(data) : null; } catch { return null; } },

  getEvents: async (): Promise<Event[]> => {
    if (!isOffline && _eventsCache && Date.now() - _eventsCache.timestamp < CACHE_TTL) return _eventsCache.data;
    let events = isOffline ? getLocal<Event>(LS_EVENTS_KEY) : [];
    if (!isOffline) try { const snap = await getDocs(collection(db, 'events')); snap.forEach(doc => events.push(doc.data() as Event)); } catch { return []; }
    const regs = await StorageService.getRegistrations();
    const processed = events.map(e => ({ ...e, registeredCount: calculateRealRegisteredCount(e, regs) }));
    _eventsCache = { data: processed, timestamp: Date.now() }; return processed;
  },

  getEventById: async (id: string) => {
    const all = await StorageService.getEvents(); return all.find(e => e.id === id);
  },

  saveEvent: async (event: Event) => {
    const clean = sanitizeForFirestore(sanitizeInput(event)); clearCache('events');
    if (isOffline) { const list = getLocal<Event>(LS_EVENTS_KEY); const idx = list.findIndex(e => e.id === clean.id); if (idx >= 0) list[idx] = clean; else list.push(clean); setLocal(LS_EVENTS_KEY, list); }
    else await setDoc(doc(db, 'events', clean.id), clean);
  },

  getRegistrations: async (eventId?: string): Promise<Registration[]> => {
    if (isOffline) { const list = getLocal<Registration>(LS_REGS_KEY); return eventId ? list.filter(r => r.eventId === eventId) : list; }
    try { const q = eventId ? query(collection(db, 'registrations'), where('eventId', '==', eventId)) : collection(db, 'registrations'); const snap = await getDocs(q); const list: Registration[] = []; snap.forEach(doc => list.push(doc.data() as Registration)); return list; } catch { return []; }
  },

  getRegistrationsByEmail: async (email: string) => {
      const allRegs = await StorageService.getRegistrations();
      const userRegs = allRegs.filter(r => r.attendeeEmail === email);
      const allEvents = await StorageService.getEvents();
      return userRegs.map(reg => ({ reg, event: allEvents.find(e => e.id === reg.eventId)! })).filter(x => x.event);
  },

  saveRegistration: async (reg: Registration) => {
    const clean = sanitizeForFirestore(sanitizeInput(reg)); clearCache('all');
    if (isOffline) { const list = getLocal<Registration>(LS_REGS_KEY); list.push(clean); setLocal(LS_REGS_KEY, list); return { success: true }; }
    try { await setDoc(doc(db, 'registrations', clean.id), clean); return { success: true }; } catch { throw new Error("Save failed"); }
  },

  updateRegistration: async (id: string, updates: Partial<Registration>) => {
    const clean = sanitizeForFirestore(sanitizeInput(updates)); clearCache('regs');
    if (isOffline) { const list = getLocal<Registration>(LS_REGS_KEY); const idx = list.findIndex(r => r.id === id); if (idx >= 0) { list[idx] = { ...list[idx], ...clean }; setLocal(LS_REGS_KEY, list); } }
    else await setDoc(doc(db, 'registrations', id), clean, { merge: true });
  },

  trackAffiliateClick: async (eventId: string, code: string) => {
      const e = await StorageService.getEventById(eventId);
      if (e && e.affiliates) { const idx = e.affiliates.findIndex(a => a.code === code); if (idx !== -1) { e.affiliates[idx].clicks++; await StorageService.saveEvent(e); } }
  },

  trackAffiliateConversion: async (eventId: string, code: string) => {
      const e = await StorageService.getEventById(eventId);
      if (e && e.affiliates) { const idx = e.affiliates.findIndex(a => a.code === code); if (idx !== -1) { e.affiliates[idx].conversions++; await StorageService.saveEvent(e); } }
  },
  
  Payment: {
      addPaymentMethod: async (uid: string, m: any) => { const u = await StorageService.getUserById(uid); if (u) await StorageService.updateUser(uid, { paymentMethods: [...u.paymentMethods, { id: `pm-${Date.now()}`, ...m }] }); },
      // FIX: Added missing addInstantCard method for manual debit card entry
      addInstantCard: async (uid: string, card: DebitCard) => { const u = await StorageService.getUserById(uid); if (u) await StorageService.updateUser(uid, { payoutSettings: { ...u.payoutSettings, instantCard: card } }); },
      payOutstandingBalance: async (uid: string) => { await StorageService.updateUser(uid, { balanceDue: 0 }); return true; },
      requestPayout: async (uid: string, mode: string) => { const u = await StorageService.getUserById(uid); if (!u || u.availablePayout <= 0) return { success: false, amount: 0, fee: 0, deducted: 0 }; const bal = u.balanceDue || 0; const net = u.availablePayout - bal; if (net <= 0) { await StorageService.updateUser(uid, { availablePayout: 0, balanceDue: bal - u.availablePayout }); return { success: true, amount: 0, fee: 0, deducted: u.availablePayout }; } let amt = net; let fee = mode === 'instant' ? amt * 0.015 : 0; amt -= fee; await StorageService.updateUser(uid, { availablePayout: 0, balanceDue: 0 }); return { success: true, amount: amt, fee, deducted: bal }; }
  },

  // FIX: Added missing sendEventBroadcast method to support attendee notifications
  sendEventBroadcast: async (eventId: string, subject: string, message: string) => {
      const event = await StorageService.getEventById(eventId);
      if (!event) throw new Error("Event not found");
      
      const broadcast: Broadcast = {
          id: `br-${Date.now()}`,
          subject,
          message,
          sentAt: Date.now()
      };
      
      const updatedBroadcasts = [...(event.broadcasts || []), broadcast];
      await StorageService.saveEvent({ ...event, broadcasts: updatedBroadcasts });
      
      const registrations = await StorageService.getRegistrations(eventId);
      // In a real app, this would trigger an actual email service (SendGrid, SES, etc.)
      return registrations.length;
  }
};