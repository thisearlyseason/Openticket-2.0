import React from 'react';
import { Event } from '../../../types';
import { DataTable, Column } from '../../DataTable';

interface EventsTabProps {
    events: Event[];
    eventColumns: Column<Event>[];
}

export const EventsTab: React.FC<EventsTabProps> = ({ events, eventColumns }) => {
    const safeEvents = Array.isArray(events) ? events : [];

    return (
        <div className="bg-zinc-900 rounded-3xl p-6 border border-zinc-800">
            <div className="flex justify-between items-center mb-6">
                <span className="font-bold text-white">All Events ({safeEvents.length})</span>
            </div>
            
            <DataTable
                data={safeEvents}
                columns={eventColumns}
                searchPlaceholder="Search events by title, location, or organizer..."
                emptyMessage="No events found."
                exportFilename="openticket_events"
                getRowId={(event) => event.id}
            />
        </div>
    );
};
