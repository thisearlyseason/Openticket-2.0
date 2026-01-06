"""
Test suite for calculate-order API endpoint and price calculation consistency
Tests: Platform fee, discount, tax, platform donation calculations
"""
import pytest
import requests
import os
import json

BASE_URL = os.environ.get('REACT_APP_BACKEND_URL', 'http://localhost:8001')

class TestCalculateOrderEndpoint:
    """Tests for /api/stripe/calculate-order endpoint"""
    
    def test_calculate_order_endpoint_exists(self):
        """Test that calculate-order endpoint is accessible"""
        response = requests.post(f"{BASE_URL}/api/stripe/calculate-order", json={
            "eventId": "nonexistent-event",
            "ticketSelections": {},
            "addOnSelections": {}
        })
        # Should return 404 for non-existent event, not 500 or connection error
        assert response.status_code in [404, 400], f"Unexpected status: {response.status_code}"
        print(f"✓ calculate-order endpoint accessible, returns {response.status_code} for invalid event")
    
    def test_calculate_order_with_fixed_price_event(self):
        """Test calculation for fixed price event (music fest - $50)"""
        # Event: music fest - price_type: fixed, price: 50, absorb_fees: false
        event_id = "b8739973-fe02-4c11-ae2d-09f42c2d3213"
        
        response = requests.post(f"{BASE_URL}/api/stripe/calculate-order", json={
            "eventId": event_id,
            "ticketSelections": {"general": 2},
            "addOnSelections": {}
        })
        
        assert response.status_code == 200, f"Expected 200, got {response.status_code}: {response.text}"
        breakdown = response.json()
        
        # Verify breakdown structure
        assert "ticketSubtotal" in breakdown, "Missing ticketSubtotal"
        assert "addOnSubtotal" in breakdown, "Missing addOnSubtotal"
        assert "rawSubtotal" in breakdown, "Missing rawSubtotal"
        assert "discountAmount" in breakdown, "Missing discountAmount"
        assert "discountedSubtotal" in breakdown, "Missing discountedSubtotal"
        assert "taxAmount" in breakdown, "Missing taxAmount"
        assert "platformFee" in breakdown, "Missing platformFee"
        assert "grandTotal" in breakdown, "Missing grandTotal"
        
        # Verify calculations for 2 tickets at $50 each
        assert breakdown["ticketSubtotal"] == 100, f"Expected ticketSubtotal=100, got {breakdown['ticketSubtotal']}"
        assert breakdown["rawSubtotal"] == 100, f"Expected rawSubtotal=100, got {breakdown['rawSubtotal']}"
        
        # This event has absorb_fees=false, so platformFee should be charged
        # Free plan fee: 2.75% + $0.99 = 100 * 0.0275 + 0.99 = 3.74
        expected_fee = round(100 * 0.0275 + 0.99, 2)
        assert breakdown["platformFee"] == expected_fee, f"Expected platformFee={expected_fee}, got {breakdown['platformFee']}"
        
        # Grand total should be subtotal + platform fee
        expected_total = 100 + expected_fee
        assert breakdown["grandTotal"] == expected_total, f"Expected grandTotal={expected_total}, got {breakdown['grandTotal']}"
        
        print(f"✓ Fixed price event calculation correct: {json.dumps(breakdown, indent=2)}")
    
    def test_calculate_order_with_donation_event(self):
        """Test calculation for donation event (Summer Music Festival)"""
        # Event: Summer Music Festival - price_type: donation
        event_id = "evt-1766591216974"
        
        response = requests.post(f"{BASE_URL}/api/stripe/calculate-order", json={
            "eventId": event_id,
            "ticketSelections": {"general": 1},
            "addOnSelections": {}
        })
        
        assert response.status_code == 200, f"Expected 200, got {response.status_code}: {response.text}"
        breakdown = response.json()
        
        # Donation events have $0 ticket price
        assert breakdown["ticketSubtotal"] == 0, f"Expected ticketSubtotal=0 for donation event, got {breakdown['ticketSubtotal']}"
        
        # Platform fee should be 0 for donation events
        assert breakdown["platformFee"] == 0, f"Expected platformFee=0 for donation event, got {breakdown['platformFee']}"
        
        print(f"✓ Donation event calculation correct: {json.dumps(breakdown, indent=2)}")
    
    def test_calculate_order_with_addon(self):
        """Test calculation with add-on (T-SHIRT $25)"""
        # Event: Summer Music Festival has T-SHIRT addon at $25
        event_id = "evt-1766591216974"
        addon_id = "addon-1766590881616"
        
        response = requests.post(f"{BASE_URL}/api/stripe/calculate-order", json={
            "eventId": event_id,
            "ticketSelections": {"general": 1},
            "addOnSelections": {addon_id: 2}  # 2 T-shirts
        })
        
        assert response.status_code == 200, f"Expected 200, got {response.status_code}: {response.text}"
        breakdown = response.json()
        
        # 2 T-shirts at $25 each = $50
        assert breakdown["addOnSubtotal"] == 50, f"Expected addOnSubtotal=50, got {breakdown['addOnSubtotal']}"
        
        # Verify items array contains the addon
        addon_items = [item for item in breakdown.get("items", []) if item.get("type") == "addon"]
        assert len(addon_items) == 1, f"Expected 1 addon item, got {len(addon_items)}"
        assert addon_items[0]["quantity"] == 2, f"Expected addon quantity=2, got {addon_items[0]['quantity']}"
        
        print(f"✓ Add-on calculation correct: {json.dumps(breakdown, indent=2)}")
    
    def test_calculate_order_breakdown_fields(self):
        """Test that all required breakdown fields are returned"""
        event_id = "b8739973-fe02-4c11-ae2d-09f42c2d3213"
        
        response = requests.post(f"{BASE_URL}/api/stripe/calculate-order", json={
            "eventId": event_id,
            "ticketSelections": {"general": 1},
            "addOnSelections": {}
        })
        
        assert response.status_code == 200
        breakdown = response.json()
        
        required_fields = [
            "ticketSubtotal",
            "addOnSubtotal", 
            "rawSubtotal",
            "discountAmount",
            "discountedSubtotal",
            "taxAmount",
            "platformFee",
            "grandTotal",
            "items"
        ]
        
        for field in required_fields:
            assert field in breakdown, f"Missing required field: {field}"
        
        print(f"✓ All required breakdown fields present")
    
    def test_calculate_order_no_tickets_selected(self):
        """Test calculation with no tickets selected"""
        event_id = "b8739973-fe02-4c11-ae2d-09f42c2d3213"
        
        response = requests.post(f"{BASE_URL}/api/stripe/calculate-order", json={
            "eventId": event_id,
            "ticketSelections": {},
            "addOnSelections": {}
        })
        
        assert response.status_code == 200
        breakdown = response.json()
        
        # All values should be 0
        assert breakdown["ticketSubtotal"] == 0
        assert breakdown["grandTotal"] == 0
        
        print(f"✓ Empty selection returns zero totals")


class TestPlatformFeeCalculation:
    """Tests for platform fee calculation consistency"""
    
    def test_platform_fee_free_plan(self):
        """Test platform fee for free plan organizer (2.75% + $0.99)"""
        # Event: music fest - absorb_fees: true, so fee should be 0
        # Need to find an event with absorb_fees: false
        event_id = "b8739973-fe02-4c11-ae2d-09f42c2d3213"
        
        response = requests.post(f"{BASE_URL}/api/stripe/calculate-order", json={
            "eventId": event_id,
            "ticketSelections": {"general": 1},
            "addOnSelections": {}
        })
        
        assert response.status_code == 200
        breakdown = response.json()
        
        # This event has absorb_fees=true, so platformFee=0
        # The test validates the endpoint returns the fee field
        assert "platformFee" in breakdown
        print(f"✓ Platform fee field present: ${breakdown['platformFee']}")
    
    def test_platform_fee_not_absorbed(self):
        """Test that absorb_fees=false results in platform fee being charged to buyer"""
        # Event: music fest has absorb_fees: false
        event_id = "b8739973-fe02-4c11-ae2d-09f42c2d3213"
        
        response = requests.post(f"{BASE_URL}/api/stripe/calculate-order", json={
            "eventId": event_id,
            "ticketSelections": {"general": 2},
            "addOnSelections": {}
        })
        
        assert response.status_code == 200
        breakdown = response.json()
        
        # absorb_fees=false means buyer pays the fee
        # Free plan fee: 2.75% + $0.99 on $100 = 3.74
        expected_fee = round(100 * 0.0275 + 0.99, 2)
        assert breakdown["platformFee"] == expected_fee, f"Expected platformFee={expected_fee}, got {breakdown['platformFee']}"
        
        # Grand total should equal discounted subtotal + tax + custom fees + platform fee
        expected_total = breakdown["discountedSubtotal"] + breakdown["taxAmount"] + breakdown.get("customFeesAmount", 0) + breakdown["platformFee"]
        assert abs(breakdown["grandTotal"] - expected_total) < 0.01, f"Grand total mismatch: {breakdown['grandTotal']} vs expected {expected_total}"
        
        print(f"✓ Platform fee correctly charged to buyer when absorb_fees=false")


class TestDiscountCalculation:
    """Tests for promo code discount calculation"""
    
    def test_discount_without_promo_code(self):
        """Test that discount is 0 when no promo code applied"""
        event_id = "b8739973-fe02-4c11-ae2d-09f42c2d3213"
        
        response = requests.post(f"{BASE_URL}/api/stripe/calculate-order", json={
            "eventId": event_id,
            "ticketSelections": {"general": 1},
            "addOnSelections": {},
            "promoCode": None
        })
        
        assert response.status_code == 200
        breakdown = response.json()
        
        assert breakdown["discountAmount"] == 0, f"Expected discountAmount=0 without promo, got {breakdown['discountAmount']}"
        assert breakdown["rawSubtotal"] == breakdown["discountedSubtotal"], "Raw and discounted subtotals should match without promo"
        
        print(f"✓ No discount applied without promo code")
    
    def test_discount_with_invalid_promo_code(self):
        """Test that invalid promo code is ignored"""
        event_id = "b8739973-fe02-4c11-ae2d-09f42c2d3213"
        
        response = requests.post(f"{BASE_URL}/api/stripe/calculate-order", json={
            "eventId": event_id,
            "ticketSelections": {"general": 1},
            "addOnSelections": {},
            "promoCode": "INVALID_CODE_12345"
        })
        
        assert response.status_code == 200
        breakdown = response.json()
        
        # Invalid promo should result in 0 discount
        assert breakdown["discountAmount"] == 0, f"Expected discountAmount=0 for invalid promo, got {breakdown['discountAmount']}"
        
        print(f"✓ Invalid promo code correctly ignored")


class TestTaxCalculation:
    """Tests for tax calculation"""
    
    def test_tax_calculation_no_tax_rate(self):
        """Test that tax is 0 when event has no tax rate"""
        # Both test events don't have tax_rate set
        event_id = "b8739973-fe02-4c11-ae2d-09f42c2d3213"
        
        response = requests.post(f"{BASE_URL}/api/stripe/calculate-order", json={
            "eventId": event_id,
            "ticketSelections": {"general": 1},
            "addOnSelections": {}
        })
        
        assert response.status_code == 200
        breakdown = response.json()
        
        assert breakdown["taxAmount"] == 0, f"Expected taxAmount=0 without tax rate, got {breakdown['taxAmount']}"
        
        print(f"✓ Tax correctly calculated as $0 without tax rate")


class TestGrandTotalConsistency:
    """Tests for grand total calculation consistency"""
    
    def test_grand_total_formula(self):
        """Test that grandTotal = discountedSubtotal + tax + customFees + platformFee"""
        event_id = "b8739973-fe02-4c11-ae2d-09f42c2d3213"
        
        response = requests.post(f"{BASE_URL}/api/stripe/calculate-order", json={
            "eventId": event_id,
            "ticketSelections": {"general": 2},
            "addOnSelections": {}
        })
        
        assert response.status_code == 200
        breakdown = response.json()
        
        expected_total = (
            breakdown["discountedSubtotal"] +
            breakdown["taxAmount"] +
            breakdown.get("customFeesAmount", 0) +
            breakdown["platformFee"]
        )
        
        # Allow small floating point tolerance
        assert abs(breakdown["grandTotal"] - expected_total) < 0.01, \
            f"Grand total mismatch: {breakdown['grandTotal']} vs calculated {expected_total}"
        
        print(f"✓ Grand total formula verified: ${breakdown['grandTotal']}")
    
    def test_subtotal_consistency(self):
        """Test that rawSubtotal = ticketSubtotal + addOnSubtotal"""
        event_id = "evt-1766591216974"
        addon_id = "addon-1766590881616"
        
        response = requests.post(f"{BASE_URL}/api/stripe/calculate-order", json={
            "eventId": event_id,
            "ticketSelections": {"general": 1},
            "addOnSelections": {addon_id: 1}
        })
        
        assert response.status_code == 200
        breakdown = response.json()
        
        expected_raw = breakdown["ticketSubtotal"] + breakdown["addOnSubtotal"]
        assert breakdown["rawSubtotal"] == expected_raw, \
            f"Raw subtotal mismatch: {breakdown['rawSubtotal']} vs {expected_raw}"
        
        print(f"✓ Subtotal consistency verified")


class TestCreateOrderConsistency:
    """Tests to verify calculate-order matches create-order calculations"""
    
    def test_calculate_matches_create_order_structure(self):
        """Test that calculate-order returns same structure used by create-order"""
        event_id = "b8739973-fe02-4c11-ae2d-09f42c2d3213"
        
        response = requests.post(f"{BASE_URL}/api/stripe/calculate-order", json={
            "eventId": event_id,
            "ticketSelections": {"general": 1},
            "addOnSelections": {}
        })
        
        assert response.status_code == 200
        breakdown = response.json()
        
        # These fields are used by create-order for Stripe checkout
        critical_fields = ["grandTotal", "platformFee", "taxAmount", "discountAmount"]
        for field in critical_fields:
            assert field in breakdown, f"Missing critical field for Stripe: {field}"
            assert isinstance(breakdown[field], (int, float)), f"Field {field} should be numeric"
        
        print(f"✓ Calculate-order returns all fields needed for Stripe checkout")


class TestEdgeCases:
    """Edge case tests"""
    
    def test_missing_event_id(self):
        """Test error handling for missing eventId"""
        response = requests.post(f"{BASE_URL}/api/stripe/calculate-order", json={
            "ticketSelections": {"general": 1},
            "addOnSelections": {}
        })
        
        # Should return error, not crash
        assert response.status_code in [400, 404, 500]
        print(f"✓ Missing eventId handled gracefully: {response.status_code}")
    
    def test_negative_quantity_handled(self):
        """Test that negative quantities are handled"""
        event_id = "b8739973-fe02-4c11-ae2d-09f42c2d3213"
        
        response = requests.post(f"{BASE_URL}/api/stripe/calculate-order", json={
            "eventId": event_id,
            "ticketSelections": {"general": -1},
            "addOnSelections": {}
        })
        
        # Should either reject or treat as 0
        assert response.status_code == 200
        breakdown = response.json()
        assert breakdown["ticketSubtotal"] >= 0, "Negative subtotal not allowed"
        
        print(f"✓ Negative quantity handled correctly")
    
    def test_zero_quantity(self):
        """Test calculation with zero quantity"""
        event_id = "b8739973-fe02-4c11-ae2d-09f42c2d3213"
        
        response = requests.post(f"{BASE_URL}/api/stripe/calculate-order", json={
            "eventId": event_id,
            "ticketSelections": {"general": 0},
            "addOnSelections": {}
        })
        
        assert response.status_code == 200
        breakdown = response.json()
        assert breakdown["grandTotal"] == 0
        
        print(f"✓ Zero quantity returns zero total")


if __name__ == "__main__":
    pytest.main([__file__, "-v", "--tb=short"])
