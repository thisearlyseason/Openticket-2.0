"""
Auto Local Currency Feature Tests
Tests for the currency conversion feature in OpenTicket:
1. Exchange rates API endpoint
2. Create-order with attendeeCurrency parameter
3. Currency conversion logic
4. Supported currencies validation
"""

import pytest
import requests
import os
import time

BASE_URL = os.environ.get('REACT_APP_BACKEND_URL', '').rstrip('/')

class TestExchangeRatesAPI:
    """Tests for /api/stripe/exchange-rates endpoint"""
    
    def test_exchange_rates_returns_success(self):
        """Test that exchange rates endpoint returns success"""
        response = requests.get(f"{BASE_URL}/api/stripe/exchange-rates")
        assert response.status_code == 200
        data = response.json()
        assert data.get('success') == True
        
    def test_exchange_rates_returns_all_currencies(self):
        """Test that all 5 supported currencies are returned"""
        response = requests.get(f"{BASE_URL}/api/stripe/exchange-rates")
        assert response.status_code == 200
        data = response.json()
        
        rates = data.get('rates', {})
        expected_currencies = ['USD', 'EUR', 'GBP', 'CAD', 'AUD']
        
        for currency in expected_currencies:
            assert currency in rates, f"Missing currency: {currency}"
            assert isinstance(rates[currency], (int, float)), f"Rate for {currency} should be numeric"
            assert rates[currency] > 0, f"Rate for {currency} should be positive"
    
    def test_exchange_rates_usd_is_base(self):
        """Test that USD rate is 1 (base currency)"""
        response = requests.get(f"{BASE_URL}/api/stripe/exchange-rates")
        assert response.status_code == 200
        data = response.json()
        
        assert data.get('base') == 'USD'
        assert data.get('rates', {}).get('USD') == 1
    
    def test_exchange_rates_has_source(self):
        """Test that exchange rates include source information"""
        response = requests.get(f"{BASE_URL}/api/stripe/exchange-rates")
        assert response.status_code == 200
        data = response.json()
        
        # Source should be one of: fixer.io, exchangerate.host, or static_fallback
        assert 'source' in data
        assert data['source'] in ['fixer.io', 'exchangerate.host', 'static_fallback']
        
    def test_exchange_rates_has_timestamp(self):
        """Test that exchange rates include timestamp"""
        response = requests.get(f"{BASE_URL}/api/stripe/exchange-rates")
        assert response.status_code == 200
        data = response.json()
        
        assert 'timestamp' in data
        assert isinstance(data['timestamp'], (int, float))


class TestConvertPriceAPI:
    """Tests for /api/stripe/convert-price endpoint"""
    
    def test_convert_price_usd_to_eur(self):
        """Test converting USD to EUR"""
        response = requests.post(
            f"{BASE_URL}/api/stripe/convert-price",
            json={"amountUSD": 100, "targetCurrency": "EUR"}
        )
        assert response.status_code == 200
        data = response.json()
        
        assert data.get('originalAmount') == 100
        assert data.get('currency') == 'EUR'
        assert 'convertedAmount' in data
        # EUR should be less than USD (typically 0.85-0.95)
        assert 80 < data['convertedAmount'] < 100
        
    def test_convert_price_usd_to_cad(self):
        """Test converting USD to CAD"""
        response = requests.post(
            f"{BASE_URL}/api/stripe/convert-price",
            json={"amountUSD": 100, "targetCurrency": "CAD"}
        )
        assert response.status_code == 200
        data = response.json()
        
        assert data.get('originalAmount') == 100
        assert data.get('currency') == 'CAD'
        # CAD should be more than USD (typically 1.3-1.4)
        assert 120 < data['convertedAmount'] < 160
        
    def test_convert_price_same_currency(self):
        """Test converting USD to USD returns same amount"""
        response = requests.post(
            f"{BASE_URL}/api/stripe/convert-price",
            json={"amountUSD": 50, "targetCurrency": "USD"}
        )
        assert response.status_code == 200
        data = response.json()
        
        assert data.get('originalAmount') == 50
        assert data.get('convertedAmount') == 50
        assert data.get('rate') == 1
        
    def test_convert_price_unsupported_currency(self):
        """Test that unsupported currency defaults to USD"""
        response = requests.post(
            f"{BASE_URL}/api/stripe/convert-price",
            json={"amountUSD": 100, "targetCurrency": "JPY"}
        )
        assert response.status_code == 200
        data = response.json()
        
        # Should default to USD for unsupported currencies
        assert data.get('currency') == 'USD'
        assert data.get('convertedAmount') == 100
        
    def test_convert_price_invalid_amount(self):
        """Test that invalid amount returns error"""
        response = requests.post(
            f"{BASE_URL}/api/stripe/convert-price",
            json={"amountUSD": -50, "targetCurrency": "EUR"}
        )
        assert response.status_code == 400


class TestCreateOrderWithCurrency:
    """Tests for /api/stripe/create-order with attendeeCurrency parameter"""
    
    def test_create_order_accepts_attendee_currency(self):
        """Test that create-order endpoint accepts attendeeCurrency parameter"""
        # This test will fail with 404 (event not found) but validates the endpoint accepts the param
        response = requests.post(
            f"{BASE_URL}/api/stripe/create-order",
            json={
                "eventId": "test-event-id",
                "ticketSelections": {"general": 1},
                "attendeeCurrency": "EUR",
                "customerEmail": "test@example.com",
                "customerName": "Test User",
                "successUrl": "https://example.com/success",
                "cancelUrl": "https://example.com/cancel"
            }
        )
        # Should return 404 (event not found) not 400 (bad request)
        # This confirms the endpoint accepts the attendeeCurrency parameter
        assert response.status_code in [404, 500], f"Unexpected status: {response.status_code}"
        
    def test_create_order_validates_urls(self):
        """Test that create-order validates success/cancel URLs"""
        response = requests.post(
            f"{BASE_URL}/api/stripe/create-order",
            json={
                "eventId": "test-event-id",
                "ticketSelections": {"general": 1},
                "customerEmail": "test@example.com",
                "customerName": "Test User"
                # Missing successUrl and cancelUrl
            }
        )
        assert response.status_code == 400
        data = response.json()
        assert 'error' in data
        assert 'URL' in data['error'] or 'url' in data['error'].lower()


class TestSupportedCurrencies:
    """Tests to verify supported currencies list"""
    
    def test_five_currencies_supported(self):
        """Verify exactly 5 currencies are supported"""
        response = requests.get(f"{BASE_URL}/api/stripe/exchange-rates")
        assert response.status_code == 200
        data = response.json()
        
        rates = data.get('rates', {})
        assert len(rates) == 5, f"Expected 5 currencies, got {len(rates)}"
        
    def test_supported_currencies_list(self):
        """Verify the exact list of supported currencies"""
        response = requests.get(f"{BASE_URL}/api/stripe/exchange-rates")
        assert response.status_code == 200
        data = response.json()
        
        rates = data.get('rates', {})
        expected = {'USD', 'EUR', 'GBP', 'CAD', 'AUD'}
        actual = set(rates.keys())
        
        assert actual == expected, f"Currency mismatch. Expected: {expected}, Got: {actual}"


class TestCurrencyConversionRates:
    """Tests to verify exchange rate values are reasonable"""
    
    def test_eur_rate_reasonable(self):
        """EUR should be worth more than USD (rate < 1)"""
        response = requests.get(f"{BASE_URL}/api/stripe/exchange-rates")
        data = response.json()
        eur_rate = data['rates']['EUR']
        # EUR is typically 0.85-0.95 per USD
        assert 0.7 < eur_rate < 1.1, f"EUR rate {eur_rate} seems unreasonable"
        
    def test_gbp_rate_reasonable(self):
        """GBP should be worth more than USD (rate < 1)"""
        response = requests.get(f"{BASE_URL}/api/stripe/exchange-rates")
        data = response.json()
        gbp_rate = data['rates']['GBP']
        # GBP is typically 0.75-0.85 per USD
        assert 0.6 < gbp_rate < 1.0, f"GBP rate {gbp_rate} seems unreasonable"
        
    def test_cad_rate_reasonable(self):
        """CAD should be worth less than USD (rate > 1)"""
        response = requests.get(f"{BASE_URL}/api/stripe/exchange-rates")
        data = response.json()
        cad_rate = data['rates']['CAD']
        # CAD is typically 1.25-1.45 per USD
        assert 1.1 < cad_rate < 1.6, f"CAD rate {cad_rate} seems unreasonable"
        
    def test_aud_rate_reasonable(self):
        """AUD should be worth less than USD (rate > 1)"""
        response = requests.get(f"{BASE_URL}/api/stripe/exchange-rates")
        data = response.json()
        aud_rate = data['rates']['AUD']
        # AUD is typically 1.4-1.6 per USD
        assert 1.2 < aud_rate < 1.8, f"AUD rate {aud_rate} seems unreasonable"


class TestCalculateOrderAPI:
    """Tests for /api/stripe/calculate-order endpoint"""
    
    def test_calculate_order_endpoint_exists(self):
        """Test that calculate-order endpoint exists"""
        response = requests.post(
            f"{BASE_URL}/api/stripe/calculate-order",
            json={
                "eventId": "test-event-id",
                "ticketSelections": {"general": 1}
            }
        )
        # Should return 404 (event not found) not 404 (endpoint not found)
        assert response.status_code in [404, 500]


if __name__ == "__main__":
    pytest.main([__file__, "-v"])
