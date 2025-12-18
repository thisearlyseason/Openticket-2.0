
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
  businessType?: string;
  eventTypes?: string;
  logoUrl?: string;
  headerImageUrl?: string;
  primaryColor?: string;
  
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

  // Profile
  socials?: Socials;
  address?: Address;
  notifications?: { reminder: boolean; newOrder: boolean };
  
  // Subscription
  subscription?: Subscription;
  
  // Affiliate
  affiliateCode?: string;
  
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
  defaultConfirmationTemplate?: string;
  defaultRefundPolicy?: string;
  defaultTaxRate?: number;
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
}

export interface Broadcast {
  id: string;
  subject: string;
  message: string;
  sentAt: number;
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
  ticketName?: string;
  ticketTiers?: TicketTier[];
  addOns?: AddOn[];
  capacity: number;
  promoCodes?: PromoCode[];
  taxRate?: number;
  absorbFees?: boolean;
  customFees?: CustomFee[];
  
  // Registration & Policies
  questions?: Question[];
  requiresApproval?: boolean;
  confirmationMessage?: string;
  refundPolicy?: string;
  specificWaiverText?: string;
  specificWaiverPdfUrl?: string;
  schedulePdfUrl?: string;
  enablePayAtDoor?: boolean;
  paymentTimeLimit?: number;
  waitlistConfig?: WaitlistConfig;
  rsvpMode?: boolean;

  // Marketing & Tools
  tags?: string[];
  affiliates?: AffiliateLink[];
  trackingPixels?: TrackingPixels;
  remarketing?: boolean;
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
  tierId: string;
  name: string;
  pricePerTicket: number;
  quantity: number;
  date?: string; 
  status?: 'valid' | 'refunded' | 'used';
  attendeeName?: string;
  attendeeEmail?: string;
}

export interface PurchasedAddOn {
  id: string;
  name: string;
  price: number;
  quantity: number;
  answer?: string;
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
}

export interface Registration {
  id: string;
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
  timestamp: number;
  paymentStatus: 'pending' | 'completed' | 'offline_pending' | 'refunded';
  approvalStatus: 'pending' | 'approved' | 'rejected' | 'waitlist';
  checkedIn?: boolean; 
  checkInTime?: number;
  checkInStatuses?: Record<string, { checkedIn: boolean, timestamp: number }>; 
  waiverAgreed?: boolean;
  
  refundedAmount?: number;
  refundReason?: string;
  source?: 'online' | 'manual';
  
  hiddenForAttendee?: boolean; 
  hiddenTicketKeys?: string[]; 
  internalNotes?: string; 

  stripePaymentIntentId?: string;
  stripeTransferId?: string;
  stripeFee?: number; 
}
