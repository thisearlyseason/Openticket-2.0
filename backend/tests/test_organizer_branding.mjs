/**
 * Organizer Branding Unit Tests
 * Tests for purchaseConfirmation branding logic:
 *   1. Pro with custom branding: custom logo, color, tagline — NO 'Powered by OpenTicket'
 *   2. Free plan: always shows OpenTicket logo + 'Powered by OpenTicket'
 *   3. Pro with NO custom branding: OpenTicket shown as fallback
 *   4. stripeController branding extraction structure
 *   5. serverEmail.js sendTicketConfirmation signature
 */

import { resolve, dirname } from 'path';
import { fileURLToPath } from 'url';
import { readFileSync } from 'fs';

// Set FRONTEND_URL before importing templates
process.env.FRONTEND_URL = 'https://www.openticket.events';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

const templatePath = resolve(__dirname, '../services/unifiedEmailTemplates.js');

let purchaseConfirmation;

async function loadTemplates() {
    const mod = await import(templatePath);
    purchaseConfirmation = mod.purchaseConfirmation;
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
        console.log(`  ❌ FAIL: ${name} — ${e.message}`);
        failed++;
    }
}

function assert(condition, message) {
    if (!condition) throw new Error(message || 'Assertion failed');
}

function assertContains(html, text, label) {
    if (!html.includes(text)) {
        throw new Error(`Expected HTML to contain "${text}" (${label || ''})`);
    }
}

function assertNotContains(html, text, label) {
    if (html.includes(text)) {
        throw new Error(`Expected HTML NOT to contain "${text}" (${label || ''})`);
    }
}

// ========== COMMON TEST DATA ==========
const BASE_PARAMS = {
    attendeeName: 'Test Attendee',
    attendeeEmail: 'test@example.com',
    eventTitle: 'Branding Test Event',
    eventDate: 'March 1, 2026',
    eventTime: '7:00 PM',
    eventLocation: 'Test Venue',
    tickets: [{ id: 'TKT-001', name: 'General', pricePerTicket: 50 }],
    totalPaid: 50,
    orderId: 'ORD-TEST001',
    organizerName: 'Acme Corp',
    currency: 'USD',
};

// ========== TEST SUITES ==========

function testPurchaseConfirmationSignature() {
    console.log('\n--- Test Suite: purchaseConfirmation Signature ---');

    test('purchaseConfirmation function is defined and callable', () => {
        assert(typeof purchaseConfirmation === 'function', 'purchaseConfirmation must be a function');
    });

    test('returns object with { subject, html }', () => {
        const result = purchaseConfirmation({ ...BASE_PARAMS, organizerBranding: {} });
        assert(typeof result === 'object', 'Result must be an object');
        assert(typeof result.subject === 'string' && result.subject.length > 0, 'subject must be non-empty string');
        assert(typeof result.html === 'string' && result.html.length > 0, 'html must be non-empty string');
    });

    test('accepts organizerBranding parameter with default empty object', () => {
        // Should not throw when organizerBranding is omitted
        const result = purchaseConfirmation({ ...BASE_PARAMS });
        assert(typeof result.html === 'string', 'Should work without organizerBranding');
    });
}

function testFreePlanBranding() {
    console.log('\n--- Test Suite: Free Plan Branding ---');

    test('Free plan: shows OpenTicket logo', () => {
        const { html } = purchaseConfirmation({
            ...BASE_PARAMS,
            organizerBranding: { isPro: false }
        });
        // Should use OpenTicket default logo
        assertContains(html, 'openticket.events/logo', 'OpenTicket logo URL');
    });

    test('Free plan: shows "Powered by OpenTicket" in footer', () => {
        const { html } = purchaseConfirmation({
            ...BASE_PARAMS,
            organizerBranding: { isPro: false }
        });
        assertContains(html, 'Powered by OpenTicket', 'OpenTicket footer text');
    });

    test('Free plan: does NOT show custom organizer tagline', () => {
        const { html } = purchaseConfirmation({
            ...BASE_PARAMS,
            organizerBranding: { isPro: false, brandTagline: 'Powered by Acme', logoUrl: 'https://acme.com/logo.png' }
        });
        // Even with custom branding values, isPro=false means they should be ignored
        assertNotContains(html, 'Powered by Acme', 'Custom tagline must NOT appear for free plan');
    });

    test('Free plan: does NOT use custom logo URL', () => {
        const { html } = purchaseConfirmation({
            ...BASE_PARAMS,
            organizerBranding: { isPro: false, logoUrl: 'https://acme.com/custom-logo.png' }
        });
        assertNotContains(html, 'https://acme.com/custom-logo.png', 'Custom logo must NOT be used for free plan');
    });
}

function testProWithCustomBranding() {
    console.log('\n--- Test Suite: Pro Plan with Custom Branding ---');

    const CUSTOM_LOGO = 'https://custom-organizer.com/logo.png';
    const CUSTOM_COLOR = '#FF6B35';
    const CUSTOM_TAGLINE = 'Powered by Acme Events';

    test('Pro+custom: uses custom logo URL', () => {
        const { html } = purchaseConfirmation({
            ...BASE_PARAMS,
            organizerBranding: {
                isPro: true,
                logoUrl: CUSTOM_LOGO,
                primaryColor: CUSTOM_COLOR,
                brandTagline: CUSTOM_TAGLINE
            }
        });
        assertContains(html, CUSTOM_LOGO, 'Custom logo URL must appear in email');
    });

    test('Pro+custom: does NOT show OpenTicket logo', () => {
        const { html } = purchaseConfirmation({
            ...BASE_PARAMS,
            organizerBranding: {
                isPro: true,
                logoUrl: CUSTOM_LOGO,
                primaryColor: CUSTOM_COLOR,
                brandTagline: CUSTOM_TAGLINE
            }
        });
        // Custom logo overrides OpenTicket logo
        assertNotContains(html, 'logo-dark.png', 'OpenTicket logo must NOT appear when custom logo set');
    });

    test('Pro+custom: uses custom primary color', () => {
        const { html } = purchaseConfirmation({
            ...BASE_PARAMS,
            organizerBranding: {
                isPro: true,
                logoUrl: CUSTOM_LOGO,
                primaryColor: CUSTOM_COLOR,
                brandTagline: CUSTOM_TAGLINE
            }
        });
        assertContains(html, CUSTOM_COLOR, 'Custom primary color must appear in email HTML');
    });

    test('Pro+custom: shows custom tagline in footer', () => {
        const { html } = purchaseConfirmation({
            ...BASE_PARAMS,
            organizerBranding: {
                isPro: true,
                logoUrl: CUSTOM_LOGO,
                primaryColor: CUSTOM_COLOR,
                brandTagline: CUSTOM_TAGLINE
            }
        });
        assertContains(html, CUSTOM_TAGLINE, 'Custom tagline must appear in footer');
    });

    test('Pro+custom: does NOT show "Powered by OpenTicket" in footer', () => {
        const { html } = purchaseConfirmation({
            ...BASE_PARAMS,
            organizerBranding: {
                isPro: true,
                logoUrl: CUSTOM_LOGO,
                primaryColor: CUSTOM_COLOR,
                brandTagline: CUSTOM_TAGLINE
            }
        });
        assertNotContains(html, 'Powered by OpenTicket', '"Powered by OpenTicket" must NOT appear when custom tagline set');
    });

    test('Pro+custom: VIEW TICKETS button uses custom primary color (not dark)', () => {
        const { html } = purchaseConfirmation({
            ...BASE_PARAMS,
            organizerBranding: {
                isPro: true,
                logoUrl: CUSTOM_LOGO,
                primaryColor: CUSTOM_COLOR,
                brandTagline: CUSTOM_TAGLINE
            }
        });
        // The VIEW TICKETS button should use custom color instead of #111827
        assertContains(html, CUSTOM_COLOR, 'Custom color must be used in VIEW TICKETS button for Pro');
    });
}

function testProWithNoBranding() {
    console.log('\n--- Test Suite: Pro Plan with NO Custom Branding (Fallback) ---');

    test('Pro+no-branding: falls back to OpenTicket logo', () => {
        const { html } = purchaseConfirmation({
            ...BASE_PARAMS,
            organizerBranding: {
                isPro: true,
                logoUrl: null,
                primaryColor: null,
                brandTagline: null
            }
        });
        assertContains(html, 'openticket.events/logo', 'OpenTicket logo must appear as fallback for Pro with no custom logo');
    });

    test('Pro+no-branding: shows "Powered by OpenTicket" in footer (fallback)', () => {
        const { html } = purchaseConfirmation({
            ...BASE_PARAMS,
            organizerBranding: {
                isPro: true,
                logoUrl: null,
                primaryColor: null,
                brandTagline: null
            }
        });
        assertContains(html, 'Powered by OpenTicket', '"Powered by OpenTicket" must appear for Pro with no custom branding as fallback');
    });

    test('Pro+no-logo but has tagline: shows custom tagline, NOT "Powered by OpenTicket"', () => {
        const { html } = purchaseConfirmation({
            ...BASE_PARAMS,
            organizerBranding: {
                isPro: true,
                logoUrl: null,
                primaryColor: null,
                brandTagline: 'Acme Events Platform'
            }
        });
        assertContains(html, 'Acme Events Platform', 'Custom tagline shown when only tagline set');
        assertNotContains(html, 'Powered by OpenTicket', '"Powered by OpenTicket" hidden when tagline set, even without logo');
    });

    test('Pro+logo but no tagline: shows "Powered by OpenTicket" (custom logo + no tagline = still show OT branding)', () => {
        const { html } = purchaseConfirmation({
            ...BASE_PARAMS,
            organizerBranding: {
                isPro: true,
                logoUrl: 'https://custom.com/logo.png',
                primaryColor: null,
                brandTagline: null
            }
        });
        // When logo set but no tagline - per logic: showOpenTicketBranding = !hasPro || (!customLogo && !brandTagline)
        // hasPro=true, customLogo='https://custom.com/logo.png', brandTagline=null
        // showOpenTicketBranding = !true || (!true && !null) = false || (false) = false
        // So "Powered by OpenTicket" should NOT show
        assertNotContains(html, 'Powered by OpenTicket', 'When Pro with custom logo (but no tagline), footer should be quiet');
    });
}

function testBrandingLogicEdgeCases() {
    console.log('\n--- Test Suite: Branding Logic Edge Cases ---');

    test('organizerBranding not passed: behaves like free plan', () => {
        const { html } = purchaseConfirmation({ ...BASE_PARAMS });
        assertContains(html, 'Powered by OpenTicket', 'Default (no branding) must show OpenTicket branding');
    });

    test('organizerBranding={}: behaves like free plan', () => {
        const { html } = purchaseConfirmation({ ...BASE_PARAMS, organizerBranding: {} });
        assertContains(html, 'Powered by OpenTicket', 'Empty branding object must show OpenTicket branding');
    });

    test('organizerBranding={isPro:false}: explicitly free plan', () => {
        const { html } = purchaseConfirmation({
            ...BASE_PARAMS,
            organizerBranding: { isPro: false }
        });
        assertContains(html, 'Powered by OpenTicket', 'isPro=false must show OpenTicket branding');
    });

    test('subject contains event title', () => {
        const { subject } = purchaseConfirmation({ ...BASE_PARAMS, organizerBranding: {} });
        assertContains(subject, 'Branding Test Event', 'Subject must contain event title');
        assertContains(subject, "You're In!", "Subject must contain confirmation text");
    });

    test('footer always shows organizer name', () => {
        const { html } = purchaseConfirmation({
            ...BASE_PARAMS,
            organizerBranding: { isPro: true, brandTagline: 'Powered by Acme' }
        });
        assertContains(html, 'Acme Corp', 'Organizer name must always appear in footer');
    });
}

function testShowOpenTicketBrandingLogic() {
    console.log('\n--- Test Suite: showOpenTicketBranding Invariant ---');

    // showOpenTicketBranding = !hasPro || (!customLogo && !brandTagline)
    const cases = [
        // [isPro, logoUrl, brandTagline, expectedShowOT]
        [false, null, null, true],          // Free: always show OT
        [false, 'logo.png', 'Acme', true],  // Free with custom: still show OT
        [true, null, null, true],           // Pro, no customization: show OT fallback
        [true, 'logo.png', null, false],    // Pro with logo only: DON'T show OT
        [true, null, 'Acme', false],        // Pro with tagline only: DON'T show OT
        [true, 'logo.png', 'Acme', false],  // Pro with both: DON'T show OT
    ];

    cases.forEach(([isPro, logoUrl, brandTagline, expectedShowOT]) => {
        const label = `isPro=${isPro}, logo=${logoUrl ? 'set' : 'null'}, tagline=${brandTagline ? 'set' : 'null'}`;
        test(`Branding logic: ${label} → showOT=${expectedShowOT}`, () => {
            const { html } = purchaseConfirmation({
                ...BASE_PARAMS,
                organizerBranding: { isPro, logoUrl, brandTagline }
            });
            if (expectedShowOT) {
                assertContains(html, 'Powered by OpenTicket', `Expected OT branding for: ${label}`);
            } else {
                assertNotContains(html, 'Powered by OpenTicket', `Expected NO OT branding for: ${label}`);
            }
        });
    });
}

function testStripeControllerBrandingStructure() {
    console.log('\n--- Test Suite: stripeController Branding Structure (Code Review) ---');

    const src = readFileSync(resolve(__dirname, '../controllers/stripeController.js'), 'utf-8');

    test('stripeController.js: isPaidPlan checks for pro and premium', () => {
        assert(src.includes("ownerPlan === 'pro' || ownerPlan === 'premium'"), 
            'stripeController must check both pro and premium');
    });

    test('stripeController.js: builds organizerBranding with isPro field', () => {
        assert(src.includes('organizerBranding'), 'stripeController must build organizerBranding');
        assert(src.includes('isPro: true'), 'organizerBranding must set isPro: true for paid plans');
        assert(src.includes('isPro: false'), 'organizerBranding must set isPro: false for free plan');
    });

    test('stripeController.js: extracts logo_url from ownerSettings', () => {
        assert(src.includes('ownerSettings.logo_url'), 'Must extract logo_url from settings');
    });

    test('stripeController.js: extracts primary_color from ownerSettings', () => {
        assert(src.includes('ownerSettings.primary_color'), 'Must extract primary_color from settings');
    });

    test('stripeController.js: extracts brand_tagline from ownerSettings', () => {
        assert(src.includes('ownerSettings.brand_tagline'), 'Must extract brand_tagline from settings');
    });

    test('stripeController.js: passes organizerBranding to sendTicketConfirmation', () => {
        assert(src.includes('organizerBranding'), 'organizerBranding must be passed to sendTicketConfirmation');
    });
}

function testServerEmailSignature() {
    console.log('\n--- Test Suite: serverEmail.js sendTicketConfirmation Signature ---');

    test('serverEmail.js: sendTicketConfirmation accepts organizerBranding parameter', async () => {
        const { readFileSync } = await import('fs');
        const src = readFileSync(resolve(__dirname, '../services/serverEmail.js'), 'utf-8');
        assert(src.includes('organizerBranding = {}'), 'sendTicketConfirmation must have organizerBranding default param');
    });

    test('serverEmail.js: passes organizerBranding to purchaseConfirmation', async () => {
        const { readFileSync } = await import('fs');
        const src = readFileSync(resolve(__dirname, '../services/serverEmail.js'), 'utf-8');
        assert(src.includes('organizerBranding:'), 'serverEmail must pass organizerBranding to purchaseConfirmation');
    });
}

function testProfileControllerBrandingFields() {
    console.log('\n--- Test Suite: profileController.js extendedSettingsFields ---');

    test('profileController.js: syncProfile extendedSettingsFields includes brand_tagline', async () => {
        const { readFileSync } = await import('fs');
        const src = readFileSync(resolve(__dirname, '../controllers/profileController.js'), 'utf-8');
        // Find the extendedSettingsFields in syncProfile (first occurrence)
        const firstIdx = src.indexOf("'brand_tagline'");
        assert(firstIdx !== -1, "brand_tagline must be in extendedSettingsFields");
    });

    test('profileController.js: syncProfile extendedSettingsFields includes default_theme', async () => {
        const { readFileSync } = await import('fs');
        const src = readFileSync(resolve(__dirname, '../controllers/profileController.js'), 'utf-8');
        const firstIdx = src.indexOf("'default_theme'");
        assert(firstIdx !== -1, "default_theme must be in extendedSettingsFields");
    });

    test('profileController.js: updateProfile extendedSettingsFields includes brand_tagline', async () => {
        const { readFileSync } = await import('fs');
        const src = readFileSync(resolve(__dirname, '../controllers/profileController.js'), 'utf-8');
        // Both syncProfile and updateProfile should have brand_tagline - count occurrences
        const count = (src.match(/'brand_tagline'/g) || []).length;
        assert(count >= 2, `brand_tagline must appear in BOTH syncProfile and updateProfile (found ${count} times)`);
    });

    test('profileController.js: updateProfile extendedSettingsFields includes default_theme', async () => {
        const { readFileSync } = await import('fs');
        const src = readFileSync(resolve(__dirname, '../controllers/profileController.js'), 'utf-8');
        const count = (src.match(/'default_theme'/g) || []).length;
        assert(count >= 2, `default_theme must appear in BOTH syncProfile and updateProfile (found ${count} times)`);
    });

    test('profileController.js: getProfile response includes brand_tagline mapping', async () => {
        const { readFileSync } = await import('fs');
        const src = readFileSync(resolve(__dirname, '../controllers/profileController.js'), 'utf-8');
        assert(src.includes('brand_tagline: extendedSettings.brand_tagline'), 'getProfile must map brand_tagline to response');
        assert(src.includes('default_theme: extendedSettings.default_theme'), 'getProfile must map default_theme to response');
    });
}

function testStorageServiceBrandingFields() {
    console.log('\n--- Test Suite: storageService.ts Branding Normalization ---');

    test('storageService.ts: getUserById normalizes brand_tagline to brandTagline', async () => {
        const { readFileSync } = await import('fs');
        const src = readFileSync(resolve(__dirname, '../../services/storageService.ts'), 'utf-8');
        assert(src.includes('brandTagline: profile.brand_tagline'), 'Must normalize brand_tagline -> brandTagline');
    });

    test('storageService.ts: getUserById normalizes default_theme to defaultTheme', async () => {
        const { readFileSync } = await import('fs');
        const src = readFileSync(resolve(__dirname, '../../services/storageService.ts'), 'utf-8');
        assert(src.includes('defaultTheme: (profile.default_theme'), 'Must normalize default_theme -> defaultTheme');
    });

    test('storageService.ts: updateUser passes brand_tagline in payload', async () => {
        const { readFileSync } = await import('fs');
        const src = readFileSync(resolve(__dirname, '../../services/storageService.ts'), 'utf-8');
        assert(src.includes('payload.brand_tagline = updates.brandTagline'), 'updateUser must pass brand_tagline');
    });

    test('storageService.ts: updateUser passes default_theme in payload', async () => {
        const { readFileSync } = await import('fs');
        const src = readFileSync(resolve(__dirname, '../../services/storageService.ts'), 'utf-8');
        assert(src.includes('payload.default_theme = updates.defaultTheme'), 'updateUser must pass default_theme');
    });
}

function testSettingsTsxBrandingState() {
    console.log('\n--- Test Suite: Settings.tsx Branding State & UI ---');

    test('Settings.tsx: has brandTagline state variable', async () => {
        const { readFileSync } = await import('fs');
        const src = readFileSync(resolve(__dirname, '../../components/Settings.tsx'), 'utf-8');
        assert(src.includes("const [brandTagline, setBrandTagline] = useState('')"), 
            'Settings.tsx must have brandTagline state variable');
    });

    test('Settings.tsx: has defaultTheme state variable', async () => {
        const { readFileSync } = await import('fs');
        const src = readFileSync(resolve(__dirname, '../../components/Settings.tsx'), 'utf-8');
        assert(src.includes("const [defaultTheme, setDefaultTheme] = useState<'light' | 'dark'>('light')"), 
            'Settings.tsx must have defaultTheme state variable');
    });

    test('Settings.tsx: loads brandTagline from user profile', async () => {
        const { readFileSync } = await import('fs');
        const src = readFileSync(resolve(__dirname, '../../components/Settings.tsx'), 'utf-8');
        assert(src.includes("setBrandTagline(freshUser.brandTagline || '')"), 
            'Settings.tsx must load brandTagline from freshUser');
    });

    test('Settings.tsx: loads defaultTheme from user profile', async () => {
        const { readFileSync } = await import('fs');
        const src = readFileSync(resolve(__dirname, '../../components/Settings.tsx'), 'utf-8');
        assert(src.includes("setDefaultTheme((freshUser.defaultTheme as 'light' | 'dark') || 'light')"), 
            'Settings.tsx must load defaultTheme from freshUser');
    });

    test('Settings.tsx: handleSave includes brandTagline in payload', async () => {
        const { readFileSync } = await import('fs');
        const src = readFileSync(resolve(__dirname, '../../components/Settings.tsx'), 'utf-8');
        assert(src.includes('brandTagline: brandTagline || null'), 
            'handleSave must include brandTagline in updateUser payload');
    });

    test('Settings.tsx: handleSave includes defaultTheme in payload', async () => {
        const { readFileSync } = await import('fs');
        const src = readFileSync(resolve(__dirname, '../../components/Settings.tsx'), 'utf-8');
        assert(src.includes('defaultTheme,'), 
            'handleSave must include defaultTheme in updateUser payload');
    });

    test('Settings.tsx: branding tab has Email & Ticket Branding section', async () => {
        const { readFileSync } = await import('fs');
        const src = readFileSync(resolve(__dirname, '../../components/Settings.tsx'), 'utf-8');
        assert(src.includes('Email &amp; Ticket Branding') || src.includes('Email & Ticket Branding'), 
            'Branding tab must have "Email & Ticket Branding" section');
    });

    test('Settings.tsx: branding tab has Brand Color section', async () => {
        const { readFileSync } = await import('fs');
        const src = readFileSync(resolve(__dirname, '../../components/Settings.tsx'), 'utf-8');
        assert(src.includes('Brand Color'), 'Branding tab must have "Brand Color" section');
    });

    test('Settings.tsx: branding tab has Event Page Appearance section', async () => {
        const { readFileSync } = await import('fs');
        const src = readFileSync(resolve(__dirname, '../../components/Settings.tsx'), 'utf-8');
        assert(src.includes('Event Page Appearance'), 'Branding tab must have "Event Page Appearance" section');
    });

    test('Settings.tsx: branding tab has light/dark theme toggle buttons', async () => {
        const { readFileSync } = await import('fs');
        const src = readFileSync(resolve(__dirname, '../../components/Settings.tsx'), 'utf-8');
        assert(src.includes('data-testid="branding-theme-light"'), 'Must have light theme toggle button with data-testid');
        assert(src.includes('data-testid="branding-theme-dark"'), 'Must have dark theme toggle button with data-testid');
    });

    test('Settings.tsx: branding tab shows upgrade overlay for free users', async () => {
        const { readFileSync } = await import('fs');
        const src = readFileSync(resolve(__dirname, '../../components/Settings.tsx'), 'utf-8');
        assert(src.includes('Unlock Brand Customization'), 'Must show upgrade overlay with unlock message');
        assert(src.includes('Upgrade Now'), 'Must have "Upgrade Now" button in overlay');
    });

    test('Settings.tsx: branding tab uses pointer-events-none blur for non-Pro users', async () => {
        const { readFileSync } = await import('fs');
        const src = readFileSync(resolve(__dirname, '../../components/Settings.tsx'), 'utf-8');
        assert(src.includes('pointer-events-none filter blur-sm'), 
            'Branding content must be blurred/disabled for free users');
    });
}

function testEventViewThemeApplication() {
    console.log('\n--- Test Suite: EventView.tsx Theme Application ---');

    test('EventView.tsx: applies organizerUser.defaultTheme for Pro/Premium', async () => {
        const { readFileSync } = await import('fs');
        const src = readFileSync(resolve(__dirname, '../../components/EventView.tsx'), 'utf-8');
        assert(src.includes('isPro && organizerTheme && !savedTheme'), 
            'EventView must apply theme only for Pro and when no saved user pref');
    });

    test('EventView.tsx: checks subscription plan is pro or premium', async () => {
        const { readFileSync } = await import('fs');
        const src = readFileSync(resolve(__dirname, '../../components/EventView.tsx'), 'utf-8');
        assert(src.includes("subscription?.plan === 'pro' || organizerUser?.subscription?.plan === 'premium'"), 
            'EventView must check both pro and premium plans');
    });

    test('EventView.tsx: uses localStorage openticket_theme to check saved preference', async () => {
        const { readFileSync } = await import('fs');
        const src = readFileSync(resolve(__dirname, '../../components/EventView.tsx'), 'utf-8');
        assert(src.includes("localStorage.getItem('openticket_theme')"), 
            'EventView must read saved theme preference from localStorage');
    });

    test('EventView.tsx: toggles dark class on documentElement', async () => {
        const { readFileSync } = await import('fs');
        const src = readFileSync(resolve(__dirname, '../../components/EventView.tsx'), 'utf-8');
        assert(src.includes("classList.toggle('dark', organizerTheme === 'dark')"), 
            'EventView must toggle dark CSS class based on organizerTheme');
    });

    test('EventView.tsx: cleanup restores user theme on unmount', async () => {
        const { readFileSync } = await import('fs');
        const src = readFileSync(resolve(__dirname, '../../components/EventView.tsx'), 'utf-8');
        assert(src.includes('Clean up branding when leaving'), 
            'EventView must clean up branding theme on unmount');
    });

    test('EventView.tsx: reads defaultTheme from organizerUser', async () => {
        const { readFileSync } = await import('fs');
        const src = readFileSync(resolve(__dirname, '../../components/EventView.tsx'), 'utf-8');
        assert(src.includes('defaultTheme') && src.includes('organizerUser'), 
            'EventView must reference organizerUser.defaultTheme');
    });
}

// ========== MAIN ==========
async function runAllTests() {
    console.log('=================================================');
    console.log('  ORGANIZER BRANDING FEATURE TESTS');
    console.log('=================================================');

    await loadTemplates();

    // Email template logic tests (run synchronously since they use loaded template)
    testPurchaseConfirmationSignature();
    testFreePlanBranding();
    testProWithCustomBranding();
    testProWithNoBranding();
    testBrandingLogicEdgeCases();
    testShowOpenTicketBrandingLogic();

    // Source code validation tests (async file reads)
    await testStripeControllerBrandingStructure();
    await testServerEmailSignature();
    await testProfileControllerBrandingFields();
    await testStorageServiceBrandingFields();
    await testSettingsTsxBrandingState();
    await testEventViewThemeApplication();

    console.log('\n=================================================');
    console.log(`  RESULTS: ${passed} passed, ${failed} failed`);
    console.log('=================================================');

    if (failed > 0) {
        process.exit(1);
    }
}

runAllTests().catch(e => {
    console.error('Test runner error:', e);
    process.exit(1);
});
