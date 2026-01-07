/**
 * Analytics Routes - Handles page view tracking and analytics data retrieval
 */

import express from 'express';
import analyticsService from '../services/analyticsService.js';
import verifyToken from '../middlewares/authMiddleware.js';

const router = express.Router();

/**
 * POST /api/analytics/track
 * Track a page view (public endpoint - no auth required)
 */
router.post('/track', async (req, res) => {
    try {
        const { eventId, referrer } = req.body;
        
        if (!eventId) {
            return res.status(400).json({ error: 'eventId is required' });
        }

        const userAgent = req.headers['user-agent'] || '';
        const { deviceType, browser, os } = analyticsService.parseUserAgent(userAgent);

        // Get country from headers (set by CDN/proxy) or leave null
        const country = req.headers['cf-ipcountry'] || 
                       req.headers['x-vercel-ip-country'] || 
                       req.headers['x-country'] || 
                       null;

        const city = req.headers['cf-ipcity'] || 
                    req.headers['x-vercel-ip-city'] || 
                    null;

        await analyticsService.trackPageView(eventId, {
            deviceType,
            browser,
            os,
            country,
            city,
            referrer,
            userAgent
        });

        res.json({ success: true });
    } catch (error) {
        console.error('[Analytics] Track error:', error);
        res.status(500).json({ error: 'Failed to track page view' });
    }
});

/**
 * GET /api/analytics/event/:eventId
 * Get analytics for a specific event (requires auth)
 */
router.get('/event/:eventId', verifyToken, async (req, res) => {
    try {
        const { eventId } = req.params;
        const stats = await analyticsService.getEventPageViews(eventId);
        res.json(stats);
    } catch (error) {
        console.error('[Analytics] Event stats error:', error);
        res.status(500).json({ error: 'Failed to get analytics' });
    }
});

/**
 * GET /api/analytics/organizer
 * Get aggregated analytics for the logged-in organizer
 */
router.get('/organizer', verifyToken, async (req, res) => {
    try {
        const organizerId = req.user?.uid;
        const dateRange = req.query.range || '30d';

        if (!organizerId) {
            return res.status(401).json({ error: 'Not authenticated' });
        }

        const stats = await analyticsService.getOrganizerAnalytics(organizerId, dateRange);
        res.json(stats);
    } catch (error) {
        console.error('[Analytics] Organizer stats error:', error);
        res.status(500).json({ error: 'Failed to get analytics' });
    }
});

export default router;
