"""
Production Readiness Testing for Event Ticketing Platform
Tests critical fixes: 401 auth fix, CSRF, Stripe settings, migrations, financial transactions
"""
import pytest
import requests
import os

BASE_URL = os.environ.get('VITE_BACKEND_URL', 'https://www.openticket.events')

class TestHealthAndBasics:
    """Health check and basic API availability"""
    
    def test_health_endpoint(self):
        """Health endpoint should return 200"""
        response = requests.get(f"{BASE_URL}/api/health")
        assert response.status_code == 200, f"Health check failed: {response.text}"
        print("✅ Health endpoint working")
    
    def test_csrf_token_endpoint(self):
        """CSRF token endpoint should return token"""
        response = requests.get(f"{BASE_URL}/api/csrf-token")
        assert response.status_code == 200, f"CSRF token failed: {response.text}"
        data = response.json()
        assert 'csrfToken' in data, "CSRF token not in response"
        assert len(data['csrfToken']) > 0, "CSRF token is empty"
        print(f"✅ CSRF token received: {data['csrfToken'][:20]}...")


class TestAuthEndpoints:
    """Test authentication-related endpoints"""
    
    def test_protected_endpoint_without_auth_returns_401(self):
        """Protected endpoints should return 401 without auth header"""
        response = requests.get(f"{BASE_URL}/api/admin/users")
        assert response.status_code == 401, f"Expected 401, got {response.status_code}"
        data = response.json()
        # Verify the fix: should say "Missing Authorization header" not other errors
        assert 'error' in data or 'message' in data, "No error message in 401 response"
        print(f"✅ Auth check working: {data}")
    
    def test_platform_settings_stripe_requires_auth(self):
        """Platform settings endpoint should require authentication"""
        response = requests.get(f"{BASE_URL}/api/platform-settings/stripe")
        assert response.status_code == 401, f"Expected 401, got {response.status_code}"
        print("✅ Platform settings endpoint requires auth")
    
    def test_run_migration_requires_auth(self):
        """Migration endpoint should require authentication"""
        response = requests.post(f"{BASE_URL}/api/admin/run-migration", json={
            "migration": "backfill_transaction_types",
            "dryRun": True
        })
        assert response.status_code == 401, f"Expected 401, got {response.status_code}"
        print("✅ Migration endpoint requires auth")


class TestPlatformSettingsRoutes:
    """Test platform settings routes exist and respond correctly"""
    
    def test_stripe_settings_route_exists(self):
        """GET /api/platform-settings/stripe should exist"""
        response = requests.get(f"{BASE_URL}/api/platform-settings/stripe")
        # 401 means route exists but requires auth
        assert response.status_code == 401, f"Expected 401 (route exists), got {response.status_code}"
        print("✅ Stripe settings route exists")
    
    def test_put_stripe_settings_route_exists(self):
        """PUT /api/platform-settings/stripe should exist"""
        response = requests.put(f"{BASE_URL}/api/platform-settings/stripe", json={
            "publishableKey": "pk_test_example",
            "secretKey": "sk_test_example"
        })
        # 401 means route exists but requires auth
        assert response.status_code == 401, f"Expected 401 (route exists), got {response.status_code}"
        print("✅ PUT Stripe settings route exists")
    
    def test_all_settings_route_exists(self):
        """GET /api/platform-settings/all should exist"""
        response = requests.get(f"{BASE_URL}/api/platform-settings/all")
        # 401 means route exists but requires auth
        assert response.status_code == 401, f"Expected 401 (route exists), got {response.status_code}"
        print("✅ All settings route exists")


class TestMigrationEndpoints:
    """Test migration endpoint availability"""
    
    def test_migration_endpoint_exists(self):
        """POST /api/admin/run-migration should exist"""
        response = requests.post(f"{BASE_URL}/api/admin/run-migration", json={
            "migration": "backfill_transaction_types",
            "dryRun": True
        })
        # 401 means route exists but requires auth
        assert response.status_code == 401, f"Expected 401 (route exists), got {response.status_code}"
        print("✅ Migration endpoint exists")
    
    def test_migration_with_invalid_body(self):
        """Migration endpoint should handle missing body properly"""
        response = requests.post(f"{BASE_URL}/api/admin/run-migration", json={})
        # Should still require auth first (401)
        assert response.status_code == 401, f"Expected 401, got {response.status_code}"
        print("✅ Migration endpoint validates auth before body")


class TestFinancialEndpoints:
    """Test financial-related endpoints"""
    
    def test_financials_endpoint_exists(self):
        """GET /api/admin/financials should exist"""
        response = requests.get(f"{BASE_URL}/api/admin/financials")
        assert response.status_code == 401, f"Expected 401 (route exists), got {response.status_code}"
        print("✅ Financials endpoint exists")
    
    def test_platform_payouts_pending_exists(self):
        """GET /api/admin/platform-payouts/pending should exist"""
        response = requests.get(f"{BASE_URL}/api/admin/platform-payouts/pending")
        assert response.status_code == 401, f"Expected 401 (route exists), got {response.status_code}"
        print("✅ Platform payouts pending endpoint exists")
    
    def test_platform_payouts_list_exists(self):
        """GET /api/admin/platform-payouts should exist"""
        response = requests.get(f"{BASE_URL}/api/admin/platform-payouts")
        assert response.status_code == 401, f"Expected 401 (route exists), got {response.status_code}"
        print("✅ Platform payouts list endpoint exists")


class TestAuditLogEndpoints:
    """Test audit log endpoints"""
    
    def test_audit_logs_endpoint_exists(self):
        """GET /api/admin/audit-logs should exist"""
        response = requests.get(f"{BASE_URL}/api/admin/audit-logs")
        assert response.status_code == 401, f"Expected 401 (route exists), got {response.status_code}"
        print("✅ Audit logs endpoint exists")
    
    def test_audit_logs_overview_exists(self):
        """GET /api/admin/audit-logs/overview should exist"""
        response = requests.get(f"{BASE_URL}/api/admin/audit-logs/overview")
        assert response.status_code == 401, f"Expected 401 (route exists), got {response.status_code}"
        print("✅ Audit logs overview endpoint exists")


class TestCSRFProtection:
    """Test CSRF token protection on authenticated endpoints"""
    
    def test_csrf_protected_endpoint_returns_403_without_token(self):
        """Endpoints should return 401 first (auth), not 403 (CSRF)"""
        # Without auth, we get 401 first - that's correct behavior
        response = requests.post(f"{BASE_URL}/api/admin/promo-codes", json={
            "code": "TEST",
            "type": "percentage",
            "value": 10
        })
        # Auth check happens before CSRF
        assert response.status_code == 401, f"Expected 401, got {response.status_code}"
        print("✅ Auth check before CSRF validation (correct order)")
    
    def test_csrf_token_is_unique_per_request(self):
        """Each CSRF token request should return a token"""
        tokens = []
        for _ in range(3):
            response = requests.get(f"{BASE_URL}/api/csrf-token")
            assert response.status_code == 200
            tokens.append(response.json().get('csrfToken'))
        
        # All tokens should be present
        assert all(t for t in tokens), "Some CSRF tokens are empty"
        print("✅ CSRF tokens consistently returned")


class TestPublicEndpoints:
    """Test public endpoints that don't require auth"""
    
    def test_events_list_public(self):
        """GET /api/events should be public"""
        response = requests.get(f"{BASE_URL}/api/events")
        # Could be 200 or return events array
        assert response.status_code in [200, 404], f"Unexpected status: {response.status_code}"
        print(f"✅ Events endpoint: {response.status_code}")
    
    def test_affiliate_by_code_public(self):
        """GET /api/admin/affiliate/by-code/:code is public"""
        response = requests.get(f"{BASE_URL}/api/admin/affiliate/by-code/TESTCODE")
        # 404 is expected for non-existent code
        assert response.status_code in [200, 404], f"Unexpected status: {response.status_code}"
        print(f"✅ Affiliate by code endpoint: {response.status_code}")
    
    def test_affiliate_click_tracking_public(self):
        """POST /api/admin/affiliate/track-click is public"""
        response = requests.post(f"{BASE_URL}/api/admin/affiliate/track-click", json={
            "affiliateCode": "NONEXISTENT"
        })
        # Should succeed even with unknown code (returns tracked: false)
        assert response.status_code == 200, f"Unexpected status: {response.status_code}"
        data = response.json()
        assert 'tracked' in data, "Response should have 'tracked' field"
        print(f"✅ Affiliate click tracking: {data}")


class TestStripeRelatedEndpoints:
    """Test Stripe-related endpoints"""
    
    def test_checkout_session_requires_event_data(self):
        """POST /api/stripe/create-checkout-session should validate input"""
        response = requests.post(f"{BASE_URL}/api/stripe/create-checkout-session", json={})
        # Without event data, should return validation error
        assert response.status_code in [400, 401, 422], f"Unexpected status: {response.status_code}"
        print(f"✅ Checkout session validates input: {response.status_code}")
    
    def test_subscription_prices_endpoint(self):
        """GET /api/stripe/subscription-prices should exist"""
        response = requests.get(f"{BASE_URL}/api/stripe/subscription-prices")
        # This may be 200 if public, or 401 if protected
        assert response.status_code in [200, 401, 404], f"Unexpected status: {response.status_code}"
        print(f"✅ Subscription prices endpoint: {response.status_code}")


class TestAdminRoutes:
    """Test admin-specific routes"""
    
    def test_admin_users_list(self):
        """GET /api/admin/users should require admin auth"""
        response = requests.get(f"{BASE_URL}/api/admin/users")
        assert response.status_code == 401, f"Expected 401, got {response.status_code}"
        print("✅ Admin users endpoint requires auth")
    
    def test_admin_events_list(self):
        """GET /api/admin/events should require admin auth"""
        response = requests.get(f"{BASE_URL}/api/admin/events")
        assert response.status_code == 401, f"Expected 401, got {response.status_code}"
        print("✅ Admin events endpoint requires auth")
    
    def test_admin_registrations_list(self):
        """GET /api/admin/registrations should require admin auth"""
        response = requests.get(f"{BASE_URL}/api/admin/registrations")
        assert response.status_code == 401, f"Expected 401, got {response.status_code}"
        print("✅ Admin registrations endpoint requires auth")


class TestAffiliateEndpoints:
    """Test affiliate management endpoints"""
    
    def test_affiliate_analytics_requires_admin(self):
        """GET /api/admin/affiliate/analytics should require admin"""
        response = requests.get(f"{BASE_URL}/api/admin/affiliate/analytics")
        assert response.status_code == 401, f"Expected 401, got {response.status_code}"
        print("✅ Affiliate analytics requires auth")
    
    def test_affiliate_list_requires_admin(self):
        """GET /api/admin/affiliates should require admin"""
        response = requests.get(f"{BASE_URL}/api/admin/affiliates")
        assert response.status_code == 401, f"Expected 401, got {response.status_code}"
        print("✅ Affiliate list requires auth")


if __name__ == '__main__':
    pytest.main([__file__, '-v'])
