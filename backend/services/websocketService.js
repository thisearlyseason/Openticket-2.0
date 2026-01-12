/**
 * WebSocket Service - Real-time updates for scan analytics
 * Listens to PostgreSQL NOTIFY and broadcasts to connected clients
 */

import { Server } from 'socket.io';
import pkg from 'pg';
const { Client } = pkg;

class WebSocketService {
    constructor() {
        this.io = null;
        this.pgClient = null;
        this.connectedClients = new Map();
    }

    /**
     * Initialize WebSocket server
     */
    initialize(httpServer) {
        console.log('[WebSocket] Initializing Socket.IO server...');

        this.io = new Server(httpServer, {
            cors: {
                origin: process.env.FRONTEND_URL || 'http://localhost:3000',
                methods: ['GET', 'POST'],
                credentials: true
            },
            path: '/socket.io/'
        });

        // Setup connection handlers
        this.setupConnectionHandlers();

        // Setup PostgreSQL listener
        this.setupPostgresListener();

        console.log('[WebSocket] ✅ Socket.IO server initialized');
    }

    /**
     * Setup Socket.IO connection handlers
     */
    setupConnectionHandlers() {
        this.io.on('connection', (socket) => {
            console.log('[WebSocket] Client connected:', socket.id);
            this.connectedClients.set(socket.id, {
                socket,
                subscribedEvents: new Set(),
                connectedAt: Date.now()
            });

            // Handle event subscription
            socket.on('subscribe:event', (eventId) => {
                console.log(`[WebSocket] Client ${socket.id} subscribed to event: ${eventId}`);
                socket.join(`event:${eventId}`);
                
                const client = this.connectedClients.get(socket.id);
                if (client) {
                    client.subscribedEvents.add(eventId);
                }
            });

            // Handle event unsubscription
            socket.on('unsubscribe:event', (eventId) => {
                console.log(`[WebSocket] Client ${socket.id} unsubscribed from event: ${eventId}`);
                socket.leave(`event:${eventId}`);
                
                const client = this.connectedClients.get(socket.id);
                if (client) {
                    client.subscribedEvents.delete(eventId);
                }
            });

            // Handle global analytics subscription
            socket.on('subscribe:analytics', () => {
                console.log(`[WebSocket] Client ${socket.id} subscribed to global analytics`);
                socket.join('analytics:global');
            });

            // Handle disconnection
            socket.on('disconnect', () => {
                console.log('[WebSocket] Client disconnected:', socket.id);
                this.connectedClients.delete(socket.id);
            });

            // Send initial connection success
            socket.emit('connected', {
                clientId: socket.id,
                timestamp: Date.now()
            });
        });
    }

    /**
     * Setup PostgreSQL NOTIFY listener
     */
    async setupPostgresListener() {
        try {
            // Get connection string from environment
            const connectionString = process.env.MONGO_URL;
            
            if (!connectionString || !connectionString.startsWith('postgresql://')) {
                console.log('[WebSocket] Skipping PostgreSQL listener - not a PostgreSQL connection');
                return;
            }

            // Create dedicated PostgreSQL client for LISTEN
            this.pgClient = new Client({
                connectionString: connectionString
            });

            await this.pgClient.connect();
            console.log('[WebSocket] ✅ Connected to PostgreSQL for NOTIFY listening');

            // Listen to analytics refresh notifications
            await this.pgClient.query('LISTEN refresh_analytics_views');
            console.log('[WebSocket] Listening to refresh_analytics_views channel');

            // Handle notifications
            this.pgClient.on('notification', (msg) => {
                this.handlePostgresNotification(msg);
            });

            // Handle connection errors
            this.pgClient.on('error', (err) => {
                console.error('[WebSocket] PostgreSQL client error:', err);
                // Attempt reconnection
                this.reconnectPostgres();
            });

        } catch (error) {
            console.error('[WebSocket] Failed to setup PostgreSQL listener:', error);
            console.log('[WebSocket] WebSocket will continue without PostgreSQL NOTIFY support');
        }
    }

    /**
     * Handle PostgreSQL notification
     */
    handlePostgresNotification(msg) {
        console.log('[WebSocket] Received PostgreSQL notification:', msg.channel, msg.payload);

        if (msg.channel === 'refresh_analytics_views') {
            const eventId = msg.payload;

            // Broadcast to clients subscribed to this event
            this.broadcastEventUpdate(eventId);

            // Also broadcast to global analytics listeners
            this.broadcastGlobalUpdate();
        }
    }

    /**
     * Broadcast scan update to event subscribers
     */
    broadcastEventUpdate(eventId) {
        if (!this.io) return;

        console.log(`[WebSocket] Broadcasting update for event: ${eventId}`);

        this.io.to(`event:${eventId}`).emit('scan:updated', {
            eventId,
            timestamp: Date.now(),
            message: 'New scan recorded'
        });
    }

    /**
     * Broadcast to global analytics listeners
     */
    broadcastGlobalUpdate() {
        if (!this.io) return;

        console.log('[WebSocket] Broadcasting global analytics update');

        this.io.to('analytics:global').emit('analytics:updated', {
            timestamp: Date.now(),
            message: 'Analytics data updated'
        });
    }

    /**
     * Broadcast scan metrics update
     */
    broadcastScanMetrics(eventId, metrics) {
        if (!this.io) return;

        this.io.to(`event:${eventId}`).emit('scan:metrics', {
            eventId,
            metrics,
            timestamp: Date.now()
        });
    }

    /**
     * Reconnect PostgreSQL listener
     */
    async reconnectPostgres() {
        console.log('[WebSocket] Attempting to reconnect PostgreSQL listener...');
        
        try {
            if (this.pgClient) {
                await this.pgClient.end();
            }
            
            // Wait 5 seconds before reconnecting
            await new Promise(resolve => setTimeout(resolve, 5000));
            
            await this.setupPostgresListener();
        } catch (error) {
            console.error('[WebSocket] Reconnection failed:', error);
            // Try again in 10 seconds
            setTimeout(() => this.reconnectPostgres(), 10000);
        }
    }

    /**
     * Get connected clients count
     */
    getConnectedClientsCount() {
        return this.connectedClients.size;
    }

    /**
     * Get room subscribers count
     */
    getRoomSubscribers(room) {
        if (!this.io) return 0;
        
        const sockets = this.io.sockets.adapter.rooms.get(room);
        return sockets ? sockets.size : 0;
    }

    /**
     * Get service stats
     */
    getStats() {
        return {
            connectedClients: this.getConnectedClientsCount(),
            globalAnalyticsSubscribers: this.getRoomSubscribers('analytics:global'),
            postgresConnected: this.pgClient && !this.pgClient.ended,
            uptime: process.uptime()
        };
    }

    /**
     * Cleanup on server shutdown
     */
    async cleanup() {
        console.log('[WebSocket] Cleaning up...');
        
        if (this.io) {
            this.io.close();
        }
        
        if (this.pgClient) {
            await this.pgClient.end();
        }
        
        console.log('[WebSocket] Cleanup complete');
    }
}

// Export singleton instance
const websocketService = new WebSocketService();
export default websocketService;
