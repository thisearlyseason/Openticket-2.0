/**
 * WebSocket Hook - Real-time analytics updates
 * Connects to backend Socket.IO server
 * Uses dynamic import to avoid Vercel build issues
 */

import { useEffect, useRef, useState, useCallback } from 'react';

interface UseWebSocketOptions {
    eventId?: string;
    subscribeGlobal?: boolean;
    onScanUpdate?: (data: any) => void;
    onAnalyticsUpdate?: (data: any) => void;
    onMetricsUpdate?: (data: any) => void;
}

// Type for socket.io client (dynamically imported)
type SocketType = any;

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
    const socketRef = useRef<SocketType | null>(null);
    const isInitializedRef = useRef(false);

    useEffect(() => {
        // Skip if already initialized or if running on server
        if (isInitializedRef.current || typeof window === 'undefined') {
            return;
        }

        isInitializedRef.current = true;

        // Dynamically import socket.io-client to avoid build issues
        const initSocket = async () => {
            try {
                const { io } = await import('socket.io-client');
                
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

                socket.on('connect_error', (error: Error) => {
                    console.error('[WebSocket] Connection error:', error);
                    setConnectionError(error.message);
                    setIsConnected(false);
                });

                // Event handlers
                socket.on('scan:updated', (data: any) => {
                    console.log('[WebSocket] Scan updated:', data);
                    if (onScanUpdate) {
                        onScanUpdate(data);
                    }
                });

                socket.on('analytics:updated', (data: any) => {
                    console.log('[WebSocket] Analytics updated:', data);
                    if (onAnalyticsUpdate) {
                        onAnalyticsUpdate(data);
                    }
                });

                socket.on('scan:metrics', (data: any) => {
                    console.log('[WebSocket] Metrics update:', data);
                    if (onMetricsUpdate) {
                        onMetricsUpdate(data);
                    }
                });

            } catch (error) {
                console.error('[WebSocket] Failed to initialize:', error);
                setConnectionError('Failed to initialize WebSocket');
            }
        };

        initSocket();

        // Cleanup on unmount
        return () => {
            if (socketRef.current) {
                if (eventId) {
                    socketRef.current.emit('unsubscribe:event', eventId);
                }
                socketRef.current.disconnect();
                socketRef.current = null;
            }
            isInitializedRef.current = false;
        };
    }, [eventId, subscribeGlobal, onScanUpdate, onAnalyticsUpdate, onMetricsUpdate]);

    // Manual subscription methods
    const subscribeToEvent = useCallback((newEventId: string) => {
        if (socketRef.current && isConnected) {
            socketRef.current.emit('subscribe:event', newEventId);
        }
    }, [isConnected]);

    const unsubscribeFromEvent = useCallback((eventIdToUnsub: string) => {
        if (socketRef.current && isConnected) {
            socketRef.current.emit('unsubscribe:event', eventIdToUnsub);
        }
    }, [isConnected]);

    return {
        isConnected,
        connectionError,
        subscribeToEvent,
        unsubscribeFromEvent,
        socket: socketRef.current
    };
};

export default useWebSocket;
