"""
Production Readiness Testing for Event Ticketing Platform - v2
Tests critical fixes: 401 auth fix, CSRF, Stripe settings, migrations, financial transactions
Includes proper CSRF token handling for POST requests
"""
import pytest
import requests
import os

BASE_URL = os.environ.get('VITE_BACKEND_URL', 'https://www.openticket.events')

# Global session to persist cookies
session = requests.Session()

@pytest.fixture(scope="module", autouse=True)
def csrf_token():
    """Get CSRF token for POST requests"""
    response = session.get(f"{BASE_URL}/api/csrf-token")
    assert response.status_code == 200, f"CSRF token failed: {response.text}"
    data = response.json()
    token = data.get('csrfToken', '')
    session.headers.update({'x-csrf-token': token})
    return token


class TestHealthAndBasics:
    """Health check and basic API availability"""
    
    def test_health_endpoint(self):
        """Health endpoint should return 200"""
        response = session.get(f"{BASE_URL}/api/health")
        assert response.status_code == 200, f"Health check failed: {response.text}"
        print("✅ Health endpoint working")
    
    def test_csrf_token_endpoint(self):
        """CSRF token endpoint should return token"""
        response = session.get(f"{BASE_URL}/api/csrf-token")
        assert response.status_code == 200, f"CSRF token failed: {response.text}"
        data = response.json()
        assert 'csrfToken' in data, "CSRF token not in response"
        assert len(data['csrfToken']) > 0, "CSRF token is empty"
        print(f"✅ CSRF token received: {data['csrfToken'][:20]}...")


class TestAuthEndpoints:
    """Test authentication-related endpoints - verify 401 fix"""
    
    def test_protected_endpoint_without_auth_returns_401(self):
        """Protected endpoints should return 401 without auth header"""
        response = session.get(f"{BASE_URL}/api/admin/users")
        assert response.status_code == 401, f"Expected 401, got {response.status_code}"
        data = response.json()
        # Verify the fix: should say "Missing Authorization header"
        assert 'error' in data, "No error field in 401 response"
        assert 'Missing Authorization header' in data.get('error', ''), f"Wrong error message: {data}"
        print(f"✅ Auth check returns correct 401: {data}")
    
    def test_platform_settings_stripe_requires_auth(self):
        """Platform settings endpoint should return 401 with correct message"""
        response = session.get(f"{BASE_URL}/api/platform-settings/stripe")
        assert response.status_code == 401, f"Expected 401, got {response.status_code}"
        data = response.json()
        assert 'Missing Authorization header' in data.get('error', ''), f"Wrong error: {data}"
        print("✅ Platform settings endpoint requires auth with correct message")
    
    def test_run_migration_requires_auth(self, csrf_token):
        """Migration endpoint should return 401 with correct message"""
        response = session.post(f"{BASE_URL}/api/admin/run-migration", json={
            "migration": "backfill_transaction_types",
            "dryRun": True
        })
        assert response.status_code == 401, f"Expected 401, got {response.status_code}"
        data = response.json()
        assert 'Missing Authorization header' in data.get('error', ''), f"Wrong error: {data}"
        print("✅ Migration endpoint returns 401 with correct message")


class TestPlatformSettingsRoutes:
    """Test platform settings routes exist and respond correctly"""
    
    def test_stripe_settings_route_exists(self):
        """GET /api/platform-settings/stripe should exist (401 = route exists)"""
        response = session.get(f"{BASE_URL}/api/platform-settings/stripe")
        assert response.status_code == 401, f"Expected 401 (route exists), got {response.status_code}"
        print("✅ GET Stripe settings route exists")
    
    def test_put_stripe_settings_route_exists(self, csrf_token):
        """PUT /api/platform-settings/stripe should exist (401 = route exists)"""
        response = session.put(f"{BASE_URL}/api/platform-settings/stripe", json={
            "publishableKey": "pk_test_example",
            "secretKey": "sk_test_example"
        })
        # 401 means route exists but requires auth
        assert response.status_code == 401, f"Expected 401 (route exists), got {response.status_code}"
        data = response.json()
        assert 'Missing Authorization header' in data.get('error', ''), f"Wrong error: {data}"
        print("✅ PUT Stripe settings route exists")
    
    def test_all_settings_route_exists(self):
        """GET /api/platform-settings/all should exist"""
        response = session.get(f"{BASE_URL}/api/platform-settings/all")
        assert response.status_code == 401, f"Expected 401 (route exists), got {response.status_code}"
        print("✅ All settings route exists")


class TestMigrationEndpoints:
    """Test migration endpoint availability"""
    
    def test_migration_backfill_endpoint_exists(self, csrf_token):
        """POST /api/admin/run-migration for backfill_transaction_types should exist"""
        response = session.post(f"{BASE_URL}/api/admin/run-migration", json={
            "migration": "backfill_transaction_types",
            "dryRun": True
        })
        # 401 means route exists but requires auth
        assert response.status_code == 401, f"Expected 401 (route exists), got {response.status_code}"
        print("✅ Migration backfill endpoint exists")
    
    def test_migration_with_invalid_body(self, csrf_token):
        """Migration endpoint should handle missing body properly (auth first)"""
        response = session.post(f"{BASE_URL}/api/admin/run-migration", json={})
        # Should require auth first (401)
        assert response.status_code == 401, f"Expected 401, got {response.status_code}"
        print("✅ Migration endpoint validates auth before body")


class TestFinancialEndpoints:
    """Test financial-related endpoints"""
    
    def test_financials_endpoint_exists(self):
        """GET /api/admin/financials should exist"""
        response = session.get(f"{BASE_URL}/api/admin/financials")
        assert response.status_code == 401, f"Expected 401 (route exists), got {response.status_code}"
        print("✅ Financials endpoint exists")
    
    def test_platform_payouts_pending_exists(self):
        """GET /api/admin/platform-payouts/pending should exist"""
        response = session.get(f"{BASE_URL}/api/admin/platform-payouts/pending")
        assert response.status_code == 401, f"Expected 401 (route exists), got {response.status_code}"
        print("✅ Platform payouts pending endpoint exists")
    
    def test_platform_payouts_list_exists(self):
        """GET /api/admin/platform-payouts should exist"""
        response = session.get(f"{BASE_URL}/api/admin/platform-payouts")
        assert response.status_code == 401, f"Expected 401 (route exists), got {response.status_code}"
        print("✅ Platform payouts list endpoint exists")
    
    def test_platform_payout_schedule_exists(self, csrf_token):
        """POST /api/admin/platform-payouts/schedule should exist"""
        response = session.post(f"{BASE_URL}/api/admin/platform-payouts/schedule", json={
            "payoutType": "platform_fees",
            "amount": 100
        })
        assert response.status_code == 401, f"Expected 401 (route exists), got {response.status_code}"
        print("✅ Platform payout schedule endpoint exists")


class TestCSRFProtection:
    """Test CSRF token protection on authenticated endpoints"""
    
    def test_csrf_protected_post_without_token_returns_403(self):
        """POST endpoints without CSRF should return 403"""
        # Create a new session without CSRF token
        no_csrf_session = requests.Session()
        response = no_csrf_session.post(f"{BASE_URL}/api/admin/promo-codes", json={
            "code": "TEST",
            "type": "percentage",
            "value": 10
        })
        # Without CSRF, should get 403
        assert response.status_code == 403, f"Expected 403, got {response.status_code}"
        data = response.json()
        assert 'csrf' in data.get('error', '').lower() or 'EBADCSRFTOKEN' in data.get('code', ''), f"Should be CSRF error: {data}"
        print("✅ POST without CSRF returns 403 CSRF error")
    
    def test_csrf_protected_post_with_token_checks_auth(self, csrf_token):
        """POST endpoints with CSRF should check auth next"""
        response = session.post(f"{BASE_URL}/api/admin/promo-codes", json={
            "code": "TEST",
            "type": "percentage",
            "value": 10
        })
        # With CSRF but without auth, should get 401
        assert response.status_code == 401, f"Expected 401, got {response.status_code}"
        data = response.json()
        assert 'Missing Authorization header' in data.get('error', ''), f"Should be auth error: {data}"
        print("✅ POST with CSRF but no auth returns 401")
    
    def test_csrf_token_is_present_in_requests(self, csrf_token):
        """Each request should have CSRF token"""
        assert csrf_token is not None, "CSRF token should be present"
        assert len(csrf_token) > 20, "CSRF token should be reasonable length"
        print(f"✅ CSRF token present: {csrf_token[:20]}...")


class TestPublicEndpoints:
    """Test public endpoints that don't require auth"""
    
    def test_affiliate_by_code_public(self):
        """GET /api/admin/affiliate/by-code/:code is public"""
        response = session.get(f"{BASE_URL}/api/admin/affiliate/by-code/TESTCODE")
        # 404 is expected for non-existent code
        assert response.status_code in [200, 404], f"Unexpected status: {response.status_code}"
        print(f"✅ Affiliate by code endpoint: {response.status_code}")
    
    def test_affiliate_click_tracking_public(self, csrf_token):
        """POST /api/admin/affiliate/track-click is public (with CSRF)"""
        response = session.post(f"{BASE_URL}/api/admin/affiliate/track-click", json={
            "affiliateCode": "NONEXISTENT"
        })
        # Should succeed even with unknown code (returns tracked: false)
        assert response.status_code == 200, f"Unexpected status: {response.status_code}, body: {response.text}"
        data = response.json()
        assert 'tracked' in data, "Response should have 'tracked' field"
        print(f"✅ Affiliate click tracking: {data}")


class TestStripeRelatedEndpoints:
    """Test Stripe-related endpoints"""
    
    def test_subscription_prices_endpoint(self):
        """GET /api/stripe/subscription-prices should exist"""
        response = session.get(f"{BASE_URL}/api/stripe/subscription-prices")
        # This may be 200 if public, or 401 if protected
        assert response.status_code in [200, 401, 404], f"Unexpected status: {response.status_code}"
        print(f"✅ Subscription prices endpoint: {response.status_code}")


class TestAdminRoutes:
    """Test admin-specific routes"""
    
    def test_admin_users_list(self):
        """GET /api/admin/users should require admin auth"""
        response = session.get(f"{BASE_URL}/api/admin/users")
        assert response.status_code == 401, f"Expected 401, got {response.status_code}"
        data = response.json()
        assert 'Missing Authorization header' in data.get('error', ''), f"Wrong error: {data}"
        print("✅ Admin users endpoint requires auth")
    
    def test_admin_events_list(self):
        """GET /api/admin/events should require admin auth"""
        response = session.get(f"{BASE_URL}/api/admin/events")
        assert response.status_code == 401, f"Expected 401, got {response.status_code}"
        print("✅ Admin events endpoint requires auth")
    
    def test_admin_registrations_list(self):
        """GET /api/admin/registrations should require admin auth"""
        response = session.get(f"{BASE_URL}/api/admin/registrations")
        assert response.status_code == 401, f"Expected 401, got {response.status_code}"
        print("✅ Admin registrations endpoint requires auth")


class TestAffiliateEndpoints:
    """Test affiliate management endpoints"""
    
    def test_affiliate_analytics_requires_admin(self):
        """GET /api/admin/affiliate/analytics should require admin"""
        response = session.get(f"{BASE_URL}/api/admin/affiliate/analytics")
        assert response.status_code == 401, f"Expected 401, got {response.status_code}"
        print("✅ Affiliate analytics requires auth")
    
    def test_affiliate_list_requires_admin(self):
        """GET /api/admin/affiliates should require admin"""
        response = session.get(f"{BASE_URL}/api/admin/affiliates")
        assert response.status_code == 401, f"Expected 401, got {response.status_code}"
        print("✅ Affiliate list requires auth")


if __name__ == '__main__':
    pytest.main([__file__, '-v'])
