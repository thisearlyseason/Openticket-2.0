/**
 * Input Validation Middleware
 * Centralized validation rules for all API endpoints
 */

import { body, param, query, validationResult } from 'express-validator';

/**
 * Handle validation errors
 */
export const handleValidationErrors = (req, res, next) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
        console.warn('[Validation] Request validation failed:', {
            path: req.path,
            errors: errors.array()
        });
        return res.status(400).json({
            error: 'Validation failed',
            details: errors.array().map(err => ({
                field: err.path,
                message: err.msg,
                value: err.value
            }))
        });
    }
    next();
};

/**
 * Common validation rules
 */
export const commonRules = {
    email: body('email')
        .isEmail()
        .normalizeEmail()
        .withMessage('Valid email is required'),
    
    password: body('password')
        .isLength({ min: 12, max: 128 })
        .withMessage('Password must be between 12 and 128 characters'),
    
    name: (field) => body(field)
        .trim()
        .isLength({ min: 1, max: 100 })
        .escape()
        .withMessage(`${field} must be between 1 and 100 characters`),
    
    uuid: (field) => param(field)
        .isUUID()
        .withMessage(`${field} must be a valid UUID`),
    
    positiveNumber: (field) => body(field)
        .optional()
        .isFloat({ min: 0 })
        .withMessage(`${field} must be a positive number`),
    
    positiveInteger: (field) => body(field)
        .optional()
        .isInt({ min: 0 })
        .withMessage(`${field} must be a positive integer`)
};

/**
 * Event creation/update validation
 */
export const validateEvent = [
    body('title')
        .trim()
        .isLength({ min: 1, max: 200 })
        .escape()
        .withMessage('Title must be between 1 and 200 characters'),
    
    body('description')
        .optional()
        .trim()
        .isLength({ max: 5000 })
        .withMessage('Description must not exceed 5000 characters'),
    
    body('location')
        .optional()
        .trim()
        .isLength({ max: 500 })
        .escape()
        .withMessage('Location must not exceed 500 characters'),
    
    body('capacity')
        .optional()
        .isInt({ min: 1, max: 1000000 })
        .withMessage('Capacity must be between 1 and 1,000,000'),
    
    body('price')
        .optional()
        .isFloat({ min: 0, max: 999999.99 })
        .withMessage('Price must be between 0 and 999,999.99'),
    
    body('date')
        .isISO8601()
        .withMessage('Valid date is required'),
    
    body('start_time')
        .optional()
        .matches(/^([01]?[0-9]|2[0-3]):[0-5][0-9]$/)
        .withMessage('Start time must be in HH:MM format'),
    
    body('end_time')
        .optional()
        .matches(/^([01]?[0-9]|2[0-3]):[0-5][0-9]$/)
        .withMessage('End time must be in HH:MM format'),
    
    handleValidationErrors
];

/**
 * Stripe payment validation
 */
export const validatePayment = [
    body('eventId')
        .isString()
        .notEmpty()
        .withMessage('Event ID is required'),
    
    body('ticketSelections')
        .isArray({ min: 1 })
        .withMessage('At least one ticket selection is required'),
    
    body('ticketSelections.*.tierId')
        .isString()
        .notEmpty()
        .withMessage('Ticket tier ID is required'),
    
    body('ticketSelections.*.quantity')
        .isInt({ min: 1, max: 100 })
        .withMessage('Quantity must be between 1 and 100'),
    
    body('ticketSelections.*.price')
        .isFloat({ min: 0 })
        .withMessage('Price must be a valid number'),
    
    body('attendeeInfo.name')
        .trim()
        .isLength({ min: 1, max: 200 })
        .escape()
        .withMessage('Attendee name is required'),
    
    body('attendeeInfo.email')
        .isEmail()
        .normalizeEmail()
        .withMessage('Valid attendee email is required'),
    
    body('donationAmount')
        .optional()
        .isFloat({ min: 0, max: 10000 })
        .withMessage('Donation amount must be between 0 and 10,000'),
    
    handleValidationErrors
];

/**
 * Registration validation
 */
export const validateRegistration = [
    body('eventId')
        .isString()
        .notEmpty()
        .withMessage('Event ID is required'),
    
    body('attendee_name')
        .trim()
        .isLength({ min: 1, max: 200 })
        .escape()
        .withMessage('Attendee name is required'),
    
    body('attendee_email')
        .isEmail()
        .normalizeEmail()
        .withMessage('Valid email is required'),
    
    body('quantity')
        .isInt({ min: 1, max: 100 })
        .withMessage('Quantity must be between 1 and 100'),
    
    handleValidationErrors
];

/**
 * Presale code validation
 */
export const validatePresaleCode = [
    param('eventId')
        .isString()
        .notEmpty()
        .withMessage('Event ID is required'),
    
    body('code')
        .trim()
        .isLength({ min: 1, max: 50 })
        .matches(/^[A-Z0-9-_]+$/)
        .withMessage('Code must be alphanumeric (uppercase) with hyphens or underscores'),
    
    body('limit_type')
        .isIn(['single', 'multi', 'unlimited'])
        .withMessage('Limit type must be single, multi, or unlimited'),
    
    body('max_uses')
        .optional()
        .isInt({ min: 1 })
        .withMessage('Max uses must be at least 1'),
    
    body('name')
        .optional()
        .trim()
        .isLength({ max: 100 })
        .escape()
        .withMessage('Name must not exceed 100 characters'),
    
    handleValidationErrors
];

/**
 * Admin action validation
 */
export const validateAdminAction = [
    body('userId')
        .optional()
        .isString()
        .notEmpty()
        .withMessage('User ID must be a valid string'),
    
    body('reason')
        .optional()
        .trim()
        .isLength({ min: 10, max: 500 })
        .escape()
        .withMessage('Reason must be between 10 and 500 characters'),
    
    handleValidationErrors
];

/**
 * Email validation
 */
export const validateEmail = [
    body('to')
        .isEmail()
        .normalizeEmail()
        .withMessage('Valid recipient email is required'),
    
    body('subject')
        .trim()
        .isLength({ min: 1, max: 200 })
        .escape()
        .withMessage('Subject must be between 1 and 200 characters'),
    
    body('body')
        .trim()
        .isLength({ min: 1, max: 10000 })
        .withMessage('Body must be between 1 and 10,000 characters'),
    
    handleValidationErrors
];

/**
 * Query parameter validation
 */
export const validateQueryParams = {
    pagination: [
        query('page')
            .optional()
            .isInt({ min: 1 })
            .withMessage('Page must be a positive integer'),
        
        query('limit')
            .optional()
            .isInt({ min: 1, max: 100 })
            .withMessage('Limit must be between 1 and 100'),
        
        handleValidationErrors
    ],
    
    search: [
        query('q')
            .trim()
            .isLength({ min: 1, max: 200 })
            .escape()
            .withMessage('Search query must be between 1 and 200 characters'),
        
        handleValidationErrors
    ]
};

export default {
    commonRules,
    validateEvent,
    validatePayment,
    validateRegistration,
    validatePresaleCode,
    validateAdminAction,
    validateEmail,
    validateQueryParams,
    handleValidationErrors
};
