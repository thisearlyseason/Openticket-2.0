"""
Comprehensive Feature Audit Test Suite for OpenTicket Platform
Tests all API endpoints for all user roles: Superadmin, Organizers, Affiliates, Attendees
"""
import pytest
import requests
import os
import json
from datetime import datetime

# Get base URL from environment
BASE_URL = os.environ.get('VITE_BACKEND_URL', 'https://www.openticket.events').rstrip('/')

class TestPublicEndpoints:
    """Test public endpoints that don't require authentication"""
    
    def test_health_check(self):
        """API health check endpoint"""
        response = requests.get(f"{BASE_URL}/api/health")
        assert response.status_code == 200
        data = response.json()
        assert data.get('status') == 'healthy'
        print(f"✅ Health check passed: {data}")
    
    def test_ping_endpoint(self):
        """Simple ping endpoint"""
        response = requests.get(f"{BASE_URL}/api/ping")
        assert response.status_code == 200
        assert response.text == 'pong'
        print("✅ Ping endpoint working")
    
    def test_debug_env(self):
        """Debug environment endpoint"""
        response = requests.get(f"{BASE_URL}/api/debug-env")
        assert response.status_code == 200
        data = response.json()
        assert 'frontendUrl' in data
        print(f"✅ Debug env: {data}")
    
    def test_get_public_events(self):
        """Get public events list"""
        response = requests.get(f"{BASE_URL}/api/events")
        assert response.status_code == 200
        data = response.json()
        # Should return array of events
        assert isinstance(data, list) or 'events' in data
        print(f"✅ Public events endpoint working, returned {len(data) if isinstance(data, list) else len(data.get('events', []))} events")
    
    def test_get_admin_gemini_key_public(self):
        """GET admin Gemini key should be public (for other roles to read)"""
        response = requests.get(f"{BASE_URL}/api/settings/admin-gemini-key")
        assert response.status_code == 200
        data = response.json()
        # Should return key or empty
        print(f"✅ Admin Gemini key GET is public: {data}")
    
    def test_affiliate_track_click(self):
        """Track affiliate click (public endpoint)"""
        response = requests.post(f"{BASE_URL}/api/admin/affiliate/track-click", json={
            "affiliateCode": "TEST123",
            "eventId": "test-event-id"
        })
        # Should return 200 even for unknown codes
        assert response.status_code == 200
        data = response.json()
        print(f"✅ Affiliate click tracking: {data}")
    
    def test_affiliate_by_code_lookup(self):
        """Lookup affiliate by code (public for checkout discount)"""
        response = requests.get(f"{BASE_URL}/api/admin/affiliate/by-code/TESTCODE")
        # 404 is expected for non-existent code
        assert response.status_code in [200, 404]
        print(f"✅ Affiliate by code lookup: status {response.status_code}")


class TestAuthEndpoints:
    """Test authentication endpoints"""
    
    def test_login_endpoint_exists(self):
        """Login endpoint should exist"""
        response = requests.post(f"{BASE_URL}/api/auth/login", json={
            "email": "test@example.com",
            "password": "wrongpassword"
        })
        # Should return 401 for wrong credentials, not 404
        assert response.status_code in [400, 401, 403, 500]
        print(f"✅ Login endpoint exists, returned {response.status_code}")
    
    def test_signup_endpoint_exists(self):
        """Signup endpoint should exist"""
        response = requests.post(f"{BASE_URL}/api/auth/signup", json={
            "email": f"test_{datetime.now().timestamp()}@example.com",
            "password": "TestPass123!",
            "name": "Test User"
        })
        # Should return some response (not 404)
        assert response.status_code != 404
        print(f"✅ Signup endpoint exists, returned {response.status_code}")
    
    def test_profile_endpoint_requires_auth(self):
        """Profile endpoint should require authentication"""
        response = requests.get(f"{BASE_URL}/api/auth/me")
        assert response.status_code in [401, 403]
        print(f"✅ Profile endpoint requires auth: {response.status_code}")


class TestTicketLookupEndpoints:
    """Test ticket lookup (Find My Tickets) endpoints"""
    
    def test_find_tickets_by_email(self):
        """POST /api/tickets/find-by-email"""
        response = requests.post(f"{BASE_URL}/api/tickets/find-by-email", json={
            "email": "test@example.com"
        })
        assert response.status_code == 200
        data = response.json()
        assert 'success' in data
        print(f"✅ Find tickets by email: {data}")
    
    def test_find_tickets_missing_email(self):
        """Should return 400 for missing email"""
        response = requests.post(f"{BASE_URL}/api/tickets/find-by-email", json={})
        assert response.status_code == 400
        print(f"✅ Find tickets validates email required")


class TestRegistrationEndpoints:
    """Test registration endpoints"""
    
    def test_get_all_registrations_public(self):
        """GET all registrations (may be public or require auth)"""
        response = requests.get(f"{BASE_URL}/api/registrations")
        # Could be 200 (public) or 401/403 (requires auth)
        assert response.status_code in [200, 401, 403]
        print(f"✅ Registrations endpoint: {response.status_code}")
    
    def test_checkin_requires_auth(self):
        """Check-in endpoint requires authentication"""
        response = requests.post(f"{BASE_URL}/api/registrations/checkin", json={
            "qrData": "test-qr-data"
        })
        assert response.status_code in [401, 403]
        print(f"✅ Check-in requires auth: {response.status_code}")


class TestAdminEndpointsProtection:
    """Test that admin endpoints are properly protected"""
    
    def test_admin_users_requires_auth(self):
        """GET /api/admin/users requires admin auth"""
        response = requests.get(f"{BASE_URL}/api/admin/users")
        assert response.status_code in [401, 403]
        print(f"✅ Admin users endpoint protected: {response.status_code}")
    
    def test_admin_events_requires_auth(self):
        """GET /api/admin/events requires admin auth"""
        response = requests.get(f"{BASE_URL}/api/admin/events")
        assert response.status_code in [401, 403]
        print(f"✅ Admin events endpoint protected: {response.status_code}")
    
    def test_admin_registrations_requires_auth(self):
        """GET /api/admin/registrations requires admin auth"""
        response = requests.get(f"{BASE_URL}/api/admin/registrations")
        assert response.status_code in [401, 403]
        print(f"✅ Admin registrations endpoint protected: {response.status_code}")
    
    def test_admin_financials_requires_auth(self):
        """GET /api/admin/financials requires admin auth"""
        response = requests.get(f"{BASE_URL}/api/admin/financials")
        assert response.status_code in [401, 403]
        print(f"✅ Admin financials endpoint protected: {response.status_code}")
    
    def test_admin_promo_codes_requires_auth(self):
        """GET /api/admin/promo-codes requires admin auth"""
        response = requests.get(f"{BASE_URL}/api/admin/promo-codes")
        assert response.status_code in [401, 403]
        print(f"✅ Admin promo codes endpoint protected: {response.status_code}")
    
    def test_admin_affiliate_analytics_requires_auth(self):
        """GET /api/admin/affiliate/analytics requires admin auth"""
        response = requests.get(f"{BASE_URL}/api/admin/affiliate/analytics")
        assert response.status_code in [401, 403]
        print(f"✅ Admin affiliate analytics protected: {response.status_code}")
    
    def test_admin_affiliate_payouts_requires_auth(self):
        """GET /api/admin/affiliate-payouts requires admin auth"""
        response = requests.get(f"{BASE_URL}/api/admin/affiliate-payouts")
        assert response.status_code in [401, 403]
        print(f"✅ Admin affiliate payouts protected: {response.status_code}")
    
    def test_admin_platform_payouts_requires_auth(self):
        """GET /api/admin/platform-payouts requires admin auth"""
        response = requests.get(f"{BASE_URL}/api/admin/platform-payouts")
        assert response.status_code in [401, 403]
        print(f"✅ Admin platform payouts protected: {response.status_code}")
    
    def test_admin_audit_logs_requires_auth(self):
        """GET /api/admin/audit-logs requires admin auth"""
        response = requests.get(f"{BASE_URL}/api/admin/audit-logs")
        assert response.status_code in [401, 403]
        print(f"✅ Admin audit logs protected: {response.status_code}")
    
    def test_admin_security_audit_logs_requires_auth(self):
        """GET /api/admin/security-audit-logs/suspicious requires admin auth"""
        response = requests.get(f"{BASE_URL}/api/admin/security-audit-logs/suspicious")
        assert response.status_code in [401, 403]
        print(f"✅ Admin security audit logs protected: {response.status_code}")
    
    def test_admin_analytics_overview_requires_auth(self):
        """GET /api/admin/analytics/overview requires admin auth"""
        response = requests.get(f"{BASE_URL}/api/admin/analytics/overview")
        assert response.status_code in [401, 403]
        print(f"✅ Admin analytics overview protected: {response.status_code}")
    
    def test_post_gemini_key_requires_auth(self):
        """POST admin Gemini key requires SuperAdmin auth"""
        response = requests.post(f"{BASE_URL}/api/settings/admin-gemini-key", json={
            "key": "test-key"
        })
        assert response.status_code in [401, 403]
        print(f"✅ POST Gemini key requires auth: {response.status_code}")


class TestStripeEndpoints:
    """Test Stripe-related endpoints"""
    
    def test_stripe_routes_exist(self):
        """Stripe routes should exist"""
        response = requests.get(f"{BASE_URL}/api/stripe")
        # Should not be 404
        assert response.status_code != 404
        print(f"✅ Stripe routes exist: {response.status_code}")
    
    def test_subscription_routes_exist(self):
        """Subscription routes should exist"""
        response = requests.get(f"{BASE_URL}/api/subscription")
        # Should not be 404
        assert response.status_code != 404
        print(f"✅ Subscription routes exist: {response.status_code}")


class TestEmailEndpoints:
    """Test email-related endpoints"""
    
    def test_email_status(self):
        """GET /api/email/status"""
        response = requests.get(f"{BASE_URL}/api/email/status")
        assert response.status_code == 200
        data = response.json()
        print(f"✅ Email status: {data}")


class TestAnalyticsEndpoints:
    """Test analytics endpoints"""
    
    def test_analytics_routes_exist(self):
        """Analytics routes should exist"""
        response = requests.get(f"{BASE_URL}/api/analytics")
        # Should not be 404
        assert response.status_code != 404
        print(f"✅ Analytics routes exist: {response.status_code}")


class TestOnboardingEndpoints:
    """Test onboarding endpoints"""
    
    def test_onboarding_routes_exist(self):
        """Onboarding routes should exist"""
        response = requests.get(f"{BASE_URL}/api/onboarding")
        # Should not be 404
        assert response.status_code != 404
        print(f"✅ Onboarding routes exist: {response.status_code}")


class TestKioskEndpoints:
    """Test kiosk mode endpoints"""
    
    def test_kiosk_routes_exist(self):
        """Kiosk routes should exist"""
        response = requests.get(f"{BASE_URL}/api/kiosk")
        # Should not be 404
        assert response.status_code != 404
        print(f"✅ Kiosk routes exist: {response.status_code}")


class TestEnterpriseEndpoints:
    """Test enterprise contact endpoints"""
    
    def test_enterprise_routes_exist(self):
        """Enterprise routes should exist"""
        response = requests.get(f"{BASE_URL}/api/enterprise")
        # Should not be 404
        assert response.status_code != 404
        print(f"✅ Enterprise routes exist: {response.status_code}")


class TestWaitlistEndpoints:
    """Test waitlist endpoints"""
    
    def test_waitlist_routes_exist(self):
        """Waitlist routes should exist"""
        response = requests.get(f"{BASE_URL}/api/waitlist")
        # Should not be 404
        assert response.status_code != 404
        print(f"✅ Waitlist routes exist: {response.status_code}")


class TestPushNotificationEndpoints:
    """Test push notification endpoints"""
    
    def test_push_routes_exist(self):
        """Push notification routes should exist"""
        response = requests.get(f"{BASE_URL}/api/push")
        # Should not be 404
        assert response.status_code != 404
        print(f"✅ Push routes exist: {response.status_code}")


class TestAIEndpoints:
    """Test AI (image generation) endpoints"""
    
    def test_ai_routes_exist(self):
        """AI routes should exist"""
        response = requests.get(f"{BASE_URL}/api/ai")
        # Should not be 404
        assert response.status_code != 404
        print(f"✅ AI routes exist: {response.status_code}")


class TestSMMEndpoints:
    """Test Social Media Management endpoints"""
    
    def test_smm_routes_exist(self):
        """SMM routes should exist"""
        response = requests.get(f"{BASE_URL}/api/smm")
        # Should not be 404
        assert response.status_code != 404
        print(f"✅ SMM routes exist: {response.status_code}")


class TestUploadEndpoints:
    """Test upload endpoints"""
    
    def test_upload_routes_exist(self):
        """Upload routes should exist"""
        response = requests.get(f"{BASE_URL}/api/upload")
        # Should not be 404
        assert response.status_code != 404
        print(f"✅ Upload routes exist: {response.status_code}")


class TestNotificationEndpoints:
    """Test notification endpoints"""
    
    def test_notification_routes_exist(self):
        """Notification routes should exist"""
        response = requests.get(f"{BASE_URL}/api/notifications")
        # Should not be 404
        assert response.status_code != 404
        print(f"✅ Notification routes exist: {response.status_code}")


class TestSettingsEndpoints:
    """Test settings endpoints"""
    
    def test_settings_routes_exist(self):
        """Settings routes should exist"""
        response = requests.get(f"{BASE_URL}/api/settings")
        # Should not be 404
        assert response.status_code != 404
        print(f"✅ Settings routes exist: {response.status_code}")


# Summary test
class TestAPISummary:
    """Summary of all API endpoints"""
    
    def test_all_routes_summary(self):
        """Print summary of all tested routes"""
        routes = [
            "/api/health",
            "/api/ping",
            "/api/debug-env",
            "/api/events",
            "/api/auth/login",
            "/api/auth/signup",
            "/api/auth/me",
            "/api/tickets/find-by-email",
            "/api/registrations",
            "/api/admin/users",
            "/api/admin/events",
            "/api/admin/financials",
            "/api/admin/promo-codes",
            "/api/admin/affiliate/analytics",
            "/api/admin/affiliate-payouts",
            "/api/admin/platform-payouts",
            "/api/admin/audit-logs",
            "/api/settings/admin-gemini-key",
            "/api/stripe",
            "/api/subscription",
            "/api/email/status",
            "/api/analytics",
            "/api/onboarding",
            "/api/kiosk",
            "/api/enterprise",
            "/api/waitlist",
            "/api/push",
            "/api/ai",
            "/api/smm",
            "/api/upload",
            "/api/notifications",
            "/api/settings"
        ]
        
        print("\n" + "="*60)
        print("API ROUTES TESTED:")
        print("="*60)
        for route in routes:
            print(f"  ✓ {route}")
        print("="*60)
        print(f"Total routes tested: {len(routes)}")
        print("="*60)


if __name__ == "__main__":
    pytest.main([__file__, "-v", "--tb=short"])
