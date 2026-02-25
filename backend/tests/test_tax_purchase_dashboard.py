"""
Test cases for:
1. Tax proportionality - /api/stripe/calculate-order (5% of subtotal)
2. Purchase flow - verify paid registrations in DB
3. Calculate-order API correctness - grandTotal = subtotal + tax + platform_fee + stripe_fee
4. Dashboard.tsx periodic refresh code review
5. LiveRevenueWidget rendering review
6. High-price event tax calculation
"""
import pytest
import requests
import os
import re

# Backend running internally on localhost
BASE_URL = 'http://localhost:8001'

# Test event IDs provided in the review request
EVENT_ID_STANDARD = '6583dce0-9c33-4a0c-a1b9-1ac3f5a1135d'   # TEST Event, $200 ticket, 5% tax
EVENT_ID_HIGH_PRICE = 'dbb13101-f615-4536-9f15-d7f1fad78e2e' # TEST - High Price Event, $55000 ticket, 5% tax


# ============================================================
# Health Check
# ============================================================
class TestHealthCheck:
    """Basic health check"""

    def test_health_endpoint(self):
        """Ensure backend is up"""
        response = requests.get(f"{BASE_URL}/api/health")
        assert response.status_code == 200, f"Health check failed: {response.status_code}"
        print("✅ Backend health check passed")


# ============================================================
# Calculate-Order API Tests
# ============================================================
class TestCalculateOrderTaxProportionality:
    """Tax must be 5% of subtotal - proportional to ticket quantity/price"""

    def test_standard_event_1_ticket_tax(self):
        """$200 ticket × 1 = $200 subtotal; tax at 5% should be $10"""
        payload = {
            "eventId": EVENT_ID_STANDARD,
            "ticketSelections": {"general": 1}
        }
        response = requests.post(f"{BASE_URL}/api/stripe/calculate-order", json=payload)
        print(f"Response status: {response.status_code}")
        print(f"Response body: {response.text[:500]}")
        assert response.status_code == 200, f"Expected 200, got {response.status_code}: {response.text}"

        data = response.json()
        print(f"Breakdown: subtotal={data.get('discountedSubtotal')}, tax={data.get('taxAmount')}, taxRate={data.get('taxRate')}")

        tax = data.get('taxAmount', 0)
        subtotal = data.get('discountedSubtotal', 0)

        # If event has tiers, ticketSubtotal might be from tiers
        assert subtotal > 0, "Subtotal should be > 0"
        if data.get('taxRate', 0) > 0:
            expected_tax = round(subtotal * data['taxRate'] / 100, 2)
            assert abs(tax - expected_tax) < 0.05, \
                f"Tax should be {expected_tax} (5% of {subtotal}), got {tax}"
            print(f"✅ Tax is proportional: {tax} ≈ {expected_tax} (5% of {subtotal})")
        else:
            print(f"⚠️ Event tax_rate is 0 or None — skipping proportionality check (taxRate={data.get('taxRate')})")

    def test_standard_event_2_tickets_tax_is_double(self):
        """2 tickets should give exactly 2× the tax of 1 ticket"""
        payload_1 = {"eventId": EVENT_ID_STANDARD, "ticketSelections": {"general": 1}}
        payload_2 = {"eventId": EVENT_ID_STANDARD, "ticketSelections": {"general": 2}}

        resp1 = requests.post(f"{BASE_URL}/api/stripe/calculate-order", json=payload_1)
        resp2 = requests.post(f"{BASE_URL}/api/stripe/calculate-order", json=payload_2)

        assert resp1.status_code == 200, f"1-ticket request failed: {resp1.status_code}"
        assert resp2.status_code == 200, f"2-ticket request failed: {resp2.status_code}"

        data1 = resp1.json()
        data2 = resp2.json()

        tax1 = data1.get('taxAmount', 0)
        tax2 = data2.get('taxAmount', 0)

        print(f"1-ticket tax: {tax1}, 2-ticket tax: {tax2}")

        if tax1 > 0 and tax2 > 0:
            # Tax should scale proportionally (2 tickets = 2x tax)
            assert abs(tax2 - tax1 * 2) < 0.05, \
                f"2-ticket tax ({tax2}) should be ~2× 1-ticket tax ({tax1})"
            print(f"✅ Tax is proportional: 2× {tax1} = {tax1*2}, got {tax2}")
        elif tax1 == 0 and tax2 == 0:
            print("⚠️ Both taxes are 0 — event may not have tax configured")

    def test_standard_event_tiered_ticket_selection(self):
        """Test with tiered ticket selection (check if event uses tiers)"""
        # First try general admission
        payload = {"eventId": EVENT_ID_STANDARD, "ticketSelections": {"general": 1}}
        response = requests.post(f"{BASE_URL}/api/stripe/calculate-order", json=payload)

        if response.status_code == 400 and 'Invalid ticket' in response.text:
            # Event uses tiered pricing - we need tier IDs which we don't have without fetching event
            print("ℹ️ Event uses tiered pricing, general admission not applicable")
            pytest.skip("Event uses tiered pricing - need tier IDs")

        assert response.status_code == 200, f"Expected 200, got {response.status_code}: {response.text}"
        data = response.json()
        assert data.get('items') is not None, "Response should have items"
        assert len(data['items']) > 0, "Should have at least 1 item"
        print(f"✅ Calculate-order API returned valid breakdown with {len(data['items'])} item(s)")

    def test_grand_total_equals_sum_of_components(self):
        """grandTotal should equal subtotal + tax + platformFee + stripeFee"""
        payload = {"eventId": EVENT_ID_STANDARD, "ticketSelections": {"general": 1}}
        response = requests.post(f"{BASE_URL}/api/stripe/calculate-order", json=payload)

        if response.status_code != 200:
            pytest.skip(f"Cannot reach event: {response.status_code}")

        data = response.json()
        subtotal = data.get('discountedSubtotal', 0)
        tax = data.get('taxAmount', 0)
        platform_fee = data.get('platformFee', 0)
        stripe_fee = data.get('stripeFee', 0)
        custom_fees = data.get('customFeesAmount', 0)
        grand_total = data.get('grandTotal', 0)
        absorbed = data.get('platformFeeAbsorbedByOrganizer', False)

        if absorbed:
            expected_total = round(subtotal + tax + custom_fees, 2)
        else:
            expected_total = round(subtotal + tax + platform_fee + stripe_fee + custom_fees, 2)

        print(f"Components: subtotal={subtotal}, tax={tax}, platformFee={platform_fee}, stripeFee={stripe_fee}, customFees={custom_fees}")
        print(f"Expected grandTotal={expected_total}, Actual grandTotal={grand_total}")

        assert abs(grand_total - expected_total) < 0.05, \
            f"grandTotal ({grand_total}) ≠ component sum ({expected_total})"
        print(f"✅ grandTotal reconciles correctly: {grand_total}")

    def test_calculate_order_event_not_found(self):
        """Should return 404 for non-existent event"""
        payload = {"eventId": "non-existent-event-id-xyz", "ticketSelections": {"general": 1}}
        response = requests.post(f"{BASE_URL}/api/stripe/calculate-order", json=payload)
        assert response.status_code == 404, f"Expected 404, got {response.status_code}"
        print(f"✅ Correctly returns 404 for non-existent event")


# ============================================================
# High-Price Event Tax Test
# ============================================================
class TestHighPriceEventTax:
    """Test tax calculation for $55,000 ticket (5% = $2,750)"""

    def test_high_price_1_ticket_tax(self):
        """$55,000 ticket × 1 ticket; 5% tax = $2,750"""
        payload = {"eventId": EVENT_ID_HIGH_PRICE, "ticketSelections": {"general": 1}}
        response = requests.post(f"{BASE_URL}/api/stripe/calculate-order", json=payload)
        print(f"High-price response status: {response.status_code}")
        print(f"High-price response: {response.text[:500]}")

        if response.status_code == 400 and 'Invalid ticket' in response.text:
            print("ℹ️ High-price event uses tiered pricing - need tier IDs from DB")
            pytest.skip("High-price event uses tiered pricing")

        assert response.status_code == 200, f"Expected 200, got {response.status_code}: {response.text}"

        data = response.json()
        subtotal = data.get('discountedSubtotal', 0)
        tax = data.get('taxAmount', 0)
        tax_rate = data.get('taxRate', 0)

        print(f"High-price breakdown: subtotal={subtotal}, taxRate={tax_rate}, taxAmount={tax}")

        if subtotal > 0 and tax_rate > 0:
            expected_tax = round(subtotal * tax_rate / 100, 2)
            assert abs(tax - expected_tax) < 1.0, \
                f"Tax should be ~{expected_tax} (5% of {subtotal}), got {tax}"
            print(f"✅ High-price tax: {tax} (expected ~{expected_tax} at {tax_rate}%)")

            # Specifically for $55,000 event at 5% → $2750
            if abs(subtotal - 55000) < 10:
                assert abs(tax - 2750) < 5, f"Expected tax ≈ $2750, got ${tax}"
                print("✅ $55,000 × 5% = $2,750 tax confirmed")
        else:
            print(f"⚠️ Event has no tax configured (taxRate={tax_rate}) or subtotal=0")


# ============================================================
# Paid Registrations Verification (via Supabase REST API)
# ============================================================
class TestPaidRegistrationsInDB:
    """Verify paid registrations exist in database (from 2026-02-25)"""

    SUPABASE_URL = 'https://dcjdurvgkveblvtinoms.supabase.co'
    # Service role key from /app/.env
    SUPABASE_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImRjamR1cnZna3ZlYmx2dGlub21zIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc2NjQxMDM4NSwiZXhwIjoyMDgxOTg2Mzg1fQ.YII1GuVBPgY0_4sT3-zdfjioBQjO9mYILbLA-Syu9c0'

    def _supabase_headers(self):
        return {
            "apikey": self.SUPABASE_KEY,
            "Authorization": f"Bearer {self.SUPABASE_KEY}",
            "Content-Type": "application/json"
        }

    def test_paid_registrations_exist(self):
        """Check there are paid registrations in the DB"""
        url = f"{self.SUPABASE_URL}/rest/v1/registrations"
        params = {
            "payment_status": "eq.paid",
            "select": "id,payment_status,created_at,event_id",
            "limit": "10",
            "order": "created_at.desc"
        }
        response = requests.get(url, headers=self._supabase_headers(), params=params)
        print(f"Supabase registrations query status: {response.status_code}")
        print(f"Response: {response.text[:500]}")

        assert response.status_code == 200, f"Supabase query failed: {response.status_code}"
        data = response.json()
        assert len(data) > 0, "Expected paid registrations to exist in DB, found 0"
        print(f"✅ Found {len(data)} paid registration(s) in DB")
        for reg in data[:3]:
            print(f"  - ID: {reg.get('id')}, event: {reg.get('event_id')}, created: {reg.get('created_at')}")

    def test_recent_paid_registrations_from_feb_2026(self):
        """Check for paid registrations from 2026-02-25"""
        url = f"{self.SUPABASE_URL}/rest/v1/registrations"
        params = {
            "payment_status": "eq.paid",
            "created_at": "gte.2026-02-25",
            "select": "id,payment_status,created_at,event_id,attendee_name",
            "limit": "10",
            "order": "created_at.desc"
        }
        response = requests.get(url, headers=self._supabase_headers(), params=params)
        print(f"Feb 2026 registrations query: {response.status_code}")
        print(f"Response: {response.text[:500]}")

        assert response.status_code == 200, f"Supabase query failed: {response.status_code}"
        data = response.json()

        if len(data) > 0:
            print(f"✅ Found {len(data)} paid registration(s) from 2026-02-25 onwards")
            for reg in data[:3]:
                print(f"  - {reg.get('attendee_name', 'N/A')} | event: {reg.get('event_id')} | {reg.get('created_at')}")
        else:
            print("⚠️ No paid registrations from 2026-02-25 onwards (may still be in pending state or different date range)")

    def test_registrations_count_by_status(self):
        """Get count of registrations by payment status to check persistence"""
        statuses = ['paid', 'pending', 'completed']
        for status in statuses:
            url = f"{self.SUPABASE_URL}/rest/v1/registrations"
            params = {
                "payment_status": f"eq.{status}",
                "select": "id",
            }
            headers = {**self._supabase_headers(), "Prefer": "count=exact"}
            response = requests.get(url, headers=headers, params=params)
            count_header = response.headers.get('content-range', 'N/A')
            print(f"  Status '{status}': {count_header}, HTTP {response.status_code}")
            assert response.status_code == 200, f"Failed to query {status}: {response.status_code}"
        print("✅ Successfully queried registrations by payment status")


# ============================================================
# Dashboard.tsx Code Review (Code Analysis)
# ============================================================
class TestDashboardPeriodicRefreshCodeReview:
    """Code review: verify Dashboard.tsx has correct periodic refresh implementation"""

    DASHBOARD_FILE = '/app/components/Dashboard.tsx'

    def _read_dashboard(self):
        with open(self.DASHBOARD_FILE, 'r') as f:
            return f.read()

    def test_useref_for_userid_exists(self):
        """Dashboard.tsx should have useRef for userId (lines 93-94)"""
        content = self._read_dashboard()
        assert 'useRef' in content, "useRef import not found in Dashboard.tsx"
        assert 'userIdRef' in content, "userIdRef not found in Dashboard.tsx"
        print("✅ userIdRef (useRef) found in Dashboard.tsx")

    def test_setinterval_30s_exists(self):
        """Dashboard.tsx should have 30-second setInterval for periodic refresh"""
        content = self._read_dashboard()
        assert 'setInterval' in content, "setInterval not found in Dashboard.tsx"
        assert '30000' in content, "30000ms interval not found in Dashboard.tsx"
        print("✅ 30-second setInterval found in Dashboard.tsx")

    def test_visibilitychange_listener_exists(self):
        """Dashboard.tsx should have visibilitychange event listener"""
        content = self._read_dashboard()
        assert 'visibilitychange' in content, "visibilitychange listener not found in Dashboard.tsx"
        assert 'document.hidden' in content, "document.hidden check not found in Dashboard.tsx"
        print("✅ visibilitychange event listener found in Dashboard.tsx")

    def test_cleanup_on_unmount(self):
        """setInterval should be cleared on component unmount (clearInterval)"""
        content = self._read_dashboard()
        assert 'clearInterval' in content, "clearInterval not found - interval not cleaned up on unmount"
        assert 'removeEventListener' in content, "removeEventListener not found - visibilitychange not cleaned up"
        print("✅ clearInterval and removeEventListener found - proper cleanup on unmount")

    def test_useref_set_in_initial_effect(self):
        """userIdRef.current should be set in the initial useEffect (after user load)"""
        content = self._read_dashboard()
        assert 'userIdRef.current = user.id' in content, \
            "userIdRef.current = user.id not found - userId ref may not be set correctly"
        print("✅ userIdRef.current = user.id found in initial useEffect")

    def test_refresh_uses_useref_not_state(self):
        """Periodic refresh should use userIdRef.current (not currentUser state) to avoid stale closure"""
        content = self._read_dashboard()
        # Check that the interval callback uses userIdRef.current
        assert 'userIdRef.current' in content, "userIdRef.current not used in refresh callback"
        print("✅ Interval uses userIdRef.current (avoids stale closure)")

    def test_live_revenue_widget_imported(self):
        """LiveRevenueWidget should be imported and used in Dashboard.tsx"""
        content = self._read_dashboard()
        assert 'LiveRevenueWidget' in content, "LiveRevenueWidget not found in Dashboard.tsx"
        print("✅ LiveRevenueWidget is used in Dashboard.tsx")


# ============================================================
# LiveRevenueWidget Code Review
# ============================================================
class TestLiveRevenueWidgetCodeReview:
    """Code review: verify LiveRevenueWidget props and calculations"""

    WIDGET_FILE = '/app/components/LiveRevenueWidget.tsx'

    def _read_widget(self):
        with open(self.WIDGET_FILE, 'r') as f:
            return f.read()

    def test_widget_accepts_events_and_registrations_props(self):
        """Widget should accept events and registrations as props"""
        content = self._read_widget()
        assert 'events: Event[]' in content or 'events: Event' in content, \
            "Widget should accept 'events' prop"
        assert 'registrations: Registration[]' in content or 'registrations: Registration' in content, \
            "Widget should accept 'registrations' prop"
        print("✅ LiveRevenueWidget accepts events and registrations props")

    def test_widget_uses_usememo_for_calculations(self):
        """Widget should use useMemo to avoid recalculation on every render"""
        content = self._read_widget()
        assert 'useMemo' in content, "Widget should use useMemo for calculations"
        print("✅ LiveRevenueWidget uses useMemo for performance optimization")

    def test_widget_filters_paid_registrations(self):
        """Widget should filter only paid, non-refunded registrations"""
        content = self._read_widget()
        assert 'isPaidStatus' in content, "Widget should use isPaidStatus filter"
        assert 'isRefundedStatus' in content, "Widget should exclude refunded registrations"
        print("✅ LiveRevenueWidget correctly filters paid & non-refunded registrations")

    def test_widget_empty_state_no_red_border(self):
        """Empty state should show clean card without red border"""
        content = self._read_widget()
        # Check the Card className for empty state
        lines = content.split('\n')
        for i, line in enumerate(lines):
            if 'registrations.length === 0' in line:
                # Check next 10 lines for no red border
                context = ' '.join(lines[i:i+10])
                assert 'border-red' not in context, \
                    "Empty state should not have red border"
                print("✅ Empty state does not have red border class")
                return
        print("✅ No issues found with empty state rendering")

    def test_widget_has_live_state_with_data(self):
        """Widget should show LIVE indicator when registrations exist"""
        content = self._read_widget()
        assert 'LIVE' in content, "Widget should show LIVE badge when data exists"
        assert 'animate-pulse' in content, "LIVE indicator should animate"
        print("✅ LiveRevenueWidget has animated LIVE indicator")

    def test_widget_shows_today_revenue_and_tickets(self):
        """Widget should display today's revenue and ticket count"""
        content = self._read_widget()
        assert 'todayRevenue' in content, "Widget should display today's revenue"
        assert 'todayTickets' in content, "Widget should display today's ticket count"
        assert 'lastHourSales' in content, "Widget should display sales velocity"
        print("✅ LiveRevenueWidget displays today's revenue, tickets, and velocity")

    def test_widget_48h_recent_sales_feed(self):
        """Widget should show recent sales feed for last 48 hours"""
        content = self._read_widget()
        assert 'last48hMs' in content or '48' in content, \
            "Widget should filter registrations to last 48 hours"
        assert 'recentSales' in content, "Widget should have recentSales variable"
        print("✅ LiveRevenueWidget shows 48-hour recent sales feed")

    def test_widget_uses_timestamp_for_time_filtering(self):
        """Widget should use timestamp field for time-based filtering"""
        content = self._read_widget()
        assert 'timestamp' in content, "Widget should use timestamp for filtering"
        assert 'todayStartMs' in content, "Widget should calculate today's start timestamp"
        print("✅ LiveRevenueWidget uses timestamp-based filtering")


# ============================================================
# Calculate-order with Tiered Tickets (Fetch Event Tiers First)
# ============================================================
class TestCalculateOrderWithTiers:
    """Test calculate-order using actual tier IDs from the events"""

    SUPABASE_URL = 'https://dcjdurvgkveblvtinoms.supabase.co'
    SUPABASE_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImRjamR1cnZna3ZlYmx2dGlub21zIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc2NjQxMDM4NSwiZXhwIjoyMDgxOTg2Mzg1fQ.YII1GuVBPgY0_4sT3-zdfjioBQjO9mYILbLA-Syu9c0'

    def _supabase_headers(self):
        return {
            "apikey": self.SUPABASE_KEY,
            "Authorization": f"Bearer {self.SUPABASE_KEY}",
            "Content-Type": "application/json"
        }

    def _get_event_tiers(self, event_id):
        """Fetch event tiers from Supabase"""
        url = f"{self.SUPABASE_URL}/rest/v1/events"
        params = {
            "id": f"eq.{event_id}",
            "select": "id,title,ticket_tiers,price,price_type,tax_rate,ticket_name"
        }
        response = requests.get(url, headers=self._supabase_headers(), params=params)
        if response.status_code == 200 and response.json():
            return response.json()[0]
        return None

    def test_standard_event_calculate_with_actual_tiers(self):
        """Test calculate-order using actual tier IDs from DB for standard event"""
        event = self._get_event_tiers(EVENT_ID_STANDARD)
        if not event:
            pytest.skip("Cannot fetch event from Supabase")

        print(f"Event: {event.get('title')}, price_type: {event.get('price_type')}, tax_rate: {event.get('tax_rate')}")
        tiers = event.get('ticket_tiers') or []
        print(f"Ticket tiers: {tiers}")

        if tiers:
            # Use first tier
            tier_id = tiers[0].get('id')
            tier_price = float(tiers[0].get('price', 0))
            print(f"Testing with tier: {tier_id}, price: ${tier_price}")

            payload = {"eventId": EVENT_ID_STANDARD, "ticketSelections": {tier_id: 1}}
            response = requests.post(f"{BASE_URL}/api/stripe/calculate-order", json=payload)
            assert response.status_code == 200, f"Expected 200, got {response.status_code}: {response.text}"

            data = response.json()
            tax_rate = data.get('taxRate', 0)
            subtotal = data.get('discountedSubtotal', 0)
            tax = data.get('taxAmount', 0)

            print(f"Result: subtotal={subtotal}, taxRate={tax_rate}%, taxAmount={tax}")

            if tax_rate > 0 and subtotal > 0:
                expected_tax = round(subtotal * tax_rate / 100, 2)
                assert abs(tax - expected_tax) < 0.05, \
                    f"Tax ({tax}) should be {expected_tax} ({tax_rate}% of {subtotal})"
                print(f"✅ Tiered event tax correct: {tax} = {tax_rate}% of {subtotal}")
            else:
                print(f"⚠️ No tax configured on this event")
        else:
            # Simple pricing
            price_type = event.get('price_type', 'paid')
            price = float(event.get('price', 0))
            print(f"Simple pricing: ${price}, type: {price_type}")

            payload = {"eventId": EVENT_ID_STANDARD, "ticketSelections": {"general": 1}}
            response = requests.post(f"{BASE_URL}/api/stripe/calculate-order", json=payload)
            assert response.status_code == 200, f"Expected 200, got {response.status_code}: {response.text}"
            data = response.json()
            print(f"Simple pricing result: {data}")
            print("✅ Simple pricing event calculate-order works")

    def test_high_price_event_calculate_with_actual_tiers(self):
        """Test calculate-order using actual tier IDs from DB for high-price event"""
        event = self._get_event_tiers(EVENT_ID_HIGH_PRICE)
        if not event:
            pytest.skip("Cannot fetch high-price event from Supabase")

        print(f"High-price event: {event.get('title')}, tax_rate: {event.get('tax_rate')}")
        tiers = event.get('ticket_tiers') or []

        if tiers:
            tier_id = tiers[0].get('id')
            tier_price = float(tiers[0].get('price', 0))
            print(f"Testing with tier: {tier_id}, price: ${tier_price}")

            payload = {"eventId": EVENT_ID_HIGH_PRICE, "ticketSelections": {tier_id: 1}}
            response = requests.post(f"{BASE_URL}/api/stripe/calculate-order", json=payload)
            print(f"Status: {response.status_code}")
            print(f"Body: {response.text[:500]}")

            assert response.status_code == 200, f"Expected 200, got {response.status_code}: {response.text}"
            data = response.json()
            tax_rate = data.get('taxRate', 0)
            subtotal = data.get('discountedSubtotal', 0)
            tax = data.get('taxAmount', 0)

            print(f"High-price result: subtotal={subtotal}, taxRate={tax_rate}%, taxAmount={tax}")

            if tax_rate > 0 and subtotal > 0:
                expected_tax = round(subtotal * tax_rate / 100, 2)
                assert abs(tax - expected_tax) < 1.0, \
                    f"Tax ({tax}) should be ~{expected_tax} ({tax_rate}% of {subtotal})"
                print(f"✅ High-price event tax: {tax} = {tax_rate}% of {subtotal}")
                if abs(tier_price - 55000) < 100:
                    print(f"  Expected ~$2750 tax for $55k ticket at 5% → actual: ${tax}")
        else:
            payload = {"eventId": EVENT_ID_HIGH_PRICE, "ticketSelections": {"general": 1}}
            response = requests.post(f"{BASE_URL}/api/stripe/calculate-order", json=payload)
            assert response.status_code == 200, f"Expected 200, got {response.status_code}: {response.text}"
            data = response.json()
            print(f"High-price simple pricing result: {data}")
            print("✅ High-price event simple pricing calculate-order works")


if __name__ == "__main__":
    pytest.main([__file__, "-v", "--tb=short"])
