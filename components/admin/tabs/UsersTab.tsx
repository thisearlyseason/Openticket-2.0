import React from 'react';
import { User } from '../../../types';
import { DataTable, Column } from '../../DataTable';

interface UsersTabProps {
    users: User[];
    userColumns: Column<User>[];
}

export const UsersTab: React.FC<UsersTabProps> = ({ users, userColumns }) => {
    const safeUsers = Array.isArray(users) ? users : [];

    return (
        <div className="bg-zinc-900 rounded-3xl p-6 border border-zinc-800">
            <div className="flex justify-between items-center mb-6">
                <span className="font-bold text-white">All Users ({safeUsers.length})</span>
            </div>
            
            <DataTable
                data={safeUsers}
                columns={userColumns}
                searchPlaceholder="Search users by name, email, or organization..."
                emptyMessage="No users found."
                exportFilename="openticket_users"
                getRowId={(user) => user.id}
            />
        </div>
    );
};
