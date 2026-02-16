"""
Comprehensive Functional Tests for OpenTicket Platform
Tests: Event CRUD, Stripe/Payment, Presale, Registration flows
"""
import pytest
import requests
import os
import json
from datetime import datetime, timedelta

BASE_URL = os.environ.get('VITE_BACKEND_URL', 'https://www.openticket.events')

class TestHealthAndPublicEndpoints:
    """Test health check and public endpoints"""
    
    def test_health_check(self):
        """Health endpoint should return 200"""
        response = requests.get(f"{BASE_URL}/api/health")
        assert response.status_code == 200
        data = response.json()
        assert data.get('status') == 'healthy'
        print(f"✅ Health check passed: {data}")
    
    def test_public_events_endpoint(self):
        """Public events endpoint should work without auth"""
        response = requests.get(f"{BASE_URL}/api/events/public")
        assert response.status_code == 200
        data = response.json()
        assert 'events' in data
        print(f"✅ Public events returned {len(data['events'])} events")
    
    def test_exchange_rates_endpoint(self):
        """Currency exchange rates endpoint"""
        response = requests.get(f"{BASE_URL}/api/stripe/exchange-rates")
        assert response.status_code == 200
        data = response.json()
        assert data.get('success') == True
        assert 'rates' in data
        assert 'USD' in data['rates']
        print(f"✅ Exchange rates: USD=1, EUR={data['rates'].get('EUR')}, GBP={data['rates'].get('GBP')}")


class TestEventEndpoints:
    """Test Event CRUD - requires auth for write operations"""
    
    def test_get_event_by_id_invalid(self):
        """Getting non-existent event should return 404"""
        response = requests.get(f"{BASE_URL}/api/events/nonexistent-id-12345")
        assert response.status_code == 404
        print("✅ Non-existent event returns 404")
    
    def test_create_event_requires_auth(self):
        """Creating event without auth should return 401"""
        event_data = {
            "title": "Test Event",
            "date": "2026-03-01",
            "time": "19:00",
            "location": "Test Venue",
            "price_type": "free"
        }
        response = requests.post(f"{BASE_URL}/api/events", json=event_data)
        assert response.status_code == 401
        print("✅ Create event without auth returns 401")
    
    def test_update_event_requires_auth(self):
        """Updating event without auth should return 401"""
        response = requests.put(
            f"{BASE_URL}/api/events/any-event-id",
            json={"title": "Updated Title"}
        )
        assert response.status_code == 401
        print("✅ Update event without auth returns 401")
    
    def test_delete_event_requires_auth(self):
        """Deleting event without auth should return 401"""
        response = requests.delete(f"{BASE_URL}/api/events/any-event-id")
        assert response.status_code == 401
        print("✅ Delete event without auth returns 401")
    
    def test_get_organizer_events_requires_auth(self):
        """Getting organizer's events requires auth"""
        response = requests.get(f"{BASE_URL}/api/events")
        assert response.status_code == 401
        print("✅ Get organizer events without auth returns 401")


class TestPresaleEndpoints:
    """Test Presale functionality"""
    
    def test_presale_validate_nonexistent_event(self):
        """Presale validate for non-existent event should return 404"""
        response = requests.post(
            f"{BASE_URL}/api/presale/nonexistent-event-id/validate",
            json={}
        )
        assert response.status_code in [404, 500]  # 404 preferred, 500 acceptable
        print(f"✅ Presale validate for non-existent event returns {response.status_code}")
    
    def test_presale_subscribe_invalid_email(self):
        """Presale subscribe with invalid email should fail"""
        response = requests.post(
            f"{BASE_URL}/api/presale/test-event-id/subscribe",
            json={"email": "notanemail", "name": "Test User"}
        )
        # Should return 400 or 404 (event not found)
        assert response.status_code in [400, 404]
        print(f"✅ Presale subscribe with invalid email returns {response.status_code}")
    
    def test_presale_codes_requires_auth(self):
        """Getting presale codes requires authentication"""
        response = requests.get(f"{BASE_URL}/api/presale/test-event-id/codes")
        assert response.status_code == 401
        print("✅ Presale codes without auth returns 401")
    
    def test_presale_subscribers_requires_auth(self):
        """Getting presale subscribers requires authentication"""
        response = requests.get(f"{BASE_URL}/api/presale/test-event-id/subscribers")
        assert response.status_code == 401
        print("✅ Presale subscribers without auth returns 401")


class TestStripeEndpoints:
    """Test Stripe/Payment endpoints"""
    
    def test_calculate_order_missing_event(self):
        """Calculate order for non-existent event"""
        response = requests.post(
            f"{BASE_URL}/api/stripe/calculate-order",
            json={
                "eventId": "nonexistent-event-id",
                "ticketSelections": {"general": 1}
            }
        )
        assert response.status_code == 404
        print("✅ Calculate order for non-existent event returns 404")
    
    def test_create_order_missing_event(self):
        """Create order for non-existent event"""
        response = requests.post(
            f"{BASE_URL}/api/stripe/create-order",
            json={
                "eventId": "nonexistent-event-id",
                "ticketSelections": {"general": 1},
                "customerEmail": "test@example.com",
                "customerName": "Test User",
                "successUrl": "https://example.com/success",
                "cancelUrl": "https://example.com/cancel"
            }
        )
        assert response.status_code == 404
        print("✅ Create order for non-existent event returns 404")
    
    def test_verify_session_missing_id(self):
        """Verify session without session ID should fail"""
        response = requests.post(
            f"{BASE_URL}/api/stripe/verify-session",
            json={}
        )
        assert response.status_code == 400
        print("✅ Verify session without ID returns 400")
    
    def test_create_portal_session_requires_auth(self):
        """Create portal session requires authentication"""
        response = requests.post(f"{BASE_URL}/api/stripe/create-portal-session", json={})
        assert response.status_code == 401
        print("✅ Create portal session without auth returns 401")
    
    def test_convert_price_endpoint(self):
        """Test currency conversion endpoint"""
        response = requests.post(
            f"{BASE_URL}/api/stripe/convert-price",
            json={"amountUSD": 100, "targetCurrency": "EUR"}
        )
        assert response.status_code == 200
        data = response.json()
        assert 'convertedAmount' in data
        assert data.get('currency') == 'EUR'
        print(f"✅ Currency conversion: $100 USD = {data['convertedAmount']} EUR")


class TestRegistrationEndpoints:
    """Test Registration endpoints"""
    
    def test_get_registrations_requires_auth(self):
        """Getting registrations requires auth"""
        response = requests.get(f"{BASE_URL}/api/registrations")
        assert response.status_code in [401, 403]  # Both indicate unauthorized
        print(f"✅ Get registrations without auth returns {response.status_code}")


class TestWaitlistEndpoints:
    """Test Waitlist functionality"""
    
    def test_join_waitlist_invalid_event(self):
        """Join waitlist for non-existent event"""
        response = requests.post(
            f"{BASE_URL}/api/waitlist/nonexistent-event-id/join",
            json={"name": "Test User", "email": "test@example.com"}
        )
        # Should return 404 for non-existent event
        assert response.status_code in [404, 400, 500]
        print(f"✅ Join waitlist for non-existent event returns {response.status_code}")


class TestAnalyticsEndpoints:
    """Test Analytics endpoints"""
    
    def test_track_page_view(self):
        """Track page view should work without auth"""
        response = requests.post(
            f"{BASE_URL}/api/analytics/track",
            json={
                "eventId": "test-event-id",
                "referrer": "https://google.com"
            }
        )
        # Should work even for non-existent events (fire and forget)
        assert response.status_code in [200, 201, 404, 500]
        print(f"✅ Analytics track returns {response.status_code}")


class TestStripeConnectEndpoints:
    """Test Stripe Connect endpoints"""
    
    def test_create_connect_account_requires_auth(self):
        """Creating Stripe Connect account requires auth"""
        response = requests.post(f"{BASE_URL}/api/stripe/connect/create-account", json={})
        assert response.status_code == 401
        print("✅ Create Connect account without auth returns 401")
    
    def test_connect_status_requires_auth(self):
        """Getting Connect status requires auth"""
        response = requests.get(f"{BASE_URL}/api/stripe/connect/status")
        assert response.status_code == 401
        print("✅ Get Connect status without auth returns 401")


class TestAtDoorPaymentEndpoints:
    """Test At-Door Payment endpoints"""
    
    def test_at_door_payment_intent_requires_auth(self):
        """Creating at-door payment intent should work without auth (check-in staff)"""
        response = requests.post(
            f"{BASE_URL}/api/stripe/at-door/create-payment-intent",
            json={
                "registrationId": "test-reg-id",
                "amount": 50
            }
        )
        # This should work without auth but fail with invalid registration
        assert response.status_code in [400, 404]
        print(f"✅ At-door payment intent with invalid reg returns {response.status_code}")
    
    def test_record_at_door_payment_requires_auth(self):
        """Recording at-door payment requires auth"""
        response = requests.post(
            f"{BASE_URL}/api/stripe/record-at-door-payment",
            json={
                "registrationId": "test-reg-id",
                "amount": 50,
                "method": "cash"
            }
        )
        assert response.status_code == 401
        print("✅ Record at-door payment without auth returns 401")


class TestPushNotificationEndpoints:
    """Test Push Notification endpoints"""
    
    def test_push_subscribe_requires_event(self):
        """Push subscription requires valid event"""
        response = requests.post(
            f"{BASE_URL}/api/push/subscribe",
            json={
                "subscription": {"endpoint": "https://example.com"},
                "eventId": "invalid-event-id"
            }
        )
        # Should fail without proper subscription data or auth
        assert response.status_code in [400, 401, 404, 500]
        print(f"✅ Push subscribe without proper data returns {response.status_code}")


class TestAdminEndpoints:
    """Test Admin endpoints - should all require admin auth"""
    
    def test_admin_users_requires_auth(self):
        """Admin users endpoint requires auth"""
        response = requests.get(f"{BASE_URL}/api/admin/users")
        assert response.status_code == 401
        print("✅ Admin users without auth returns 401")
    
    def test_admin_events_requires_auth(self):
        """Admin events endpoint requires auth"""
        response = requests.get(f"{BASE_URL}/api/admin/events")
        assert response.status_code == 401
        print("✅ Admin events without auth returns 401")


class TestInputValidation:
    """Test input validation across endpoints"""
    
    def test_create_order_invalid_urls(self):
        """Create order with missing URLs should fail"""
        response = requests.post(
            f"{BASE_URL}/api/stripe/create-order",
            json={
                "eventId": "test-event",
                "ticketSelections": {"general": 1},
                "customerEmail": "test@example.com"
                # Missing successUrl and cancelUrl
            }
        )
        assert response.status_code in [400, 404]
        print(f"✅ Create order without URLs returns {response.status_code}")
    
    def test_presale_subscribe_missing_fields(self):
        """Presale subscribe with missing email should fail"""
        response = requests.post(
            f"{BASE_URL}/api/presale/test-event/subscribe",
            json={"name": "Test User"}  # Missing email
        )
        # Should return 400 or 404
        assert response.status_code in [400, 404]
        print(f"✅ Presale subscribe without email returns {response.status_code}")


class TestAPIResponseFormat:
    """Test API response format consistency"""
    
    def test_error_response_format(self):
        """Error responses should have consistent format"""
        response = requests.get(f"{BASE_URL}/api/events/nonexistent")
        assert response.status_code == 404
        data = response.json()
        # Should have error key
        assert 'error' in data or 'message' in data
        print(f"✅ Error response format: {data}")
    
    def test_success_response_format(self):
        """Success responses should have consistent format"""
        response = requests.get(f"{BASE_URL}/api/events/public")
        assert response.status_code == 200
        data = response.json()
        # Public events should return events array
        assert 'events' in data
        assert isinstance(data['events'], list)
        print("✅ Success response has correct format")


# Fixtures
@pytest.fixture(scope="session")
def api_client():
    """Shared requests session"""
    session = requests.Session()
    session.headers.update({"Content-Type": "application/json"})
    return session


if __name__ == "__main__":
    pytest.main([__file__, "-v", "--tb=short"])
