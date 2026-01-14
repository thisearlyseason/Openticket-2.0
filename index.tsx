import React from 'react';
import ReactDOM from 'react-dom/client';
import App from './App';
import { pwaService } from './services/pwaService';
import './index.css';

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