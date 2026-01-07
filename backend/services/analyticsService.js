/**
 * Analytics Service - Tracks page views, device info, and user interactions
 * Stores data in Supabase for accurate analytics reporting
 */

import supabase from './supabase.js';

/**
 * Track a page view for an event
 */
export const trackPageView = async (eventId, metadata = {}) => {
    try {
        const { error } = await supabase
            .from('event_analytics')
            .insert({
                event_id: eventId,
                type: 'page_view',
                device_type: metadata.deviceType || 'unknown',
                browser: metadata.browser || 'unknown',
                os: metadata.os || 'unknown',
                country: metadata.country || null,
                city: metadata.city || null,
                referrer: metadata.referrer || null,
                user_agent: metadata.userAgent || null,
                created_at: new Date().toISOString()
            });

        if (error && error.code !== '42P01') {
            console.error('[Analytics] Error tracking page view:', error);
            return false;
        }
        return true;
    } catch (err) {
        console.error('[Analytics] trackPageView failed:', err);
        return false;
    }
};

/**
 * Get page view statistics for an event
 */
export const getEventPageViews = async (eventId) => {
    try {
        const { data, error } = await supabase
            .from('event_analytics')
            .select('id, device_type, browser, country, created_at')
            .eq('event_id', eventId)
            .eq('type', 'page_view');

        if (error) {
            if (error.code === '42P01' || error.code === 'PGRST205') {
                // Table doesn't exist, return empty stats
                return { total: 0, byDevice: {}, byBrowser: {}, byCountry: {} };
            }
            throw error;
        }

        // Aggregate stats
        const byDevice = {};
        const byBrowser = {};
        const byCountry = {};

        (data || []).forEach(view => {
            // Device breakdown
            const device = view.device_type || 'unknown';
            byDevice[device] = (byDevice[device] || 0) + 1;

            // Browser breakdown
            const browser = view.browser || 'unknown';
            byBrowser[browser] = (byBrowser[browser] || 0) + 1;

            // Country breakdown
            const country = view.country || 'Unknown';
            byCountry[country] = (byCountry[country] || 0) + 1;
        });

        return {
            total: data?.length || 0,
            byDevice,
            byBrowser,
            byCountry
        };
    } catch (err) {
        console.error('[Analytics] getEventPageViews failed:', err);
        return { total: 0, byDevice: {}, byBrowser: {}, byCountry: {} };
    }
};

/**
 * Get aggregated analytics for all events owned by a user
 */
export const getOrganizerAnalytics = async (organizerId, dateRange = '30d') => {
    try {
        // Calculate date range
        const now = new Date();
        let startDate;
        switch (dateRange) {
            case '7d': startDate = new Date(now.setDate(now.getDate() - 7)); break;
            case '30d': startDate = new Date(now.setDate(now.getDate() - 30)); break;
            case '90d': startDate = new Date(now.setDate(now.getDate() - 90)); break;
            default: startDate = new Date(0);
        }

        // Get events for this organizer
        const { data: events } = await supabase
            .from('events')
            .select('id')
            .eq('owner_id', organizerId);

        if (!events?.length) {
            return { totalViews: 0, byDevice: {}, byBrowser: {}, byCountry: [], byDay: [] };
        }

        const eventIds = events.map(e => e.id);

        // Get analytics data
        const { data, error } = await supabase
            .from('event_analytics')
            .select('*')
            .in('event_id', eventIds)
            .eq('type', 'page_view')
            .gte('created_at', startDate.toISOString());

        if (error) {
            if (error.code === '42P01' || error.code === 'PGRST205') {
                return { totalViews: 0, byDevice: {}, byBrowser: {}, byCountry: [], byDay: [] };
            }
            throw error;
        }

        // Aggregate
        const byDevice = {};
        const byBrowser = {};
        const byCountry = {};
        const byDay = {};

        (data || []).forEach(view => {
            const device = view.device_type || 'unknown';
            byDevice[device] = (byDevice[device] || 0) + 1;

            const browser = view.browser || 'unknown';
            byBrowser[browser] = (byBrowser[browser] || 0) + 1;

            const country = view.country || 'Unknown';
            byCountry[country] = (byCountry[country] || 0) + 1;

            const day = new Date(view.created_at).toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
            byDay[day] = (byDay[day] || 0) + 1;
        });

        return {
            totalViews: data?.length || 0,
            byDevice,
            byBrowser,
            byCountry: Object.entries(byCountry)
                .map(([label, value]) => ({ label, value }))
                .sort((a, b) => b.value - a.value),
            byDay: Object.entries(byDay)
                .map(([label, value]) => ({ label, value }))
                .sort((a, b) => new Date(a.label).getTime() - new Date(b.label).getTime())
        };
    } catch (err) {
        console.error('[Analytics] getOrganizerAnalytics failed:', err);
        return { totalViews: 0, byDevice: {}, byBrowser: {}, byCountry: [], byDay: [] };
    }
};

/**
 * Parse user agent to extract device, browser, and OS info
 */
export const parseUserAgent = (userAgent) => {
    if (!userAgent) {
        return { deviceType: 'unknown', browser: 'unknown', os: 'unknown' };
    }

    const ua = userAgent.toLowerCase();

    // Detect device type
    let deviceType = 'Desktop';
    if (/mobile|android|iphone|ipad|ipod|blackberry|windows phone/i.test(ua)) {
        deviceType = /ipad|tablet/i.test(ua) ? 'Tablet' : 'Mobile';
    }

    // Detect browser
    let browser = 'Other';
    if (ua.includes('chrome') && !ua.includes('edg')) browser = 'Chrome';
    else if (ua.includes('safari') && !ua.includes('chrome')) browser = 'Safari';
    else if (ua.includes('firefox')) browser = 'Firefox';
    else if (ua.includes('edg')) browser = 'Edge';
    else if (ua.includes('opera') || ua.includes('opr')) browser = 'Opera';

    // Detect OS
    let os = 'Other';
    if (ua.includes('windows')) os = 'Windows';
    else if (ua.includes('mac')) os = 'macOS';
    else if (ua.includes('linux')) os = 'Linux';
    else if (ua.includes('android')) os = 'Android';
    else if (ua.includes('iphone') || ua.includes('ipad')) os = 'iOS';

    return { deviceType, browser, os };
};

export default {
    trackPageView,
    getEventPageViews,
    getOrganizerAnalytics,
    parseUserAgent
};
