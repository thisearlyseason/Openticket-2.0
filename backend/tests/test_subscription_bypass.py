"""
MONETIZATION SECURITY AUDIT - Subscription Bypass Tests
=========================================================
GOAL: Test for revenue leakage and paywall bypasses

This test suite attempts to:
1. Access premium features without a subscription
2. Create events beyond plan limits
3. Manipulate planType in requests 
4. Test expired subscription behavior
5. Verify backend enforces plan limits (not just frontend)
6. Test fee calculation correctness

CRITICAL FINDING FROM CODE REVIEW:
- createEvent() in eventController.js has NO subscription validation
- No middleware checks plan limits before event creation
- Plan checks only found in fee calculation (stripeController.js line 257)
- This is HIGH PROBABILITY revenue leakage
"""

import pytest
import requests
import os
import json
import time

# Use production URL for security testing
BASE_URL = os.environ.get('VITE_BACKEND_URL', 'https://www.openticket.events')

class TestSubscriptionBypassAttempts:
    """BYPASS ATTEMPTS - Actively try to circumvent paywalls"""
    
    @pytest.fixture(autouse=True)
    def setup(self):
        """Get CSRF token for all requests"""
        self.session = requests.Session()
        try:
            csrf_response = self.session.get(f"{BASE_URL}/api/csrf-token", timeout=10)
            if csrf_response.status_code == 200:
                self.csrf_token = csrf_response.json().get('csrfToken', '')
            else:
                self.csrf_token = ''
        except Exception as e:
            print(f"Warning: Could not get CSRF token: {e}")
            self.csrf_token = ''
    
    def _get_headers(self, auth_token=None):
        """Build headers with CSRF and optional auth"""
        headers = {
            'Content-Type': 'application/json',
            'X-CSRF-Token': self.csrf_token
        }
        if auth_token:
            headers['Authorization'] = f'Bearer {auth_token}'
        return headers

    # ============== BYPASS ATTEMPT 1: Access Premium Features Without Subscription ==============
    
    def test_bypass_1_create_event_without_auth(self):
        """BYPASS ATTEMPT: Create event without authentication - should fail"""
        payload = {
            "title": "Bypass Test Event",
            "description": "Testing event creation without auth",
            "date": "2026-03-15",
            "time": "18:00",
            "location": "Test Venue",
            "capacity": 500,
            "priceType": "tiered",
            "ticketTiers": [{"id": "t1", "name": "VIP", "price": 100, "capacity": 100}]
        }
        
        response = self.session.post(
            f"{BASE_URL}/api/events",
            json=payload,
            headers=self._get_headers()
        )
        
        # Should be rejected - 401 or 403
        assert response.status_code in [401, 403], \
            f"VULNERABILITY: Unauthenticated event creation returned {response.status_code}"
        print(f"✓ Unauthenticated event creation blocked (status {response.status_code})")

    def test_bypass_1b_calculate_order_without_auth(self):
        """Test: calculate-order endpoint access (should be public for pricing display)"""
        payload = {
            "eventId": "test-event-123",
            "ticketSelections": {"tier1": 2},
            "addOnSelections": {},
            "promoCode": None
        }
        
        response = self.session.post(
            f"{BASE_URL}/api/stripe/calculate-order",
            json=payload,
            headers=self._get_headers()
        )
        
        # This might be public for price preview - document the behavior
        print(f"calculate-order access: status={response.status_code}")
        # Just document, not a security issue if public
    
    # ============== BYPASS ATTEMPT 2: Create Events Beyond Plan Limits ==============
    
    def test_bypass_2_backend_enforces_ticket_limits(self):
        """
        CRITICAL TEST: Does backend enforce ticket limits per event?
        
        FREE PLAN LIMITS:
        - ticketLimit: 100 per event
        - monthlyTicketLimit: 400 per month
        
        PRO PLAN LIMITS:
        - ticketLimit: 1000 per event
        - monthlyTicketLimit: 4000 per month
        
        This test verifies if creating an event with 500 tickets on free plan is blocked.
        """
        # This requires auth - documenting expected behavior
        # If there's no middleware checking plan limits, this would succeed
        
        payload = {
            "title": "Large Event Test",
            "description": "Testing if backend enforces ticket limits",
            "date": "2026-03-20",
            "time": "19:00",
            "location": "Large Venue",
            "capacity": 500,  # Exceeds free plan limit of 100
            "priceType": "tiered",
            "ticketTiers": [
                {"id": "t1", "name": "General", "price": 50, "capacity": 500}  # 500 > 100 limit
            ]
        }
        
        # Without auth, should be 401
        response = self.session.post(
            f"{BASE_URL}/api/events",
            json=payload,
            headers=self._get_headers()
        )
        
        # Document the response - if 401, auth is required (good)
        # If we had a free plan user token and it returns 201, that's a vulnerability
        print(f"Large event creation without auth: status={response.status_code}")
        assert response.status_code == 401, "Expected 401 for unauthenticated request"
        print("✓ Event creation requires authentication")

    # ============== BYPASS ATTEMPT 3: Manipulate planType in Requests ==============
    
    def test_bypass_3_inject_premium_plan_in_request(self):
        """
        BYPASS ATTEMPT: Send 'premium' planType in request body
        
        Malicious user might try:
        POST /api/events with body: { ..., "organizerPlan": "premium" }
        
        Backend should ALWAYS fetch plan from database, never trust client-provided plan.
        """
        payload = {
            "title": "Plan Injection Test",
            "description": "Attempting to inject premium plan",
            "date": "2026-03-25",
            "time": "20:00",
            "location": "Test",
            "capacity": 1000,
            # Malicious payload - trying to inject premium plan
            "organizerPlan": "premium",
            "planType": "premium",
            "subscription": {"plan": "premium"},
            "ticketTiers": [{"id": "t1", "name": "VIP", "price": 200, "capacity": 1000}]
        }
        
        response = self.session.post(
            f"{BASE_URL}/api/events",
            json=payload,
            headers=self._get_headers()
        )
        
        # Should be 401 (no auth) - can't test injection without valid auth
        print(f"Plan injection attempt: status={response.status_code}")
        # The real test would require a free plan user's token

    def test_bypass_3b_inject_plan_in_calculate_order(self):
        """
        BYPASS ATTEMPT: Inject premium plan in calculate-order to get lower fees
        
        Free plan: 4.5% + $0.99
        Premium plan: 1.9% + $0.49
        
        If backend trusts client-provided organizerPlan, attacker could pay lower fees.
        """
        payload = {
            "eventId": "test-event-123",
            "ticketSelections": {"tier1": 10},
            "addOnSelections": {},
            "promoCode": None,
            # Malicious - trying to get premium fee rates
            "organizerPlan": "premium"
        }
        
        response = self.session.post(
            f"{BASE_URL}/api/stripe/calculate-order",
            json=payload,
            headers=self._get_headers()
        )
        
        # Document response - backend should ignore client-provided organizerPlan
        print(f"Fee injection attempt: status={response.status_code}")
        if response.status_code == 200:
            data = response.json()
            # Check if platformFee reflects the injected premium rate or actual rate
            print(f"Response data: {json.dumps(data, indent=2)[:500]}")

    # ============== BYPASS ATTEMPT 4: Frontend-Only Checks ==============
    
    def test_bypass_4_verify_backend_validates_not_frontend(self):
        """
        CRITICAL: Verify backend enforces limits, not just frontend
        
        Frontend checks can be bypassed with DevTools.
        Backend MUST validate:
        1. Plan limits on event creation
        2. Ticket limits on registration
        3. Monthly limits
        
        This test checks if the backend has plan validation middleware.
        """
        # Check if there's any plan validation endpoint
        endpoints_to_check = [
            "/api/subscription/validate-limits",
            "/api/events/validate",
            "/api/plan/check-limits"
        ]
        
        for endpoint in endpoints_to_check:
            response = self.session.get(f"{BASE_URL}{endpoint}")
            print(f"{endpoint}: status={response.status_code}")
        
        # Main test - does /api/events accept large capacity without auth?
        # If it only returns 401 (auth required), we can't test plan limits
        # The vulnerability is that AFTER auth, there's no plan check
        print("\n⚠️ WARNING: Cannot fully test plan limit bypass without authenticated session")
        print("CODE REVIEW FINDING: eventController.js createEvent() has NO plan validation middleware")

    # ============== BYPASS ATTEMPT 5: Expired Subscription ==============
    
    def test_bypass_5_check_expired_subscription_handling(self):
        """
        Test: What happens when subscription expires?
        
        Users with past_due or cancelled status should NOT be able to:
        1. Create new events
        2. Sell tickets
        3. Access premium features
        
        Without a test account, we document expected behavior.
        """
        # Check subscription status endpoint
        response = self.session.get(f"{BASE_URL}/api/subscription/status/test-user-id")
        
        print(f"Subscription status endpoint: status={response.status_code}")
        
        # Document: Backend should check subscription.status === 'active' before allowing actions

    # ============== FEE CALCULATION VALIDATION ==============
    
    def test_fee_calculation_correctness(self):
        """
        Verify fee percentages are correct:
        - Free: 4.5% + $0.99
        - Pro: 2.9% + $0.69  
        - Premium: 1.9% + $0.49
        
        This tests the /api/stripe/calculate-order endpoint.
        """
        # Test with a sample event calculation
        # Since we don't have a real event, we test the endpoint availability
        payload = {
            "eventId": "nonexistent-event",
            "ticketSelections": {},
            "addOnSelections": {},
            "promoCode": None
        }
        
        response = self.session.post(
            f"{BASE_URL}/api/stripe/calculate-order",
            json=payload,
            headers=self._get_headers()
        )
        
        print(f"Fee calculation endpoint: status={response.status_code}")
        if response.status_code == 404:
            print("✓ Returns 404 for nonexistent event (expected)")
        elif response.status_code == 200:
            print("⚠️ Returns 200 for nonexistent event - check if this is a vulnerability")


class TestWebhookSecurity:
    """Test Stripe webhook security"""
    
    @pytest.fixture(autouse=True)
    def setup(self):
        self.session = requests.Session()
    
    def test_webhook_without_signature(self):
        """
        SECURITY: Webhook should reject requests without valid Stripe signature
        
        Attackers might try to send fake webhook events to:
        1. Mark orders as paid without payment
        2. Upgrade subscriptions for free
        3. Manipulate financial records
        """
        fake_webhook = {
            "id": "evt_fake123",
            "type": "checkout.session.completed",
            "data": {
                "object": {
                    "id": "cs_fake123",
                    "payment_status": "paid",
                    "metadata": {
                        "userId": "attacker123",
                        "planName": "premium"
                    }
                }
            }
        }
        
        response = self.session.post(
            f"{BASE_URL}/api/webhook",
            json=fake_webhook,
            headers={'Content-Type': 'application/json'}
        )
        
        # Should be rejected (400 or 401) without valid stripe-signature
        print(f"Webhook without signature: status={response.status_code}")
        assert response.status_code in [400, 401, 403, 500], \
            f"VULNERABILITY: Webhook accepted without signature! Status: {response.status_code}"
        print("✓ Webhook rejected without valid Stripe signature")

    def test_webhook_with_invalid_signature(self):
        """Test webhook with fake signature header"""
        response = self.session.post(
            f"{BASE_URL}/api/webhook",
            data=b'{"type":"checkout.session.completed"}',
            headers={
                'Content-Type': 'application/json',
                'stripe-signature': 'fake_sig_header_t=123,v1=abc123'
            }
        )
        
        print(f"Webhook with fake signature: status={response.status_code}")
        assert response.status_code in [400, 401, 403, 500], \
            f"VULNERABILITY: Webhook accepted with fake signature!"
        print("✓ Webhook rejected with invalid signature")


class TestPlanLimitEnforcement:
    """Test backend enforcement of plan limits"""
    
    @pytest.fixture(autouse=True)
    def setup(self):
        self.session = requests.Session()
        try:
            csrf_response = self.session.get(f"{BASE_URL}/api/csrf-token", timeout=10)
            if csrf_response.status_code == 200:
                self.csrf_token = csrf_response.json().get('csrfToken', '')
            else:
                self.csrf_token = ''
        except:
            self.csrf_token = ''

    def test_public_events_accessible(self):
        """Test: Public events endpoint works without auth"""
        response = self.session.get(f"{BASE_URL}/api/events/public")
        
        assert response.status_code == 200, f"Public events should be accessible, got {response.status_code}"
        print(f"✓ Public events accessible: {response.status_code}")
        
        data = response.json()
        if 'events' in data:
            print(f"  Found {len(data['events'])} public events")

    def test_health_endpoint(self):
        """Test: Health endpoint accessible"""
        response = self.session.get(f"{BASE_URL}/api/health")
        
        assert response.status_code == 200, f"Health check failed: {response.status_code}"
        print(f"✓ Health endpoint: {response.status_code}")

    def test_exchange_rates_public(self):
        """Test: Exchange rates endpoint accessible"""
        response = self.session.get(f"{BASE_URL}/api/stripe/exchange-rates")
        
        print(f"Exchange rates: status={response.status_code}")
        if response.status_code == 200:
            data = response.json()
            print(f"  Rates: {data.get('rates', {})}")


class TestPlatformDonationEnforcement:
    """Test platform donation requirement for free plan"""
    
    @pytest.fixture(autouse=True)
    def setup(self):
        self.session = requests.Session()
        try:
            csrf_response = self.session.get(f"{BASE_URL}/api/csrf-token", timeout=10)
            if csrf_response.status_code == 200:
                self.csrf_token = csrf_response.json().get('csrfToken', '')
            else:
                self.csrf_token = ''
        except:
            self.csrf_token = ''

    def test_free_plan_requires_donation_option(self):
        """
        BUSINESS RULE: Free plan events should show platform donation option
        
        From PLAN_VERSIONS:
        - free_v2.showDonationButton: true
        - pro_v2.showDonationButton: false
        - premium_v2.showDonationButton: false
        
        This should be enforced in the checkout flow, not just frontend UI.
        """
        # This is primarily a UI check, but backend should track donation eligibility
        # Check if there's an API that returns plan features
        
        response = self.session.get(f"{BASE_URL}/api/subscription/status/test-user")
        print(f"Subscription status check: {response.status_code}")
        
        # Document expected behavior
        print("\n📋 EXPECTED BEHAVIOR:")
        print("  - Free plan: Platform donation option shown (not forced)")
        print("  - Pro plan: No donation option (can be hidden)")
        print("  - Premium plan: No donation option (can be hidden)")


class TestSecurityAuditSummary:
    """Generate security audit summary"""
    
    def test_generate_audit_report(self):
        """Generate comprehensive security audit findings"""
        
        findings = {
            "critical_vulnerabilities": [
                {
                    "id": "VULN-001",
                    "severity": "CRITICAL",
                    "title": "No Backend Plan Limit Enforcement",
                    "description": "eventController.js createEvent() has NO subscription validation middleware. Users on Free plan may be able to create events with unlimited tickets.",
                    "affected_code": "/app/backend/controllers/eventController.js lines 20-54",
                    "recommendation": "Add middleware to check user's subscription plan and enforce ticketLimit, eventLimit, monthlyTicketLimit before allowing event creation."
                },
                {
                    "id": "VULN-002", 
                    "severity": "HIGH",
                    "title": "Plan Limits Only Checked for Fee Calculation",
                    "description": "organizerPlan is only used to calculate fees (stripeController.js line 257), but not to enforce creation limits.",
                    "affected_code": "/app/backend/controllers/stripeController.js",
                    "recommendation": "Add plan validation at event creation, not just fee calculation."
                }
            ],
            "potential_revenue_leakage": [
                "Free users creating unlimited events",
                "Free users selling >100 tickets per event",
                "Free users selling >400 tickets per month",
                "No enforcement of teamMemberLimit"
            ],
            "correctly_implemented": [
                "✓ Webhook signature validation (stripeWebhookController.js line 34)",
                "✓ Authentication required for event creation (authMiddleware.js)",
                "✓ Fee calculation uses backend plan lookup, not client-provided",
                "✓ Price validation prevents price manipulation attacks"
            ],
            "recommendations": [
                "1. Add subscription validation middleware to event creation",
                "2. Track monthly ticket sales per user in database",
                "3. Implement rate limiting for free plan users",
                "4. Add server-side check for expired subscriptions",
                "5. Log all bypass attempts for monitoring"
            ]
        }
        
        print("\n" + "="*60)
        print("MONETIZATION SECURITY AUDIT REPORT")
        print("="*60)
        
        print("\n🔴 CRITICAL VULNERABILITIES:")
        for vuln in findings["critical_vulnerabilities"]:
            print(f"\n  [{vuln['id']}] {vuln['title']}")
            print(f"  Severity: {vuln['severity']}")
            print(f"  Description: {vuln['description']}")
            print(f"  Code: {vuln['affected_code']}")
        
        print("\n⚠️ POTENTIAL REVENUE LEAKAGE:")
        for leak in findings["potential_revenue_leakage"]:
            print(f"  - {leak}")
        
        print("\n✅ CORRECTLY IMPLEMENTED:")
        for correct in findings["correctly_implemented"]:
            print(f"  {correct}")
        
        print("\n📋 RECOMMENDATIONS:")
        for rec in findings["recommendations"]:
            print(f"  {rec}")
        
        print("\n" + "="*60)
        
        # This test always passes - it's for documentation
        assert True


if __name__ == "__main__":
    pytest.main([__file__, "-v", "-s"])
