import React, { useState, useEffect } from 'react';
import { Megaphone, Send } from 'lucide-react';
import { StorageService } from '../../../services/storageService';
import { Button, RichTextarea } from '../../UI';

interface BroadcastTabProps {
    refreshData: () => Promise<void>;
}

export const BroadcastTab: React.FC<BroadcastTabProps> = ({ refreshData }) => {
    const [broadcastMsg, setBroadcastMsg] = useState('');
    const [broadcastTarget, setBroadcastTarget] = useState<'all' | 'organizers' | 'affiliates'>('all');
    const [activeNotification, setActiveNotification] = useState<any>(null);

    useEffect(() => {
        // Load active notification
        setActiveNotification(StorageService.getSystemNotification());
    }, []);

    const handleSendBroadcast = async () => {
        if (!broadcastMsg.trim()) return;
        
        try {
            const token = await StorageService.getAuthToken();
            const response = await fetch('/api/notifications/broadcast', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${token}`
                },
                body: JSON.stringify({
                    message: broadcastMsg,
                    title: '📢 Announcement',
                    target: broadcastTarget,
                    type: 'broadcast'
                })
            });
            
            const result = await response.json();
            
            if (response.ok) {
                setBroadcastMsg('');
                await refreshData();
                setActiveNotification(StorageService.getSystemNotification());
                window.alert(`Broadcast sent to ${result.sent} ${broadcastTarget === 'all' ? 'users' : broadcastTarget}!`);
            } else {
                window.alert(`Failed to send broadcast: ${result.error}`);
            }
        } catch (error: any) {
            console.error('Broadcast error:', error);
            window.alert(`Failed to send broadcast: ${error.message}`);
        }
    };

    const handleClearBroadcast = async () => {
        StorageService.clearSystemNotification();
        await refreshData();
        setActiveNotification(null);
    };

    return (
        <div className="p-8">
            <h2 className="text-xl font-bold text-white mb-4 flex items-center gap-2">
                <Megaphone size={24} className="text-[#E0FF20]" /> System Broadcast
            </h2>
            <div className="max-w-2xl">
                <div className="mb-4">
                    <label className="block text-xs font-bold text-zinc-500 uppercase mb-2">Target Audience</label>
                    <div className="flex gap-2">
                        {(['all', 'organizers', 'affiliates'] as const).map(target => (
                            <button
                                key={target}
                                onClick={() => setBroadcastTarget(target)}
                                className={`px-4 py-2 rounded-lg font-bold capitalize ${
                                    broadcastTarget === target
                                        ? 'bg-[#E0FF20] text-black'
                                        : 'bg-zinc-800 text-zinc-400 hover:bg-zinc-700'
                                }`}
                            >
                                {target === 'all' ? 'All Users' : target}
                            </button>
                        ))}
                    </div>
                </div>
                <RichTextarea
                    label="Broadcast Message"
                    value={broadcastMsg}
                    onChange={(e: any) => setBroadcastMsg(e.target.value)}
                    placeholder="Message to display on dashboards..."
                    className="mb-4"
                />
                <div className="flex gap-2">
                    <Button onClick={handleSendBroadcast} disabled={!broadcastMsg}>
                        <Send size={16} className="mr-2" /> Send to {broadcastTarget === 'all' ? 'All' : broadcastTarget}
                    </Button>
                    <Button variant="outline" onClick={handleClearBroadcast}>Clear Active Broadcast</Button>
                </div>
            </div>
            {activeNotification && (
                <div className="mt-8 p-4 border border-zinc-700 rounded-xl bg-zinc-800/50">
                    <div className="text-xs font-bold uppercase text-zinc-500 mb-2">Active Broadcast</div>
                    <div dangerouslySetInnerHTML={{ __html: activeNotification.message }} className="text-white" />
                </div>
            )}
        </div>
    );
};
