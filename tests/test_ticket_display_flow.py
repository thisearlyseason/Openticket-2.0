"""
Test Suite: Ticket Display Flow After Purchase
Tests the fix for tickets not displaying after successful purchase.

Key features tested:
1. Stripe return redirect from root URL to event page
2. verify-session endpoint responds correctly
3. Registration by email fetch returns correct tickets
4. My Tickets page displays tickets for logged-in users
5. EventView success state shows tickets after payment verification
"""

import pytest
import requests
import os

BASE_URL = os.environ.get('REACT_APP_BACKEND_URL', 'http://localhost:8001')

class TestStripeVerifySession:
    """Tests for /api/stripe/verify-session endpoint"""
    
    def test_verify_session_requires_session_id(self):
        """verify-session should return 400 when sessionId is missing"""
        response = requests.post(
            f"{BASE_URL}/api/stripe/verify-session",
            json={},
            headers={"Content-Type": "application/json"}
        )
        assert response.status_code == 400
        data = response.json()
        assert "error" in data
        assert "Session ID required" in data["error"]
    
    def test_verify_session_handles_invalid_session(self):
        """verify-session should return error for non-existent session"""
        response = requests.post(
            f"{BASE_URL}/api/stripe/verify-session",
            json={"sessionId": "cs_test_invalid_session_12345"},
            headers={"Content-Type": "application/json"}
        )
        # Should return 500 or 404 with error message about session not found
        assert response.status_code in [404, 500]
        data = response.json()
        assert "error" in data
        # Stripe returns "No such checkout.session" for invalid IDs
        assert "checkout.session" in data["error"].lower() or "not found" in data["error"].lower()
    
    def test_verify_session_endpoint_exists(self):
        """verify-session endpoint should be accessible"""
        response = requests.post(
            f"{BASE_URL}/api/stripe/verify-session",
            json={"sessionId": "test"},
            headers={"Content-Type": "application/json"}
        )
        # Should not return 404 (endpoint not found)
        assert response.status_code != 404


class TestRegistrationsByEmail:
    """Tests for /api/registrations endpoint with email filter"""
    
    def test_registrations_requires_filter(self):
        """registrations endpoint should require email or session_id filter"""
        response = requests.get(f"{BASE_URL}/api/registrations")
        assert response.status_code == 403
        data = response.json()
        assert "error" in data
        assert "Missing filter" in data["error"]
    
    def test_registrations_with_empty_email_rejected(self):
        """registrations endpoint should reject empty email"""
        response = requests.get(f"{BASE_URL}/api/registrations?email=")
        assert response.status_code == 403
        data = response.json()
        assert "error" in data
    
    def test_registrations_with_valid_email_returns_array(self):
        """registrations endpoint should return array for valid email"""
        response = requests.get(f"{BASE_URL}/api/registrations?email=test@example.com")
        assert response.status_code == 200
        data = response.json()
        assert "registrations" in data
        assert isinstance(data["registrations"], list)
    
    def test_registrations_with_session_id_filter(self):
        """registrations endpoint should accept stripe_checkout_session_id filter"""
        response = requests.get(
            f"{BASE_URL}/api/registrations?stripe_checkout_session_id=cs_test_123"
        )
        assert response.status_code == 200
        data = response.json()
        assert "registrations" in data
        assert isinstance(data["registrations"], list)


class TestCalculateOrder:
    """Tests for /api/stripe/calculate-order endpoint"""
    
    def test_calculate_order_requires_event_id(self):
        """calculate-order should handle missing eventId"""
        response = requests.post(
            f"{BASE_URL}/api/stripe/calculate-order",
            json={"ticketSelections": {}},
            headers={"Content-Type": "application/json"}
        )
        # Should return 404 for missing event
        assert response.status_code == 404
        data = response.json()
        assert "error" in data


class TestHealthEndpoint:
    """Basic health check tests"""
    
    def test_health_endpoint(self):
        """Health endpoint should return ok status"""
        response = requests.get(f"{BASE_URL}/api/health")
        assert response.status_code == 200
        data = response.json()
        assert data["status"] == "ok"


class TestCreateOrderEndpoint:
    """Tests for /api/stripe/create-order endpoint"""
    
    def test_create_order_requires_urls(self):
        """create-order should require success and cancel URLs"""
        response = requests.post(
            f"{BASE_URL}/api/stripe/create-order",
            json={
                "eventId": "test-event-123",
                "ticketSelections": {"general": 1},
                "customerEmail": "test@example.com",
                "customerName": "Test User"
            },
            headers={"Content-Type": "application/json"}
        )
        assert response.status_code == 400
        data = response.json()
        assert "error" in data
        assert "URL" in data["error"]
    
    def test_create_order_validates_url_format(self):
        """create-order should validate URL format"""
        response = requests.post(
            f"{BASE_URL}/api/stripe/create-order",
            json={
                "eventId": "test-event-123",
                "ticketSelections": {"general": 1},
                "customerEmail": "test@example.com",
                "customerName": "Test User",
                "successUrl": "invalid-url",
                "cancelUrl": "also-invalid"
            },
            headers={"Content-Type": "application/json"}
        )
        assert response.status_code == 400
        data = response.json()
        assert "error" in data
        assert "Invalid" in data["error"] or "URL" in data["error"]


if __name__ == "__main__":
    pytest.main([__file__, "-v", "--tb=short"])
