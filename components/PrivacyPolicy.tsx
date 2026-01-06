import React, { useState } from 'react';
import { Lock, ChevronDown, ChevronUp, Eye, Database, Shield, Share2, Cookie, Mail, Globe, Trash2, FileText, CreditCard } from 'lucide-react';
import { Link } from 'react-router-dom';

interface SectionProps {
    title: string;
    icon: React.ReactNode;
    children: React.ReactNode;
    defaultOpen?: boolean;
}

const Section: React.FC<SectionProps> = ({ title, icon, children, defaultOpen = false }) => {
    const [isOpen, setIsOpen] = useState(defaultOpen);
    
    return (
        <div className="border-b border-zinc-200 dark:border-zinc-800 last:border-0">
            <button
                onClick={() => setIsOpen(!isOpen)}
                className="w-full flex items-center justify-between py-5 text-left hover:bg-zinc-50 dark:hover:bg-zinc-800/50 px-4 -mx-4 transition-colors"
            >
                <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-emerald-100 to-teal-200 dark:from-emerald-900/50 dark:to-teal-800/50 flex items-center justify-center text-emerald-600 dark:text-emerald-400">
                        {icon}
                    </div>
                    <span className="font-bold text-zinc-900 dark:text-white">{title}</span>
                </div>
                {isOpen ? <ChevronUp size={20} className="text-zinc-400" /> : <ChevronDown size={20} className="text-zinc-400" />}
            </button>
            {isOpen && (
                <div className="pb-6 pt-2 text-zinc-600 dark:text-zinc-400 text-sm leading-relaxed space-y-4 animate-in fade-in duration-200">
                    {children}
                </div>
            )}
        </div>
    );
};

export const PrivacyPolicy = () => {
    return (
        <div className="min-h-screen bg-gradient-to-b from-zinc-50 to-white dark:from-zinc-950 dark:to-zinc-900">
            {/* Hero Section */}
            <div className="relative overflow-hidden">
                <div className="absolute inset-0 bg-gradient-to-br from-emerald-500/10 via-transparent to-teal-500/10 dark:from-emerald-500/5 dark:to-teal-500/5" />
                <div className="max-w-4xl mx-auto px-4 pt-16 pb-12 relative">
                    <div className="flex items-center gap-4 mb-6">
                        <div className="w-16 h-16 rounded-2xl bg-gradient-to-br from-emerald-500 to-teal-600 flex items-center justify-center shadow-lg shadow-emerald-500/30">
                            <Lock size={32} className="text-white" />
                        </div>
                        <div>
                            <h1 className="text-4xl font-black text-zinc-900 dark:text-white tracking-tight">
                                Privacy Policy
                            </h1>
                            <p className="text-zinc-500 dark:text-zinc-400 mt-1">
                                Last updated: {new Date().toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' })}
                            </p>
                        </div>
                    </div>
                    
                    {/* Quick Links */}
                    <div className="flex flex-wrap gap-2 mt-6">
                        <Link to="/terms" className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-zinc-100 dark:bg-zinc-800 text-xs font-medium text-zinc-600 dark:text-zinc-300 hover:bg-zinc-200 dark:hover:bg-zinc-700 transition-colors">
                            <FileText size={12} /> Terms of Service
                        </Link>
                        <Link to="/refunds" className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-zinc-100 dark:bg-zinc-800 text-xs font-medium text-zinc-600 dark:text-zinc-300 hover:bg-zinc-200 dark:hover:bg-zinc-700 transition-colors">
                            <CreditCard size={12} /> Refund Policy
                        </Link>
                    </div>
                </div>
            </div>

            {/* Main Content */}
            <div className="max-w-4xl mx-auto px-4 pb-20">
                <div className="bg-white dark:bg-zinc-900 rounded-3xl shadow-xl border border-zinc-200 dark:border-zinc-800 overflow-hidden">
                    {/* Summary Card */}
                    <div className="bg-gradient-to-r from-emerald-500/10 to-teal-500/10 dark:from-emerald-500/5 dark:to-teal-500/5 p-6 border-b border-zinc-200 dark:border-zinc-800">
                        <h2 className="font-bold text-zinc-900 dark:text-white mb-2">Your Privacy Matters</h2>
                        <p className="text-sm text-zinc-600 dark:text-zinc-400 leading-relaxed">
                            We collect only what's necessary to provide our service, never sell your data, and give you 
                            control over your information. This policy explains what we collect, why, and your rights.
                        </p>
                    </div>

                    {/* Sections */}
                    <div className="p-6">
                        <Section title="Information We Collect" icon={<Eye size={20} />} defaultOpen={true}>
                            <p>We collect information in three ways:</p>
                            
                            <div className="mt-4 space-y-4">
                                <div className="p-4 bg-zinc-50 dark:bg-zinc-800/50 rounded-xl">
                                    <h4 className="font-bold text-zinc-900 dark:text-white mb-2">Information You Provide</h4>
                                    <ul className="list-disc pl-5 space-y-1">
                                        <li>Account details (name, email, password)</li>
                                        <li>Profile information (photo, bio, preferences)</li>
                                        <li>Event details you create or register for</li>
                                        <li>Communications with us or other users</li>
                                    </ul>
                                </div>
                                
                                <div className="p-4 bg-zinc-50 dark:bg-zinc-800/50 rounded-xl">
                                    <h4 className="font-bold text-zinc-900 dark:text-white mb-2">Automatic Collection</h4>
                                    <ul className="list-disc pl-5 space-y-1">
                                        <li>Device information (browser, OS, screen size)</li>
                                        <li>IP address and approximate location</li>
                                        <li>Usage data (pages visited, features used)</li>
                                        <li>Cookies and similar technologies</li>
                                    </ul>
                                </div>

                                <div className="p-4 bg-zinc-50 dark:bg-zinc-800/50 rounded-xl">
                                    <h4 className="font-bold text-zinc-900 dark:text-white mb-2">Third-Party Sources</h4>
                                    <ul className="list-disc pl-5 space-y-1">
                                        <li>Social login providers (if you use Google/Facebook sign-in)</li>
                                        <li>Payment processors (Stripe) for transaction data</li>
                                    </ul>
                                </div>
                            </div>
                        </Section>

                        <Section title="How We Use Your Data" icon={<Database size={20} />}>
                            <p>We use your information to:</p>
                            <ul className="list-disc pl-5 space-y-2 mt-3">
                                <li><strong>Provide Services:</strong> Create accounts, process tickets, send confirmations</li>
                                <li><strong>Improve Platform:</strong> Analyze usage patterns to enhance features</li>
                                <li><strong>Communicate:</strong> Send important updates, newsletters (with consent), and support responses</li>
                                <li><strong>Security:</strong> Detect fraud, prevent abuse, and protect our users</li>
                                <li><strong>Legal Compliance:</strong> Meet our legal obligations and enforce our terms</li>
                            </ul>
                            
                            <div className="mt-4 p-4 bg-emerald-50 dark:bg-emerald-900/20 rounded-xl border border-emerald-200 dark:border-emerald-800/50">
                                <p className="text-emerald-800 dark:text-emerald-200 text-sm flex items-start gap-2">
                                    <Shield size={16} className="mt-0.5 flex-shrink-0" />
                                    <span><strong>We never sell your personal data.</strong> Your information is not for sale to advertisers or data brokers.</span>
                                </p>
                            </div>
                        </Section>

                        <Section title="Data Sharing & Third Parties" icon={<Share2 size={20} />}>
                            <p>We share your data only in these circumstances:</p>
                            <ul className="list-disc pl-5 space-y-2 mt-3">
                                <li><strong>Event Organizers:</strong> When you register for an event, organizers receive your registration details</li>
                                <li><strong>Payment Processors:</strong> Stripe processes payments and requires necessary transaction data</li>
                                <li><strong>Service Providers:</strong> We use trusted services for email, analytics, and infrastructure</li>
                                <li><strong>Legal Requirements:</strong> When required by law or to protect rights and safety</li>
                            </ul>
                            
                            <p className="mt-4">
                                All third-party providers are bound by confidentiality agreements and only receive data necessary 
                                for their services.
                            </p>
                        </Section>

                        <Section title="Cookies & Tracking" icon={<Cookie size={20} />}>
                            <p>We use cookies and similar technologies for:</p>
                            <ul className="list-disc pl-5 space-y-2 mt-3">
                                <li><strong>Essential Cookies:</strong> Required for login, security, and basic functionality</li>
                                <li><strong>Preference Cookies:</strong> Remember your settings (theme, currency, language)</li>
                                <li><strong>Analytics Cookies:</strong> Help us understand how you use the platform</li>
                            </ul>
                            
                            <div className="mt-4 p-4 bg-zinc-50 dark:bg-zinc-800/50 rounded-xl">
                                <h4 className="font-bold text-zinc-900 dark:text-white mb-2">Managing Cookies</h4>
                                <p>
                                    You can control cookies through your browser settings. Note that disabling certain cookies 
                                    may affect platform functionality.
                                </p>
                            </div>
                        </Section>

                        <Section title="Your Rights & Controls" icon={<Shield size={20} />}>
                            <p>You have the right to:</p>
                            <ul className="list-disc pl-5 space-y-2 mt-3">
                                <li><strong>Access:</strong> Request a copy of your personal data</li>
                                <li><strong>Correction:</strong> Update or correct inaccurate information</li>
                                <li><strong>Deletion:</strong> Request deletion of your account and data</li>
                                <li><strong>Portability:</strong> Export your data in a machine-readable format</li>
                                <li><strong>Opt-out:</strong> Unsubscribe from marketing communications</li>
                            </ul>
                            
                            <p className="mt-4">
                                To exercise these rights, visit your <Link to="/settings" className="text-emerald-600 dark:text-emerald-400 hover:underline">account settings</Link> or 
                                contact us at <a href="mailto:privacy@openticket.com" className="text-emerald-600 dark:text-emerald-400 hover:underline">privacy@openticket.com</a>.
                            </p>
                        </Section>

                        <Section title="Data Retention" icon={<Trash2 size={20} />}>
                            <p>We retain your data for as long as needed to provide services and comply with legal obligations:</p>
                            <ul className="list-disc pl-5 space-y-2 mt-3">
                                <li><strong>Active Accounts:</strong> Data retained while your account is active</li>
                                <li><strong>Deleted Accounts:</strong> Most data deleted within 30 days, some retained up to 7 years for legal/tax purposes</li>
                                <li><strong>Transaction Records:</strong> Kept for 7 years as required by financial regulations</li>
                                <li><strong>Anonymized Data:</strong> May be retained indefinitely for analytics</li>
                            </ul>
                        </Section>

                        <Section title="International Transfers" icon={<Globe size={20} />}>
                            <p>
                                OpenTicket operates globally. Your data may be transferred to and processed in countries 
                                other than your own. We ensure appropriate safeguards are in place:
                            </p>
                            <ul className="list-disc pl-5 space-y-2 mt-3">
                                <li>Standard contractual clauses approved by relevant authorities</li>
                                <li>Data processing agreements with all service providers</li>
                                <li>Compliance with GDPR for EU users and similar regulations worldwide</li>
                            </ul>
                        </Section>

                        <Section title="Contact Us" icon={<Mail size={20} />}>
                            <p>For privacy-related questions or concerns:</p>
                            <div className="mt-4 p-4 bg-zinc-50 dark:bg-zinc-800/50 rounded-xl">
                                <p className="font-bold text-zinc-900 dark:text-white">OpenTicket Privacy Team</p>
                                <p className="text-zinc-600 dark:text-zinc-400 mt-2">
                                    Email: <a href="mailto:privacy@openticket.com" className="text-emerald-600 dark:text-emerald-400 hover:underline">privacy@openticket.com</a>
                                </p>
                            </div>
                            <p className="mt-4">
                                We aim to respond to all privacy inquiries within 30 days.
                            </p>
                        </Section>
                    </div>

                    {/* Footer */}
                    <div className="bg-zinc-50 dark:bg-zinc-800/50 p-6 border-t border-zinc-200 dark:border-zinc-800">
                        <p className="text-sm text-zinc-500 dark:text-zinc-400 text-center">
                            This policy may be updated periodically. We'll notify you of significant changes via email or platform notification.
                        </p>
                    </div>
                </div>
            </div>
        </div>
    );
};

export default PrivacyPolicy;
