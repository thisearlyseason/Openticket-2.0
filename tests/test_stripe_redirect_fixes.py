"""
Tests for Stripe post-payment redirect and payout endpoint fixes.
Tests:
1. POST /api/stripe/request-payout - returns 401 auth required (not 404)
2. POST /api/stripe/verify-session - exists and handles requests
3. POST /api/stripe/create-order - basic availability check
4. Backend health check
"""
import pytest
import requests
import os

BASE_URL = os.environ.get('VITE_BACKEND_URL', 'http://localhost:8001').rstrip('/')
LOCALHOST = 'http://localhost:8001'

class TestPayoutEndpoint:
    """Test the new /api/stripe/request-payout endpoint"""

    def test_payout_endpoint_exists_not_404(self):
        """POST /api/stripe/request-payout should return 401 not 404"""
        response = requests.post(f"{LOCALHOST}/api/stripe/request-payout",
                                 json={}, headers={"Content-Type": "application/json"}, timeout=10)
        assert response.status_code != 404, f"Endpoint returned 404 - route not registered"
        assert response.status_code == 401, f"Expected 401 auth required, got {response.status_code}"
        print(f"PASS: /api/stripe/request-payout returns {response.status_code} (auth required)")

    def test_payout_endpoint_with_invalid_token(self):
        """POST /api/stripe/request-payout with invalid token should return 401"""
        response = requests.post(f"{LOCALHOST}/api/stripe/request-payout",
                                 json={"mode": "standard"},
                                 headers={
                                     "Content-Type": "application/json",
                                     "Authorization": "Bearer invalid_token_xyz"
                                 }, timeout=10)
        assert response.status_code == 401, f"Expected 401 with invalid token, got {response.status_code}"
        print(f"PASS: /api/stripe/request-payout returns {response.status_code} with invalid token")

    def test_payout_endpoint_instant_mode(self):
        """POST /api/stripe/request-payout instant mode also requires auth"""
        response = requests.post(f"{LOCALHOST}/api/stripe/request-payout",
                                 json={"mode": "instant"},
                                 headers={"Content-Type": "application/json"}, timeout=10)
        assert response.status_code == 401, f"Expected 401 for instant mode too, got {response.status_code}"
        print(f"PASS: /api/stripe/request-payout instant mode returns {response.status_code}")


class TestVerifySessionEndpoint:
    """Test the verify-session endpoint still works"""

    def test_verify_session_no_session_id(self):
        """POST /api/stripe/verify-session without sessionId should return error, not 404"""
        response = requests.post(f"{LOCALHOST}/api/stripe/verify-session",
                                 json={}, headers={"Content-Type": "application/json"}, timeout=10)
        assert response.status_code != 404, "verify-session endpoint missing (404)"
        print(f"PASS: /api/stripe/verify-session exists, returned {response.status_code}")

    def test_verify_session_with_fake_session_id(self):
        """POST /api/stripe/verify-session with fake session id - should return 4xx not 404"""
        response = requests.post(f"{LOCALHOST}/api/stripe/verify-session",
                                 json={"sessionId": "cs_test_fake123"},
                                 headers={"Content-Type": "application/json"}, timeout=15)
        assert response.status_code != 404, "verify-session endpoint not found (404)"
        # Can be 400, 500 with fake session - just not 404
        print(f"PASS: /api/stripe/verify-session exists, returned {response.status_code} for fake session")


class TestStripeRoutesAvailability:
    """Test all Stripe routes are available"""

    def test_create_order_not_404(self):
        """POST /api/stripe/create-order should exist"""
        response = requests.post(f"{LOCALHOST}/api/stripe/create-order",
                                 json={}, headers={"Content-Type": "application/json"}, timeout=10)
        assert response.status_code != 404, "create-order route not found"
        print(f"PASS: /api/stripe/create-order exists, returned {response.status_code}")

    def test_calculate_order_not_404(self):
        """POST /api/stripe/calculate-order should exist"""
        response = requests.post(f"{LOCALHOST}/api/stripe/calculate-order",
                                 json={}, headers={"Content-Type": "application/json"}, timeout=10)
        assert response.status_code != 404, "calculate-order route not found"
        print(f"PASS: /api/stripe/calculate-order exists, returned {response.status_code}")

    def test_exchange_rates_available(self):
        """GET /api/stripe/exchange-rates should be available"""
        response = requests.get(f"{LOCALHOST}/api/stripe/exchange-rates", timeout=10)
        assert response.status_code != 404, "exchange-rates endpoint not found"
        print(f"PASS: /api/stripe/exchange-rates exists, returned {response.status_code}")

    def test_connect_status_requires_auth(self):
        """GET /api/stripe/connect/status requires auth"""
        response = requests.get(f"{LOCALHOST}/api/stripe/connect/status", timeout=10)
        # 401/403 = auth required; 429 = rate limited (also acceptable - endpoint exists)
        assert response.status_code in [401, 403, 429], f"Expected auth required or rate limit, got {response.status_code}"
        assert response.status_code != 404, "connect/status route not found (404)"
        print(f"PASS: /api/stripe/connect/status requires auth: {response.status_code}")

    def test_request_payout_route_registered(self):
        """Verify /api/stripe/request-payout route is registered"""
        # POST without auth must be 401 or 429 (rate limit) - route exists and is protected
        response = requests.post(f"{LOCALHOST}/api/stripe/request-payout",
                                 json={}, timeout=10)
        assert response.status_code in [401, 429], f"Route not properly protected, got {response.status_code}"
        assert response.status_code != 404, "request-payout route not registered"
        print(f"PASS: request-payout route is properly registered and protected: {response.status_code}")


class TestBackendHealth:
    """Basic health checks"""

    def test_backend_is_running(self):
        """Backend should respond to requests"""
        response = requests.get(f"{LOCALHOST}/api/health", timeout=10)
        # Health endpoint may or may not exist, but server should respond
        assert response.status_code < 500, f"Backend is not running properly: {response.status_code}"
        print(f"PASS: Backend is running, /api/health returned {response.status_code}")

    def test_backend_events_endpoint(self):
        """GET /api/events should return a valid response (may require auth)"""
        response = requests.get(f"{LOCALHOST}/api/events", timeout=10)
        # 200/204 = success; 401 = auth required (endpoint exists); both are valid
        assert response.status_code not in [404, 500], f"Events endpoint failed unexpectedly: {response.status_code}"
        print(f"PASS: /api/events returned {response.status_code}")
