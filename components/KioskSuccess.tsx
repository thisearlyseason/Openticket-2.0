import React, { useEffect } from 'react';
import { useParams, useNavigate, useSearchParams } from 'react-router-dom';
import { CheckCircle2 } from 'lucide-react';

export const KioskSuccess: React.FC = () => {
    const { eventId } = useParams<{ eventId: string }>();
    const [searchParams] = useSearchParams();
    const navigate = useNavigate();
    const type = searchParams.get('type') || 'checkin';

    useEffect(() => {
        // Auto redirect after 3 seconds
        const timer = setTimeout(() => {
            navigate(`/kiosk/${eventId}`);
        }, 3000);

        return () => clearTimeout(timer);
    }, [eventId, navigate]);

    return (
        <div className="min-h-screen bg-gradient-to-br from-green-600 to-green-700 flex items-center justify-center p-6">
            <div className="text-center">
                <div className="animate-bounce mb-8">
                    <CheckCircle2 className="text-white mx-auto" size={120} strokeWidth={2} />
                </div>
                <h1 className="text-5xl font-bold text-white mb-4">
                    {type === 'payment' ? 'Payment Successful!' : 'Checked In!'}
                </h1>
                <p className="text-2xl text-white/90 mb-8">
                    {type === 'payment' ? 'Thank you for your payment' : 'Welcome to the event'}
                </p>
                <div className="text-white/70 text-sm">
                    Returning to home in 3 seconds...
                </div>
            </div>
        </div>
    );
};