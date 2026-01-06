import React, { useState } from 'react';
import { RotateCcw, ChevronDown, ChevronUp, AlertCircle, CheckCircle, Clock, HelpCircle, Mail, FileText, Lock, DollarSign, Calendar, MessageCircle } from 'lucide-react';
import { Link } from 'react-router-dom';

interface FAQProps {
    question: string;
    children: React.ReactNode;
}

const FAQ: React.FC<FAQProps> = ({ question, children }) => {
    const [isOpen, setIsOpen] = useState(false);
    
    return (
        <div className="border-b border-zinc-200 dark:border-zinc-800 last:border-0">
            <button
                onClick={() => setIsOpen(!isOpen)}
                className="w-full flex items-start justify-between py-4 text-left hover:bg-zinc-50 dark:hover:bg-zinc-800/50 px-4 -mx-4 transition-colors"
            >
                <span className="font-medium text-zinc-900 dark:text-white pr-4">{question}</span>
                {isOpen ? <ChevronUp size={20} className="text-zinc-400 flex-shrink-0 mt-0.5" /> : <ChevronDown size={20} className="text-zinc-400 flex-shrink-0 mt-0.5" />}
            </button>
            {isOpen && (
                <div className="pb-4 text-zinc-600 dark:text-zinc-400 text-sm leading-relaxed animate-in fade-in duration-200">
                    {children}
                </div>
            )}
        </div>
    );
};

export const RefundsPage = () => {
    return (
        <div className="min-h-screen bg-gradient-to-b from-zinc-50 to-white dark:from-zinc-950 dark:to-zinc-900">
            {/* Hero Section */}
            <div className="relative overflow-hidden">
                <div className="absolute inset-0 bg-gradient-to-br from-orange-500/10 via-transparent to-amber-500/10 dark:from-orange-500/5 dark:to-amber-500/5" />
                <div className="max-w-4xl mx-auto px-4 pt-16 pb-12 relative">
                    <div className="flex items-center gap-4 mb-6">
                        <div className="w-16 h-16 rounded-2xl bg-gradient-to-br from-orange-500 to-amber-600 flex items-center justify-center shadow-lg shadow-orange-500/30">
                            <RotateCcw size={32} className="text-white" />
                        </div>
                        <div>
                            <h1 className="text-4xl font-black text-zinc-900 dark:text-white tracking-tight">
                                Refund Policy
                            </h1>
                            <p className="text-zinc-500 dark:text-zinc-400 mt-1">
                                Understanding how refunds work on OpenTicket
                            </p>
                        </div>
                    </div>
                    
                    {/* Quick Links */}
                    <div className="flex flex-wrap gap-2 mt-6">
                        <Link to="/terms" className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-zinc-100 dark:bg-zinc-800 text-xs font-medium text-zinc-600 dark:text-zinc-300 hover:bg-zinc-200 dark:hover:bg-zinc-700 transition-colors">
                            <FileText size={12} /> Terms of Service
                        </Link>
                        <Link to="/privacy" className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-zinc-100 dark:bg-zinc-800 text-xs font-medium text-zinc-600 dark:text-zinc-300 hover:bg-zinc-200 dark:hover:bg-zinc-700 transition-colors">
                            <Lock size={12} /> Privacy Policy
                        </Link>
                    </div>
                </div>
            </div>

            {/* Main Content */}
            <div className="max-w-4xl mx-auto px-4 pb-20">
                {/* Important Notice */}
                <div className="bg-gradient-to-r from-orange-500/10 to-amber-500/10 dark:from-orange-500/5 dark:to-amber-500/5 rounded-2xl p-6 border border-orange-200 dark:border-orange-800/30 mb-8">
                    <div className="flex items-start gap-4">
                        <div className="w-12 h-12 rounded-xl bg-orange-100 dark:bg-orange-900/30 flex items-center justify-center flex-shrink-0">
                            <AlertCircle size={24} className="text-orange-600 dark:text-orange-400" />
                        </div>
                        <div>
                            <h2 className="font-bold text-zinc-900 dark:text-white mb-2">Important: Organizer-Set Policies</h2>
                            <p className="text-sm text-zinc-600 dark:text-zinc-400 leading-relaxed">
                                OpenTicket is a platform that connects event organizers with attendees. 
                                <strong className="text-zinc-900 dark:text-white"> Each event has its own refund policy set by the organizer.</strong> 
                                We facilitate the ticketing process, but refund decisions are ultimately made by the event organizer 
                                according to their stated policy.
                            </p>
                        </div>
                    </div>
                </div>

                {/* Steps to Find Policy */}
                <div className="bg-white dark:bg-zinc-900 rounded-3xl shadow-xl border border-zinc-200 dark:border-zinc-800 overflow-hidden mb-8">
                    <div className="p-6 border-b border-zinc-200 dark:border-zinc-800">
                        <h2 className="text-xl font-bold text-zinc-900 dark:text-white flex items-center gap-2">
                            <HelpCircle size={24} className="text-orange-500" />
                            How to Find an Event's Refund Policy
                        </h2>
                    </div>
                    
                    <div className="p-6">
                        <div className="grid md:grid-cols-3 gap-6">
                            <div className="text-center">
                                <div className="w-12 h-12 rounded-full bg-orange-100 dark:bg-orange-900/30 flex items-center justify-center mx-auto mb-4">
                                    <span className="text-xl font-black text-orange-600 dark:text-orange-400">1</span>
                                </div>
                                <h3 className="font-bold text-zinc-900 dark:text-white mb-2">Event Page</h3>
                                <p className="text-sm text-zinc-600 dark:text-zinc-400">
                                    Check the event description for a "Refund Policy" section
                                </p>
                            </div>
                            
                            <div className="text-center">
                                <div className="w-12 h-12 rounded-full bg-orange-100 dark:bg-orange-900/30 flex items-center justify-center mx-auto mb-4">
                                    <span className="text-xl font-black text-orange-600 dark:text-orange-400">2</span>
                                </div>
                                <h3 className="font-bold text-zinc-900 dark:text-white mb-2">Confirmation Email</h3>
                                <p className="text-sm text-zinc-600 dark:text-zinc-400">
                                    Look for refund information in your ticket confirmation email
                                </p>
                            </div>
                            
                            <div className="text-center">
                                <div className="w-12 h-12 rounded-full bg-orange-100 dark:bg-orange-900/30 flex items-center justify-center mx-auto mb-4">
                                    <span className="text-xl font-black text-orange-600 dark:text-orange-400">3</span>
                                </div>
                                <h3 className="font-bold text-zinc-900 dark:text-white mb-2">Contact Organizer</h3>
                                <p className="text-sm text-zinc-600 dark:text-zinc-400">
                                    Use the "Contact" button on the event page to reach the organizer
                                </p>
                            </div>
                        </div>
                    </div>
                </div>

                {/* General Guidelines */}
                <div className="bg-white dark:bg-zinc-900 rounded-3xl shadow-xl border border-zinc-200 dark:border-zinc-800 overflow-hidden mb-8">
                    <div className="p-6 border-b border-zinc-200 dark:border-zinc-800">
                        <h2 className="text-xl font-bold text-zinc-900 dark:text-white">General Guidelines</h2>
                        <p className="text-sm text-zinc-500 mt-1">Unless otherwise stated by the event organizer</p>
                    </div>
                    
                    <div className="p-6 space-y-4">
                        <div className="flex items-start gap-4 p-4 bg-zinc-50 dark:bg-zinc-800/50 rounded-xl">
                            <div className="w-10 h-10 rounded-lg bg-amber-100 dark:bg-amber-900/30 flex items-center justify-center flex-shrink-0">
                                <DollarSign size={20} className="text-amber-600 dark:text-amber-400" />
                            </div>
                            <div>
                                <h3 className="font-bold text-zinc-900 dark:text-white mb-1">Platform Fees</h3>
                                <p className="text-sm text-zinc-600 dark:text-zinc-400">
                                    Platform service fees are generally non-refundable as they cover transaction processing costs.
                                </p>
                            </div>
                        </div>
                        
                        <div className="flex items-start gap-4 p-4 bg-zinc-50 dark:bg-zinc-800/50 rounded-xl">
                            <div className="w-10 h-10 rounded-lg bg-blue-100 dark:bg-blue-900/30 flex items-center justify-center flex-shrink-0">
                                <Clock size={20} className="text-blue-600 dark:text-blue-400" />
                            </div>
                            <div>
                                <h3 className="font-bold text-zinc-900 dark:text-white mb-1">Timing</h3>
                                <p className="text-sm text-zinc-600 dark:text-zinc-400">
                                    Refund requests should typically be made at least 24 hours before the event start time for consideration.
                                </p>
                            </div>
                        </div>
                        
                        <div className="flex items-start gap-4 p-4 bg-zinc-50 dark:bg-zinc-800/50 rounded-xl">
                            <div className="w-10 h-10 rounded-lg bg-green-100 dark:bg-green-900/30 flex items-center justify-center flex-shrink-0">
                                <CheckCircle size={20} className="text-green-600 dark:text-green-400" />
                            </div>
                            <div>
                                <h3 className="font-bold text-zinc-900 dark:text-white mb-1">Final Decision</h3>
                                <p className="text-sm text-zinc-600 dark:text-zinc-400">
                                    Event organizers have final discretion on all refund requests according to their stated policy.
                                </p>
                            </div>
                        </div>

                        <div className="flex items-start gap-4 p-4 bg-zinc-50 dark:bg-zinc-800/50 rounded-xl">
                            <div className="w-10 h-10 rounded-lg bg-purple-100 dark:bg-purple-900/30 flex items-center justify-center flex-shrink-0">
                                <Calendar size={20} className="text-purple-600 dark:text-purple-400" />
                            </div>
                            <div>
                                <h3 className="font-bold text-zinc-900 dark:text-white mb-1">Cancelled Events</h3>
                                <p className="text-sm text-zinc-600 dark:text-zinc-400">
                                    If an event is cancelled by the organizer, attendees are typically entitled to a full refund.
                                </p>
                            </div>
                        </div>
                    </div>
                </div>

                {/* FAQ Section */}
                <div className="bg-white dark:bg-zinc-900 rounded-3xl shadow-xl border border-zinc-200 dark:border-zinc-800 overflow-hidden mb-8">
                    <div className="p-6 border-b border-zinc-200 dark:border-zinc-800">
                        <h2 className="text-xl font-bold text-zinc-900 dark:text-white">Frequently Asked Questions</h2>
                    </div>
                    
                    <div className="p-6">
                        <FAQ question="How do I request a refund?">
                            <p>
                                To request a refund, contact the event organizer directly through the event page or your confirmation email. 
                                Go to "My Tickets" in your account, find the event, and use the contact option to reach the organizer with your refund request.
                            </p>
                        </FAQ>
                        
                        <FAQ question="How long do refunds take to process?">
                            <p>
                                Once approved by the organizer, refunds typically take 5-10 business days to appear in your account, 
                                depending on your payment method and bank. Stripe-processed refunds usually appear within 5-7 business days.
                            </p>
                        </FAQ>
                        
                        <FAQ question="Can I get a refund if I can't attend anymore?">
                            <p>
                                This depends entirely on the organizer's refund policy. Some organizers offer full refunds, 
                                others offer partial refunds or credits, and some have no-refund policies. Always check the 
                                event's policy before purchasing.
                            </p>
                        </FAQ>
                        
                        <FAQ question="What if the event is rescheduled?">
                            <p>
                                If an event is rescheduled, your ticket typically remains valid for the new date. If you can't 
                                attend the rescheduled date, contact the organizer to discuss refund options. Many organizers 
                                offer refunds for rescheduled events.
                            </p>
                        </FAQ>
                        
                        <FAQ question="The organizer isn't responding. What should I do?">
                            <p>
                                If you're unable to reach the organizer after multiple attempts (allow 48-72 hours for response), 
                                you can contact OpenTicket support. We'll help facilitate communication, but please note that 
                                refund decisions remain with the organizer.
                            </p>
                        </FAQ>
                        
                        <FAQ question="Are add-ons and upgrades refundable?">
                            <p>
                                Add-ons and ticket upgrades follow the same refund policy as the base ticket. Check with the 
                                organizer for specific details about refunding additional purchases.
                            </p>
                        </FAQ>
                    </div>
                </div>

                {/* Contact Support */}
                <div className="bg-gradient-to-br from-zinc-900 to-zinc-800 dark:from-zinc-800 dark:to-zinc-900 rounded-3xl p-8 text-center">
                    <div className="w-16 h-16 rounded-2xl bg-white/10 flex items-center justify-center mx-auto mb-4">
                        <MessageCircle size={32} className="text-white" />
                    </div>
                    <h2 className="text-xl font-bold text-white mb-2">Still Need Help?</h2>
                    <p className="text-zinc-400 mb-6 max-w-md mx-auto">
                        If you're having trouble reaching an organizer or have questions about our platform, our support team is here to help.
                    </p>
                    <div className="flex flex-wrap justify-center gap-4">
                        <Link 
                            to="/contact" 
                            className="inline-flex items-center gap-2 px-6 py-3 bg-white text-zinc-900 rounded-full font-bold text-sm hover:bg-zinc-100 transition-colors"
                        >
                            <Mail size={16} /> Contact Support
                        </Link>
                        <a 
                            href="mailto:support@openticket.com" 
                            className="inline-flex items-center gap-2 px-6 py-3 bg-white/10 text-white rounded-full font-bold text-sm hover:bg-white/20 transition-colors"
                        >
                            support@openticket.com
                        </a>
                    </div>
                </div>
            </div>
        </div>
    );
};

export default RefundsPage;
