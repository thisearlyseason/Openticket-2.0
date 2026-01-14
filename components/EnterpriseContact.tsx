import React, { useState } from 'react';
import { Building2, Mail, Phone, Users, Zap, CheckCircle, ArrowRight } from 'lucide-react';
import { Button, Card, Input, RichTextarea } from './UI';
import { StorageService } from '../services/storageService';

interface EnterpriseContactProps {
    defaultMessage?: string;
    source?: 'pricing' | 'limit_reached' | 'manual';
    onClose?: () => void;
}

export const EnterpriseContact: React.FC<EnterpriseContactProps> = ({ 
    defaultMessage = '', 
    source = 'manual',
    onClose 
}) => {
    const [formData, setFormData] = useState({
        name: '',
        email: '',
        company: '',
        phone: '',
        expectedTickets: '',
        expectedEvents: '',
        message: defaultMessage
    });
    const [isSubmitting, setIsSubmitting] = useState(false);
    const [isSubmitted, setIsSubmitted] = useState(false);
    const [error, setError] = useState('');

    const currentUser = StorageService.getCurrentUser();

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        setIsSubmitting(true);
        setError('');

        try {
            const token = await StorageService.getAuthToken();
            const response = await fetch('/api/enterprise/contact', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${token}`
                },
                body: JSON.stringify({
                    ...formData,
                    userId: currentUser?.id,
                    source,
                    submittedAt: new Date().toISOString()
                })
            });

            if (response.ok) {
                setIsSubmitted(true);
            } else {
                const data = await response.json();
                setError(data.error || 'Failed to submit request');
            }
        } catch (err) {
            setError('Network error. Please try again.');
        } finally {
            setIsSubmitting(false);
        }
    };

    if (isSubmitted) {
        return (
            <Card className="max-w-2xl mx-auto p-8">
                <div className="text-center">
                    <div className="w-20 h-20 bg-green-100 dark:bg-green-900/30 rounded-full flex items-center justify-center mx-auto mb-6">
                        <CheckCircle size={48} className="text-green-500" />
                    </div>
                    <h2 className="text-3xl font-bold text-zinc-900 dark:text-white mb-4">
                        Thank You!
                    </h2>
                    <p className="text-lg text-zinc-600 dark:text-zinc-400 mb-6">
                        Our enterprise team will contact you within 24 hours to discuss a custom solution.
                    </p>
                    {onClose && (
                        <Button onClick={onClose} variant="outline">
                            Close
                        </Button>
                    )}
                </div>
            </Card>
        );
    }

    return (
        <div className="max-w-6xl mx-auto py-12 px-4">
            <div className="text-center mb-12">
                <h1 className="text-4xl md:text-5xl font-black text-zinc-900 dark:text-white mb-4">
                    Enterprise Solutions
                </h1>
                <p className="text-xl text-zinc-600 dark:text-zinc-400">
                    Custom plans for high-volume events and organizations
                </p>
            </div>

            <div className="grid md:grid-cols-2 gap-8 mb-12">
                <Card className="p-8">
                    <h3 className="text-2xl font-bold text-zinc-900 dark:text-white mb-6">
                        Enterprise Includes:
                    </h3>
                    <ul className="space-y-4">
                        {[
                            'Unlimited Events & Tickets',
                            'Custom Pricing & Fee Structure',
                            'Dedicated Account Manager',
                            'Priority 24/7 Support',
                            'White Label Solutions',
                            'SLA Guarantees',
                            'Flexible Payout Options'
                        ].map((feature, idx) => (
                            <li key={idx} className="flex items-start gap-3">
                                <CheckCircle size={20} className="text-primary shrink-0 mt-0.5" />
                                <span className="text-zinc-700 dark:text-zinc-300">{feature}</span>
                            </li>
                        ))}
                    </ul>
                </Card>

                <Card className="p-8">
                    <h3 className="text-2xl font-bold text-zinc-900 dark:text-white mb-6">
                        Contact Sales
                    </h3>
                    <form onSubmit={handleSubmit} className="space-y-4">
                        <Input
                            label="Full Name"
                            required
                            value={formData.name}
                            onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                            placeholder="John Doe"
                        />
                        <Input
                            label="Email"
                            type="email"
                            required
                            value={formData.email}
                            onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                            placeholder="john@company.com"
                        />
                        <Input
                            label="Company / Organization"
                            required
                            value={formData.company}
                            onChange={(e) => setFormData({ ...formData, company: e.target.value })}
                            placeholder="Acme Corp"
                        />
                        <Input
                            label="Phone (Optional)"
                            type="tel"
                            value={formData.phone}
                            onChange={(e) => setFormData({ ...formData, phone: e.target.value })}
                            placeholder="+1 (555) 123-4567"
                        />
                        <Input
                            label="Expected Monthly Tickets"
                            type="number"
                            value={formData.expectedTickets}
                            onChange={(e) => setFormData({ ...formData, expectedTickets: e.target.value })}
                            placeholder="10,000+"
                        />
                        <Input
                            label="Expected Monthly Events"
                            type="number"
                            value={formData.expectedEvents}
                            onChange={(e) => setFormData({ ...formData, expectedEvents: e.target.value })}
                            placeholder="50+"
                        />
                        <RichTextarea
                            label="Tell us about your needs"
                            value={formData.message}
                            onChange={(e) => setFormData({ ...formData, message: e.target.value })}
                            placeholder="What are your specific requirements?"
                            rows={4}
                        />
                        
                        {error && (
                            <div className="p-3 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg">
                                <p className="text-sm text-red-600 dark:text-red-400">{error}</p>
                            </div>
                        )}

                        <Button type="submit" className="w-full" disabled={isSubmitting}>
                            {isSubmitting ? 'Submitting...' : 'Submit Request'}
                            <ArrowRight size={18} className="ml-2" />
                        </Button>
                    </form>
                </Card>
            </div>

            <Card className="p-8 bg-gradient-to-r from-primary/10 to-secondary/10 border-2 border-primary/20">
                <div className="grid md:grid-cols-3 gap-8 text-center">
                    <div>
                        <Zap size={48} className="text-primary mx-auto mb-4" />
                        <h4 className="text-xl font-bold text-zinc-900 dark:text-white mb-2">
                            Fast Setup
                        </h4>
                        <p className="text-zinc-600 dark:text-zinc-400">
                            Get started within 24-48 hours
                        </p>
                    </div>
                    <div>
                        <Users size={48} className="text-primary mx-auto mb-4" />
                        <h4 className="text-xl font-bold text-zinc-900 dark:text-white mb-2">
                            Dedicated Support
                        </h4>
                        <p className="text-zinc-600 dark:text-zinc-400">
                            Personal account manager assigned
                        </p>
                    </div>
                    <div>
                        <Building2 size={48} className="text-primary mx-auto mb-4" />
                        <h4 className="text-xl font-bold text-zinc-900 dark:text-white mb-2">
                            Scalable
                        </h4>
                        <p className="text-zinc-600 dark:text-zinc-400">
                            Grows with your business
                        </p>
                    </div>
                </div>
            </Card>
        </div>
    );
};
