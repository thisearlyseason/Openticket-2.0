
import React from 'react';
import { Shield } from 'lucide-react';
import { Card } from './UI';

export const Terms = () => {
    return (
        <div className="max-w-4xl mx-auto py-12 px-4">
            <div className="flex items-center gap-4 mb-8">
                <div className="w-16 h-16 bg-zinc-900 rounded-2xl flex items-center justify-center border border-zinc-800 text-[#E0FF20]">
                    <Shield size={32} />
                </div>
                <div>
                    <h1 className="text-4xl font-black text-zinc-900 dark:text-white font-display uppercase">Terms of Service</h1>
                    <p className="text-zinc-500">Last updated: {new Date().toLocaleDateString()}</p>
                </div>
            </div>

            <Card className="p-8 prose prose-zinc dark:prose-invert max-w-none">
                <h3>1. Introduction</h3>
                <p>Welcome to OpenTicket. By accessing or using our platform, you agree to be bound by these Terms of Service. If you disagree with any part of the terms, you may not access the service.</p>

                <h3>2. Acceptable Use</h3>
                <p>You agree not to use OpenTicket for any unlawful purpose or any purpose prohibited under this clause. You agree not to use the platform in any way that could damage the platform, the services, or the general business of OpenTicket.</p>
                <ul>
                    <li>You must not organize events that promote illegal activities, hate speech, or violence.</li>
                    <li>You must not use the platform to distribute spam or malicious content.</li>
                    <li>You are responsible for the content of your event pages.</li>
                </ul>

                <h3>3. Event Organizer Responsibilities</h3>
                <p>As an organizer, you are solely responsible for:</p>
                <ul>
                    <li>Ensuring the accuracy of your event details.</li>
                    <li>Processing refunds in accordance with your stated policy.</li>
                    <li>Compliance with all local laws regarding your event.</li>
                </ul>

                <h3>4. Payments & Fees</h3>
                <p>OpenTicket facilitates payments through third-party processors (Stripe, PayPal, Square). We are not responsible for payment processing errors caused by these third parties.</p>

                <h3>5. Content Moderation</h3>
                <p>We reserve the right to remove any event that violates our safety policies or terms of service without prior notice. Serious violations may result in account suspension.</p>

                <h3>6. Limitation of Liability</h3>
                <p>OpenTicket is provided "as is". We are not liable for any damages arising from your use of the platform, including but not limited to direct, indirect, incidental, punitive, and consequential damages.</p>

                <h3>7. Changes to Terms</h3>
                <p>We reserve the right to modify these terms at any time. We will do our best to notify users of any significant changes.</p>
            </Card>
        </div>
    );
};
