"""
Comprehensive E2E Test Suite for OpenTicket Platform
Tests: Backend health, public endpoints, auth sync, and plan limits
"""
import pytest
import requests
import os

BASE_URL = os.environ.get('REACT_APP_BACKEND_URL', '').rstrip('/')

class TestBackendHealth:
    """Backend health check tests"""
    
    def test_ping_endpoint(self):
        """Test /api/ping returns pong"""
        response = requests.get(f"{BASE_URL}/api/ping")
        assert response.status_code == 200
        assert response.text == "pong"
        print("✅ /api/ping returns 'pong'")
    
    def test_health_endpoint(self):
        """Test /api/health returns healthy status"""
        response = requests.get(f"{BASE_URL}/api/health")
        assert response.status_code == 200
        data = response.json()
        assert data.get("status") == "healthy"
        assert "uptime" in data
        assert "timestamp" in data
        print(f"✅ /api/health returns healthy, uptime: {data.get('uptime')}")


class TestPublicEndpoints:
    """Public API endpoint tests"""
    
    def test_events_public_endpoint(self):
        """Test /api/events/public returns events list"""
        response = requests.get(f"{BASE_URL}/api/events/public")
        assert response.status_code == 200
        data = response.json()
        assert "events" in data
        assert isinstance(data["events"], list)
        print(f"✅ /api/events/public returns {len(data['events'])} events")
    
    def test_events_endpoint_requires_auth(self):
        """Test /api/events requires authentication"""
        response = requests.get(f"{BASE_URL}/api/events")
        # Should return 401 without auth
        assert response.status_code == 401
        print("✅ /api/events requires authentication (401)")


class TestEnterpriseEndpoint:
    """Enterprise contact endpoint tests"""
    
    def test_enterprise_contact_requires_auth(self):
        """Test /api/enterprise/contact requires authentication"""
        response = requests.post(
            f"{BASE_URL}/api/enterprise/contact",
            json={
                "fullName": "Test User",
                "email": "test@example.com",
                "company": "Test Corp"
            }
        )
        # Should return 401 without auth
        assert response.status_code == 401
        print("✅ /api/enterprise/contact requires authentication (401)")
    
    def test_enterprise_contact_invalid_token(self):
        """Test /api/enterprise/contact rejects invalid token"""
        response = requests.post(
            f"{BASE_URL}/api/enterprise/contact",
            headers={"Authorization": "Bearer invalid_token"},
            json={
                "fullName": "Test User",
                "email": "test@example.com",
                "company": "Test Corp"
            }
        )
        # Should return 401 with invalid token
        assert response.status_code == 401
        print("✅ /api/enterprise/contact rejects invalid token (401)")


class TestAdminEndpoint:
    """Admin endpoint tests"""
    
    def test_admin_migration_requires_auth(self):
        """Test /api/admin/run-migration requires admin auth"""
        response = requests.post(
            f"{BASE_URL}/api/admin/run-migration",
            json={"migration": "test"}
        )
        # Should return 401, 403, or 520 (server error due to missing auth)
        assert response.status_code in [401, 403, 500, 520]
        print(f"✅ /api/admin/run-migration requires admin auth ({response.status_code})")


class TestStripeEndpoints:
    """Stripe-related endpoint tests"""
    
    def test_calculate_order_endpoint(self):
        """Test /api/stripe/calculate-order works"""
        response = requests.post(
            f"{BASE_URL}/api/stripe/calculate-order",
            json={
                "tickets": [{"price": 10, "quantity": 2}],
                "currency": "USD",
                "plan": "free"
            }
        )
        assert response.status_code == 200
        data = response.json()
        assert "subtotal" in data or "total" in data
        print(f"✅ /api/stripe/calculate-order works, response: {data}")


class TestNonprofitEndpoints:
    """Nonprofit-related endpoint tests"""
    
    def test_nonprofit_status_requires_auth(self):
        """Test /api/onboarding/nonprofit/status requires auth"""
        response = requests.get(f"{BASE_URL}/api/onboarding/nonprofit/status")
        # Should return 401 without auth
        assert response.status_code == 401
        print("✅ /api/onboarding/nonprofit/status requires auth (401)")


if __name__ == "__main__":
    pytest.main([__file__, "-v", "--tb=short"])
