import rateLimit from 'express-rate-limit';

/**
 * Rate Limiting Middleware
 * Prevents abuse and ensures fair usage
 */

/**
 * Checkout session creation rate limiter
 * Limits: 10 checkout sessions per hour per IP
 */
export const checkoutRateLimiter = rateLimit({
    windowMs: 60 * 60 * 1000, // 1 hour
    max: 10, // 10 requests per hour per IP
    message: {
        error: 'Too many checkout attempts. Please try again later.',
        code: 'RATE_LIMIT_EXCEEDED',
        retryAfter: '1 hour'
    },
    standardHeaders: true, // Return rate limit info in the `RateLimit-*` headers
    legacyHeaders: false, // Disable the `X-RateLimit-*` headers
    skipSuccessfulRequests: false, // Count all requests
    skipFailedRequests: false,
    handler: (req, res) => {
        console.warn(`[RateLimit] Checkout rate limit exceeded for IP: ${req.ip}`);
        res.status(429).json({
            error: 'Too many checkout attempts from this IP. Please try again in 1 hour.',
            code: 'RATE_LIMIT_EXCEEDED',
            retryAfter: 3600 // seconds
        });
    }
});

/**
 * Payout request rate limiter
 * Limits: 5 payout requests per day per user
 */
export const payoutRateLimiter = rateLimit({
    windowMs: 24 * 60 * 60 * 1000, // 24 hours
    max: 5, // 5 payout requests per day
    message: {
        error: 'Too many payout requests. Please try again tomorrow.',
        code: 'PAYOUT_RATE_LIMIT_EXCEEDED',
        retryAfter: '24 hours'
    },
    standardHeaders: true,
    legacyHeaders: false,
    keyGenerator: (req) => {
        // Use user ID instead of IP for authenticated requests
        return req.user?.id || req.ip;
    },
    handler: (req, res) => {
        console.warn(`[RateLimit] Payout rate limit exceeded for user: ${req.user?.id || req.ip}`);
        res.status(429).json({
            error: 'You have reached the maximum number of payout requests for today. Please try again tomorrow.',
            code: 'PAYOUT_RATE_LIMIT_EXCEEDED',
            retryAfter: 86400 // seconds
        });
    }
});

/**
 * Webhook rate limiter (more lenient)
 * Limits: 1000 requests per hour per IP (Stripe webhooks)
 */
export const webhookRateLimiter = rateLimit({
    windowMs: 60 * 60 * 1000, // 1 hour
    max: 1000, // 1000 requests per hour (Stripe can send many)
    message: {
        error: 'Webhook rate limit exceeded',
        code: 'WEBHOOK_RATE_LIMIT_EXCEEDED'
    },
    standardHeaders: true,
    legacyHeaders: false,
    skipSuccessfulRequests: false,
    handler: (req, res) => {
        console.error(`[RateLimit] Webhook rate limit exceeded for IP: ${req.ip}`);
        res.status(429).json({
            error: 'Too many webhook requests',
            code: 'WEBHOOK_RATE_LIMIT_EXCEEDED'
        });
    }
});

/**
 * General API rate limiter
 * Limits: 100 requests per 15 minutes per IP
 */
export const generalRateLimiter = rateLimit({
    windowMs: 15 * 60 * 1000, // 15 minutes
    max: 100, // 100 requests per 15 minutes
    message: {
        error: 'Too many requests. Please slow down.',
        code: 'RATE_LIMIT_EXCEEDED',
        retryAfter: '15 minutes'
    },
    standardHeaders: true,
    legacyHeaders: false,
    skipSuccessfulRequests: false,
    handler: (req, res) => {
        console.warn(`[RateLimit] General rate limit exceeded for IP: ${req.ip}`);
        res.status(429).json({
            error: 'Too many API requests. Please try again in 15 minutes.',
            code: 'RATE_LIMIT_EXCEEDED',
            retryAfter: 900
        });
    }
});

/**
 * Strict rate limiter for sensitive operations
 * Limits: 3 requests per minute per IP (login, password reset, etc.)
 */
export const strictRateLimiter = rateLimit({
    windowMs: 60 * 1000, // 1 minute
    max: 3, // 3 requests per minute
    message: {
        error: 'Too many attempts. Please wait a moment and try again.',
        code: 'STRICT_RATE_LIMIT_EXCEEDED',
        retryAfter: '1 minute'
    },
    standardHeaders: true,
    legacyHeaders: false,
    skipSuccessfulRequests: false,
    handler: (req, res) => {
        console.warn(`[RateLimit] Strict rate limit exceeded for IP: ${req.ip}`);
        res.status(429).json({
            error: 'Too many attempts. Please wait 1 minute and try again.',
            code: 'STRICT_RATE_LIMIT_EXCEEDED',
            retryAfter: 60
        });
    }
});
