/**
 * Share Utilities - Platform-compliant sharing for events and pages
 * Handles Web Share API, clipboard fallbacks, and platform-specific behaviors
 */

export interface ShareData {
    title: string;
    text: string;
    url: string;
    imageUrl?: string;
}

export interface ShareResult {
    success: boolean;
    method: 'native' | 'clipboard' | 'fallback';
    message: string;
}

/**
 * Check if Web Share API is available
 */
export const canUseNativeShare = (): boolean => {
    return typeof navigator !== 'undefined' && 
           typeof navigator.share === 'function' &&
           typeof navigator.canShare === 'function';
};

/**
 * Check if we're on a mobile device
 */
export const isMobileDevice = (): boolean => {
    if (typeof window === 'undefined') return false;
    return /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(
        navigator.userAgent
    );
};

/**
 * Copy text to clipboard with fallback
 */
export const copyToClipboard = async (text: string): Promise<boolean> => {
    try {
        if (navigator.clipboard && navigator.clipboard.writeText) {
            await navigator.clipboard.writeText(text);
            return true;
        }
        
        // Fallback for older browsers
        const textArea = document.createElement('textarea');
        textArea.value = text;
        textArea.style.position = 'fixed';
        textArea.style.left = '-999999px';
        textArea.style.top = '-999999px';
        document.body.appendChild(textArea);
        textArea.focus();
        textArea.select();
        
        const result = document.execCommand('copy');
        document.body.removeChild(textArea);
        return result;
    } catch (error) {
        console.error('[Share] Clipboard copy failed:', error);
        return false;
    }
};

/**
 * Share using Web Share API (mobile-first)
 */
export const nativeShare = async (data: ShareData): Promise<ShareResult> => {
    try {
        if (!canUseNativeShare()) {
            return { success: false, method: 'fallback', message: 'Web Share API not available' };
        }

        const shareData: ShareData = {
            title: data.title,
            text: data.text,
            url: data.url
        };

        // Check if we can share this data
        if (navigator.canShare && !navigator.canShare(shareData)) {
            return { success: false, method: 'fallback', message: 'Cannot share this content' };
        }

        await navigator.share(shareData);
        return { success: true, method: 'native', message: 'Shared successfully!' };
    } catch (error: any) {
        // User cancelled or share failed
        if (error.name === 'AbortError') {
            return { success: false, method: 'native', message: 'Share cancelled' };
        }
        console.error('[Share] Native share failed:', error);
        return { success: false, method: 'fallback', message: error.message || 'Share failed' };
    }
};

/**
 * Instagram-specific share handler
 * Instagram does NOT support direct web sharing - we handle this gracefully
 */
export const shareToInstagram = async (data: ShareData): Promise<ShareResult> => {
    const shareText = `${data.title}\n\n${data.text}\n\n${data.url}`;
    
    // On mobile, try native share first - user can choose Instagram from share sheet
    if (isMobileDevice() && canUseNativeShare()) {
        const result = await nativeShare(data);
        if (result.success) {
            return {
                success: true,
                method: 'native',
                message: 'Share sheet opened - select Instagram to share'
            };
        }
    }
    
    // Fallback: Copy to clipboard and provide guidance
    const copied = await copyToClipboard(shareText);
    
    if (copied) {
        // Open Instagram in new tab
        window.open('https://www.instagram.com/', '_blank');
        
        return {
            success: true,
            method: 'clipboard',
            message: "Link copied! Instagram doesn't support direct sharing from websites. Paste the link in your Story or Bio."
        };
    }
    
    return {
        success: false,
        method: 'fallback',
        message: 'Unable to copy to clipboard. Please copy the link manually.'
    };
};

/**
 * Generic share handler with platform detection
 */
export const shareContent = async (
    platform: 'twitter' | 'facebook' | 'instagram' | 'whatsapp' | 'email' | 'copy' | 'native',
    data: ShareData
): Promise<ShareResult> => {
    const encodedUrl = encodeURIComponent(data.url);
    const encodedTitle = encodeURIComponent(data.title);
    const encodedText = encodeURIComponent(data.text);
    
    switch (platform) {
        case 'native':
            return await nativeShare(data);
            
        case 'twitter':
            window.open(
                `https://twitter.com/intent/tweet?text=${encodedTitle}&url=${encodedUrl}`,
                '_blank',
                'noopener,noreferrer'
            );
            return { success: true, method: 'fallback', message: 'Opening X/Twitter...' };
            
        case 'facebook':
            window.open(
                `https://www.facebook.com/sharer/sharer.php?u=${encodedUrl}`,
                '_blank',
                'noopener,noreferrer'
            );
            return { success: true, method: 'fallback', message: 'Opening Facebook...' };
            
        case 'instagram':
            return await shareToInstagram(data);
            
        case 'whatsapp':
            window.open(
                `https://wa.me/?text=${encodedText}%20${encodedUrl}`,
                '_blank',
                'noopener,noreferrer'
            );
            return { success: true, method: 'fallback', message: 'Opening WhatsApp...' };
            
        case 'email':
            window.open(
                `mailto:?subject=${encodedTitle}&body=${encodedText}%0A%0A${encodedUrl}`,
                '_blank'
            );
            return { success: true, method: 'fallback', message: 'Opening email client...' };
            
        case 'copy':
            const copied = await copyToClipboard(data.url);
            return {
                success: copied,
                method: 'clipboard',
                message: copied ? 'Link copied to clipboard!' : 'Failed to copy link'
            };
            
        default:
            return { success: false, method: 'fallback', message: 'Unknown platform' };
    }
};

/**
 * Get share data for an event
 */
export const getEventShareData = (event: { id: string; title: string; subtitle?: string; description?: string }): ShareData => {
    const baseUrl = typeof window !== 'undefined' ? window.location.origin : '';
    return {
        title: event.title,
        text: event.subtitle || event.description?.substring(0, 100) || 'Check out this event!',
        url: `${baseUrl}/#/event/${event.id}`
    };
};

/**
 * Get share data for the Explore page
 */
export const getExploreShareData = (): ShareData => {
    const baseUrl = typeof window !== 'undefined' ? window.location.origin : '';
    return {
        title: 'Discover events on OpenTicket',
        text: 'Find and share amazing events happening now! 🎉',
        url: `${baseUrl}/#/browse`
    };
};

export default {
    canUseNativeShare,
    isMobileDevice,
    copyToClipboard,
    nativeShare,
    shareToInstagram,
    shareContent,
    getEventShareData,
    getExploreShareData
};
