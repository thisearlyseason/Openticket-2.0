import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { StorageService } from '../services/storageService';
import { Button, Input, Card } from './UI';
import { 
    Building2, Users, Calendar, Globe, Heart, Upload, 
    ChevronRight, ChevronLeft, Check, AlertCircle, Loader2,
    Sparkles, Music, Briefcase, GraduationCap, Dumbbell
} from 'lucide-react';
import type { User } from '../types';

interface OnboardingQuestion {
    id: string;
    question: string;
    type: 'single' | 'multi' | 'text' | 'file';
    options?: { value: string; label: string; icon?: React.ReactNode }[];
    required?: boolean;
    showIf?: (responses: Record<string, any>) => boolean;
}

const ONBOARDING_QUESTIONS: OnboardingQuestion[] = [
    {
        id: 'organizationType',
        question: 'What type of organization are you?',
        type: 'single',
        required: true,
        options: [
            { value: 'individual', label: 'Individual / Solo Creator', icon: <Users size={20} /> },
            { value: 'business', label: 'Business / Company', icon: <Building2 size={20} /> },
            { value: 'nonprofit', label: 'Non-Profit Organization', icon: <Heart size={20} /> },
            { value: 'education', label: 'Educational Institution', icon: <GraduationCap size={20} /> },
        ]
    },
    {
        id: 'eventTypes',
        question: 'What types of events do you plan to host?',
        type: 'multi',
        required: true,
        options: [
            { value: 'concerts', label: 'Concerts & Music', icon: <Music size={20} /> },
            { value: 'conferences', label: 'Conferences & Seminars', icon: <Briefcase size={20} /> },
            { value: 'workshops', label: 'Workshops & Classes', icon: <GraduationCap size={20} /> },
            { value: 'sports', label: 'Sports & Fitness', icon: <Dumbbell size={20} /> },
            { value: 'community', label: 'Community & Social', icon: <Users size={20} /> },
            { value: 'fundraising', label: 'Fundraising & Charity', icon: <Heart size={20} /> },
            { value: 'other', label: 'Other', icon: <Sparkles size={20} /> },
        ]
    },
    {
        id: 'expectedEvents',
        question: 'How many events do you expect to host per year?',
        type: 'single',
        required: true,
        options: [
            { value: '1-5', label: '1-5 events' },
            { value: '6-20', label: '6-20 events' },
            { value: '21-50', label: '21-50 events' },
            { value: '50+', label: '50+ events' },
        ]
    },
    {
        id: 'expectedAttendees',
        question: 'What\'s your typical event size?',
        type: 'single',
        required: true,
        options: [
            { value: 'small', label: 'Small (under 50 attendees)' },
            { value: 'medium', label: 'Medium (50-200 attendees)' },
            { value: 'large', label: 'Large (200-1000 attendees)' },
            { value: 'xlarge', label: 'Very Large (1000+ attendees)' },
        ]
    },
    {
        id: 'primaryGoal',
        question: 'What\'s your primary goal with OpenTicket?',
        type: 'single',
        required: true,
        options: [
            { value: 'sell-tickets', label: 'Sell tickets and manage registrations' },
            { value: 'free-events', label: 'Manage free events and RSVPs' },
            { value: 'fundraising', label: 'Raise funds for a cause' },
            { value: 'all', label: 'All of the above' },
        ]
    },
    {
        id: 'heardFrom',
        question: 'How did you hear about OpenTicket?',
        type: 'single',
        options: [
            { value: 'search', label: 'Search Engine (Google, etc.)' },
            { value: 'social', label: 'Social Media' },
            { value: 'friend', label: 'Friend or Colleague' },
            { value: 'event', label: 'Attended an OpenTicket event' },
            { value: 'other', label: 'Other' },
        ]
    },
];

// Non-profit specific questions
const NONPROFIT_QUESTIONS: OnboardingQuestion[] = [
    {
        id: 'nonprofitName',
        question: 'What is your non-profit organization\'s legal name?',
        type: 'text',
        required: true,
        showIf: (r) => r.organizationType === 'nonprofit'
    },
    {
        id: 'nonprofitEin',
        question: 'EIN / Tax ID Number (optional)',
        type: 'text',
        required: false,
        showIf: (r) => r.organizationType === 'nonprofit'
    },
    {
        id: 'nonprofitDescription',
        question: 'Briefly describe your organization\'s mission',
        type: 'text',
        required: true,
        showIf: (r) => r.organizationType === 'nonprofit'
    },
];

interface OnboardingProps {
    user: User;
    onComplete: () => void;
}

export const Onboarding: React.FC<OnboardingProps> = ({ user, onComplete }) => {
    const navigate = useNavigate();
    const [currentStep, setCurrentStep] = useState(0);
    const [responses, setResponses] = useState<Record<string, any>>({});
    const [isSubmitting, setIsSubmitting] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const [nonprofitDocUrl, setNonprofitDocUrl] = useState<string | null>(null);
    const [uploadingDoc, setUploadingDoc] = useState(false);

    // Combine all questions, filtering by conditions
    const allQuestions = [...ONBOARDING_QUESTIONS, ...NONPROFIT_QUESTIONS].filter(q => 
        !q.showIf || q.showIf(responses)
    );

    const currentQuestion = allQuestions[currentStep];
    const totalSteps = allQuestions.length;
    const isLastStep = currentStep === totalSteps - 1;
    const isNonprofit = responses.organizationType === 'nonprofit';

    // Check if current question is answered
    const isCurrentAnswered = () => {
        if (!currentQuestion) return false;
        const answer = responses[currentQuestion.id];
        if (currentQuestion.required) {
            if (currentQuestion.type === 'multi') {
                return Array.isArray(answer) && answer.length > 0;
            }
            return answer !== undefined && answer !== '';
        }
        return true;
    };

    const handleSingleSelect = (value: string) => {
        setResponses(prev => ({ ...prev, [currentQuestion.id]: value }));
    };

    const handleMultiSelect = (value: string) => {
        setResponses(prev => {
            const current = prev[currentQuestion.id] || [];
            if (current.includes(value)) {
                return { ...prev, [currentQuestion.id]: current.filter((v: string) => v !== value) };
            }
            return { ...prev, [currentQuestion.id]: [...current, value] };
        });
    };

    const handleTextInput = (value: string) => {
        setResponses(prev => ({ ...prev, [currentQuestion.id]: value }));
    };

    const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        if (!file) return;

        setUploadingDoc(true);
        setError(null);

        try {
            const token = await StorageService.getAuthToken();
            
            // Upload to Supabase storage via API
            const formData = new FormData();
            formData.append('file', file);
            formData.append('type', 'nonprofit-verification');

            const response = await fetch('/api/upload/document', {
                method: 'POST',
                headers: {
                    'Authorization': `Bearer ${token}`
                },
                body: formData,
            });

            if (!response.ok) {
                const errorData = await response.json();
                throw new Error(errorData.error || 'Failed to upload document');
            }

            const data = await response.json();
            setNonprofitDocUrl(data.url);
            setResponses(prev => ({ ...prev, nonprofitDocUrl: data.url }));
        } catch (err: any) {
            setError(err.message || 'Failed to upload document');
        } finally {
            setUploadingDoc(false);
        }
    };

    const handleNext = () => {
        if (currentStep < totalSteps - 1) {
            setCurrentStep(prev => prev + 1);
        }
    };

    const handleBack = () => {
        if (currentStep > 0) {
            setCurrentStep(prev => prev - 1);
        }
    };

    const handleSubmit = async () => {
        setIsSubmitting(true);
        setError(null);

        try {
            const token = await StorageService.getAuthToken();

            if (isNonprofit) {
                // Submit non-profit application
                const response = await fetch('/api/onboarding/nonprofit/apply', {
                    method: 'POST',
                    headers: {
                        'Content-Type': 'application/json',
                        'Authorization': `Bearer ${token}`
                    },
                    body: JSON.stringify({
                        organizationName: responses.nonprofitName,
                        ein: responses.nonprofitEin,
                        documentUrl: nonprofitDocUrl || responses.nonprofitDocUrl || '',
                        description: responses.nonprofitDescription,
                        onboardingResponses: responses
                    })
                });

                if (!response.ok) {
                    const data = await response.json();
                    throw new Error(data.error || 'Failed to submit non-profit application');
                }
            } else {
                // Save regular onboarding
                const response = await fetch('/api/onboarding/save', {
                    method: 'POST',
                    headers: {
                        'Content-Type': 'application/json',
                        'Authorization': `Bearer ${token}`
                    },
                    body: JSON.stringify({
                        responses,
                        organizationType: responses.organizationType,
                        completedAt: new Date().toISOString()
                    })
                });

                if (!response.ok) {
                    const data = await response.json();
                    throw new Error(data.error || 'Failed to save onboarding');
                }
            }

            onComplete();
        } catch (err: any) {
            setError(err.message || 'An error occurred');
        } finally {
            setIsSubmitting(false);
        }
    };

    const renderQuestion = () => {
        if (!currentQuestion) return null;

        switch (currentQuestion.type) {
            case 'single':
                return (
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                        {currentQuestion.options?.map(option => (
                            <button
                                key={option.value}
                                onClick={() => handleSingleSelect(option.value)}
                                className={`p-4 rounded-xl border-2 text-left transition-all flex items-center gap-3 ${
                                    responses[currentQuestion.id] === option.value
                                        ? 'border-primary bg-primary/10 text-primary'
                                        : 'border-zinc-200 dark:border-zinc-700 hover:border-zinc-300 dark:hover:border-zinc-600'
                                }`}
                            >
                                {option.icon && <span className="text-zinc-500">{option.icon}</span>}
                                <span className="font-medium">{option.label}</span>
                                {responses[currentQuestion.id] === option.value && (
                                    <Check size={18} className="ml-auto text-primary" />
                                )}
                            </button>
                        ))}
                    </div>
                );

            case 'multi':
                const selectedValues = responses[currentQuestion.id] || [];
                return (
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                        {currentQuestion.options?.map(option => (
                            <button
                                key={option.value}
                                onClick={() => handleMultiSelect(option.value)}
                                className={`p-4 rounded-xl border-2 text-left transition-all flex items-center gap-3 ${
                                    selectedValues.includes(option.value)
                                        ? 'border-primary bg-primary/10 text-primary'
                                        : 'border-zinc-200 dark:border-zinc-700 hover:border-zinc-300 dark:hover:border-zinc-600'
                                }`}
                            >
                                {option.icon && <span className="text-zinc-500">{option.icon}</span>}
                                <span className="font-medium">{option.label}</span>
                                {selectedValues.includes(option.value) && (
                                    <Check size={18} className="ml-auto text-primary" />
                                )}
                            </button>
                        ))}
                    </div>
                );

            case 'text':
                return (
                    <Input
                        value={responses[currentQuestion.id] || ''}
                        onChange={e => handleTextInput(e.target.value)}
                        placeholder="Type your answer..."
                        className="text-lg"
                    />
                );

            default:
                return null;
        }
    };

    // Non-profit document upload section (shown after non-profit questions)
    const renderNonprofitUpload = () => {
        if (!isNonprofit || !isLastStep) return null;

        return (
            <div className="mt-8 p-6 bg-amber-50 dark:bg-amber-900/20 rounded-2xl border border-amber-200 dark:border-amber-800">
                <h3 className="font-bold text-amber-800 dark:text-amber-300 mb-2 flex items-center gap-2">
                    <Upload size={20} />
                    Non-Profit Verification Document
                </h3>
                <p className="text-sm text-amber-700 dark:text-amber-400 mb-4">
                    Please upload a document verifying your non-profit status (501(c)(3) letter, registration certificate, etc.)
                </p>
                
                <label className="flex flex-col items-center justify-center w-full h-32 border-2 border-dashed border-amber-300 dark:border-amber-700 rounded-xl cursor-pointer hover:bg-amber-100 dark:hover:bg-amber-900/40 transition-colors">
                    <input
                        type="file"
                        className="hidden"
                        accept=".pdf,.png,.jpg,.jpeg"
                        onChange={handleFileUpload}
                        disabled={uploadingDoc}
                    />
                    {uploadingDoc ? (
                        <div className="flex items-center gap-2 text-amber-600">
                            <Loader2 size={24} className="animate-spin" />
                            <span>Uploading...</span>
                        </div>
                    ) : nonprofitDocUrl ? (
                        <div className="flex items-center gap-2 text-green-600">
                            <Check size={24} />
                            <span>Document uploaded successfully</span>
                        </div>
                    ) : (
                        <div className="flex flex-col items-center gap-2 text-amber-600">
                            <Upload size={32} />
                            <span className="text-sm">Click to upload or drag and drop</span>
                            <span className="text-xs text-amber-500">PDF, PNG, JPG (max 10MB)</span>
                        </div>
                    )}
                </label>
            </div>
        );
    };

    return (
        <div className="min-h-screen bg-gradient-to-br from-zinc-50 to-zinc-100 dark:from-zinc-950 dark:to-black flex items-center justify-center p-4">
            <Card className="w-full max-w-2xl p-8">
                {/* Progress Bar */}
                <div className="mb-8">
                    <div className="flex justify-between items-center mb-2">
                        <span className="text-sm font-medium text-zinc-500">
                            Step {currentStep + 1} of {totalSteps}
                        </span>
                        <span className="text-sm font-medium text-zinc-500">
                            {Math.round(((currentStep + 1) / totalSteps) * 100)}%
                        </span>
                    </div>
                    <div className="h-2 bg-zinc-200 dark:bg-zinc-800 rounded-full overflow-hidden">
                        <div 
                            className="h-full bg-gradient-to-r from-primary to-secondary transition-all duration-300"
                            style={{ width: `${((currentStep + 1) / totalSteps) * 100}%` }}
                        />
                    </div>
                </div>

                {/* Question */}
                {currentQuestion && (
                    <div className="mb-8">
                        <h2 className="text-2xl font-bold text-zinc-900 dark:text-white mb-2">
                            {currentQuestion.question}
                        </h2>
                        {currentQuestion.type === 'multi' && (
                            <p className="text-sm text-zinc-500">Select all that apply</p>
                        )}
                    </div>
                )}

                {/* Options */}
                {renderQuestion()}

                {/* Non-profit upload */}
                {renderNonprofitUpload()}

                {/* Error */}
                {error && (
                    <div className="mt-4 p-4 bg-red-50 dark:bg-red-900/20 rounded-xl flex items-center gap-3 text-red-600 dark:text-red-400">
                        <AlertCircle size={20} />
                        <span>{error}</span>
                    </div>
                )}

                {/* Navigation */}
                <div className="flex justify-between items-center mt-8 pt-6 border-t border-zinc-200 dark:border-zinc-800">
                    <Button
                        onClick={handleBack}
                        disabled={currentStep === 0}
                        className="bg-transparent border-zinc-300 text-zinc-600 hover:bg-zinc-100 dark:border-zinc-700 dark:text-zinc-400 dark:hover:bg-zinc-800"
                    >
                        <ChevronLeft size={18} className="mr-1" />
                        Back
                    </Button>

                    {isLastStep ? (
                        <Button
                            onClick={handleSubmit}
                            disabled={!isCurrentAnswered() || isSubmitting || (isNonprofit && !nonprofitDocUrl)}
                            className="bg-gradient-to-r from-primary to-secondary text-white border-none"
                        >
                            {isSubmitting ? (
                                <>
                                    <Loader2 size={18} className="mr-2 animate-spin" />
                                    {isNonprofit ? 'Submitting Application...' : 'Finishing...'}
                                </>
                            ) : (
                                <>
                                    {isNonprofit ? 'Submit Non-Profit Application' : 'Complete Setup'}
                                    <Check size={18} className="ml-2" />
                                </>
                            )}
                        </Button>
                    ) : (
                        <Button
                            onClick={handleNext}
                            disabled={!isCurrentAnswered()}
                            className="bg-primary text-white border-none"
                        >
                            Continue
                            <ChevronRight size={18} className="ml-1" />
                        </Button>
                    )}
                </div>
            </Card>
        </div>
    );
};

/**
 * Non-Profit Pending Banner - Shown when awaiting approval
 */
export const NonprofitPendingBanner: React.FC<{ onDismiss?: () => void }> = ({ onDismiss }) => {
    return (
        <div className="bg-amber-50 dark:bg-amber-900/30 border-b border-amber-200 dark:border-amber-800 px-4 py-3">
            <div className="max-w-7xl mx-auto flex items-center justify-between gap-4">
                <div className="flex items-center gap-3">
                    <div className="p-2 bg-amber-100 dark:bg-amber-800/50 rounded-full">
                        <Heart size={18} className="text-amber-600 dark:text-amber-400" />
                    </div>
                    <div>
                        <p className="font-bold text-amber-800 dark:text-amber-300 text-sm">
                            Awaiting Non-Profit Status Approval
                        </p>
                        <p className="text-xs text-amber-600 dark:text-amber-400">
                            You will receive an update within 24 hours after non-profit status confirmation.
                        </p>
                    </div>
                </div>
                {onDismiss && (
                    <button onClick={onDismiss} className="text-amber-600 hover:text-amber-800">
                        &times;
                    </button>
                )}
            </div>
        </div>
    );
};

/**
 * Non-Profit Submission Modal - Shown after submitting application
 */
export const NonprofitSubmissionModal: React.FC<{ isOpen: boolean; onClose: () => void }> = ({ isOpen, onClose }) => {
    if (!isOpen) return null;

    return (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
            <div className="bg-white dark:bg-zinc-900 rounded-2xl max-w-md w-full p-8 text-center">
                <div className="w-16 h-16 bg-green-100 dark:bg-green-900/30 rounded-full flex items-center justify-center mx-auto mb-6">
                    <Check size={32} className="text-green-600" />
                </div>
                <h2 className="text-2xl font-bold text-zinc-900 dark:text-white mb-4">
                    Application Submitted!
                </h2>
                <p className="text-zinc-600 dark:text-zinc-400 mb-6">
                    You will receive an update within <strong>24 hours</strong> after non-profit status confirmation. 
                    In the meantime, you can start exploring OpenTicket with our Free plan.
                </p>
                <Button onClick={onClose} className="w-full bg-primary text-white border-none">
                    Go to Dashboard
                </Button>
            </div>
        </div>
    );
};

/**
 * Non-Profit Rejected Banner with Re-submit Option
 */
export const NonprofitRejectedBanner: React.FC<{ 
    rejectionReason?: string;
    onResubmit: () => void;
}> = ({ rejectionReason, onResubmit }) => {
    return (
        <div className="bg-red-50 dark:bg-red-900/30 border-b border-red-200 dark:border-red-800 px-4 py-3">
            <div className="max-w-7xl mx-auto flex items-center justify-between gap-4">
                <div className="flex items-center gap-3">
                    <div className="p-2 bg-red-100 dark:bg-red-800/50 rounded-full">
                        <AlertCircle size={18} className="text-red-600 dark:text-red-400" />
                    </div>
                    <div>
                        <p className="font-bold text-red-800 dark:text-red-300 text-sm">
                            Non-Profit Application Rejected
                        </p>
                        <p className="text-xs text-red-600 dark:text-red-400">
                            {rejectionReason || 'Your application did not meet our verification requirements.'}
                        </p>
                    </div>
                </div>
                <Button 
                    onClick={onResubmit}
                    className="bg-red-600 hover:bg-red-700 text-white border-none text-sm px-4 py-2"
                >
                    Re-submit Application
                </Button>
            </div>
        </div>
    );
};

/**
 * Non-Profit Re-submit Form - For rejected applications
 */
interface ResubmitFormProps {
    user: User;
    previousApplication?: any;
    onComplete: () => void;
    onCancel: () => void;
}

export const NonprofitResubmitForm: React.FC<ResubmitFormProps> = ({ 
    user, 
    previousApplication,
    onComplete, 
    onCancel 
}) => {
    const [organizationName, setOrganizationName] = useState(previousApplication?.organization_name || '');
    const [ein, setEin] = useState(previousApplication?.ein || '');
    const [description, setDescription] = useState(previousApplication?.description || '');
    const [documentUrl, setDocumentUrl] = useState<string | null>(null);
    const [uploading, setUploading] = useState(false);
    const [submitting, setSubmitting] = useState(false);
    const [error, setError] = useState<string | null>(null);

    const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        if (!file) return;

        setUploading(true);
        setError(null);

        try {
            const token = await StorageService.getAuthToken();
            
            const formData = new FormData();
            formData.append('file', file);
            formData.append('type', 'nonprofit-verification');

            const response = await fetch('/api/upload/document', {
                method: 'POST',
                headers: {
                    'Authorization': `Bearer ${token}`
                },
                body: formData,
            });

            if (!response.ok) {
                const errorData = await response.json();
                throw new Error(errorData.error || 'Failed to upload document');
            }

            const data = await response.json();
            setDocumentUrl(data.url);
        } catch (err: any) {
            setError(err.message || 'Failed to upload document');
        } finally {
            setUploading(false);
        }
    };

    const handleSubmit = async () => {
        if (!organizationName || !documentUrl) {
            setError('Please fill in all required fields and upload a verification document.');
            return;
        }

        setSubmitting(true);
        setError(null);

        try {
            const token = await StorageService.getAuthToken();
            
            const response = await fetch('/api/onboarding/nonprofit/resubmit', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${token}`
                },
                body: JSON.stringify({
                    organizationName,
                    ein,
                    documentUrl,
                    description
                })
            });

            if (!response.ok) {
                const data = await response.json();
                throw new Error(data.error || 'Failed to resubmit application');
            }

            onComplete();
        } catch (err: any) {
            setError(err.message || 'An error occurred');
        } finally {
            setSubmitting(false);
        }
    };

    return (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4 overflow-y-auto">
            <Card className="w-full max-w-lg p-6">
                <h2 className="text-xl font-bold text-zinc-900 dark:text-white mb-2">
                    Re-submit Non-Profit Application
                </h2>
                <p className="text-sm text-zinc-500 mb-6">
                    Please provide updated information and documentation for verification.
                </p>

                {previousApplication?.rejection_reason && (
                    <div className="mb-6 p-4 bg-red-50 dark:bg-red-900/20 rounded-xl border border-red-200 dark:border-red-800">
                        <p className="text-sm font-bold text-red-700 dark:text-red-400 mb-1">Previous Rejection Reason:</p>
                        <p className="text-sm text-red-600 dark:text-red-300">{previousApplication.rejection_reason}</p>
                    </div>
                )}

                <div className="space-y-4">
                    <Input
                        label="Organization Name *"
                        value={organizationName}
                        onChange={(e) => setOrganizationName(e.target.value)}
                        placeholder="Your non-profit's legal name"
                    />

                    <Input
                        label="EIN / Tax ID (optional)"
                        value={ein}
                        onChange={(e) => setEin(e.target.value)}
                        placeholder="XX-XXXXXXX"
                    />

                    <div>
                        <label className="block text-sm font-medium text-zinc-700 dark:text-zinc-300 mb-2">
                            Mission Description
                        </label>
                        <textarea
                            value={description}
                            onChange={(e) => setDescription(e.target.value)}
                            placeholder="Briefly describe your organization's mission..."
                            className="w-full bg-zinc-50 dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-700 rounded-xl p-3 text-zinc-900 dark:text-white resize-none h-24"
                        />
                    </div>

                    {/* Document Upload */}
                    <div>
                        <label className="block text-sm font-medium text-zinc-700 dark:text-zinc-300 mb-2">
                            Verification Document * <span className="text-zinc-400 font-normal">(501(c)(3) letter, registration, etc.)</span>
                        </label>
                        <label className="flex flex-col items-center justify-center w-full h-28 border-2 border-dashed border-zinc-300 dark:border-zinc-700 rounded-xl cursor-pointer hover:bg-zinc-50 dark:hover:bg-zinc-800 transition-colors">
                            <input
                                type="file"
                                className="hidden"
                                accept=".pdf,.png,.jpg,.jpeg"
                                onChange={handleFileUpload}
                                disabled={uploading}
                            />
                            {uploading ? (
                                <div className="flex items-center gap-2 text-zinc-500">
                                    <Loader2 size={20} className="animate-spin" />
                                    <span>Uploading...</span>
                                </div>
                            ) : documentUrl ? (
                                <div className="flex items-center gap-2 text-green-600">
                                    <Check size={20} />
                                    <span>Document uploaded</span>
                                </div>
                            ) : (
                                <div className="flex flex-col items-center gap-1 text-zinc-500">
                                    <Upload size={24} />
                                    <span className="text-sm">Click to upload</span>
                                    <span className="text-xs">PDF, PNG, JPG (max 10MB)</span>
                                </div>
                            )}
                        </label>
                    </div>
                </div>

                {error && (
                    <div className="mt-4 p-3 bg-red-50 dark:bg-red-900/20 rounded-lg flex items-center gap-2 text-red-600 dark:text-red-400 text-sm">
                        <AlertCircle size={16} />
                        {error}
                    </div>
                )}

                <div className="flex gap-3 mt-6">
                    <Button
                        onClick={onCancel}
                        className="flex-1 bg-zinc-100 dark:bg-zinc-800 text-zinc-700 dark:text-zinc-300 border-none"
                    >
                        Cancel
                    </Button>
                    <Button
                        onClick={handleSubmit}
                        disabled={submitting || !organizationName || !documentUrl}
                        className="flex-1 bg-primary text-white border-none disabled:opacity-50"
                    >
                        {submitting ? (
                            <>
                                <Loader2 size={16} className="mr-2 animate-spin" />
                                Submitting...
                            </>
                        ) : (
                            'Re-submit Application'
                        )}
                    </Button>
                </div>
            </Card>
        </div>
    );
};

export default Onboarding;
