/**
 * Cache Utilities for handling service worker and browser cache
 */

// Check if service worker is supported
export const isServiceWorkerSupported = () => 'serviceWorker' in navigator;

// Get current service worker version
export const getServiceWorkerVersion = async (): Promise<string | null> => {
    if (!isServiceWorkerSupported()) return null;
    
    try {
        const registration = await navigator.serviceWorker.getRegistration();
        if (registration?.active) {
            // The version is embedded in the SW, we'll read it from a message
            return 'v4'; // Hardcoded for now, could be dynamic via message
        }
        return null;
    } catch (e) {
        console.error('Error getting SW version:', e);
        return null;
    }
};

// Clear all caches and unregister service worker
export const clearAllCaches = async (): Promise<{ success: boolean; message: string }> => {
    try {
        // 1. Clear Cache Storage (service worker caches)
        if ('caches' in window) {
            const cacheNames = await caches.keys();
            console.log('[CacheUtils] Clearing caches:', cacheNames);
            await Promise.all(cacheNames.map(name => caches.delete(name)));
        }
        
        // 2. Unregister service workers
        if (isServiceWorkerSupported()) {
            const registrations = await navigator.serviceWorker.getRegistrations();
            for (const registration of registrations) {
                console.log('[CacheUtils] Unregistering SW:', registration.scope);
                await registration.unregister();
            }
        }
        
        // 3. Clear localStorage (optional, preserve auth)
        // We won't clear localStorage as it contains auth state
        
        // 4. Clear sessionStorage
        sessionStorage.clear();
        
        return { 
            success: true, 
            message: 'Cache cleared successfully. The page will reload with fresh content.' 
        };
    } catch (error) {
        console.error('[CacheUtils] Error clearing cache:', error);
        return { 
            success: false, 
            message: `Failed to clear cache: ${error}` 
        };
    }
};

// Force update service worker
export const updateServiceWorker = async (): Promise<boolean> => {
    if (!isServiceWorkerSupported()) return false;
    
    try {
        const registration = await navigator.serviceWorker.getRegistration();
        if (registration) {
            await registration.update();
            
            // If there's a waiting worker, tell it to skip waiting
            if (registration.waiting) {
                registration.waiting.postMessage({ type: 'SKIP_WAITING' });
            }
            return true;
        }
        return false;
    } catch (e) {
        console.error('Error updating service worker:', e);
        return false;
    }
};

// Get build info (injected by Vite)
export const getBuildInfo = () => {
    try {
        return {
            timestamp: (window as any).__BUILD_TIMESTAMP__ || 'dev',
            date: (window as any).__BUILD_DATE__ || new Date().toISOString()
        };
    } catch {
        return { timestamp: 'unknown', date: 'unknown' };
    }
};

// Full refresh with cache clear
export const hardRefresh = async () => {
    await clearAllCaches();
    // Use location.reload(true) is deprecated, but this achieves similar effect
    window.location.href = window.location.href.split('?')[0] + '?_=' + Date.now();
};

export default {
    isServiceWorkerSupported,
    getServiceWorkerVersion,
    clearAllCaches,
    updateServiceWorker,
    getBuildInfo,
    hardRefresh
};
