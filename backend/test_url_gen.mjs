import './services/supabase.js';

// Simulate what happens in kioskController.js
const frontendUrl = process.env.FRONTEND_URL || 'http://localhost:3000';
const eventId = 'd85c6dd8-71c6-435a-b98d-ee9c61972f57';
const tokenId = '77e89bdb-6125-476a-9463-7b7575021fd6';

const kioskUrl = `${frontendUrl}/#/kiosk/${eventId}?token=${tokenId}`;

console.log('FRONTEND_URL env var:', process.env.FRONTEND_URL);
console.log('Generated kiosk URL:', kioskUrl);
console.log('\nExpected: https://www.openticket.events/#/kiosk/...');
console.log('Match:', kioskUrl.startsWith('https://www.openticket.events'));
