import React from 'react';
import { Registration } from '../../../types';
import { DataTable, Column } from '../../DataTable';

interface RegistrationsTabProps {
    registrations: Registration[];
    registrationColumns: Column<Registration>[];
}

export const RegistrationsTab: React.FC<RegistrationsTabProps> = ({ registrations, registrationColumns }) => {
    const safeRegistrations = Array.isArray(registrations) ? registrations : [];

    return (
        <div className="bg-zinc-900 rounded-3xl p-6 border border-zinc-800">
            <div className="flex justify-between items-center mb-4">
                <span className="font-bold text-white">All Registrations ({safeRegistrations.length})</span>
                <span className="text-xs text-zinc-500 flex items-center gap-1">
                    <span>← Scroll horizontally to see all columns →</span>
                </span>
            </div>
            
            <DataTable
                data={safeRegistrations}
                columns={registrationColumns}
                searchPlaceholder="Search registrations by event, attendee, or email..."
                emptyMessage="No registrations found. Registrations will appear here when users purchase tickets."
                exportFilename="openticket_registrations"
                getRowId={(reg) => reg.id}
            />
        </div>
    );
};
