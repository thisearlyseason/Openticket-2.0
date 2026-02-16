"""
Comprehensive CSRF Protection Tests
Tests that CSRF protection doesn't break existing functionality
"""
import pytest
import requests
import os

# Use localhost for testing since CSRF is local-only (not deployed to prod yet)
BASE_URL = "http://localhost:8001"


class TestCSRFTokenEndpoint:
    """Test CSRF token fetching and cookie handling"""
    
    def test_csrf_token_endpoint_returns_token(self):
        """Test that /api/csrf-token returns a valid token"""
        session = requests.Session()
        response = session.get(f"{BASE_URL}/api/csrf-token")
        
        assert response.status_code == 200, f"Expected 200, got {response.status_code}"
        data = response.json()
        assert "csrfToken" in data, "Response should contain csrfToken"
        assert len(data["csrfToken"]) > 10, "Token should be non-trivial"
        print(f"✅ CSRF token obtained: {data['csrfToken'][:20]}...")
    
    def test_csrf_cookie_is_set(self):
        """Test that CSRF cookie is set on token fetch"""
        session = requests.Session()
        response = session.get(f"{BASE_URL}/api/csrf-token")
        
        assert response.status_code == 200
        # Check for _csrf cookie (csurf library uses this)
        cookies = session.cookies.get_dict()
        assert "_csrf" in cookies, f"Expected _csrf cookie, got: {list(cookies.keys())}"
        print(f"✅ CSRF cookie set: {cookies['_csrf'][:20]}...")


class TestCSRFProtectedEndpoints:
    """Test that POST/PUT/DELETE without CSRF token are blocked"""
    
    @pytest.fixture
    def csrf_session(self):
        """Get a session with CSRF token and cookie"""
        session = requests.Session()
        response = session.get(f"{BASE_URL}/api/csrf-token")
        assert response.status_code == 200
        token = response.json()["csrfToken"]
        return session, token
    
    def test_post_without_csrf_is_blocked(self, csrf_session):
        """POST without CSRF token should return 403"""
        session, _ = csrf_session
        
        response = session.post(
            f"{BASE_URL}/api/events",
            json={"title": "Test Event"},
            headers={"Content-Type": "application/json"}
        )
        
        assert response.status_code == 403, f"Expected 403, got {response.status_code}"
        data = response.json()
        assert data.get("code") == "EBADCSRFTOKEN", f"Expected EBADCSRFTOKEN, got {data}"
        print("✅ POST without CSRF correctly blocked")
    
    def test_put_without_csrf_is_blocked(self, csrf_session):
        """PUT without CSRF token should return 403"""
        session, _ = csrf_session
        
        response = session.put(
            f"{BASE_URL}/api/events/test123",
            json={"title": "Updated Event"},
            headers={"Content-Type": "application/json"}
        )
        
        assert response.status_code == 403, f"Expected 403, got {response.status_code}"
        data = response.json()
        assert data.get("code") == "EBADCSRFTOKEN"
        print("✅ PUT without CSRF correctly blocked")
    
    def test_delete_without_csrf_is_blocked(self, csrf_session):
        """DELETE without CSRF token should return 403"""
        session, _ = csrf_session
        
        response = session.delete(f"{BASE_URL}/api/events/test123")
        
        assert response.status_code == 403, f"Expected 403, got {response.status_code}"
        data = response.json()
        assert data.get("code") == "EBADCSRFTOKEN"
        print("✅ DELETE without CSRF correctly blocked")


class TestCSRFWithValidToken:
    """Test that requests with valid CSRF token pass CSRF check"""
    
    @pytest.fixture
    def csrf_session(self):
        """Get a session with CSRF token and cookie"""
        session = requests.Session()
        response = session.get(f"{BASE_URL}/api/csrf-token")
        assert response.status_code == 200
        token = response.json()["csrfToken"]
        return session, token
    
    def test_post_with_csrf_passes_csrf_check(self, csrf_session):
        """POST with CSRF token should pass CSRF check (may fail auth)"""
        session, token = csrf_session
        
        response = session.post(
            f"{BASE_URL}/api/events",
            json={"title": "Test Event"},
            headers={
                "Content-Type": "application/json",
                "X-CSRF-Token": token
            }
        )
        
        # Should NOT be 403 with EBADCSRFTOKEN - auth error or other is OK
        if response.status_code == 403:
            data = response.json()
            assert data.get("code") != "EBADCSRFTOKEN", "Should not fail CSRF check"
        
        # Auth failure (401) or other error is acceptable
        assert response.status_code in [200, 201, 400, 401, 403, 404], f"Unexpected status: {response.status_code}"
        print(f"✅ POST with CSRF passes CSRF check (status: {response.status_code})")
    
    def test_put_with_csrf_passes_csrf_check(self, csrf_session):
        """PUT with CSRF token should pass CSRF check"""
        session, token = csrf_session
        
        response = session.put(
            f"{BASE_URL}/api/events/test123",
            json={"title": "Updated Event"},
            headers={
                "Content-Type": "application/json",
                "X-CSRF-Token": token
            }
        )
        
        if response.status_code == 403:
            data = response.json()
            assert data.get("code") != "EBADCSRFTOKEN"
        
        print(f"✅ PUT with CSRF passes CSRF check (status: {response.status_code})")
    
    def test_delete_with_csrf_passes_csrf_check(self, csrf_session):
        """DELETE with CSRF token should pass CSRF check"""
        session, token = csrf_session
        
        response = session.delete(
            f"{BASE_URL}/api/events/test123",
            headers={"X-CSRF-Token": token}
        )
        
        if response.status_code == 403:
            data = response.json()
            assert data.get("code") != "EBADCSRFTOKEN"
        
        print(f"✅ DELETE with CSRF passes CSRF check (status: {response.status_code})")


class TestSafeMethodsWithoutCSRF:
    """Test that GET/HEAD/OPTIONS work without CSRF tokens"""
    
    def test_get_public_events_works(self):
        """GET requests should work without CSRF"""
        response = requests.get(f"{BASE_URL}/api/events/public")
        assert response.status_code == 200, f"Expected 200, got {response.status_code}"
        print("✅ GET /api/events/public works without CSRF")
    
    def test_get_health_works(self):
        """Health endpoint should work without CSRF"""
        response = requests.get(f"{BASE_URL}/api/health")
        assert response.status_code == 200
        data = response.json()
        assert data.get("status") == "healthy"
        print("✅ GET /api/health works without CSRF")
    
    def test_get_exchange_rates_works(self):
        """Exchange rates should work without CSRF"""
        response = requests.get(f"{BASE_URL}/api/stripe/exchange-rates")
        assert response.status_code == 200
        print("✅ GET /api/stripe/exchange-rates works without CSRF")


class TestPublicPostEndpoints:
    """Test public POST endpoints that still need CSRF"""
    
    @pytest.fixture
    def csrf_session(self):
        """Get a session with CSRF token and cookie"""
        session = requests.Session()
        response = session.get(f"{BASE_URL}/api/csrf-token")
        assert response.status_code == 200
        token = response.json()["csrfToken"]
        return session, token
    
    def test_convert_price_without_csrf_blocked(self, csrf_session):
        """POST /api/stripe/convert-price without CSRF should be blocked"""
        session, _ = csrf_session
        
        response = session.post(
            f"{BASE_URL}/api/stripe/convert-price",
            json={"amount": 100, "fromCurrency": "USD", "toCurrency": "EUR"},
            headers={"Content-Type": "application/json"}
        )
        
        assert response.status_code == 403, f"Expected 403, got {response.status_code}"
        print("✅ convert-price without CSRF correctly blocked")
    
    def test_convert_price_with_csrf_works(self, csrf_session):
        """POST /api/stripe/convert-price with CSRF should work"""
        session, token = csrf_session
        
        response = session.post(
            f"{BASE_URL}/api/stripe/convert-price",
            json={"amount": 100, "fromCurrency": "USD", "toCurrency": "EUR"},
            headers={
                "Content-Type": "application/json",
                "X-CSRF-Token": token
            }
        )
        
        assert response.status_code == 200, f"Expected 200, got {response.status_code}"
        data = response.json()
        assert "convertedAmount" in data or "converted" in str(data).lower()
        print(f"✅ convert-price with CSRF works: {data}")
    
    def test_presale_validate_with_csrf(self, csrf_session):
        """POST /api/presale/:eventId/validate with CSRF should pass CSRF check"""
        session, token = csrf_session
        
        response = session.post(
            f"{BASE_URL}/api/presale/nonexistent-event/validate",
            json={"code": "TEST123"},
            headers={
                "Content-Type": "application/json",
                "X-CSRF-Token": token
            }
        )
        
        # Should NOT be 403 CSRF error - 404 (event not found) is expected
        if response.status_code == 403:
            data = response.json()
            assert data.get("code") != "EBADCSRFTOKEN"
        
        assert response.status_code in [200, 400, 404], f"Unexpected: {response.status_code}"
        print(f"✅ presale/validate with CSRF passes (status: {response.status_code})")
    
    def test_presale_subscribe_with_csrf(self, csrf_session):
        """POST /api/presale/:eventId/subscribe with CSRF should pass CSRF check"""
        session, token = csrf_session
        
        response = session.post(
            f"{BASE_URL}/api/presale/nonexistent-event/subscribe",
            json={"email": "test@example.com"},
            headers={
                "Content-Type": "application/json",
                "X-CSRF-Token": token
            }
        )
        
        if response.status_code == 403:
            data = response.json()
            assert data.get("code") != "EBADCSRFTOKEN"
        
        assert response.status_code in [200, 400, 404], f"Unexpected: {response.status_code}"
        print(f"✅ presale/subscribe with CSRF passes (status: {response.status_code})")


class TestAuthEndpointsWithCSRF:
    """Test authentication endpoints with CSRF"""
    
    @pytest.fixture
    def csrf_session(self):
        """Get a session with CSRF token and cookie"""
        session = requests.Session()
        response = session.get(f"{BASE_URL}/api/csrf-token")
        assert response.status_code == 200
        token = response.json()["csrfToken"]
        return session, token
    
    def test_auth_login_without_csrf_blocked(self, csrf_session):
        """Login without CSRF should be blocked"""
        session, _ = csrf_session
        
        response = session.post(
            f"{BASE_URL}/api/auth/login",
            json={"email": "test@example.com", "password": "test123"},
            headers={"Content-Type": "application/json"}
        )
        
        assert response.status_code == 403, f"Expected 403, got {response.status_code}"
        print("✅ auth/login without CSRF correctly blocked")
    
    def test_auth_login_with_csrf_passes_csrf_check(self, csrf_session):
        """Login with CSRF should pass CSRF check (may fail auth)"""
        session, token = csrf_session
        
        response = session.post(
            f"{BASE_URL}/api/auth/login",
            json={"email": "invalid@example.com", "password": "wrongpassword"},
            headers={
                "Content-Type": "application/json",
                "X-CSRF-Token": token
            }
        )
        
        # Should NOT be CSRF error
        if response.status_code == 403:
            data = response.json()
            assert data.get("code") != "EBADCSRFTOKEN"
        
        # Auth failure or success is OK
        assert response.status_code in [200, 400, 401, 403]
        print(f"✅ auth/login with CSRF passes CSRF check (status: {response.status_code})")
    
    def test_auth_signup_with_csrf_passes_csrf_check(self, csrf_session):
        """Signup with CSRF should pass CSRF check"""
        session, token = csrf_session
        
        response = session.post(
            f"{BASE_URL}/api/auth/signup",
            json={
                "email": f"csrftest{os.urandom(4).hex()}@example.com",
                "password": "testpass123",
                "name": "CSRF Test User"
            },
            headers={
                "Content-Type": "application/json",
                "X-CSRF-Token": token
            }
        )
        
        if response.status_code == 403:
            data = response.json()
            assert data.get("code") != "EBADCSRFTOKEN"
        
        # Success or validation error
        assert response.status_code in [200, 201, 400, 409]
        print(f"✅ auth/signup with CSRF passes CSRF check (status: {response.status_code})")


class TestStripeEndpointsWithCSRF:
    """Test Stripe payment endpoints with CSRF"""
    
    @pytest.fixture
    def csrf_session(self):
        """Get a session with CSRF token and cookie"""
        session = requests.Session()
        response = session.get(f"{BASE_URL}/api/csrf-token")
        assert response.status_code == 200
        token = response.json()["csrfToken"]
        return session, token
    
    def test_calculate_order_without_csrf_blocked(self, csrf_session):
        """Calculate order without CSRF should be blocked"""
        session, _ = csrf_session
        
        response = session.post(
            f"{BASE_URL}/api/stripe/calculate-order",
            json={"eventId": "test123", "selections": []},
            headers={"Content-Type": "application/json"}
        )
        
        assert response.status_code == 403
        print("✅ calculate-order without CSRF correctly blocked")
    
    def test_calculate_order_with_csrf_passes(self, csrf_session):
        """Calculate order with CSRF should pass CSRF check"""
        session, token = csrf_session
        
        response = session.post(
            f"{BASE_URL}/api/stripe/calculate-order",
            json={"eventId": "test123", "selections": []},
            headers={
                "Content-Type": "application/json",
                "X-CSRF-Token": token
            }
        )
        
        if response.status_code == 403:
            data = response.json()
            assert data.get("code") != "EBADCSRFTOKEN"
        
        # 404 (event not found) or other error is OK
        assert response.status_code in [200, 400, 404]
        print(f"✅ calculate-order with CSRF passes (status: {response.status_code})")
    
    def test_create_order_with_csrf_passes(self, csrf_session):
        """Create order with CSRF should pass CSRF check"""
        session, token = csrf_session
        
        response = session.post(
            f"{BASE_URL}/api/stripe/create-order",
            json={"eventId": "test123", "selections": []},
            headers={
                "Content-Type": "application/json",
                "X-CSRF-Token": token
            }
        )
        
        if response.status_code == 403:
            data = response.json()
            assert data.get("code") != "EBADCSRFTOKEN"
        
        assert response.status_code in [200, 400, 404]
        print(f"✅ create-order with CSRF passes (status: {response.status_code})")


class TestCORSHeadersIncludeCSRF:
    """Test that CORS headers allow X-CSRF-Token"""
    
    def test_cors_allows_csrf_header(self):
        """OPTIONS request should show X-CSRF-Token in allowed headers"""
        response = requests.options(
            f"{BASE_URL}/api/events",
            headers={
                "Origin": "https://www.openticket.events",
                "Access-Control-Request-Method": "POST",
                "Access-Control-Request-Headers": "Content-Type, X-CSRF-Token"
            }
        )
        
        allowed_headers = response.headers.get("Access-Control-Allow-Headers", "")
        assert "X-CSRF-Token" in allowed_headers or "x-csrf-token" in allowed_headers.lower(), \
            f"X-CSRF-Token not in allowed headers: {allowed_headers}"
        print(f"✅ CORS allows X-CSRF-Token header: {allowed_headers}")


if __name__ == "__main__":
    pytest.main([__file__, "-v", "--tb=short"])
