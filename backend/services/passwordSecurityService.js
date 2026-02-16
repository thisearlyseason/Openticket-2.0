/**
 * Password Security Service
 * Validates passwords against security best practices and breach databases
 */

import { pwnedPassword } from 'hibp';

/**
 * Password policy configuration
 */
const PASSWORD_POLICY = {
    minLength: 12,
    requireUppercase: true,
    requireLowercase: true,
    requireNumber: true,
    requireSpecial: true,
    preventCommon: true,
    checkBreaches: true
};

/**
 * Common weak passwords to reject
 */
const COMMON_PASSWORDS = [
    'password', 'password123', '123456', '12345678', 'qwerty',
    'abc123', 'monkey', '1234567', 'letmein', 'trustno1',
    'dragon', 'baseball', 'iloveyou', 'master', 'sunshine',
    'ashley', 'bailey', 'passw0rd', 'shadow', '123123',
    'admin', 'welcome', 'login', 'openticket'
];

/**
 * Validate password strength and security
 * @param {string} password - The password to validate
 * @returns {Promise<{valid: boolean, errors: string[], warnings: string[]}>}
 */
export const validatePassword = async (password) => {
    const errors: string[] = [];
    const warnings: string[] = [];

    // Check minimum length
    if (password.length < PASSWORD_POLICY.minLength) {
        errors.push(`Password must be at least ${PASSWORD_POLICY.minLength} characters long`);
    }

    // Check for uppercase letters
    if (PASSWORD_POLICY.requireUppercase && !/[A-Z]/.test(password)) {
        errors.push('Password must contain at least one uppercase letter');
    }

    // Check for lowercase letters
    if (PASSWORD_POLICY.requireLowercase && !/[a-z]/.test(password)) {
        errors.push('Password must contain at least one lowercase letter');
    }

    // Check for numbers
    if (PASSWORD_POLICY.requireNumber && !/[0-9]/.test(password)) {
        errors.push('Password must contain at least one number');
    }

    // Check for special characters
    if (PASSWORD_POLICY.requireSpecial && !/[!@#$%^&*()_+\-=\[\]{};':"\\|,.<>\/?]/.test(password)) {
        errors.push('Password must contain at least one special character (!@#$%^&*...)');
    }

    // Check against common passwords
    if (PASSWORD_POLICY.preventCommon) {
        const lowerPassword = password.toLowerCase();
        const foundCommon = COMMON_PASSWORDS.some(common => 
            lowerPassword.includes(common) || common.includes(lowerPassword)
        );
        
        if (foundCommon) {
            errors.push('Password is too common. Please choose a more unique password');
        }
    }

    // Check sequential characters
    if (/(.)\1{2,}/.test(password)) {
        warnings.push('Password contains repeating characters');
    }

    // Check keyboard patterns
    const keyboardPatterns = ['qwerty', 'asdfgh', 'zxcvbn', '123456', 'abcdef'];
    const lowerPassword = password.toLowerCase();
    const hasPattern = keyboardPatterns.some(pattern => 
        lowerPassword.includes(pattern)
    );
    
    if (hasPattern) {
        warnings.push('Password contains keyboard patterns (e.g., qwerty, 123456)');
    }

    // Check against breach database (only if basic validation passes)
    if (PASSWORD_POLICY.checkBreaches && errors.length === 0) {
        try {
            console.log('[Password Security] Checking against breach database...');
            
            const breachCount = await pwnedPassword(password);
            
            if (breachCount > 0) {
                errors.push(
                    `This password has been found in ${breachCount.toLocaleString()} data breaches. ` +
                    'Please choose a different password.'
                );
                console.warn('[Password Security] ⚠️ Password found in breach database', { breachCount });
            } else {
                console.log('[Password Security] ✅ Password not found in breach database');
            }
        } catch (error) {
            // Don't fail validation if breach check service is down
            console.error('[Password Security] Breach check failed:', error);
            warnings.push('Could not verify against breach database. Please ensure password is unique.');
        }
    }

    return {
        valid: errors.length === 0,
        errors,
        warnings
    };
};

/**
 * Calculate password strength score (0-100)
 * @param {string} password
 * @returns {number} Score from 0-100
 */
export const calculatePasswordStrength = (password) => {
    let score = 0;

    // Length score (max 40 points)
    if (password.length >= 12) score += 20;
    if (password.length >= 16) score += 10;
    if (password.length >= 20) score += 10;

    // Character variety (max 40 points)
    if (/[a-z]/.test(password)) score += 10;
    if (/[A-Z]/.test(password)) score += 10;
    if (/[0-9]/.test(password)) score += 10;
    if (/[!@#$%^&*()_+\-=\[\]{};':"\\|,.<>\/?]/.test(password)) score += 10;

    // Entropy check (max 20 points)
    const uniqueChars = new Set(password).size;
    if (uniqueChars >= 8) score += 10;
    if (uniqueChars >= 12) score += 10;

    return Math.min(score, 100);
};

/**
 * Get password strength label
 * @param {number} score - Strength score
 * @returns {{label: string, color: string}}
 */
export const getPasswordStrengthLabel = (score) => {
    if (score >= 80) return { label: 'Strong', color: 'green' };
    if (score >= 60) return { label: 'Good', color: 'blue' };
    if (score >= 40) return { label: 'Fair', color: 'yellow' };
    if (score >= 20) return { label: 'Weak', color: 'orange' };
    return { label: 'Very Weak', color: 'red' };
};

export default {
    validatePassword,
    calculatePasswordStrength,
    getPasswordStrengthLabel,
    PASSWORD_POLICY
};
