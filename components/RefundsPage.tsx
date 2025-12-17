import React from 'react';
import { Card } from './UI';
import { FileText } from 'lucide-react';

export const RefundsPage = () => {
    return (
        <div className="max-w-3xl mx-auto py-12 px-4">
            <h1 className="text-3xl font-bold text-gray-900 mb-6 flex items-center">
                <FileText className="mr-3 text-primary"/> Refund Policies
            </h1>
            <Card className="p-8">
                <p className="mb-4 text-gray-700">
                    OpenTicket serves as a platform for event organizers to manage their events and ticket sales. 
                    <strong>Refund policies vary by event and are set directly by the event organizer.</strong>
                </p>
                <h3 className="text-xl font-bold text-gray-900 mb-3">How to find an event's policy</h3>
                <ul className="list-disc pl-5 space-y-2 text-gray-600 mb-6">
                    <li>Check the event description page under the "Refund Policy" section.</li>
                    <li>Look for refund information on your ticket confirmation email.</li>
                    <li>Contact the organizer directly using the "Contact" button on their event page.</li>
                </ul>
                <h3 className="text-xl font-bold text-gray-900 mb-3">General Guidelines</h3>
                <p className="text-gray-600 mb-4">
                    Unless otherwise stated by the organizer:
                </p>
                <ul className="list-disc pl-5 space-y-2 text-gray-600">
                    <li>Platform fees (if applicable) are generally non-refundable.</li>
                    <li>Refund requests should be made at least 24 hours before the event start time.</li>
                    <li>Organizers have the final discretion on all refund requests.</li>
                </ul>
            </Card>
        </div>
    );
};
