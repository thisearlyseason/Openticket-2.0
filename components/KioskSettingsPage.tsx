import React from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { KioskSettings } from './KioskSettings';
import { Button } from './UI';
import { ArrowLeft } from 'lucide-react';

export const KioskSettingsPage: React.FC = () => {
    const { id } = useParams<{ id: string }>();
    const navigate = useNavigate();

    return (
        <div className="min-h-screen bg-zinc-50 dark:bg-zinc-950 p-6">
            <div className="max-w-5xl mx-auto">
                <Button
                    variant="ghost"
                    onClick={() => navigate(`/manage/${id}`)}
                    className="mb-6 flex items-center gap-2"
                >
                    <ArrowLeft size={20} />
                    Back to Event
                </Button>

                <KioskSettings eventId={id!} />
            </div>
        </div>
    );
};
