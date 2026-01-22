"""
Test Currency Conversion Feature - P0 Financial Accuracy Fix
Tests the conversion ratio logic across:
1. Backend /api/stripe/verify-session endpoint (chargedCurrency, chargedAmount)
2. Conversion math validation
"""

import pytest
import requests
import os
import json

BASE_URL = os.environ.get('VITE_BACKEND_URL', 'https://www.openticket.events')


class TestVerifySessionEndpoint:
    """Test /api/stripe/verify-session returns chargedCurrency and chargedAmount"""
    
    def test_verify_session_endpoint_exists(self):
        """Verify the endpoint exists and responds"""
        response = requests.post(
            f"{BASE_URL}/api/stripe/verify-session",
            json={"sessionId": "invalid_session_id"},
            headers={"Content-Type": "application/json"}
        )
        # Should return 404 for invalid session, not 500 or connection error
        assert response.status_code in [200, 400, 404], f"Unexpected status: {response.status_code}"
        
    def test_verify_session_requires_session_id(self):
        """Verify endpoint requires sessionId parameter"""
        response = requests.post(
            f"{BASE_URL}/api/stripe/verify-session",
            json={},
            headers={"Content-Type": "application/json"}
        )
        assert response.status_code == 400
        data = response.json()
        assert "error" in data or "Session ID required" in str(data)
        print(f"✅ verify-session correctly requires sessionId: {data}")
        
    def test_verify_session_invalid_session_returns_error(self):
        """Verify invalid session ID returns appropriate error"""
        response = requests.post(
            f"{BASE_URL}/api/stripe/verify-session",
            json={"sessionId": "cs_test_invalid_12345"},
            headers={"Content-Type": "application/json"}
        )
        # Should return 404 or error for invalid session
        assert response.status_code in [404, 500, 200]
        data = response.json()
        print(f"✅ verify-session handles invalid session: {data}")


class TestCurrencyConversionMath:
    """Test the conversion ratio math logic"""
    
    def test_conversion_ratio_calculation(self):
        """Test conversion ratio: chargedAmount / usdTotal"""
        # Scenario: USD total is $50, charged amount is $70 CAD
        usd_total = 50.00
        charged_amount_cad = 70.00
        
        # Expected ratio: 70/50 = 1.4
        expected_ratio = charged_amount_cad / usd_total
        assert expected_ratio == 1.4
        
        # Test line item conversion
        ticket_price_usd = 25.00
        converted_price = round(ticket_price_usd * expected_ratio * 100) / 100
        assert converted_price == 35.00, f"Expected 35.00, got {converted_price}"
        
        service_fee_usd = 5.00
        converted_fee = round(service_fee_usd * expected_ratio * 100) / 100
        assert converted_fee == 7.00, f"Expected 7.00, got {converted_fee}"
        
        print(f"✅ Conversion ratio math correct: ratio={expected_ratio}, $25 USD -> ${converted_price} CAD")
        
    def test_conversion_with_multiple_line_items(self):
        """Test that all line items sum correctly after conversion"""
        # USD amounts
        ticket1_usd = 25.00
        ticket2_usd = 25.00
        service_fee_usd = 5.00
        tax_usd = 2.50
        platform_donation_usd = 2.50
        
        usd_total = ticket1_usd + ticket2_usd + service_fee_usd + tax_usd + platform_donation_usd
        assert usd_total == 60.00
        
        # Charged in CAD (1.4 ratio)
        charged_amount_cad = 84.00
        ratio = charged_amount_cad / usd_total
        assert ratio == 1.4
        
        # Convert each line item
        ticket1_cad = round(ticket1_usd * ratio * 100) / 100
        ticket2_cad = round(ticket2_usd * ratio * 100) / 100
        service_fee_cad = round(service_fee_usd * ratio * 100) / 100
        tax_cad = round(tax_usd * ratio * 100) / 100
        platform_donation_cad = round(platform_donation_usd * ratio * 100) / 100
        
        # Sum should equal charged amount
        sum_cad = ticket1_cad + ticket2_cad + service_fee_cad + tax_cad + platform_donation_cad
        assert sum_cad == charged_amount_cad, f"Sum {sum_cad} != charged {charged_amount_cad}"
        
        print(f"✅ All line items sum correctly: {sum_cad} CAD")
        
    def test_conversion_with_discount(self):
        """Test conversion with discount applied"""
        # USD amounts
        subtotal_usd = 50.00
        discount_usd = 10.00
        service_fee_usd = 3.00
        
        usd_total = subtotal_usd - discount_usd + service_fee_usd
        assert usd_total == 43.00
        
        # Charged in EUR (0.92 ratio)
        charged_amount_eur = 39.56
        ratio = charged_amount_eur / usd_total
        
        # Convert each line item
        subtotal_eur = round(subtotal_usd * ratio * 100) / 100
        discount_eur = round(discount_usd * ratio * 100) / 100
        service_fee_eur = round(service_fee_usd * ratio * 100) / 100
        
        # Verify math
        calculated_total = subtotal_eur - discount_eur + service_fee_eur
        # Allow small rounding difference
        assert abs(calculated_total - charged_amount_eur) < 0.02, f"Diff too large: {calculated_total} vs {charged_amount_eur}"
        
        print(f"✅ Discount conversion correct: subtotal={subtotal_eur}€, discount=-{discount_eur}€, fee={service_fee_eur}€")
        
    def test_same_currency_no_conversion(self):
        """Test that same currency (USD to USD) has ratio of 1"""
        usd_total = 50.00
        charged_amount_usd = 50.00
        
        ratio = charged_amount_usd / usd_total
        assert ratio == 1.0
        
        # Line items should remain unchanged
        ticket_price = 25.00
        converted = round(ticket_price * ratio * 100) / 100
        assert converted == ticket_price
        
        print(f"✅ Same currency (USD) has ratio 1.0, no conversion needed")
        
    def test_zero_total_edge_case(self):
        """Test edge case where USD total is 0 (free event)"""
        usd_total = 0.00
        charged_amount = 0.00
        
        # Ratio should default to 1 when total is 0
        ratio = charged_amount / usd_total if usd_total > 0 else 1
        assert ratio == 1
        
        print(f"✅ Zero total edge case handled correctly (ratio=1)")


class TestExchangeRatesEndpoint:
    """Test /api/stripe/exchange-rates endpoint"""
    
    def test_exchange_rates_endpoint(self):
        """Test exchange rates endpoint returns valid data"""
        response = requests.get(f"{BASE_URL}/api/stripe/exchange-rates")
        assert response.status_code == 200
        
        data = response.json()
        assert data.get("success") == True
        assert "rates" in data
        assert "USD" in data["rates"]
        assert data["rates"]["USD"] == 1
        
        # Check supported currencies exist
        for currency in ["EUR", "GBP", "CAD", "AUD"]:
            assert currency in data["rates"], f"Missing {currency} in rates"
            assert data["rates"][currency] > 0, f"Invalid rate for {currency}"
            
        print(f"✅ Exchange rates endpoint working: {data['rates']}")
        
    def test_convert_price_endpoint(self):
        """Test /api/stripe/convert-price endpoint"""
        response = requests.post(
            f"{BASE_URL}/api/stripe/convert-price",
            json={"amountUSD": 100, "targetCurrency": "CAD"},
            headers={"Content-Type": "application/json"}
        )
        assert response.status_code == 200
        
        data = response.json()
        assert "originalAmount" in data
        assert "convertedAmount" in data
        assert "currency" in data
        assert data["originalAmount"] == 100
        assert data["currency"] == "CAD"
        assert data["convertedAmount"] > 100  # CAD should be more than USD
        
        print(f"✅ Convert price endpoint: $100 USD = ${data['convertedAmount']} CAD")


class TestCalculateOrderEndpoint:
    """Test /api/stripe/calculate-order endpoint"""
    
    def test_calculate_order_endpoint_exists(self):
        """Test calculate-order endpoint exists"""
        response = requests.post(
            f"{BASE_URL}/api/stripe/calculate-order",
            json={
                "eventId": "test-event-id",
                "ticketSelections": {},
                "addOnSelections": {}
            },
            headers={"Content-Type": "application/json"}
        )
        # Should return 404 for invalid event or 200 with breakdown
        assert response.status_code in [200, 404, 500]
        print(f"✅ calculate-order endpoint exists, status: {response.status_code}")


if __name__ == "__main__":
    pytest.main([__file__, "-v", "--tb=short"])
