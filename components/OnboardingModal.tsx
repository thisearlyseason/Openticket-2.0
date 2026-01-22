import React, { useState } from 'react';
import { Briefcase, Calendar, Users, Building2, HelpCircle, MessageSquare } from 'lucide-react';
import { Button, Input, Card } from './UI';
import { StorageService } from '../services/storageService';

interface OnboardingModalProps {
    isOpen: boolean;
    onComplete: () => void;
    userEmail: string;
}

const OnboardingModal: React.FC<OnboardingModalProps> = ({ isOpen, onComplete, userEmail }) => {
    const [businessName, setBusinessName] = useState('');
    const [businessType, setBusinessType] = useState('');
    const [eventTypes, setEventTypes] = useState<string[]>([]);
    const [teamSize, setTeamSize] = useState('');
    const [heardFrom, setHeardFrom] = useState('');
    const [suggestions, setSuggestions] = useState('');
    const [isSubmitting, setIsSubmitting] = useState(false);
    const [error, setError] = useState('');

    const businessTypeOptions = [
        { value: 'nonprofit', label: 'Non-Profit Organization', icon: Users },
        { value: 'education', label: 'Educational Institution', icon: Building2 },
        { value: 'corporate', label: 'Corporate / Business', icon: Briefcase },
        { value: 'arts', label: 'Arts & Entertainment', icon: Calendar },
        { value: 'sports', label: 'Sports & Recreation', icon: Users },
        { value: 'religious', label: 'Religious Organization', icon: Building2 },
        { value: 'community', label: 'Community Group', icon: Users },
        { value: 'other', label: 'Other', icon: Briefcase }
    ];

    const eventTypeOptions = [
        'Conferences', 'Workshops', 'Concerts', 'Festivals', 'Fundraisers',
        'Sports Events', 'Community Events', 'Classes', 'Meetups', 'Other'
    ];

    const teamSizeOptions = [
        { value: 'solo', label: 'Just me' },
        { value: '2-5', label: '2-5 people' },
        { value: '6-20', label: '6-20 people' },
        { value: '21-50', label: '21-50 people' },
        { value: '50+', label: '50+ people' }
    ];

    const heardFromOptions = [
        { value: 'search', label: 'Search Engine (Google, etc.)' },
        { value: 'social', label: 'Social Media' },
        { value: 'friend', label: 'Friend or Colleague' },
        { value: 'event', label: 'Attended an OpenTicket event' },
        { value: 'ad', label: 'Online Advertisement' },
        { value: 'other', label: 'Other' }
    ];

    const handleEventTypeToggle = (type: string) => {
        if (eventTypes.includes(type)) {
            setEventTypes(eventTypes.filter(t => t !== type));
        } else {
            setEventTypes([...eventTypes, type]);
        }
    };

    const handleSubmit = async () => {
        if (!businessName.trim()) {
            setError('Please enter your organization name');
            return;
        }
        if (!businessType) {
            setError('Please select your organization type');
            return;
        }

        setIsSubmitting(true);
        setError('');

        try {
            // Update user profile with onboarding data
            await StorageService.updateProfile({
                businessName,
                businessType,
                eventTypes: eventTypes.join(','),
                teamSize,
                heardFrom,
                suggestions,
                onboardingCompleted: true,
                onboardingCompletedAt: new Date().toISOString()
            });

            onComplete();
        } catch (err: any) {
            setError(err.message || 'Failed to save onboarding data');
            setIsSubmitting(false);
        }
    };

    if (!isOpen) return null;

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm">
            <Card className="w-full max-w-2xl mx-4 max-h-[90vh] overflow-y-auto">
                {/* Header */}
                <div className="bg-gradient-to-r from-secondary to-primary p-6 rounded-t-2xl">
                    <h2 className="text-2xl font-bold text-black mb-2">
                        🎉 Welcome to OpenTicket!
                    </h2>
                    <p className="text-black/80 text-sm">
                        Let's set up your organizer profile to get started
                    </p>
                </div>

                {/* Content */}
                <div className="p-6 space-y-6">
                    {error && (
                        <div className="bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg p-4 text-red-800 dark:text-red-200 text-sm">
                            {error}
                        </div>
                    )}

                    {/* Business Name */}
                    <div>
                        <label className="block text-sm font-semibold text-zinc-700 dark:text-zinc-300 mb-2">
                            Organization Name <span className="text-red-500">*</span>
                        </label>
                        <Input
                            value={businessName}
                            onChange={(e) => setBusinessName(e.target.value)}
                            placeholder="e.g., Acme Events, Community Center, etc."
                            className="w-full"
                        />
                        <p className="text-xs text-zinc-500 dark:text-zinc-400 mt-1">
                            This will appear on your events and tickets
                        </p>
                    </div>

                    {/* Business Type */}
                    <div>
                        <label className="block text-sm font-semibold text-zinc-700 dark:text-zinc-300 mb-3">
                            Organization Type <span className="text-red-500">*</span>
                        </label>
                        <div className="grid grid-cols-2 gap-3">
                            {businessTypeOptions.map((option) => {
                                const Icon = option.icon;
                                const isSelected = businessType === option.value;
                                return (
                                    <button
                                        key={option.value}
                                        onClick={() => setBusinessType(option.value)}
                                        className={`flex items-center gap-3 p-3 rounded-lg border-2 transition-all ${
                                            isSelected
                                                ? 'border-secondary bg-secondary/10 dark:bg-secondary/20'
                                                : 'border-zinc-200 dark:border-zinc-700 hover:border-zinc-300 dark:hover:border-zinc-600'
                                        }`}
                                    >
                                        <Icon size={20} className={isSelected ? 'text-secondary' : 'text-zinc-400'} />
                                        <span className={`text-sm font-medium ${isSelected ? 'text-secondary' : 'text-zinc-700 dark:text-zinc-300'}`}>
                                            {option.label}
                                        </span>
                                    </button>
                                );
                            })}
                        </div>
                    </div>

                    {/* Team Size - NEW */}
                    <div>
                        <label className="block text-sm font-semibold text-zinc-700 dark:text-zinc-300 mb-3">
                            <Users size={16} className="inline mr-2" />
                            How many people work at your organization?
                        </label>
                        <div className="flex flex-wrap gap-2">
                            {teamSizeOptions.map((option) => {
                                const isSelected = teamSize === option.value;
                                return (
                                    <button
                                        key={option.value}
                                        onClick={() => setTeamSize(option.value)}
                                        className={`px-4 py-2 rounded-full text-sm font-medium transition-all ${
                                            isSelected
                                                ? 'bg-primary text-white'
                                                : 'bg-zinc-100 dark:bg-zinc-800 text-zinc-700 dark:text-zinc-300 hover:bg-zinc-200 dark:hover:bg-zinc-700'
                                        }`}
                                    >
                                        {option.label}
                                    </button>
                                );
                            })}
                        </div>
                    </div>

                    {/* Event Types */}
                    <div>
                        <label className="block text-sm font-semibold text-zinc-700 dark:text-zinc-300 mb-3">
                            What types of events will you host?
                        </label>
                        <div className="flex flex-wrap gap-2">
                            {eventTypeOptions.map((type) => {
                                const isSelected = eventTypes.includes(type);
                                return (
                                    <button
                                        key={type}
                                        onClick={() => handleEventTypeToggle(type)}
                                        className={`px-4 py-2 rounded-full text-sm font-medium transition-all ${
                                            isSelected
                                                ? 'bg-secondary text-black'
                                                : 'bg-zinc-100 dark:bg-zinc-800 text-zinc-700 dark:text-zinc-300 hover:bg-zinc-200 dark:hover:bg-zinc-700'
                                        }`}
                                    >
                                        {type}
                                    </button>
                                );
                            })}
                        </div>
                    </div>

                    {/* How did you hear about us - NEW */}
                    <div>
                        <label className="block text-sm font-semibold text-zinc-700 dark:text-zinc-300 mb-3">
                            <HelpCircle size={16} className="inline mr-2" />
                            Where did you hear about us?
                        </label>
                        <div className="flex flex-wrap gap-2">
                            {heardFromOptions.map((option) => {
                                const isSelected = heardFrom === option.value;
                                return (
                                    <button
                                        key={option.value}
                                        onClick={() => setHeardFrom(option.value)}
                                        className={`px-4 py-2 rounded-full text-sm font-medium transition-all ${
                                            isSelected
                                                ? 'bg-blue-500 text-white'
                                                : 'bg-zinc-100 dark:bg-zinc-800 text-zinc-700 dark:text-zinc-300 hover:bg-zinc-200 dark:hover:bg-zinc-700'
                                        }`}
                                    >
                                        {option.label}
                                    </button>
                                );
                            })}
                        </div>
                    </div>

                    {/* Suggestions - NEW */}
                    <div>
                        <label className="block text-sm font-semibold text-zinc-700 dark:text-zinc-300 mb-2">
                            <MessageSquare size={16} className="inline mr-2" />
                            Any features you'd love to see or suggestions for us?
                        </label>
                        <textarea
                            value={suggestions}
                            onChange={(e) => setSuggestions(e.target.value)}
                            placeholder="We'd love to hear your thoughts..."
                            className="w-full bg-zinc-50 dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-700 rounded-xl p-3 text-zinc-900 dark:text-white resize-none h-20 text-sm"
                        />
                    </div>
                </div>

                {/* Footer */}
                <div className="border-t border-zinc-200 dark:border-zinc-700 p-6 bg-zinc-50 dark:bg-zinc-800/50 rounded-b-2xl">
                    <div className="flex items-center justify-between">
                        <p className="text-xs text-zinc-500 dark:text-zinc-400">
                            You can always update this later in Settings
                        </p>
                        <Button
                            onClick={handleSubmit}
                            disabled={isSubmitting}
                            className="bg-secondary text-black border-none hover:opacity-90 px-6"
                        >
                            {isSubmitting ? 'Saving...' : 'Complete Setup →'}
                        </Button>
                    </div>
                </div>
            </Card>
        </div>
    );
};
export default OnboardingModal;
