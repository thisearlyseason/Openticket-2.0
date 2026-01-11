import crypto from 'crypto';

/**
 * Generate a unique ticket ID
 * Format: TKT-{timestamp}-{random}
 * Example: TKT-1736789012345-a7f3x9
 */
export function generateTicketId() {
    const timestamp = Date.now();
    const randomPart = crypto.randomBytes(3).toString('hex');
    return `TKT-${timestamp}-${randomPart}`;
}

/**
 * Generate a human-readable ticket number
 * Format: TKT-{RANDOM6}
 * Example: TKT-A7F3X9
 */
export function generateTicketNumber() {
    const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'; // Exclude similar chars (0,O,1,I)
    let result = 'TKT-';
    for (let i = 0; i < 6; i++) {
        result += chars.charAt(Math.floor(Math.random() * chars.length));
    }
    return result;
}

/**
 * Transform legacy ticket structure to new unique ticket structure
 * Converts tickets with quantity > 1 into individual ticket objects
 * 
 * @param {Array} tickets - Original tickets array with quantity field
 * @param {String} registrationId - Registration ID for reference
 * @param {String} attendeeName - Primary buyer name
 * @param {Array} assignedNames - Optional array of names assigned during checkout
 * @returns {Array} - Array of individual ticket objects with unique IDs
 */
export function generateUniqueTickets(tickets, registrationId, attendeeName, assignedNames = []) {
    const uniqueTickets = [];
    let assignedIndex = 0;
    
    tickets.forEach((tier, tierIndex) => {
        const quantity = tier.quantity || 1;
        
        for (let i = 0; i < quantity; i++) {
            const ticketId = generateTicketId();
            const ticketNumber = generateTicketNumber();
            
            // Determine attendee name: use assigned name if available, otherwise use buyer name
            let ticketAttendeeName = attendeeName;
            if (assignedNames && assignedNames[assignedIndex]) {
                ticketAttendeeName = assignedNames[assignedIndex];
            }
            assignedIndex++;
            
            uniqueTickets.push({
                // Unique identifiers (NEW)
                ticketId: ticketId,
                ticketNumber: ticketNumber,
                qrCodeData: ticketId, // QR code encodes only the unique ticket ID
                
                // Tier information (existing)
                tierId: tier.tierId || tier.id,
                name: tier.name,
                price: tier.price,
                
                // Individual ticket quantity is always 1
                quantity: 1,
                
                // Attendee information
                attendeeName: ticketAttendeeName,
                originalAttendeeName: null, // For transfer history
                
                // Status tracking
                status: 'valid',
                checkedIn: false,
                checkedInAt: null,
                checkedInBy: null,
                
                // Transfer tracking
                transferStatus: null, // null | 'transferred_out' | 'transferred_in'
                transferredToEmail: null,
                transferredToUserId: null,
                transferredFromEmail: null,
                transferredFromUserId: null,
                transferId: null,
                
                // Legacy compatibility (keep for backward compatibility)
                key: `${tier.tierId || tier.id}-${i}`,
                id: tier.id || tier.tierId,
                
                // Metadata
                createdAt: new Date().toISOString(),
                tierIndex: tierIndex,
                indexInTier: i
            });
        }
    });
    
    return uniqueTickets;
}

/**
 * Validate a QR code against a ticket ID
 * @param {String} scannedData - Data from QR code
 * @param {String} ticketId - Expected ticket ID
 * @returns {Boolean} - True if valid
 */
export function validateQRCode(scannedData, ticketId) {
    // New format: Direct ticket ID
    if (scannedData === ticketId) {
        return true;
    }
    
    // Legacy format: TICKET:{regId}:{tierId}:{index}
    if (scannedData.startsWith('TICKET:')) {
        // For backward compatibility with old QR codes
        return false; // Old format no longer valid, requires re-generation
    }
    
    return false;
}

/**
 * Extract ticket info from legacy QR format (for migration)
 * @param {String} qrData - Legacy QR code data
 * @returns {Object|null} - Parsed ticket info or null
 */
export function parseLegacyQR(qrData) {
    if (!qrData.startsWith('TICKET:')) {
        return null;
    }
    
    const parts = qrData.split(':');
    if (parts.length >= 4) {
        return {
            registrationId: parts[1],
            tierId: parts[2],
            index: parseInt(parts[3], 10)
        };
    }
    
    return null;
}
