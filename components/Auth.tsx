
import React, { useState, useEffect } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { StorageService } from '../services/storageService';
import { Button, Input, Card, Select, FileDropZone } from './UI';
import { User as UserIcon, Briefcase, Calendar, Ticket, Building2, ShieldCheck, Ban, Zap, Chrome, Eye, EyeOff, Check, X } from 'lucide-react';

// Password Input with visibility toggle and validation
const PasswordInput = ({ 
    label, 
    value, 
    onChange, 
    required = false, 
    showValidation = false 
}: { 
    label: string; 
    value: string; 
    onChange: (e: React.ChangeEvent<HTMLInputElement>) => void; 
    required?: boolean;
    showValidation?: boolean;
}) => {
    const [showPassword, setShowPassword] = useState(false);
    
    // Password validation rules
    const validations = {
        minLength: value.length >= 7,
        hasUppercase: /[A-Z]/.test(value),
        hasNumber: /[0-9]/.test(value),
        hasSpecial: /[!@#$%^&*(),.?":{}|<>]/.test(value)
    };
    
    const isValid = validations.minLength && validations.hasUppercase && validations.hasNumber && validations.hasSpecial;
    
    return (
        <div className="space-y-2">
            <label className="block text-xs font-bold text-gray-500 dark:text-zinc-400 uppercase tracking-wide mb-1">
                {label}
            </label>
            <div className="relative">
                <input
                    type={showPassword ? 'text' : 'password'}
                    value={value}
                    onChange={onChange}
                    required={required}
                    className="w-full px-4 py-3 pr-12 bg-zinc-100 dark:bg-zinc-800 border border-zinc-200 dark:border-zinc-700 rounded-xl focus:ring-2 focus:ring-secondary focus:border-transparent outline-none transition-all"
                />
                <button
                    type="button"
                    onClick={() => setShowPassword(!showPassword)}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-zinc-400 hover:text-zinc-600 dark:hover:text-zinc-300 transition-colors"
                >
                    {showPassword ? <EyeOff size={20} /> : <Eye size={20} />}
                </button>
            </div>
            
            {showValidation && value.length > 0 && (
                <div className="mt-2 p-3 bg-zinc-50 dark:bg-zinc-800/50 rounded-lg space-y-1">
                    <div className={`flex items-center gap-2 text-xs ${validations.minLength ? 'text-green-600' : 'text-zinc-400'}`}>
                        {validations.minLength ? <Check size={12} /> : <X size={12} />}
                        <span>At least 7 characters</span>
                    </div>
                    <div className={`flex items-center gap-2 text-xs ${validations.hasUppercase ? 'text-green-600' : 'text-zinc-400'}`}>
                        {validations.hasUppercase ? <Check size={12} /> : <X size={12} />}
                        <span>One uppercase letter</span>
                    </div>
                    <div className={`flex items-center gap-2 text-xs ${validations.hasNumber ? 'text-green-600' : 'text-zinc-400'}`}>
                        {validations.hasNumber ? <Check size={12} /> : <X size={12} />}
                        <span>One number</span>
                    </div>
                    <div className={`flex items-center gap-2 text-xs ${validations.hasSpecial ? 'text-green-600' : 'text-zinc-400'}`}>
                        {validations.hasSpecial ? <Check size={12} /> : <X size={12} />}
                        <span>One special character (!@#$%^&*)</span>
                    </div>
                </div>
            )}
        </div>
    );
};

export const Auth = () => {
    const [searchParams] = useSearchParams();
    const [isLogin, setIsLogin] = useState(true);
    const [step, setStep] = useState(0); // 0 = Role Selection, 1 = Basics, 2 = Onboarding, 3 = Non-Profit (Optional)
    const [role, setRole] = useState<'attendee' | 'organizer'>('attendee');
    const [isLoading, setIsLoading] = useState(false);
    const [findTickets, setFindTickets] = useState(false);
    const [ticketMessage, setTicketMessage] = useState('');
    const navigate = useNavigate();

    // Redirect logged-in users to dashboard
    useEffect(() => {
        const user = StorageService.getCurrentUser();
        if (user) {
            navigate('/dashboard', { replace: true });
        }
    }, [navigate]);

    const handleFindTickets = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!formData.email) return;
        setIsLoading(true);
        // Mock success for now, or call StorageService.sendMagicLink(formData.email)
        // Since we don't have a backend "Send Magic Link" yet, we'll simulate.
        // TODO: Implement StorageService.sendTicketLink(formData.email)
        setTimeout(() => {
            setTicketMessage(`If matched, an access link has been sent to ${formData.email}`);
            setIsLoading(false);
        }, 1500);
    };

    // Form Data
    const [formData, setFormData] = useState({
        name: '',
        email: '',
        password: '',
        businessName: '',
        businessType: '',
        eventTypes: '',
        nonProfitName: '',
        nonProfitEin: '',
        nonProfitDocUrl: ''
    });

    const [error, setError] = useState('');

    // Handle Redirect Param & Referral Code
    const redirectPlan = searchParams.get('plan');
    const referralCode = searchParams.get('ref');

    // Track affiliate click when page loads with referral code
    useEffect(() => {
        if (referralCode) {
            StorageService.trackAffiliateClick('auth-page', referralCode);
        }
    }, [referralCode]);

    const handleLogin = async (e: React.FormEvent) => {
        e.preventDefault();
        setError('');
        setIsLoading(true);
        const { user, error: loginError } = await StorageService.login(formData.email, formData.password);

        if (loginError) {
            setError(loginError);
            setIsLoading(false);
            return;
        }

        if (user) {
            handlePostAuthRedirect(user);
        } else {
            setError('Invalid credentials');
            setIsLoading(false);
        }
    };

    const handleGoogleLogin = async () => {
        setError('');
        setIsLoading(true);
        // Pass the selected role if signing up, otherwise the backend retrieves existing role
        const { user, error: loginError } = await StorageService.loginWithGoogle(isLogin ? undefined : role);

        if (loginError) {
            setError(loginError);
            setIsLoading(false);
            return;
        }

        if (user) {
            handlePostAuthRedirect(user);
        } else {
            setError('Google Login failed.');
            setIsLoading(false);
        }
    };

    const handlePostAuthRedirect = (user: any) => {
        if (redirectPlan) {
            navigate(`/pricing?select=${redirectPlan}`);
        } else {
            if (user.isAdmin) {
                navigate('/admin');
            } else if (user.role === 'organizer') {
                navigate('/dashboard');
            } else if (user.role === 'affiliate') {
                navigate('/affiliate');
            } else {
                navigate('/my-tickets'); // Attendee: Explore is hidden, go to My Tickets
            }
        }
    };

    const handleSignup = async (e: React.FormEvent) => {
        e.preventDefault();
        setError('');

        // Step 1: Credentials
        if (step === 1) {
            if (!formData.name || !formData.email || !formData.password) {
                setError("Please fill all fields");
                return;
            }
            
            // Password validation
            const password = formData.password;
            const validations = {
                minLength: password.length >= 7,
                hasUppercase: /[A-Z]/.test(password),
                hasNumber: /[0-9]/.test(password),
                hasSpecial: /[!@#$%^&*(),.?":{}|<>]/.test(password)
            };
            
            if (!validations.minLength || !validations.hasUppercase || !validations.hasNumber || !validations.hasSpecial) {
                setError("Password must be at least 7 characters with 1 uppercase, 1 number, and 1 special character");
                return;
            }
            
            if (role === 'organizer') {
                setStep(2); // Go to Business Onboarding
            } else {
                await finalizeSignup(); // Create Attendee Account immediately
            }
            return;
        }

        // Step 2: Finalize for Organizer or go to Non-Profit
        if (step === 2) {
            if (formData.businessType === 'nonprofit') {
                setStep(3); // Go to Non-Profit Details
                return;
            }
            await finalizeSignup();
            return;
        }

        // Step 3: Non-Profit Details
        if (step === 3) {
            if (!formData.nonProfitName || !formData.nonProfitEin || !formData.nonProfitDocUrl) {
                setError("Please provide all non-profit verification details.");
                return;
            }
            await finalizeSignup();
        }
    };

    const finalizeSignup = async () => {
        setIsLoading(true);

        // Prepare User Data, inject referral code if present
        const userData: any = {
            ...formData,
            role: role,
            nonProfitStatus: formData.businessType === 'nonprofit' ? 'pending' : null
        };

        if (referralCode) {
            userData.referredBy = referralCode;
        }

        const result = await StorageService.signup(userData);
        if (typeof result === 'string') {
            setError(result);
            setIsLoading(false);
        } else {
            if (redirectPlan) {
                navigate(`/pricing?select=${redirectPlan}`);
            } else {
                navigate(role === 'organizer' ? '/dashboard' : '/my-tickets');
            }
        }
    };

    // Helper to auto-login as Admin
    const loginAsAdmin = async () => {
        setIsLoading(true);
        const { user } = await StorageService.login('admin@openticket.com', 'admin');
        if (user) {
            navigate('/admin');
        }
        else {
            setError("Admin user not found.");
            setIsLoading(false);
        }
    };

    // Helper for Instant Demo Login
    const handleDemoLogin = async () => {
        setIsLoading(true);
        // Try to login as the default demo user created in StorageService.init
        const { user } = await StorageService.login('demo@example.com', 'password');
        if (user) {
            navigate('/dashboard');
        } else {
            // Fallback: If for some reason demo user doesn't exist, create it on the fly
            const demoUser = {
                id: 'user1',
                name: 'Demo Organizer',
                email: 'demo@example.com',
                password: 'password',
                role: 'organizer' as const,
                businessName: 'Demo Corp'
            };
            const result = await StorageService.signup(demoUser);
            if (typeof result !== 'string') {
                navigate('/dashboard');
            } else {
                setError("Could not initialize demo user. Please try standard signup.");
                setIsLoading(false);
            }
        }
    };

    return (
        <div className="max-w-md mx-auto py-20 px-4">
            <Card className="p-8 shadow-[0_0_40px_rgba(224,255,32,0.2)] border-t-4 border-t-secondary">
                <div className="text-center mb-8">
                    <div className="inline-flex items-center justify-center w-12 h-12 rounded-full bg-secondary text-black mb-4">
                        <UserIcon size={24} />
                    </div>
                    <h1 className="text-2xl font-black font-display text-gray-900 dark:text-white uppercase tracking-tight">{isLogin ? 'Welcome Back' : 'Join OpenTicket'}</h1>
                    <p className="text-gray-500 dark:text-zinc-400 mt-2">
                        {isLogin ? 'Sign in to your account.' : step === 0 ? 'How do you want to use OpenTicket?' : 'Create your account.'}
                    </p>
                </div>

                {/* MODE SWITCHER */}
                <div className="flex gap-2 p-1 bg-zinc-100 dark:bg-zinc-800 rounded-xl mb-6">
                    <button onClick={() => { setIsLogin(true); setFindTickets(false); }} className={`flex-1 py-2 text-sm font-bold rounded-lg transition-all ${isLogin && !findTickets ? 'bg-white dark:bg-zinc-700 shadow-sm text-black dark:text-white' : 'text-zinc-500 hover:text-zinc-700 dark:hover:text-zinc-300'}`}>
                        Sign In
                    </button>
                    <button onClick={() => { setIsLogin(false); setFindTickets(false); }} className={`flex-1 py-2 text-sm font-bold rounded-lg transition-all ${!isLogin && !findTickets ? 'bg-white dark:bg-zinc-700 shadow-sm text-black dark:text-white' : 'text-zinc-500 hover:text-zinc-700 dark:hover:text-zinc-300'}`}>
                        Sign Up
                    </button>
                    <button onClick={() => { setFindTickets(true); setIsLogin(false); }} className={`flex-1 py-2 text-sm font-bold rounded-lg transition-all ${findTickets ? 'bg-white dark:bg-zinc-700 shadow-sm text-black dark:text-white' : 'text-zinc-500 hover:text-zinc-700 dark:hover:text-zinc-300'}`}>
                        Find Tickets
                    </button>
                </div>

                {/* FIND TICKETS FORM */}
                {findTickets && (
                    <div className="space-y-4 animate-in fade-in slide-in-from-right-4">
                        <div className="text-center mb-6">
                            <h3 className="font-bold text-lg mb-2">Lost your tickets?</h3>
                            <p className="text-sm text-zinc-500">Enter your email and we'll send a magic link to access your orders.</p>
                        </div>
                        <form onSubmit={handleFindTickets} className="space-y-4">
                            <Input
                                label="Email Address used for purchase"
                                type="email"
                                required
                                value={formData.email}
                                onChange={e => setFormData({ ...formData, email: e.target.value })}
                            />
                            {ticketMessage && (
                                <div className="p-4 bg-green-500/10 text-green-600 rounded-xl text-sm font-bold text-center">
                                    {ticketMessage}
                                </div>
                            )}
                            <Button type="submit" variant="secondary" className="w-full py-4 text-lg text-black" isLoading={isLoading}>
                                Email Me My Tickets
                            </Button>
                        </form>
                    </div>
                )}

                {/* LOGIN FORM */}
                {isLogin && !findTickets && (
                    <div className="space-y-4 animate-in fade-in slide-in-from-left-4">
                        {/* Google Login Button */}
                        <button
                            type="button"
                            onClick={handleGoogleLogin}
                            disabled={isLoading}
                            className="w-full py-3 bg-white dark:bg-zinc-800 text-zinc-700 dark:text-zinc-200 border border-zinc-300 dark:border-zinc-700 rounded-xl hover:bg-zinc-50 dark:hover:bg-zinc-700 font-bold flex items-center justify-center gap-3 transition-colors"
                        >
                            {/* Google Icon SVG */}
                            <svg className="w-5 h-5" viewBox="0 0 24 24">
                                <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" />
                                <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" />
                                <path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.84z" />
                                <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" />
                            </svg>
                            Continue with Google
                        </button>

                        <form onSubmit={handleLogin} className="space-y-4">
                            <Input
                                label="Email Address"
                                type="email"
                                required
                                value={formData.email}
                                onChange={e => setFormData({ ...formData, email: e.target.value })}
                            />
                            <PasswordInput
                                label="Password"
                                value={formData.password}
                                onChange={e => setFormData({ ...formData, password: e.target.value })}
                                required
                            />
                            {error && (
                                <div className="text-red-500 text-sm text-center font-bold bg-red-500/10 p-3 rounded flex items-center justify-center gap-2">
                                    {error.includes("Suspended") && <Ban size={16} />}
                                    {error}
                                </div>
                            )}
                            <Button type="submit" variant="secondary" className="w-full py-4 text-lg text-black" isLoading={isLoading}>Sign In</Button>
                        </form>


                    </div>
                )}

                {/* SIGNUP FLOW */}
                {!isLogin && !findTickets && (
                    <div className="space-y-4">


                        <form onSubmit={handleSignup} className="space-y-4">

                            {/* STEP 0: SELECT ROLE */}
                            {step === 0 && (
                                <div className="space-y-4 animate-in fade-in slide-in-from-right-4">
                                    <button
                                        type="button"
                                        onClick={() => { setRole('attendee'); setStep(1); }}
                                        className="w-full text-left p-4 border border-zinc-200 dark:border-zinc-800 bg-zinc-50 dark:bg-zinc-900 rounded-2xl hover:border-primary cursor-pointer transition-all flex items-center space-x-4 group"
                                    >
                                        <div className="bg-white dark:bg-black p-3 rounded-full text-zinc-900 dark:text-white group-hover:text-primary transition-colors border border-zinc-200 dark:border-zinc-800">
                                            <Ticket size={24} />
                                        </div>
                                        <div>
                                            <h3 className="font-bold text-gray-900 dark:text-white group-hover:text-primary transition-colors">I want to find events</h3>
                                            <p className="text-sm text-gray-500 dark:text-zinc-400">Book tickets and manage your schedule.</p>
                                        </div>
                                    </button>

                                    <button
                                        type="button"
                                        onClick={() => { setRole('organizer'); setStep(1); }}
                                        className="w-full text-left p-4 border border-zinc-200 dark:border-zinc-800 bg-zinc-50 dark:bg-zinc-900 rounded-2xl hover:border-secondary cursor-pointer transition-all flex items-center space-x-4 group"
                                    >
                                        <div className="bg-white dark:bg-black p-3 rounded-full text-zinc-900 dark:text-white group-hover:bg-secondary group-hover:text-black transition-colors border border-zinc-200 dark:border-zinc-800">
                                            <Calendar size={24} />
                                        </div>
                                        <div>
                                            <h3 className="font-bold text-gray-900 dark:text-white group-hover:text-secondary transition-colors">I want to host events</h3>
                                            <p className="text-sm text-gray-500 dark:text-zinc-400">Create events, sell tickets, and manage attendees.</p>
                                        </div>
                                    </button>
                                </div>
                            )}

                            {/* STEP 1: BASICS */}
                            {step === 1 && (
                                <div className="animate-in fade-in slide-in-from-right-4">
                                    <button
                                        type="button"
                                        onClick={handleGoogleLogin}
                                        disabled={isLoading}
                                        className="w-full py-3 mb-6 bg-white dark:bg-zinc-800 text-zinc-700 dark:text-zinc-200 border border-zinc-300 dark:border-zinc-700 rounded-xl hover:bg-zinc-50 dark:hover:bg-zinc-700 font-bold flex items-center justify-center gap-3 transition-colors"
                                    >
                                        <svg className="w-5 h-5" viewBox="0 0 24 24">
                                            <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" />
                                            <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" />
                                            <path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.84z" />
                                            <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" />
                                        </svg>
                                        Sign Up with Google
                                    </button>

                                    <Input
                                        label="Full Name"
                                        required
                                        value={formData.name}
                                        onChange={e => setFormData({ ...formData, name: e.target.value })}
                                    />
                                    <Input
                                        label="Email Address"
                                        type="email"
                                        required
                                        value={formData.email}
                                        onChange={e => setFormData({ ...formData, email: e.target.value })}
                                    />
                                    <PasswordInput
                                        label="Password"
                                        value={formData.password}
                                        onChange={e => setFormData({ ...formData, password: e.target.value })}
                                        required
                                        showValidation
                                    />
                                    <div className="flex gap-2 mt-4">
                                        <Button type="button" variant="ghost" onClick={() => setStep(0)} className="flex-1">Back</Button>
                                        <Button type="submit" variant="secondary" className="flex-1" isLoading={isLoading}>
                                            {role === 'organizer' ? 'Next Step' : 'Create Account'}
                                        </Button>
                                    </div>
                                </div>
                            )}

                            {/* STEP 2: ORGANIZER ONBOARDING */}
                            {step === 2 && (
                                <div className="animate-in fade-in slide-in-from-right-4">
                                    <div className="bg-secondary/10 border border-secondary/20 p-4 rounded-xl mb-4 text-sm text-secondary-dark font-medium">
                                        Tell us a bit about yourself so we can tailor your experience.
                                    </div>
                                    <Input
                                        label="Business / Organization Name"
                                        placeholder="e.g. Acme Events"
                                        value={formData.businessName}
                                        onChange={e => setFormData({ ...formData, businessName: e.target.value })}
                                    />
                                    <Select
                                        label="Type of Business"
                                        value={formData.businessType}
                                        onChange={e => setFormData({ ...formData, businessType: e.target.value })}
                                        options={[
                                            { value: '', label: 'Select...' },
                                            { value: 'nonprofit', label: 'Non-Profit / Charity' },
                                            { value: 'education', label: 'Education' },
                                            { value: 'corporate', label: 'Corporate' },
                                            { value: 'community', label: 'Community Group' },
                                            { value: 'personal', label: 'Personal / Hobby' },
                                            { value: 'other', label: 'Other' }
                                        ]}
                                    />
                                    <Input
                                        label="What kind of events do you host?"
                                        placeholder="e.g. Workshops, Concerts, Classes"
                                        value={formData.eventTypes}
                                        onChange={e => setFormData({ ...formData, eventTypes: e.target.value })}
                                    />
                                    <div className="flex gap-2 mt-4">
                                        <Button type="button" variant="ghost" onClick={() => setStep(1)} className="flex-1">Back</Button>
                                        <Button type="submit" variant="secondary" className="flex-1" isLoading={isLoading}>
                                            {formData.businessType === 'nonprofit' ? 'Next: Verification' : 'Complete Setup'}
                                        </Button>
                                    </div>
                                </div>
                            )}

                            {/* STEP 3: NON-PROFIT VERIFICATION */}
                            {step === 3 && (
                                <div className="animate-in fade-in slide-in-from-right-4">
                                    <div className="bg-secondary/10 border border-secondary/20 p-4 rounded-xl mb-4 text-sm dark:text-secondary text-green-700 flex items-start gap-2">
                                        <Building2 size={20} className="shrink-0" />
                                        <div>
                                            <strong>Non-Profit Verification</strong><br />
                                            Provide your details to receive 25% off Pro pricing and lower rates.
                                        </div>
                                    </div>
                                    <Input
                                        label="Legal Non-Profit Name"
                                        value={formData.nonProfitName}
                                        onChange={e => setFormData({ ...formData, nonProfitName: e.target.value })}
                                        required
                                    />
                                    <Input
                                        label="EIN / Registration Number"
                                        value={formData.nonProfitEin}
                                        onChange={e => setFormData({ ...formData, nonProfitEin: e.target.value })}
                                        required
                                    />
                                    <div className="mb-4">
                                        <label className="block text-xs font-bold text-gray-500 uppercase mb-2">Upload Proof of Status (501(c)(3) Letter)</label>
                                        <FileDropZone
                                            label=""
                                            currentImage={formData.nonProfitDocUrl ? 'PDF UPLOADED' : undefined}
                                            onFileSelect={(b64) => setFormData({ ...formData, nonProfitDocUrl: b64 as string })}
                                            onClear={() => setFormData({ ...formData, nonProfitDocUrl: '' })}
                                        />
                                        {formData.nonProfitDocUrl && <p className="text-emerald-600 dark:text-emerald-400 text-xs font-bold mt-1">Document Attached</p>}
                                    </div>

                                    <div className="flex gap-2 mt-4">
                                        <Button type="button" variant="ghost" onClick={() => setStep(2)} className="flex-1">Back</Button>
                                        <Button type="submit" variant="secondary" className="flex-1" isLoading={isLoading}>Submit for Approval</Button>
                                    </div>
                                </div>
                            )}

                            {error && <p className="text-red-500 text-sm text-center font-bold bg-red-500/10 p-2 rounded">{error}</p>}
                        </form>
                    </div>
                )}


            </Card>
        </div>
    );
};
