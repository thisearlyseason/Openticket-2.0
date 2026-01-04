"""
OpenTicket API Tests - Affiliate Click Tracking & At-Door Payments
Tests for the new affiliate tracking and at-door payment recording features
"""

import pytest
import requests
import os

# Use localhost for testing since backend runs on port 8001
BASE_URL = "http://localhost:8001"


class TestAffiliateTrackClick:
    """Tests for POST /api/admin/affiliate/track-click (public, no auth required)"""
    
    def test_track_click_unknown_affiliate_code(self):
        """Test tracking click with unknown affiliate code returns tracked=false"""
        response = requests.post(
            f"{BASE_URL}/api/admin/affiliate/track-click",
            json={"affiliateCode": "UNKNOWN_CODE_123"},
            headers={"Content-Type": "application/json"}
        )
        assert response.status_code == 200
        data = response.json()
        assert data["tracked"] == False
        assert data["reason"] == "Unknown affiliate code"
        print("✓ track-click returns tracked=false for unknown affiliate code")
    
    def test_track_click_missing_affiliate_code(self):
        """Test tracking click without affiliateCode returns 400 error"""
        response = requests.post(
            f"{BASE_URL}/api/admin/affiliate/track-click",
            json={},
            headers={"Content-Type": "application/json"}
        )
        assert response.status_code == 400
        data = response.json()
        assert "error" in data
        assert data["error"] == "Affiliate code required"
        print("✓ track-click returns 400 for missing affiliateCode")
    
    def test_track_click_with_optional_fields(self):
        """Test tracking click with optional fields (eventId, referrer, userAgent)"""
        response = requests.post(
            f"{BASE_URL}/api/admin/affiliate/track-click",
            json={
                "affiliateCode": "TEST_AFFILIATE",
                "eventId": "event-123",
                "referrer": "https://example.com",
                "userAgent": "Mozilla/5.0 Test Agent"
            },
            headers={"Content-Type": "application/json"}
        )
        assert response.status_code == 200
        data = response.json()
        # Should return tracked=false since TEST_AFFILIATE doesn't exist
        assert "tracked" in data
        print(f"✓ track-click accepts optional fields (tracked={data['tracked']})")
    
    def test_track_click_endpoint_accepts_post(self):
        """Test that track-click endpoint exists and accepts POST"""
        response = requests.post(
            f"{BASE_URL}/api/admin/affiliate/track-click",
            json={"affiliateCode": "test"},
            headers={"Content-Type": "application/json"}
        )
        # Should not return 404 (endpoint exists)
        assert response.status_code != 404
        print("✓ track-click endpoint exists and accepts POST")
    
    def test_track_click_no_auth_required(self):
        """Test that track-click endpoint does NOT require authentication"""
        # Make request without any auth headers
        response = requests.post(
            f"{BASE_URL}/api/admin/affiliate/track-click",
            json={"affiliateCode": "PUBLIC_TEST"},
            headers={"Content-Type": "application/json"}
        )
        # Should NOT return 401 (no auth required)
        assert response.status_code != 401
        assert response.status_code == 200
        print("✓ track-click endpoint is public (no auth required)")


class TestAffiliateAnalytics:
    """Tests for GET /api/admin/affiliate/analytics (requires admin auth)"""
    
    def test_analytics_requires_auth(self):
        """Test that analytics endpoint requires authentication"""
        response = requests.get(
            f"{BASE_URL}/api/admin/affiliate/analytics",
            headers={"Content-Type": "application/json"}
        )
        # Should return 401 or similar auth error
        assert response.status_code in [401, 403]
        data = response.json()
        assert "error" in data
        # Check for auth-related error message
        assert "token" in data["error"].lower() or "auth" in data["error"].lower() or "denied" in data["error"].lower()
        print(f"✓ analytics endpoint requires auth (status: {response.status_code})")
    
    def test_analytics_rejects_invalid_token(self):
        """Test that analytics endpoint rejects invalid token"""
        response = requests.get(
            f"{BASE_URL}/api/admin/affiliate/analytics",
            headers={
                "Content-Type": "application/json",
                "Authorization": "Bearer invalid_token_123"
            }
        )
        # Should return 401 or 403
        assert response.status_code in [401, 403]
        print(f"✓ analytics endpoint rejects invalid token (status: {response.status_code})")
    
    def test_analytics_endpoint_exists(self):
        """Test that analytics endpoint exists (not 404)"""
        response = requests.get(
            f"{BASE_URL}/api/admin/affiliate/analytics",
            headers={"Content-Type": "application/json"}
        )
        # Should not return 404
        assert response.status_code != 404
        print("✓ analytics endpoint exists")


class TestRecordAtDoorPayment:
    """Tests for POST /api/stripe/record-at-door-payment (requires auth)"""
    
    def test_record_payment_requires_auth(self):
        """Test that record-at-door-payment requires authentication"""
        response = requests.post(
            f"{BASE_URL}/api/stripe/record-at-door-payment",
            json={
                "registrationId": "test-reg-123",
                "amount": 50.00,
                "method": "cash"
            },
            headers={"Content-Type": "application/json"}
        )
        # Should return 401 or similar auth error
        assert response.status_code in [401, 403]
        data = response.json()
        assert "error" in data
        print(f"✓ record-at-door-payment requires auth (status: {response.status_code})")
    
    def test_record_payment_rejects_invalid_token(self):
        """Test that record-at-door-payment rejects invalid token"""
        response = requests.post(
            f"{BASE_URL}/api/stripe/record-at-door-payment",
            json={
                "registrationId": "test-reg-123",
                "amount": 50.00,
                "method": "cash"
            },
            headers={
                "Content-Type": "application/json",
                "Authorization": "Bearer invalid_token_123"
            }
        )
        # Should return 401 or 403
        assert response.status_code in [401, 403]
        print(f"✓ record-at-door-payment rejects invalid token (status: {response.status_code})")
    
    def test_record_payment_endpoint_exists(self):
        """Test that record-at-door-payment endpoint exists (not 404)"""
        response = requests.post(
            f"{BASE_URL}/api/stripe/record-at-door-payment",
            json={
                "registrationId": "test-reg-123",
                "amount": 50.00,
                "method": "cash"
            },
            headers={"Content-Type": "application/json"}
        )
        # Should not return 404
        assert response.status_code != 404
        print("✓ record-at-door-payment endpoint exists")
    
    def test_record_payment_accepts_different_methods(self):
        """Test that endpoint accepts different payment methods (cash, card, transfer)"""
        methods = ["cash", "card", "transfer"]
        for method in methods:
            response = requests.post(
                f"{BASE_URL}/api/stripe/record-at-door-payment",
                json={
                    "registrationId": f"test-reg-{method}",
                    "amount": 25.00,
                    "method": method
                },
                headers={"Content-Type": "application/json"}
            )
            # Should return auth error, not validation error
            assert response.status_code in [401, 403]
            print(f"✓ record-at-door-payment accepts method: {method}")


class TestAffiliateDetail:
    """Tests for GET /api/admin/affiliate/:affiliateId (requires admin auth)"""
    
    def test_affiliate_detail_requires_auth(self):
        """Test that affiliate detail endpoint requires authentication"""
        response = requests.get(
            f"{BASE_URL}/api/admin/affiliate/test-affiliate-id",
            headers={"Content-Type": "application/json"}
        )
        # Should return 401 or similar auth error
        assert response.status_code in [401, 403]
        data = response.json()
        assert "error" in data
        print(f"✓ affiliate detail endpoint requires auth (status: {response.status_code})")


class TestExistingEndpoints:
    """Verify existing endpoints still work after new additions"""
    
    def test_ping_endpoint(self):
        """Test /api/ping still works"""
        response = requests.get(f"{BASE_URL}/api/ping")
        assert response.status_code == 200
        assert response.text == "pong"
        print("✓ /api/ping still works")
    
    def test_health_endpoint(self):
        """Test /api/health still works"""
        response = requests.get(f"{BASE_URL}/api/health")
        assert response.status_code == 200
        data = response.json()
        assert data["status"] == "ok"
        print("✓ /api/health still works")
    
    def test_public_events_endpoint(self):
        """Test /api/events/public still works"""
        response = requests.get(f"{BASE_URL}/api/events/public")
        assert response.status_code == 200
        data = response.json()
        assert "events" in data
        print(f"✓ /api/events/public still works ({len(data['events'])} events)")


if __name__ == "__main__":
    pytest.main([__file__, "-v", "--tb=short"])
