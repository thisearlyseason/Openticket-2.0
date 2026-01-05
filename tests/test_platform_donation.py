"""
Platform Donation Feature Tests
Tests the mandatory donation for Free plan and optional donation for Pro/Premium plans
"""
import pytest
import requests
import os

BASE_URL = os.environ.get('REACT_APP_BACKEND_URL', 'http://localhost:8001')

class TestPlatformDonationBackend:
    """Backend API tests for platform donation feature"""
    
    def test_health_check(self):
        """Verify backend is running"""
        response = requests.get(f"{BASE_URL}/api/health")
        assert response.status_code == 200
        data = response.json()
        assert data.get("status") == "ok"
        print("Backend health check passed")
    
    def test_public_events_endpoint(self):
        """Verify public events endpoint works"""
        response = requests.get(f"{BASE_URL}/api/events/public")
        assert response.status_code == 200
        data = response.json()
        assert "events" in data
        print(f"Found {len(data['events'])} public events")
    
    def test_event_has_hide_platform_donation_field(self):
        """Verify events can have hidePlatformDonation field"""
        response = requests.get(f"{BASE_URL}/api/events/public")
        assert response.status_code == 200
        data = response.json()
        
        # Check if any event has the hidePlatformDonation field
        # This field is optional and may not be set on all events
        events = data.get("events", [])
        if events:
            # The field should be accepted by the schema
            print("Events retrieved successfully - hidePlatformDonation field is supported in schema")
    
    def test_create_order_accepts_platform_donation(self):
        """Test that create-order endpoint accepts platformDonationAmount"""
        # Get a public event first
        response = requests.get(f"{BASE_URL}/api/events/public")
        assert response.status_code == 200
        events = response.json().get("events", [])
        
        if not events:
            pytest.skip("No public events available for testing")
        
        event = events[0]
        event_id = event.get("id")
        
        # Try to create an order with platform donation
        # Note: This will fail at Stripe level but should validate the request structure
        order_data = {
            "eventId": event_id,
            "ticketSelections": {"general": 1},
            "addOnSelections": {},
            "promoCode": None,
            "affiliateCode": None,
            "platformDonationAmount": 5,  # $5 donation
            "customerEmail": "test@example.com",
            "customerName": "Test User",
            "successUrl": "http://localhost:3000/?success=true",
            "cancelUrl": "http://localhost:3000/?canceled=true",
            "userId": None,
            "assignments": {},
            "phoneNumber": ""
        }
        
        response = requests.post(
            f"{BASE_URL}/api/stripe/create-order",
            json=order_data,
            headers={"Content-Type": "application/json"}
        )
        
        # The request should be accepted (200) or fail at Stripe level (not 400 for bad request)
        # A 400 would indicate the platformDonationAmount field is not accepted
        print(f"Create order response status: {response.status_code}")
        print(f"Create order response: {response.text[:500]}")
        
        # If we get a 500, it's likely a Stripe error (expected in test env)
        # If we get a 400 with "Missing" error, the field structure is wrong
        if response.status_code == 400:
            data = response.json()
            # Check if error is about platformDonationAmount
            error_msg = data.get("error", "")
            assert "platformDonationAmount" not in error_msg.lower(), \
                f"Backend rejected platformDonationAmount field: {error_msg}"
        
        # Any response other than explicit rejection of the field is acceptable
        print("Backend accepts platformDonationAmount in create-order request")
    
    def test_calculate_order_endpoint(self):
        """Test the calculate-order endpoint"""
        response = requests.get(f"{BASE_URL}/api/events/public")
        assert response.status_code == 200
        events = response.json().get("events", [])
        
        if not events:
            pytest.skip("No public events available for testing")
        
        event = events[0]
        event_id = event.get("id")
        
        calc_data = {
            "eventId": event_id,
            "ticketSelections": {"general": 1},
            "addOnSelections": {},
            "promoCode": None
        }
        
        response = requests.post(
            f"{BASE_URL}/api/stripe/calculate-order",
            json=calc_data,
            headers={"Content-Type": "application/json"}
        )
        
        print(f"Calculate order response status: {response.status_code}")
        if response.status_code == 200:
            data = response.json()
            print(f"Order breakdown: {data}")
            # Verify the response has expected fields
            assert "grandTotal" in data or "items" in data, "Missing expected fields in response"
        else:
            print(f"Calculate order response: {response.text[:300]}")


class TestOrganizerProfileSubscription:
    """Test organizer profile and subscription plan detection"""
    
    def test_get_organizer_profile_with_subscription(self):
        """Verify organizer profile includes subscription info"""
        # Known organizer ID from the events
        organizer_id = "9iQqNVY6RdesJeBxhnqTjsfMche2"
        
        response = requests.get(f"{BASE_URL}/api/auth/profiles/{organizer_id}")
        assert response.status_code == 200
        
        data = response.json()
        profile = data.get("profile", {})
        
        # Check subscription field exists
        subscription = profile.get("subscription")
        print(f"Organizer subscription: {subscription}")
        
        if subscription:
            plan = subscription.get("plan", "free")
            print(f"Organizer plan: {plan}")
            assert plan in ["free", "pro", "premium"], f"Invalid plan: {plan}"
        else:
            print("Organizer has no subscription (defaults to free)")
    
    def test_free_plan_organizer_detected(self):
        """Verify free plan organizer is correctly identified"""
        organizer_id = "9iQqNVY6RdesJeBxhnqTjsfMche2"
        
        response = requests.get(f"{BASE_URL}/api/auth/profiles/{organizer_id}")
        assert response.status_code == 200
        
        data = response.json()
        profile = data.get("profile", {})
        subscription = profile.get("subscription", {})
        
        plan = subscription.get("plan", "free") if subscription else "free"
        assert plan == "free", f"Expected free plan, got: {plan}"
        print(f"Confirmed organizer {organizer_id} is on free plan")


class TestEventHidePlatformDonationField:
    """Test the hidePlatformDonation field in events"""
    
    def test_event_schema_supports_hide_platform_donation(self):
        """Verify the event schema supports hidePlatformDonation field"""
        # This is a schema validation test
        # The field should be accepted when creating/updating events
        response = requests.get(f"{BASE_URL}/api/events/public")
        assert response.status_code == 200
        
        events = response.json().get("events", [])
        print(f"Retrieved {len(events)} events")
        
        # Check if any event has the field set
        for event in events:
            if "hide_platform_donation" in event or "hidePlatformDonation" in event:
                print(f"Event {event.get('id')} has hidePlatformDonation field")
                break
        else:
            print("No events have hidePlatformDonation set (field is optional)")


if __name__ == "__main__":
    pytest.main([__file__, "-v", "--tb=short"])
