import React from 'react';

interface LogoProps {
    variant?: 'light' | 'dark';
    className?: string;
    size?: 'sm' | 'md' | 'lg' | 'xl';
}

export const Logo: React.FC<LogoProps> = ({ 
    variant = 'dark', 
    className = '',
    size = 'md'
}) => {
    const sizeClasses = {
        sm: 'h-6',
        md: 'h-8',
        lg: 'h-10',
        xl: 'h-12'
    };

    const logoSrc = variant === 'dark' 
        ? '/logo-dark.png'  // White text for dark backgrounds
        : '/logo-light.png';  // Dark text for light backgrounds

    return (
        <img 
            src={logoSrc} 
            alt="OpenTicket" 
            className={`${sizeClasses[size]} w-auto object-contain ${className}`}
        />
    );
};

// Auto-detecting theme variant
export const LogoAuto: React.FC<Omit<LogoProps, 'variant'>> = ({ className = '', size = 'md' }) => {
    const sizeClasses = {
        sm: 'h-6',
        md: 'h-8',
        lg: 'h-10',
        xl: 'h-12'
    };

    return (
        <>
            <img 
                src="/logo-dark.png" 
                alt="OpenTicket" 
                className={`hidden dark:block ${sizeClasses[size]} w-auto object-contain ${className}`}
            />
            <img 
                src="/logo-light.png" 
                alt="OpenTicket" 
                className={`block dark:hidden ${sizeClasses[size]} w-auto object-contain ${className}`}
            />
        </>
    );
};
