import React from 'react';
import ReactDOM from 'react-dom/client';
import App from './App';
import { pwaService } from './services/pwaService';
import './index.css';

import React from 'react';
import ReactDOM from 'react-dom/client';
import App from './App';
import { pwaService } from './services/pwaService';
import './index.css';

// Handle Stripe return redirect BEFORE React renders to avoid page flash
// When Stripe redirects back with ?stripe_return=true, we immediately redirect to the hash URL
const _stripeParams = new URLSearchParams(window.location.search);
if (_stripeParams.get('stripe_return') === 'true') {
    const _eventId = _stripeParams.get('event_id');
    const _sessionId = _stripeParams.get('session_id');
    const _success = _stripeParams.get('success');
    const _canceled = _stripeParams.get('canceled');
    if (_eventId) {
        let _eventUrl = `/#/event/${_eventId}`;
        if (_success === 'true' && _sessionId) {
            _eventUrl += `?success=true&session_id=${_sessionId}`;
        } else if (_canceled === 'true') {
            _eventUrl += `?canceled=true`;
        }
        window.location.replace(_eventUrl);
    }
} else {

const rootElement = document.getElementById('root');
if (!rootElement) {
  throw new Error("Could not find root element to mount to");
}

// Register Service Worker for PWA
if (process.env.NODE_ENV === 'production') {
  pwaService.register().catch(console.error);
}

const root = ReactDOM.createRoot(rootElement);
root.render(
  <App />
);

}

// Register Service Worker for PWA
if (process.env.NODE_ENV === 'production') {
  pwaService.register().catch(console.error);
}

const root = ReactDOM.createRoot(rootElement);
root.render(
  <App />
);