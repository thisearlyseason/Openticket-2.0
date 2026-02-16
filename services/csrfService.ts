/**
 * CSRF Token Service
 * Handles fetching and managing CSRF tokens for secure API requests
 */

const API_URL = import.meta.env.VITE_BACKEND_URL || 'http://localhost:8001';

let csrfToken: string | null = null;
let tokenExpiryTime: number = 0;

/**
 * Fetch a fresh CSRF token from the server
 */
export const fetchCsrfToken = async (): Promise<string> => {
    try {
        const response = await fetch(`${API_URL}/api/csrf-token`, {
            method: 'GET',
            credentials: 'include', // Important: Include cookies
            headers: {
                'Content-Type': 'application/json'
            }
        });

        if (!response.ok) {
            throw new Error('Failed to fetch CSRF token');
        }

        const data = await response.json();
        csrfToken = data.csrfToken;
        tokenExpiryTime = Date.now() + 3500000; // 58 minutes (tokens expire after 1 hour)

        console.log('[CSRF] ✅ Token fetched successfully');
        return csrfToken;
    } catch (error) {
        console.error('[CSRF] Error fetching token:', error);
        throw error;
    }
};

/**
 * Get the current CSRF token, fetching a new one if needed
 */
export const getCsrfToken = async (): Promise<string> => {
    // If token exists and hasn't expired, return it
    if (csrfToken && Date.now() < tokenExpiryTime) {
        return csrfToken;
    }

    // Otherwise, fetch a new token
    return await fetchCsrfToken();
};

/**
 * Clear the stored CSRF token (e.g., on logout)
 */
export const clearCsrfToken = (): void => {
    csrfToken = null;
    tokenExpiryTime = 0;
};

/**
 * Make a CSRF-protected API request
 */
export const csrfFetch = async (url: string, options: RequestInit = {}): Promise<Response> => {
    // Skip CSRF for GET, HEAD, OPTIONS requests
    const method = options.method?.toUpperCase() || 'GET';
    if (['GET', 'HEAD', 'OPTIONS'].includes(method)) {
        return fetch(url, {
            ...options,
            credentials: 'include'
        });
    }

    // Get CSRF token
    const token = await getCsrfToken();

    // Add CSRF token to headers
    const headers = new Headers(options.headers || {});
    headers.set('X-CSRF-Token', token);

    // Make the request with credentials
    return fetch(url, {
        ...options,
        headers,
        credentials: 'include' // Important: Include cookies
    });
};

/**
 * Axios interceptor configuration for CSRF
 * Use this with axios.create() or axios.interceptors
 */
export const configureAxiosCsrf = async (axiosInstance: any) => {
    // Request interceptor: Add CSRF token to all state-changing requests
    axiosInstance.interceptors.request.use(
        async (config: any) => {
            // Skip for GET, HEAD, OPTIONS
            if (['get', 'head', 'options'].includes(config.method?.toLowerCase())) {
                return config;
            }

            // Get CSRF token
            const token = await getCsrfToken();
            
            // Add CSRF header
            config.headers['X-CSRF-Token'] = token;
            
            // Ensure credentials are included
            config.withCredentials = true;

            return config;
        },
        (error: any) => {
            return Promise.reject(error);
        }
    );

    // Response interceptor: Handle CSRF token errors
    axiosInstance.interceptors.response.use(
        (response: any) => response,
        async (error: any) => {
            if (error.response?.status === 403 && error.response?.data?.code === 'EBADCSRFTOKEN') {
                console.warn('[CSRF] Token invalid, refreshing...');
                
                // Clear old token and retry
                clearCsrfToken();
                const newToken = await getCsrfToken();
                
                // Retry the original request with new token
                const config = error.config;
                config.headers['X-CSRF-Token'] = newToken;
                
                return axiosInstance.request(config);
            }
            
            return Promise.reject(error);
        }
    );
};
