/**
 * Email Template Unit Tests
 * Tests for purchaseConfirmation, presaleSignupConfirmation, eventReminder
 * Verifies: ticket price display, QR code URL, header text, fee breakdown, footer
 */

import { readFileSync } from 'fs';
import { resolve, dirname } from 'path';
import { fileURLToPath } from 'url';

// Set process.env before import so the template uses our test value
process.env.FRONTEND_URL = 'https://www.openticket.events';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

// Import the unified email templates
const templatePath = resolve(__dirname, '../services/unifiedEmailTemplates.js');

let purchaseConfirmation, presaleSignupConfirmation, eventReminder;

async function loadTemplates() {
    const mod = await import(templatePath);
    purchaseConfirmation = mod.purchaseConfirmation;
    presaleSignupConfirmation = mod.presaleSignupConfirmation;
    eventReminder = mod.eventReminder;
}

// ========== TEST HELPERS ==========
let passed = 0;
let failed = 0;

function test(name, fn) {
    try {
        fn();
        console.log(`  ✅ PASS: ${name}`);
        passed++;
    } catch (e) {
        console.log(`  ❌ FAIL: ${name}`);
        console.log(`         Error: ${e.message}`);
        failed++;
    }
}

function assert(condition, message) {
    if (!condition) throw new Error(message || 'Assertion failed');
}

function assertContains(html, text, label) {
    if (!html.includes(text)) {
        throw new Error(`Expected HTML to contain "${text}"${label ? ` [${label}]` : ''}`);
    }
}

function assertNotContains(html, text, label) {
    if (html.includes(text)) {
        throw new Error(`Expected HTML NOT to contain "${text}"${label ? ` [${label}]` : ''}`);
    }
}

// ========== TEST DATA ==========
const testTickets = [
    {
        id: 'TKT-ABC12345-001',
        name: 'General Admission',
        pricePerTicket: 100,  // This is the FIXED field (old code used t.price = $0 bug)
        attendeeName: 'John Doe',
        registrationId: 'REG-001'
    }
];

const testTicketsWith_price_zero = [
    {
        id: 'TKT-XYZ99999-001',
        name: 'VIP',
        price: 0,              // Old buggy field
        pricePerTicket: 100,   // New correct field
        attendeeName: 'Jane Smith'
    }
];

const testEventDetails = {
    title: 'Summer Music Festival',
    date: 'July 4th, 2026',
    time: '7:00 PM',
    location: 'Madison Square Garden, New York',
    description: 'An incredible summer music experience featuring top artists from around the world.',
    image_url: 'https://example.com/event-banner.jpg'
};

const testOrderDetails = {
    totalPaid: 115.00,
    subtotal: 100.00,
    serviceFee: 8.00,
    stripeFee: 3.50,
    taxAmount: 5.00,
    discountAmount: 0,
    currency: 'USD',
    organizerName: 'SoundWave Productions',
    registrationId: 'REG12345678'
};

// ========== TESTS ==========

async function runPurchaseConfirmationTests() {
    console.log('\n📧 Test Suite: purchaseConfirmation Template');
    console.log('=' .repeat(55));

    const { subject, html } = purchaseConfirmation({
        attendeeName: 'John Doe',
        attendeeEmail: 'john@example.com',
        eventTitle: testEventDetails.title,
        eventDate: testEventDetails.date,
        eventTime: testEventDetails.time,
        eventLocation: testEventDetails.location,
        eventDescription: testEventDetails.description,
        eventImageUrl: testEventDetails.image_url,
        tickets: testTickets,
        totalPaid: testOrderDetails.totalPaid,
        orderId: 'ORD-REG12345',
        organizerName: testOrderDetails.organizerName,
        currency: testOrderDetails.currency,
        subtotal: testOrderDetails.subtotal,
        serviceFee: testOrderDetails.serviceFee,
        stripeFee: testOrderDetails.stripeFee,
        taxAmount: testOrderDetails.taxAmount,
        discountAmount: testOrderDetails.discountAmount,
    });

    // Test 1: HTML is generated (not null/empty)
    test('HTML is generated (non-empty string)', () => {
        assert(typeof html === 'string' && html.length > 100, `HTML is empty or too short: ${html?.length || 0} chars`);
    });

    // Test 2: Subject line is correct
    test("Subject contains event title and You're In!", () => {
        assertContains(subject, "You're In!", 'subject');
        assertContains(subject, testEventDetails.title, 'subject contains event title');
    });

    // Test 3: YOU'RE IN! header present (the new design)
    test("YOU'RE IN! header present (new design)", () => {
        assertContains(html, "YOU'RE IN!", 'hero headline');
    });

    // Test 4: Ticket price shows $100.00 (not $0.00)
    test('Ticket price shows $100.00 (t.pricePerTicket used, not t.price=$0 bug)', () => {
        assertContains(html, '$100.00', 'ticket price display');
        // Ensure $0.00 is NOT shown as the ticket cost
        // (it might appear as subtotal part if it was $0)
        const ticketCostSection = html.match(/Ticket Cost[\s\S]{0,50}\$([0-9.]+)/);
        if (ticketCostSection) {
            assert(ticketCostSection[1] !== '0.00', 'Ticket Cost should NOT be $0.00 - this is the old bug');
        }
    });

    // Test 5: pricePerTicket takes precedence over price=0
    test('When both pricePerTicket=100 and price=0 exist, shows $100.00 (not $0.00)', () => {
        const { html: html2 } = purchaseConfirmation({
            attendeeName: 'Jane',
            attendeeEmail: 'jane@test.com',
            eventTitle: 'Test Event',
            eventDate: 'Aug 1, 2026',
            tickets: testTicketsWith_price_zero,
            totalPaid: 100,
            orderId: 'ORD-TEST',
            currency: 'USD',
        });
        assertContains(html2, '$100.00', 'pricePerTicket precedence over price=0');
    });

    // Test 6: QR code URL contains api.qrserver.com
    test('QR code URL contains api.qrserver.com', () => {
        assertContains(html, 'api.qrserver.com', 'QR code image src');
    });

    // Test 7: QR code URL has correct format
    test('QR code URL has correct format: https://api.qrserver.com/v1/create-qr-code/?size=150x150&data=', () => {
        assertContains(html, 'https://api.qrserver.com/v1/create-qr-code/?size=150x150&data=', 'full QR URL format');
    });

    // Test 8: QR code encodes the ticket ID
    test('QR code encodes ticket ID (TKT-ABC12345-001)', () => {
        // The ticket ID should be URL-encoded in the QR URL
        const encodedId = encodeURIComponent('TKT-ABC12345-001');
        assertContains(html, encodedId, 'QR code data contains encoded ticket ID');
    });

    // Test 9: Fee breakdown - Subtotal row
    test('Fee breakdown contains Subtotal row', () => {
        assertContains(html, 'Subtotal:', 'fee breakdown subtotal');
    });

    // Test 10: Fee breakdown - Platform Cost row
    test('Fee breakdown contains Platform Cost row', () => {
        assertContains(html, 'Platform Cost:', 'fee breakdown platform cost');
    });

    // Test 11: Fee breakdown - Stripe Fee row
    test('Fee breakdown contains Stripe Fee row', () => {
        assertContains(html, 'Stripe Fee:', 'fee breakdown stripe fee');
    });

    // Test 12: Fee breakdown - Tax row
    test('Fee breakdown contains Tax row', () => {
        assertContains(html, 'Tax:', 'fee breakdown tax');
    });

    // Test 13: Fee breakdown - Total Paid row
    test('Fee breakdown contains Total Paid row', () => {
        assertContains(html, 'Total Paid:', 'fee breakdown total paid');
    });

    // Test 14: Total Paid amount is correct ($115.00)
    test('Total Paid shows $115.00', () => {
        assertContains(html, 'Total Paid: $115.00', 'total paid amount');
    });

    // Test 15: Footer contains 'Organized by'
    test("Footer contains 'Organized by'", () => {
        assertContains(html, 'Organized by', 'footer organized by');
    });

    // Test 16: Footer contains organizer name
    test('Footer contains organizer name (SoundWave Productions)', () => {
        assertContains(html, 'SoundWave Productions', 'footer organizer name');
    });

    // Test 17: Footer contains 'Powered by OpenTicket'
    test("Footer contains 'Powered by OpenTicket'", () => {
        assertContains(html, 'Powered by OpenTicket', 'footer powered by');
    });

    // Test 18: Event image is rendered
    test('Event image is rendered in the email', () => {
        assertContains(html, testEventDetails.image_url, 'event image src');
    });

    // Test 19: VIEW TICKETS button (dark button) is present
    test('Dark VIEW TICKETS button is present', () => {
        assertContains(html, 'VIEW TICKETS', 'view tickets button text');
        assertContains(html, '#111827', 'dark background for button (matches mockup)');
    });

    // Test 20: Valid DOCTYPE/HTML structure
    test('Valid HTML structure with DOCTYPE', () => {
        assertContains(html, '<!DOCTYPE html>', 'doctype');
        assertContains(html, '</html>', 'closing html tag');
        assertContains(html, '</body>', 'closing body tag');
    });

    // Test 21: No gray QR box (the old bug) - should use real URL
    test('No gray placeholder box for QR code (old bug was gray box)', () => {
        // Old code had: <div style="...background: #e5e7eb..."> when qrCodeBaseUrl was null
        // New code should always have a real QR URL when ticketId is provided
        // The gray box would look like: background: #f3f4f6 in a div replacing the img
        // Since we have a valid ticket ID, we should NOT have the fallback gray box
        const hasRealQrImage = html.includes('api.qrserver.com');
        assert(hasRealQrImage, 'Should use real QR image, not gray placeholder div');
    });
}

async function runPriceOnlyTests() {
    console.log('\n💰 Test Suite: Ticket Price Bug Fix Verification');
    console.log('=' .repeat(55));

    // Test with ONLY pricePerTicket (new field)
    test('pricePerTicket=100 shows $100.00 correctly', () => {
        const { html } = purchaseConfirmation({
            attendeeName: 'Test User',
            attendeeEmail: 'test@test.com',
            eventTitle: 'Test Event',
            eventDate: 'Jan 1, 2027',
            tickets: [{ id: 'TKT-PRICE-TEST', name: 'GA', pricePerTicket: 100 }],
            totalPaid: 100,
            orderId: 'ORD-001',
            currency: 'USD',
        });
        assertContains(html, '$100.00', 'pricePerTicket=100 renders as $100.00');
    });

    // Test with ONLY price=0 (old buggy field, should show $0.00)
    test('price=0 (no pricePerTicket) shows $0.00 - confirming field priority logic', () => {
        const { html } = purchaseConfirmation({
            attendeeName: 'Test User',
            attendeeEmail: 'test@test.com',
            eventTitle: 'Test Event',
            eventDate: 'Jan 1, 2027',
            tickets: [{ id: 'TKT-ZERO-TEST', name: 'GA', price: 0 }],
            totalPaid: 0,
            orderId: 'ORD-002',
            currency: 'USD',
        });
        // When only price=0 is provided (no pricePerTicket), the code falls back to price || 0 = 0
        // This is the OLD BUG scenario
        assertContains(html, '$0.00', 'price=0 without pricePerTicket shows $0.00 (legacy behavior)');
    });

    // Test the fix: pricePerTicket takes priority over price=0
    test('pricePerTicket=100 overrides price=0 (THE FIX)', () => {
        const { html } = purchaseConfirmation({
            attendeeName: 'Test User',
            attendeeEmail: 'test@test.com',
            eventTitle: 'Test Event',
            eventDate: 'Jan 1, 2027',
            tickets: [{ id: 'TKT-FIX-TEST', name: 'GA', pricePerTicket: 100, price: 0 }],
            totalPaid: 100,
            orderId: 'ORD-003',
            currency: 'USD',
        });
        // With the fix, pricePerTicket=100 takes priority
        assertContains(html, '$100.00', 'THE FIX: pricePerTicket=100 shows $100.00 even when price=0');
    });

    // Test edge case: multiple tickets with different pricePerTicket values
    test('Multiple tickets show individual prices correctly', () => {
        const { html } = purchaseConfirmation({
            attendeeName: 'Test User',
            attendeeEmail: 'test@test.com',
            eventTitle: 'Multi-Ticket Event',
            eventDate: 'Jan 1, 2027',
            tickets: [
                { id: 'TKT-MULTI-001', name: 'GA', pricePerTicket: 50 },
                { id: 'TKT-MULTI-002', name: 'VIP', pricePerTicket: 150 }
            ],
            totalPaid: 200,
            orderId: 'ORD-004',
            currency: 'USD',
        });
        assertContains(html, '$50.00', 'first ticket price $50');
        assertContains(html, '$150.00', 'second ticket price $150');
    });
}

async function runQRCodeTests() {
    console.log('\n📱 Test Suite: QR Code URL Verification');
    console.log('=' .repeat(55));

    const ticketId = 'TKT-ABC12345-001';
    const { html } = purchaseConfirmation({
        attendeeName: 'QR Test User',
        attendeeEmail: 'qr@test.com',
        eventTitle: 'QR Test Event',
        eventDate: 'Mar 1, 2026',
        tickets: [{ id: ticketId, name: 'General', pricePerTicket: 75 }],
        totalPaid: 75,
        orderId: 'ORD-QR001',
        currency: 'USD',
    });

    test('QR URL starts with https://api.qrserver.com/v1/create-qr-code/', () => {
        assertContains(html, 'https://api.qrserver.com/v1/create-qr-code/', 'QR base URL');
    });

    test("QR URL has size=150x150 parameter", () => {
        assertContains(html, 'size=150x150', 'QR size parameter');
    });

    test('QR URL has data= parameter with encoded ticket ID', () => {
        const expectedData = `data=${encodeURIComponent(ticketId)}`;
        assertContains(html, expectedData, 'QR data parameter with ticket ID');
    });

    test("QR URL has bgcolor=ffffff (white background)", () => {
        assertContains(html, 'bgcolor=ffffff', 'QR bgcolor param');
    });

    test("QR URL has color=111827 (dark QR dots)", () => {
        assertContains(html, 'color=111827', 'QR color param');
    });

    test('QR code is an <img> tag (not a div placeholder)', () => {
        // Should have an <img> tag with the QR URL
        const imgTagWithQr = html.match(/<img[^>]+api\.qrserver\.com[^>]+>/);
        assert(imgTagWithQr !== null, 'QR code should be an <img> tag with api.qrserver.com URL');
    });

    // Test with empty ticket ID - should show gray box fallback, not broken QR
    test('Empty ticket ID generates gray box fallback (not broken QR URL)', () => {
        const { html: html2 } = purchaseConfirmation({
            attendeeName: 'Test',
            attendeeEmail: 'test@test.com',
            eventTitle: 'No ID Event',
            eventDate: 'Jan 1, 2027',
            tickets: [{ id: '', name: 'GA', pricePerTicket: 10 }],
            totalPaid: 10,
            orderId: 'ORD-NOQR',
            currency: 'USD',
        });
        // When id is empty, qrUrl is empty string (falsy), so gray box fallback is shown
        assert(!html2.includes('api.qrserver.com') || html2.includes('background: #f3f4f6'), 
            'Empty ticket ID should NOT generate a broken QR URL');
    });
}

async function runStripeControllerCodeReviewTests() {
    console.log('\n🔧 Test Suite: stripeController.js Code Review (lines 1024-1055)');
    console.log('=' .repeat(55));

    // Read the stripeController.js file
    const stripeControllerPath = resolve(__dirname, '../controllers/stripeController.js');
    const stripeCode = readFileSync(stripeControllerPath, 'utf8');

    // Extract lines 1024-1055 for focused inspection
    const lines = stripeCode.split('\n');
    const relevantSection = lines.slice(1023, 1055).join('\n');  // 0-indexed

    test('stripeController.js contains image_url in email call section', () => {
        assertContains(relevantSection, 'image_url', 'image_url in stripeController email call');
    });

    test('stripeController.js contains description in email call section', () => {
        assertContains(relevantSection, 'description', 'description in stripeController email call');
    });

    test('stripeController.js passes eventData.image_url to email', () => {
        assertContains(relevantSection, 'eventData.image_url', 'eventData.image_url passed to email');
    });

    test('stripeController.js passes eventData.description to email', () => {
        assertContains(relevantSection, 'eventData.description', 'eventData.description passed to email');
    });

    test('stripeController.js passes stripeFee (reg.stripe_fee) to order details', () => {
        assertContains(stripeCode.slice(stripeCode.indexOf('8. Send ticket confirmation'), stripeCode.indexOf('8. Send ticket confirmation') + 2000), 
            'stripe_fee', 
            'stripe_fee passed to email order details');
    });

    test('stripeController.js passes taxAmount to order details', () => {
        assertContains(relevantSection, 'taxAmount', 'taxAmount in stripeController email call');
    });
}

async function runServerEmailCodeReviewTests() {
    console.log('\n📨 Test Suite: serverEmail.js Code Review (lines 89-112)');
    console.log('=' .repeat(55));

    const serverEmailPath = resolve(__dirname, '../services/serverEmail.js');
    const serverEmailCode = readFileSync(serverEmailPath, 'utf8');

    // Extract lines 89-112 
    const lines = serverEmailCode.split('\n');
    const relevantSection = lines.slice(88, 112).join('\n');  // 0-indexed

    test('serverEmail.js passes eventImageUrl (image_url) to purchaseConfirmation', () => {
        assertContains(relevantSection, 'eventImageUrl', 'eventImageUrl in serverEmail template call');
    });

    test('serverEmail.js passes stripeFee to purchaseConfirmation', () => {
        assertContains(relevantSection, 'stripeFee', 'stripeFee in serverEmail template call');
    });

    test('serverEmail.js passes serviceFee to purchaseConfirmation', () => {
        assertContains(relevantSection, 'serviceFee', 'serviceFee in serverEmail template call');
    });

    test('serverEmail.js passes taxAmount to purchaseConfirmation', () => {
        assertContains(relevantSection, 'taxAmount', 'taxAmount in serverEmail template call');
    });

    test('serverEmail.js passes subtotal to purchaseConfirmation', () => {
        assertContains(relevantSection, 'subtotal', 'subtotal in serverEmail template call');
    });

    test('serverEmail.js passes currency to purchaseConfirmation', () => {
        assertContains(relevantSection, 'currency', 'currency in serverEmail template call');
    });

    // Verify the eventImageUrl mapping: eventDetails?.image_url || eventDetails?.image
    test('serverEmail.js maps eventDetails.image_url to eventImageUrl', () => {
        assertContains(serverEmailCode, "image_url:", 'image_url key in serverEmail call to purchaseConfirmation');
    });
}

async function runOtherEmailFunctionTests() {
    console.log('\n📬 Test Suite: Other Email Functions (presaleSignupConfirmation, eventReminder)');
    console.log('=' .repeat(55));

    // Test presaleSignupConfirmation
    test('presaleSignupConfirmation generates valid HTML', () => {
        const result = presaleSignupConfirmation({
            attendeeName: 'Test User',
            eventTitle: 'Test Presale Event',
            eventDate: 'July 4, 2026',
            eventTime: '8:00 PM',
            eventLocation: 'Test Venue',
            presaleDate: 'June 1, 2026',
            presaleTime: '10:00 AM',
            eventImageUrl: 'https://example.com/event.jpg',
            timezone: 'EST'
        });
        assert(result.html && result.html.length > 100, 'presaleSignupConfirmation returns non-empty HTML');
        assertContains(result.html, '<!DOCTYPE html>', 'presaleSignup has DOCTYPE');
    });

    test('presaleSignupConfirmation uses universalEmailWrapper layout', () => {
        const result = presaleSignupConfirmation({
            attendeeName: 'Test User',
            eventTitle: 'Test Presale Event',
            eventDate: 'July 4, 2026',
            eventTime: '8:00 PM',
            eventLocation: 'Test Venue',
            presaleDate: 'June 1, 2026',
        });
        // universalEmailWrapper always includes the containerBg and role="presentation"
        assertContains(result.html, 'role="presentation"', 'uses universalEmailWrapper table structure');
    });

    test("presaleSignupConfirmation subject contains event title", () => {
        const result = presaleSignupConfirmation({
            attendeeName: 'Test',
            eventTitle: 'My Presale Concert',
            eventDate: 'July 4, 2026',
            eventTime: '8:00 PM',
            eventLocation: 'Venue',
            presaleDate: 'June 1, 2026',
        });
        assertContains(result.subject, 'My Presale Concert', 'presale subject has event title');
    });

    test("presaleSignupConfirmation does NOT have YOU'RE IN! header (different email type)", () => {
        const result = presaleSignupConfirmation({
            attendeeName: 'Test',
            eventTitle: 'Test Event',
            eventDate: 'July 4, 2026',
            eventTime: '8:00 PM',
            eventLocation: 'Venue',
            presaleDate: 'June 1, 2026',
        });
        // presale confirmation should say "You're signed up!" not "YOU'RE IN!"
        assertNotContains(result.html, "YOU'RE IN!", "presale email should NOT have YOU'RE IN! header");
        assertContains(result.html, "You're signed up!", "presale email has You're signed up! header");
    });

    // Test eventReminder
    test('eventReminder generates valid HTML', () => {
        const result = eventReminder({
            attendeeName: 'Jane',
            eventTitle: 'Big Concert',
            eventDate: 'August 10, 2026',
            eventTime: '8:00 PM',
            eventLocation: 'The Stadium',
            eventImageUrl: 'https://example.com/banner.jpg',
            ticketUrl: 'https://openticket.events/tickets/123',
            timeUntil: '24 hours'
        });
        assert(result.html && result.html.length > 100, 'eventReminder returns non-empty HTML');
        assertContains(result.html, '<!DOCTYPE html>', 'eventReminder has DOCTYPE');
    });

    test('eventReminder uses universalEmailWrapper layout', () => {
        const result = eventReminder({
            attendeeName: 'Jane',
            eventTitle: 'Big Concert',
            eventDate: 'August 10, 2026',
            eventTime: '8:00 PM',
            eventLocation: 'The Stadium',
            timeUntil: '24 hours'
        });
        assertContains(result.html, 'role="presentation"', 'eventReminder uses universalEmailWrapper');
    });

    test('eventReminder footer contains Powered by OpenTicket', () => {
        const result = eventReminder({
            attendeeName: 'Jane',
            eventTitle: 'Big Concert',
            eventDate: 'August 10, 2026',
            eventTime: '8:00 PM',
            eventLocation: 'The Stadium',
            timeUntil: '24 hours'
        });
        assertContains(result.html, 'Powered by OpenTicket', 'eventReminder footer');
    });

    test('eventReminder subject contains event title and time', () => {
        const result = eventReminder({
            attendeeName: 'Jane',
            eventTitle: 'My Big Show',
            eventDate: 'August 10, 2026',
            eventTime: '8:00 PM',
            eventLocation: 'The Stadium',
            timeUntil: '24 hours'
        });
        assertContains(result.subject, 'My Big Show', 'eventReminder subject has event title');
        assertContains(result.subject, '24 hours', 'eventReminder subject has time until');
    });
}

// ========== RUN ALL TESTS ==========
async function main() {
    console.log('🧪 Email Template Test Suite');
    console.log('Testing: unifiedEmailTemplates.js purchaseConfirmation function');
    console.log('========================================================');

    try {
        await loadTemplates();
        console.log('✅ Templates loaded successfully from unifiedEmailTemplates.js');
    } catch (err) {
        console.error('❌ FATAL: Failed to load templates:', err.message);
        process.exit(1);
    }

    await runPurchaseConfirmationTests();
    await runPriceOnlyTests();
    await runQRCodeTests();
    await runStripeControllerCodeReviewTests();
    await runServerEmailCodeReviewTests();
    await runOtherEmailFunctionTests();

    // Final summary
    const total = passed + failed;
    console.log('\n' + '='.repeat(55));
    console.log('📊 FINAL RESULTS');
    console.log('='.repeat(55));
    console.log(`  Total Tests: ${total}`);
    console.log(`  ✅ Passed: ${passed}`);
    console.log(`  ❌ Failed: ${failed}`);
    console.log(`  Success Rate: ${total > 0 ? ((passed / total) * 100).toFixed(1) : 0}%`);
    console.log('='.repeat(55));

    if (failed > 0) {
        process.exit(1);
    }
}

main().catch(err => {
    console.error('Fatal test error:', err);
    process.exit(1);
});
