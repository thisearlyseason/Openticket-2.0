/**
 * WebSocket Hook - Real-time analytics updates
 * Connects to backend Socket.IO server
 */

import { useEffect, useRef, useState } from 'react';
import { io, Socket } from 'socket.io-client';

interface UseWebSocketOptions {
    eventId?: string;
    subscribeGlobal?: boolean;
    onScanUpdate?: (data: any) => void;
    onAnalyticsUpdate?: (data: any) => void;
    onMetricsUpdate?: (data: any) => void;
}

export const useWebSocket = (options: UseWebSocketOptions = {}) => {
    const {
        eventId,
        subscribeGlobal = false,
        onScanUpdate,
        onAnalyticsUpdate,
        onMetricsUpdate
    } = options;

    const [isConnected, setIsConnected] = useState(false);
    const [connectionError, setConnectionError] = useState<string | null>(null);
    const socketRef = useRef<Socket | null>(null);

    useEffect(() => {
        // Get backend URL
        const backendUrl = process.env.REACT_APP_BACKEND_URL || 'http://localhost:8001';

        // Initialize Socket.IO client
        const socket = io(backendUrl, {
            path: '/socket.io/',
            transports: ['websocket', 'polling'],
            reconnection: true,
            reconnectionDelay: 1000,
            reconnectionDelayMax: 5000,
            reconnectionAttempts: Infinity
        });

        socketRef.current = socket;

        // Connection handlers
        socket.on('connect', () => {
            console.log('[WebSocket] Connected:', socket.id);
            setIsConnected(true);
            setConnectionError(null);

            // Subscribe to event if provided
            if (eventId) {
                socket.emit('subscribe:event', eventId);
            }

            // Subscribe to global analytics if requested
            if (subscribeGlobal) {
                socket.emit('subscribe:analytics');
            }
        });

        socket.on('disconnect', () => {
            console.log('[WebSocket] Disconnected');
            setIsConnected(false);
        });

        socket.on('connect_error', (error) => {
            console.error('[WebSocket] Connection error:', error);
            setConnectionError(error.message);
            setIsConnected(false);
        });

        // Event handlers
        socket.on('scan:updated', (data) => {
            console.log('[WebSocket] Scan updated:', data);
            if (onScanUpdate) {
                onScanUpdate(data);
            }
        });

        socket.on('analytics:updated', (data) => {
            console.log('[WebSocket] Analytics updated:', data);
            if (onAnalyticsUpdate) {
                onAnalyticsUpdate(data);
            }
        });

        socket.on('scan:metrics', (data) => {
            console.log('[WebSocket] Metrics update:', data);
            if (onMetricsUpdate) {
                onMetricsUpdate(data);
            }
        });

        // Cleanup on unmount
        return () => {
            if (eventId) {
                socket.emit('unsubscribe:event', eventId);
            }
            socket.disconnect();
        };
    }, [eventId, subscribeGlobal]);

    // Manual subscription methods
    const subscribeToEvent = (newEventId: string) => {
        if (socketRef.current && isConnected) {
            socketRef.current.emit('subscribe:event', newEventId);
        }
    };

    const unsubscribeFromEvent = (eventIdToUnsub: string) => {
        if (socketRef.current && isConnected) {
            socketRef.current.emit('unsubscribe:event', eventIdToUnsub);
        }
    };

    return {
        isConnected,
        connectionError,
        subscribeToEvent,
        unsubscribeFromEvent,
        socket: socketRef.current
    };
};

export default useWebSocket;
