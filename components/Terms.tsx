import React, { useState } from 'react';
import { Shield, ChevronDown, ChevronUp, FileText, Scale, AlertCircle, CreditCard, Ban, Edit, RefreshCw, ExternalLink } from 'lucide-react';
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
                    <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-zinc-100 to-zinc-200 dark:from-zinc-800 dark:to-zinc-700 flex items-center justify-center text-zinc-600 dark:text-zinc-300">
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

export const Terms = () => {
    return (
        <div className="min-h-screen bg-gradient-to-b from-zinc-50 to-white dark:from-zinc-950 dark:to-zinc-900">
            {/* Hero Section */}
            <div className="relative overflow-hidden">
                <div className="absolute inset-0 bg-gradient-to-br from-violet-500/10 via-transparent to-pink-500/10 dark:from-violet-500/5 dark:to-pink-500/5" />
                <div className="max-w-4xl mx-auto px-4 pt-16 pb-12 relative">
                    <div className="flex items-center gap-4 mb-6">
                        <div className="w-16 h-16 rounded-2xl bg-gradient-to-br from-violet-500 to-purple-600 flex items-center justify-center shadow-lg shadow-violet-500/30">
                            <Shield size={32} className="text-white" />
                        </div>
                        <div>
                            <h1 className="text-4xl font-black text-zinc-900 dark:text-white tracking-tight">
                                Terms of Service
                            </h1>
                            <p className="text-zinc-500 dark:text-zinc-400 mt-1">
                                Last updated: {new Date().toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' })}
                            </p>
                        </div>
                    </div>
                    
                    {/* Quick Links */}
                    <div className="flex flex-wrap gap-2 mt-6">
                        <Link to="/privacy" className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-zinc-100 dark:bg-zinc-800 text-xs font-medium text-zinc-600 dark:text-zinc-300 hover:bg-zinc-200 dark:hover:bg-zinc-700 transition-colors">
                            <FileText size={12} /> Privacy Policy
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
                    <div className="bg-gradient-to-r from-violet-500/10 to-purple-500/10 dark:from-violet-500/5 dark:to-purple-500/5 p-6 border-b border-zinc-200 dark:border-zinc-800">
                        <h2 className="font-bold text-zinc-900 dark:text-white mb-2">Quick Summary</h2>
                        <p className="text-sm text-zinc-600 dark:text-zinc-400 leading-relaxed">
                            OpenTicket is a platform that connects event organizers with attendees. By using our service, 
                            you agree to use it responsibly, respect others, and understand that organizers set their own 
                            event policies including refunds.
                        </p>
                    </div>

                    {/* Sections */}
                    <div className="p-6">
                        <Section title="Welcome to OpenTicket" icon={<FileText size={20} />} defaultOpen={true}>
                            <p>
                                Welcome to OpenTicket ("we," "our," or "us"). By accessing or using our platform at openticket.com 
                                and related services, you agree to be bound by these Terms of Service.
                            </p>
                            <p>
                                If you disagree with any part of these terms, you may not access our service. We recommend 
                                reading this document carefully before using OpenTicket.
                            </p>
                        </Section>

                        <Section title="Acceptable Use Policy" icon={<Scale size={20} />}>
                            <p>You agree to use OpenTicket only for lawful purposes. You must not:</p>
                            <ul className="list-disc pl-5 space-y-2 mt-3">
                                <li>Organize events promoting illegal activities, hate speech, violence, or discrimination</li>
                                <li>Use the platform to distribute spam, malware, or malicious content</li>
                                <li>Attempt to gain unauthorized access to our systems or other users' accounts</li>
                                <li>Sell counterfeit tickets or misrepresent event details</li>
                                <li>Engage in any activity that could harm the platform or its users</li>
                            </ul>
                            <div className="mt-4 p-4 bg-amber-50 dark:bg-amber-900/20 rounded-xl border border-amber-200 dark:border-amber-800/50">
                                <p className="text-amber-800 dark:text-amber-200 text-sm flex items-start gap-2">
                                    <AlertCircle size={16} className="mt-0.5 flex-shrink-0" />
                                    Violation of these policies may result in immediate account suspension without prior notice.
                                </p>
                            </div>
                        </Section>

                        <Section title="Event Organizer Responsibilities" icon={<Edit size={20} />}>
                            <p>As an event organizer on OpenTicket, you are solely responsible for:</p>
                            <ul className="list-disc pl-5 space-y-2 mt-3">
                                <li><strong>Event Accuracy:</strong> Ensuring all event details (date, time, location, description) are accurate and up-to-date</li>
                                <li><strong>Refund Policy:</strong> Setting and honoring your stated refund policy for attendees</li>
                                <li><strong>Legal Compliance:</strong> Complying with all applicable local, state, and federal laws regarding your event</li>
                                <li><strong>Attendee Safety:</strong> Taking reasonable measures to ensure attendee safety at your events</li>
                                <li><strong>Tax Obligations:</strong> Managing your own tax reporting and obligations for ticket sales</li>
                            </ul>
                        </Section>

                        <Section title="Payments & Platform Fees" icon={<CreditCard size={20} />}>
                            <p>
                                OpenTicket facilitates payments through Stripe, a secure third-party payment processor. 
                                By using our platform:
                            </p>
                            <ul className="list-disc pl-5 space-y-2 mt-3">
                                <li>You agree to Stripe's terms of service and payment processing agreements</li>
                                <li>Platform fees are deducted from ticket sales as disclosed in your organizer dashboard</li>
                                <li>Payouts to organizers are processed according to Stripe's payout schedule</li>
                                <li>We are not liable for payment processing errors caused by third-party services</li>
                            </ul>
                            <p className="mt-4 text-sm">
                                <strong>Note:</strong> All prices displayed may be shown in your local currency for reference, 
                                but all transactions are processed in USD.
                            </p>
                        </Section>

                        <Section title="Content & Moderation" icon={<Ban size={20} />}>
                            <p>
                                We reserve the right to review, moderate, and remove any content that violates our terms 
                                or community guidelines. This includes:
                            </p>
                            <ul className="list-disc pl-5 space-y-2 mt-3">
                                <li>Event listings that contain inappropriate, offensive, or misleading content</li>
                                <li>User profiles or communications that violate our acceptable use policy</li>
                                <li>Any content that infringes on intellectual property rights</li>
                            </ul>
                            <p className="mt-4">
                                Serious violations may result in permanent account suspension and potential legal action.
                            </p>
                        </Section>

                        <Section title="Limitation of Liability" icon={<AlertCircle size={20} />}>
                            <p>
                                OpenTicket is provided "as is" without warranties of any kind, express or implied. 
                                To the fullest extent permitted by law:
                            </p>
                            <ul className="list-disc pl-5 space-y-2 mt-3">
                                <li>We are not liable for any direct, indirect, incidental, or consequential damages arising from your use of the platform</li>
                                <li>We do not guarantee uninterrupted or error-free service</li>
                                <li>We are not responsible for the conduct of event organizers or attendees</li>
                                <li>Our total liability shall not exceed the fees paid by you in the 12 months preceding any claim</li>
                            </ul>
                        </Section>

                        <Section title="Changes to Terms" icon={<RefreshCw size={20} />}>
                            <p>
                                We reserve the right to modify these Terms of Service at any time. When we make changes:
                            </p>
                            <ul className="list-disc pl-5 space-y-2 mt-3">
                                <li>We will update the "Last updated" date at the top of this page</li>
                                <li>For significant changes, we will notify users via email or platform notification</li>
                                <li>Continued use of the platform after changes constitutes acceptance of the new terms</li>
                            </ul>
                            <p className="mt-4">
                                We encourage you to review these terms periodically to stay informed of any updates.
                            </p>
                        </Section>
                    </div>

                    {/* Footer */}
                    <div className="bg-zinc-50 dark:bg-zinc-800/50 p-6 border-t border-zinc-200 dark:border-zinc-800">
                        <p className="text-sm text-zinc-500 dark:text-zinc-400 text-center">
                            Questions about these terms? Contact us at{' '}
                            <a href="mailto:legal@openticket.com" className="text-violet-600 dark:text-violet-400 hover:underline">
                                legal@openticket.com
                            </a>
                        </p>
                    </div>
                </div>
            </div>
        </div>
    );
};

export default Terms;
