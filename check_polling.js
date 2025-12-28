
import fetch from 'node-fetch';

const API_URL = 'http://localhost:5001/api';
const SESSION_ID = 'cs_test_b1pfLERfGWwbrv89OL9pACKKhbSKch7XtbyudVFgSliVaaoELE4UTMLaW0'; // Use the session ID from previous inspection

async function poll() {
    console.log(`Polling for session: ${SESSION_ID}`);
    const start = Date.now();

    // Simulate frontend call (unauthenticated)
    // EventView.tsx usually has no auth token if guest checkout?
    // Wait... if user is logged in, they have a token.
    // If guest, no token.
    // Let's try WITHOUT token first.

    try {
        const res = await fetch(`${API_URL}/registrations?stripe_checkout_session_id=${SESSION_ID}`, {
            headers: { 'Content-Type': 'application/json' }
        });

        if (!res.ok) {
            console.log(`API Error: ${res.status} ${res.statusText}`);
            const txt = await res.text();
            console.log("Body:", txt);
            return;
        }

        const data = await res.json();
        console.log("Response Data:", JSON.stringify(data, null, 2));

    } catch (e) {
        console.error("Fetch failed:", e);
    }
}

poll();
