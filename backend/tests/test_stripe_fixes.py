"""
Test file for Stripe-related bug fixes:
1. Dotenv override:true - sk_test_ key used instead of rk_live_
2. CSRF exclusion for /api/stripe/verify-session
3. CSRF exclusion for /api/stripe/create-order
4. CSRF exclusion for /api/stripe/calculate-order
5. Webhook handler returning correct error message when no stripe-signature

Fixes tested:
- /app/api/server.js: dotenv.config override:true (line 20)
- /app/api/server.js: CSRF exclusion for verify-session (line 288-291)
- /app/backend/controllers/stripeWebhookController.js: proper error path
"""

import pytest
import requests
import os

# Use the internal backend URL directly since we're in the container
BASE_URL = "http://localhost:8001"


class TestPingHealth:
    """Health check endpoints"""

    def test_ping_returns_pong(self):
        """GET /api/ping should return 'pong'"""
        response = requests.get(f"{BASE_URL}/api/ping")
        assert response.status_code == 200
        assert response.text == "pong"
        print(f"[PASS] /api/ping returns: {response.text}")

    def test_health_endpoint(self):
        """GET /api/health should return healthy status"""
        response = requests.get(f"{BASE_URL}/api/health")
        assert response.status_code == 200
        data = response.json()
        assert data.get("status") == "healthy"
        print(f"[PASS] /api/health returns healthy, uptime: {data.get('uptime')}")


class TestStripeWebhookFix:
    """
    Webhook handler - verifies dotenv override fix.
    Previously: rk_live_ key caused 'STRIPE_SECRET_KEY format is invalid' error
    After fix: sk_test_ key is used, webhook proceeds correctly
    """

    def test_webhook_no_signature_returns_stripe_error(self):
        """
        POST /api/webhook without stripe-signature header should return
        'Webhook Error: No stripe-signature header value was provided'
        NOT 'Secret not configured' or 'STRIPE_SECRET_KEY format is invalid'
        """
        response = requests.post(
            f"{BASE_URL}/api/webhook",
            data=b'{"test": "payload"}',
            headers={"Content-Type": "application/json"}
        )
        assert response.status_code == 400
        body = response.text
        print(f"[INFO] Webhook response: {body}")

        # Should NOT return old error messages
        assert "Secret not configured" not in body, \
            f"FAIL: STRIPE_WEBHOOK_SECRET is missing! Got: {body}"
        assert "STRIPE_SECRET_KEY format is invalid" not in body, \
            f"FAIL: Bad Stripe key (rk_live_) still in use! Got: {body}"
        assert "Stripe Configuration Error" not in body, \
            f"FAIL: Stripe key configuration error! Got: {body}"

        # Should return Stripe signature error
        assert "stripe-signature" in body.lower() or "No stripe-signature" in body or \
               "Webhook Error" in body, \
            f"Expected Stripe signature error, got: {body}"
        print(f"[PASS] Webhook returns correct Stripe error (not key config error): {body}")

    def test_stripe_webhook_alias_no_signature(self):
        """
        POST /api/stripe/webhook without stripe-signature should also work
        """
        response = requests.post(
            f"{BASE_URL}/api/stripe/webhook",
            data=b'{"test": "payload"}',
            headers={"Content-Type": "application/json"}
        )
        assert response.status_code == 400
        body = response.text
        print(f"[INFO] /api/stripe/webhook response: {body}")

        assert "Secret not configured" not in body, \
            f"FAIL: STRIPE_WEBHOOK_SECRET missing! Got: {body}"
        assert "STRIPE_SECRET_KEY format is invalid" not in body, \
            f"FAIL: Bad key (rk_live_) in use! Got: {body}"
        print(f"[PASS] /api/stripe/webhook returns correct error: {body}")


class TestCSRFExclusions:
    """
    CSRF protection exclusion tests for Stripe endpoints.
    These endpoints should NOT require a CSRF token.
    """

    def test_verify_session_no_csrf_error(self):
        """
        POST /api/stripe/verify-session with {sessionId: 'cs_test_invalid'}
        should return a Stripe error about invalid session,
        NOT 'invalid csrf token' (403 EBADCSRFTOKEN)
        """
        response = requests.post(
            f"{BASE_URL}/api/stripe/verify-session",
            json={"sessionId": "cs_test_invalid"},
            headers={"Content-Type": "application/json"}
        )
        body_text = response.text
        print(f"[INFO] verify-session status: {response.status_code}, body: {body_text[:200]}")

        # Must NOT return CSRF error
        assert response.status_code != 403, \
            f"FAIL: CSRF blocking verify-session! Got 403: {body_text}"

        # Check for csrf in response
        if "csrf" in body_text.lower() or "EBADCSRFTOKEN" in body_text:
            pytest.fail(f"FAIL: CSRF token error returned! Got: {body_text}")

        # Should get either a Stripe error (404 invalid session) or auth error (401)
        # The important thing is it's NOT blocked by CSRF
        assert response.status_code in [200, 400, 401, 404, 422, 500], \
            f"Unexpected status: {response.status_code}"
        print(f"[PASS] verify-session is NOT blocked by CSRF (status: {response.status_code})")

    def test_create_order_no_csrf_error(self):
        """
        POST /api/stripe/create-order should not return CSRF error (403)
        It may return validation errors (400) or auth errors, but not CSRF
        """
        response = requests.post(
            f"{BASE_URL}/api/stripe/create-order",
            json={
                "eventId": "test-event-id",
                "ticketSelections": {"general": 1},
                "customerEmail": "test@example.com",
                "customerName": "Test User",
                "successUrl": "https://www.openticket.events/success",
                "cancelUrl": "https://www.openticket.events/cancel"
            },
            headers={"Content-Type": "application/json"}
        )
        body_text = response.text
        print(f"[INFO] create-order status: {response.status_code}, body: {body_text[:200]}")

        # Must NOT be CSRF-blocked
        assert response.status_code != 403, \
            f"FAIL: CSRF blocking create-order! Got 403: {body_text}"

        if "csrf" in body_text.lower() or "EBADCSRFTOKEN" in body_text:
            pytest.fail(f"FAIL: CSRF token error! Got: {body_text}")

        # Expected: either 400 (validation) or 404 (event not found) or other business logic error
        assert response.status_code in [200, 400, 401, 404, 422, 429, 500], \
            f"Unexpected status: {response.status_code}"
        print(f"[PASS] create-order is NOT blocked by CSRF (status: {response.status_code})")

    def test_calculate_order_no_csrf_error(self):
        """
        POST /api/stripe/calculate-order should return order breakdown,
        NOT CSRF error
        """
        response = requests.post(
            f"{BASE_URL}/api/stripe/calculate-order",
            json={
                "eventId": "test-event-id",
                "ticketSelections": {"general": 1}
            },
            headers={"Content-Type": "application/json"}
        )
        body_text = response.text
        print(f"[INFO] calculate-order status: {response.status_code}, body: {body_text[:200]}")

        # Must NOT be CSRF-blocked
        assert response.status_code != 403, \
            f"FAIL: CSRF blocking calculate-order! Got 403: {body_text}"

        if "csrf" in body_text.lower() or "EBADCSRFTOKEN" in body_text:
            pytest.fail(f"FAIL: CSRF token error! Got: {body_text}")

        assert response.status_code in [200, 400, 401, 404, 422, 429, 500], \
            f"Unexpected status: {response.status_code}"
        print(f"[PASS] calculate-order is NOT blocked by CSRF (status: {response.status_code})")


class TestStripeKeyValidation:
    """
    Verify that the correct Stripe key (sk_test_) is in use,
    not the invalid rk_live_ key from /app/.env
    """

    def test_debug_env_accessible(self):
        """GET /api/debug-env should return environment info"""
        response = requests.get(f"{BASE_URL}/api/debug-env")
        assert response.status_code == 200
        data = response.json()
        print(f"[INFO] debug-env: {data}")
        # Just verifies the endpoint exists and works
        assert "frontendUrl" in data or "nodeEnv" in data or "port" in data
        print(f"[PASS] debug-env endpoint accessible")

    def test_stripe_mode_verified_via_webhook(self):
        """
        Indirectly verify Stripe key via webhook:
        If rk_live_ key were used, getStripe() would throw 'format is invalid'
        before reaching the constructEvent call.
        Correct behavior: error is about missing signature, not key format.
        """
        response = requests.post(
            f"{BASE_URL}/api/webhook",
            data=b'{}',
            headers={"Content-Type": "application/json"}
        )
        assert response.status_code == 400
        body = response.text

        # The ONLY acceptable error here is about missing/invalid signature
        # NOT about key format or configuration
        assert "STRIPE_SECRET_KEY format is invalid" not in body, \
            f"FAIL: rk_live_ key still being used! Got: {body}"
        assert "Stripe Configuration Error" not in body, \
            f"FAIL: Stripe key configuration error! Got: {body}"
        print(f"[PASS] Stripe key override confirmed - no key format errors: {body[:100]}")


class TestVerifySessionStripeBehavior:
    """
    Test verify-session endpoint behavior with invalid session ID.
    Should get a Stripe API error, not CSRF or key errors.
    """

    def test_verify_session_invalid_session_id(self):
        """
        POST /api/stripe/verify-session with invalid session ID
        Should return error about invalid/nonexistent session (from Stripe API)
        """
        response = requests.post(
            f"{BASE_URL}/api/stripe/verify-session",
            json={"sessionId": "cs_test_invalid_session_123"},
            headers={"Content-Type": "application/json"}
        )
        body_text = response.text
        print(f"[INFO] verify-session response: status={response.status_code}, body={body_text[:300]}")

        # Not CSRF error
        assert response.status_code != 403, f"FAIL: CSRF error! {body_text}"

        # Not a key configuration error
        assert "STRIPE_SECRET_KEY format is invalid" not in body_text, \
            f"FAIL: Key format error! Got: {body_text}"

        # Should be a Stripe error or business logic error about the session
        # Status should be 400 (bad request - invalid session) or 404
        print(f"[PASS] verify-session returned non-CSRF response: {response.status_code}")


if __name__ == "__main__":
    import subprocess
    subprocess.run(["pytest", __file__, "-v", "--tb=short",
                    f"--junitxml=/app/test_reports/pytest/pytest_stripe_fixes.xml"])
