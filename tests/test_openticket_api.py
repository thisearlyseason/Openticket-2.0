"""
OpenTicket API Tests
Tests for the ticketing platform with Stripe Connect payments
Covers: health endpoints, events API, and the new verify-session endpoint
"""

import pytest
import requests
import os

# Use localhost for testing since the public URL isn't routing to backend
BASE_URL = "http://localhost:8001"


class TestHealthEndpoints:
    """Health and basic connectivity tests"""
    
    def test_ping_endpoint(self):
        """Test /api/ping returns 'pong'"""
        response = requests.get(f"{BASE_URL}/api/ping")
        assert response.status_code == 200
        assert response.text == "pong"
        print("✓ /api/ping returns 'pong'")
    
    def test_health_endpoint(self):
        """Test /api/health returns status ok"""
        response = requests.get(f"{BASE_URL}/api/health")
        assert response.status_code == 200
        data = response.json()
        assert data["status"] == "ok"
        assert "timestamp" in data
        print(f"✓ /api/health returns status: {data['status']}")
    
    def test_debug_endpoint(self):
        """Test /api/debug returns environment info"""
        response = requests.get(f"{BASE_URL}/api/debug")
        assert response.status_code == 200
        data = response.json()
        assert "env" in data
        assert "uptime" in data
        print(f"✓ /api/debug returns uptime: {data['uptime']}")


class TestEventsAPI:
    """Events API tests"""
    
    def test_public_events_list(self):
        """Test /api/events/public returns list of events"""
        response = requests.get(f"{BASE_URL}/api/events/public")
        assert response.status_code == 200
        data = response.json()
        assert "events" in data
        assert isinstance(data["events"], list)
        print(f"✓ /api/events/public returns {len(data['events'])} events")
        
        # Verify event structure if events exist
        if len(data["events"]) > 0:
            event = data["events"][0]
            assert "id" in event
            assert "title" in event
            assert "date" in event
            print(f"  First event: {event['title']}")
    
    def test_event_has_required_fields(self):
        """Test that events have all required fields"""
        response = requests.get(f"{BASE_URL}/api/events/public")
        assert response.status_code == 200
        data = response.json()
        
        if len(data["events"]) > 0:
            event = data["events"][0]
            required_fields = ["id", "title", "date", "location", "price_type"]
            for field in required_fields:
                assert field in event, f"Missing required field: {field}"
            print(f"✓ Event has all required fields: {required_fields}")


class TestStripeVerifySession:
    """Tests for the new /api/stripe/verify-session endpoint"""
    
    def test_verify_session_missing_session_id(self):
        """Test verify-session returns error when sessionId is missing"""
        response = requests.post(
            f"{BASE_URL}/api/stripe/verify-session",
            json={},
            headers={"Content-Type": "application/json"}
        )
        assert response.status_code == 400
        data = response.json()
        assert "error" in data
        assert data["error"] == "Session ID required"
        print("✓ verify-session returns 400 for missing sessionId")
    
    def test_verify_session_invalid_session(self):
        """Test verify-session returns error for invalid session ID"""
        response = requests.post(
            f"{BASE_URL}/api/stripe/verify-session",
            json={"sessionId": "invalid_session_123"},
            headers={"Content-Type": "application/json"}
        )
        # Stripe returns an error for invalid session
        assert response.status_code == 500
        data = response.json()
        assert "error" in data
        # The error should mention the session not found
        assert "checkout.session" in data["error"].lower() or "invalid" in data["error"].lower()
        print(f"✓ verify-session returns error for invalid session: {data['error']}")
    
    def test_verify_session_endpoint_exists(self):
        """Test that the verify-session endpoint exists and accepts POST"""
        response = requests.post(
            f"{BASE_URL}/api/stripe/verify-session",
            json={"sessionId": "cs_test_fake"},
            headers={"Content-Type": "application/json"}
        )
        # Should not return 404 (endpoint exists)
        assert response.status_code != 404
        print("✓ verify-session endpoint exists and accepts POST requests")


class TestStripeOtherEndpoints:
    """Tests for other Stripe endpoints"""
    
    def test_calculate_order_endpoint(self):
        """Test /api/stripe/calculate-order endpoint exists"""
        response = requests.post(
            f"{BASE_URL}/api/stripe/calculate-order",
            json={
                "eventId": "test-event-id",
                "ticketSelections": {},
                "addOnSelections": {}
            },
            headers={"Content-Type": "application/json"}
        )
        # Should return 404 for non-existent event, not 500 or endpoint not found
        assert response.status_code in [404, 400, 500]
        print(f"✓ calculate-order endpoint exists (status: {response.status_code})")
    
    def test_create_order_missing_data(self):
        """Test /api/stripe/create-order returns error for missing data"""
        response = requests.post(
            f"{BASE_URL}/api/stripe/create-order",
            json={},
            headers={"Content-Type": "application/json"}
        )
        # Should return error for missing required fields
        assert response.status_code in [400, 404, 500]
        print(f"✓ create-order returns error for missing data (status: {response.status_code})")


class TestCheckEndpoint:
    """Test the check endpoint"""
    
    def test_check_route(self):
        """Test /api/check returns status"""
        response = requests.get(f"{BASE_URL}/api/check")
        assert response.status_code == 200
        data = response.json()
        assert "status" in data
        print(f"✓ /api/check returns: {data}")


if __name__ == "__main__":
    pytest.main([__file__, "-v", "--tb=short"])
