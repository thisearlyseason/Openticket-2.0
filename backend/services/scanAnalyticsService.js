/**
 * Scan Analytics Service - Backend persistence for mobile scanner metrics
 * Stores and retrieves performance analytics from Supabase
 */

import supabase from './supabase.js';

/**
 * Store scan metrics in database
 */
export const saveScanMetrics = async (metrics) => {
    try {
        if (!Array.isArray(metrics) || metrics.length === 0) {
            throw new Error('Metrics must be a non-empty array');
        }

        // Transform metrics for database storage
        const dbMetrics = metrics.map(metric => ({
            event_id: metric.eventId,
            ticket_id: metric.ticketId || null,
            success: metric.success,
            error_message: metric.errorMessage || null,
            duration: metric.duration,
            timestamp: metric.timestamp,
            scan_method: metric.scanMethod || null,
            user_agent: metric.deviceInfo?.userAgent || null,
            platform: metric.deviceInfo?.platform || null,
            online: metric.deviceInfo?.online ?? true,
            user_id: metric.userId || null,
            user_email: metric.userEmail || null,
            created_at: new Date().toISOString()
        }));

        const { data, error } = await supabase
            .from('scan_analytics')
            .insert(dbMetrics);

        if (error) {
            console.error('[ScanAnalytics] Error saving metrics:', error);
            throw error;
        }

        console.log(`[ScanAnalytics] Saved ${metrics.length} metrics successfully`);
        return { success: true, count: metrics.length };

    } catch (err) {
        console.error('[ScanAnalytics] saveScanMetrics failed:', err);
        throw err;
    }
};

/**
 * Get analytics summary for an event
 */
export const getAnalyticsSummary = async (eventId, timeRange = null) => {
    try {
        const startTime = timeRange?.start || null;
        const endTime = timeRange?.end || null;

        const { data, error } = await supabase.rpc('get_scan_analytics_summary', {
            p_event_id: eventId,
            p_start_time: startTime,
            p_end_time: endTime
        });

        if (error) {
            console.error('[ScanAnalytics] Error getting summary:', error);
            throw error;
        }

        return data[0] || {
            total_scans: 0,
            successful_scans: 0,
            failed_scans: 0,
            success_rate: 0,
            avg_duration: 0,
            min_duration: 0,
            max_duration: 0,
            camera_scans: 0,
            upload_scans: 0,
            manual_scans: 0
        };

    } catch (err) {
        console.error('[ScanAnalytics] getAnalyticsSummary failed:', err);
        throw err;
    }
};

/**
 * Get error breakdown for an event
 */
export const getErrorBreakdown = async (eventId, limit = 10) => {
    try {
        const { data, error } = await supabase.rpc('get_scan_error_breakdown', {
            p_event_id: eventId,
            p_limit: limit
        });

        if (error) {
            console.error('[ScanAnalytics] Error getting error breakdown:', error);
            throw error;
        }

        // Transform to object format
        const breakdown = {};
        data.forEach(item => {
            breakdown[item.error_message] = parseInt(item.count);
        });

        return breakdown;

    } catch (err) {
        console.error('[ScanAnalytics] getErrorBreakdown failed:', err);
        throw err;
    }
};

/**
 * Get scans by hour (for peak time detection)
 */
export const getScansByHour = async (eventId) => {
    try {
        const { data, error } = await supabase.rpc('get_scans_by_hour', {
            p_event_id: eventId
        });

        if (error) {
            console.error('[ScanAnalytics] Error getting scans by hour:', error);
            throw error;
        }

        return data || [];

    } catch (err) {
        console.error('[ScanAnalytics] getScansByHour failed:', err);
        throw err;
    }
};

/**
 * Get detailed scan analytics for an event
 */
export const getDetailedAnalytics = async (eventId, timeRange = null) => {
    try {
        let query = supabase
            .from('scan_analytics')
            .select('*')
            .eq('event_id', eventId)
            .order('timestamp', { ascending: false })
            .limit(1000);  // Limit to last 1000 scans

        if (timeRange?.start) {
            query = query.gte('timestamp', timeRange.start);
        }
        if (timeRange?.end) {
            query = query.lte('timestamp', timeRange.end);
        }

        const { data, error } = query;

        if (error) {
            console.error('[ScanAnalytics] Error getting detailed analytics:', error);
            throw error;
        }

        return data || [];

    } catch (err) {
        console.error('[ScanAnalytics] getDetailedAnalytics failed:', err);
        throw err;
    }
};

/**
 * Get scans per minute for throughput calculation
 */
export const calculateThroughput = async (eventId, timeRange = null) => {
    try {
        const scans = await getDetailedAnalytics(eventId, timeRange);
        
        if (scans.length === 0) {
            return 0;
        }

        const timestamps = scans.map(s => s.timestamp);
        const minTimestamp = Math.min(...timestamps);
        const maxTimestamp = Math.max(...timestamps);
        const timeSpanMinutes = (maxTimestamp - minTimestamp) / 60000;

        if (timeSpanMinutes === 0) {
            return scans.length; // All scans in same minute
        }

        return parseFloat((scans.length / timeSpanMinutes).toFixed(2));

    } catch (err) {
        console.error('[ScanAnalytics] calculateThroughput failed:', err);
        throw err;
    }
};

/**
 * Delete old analytics data (cleanup/archival)
 */
export const deleteOldAnalytics = async (daysToKeep = 90) => {
    try {
        const cutoffDate = new Date();
        cutoffDate.setDate(cutoffDate.getDate() - daysToKeep);
        const cutoffTimestamp = cutoffDate.getTime();

        const { data, error } = await supabase
            .from('scan_analytics')
            .delete()
            .lt('timestamp', cutoffTimestamp);

        if (error) {
            console.error('[ScanAnalytics] Error deleting old analytics:', error);
            throw error;
        }

        console.log(`[ScanAnalytics] Deleted analytics older than ${daysToKeep} days`);
        return { success: true };

    } catch (err) {
        console.error('[ScanAnalytics] deleteOldAnalytics failed:', err);
        throw err;
    }
};

/**
 * Export analytics to CSV format
 */
export const exportToCsv = async (eventId, timeRange = null) => {
    try {
        const scans = await getDetailedAnalytics(eventId, timeRange);

        if (scans.length === 0) {
            return '';
        }

        // CSV headers
        const headers = [
            'Timestamp',
            'Date/Time',
            'Success',
            'Duration (ms)',
            'Ticket ID',
            'Error Message',
            'Scan Method',
            'Platform',
            'Online'
        ];

        // CSV rows
        const rows = scans.map(scan => [
            scan.timestamp,
            new Date(scan.timestamp).toISOString(),
            scan.success ? 'Yes' : 'No',
            scan.duration,
            scan.ticket_id || 'N/A',
            scan.error_message || 'N/A',
            scan.scan_method || 'N/A',
            scan.platform || 'N/A',
            scan.online ? 'Yes' : 'No'
        ]);

        // Build CSV
        const csv = [
            headers.join(','),
            ...rows.map(row => row.map(cell => `"${cell}"`).join(','))
        ].join('\n');

        return csv;

    } catch (err) {
        console.error('[ScanAnalytics] exportToCsv failed:', err);
        throw err;
    }
};

export default {
    saveScanMetrics,
    getAnalyticsSummary,
    getErrorBreakdown,
    getScansByHour,
    getDetailedAnalytics,
    calculateThroughput,
    deleteOldAnalytics,
    exportToCsv
};
