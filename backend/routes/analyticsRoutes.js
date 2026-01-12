/**
 * Analytics Routes - Handles page view tracking and analytics data retrieval
 */

import express from 'express';
import analyticsService from '../services/analyticsService.js';
import scanAnalyticsService from '../services/scanAnalyticsService.js';
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

// ========================================
// SCAN ANALYTICS ENDPOINTS
// ========================================

/**
 * POST /api/analytics/scan-metrics
 * Receive and store scan metrics from mobile scanner
 */
router.post('/scan-metrics', verifyToken, async (req, res) => {
    try {
        const { metrics } = req.body;
        
        if (!metrics || !Array.isArray(metrics)) {
            return res.status(400).json({ error: 'Invalid metrics data. Must be an array.' });
        }

        if (metrics.length === 0) {
            return res.status(400).json({ error: 'Metrics array cannot be empty' });
        }

        // Add user info to metrics if available
        const enrichedMetrics = metrics.map(metric => ({
            ...metric,
            userId: req.user?.uid || null,
            userEmail: req.user?.email || null
        }));

        // Save to database
        const result = await scanAnalyticsService.saveScanMetrics(enrichedMetrics);

        console.log(`[Analytics] Received and stored ${result.count} scan metrics`);

        res.json({
            success: true,
            received: result.count,
            message: 'Metrics saved successfully'
        });
    } catch (error) {
        console.error('[Analytics] Error processing scan metrics:', error);
        res.status(500).json({ 
            error: 'Failed to save metrics',
            message: error.message 
        });
    }
});

/**
 * GET /api/analytics/scan-summary/:eventId
 * Get analytics summary for an event
 */
router.get('/scan-summary/:eventId', verifyToken, async (req, res) => {
    try {
        const { eventId } = req.params;
        const { startTime, endTime } = req.query;

        const timeRange = (startTime && endTime) ? {
            start: parseInt(startTime),
            end: parseInt(endTime)
        } : null;

        // Get summary from database
        const summary = await scanAnalyticsService.getAnalyticsSummary(eventId, timeRange);

        // Get error breakdown
        const errorBreakdown = await scanAnalyticsService.getErrorBreakdown(eventId);

        // Get peak time
        const scansByHour = await scanAnalyticsService.getScansByHour(eventId);
        const peakHour = scansByHour.length > 0 ? scansByHour[0].hour : 0;
        const peakScanTime = `${peakHour}:00`;

        // Calculate scans per minute
        const scansPerMinute = await scanAnalyticsService.calculateThroughput(eventId, timeRange);

        // Build response
        const analytics = {
            totalScans: parseInt(summary.total_scans),
            successfulScans: parseInt(summary.successful_scans),
            failedScans: parseInt(summary.failed_scans),
            successRate: parseFloat(summary.success_rate),
            averageScanTime: parseInt(summary.avg_duration),
            fastestScan: parseInt(summary.min_duration) || 0,
            slowestScan: parseInt(summary.max_duration) || 0,
            scansPerMinute: scansPerMinute,
            peakScanTime: peakScanTime,
            errorBreakdown: errorBreakdown,
            scansByMethod: {
                camera: parseInt(summary.camera_scans),
                upload: parseInt(summary.upload_scans),
                manual: parseInt(summary.manual_scans)
            }
        };

        res.json({
            success: true,
            analytics: analytics
        });

    } catch (error) {
        console.error('[Analytics] Error getting scan summary:', error);
        res.status(500).json({ 
            error: 'Failed to get analytics summary',
            message: error.message 
        });
    }
});

/**
 * GET /api/analytics/scan-details/:eventId
 * Get detailed scan records for an event
 */
router.get('/scan-details/:eventId', verifyToken, async (req, res) => {
    try {
        const { eventId } = req.params;
        const { startTime, endTime, limit } = req.query;

        const timeRange = (startTime && endTime) ? {
            start: parseInt(startTime),
            end: parseInt(endTime)
        } : null;

        const scans = await scanAnalyticsService.getDetailedAnalytics(eventId, timeRange);

        // Apply limit if specified
        const limitedScans = limit ? scans.slice(0, parseInt(limit)) : scans;

        res.json({
            success: true,
            count: limitedScans.length,
            scans: limitedScans
        });

    } catch (error) {
        console.error('[Analytics] Error getting scan details:', error);
        res.status(500).json({ 
            error: 'Failed to get scan details',
            message: error.message 
        });
    }
});

/**
 * GET /api/analytics/scan-export/:eventId
 * Export analytics to CSV
 */
router.get('/scan-export/:eventId', verifyToken, async (req, res) => {
    try {
        const { eventId } = req.params;
        const { startTime, endTime } = req.query;

        const timeRange = (startTime && endTime) ? {
            start: parseInt(startTime),
            end: parseInt(endTime)
        } : null;

        const csv = await scanAnalyticsService.exportToCsv(eventId, timeRange);

        if (!csv) {
            return res.status(404).json({ error: 'No analytics data found' });
        }

        // Set headers for CSV download
        res.setHeader('Content-Type', 'text/csv');
        res.setHeader('Content-Disposition', `attachment; filename="scan-analytics-${eventId}.csv"`);
        res.send(csv);

    } catch (error) {
        console.error('[Analytics] Error exporting analytics:', error);
        res.status(500).json({ 
            error: 'Failed to export analytics',
            message: error.message 
        });
    }
});

/**
 * DELETE /api/analytics/cleanup
 * Delete old analytics data (admin only)
 */
router.delete('/cleanup', verifyToken, async (req, res) => {
    try {
        // Check if user is admin
        if (!req.user?.isAdmin) {
            return res.status(403).json({ error: 'Admin access required' });
        }

        const { daysToKeep = 90 } = req.body;

        const result = await scanAnalyticsService.deleteOldAnalytics(daysToKeep);

        res.json({
            success: true,
            message: `Deleted analytics older than ${daysToKeep} days`
        });

    } catch (error) {
        console.error('[Analytics] Error cleaning up analytics:', error);
        res.status(500).json({ 
            error: 'Failed to cleanup analytics',
            message: error.message 
        });
    }
});

export default router;
