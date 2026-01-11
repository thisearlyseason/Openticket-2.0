
export type PlanType = 'free' | 'pro' | 'premium';

export interface Socials {
  website?: string;
  instagram?: string;
  facebook?: string;
  tiktok?: string;
  youtube?: string;
  x?: string;
}

export interface BankInfo {
  eTransferEmail?: string;
  connectedBankName?: string;
  connectedBankId?: string;
}

export interface DebitCard {
  id?: string;
  last4: string;
  brand: string;
  expMonth: number;
  expYear: number;
}

export interface PayoutSettings {
  instantCard?: DebitCard;
}

// STRIPE_ONLY_PAYOUTS: Enforce Stripe only
export interface PaymentMethod {
  id: string;
  type: 'stripe';
  label: string;
  isDefault: boolean;
  token?: string;
  connectedAccountId?: string;
}

export interface Invoice {
  id: string;
  date: number;
  amount: number;
  status: 'paid' | 'pending' | 'payout';
  description: string;
  items: { desc: string; amount: number }[];
  type: 'fee' | 'payout' | 'subscription' | 'stripe_split';
}

export interface TeamMember {
  id: string;
  name: string;
  email: string;
  role: 'admin' | 'editor' | 'viewer';
}

export interface AuditLog {
  id: string;
  action: string;
  details: string;
  timestamp: number;
  ip?: string;
}

export interface Subscription {
  plan: PlanType;
  cycle: 'monthly' | 'yearly';
  status: 'active' | 'cancelled' | 'past_due';
  nextBillingDate: number;
}

export interface Address {
  city?: string;
  state?: string;
  zip?: string;
  country?: string;
}

export interface TrackingPixels {
  ga?: string;
  fb?: string;
  tiktok?: string;
  adwords?: string;
}

export interface User {
  id: string;
  name: string;
  email: string;
  password?: string;
  role: 'organizer' | 'attendee' | 'admin' | 'affiliate';
  isAdmin?: boolean;
  isBanned?: boolean;
  businessName?: string;
  businessEmail?: string; // Separate email for business/organizer profile
  organizerSubtitle?: string;
  useBusinessName?: boolean;
  businessType?: string;
  eventTypes?: string;
  onboardingStep?: number;
  logoUrl?: string;
  headerImageUrl?: string;
  primaryColor?: string;
  
  // Contact Info
  phone?: string; // Personal phone
  businessPhone?: string; // Business phone
  showPhonePublicly?: boolean; // Whether to show phone on public profile
  bio?: string; // Full bio/description

  // Financials
  balanceDue: number;
  availablePayout: number;
  paymentMethods: PaymentMethod[];
  invoices: Invoice[];
  payoutSettings?: PayoutSettings;
  bankInfo?: BankInfo;
  stripeConnectId?: string;
  stripeOnboardingComplete?: boolean;

  // Admin/Platform Config
  stripePublishableKey?: string;
  stripeSecretKey?: string;
  geminiApiKey?: string;

  // Profile
  socials?: Socials;
  address?: Address;
  notifications?: { reminder: boolean; newOrder: boolean };

  // Subscription
  subscription?: Subscription;

  // Affiliate
  affiliateCode?: string;
  affiliateClicks?: number;
  totalPaidOut?: number;
  commissionRate?: number;

  // Team
  teamMembers?: TeamMember[];

  // Analytics
  trackingPixels?: TrackingPixels;

  // Admin/Legal
  nonProfitStatus?: 'pending' | 'approved' | 'rejected';
  nonProfitName?: string;
  nonProfitEin?: string;
  nonProfitDocUrl?: string;
  auditLogs?: AuditLog[];

  // Preferences
  defaultPaymentMethod?: string;
  defaultPaymentLink?: string;
  defaultPaymentInstructions?: string;

  // Email Marketing
  gmailConfig?: {
    connected: boolean;
    email?: string;
    lastSynced?: number;
  };
  emailTemplates?: EmailTemplate[];

  // Email Provider Settings
  emailProvider?: 'gmail' | 'openticket_mailer'; // Selected email sending provider
  gmailConnected?: boolean; // Whether Gmail is connected (separate from selection)

  defaultConfirmationTemplate?: string;
  defaultWaiver?: {
    enabled?: boolean;
    text?: string;
    pdfUrl?: string;
    fileName?: string;
  };
  defaultRefundPolicy?: string;
  defaultRefundPolicyEnabled?: boolean;
  defaultTaxRate?: number;
  defaultCustomFees?: CustomFee[];
  defaultCurrency?: string; // Default currency for new events (USD, EUR, GBP, CAD, AUD)

  // Saved Ticket Templates
  savedTicketTemplates?: SavedTicketTemplate[];

  // Favorites
  favoriteOrganizers?: string[];
}

export interface TicketTier {
  id: string;
  name: string;
  price: number;
  capacity: number;
  description?: string;
  visibility?: 'public' | 'hidden' | 'access_code';
  accessCode?: string;
}

export interface AddOn {
  id: string;
  name: string;
  price: number;
  allowMultiple: boolean;
  question?: string;
  questionType?: 'text' | 'select';
  options?: string[];
  taxable?: boolean;
}

export interface Question {
  id: string;
  type: 'text' | 'textarea' | 'select' | 'checkbox' | 'radio';
  label: string;
  required: boolean;
  options?: string[];
}

export interface GalleryItem {
  id: string;
  url: string;
  caption?: string;
}

export interface AffiliateLink {
  id: string;
  name: string;
  code: string;
  clicks: number;
  conversions: number;
}

export interface PromoCode {
  code: string;
  type: 'percent' | 'fixed';
  value: number;
  usageCount: number;
  maxUsage?: number;
  expiryDate?: number;
  applicableTiers?: string[];
  minOrderQty?: number;
}

export interface EmailTemplate {
  id: string;
  type: 'confirmation' | 'waitlist' | 'reminder' | 'broadcast';
  name: string;
  subject: string;
  body: string;
}

export interface Broadcast {
  id: string;
  subject: string;
  message: string;
  sentAt: number;
  templateId?: string;
}

export interface PaymentConfig {
  method: 'online' | 'offline' | 'none';
  link?: string;
  instructions?: string;
  // STRIPE_ONLY_PAYOUTS: Removed legacy providers
  stripePublishableKey?: string;
  stripeAccountId?: string;
}

export interface WaitlistConfig {
  enabled: boolean;
  startDate: string;
  endDate: string;
}

export interface RecurringDate {
  id: string;
  date: string;
  startTime: string;
  capacity?: number;
}

export interface SEOConfig {
  metaTitle?: string;
  metaDescription?: string;
  canonicalUrl?: string;
  ogImageUrl?: string;
  keywords?: string[];
  noIndex?: boolean;
}

export interface TicketDesign {
  template?: 'modern' | 'classic' | 'minimal' | 'festive' | string; // Pre-designed or custom template ID
  logoUrl?: string;
  backgroundColor?: string;
  textColor?: string;
  accentColor?: string;
  showCoverImage?: boolean;
  customMessage?: string;
  orientation?: 'portrait' | 'landscape';
}

// Saved custom ticket template
export interface SavedTicketTemplate {
  id: string;
  name: string;
  createdAt: number;
  design: {
    logoUrl?: string;
    backgroundColor?: string;
    textColor?: string;
    accentColor?: string;
    customMessage?: string;
    gradient?: string; // Custom gradient class
  };
}

export interface CustomFee {
  name: string;
  amount: number;
  type: 'fixed' | 'percent';
}

export interface Event {
  id: string;
  ownerId: string;
  title: string;
  subtitle?: string;
  description: string;
  category: string;
  eventType: 'in_person' | 'online' | 'hybrid';

  // Date & Time
  date: string;
  time: string;
  endDate?: string;
  endTime?: string;
  duration?: number;
  isRecurring: boolean;
  recurringDates?: RecurringDate[];
  timeFormat?: '12h' | '24h';
  timeline?: string;

  // Location
  location: string;
  venueName?: string;
  onlineUrl?: string;

  // Media
  imageUrl: string;
  coverImagePosition?: number;
  gallery?: GalleryItem[];

  // Tickets & Pricing
  priceType: 'free' | 'fixed' | 'donation' | 'tiered';
  price: number;
  currency?: string; // Event's base currency (USD, EUR, GBP, CAD, AUD) - all prices in this currency
  ticketName?: string;
  ticketTiers?: TicketTier[];
  addOns?: AddOn[];
  capacity: number;
  promoCodes?: PromoCode[];
  taxRate?: number;
  absorbFees?: boolean;
  customFees?: CustomFee[];
  hidePlatformDonation?: boolean; // Pro/Premium can hide the platform donation option

  // Registration & Policies
  questions?: Question[];
  requiresApproval?: boolean;
  confirmationMessage?: string;
  refundPolicy?: string;

  // Waiver & Schedule
  waiverConfig?: {
    enabled: boolean;
    text?: string;
    pdfUrl?: string;
    fileName?: string;
  };
  scheduleConfig?: {
    enabled: boolean;
    text?: string;
    pdfUrl?: string;
    fileName?: string;
  };

  // Deprecated/Legacy (keep for migration but use new configs preferrably)
  specificWaiverText?: string;
  specificWaiverPdfUrl?: string;
  schedulePdfUrl?: string;
  enablePayAtDoor?: boolean;
  paymentTimeLimit?: number;
  waitlistConfig?: WaitlistConfig;
  rsvpMode?: boolean;
  collectGuestInfo?: boolean;

  // Marketing & Tools
  tags?: string[];
  affiliates?: AffiliateLink[];
  trackingPixels?: TrackingPixels;
  remarketing?: boolean;
  seo?: SEOConfig;

  // Design
  ticketDesign?: TicketDesign;

  // Email Configuration (New)
  emailSettings?: {
    enabled: boolean;
    confirmationTemplateId?: string;
    reminderEnabled?: boolean;
    reminderTemplateId?: string;
    reminderHoursBefore?: number;
  };

  notifications?: { reminder: boolean; newOrder: boolean };
  reminders?: any[];
  broadcasts?: Broadcast[];

  // Settings
  paymentConfig: PaymentConfig;
  organizer: string;
  organizerEmail: string;
  organizerPhone?: string;
  organizerWebsite?: string;
  visibility: 'public' | 'hidden' | 'private';
  isDraft: boolean;

  // System
  createdAt: number;
  registeredCount: number;
  moderationStatus?: 'approved' | 'flagged' | 'rejected';
  moderationReason?: string;
}

export interface PurchasedTicket {
  // Legacy fields
  tierId: string;
  name: string;
  pricePerTicket?: number;
  price?: number;  // Alternative field name
  quantity: number;
  date?: string;
  status?: 'valid' | 'refunded' | 'used' | 'cancelled';
  
  // NEW: Unique ticket identifiers
  ticketId?: string;  // Unique ID: TKT-{timestamp}-{hash}
  ticketNumber?: string;  // Human-readable: TKT-ABC123
  qrCodeData?: string;  // QR code data (usually same as ticketId)
  
  // Attendee information
  attendeeName?: string;
  attendeeEmail?: string;
  originalAttendeeName?: string;  // For transfer history
  
  // Check-in tracking
  checkedIn?: boolean;
  checkedInAt?: string;
  checkedInBy?: string;
  
  // Transfer tracking
  transferStatus?: 'transferred_out' | 'transferred_in' | null;
  transferredToEmail?: string;
  transferredToUserId?: string;
  transferredFromEmail?: string;
  transferredFromUserId?: string;
  transferId?: string;
  
  // Metadata
  createdAt?: string;
  purchaseDate?: string;
  
  // Legacy compatibility
  key?: string;
  id?: string;
  tierIndex?: number;
  indexInTier?: number;
}

export interface PurchasedAddOn {
  id: string;
  name: string;
  price: number;
  quantity: number;
  answer?: string;
  fulfilled?: boolean;
  status?: 'active' | 'refunded' | 'cancelled';
}

export interface UserNotification {
  id: string;
  userId: string;
  type: 'message' | 'alert' | 'update';
  title: string;
  message: string;
  read: boolean;
  timestamp: number;
  data?: any; // link to event or order
}

export interface ContactSubmission {
  id: string;
  name: string;
  email: string;
  subject: string;
  message: string;
  timestamp: number;
}

export interface SystemNotification {
  id: string;
  message: string;
  type: 'info' | 'warning' | 'success';
  active: boolean;
  timestamp: number;
  target?: 'all' | 'organizers' | 'affiliates';
}

export interface Registration {
  id: string;  // This is the Purchase Order ID
  eventId: string;
  attendeeName: string;
  attendeeEmail: string;
  phoneNumber?: string;
  donationAmount: number;
  platformDonationAmount?: number;
  serviceFee?: number;
  taxAmount?: number;
  customFeesAmount?: number;
  answers: Record<string, string | string[]>;
  selectedDates?: string[];
  tickets?: PurchasedTicket[];
  addOns?: PurchasedAddOn[];
  promoCodeUsed?: string;
  affiliateCode?: string;
  discountAmount?: number;
  timestamp: number;  // Purchase date/time
  paymentStatus: 'pending' | 'completed' | 'offline_pending' | 'refunded' | 'paid' | 'approved';
  approvalStatus: 'pending' | 'approved' | 'rejected' | 'waitlist';
  checkedIn?: boolean;
  checkInTime?: number;
  checkInStatuses?: Record<string, { checkedIn: boolean, timestamp: number }>;
  waiverAgreed?: boolean;

  refundedAmount?: number;
  refundReason?: string;
  source?: 'online' | 'manual' | 'transfer';  // Added 'transfer' for transferred tickets

  hiddenForAttendee?: boolean;
  hiddenTicketKeys?: string[];
  internalNotes?: string;

  stripePaymentIntentId?: string;
  stripeTransferId?: string;
  stripeFee?: number;
  
  // NEW: For better tracking
  userId?: string;  // Link to user account
  createdAt?: string;  // ISO timestamp
}

export interface WaitlistEntry {
  id: string;
  eventId: string;
  userId?: string;
  name: string;
  email: string;
  phone?: string;
  dateJoined: number;
  status: 'pending' | 'promoted' | 'expired';
  promotedAt?: number;
}
