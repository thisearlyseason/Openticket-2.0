/**
 * API Service with CSRF Protection
 * Wraps fetch calls with automatic CSRF token injection
 */
import { csrfFetch, getCsrfToken } from './csrfService';

const API_URL = import.meta.env.VITE_BACKEND_URL || 'http://localhost:8001';

/**
 * Make a CSRF-protected API request
 * Automatically adds CSRF token to state-changing requests
 */
export const apiRequest = async (
    endpoint: string,
    options: RequestInit = {}
): Promise<Response> => {
    const url = `${API_URL}${endpoint}`;
    
    // Use csrfFetch which automatically handles CSRF tokens
    return csrfFetch(url, {
        ...options,
        credentials: 'include'
    });
};

/**
 * Helper for GET requests
 */
export const apiGet = async (endpoint: string, options: RequestInit = {}): Promise<Response> => {
    return apiRequest(endpoint, {
        ...options,
        method: 'GET'
    });
};

/**
 * Helper for POST requests with JSON body
 */
export const apiPost = async (
    endpoint: string,
    data?: any,
    options: RequestInit = {}
): Promise<Response> => {
    return apiRequest(endpoint, {
        ...options,
        method: 'POST',
        headers: {
            'Content-Type': 'application/json',
            ...options.headers
        },
        body: data ? JSON.stringify(data) : undefined
    });
};

/**
 * Helper for PUT requests with JSON body
 */
export const apiPut = async (
    endpoint: string,
    data?: any,
    options: RequestInit = {}
): Promise<Response> => {
    return apiRequest(endpoint, {
        ...options,
        method: 'PUT',
        headers: {
            'Content-Type': 'application/json',
            ...options.headers
        },
        body: data ? JSON.stringify(data) : undefined
    });
};

/**
 * Helper for DELETE requests
 */
export const apiDelete = async (
    endpoint: string,
    options: RequestInit = {}
): Promise<Response> => {
    return apiRequest(endpoint, {
        ...options,
        method: 'DELETE'
    });
};

/**
 * Helper for PATCH requests with JSON body
 */
export const apiPatch = async (
    endpoint: string,
    data?: any,
    options: RequestInit = {}
): Promise<Response> => {
    return apiRequest(endpoint, {
        ...options,
        method: 'PATCH',
        headers: {
            'Content-Type': 'application/json',
            ...options.headers
        },
        body: data ? JSON.stringify(data) : undefined
    });
};

/**
 * Get CSRF token (useful for manual fetch calls)
 */
export { getCsrfToken };

/**
 * Export API URL for components that need it
 */
export { API_URL };
