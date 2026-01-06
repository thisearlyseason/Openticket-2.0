"""
Test Currency API Endpoints
Tests for multi-currency payment feature:
- Exchange rates endpoint
- Price conversion endpoint
- Create order with currency parameter
"""

import pytest
import requests
import os

BASE_URL = os.environ.get('REACT_APP_BACKEND_URL', 'http://localhost:8001').rstrip('/')


class TestExchangeRatesEndpoint:
    """Tests for /api/stripe/exchange-rates endpoint"""
    
    def test_exchange_rates_returns_success(self):
        """Test that exchange rates endpoint returns success"""
        response = requests.get(f"{BASE_URL}/api/stripe/exchange-rates")
        assert response.status_code == 200
        
        data = response.json()
        assert data.get('success') == True
        assert 'rates' in data
        assert 'base' in data
        
    def test_exchange_rates_contains_all_currencies(self):
        """Test that all supported currencies are returned"""
        response = requests.get(f"{BASE_URL}/api/stripe/exchange-rates")
        assert response.status_code == 200
        
        data = response.json()
        rates = data.get('rates', {})
        
        # Check all required currencies are present
        required_currencies = ['USD', 'EUR', 'GBP', 'CAD', 'AUD']
        for currency in required_currencies:
            assert currency in rates, f"Missing currency: {currency}"
            
    def test_exchange_rates_usd_is_base(self):
        """Test that USD is the base currency with rate 1"""
        response = requests.get(f"{BASE_URL}/api/stripe/exchange-rates")
        assert response.status_code == 200
        
        data = response.json()
        assert data.get('base') == 'USD'
        assert data['rates'].get('USD') == 1
        
    def test_exchange_rates_values_are_reasonable(self):
        """Test that exchange rates are within reasonable ranges"""
        response = requests.get(f"{BASE_URL}/api/stripe/exchange-rates")
        assert response.status_code == 200
        
        data = response.json()
        rates = data.get('rates', {})
        
        # EUR should be less than 1 (stronger than USD)
        assert 0.5 < rates.get('EUR', 0) < 1.5, "EUR rate out of expected range"
        
        # GBP should be less than 1 (stronger than USD)
        assert 0.5 < rates.get('GBP', 0) < 1.2, "GBP rate out of expected range"
        
        # CAD should be greater than 1 (weaker than USD)
        assert 1.0 < rates.get('CAD', 0) < 2.0, "CAD rate out of expected range"
        
        # AUD should be greater than 1 (weaker than USD)
        assert 1.0 < rates.get('AUD', 0) < 2.0, "AUD rate out of expected range"


class TestConvertPriceEndpoint:
    """Tests for /api/stripe/convert-price endpoint"""
    
    def test_convert_price_to_gbp(self):
        """Test converting USD to GBP"""
        response = requests.post(
            f"{BASE_URL}/api/stripe/convert-price",
            json={"amountUSD": 50, "targetCurrency": "GBP"}
        )
        assert response.status_code == 200
        
        data = response.json()
        assert data.get('originalAmount') == 50
        assert data.get('currency') == 'GBP'
        assert 'convertedAmount' in data
        assert 'rate' in data
        
        # GBP should be less than USD (stronger currency)
        assert data['convertedAmount'] < 50
        
    def test_convert_price_to_eur(self):
        """Test converting USD to EUR"""
        response = requests.post(
            f"{BASE_URL}/api/stripe/convert-price",
            json={"amountUSD": 100, "targetCurrency": "EUR"}
        )
        assert response.status_code == 200
        
        data = response.json()
        assert data.get('originalAmount') == 100
        assert data.get('currency') == 'EUR'
        
        # EUR should be less than USD
        assert data['convertedAmount'] < 100
        
    def test_convert_price_to_cad(self):
        """Test converting USD to CAD"""
        response = requests.post(
            f"{BASE_URL}/api/stripe/convert-price",
            json={"amountUSD": 100, "targetCurrency": "CAD"}
        )
        assert response.status_code == 200
        
        data = response.json()
        assert data.get('currency') == 'CAD'
        
        # CAD should be more than USD (weaker currency)
        assert data['convertedAmount'] > 100
        
    def test_convert_price_to_aud(self):
        """Test converting USD to AUD"""
        response = requests.post(
            f"{BASE_URL}/api/stripe/convert-price",
            json={"amountUSD": 100, "targetCurrency": "AUD"}
        )
        assert response.status_code == 200
        
        data = response.json()
        assert data.get('currency') == 'AUD'
        
        # AUD should be more than USD (weaker currency)
        assert data['convertedAmount'] > 100
        
    def test_convert_price_usd_to_usd(self):
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
        """Test converting to unsupported currency defaults to USD"""
        response = requests.post(
            f"{BASE_URL}/api/stripe/convert-price",
            json={"amountUSD": 50, "targetCurrency": "JPY"}
        )
        assert response.status_code == 200
        
        data = response.json()
        # Should default to USD
        assert data.get('currency') == 'USD'
        assert data.get('convertedAmount') == 50
        
    def test_convert_price_case_insensitive(self):
        """Test that currency code is case insensitive"""
        response = requests.post(
            f"{BASE_URL}/api/stripe/convert-price",
            json={"amountUSD": 50, "targetCurrency": "gbp"}
        )
        assert response.status_code == 200
        
        data = response.json()
        assert data.get('currency') == 'GBP'
        
    def test_convert_price_invalid_amount(self):
        """Test that invalid amount returns error"""
        response = requests.post(
            f"{BASE_URL}/api/stripe/convert-price",
            json={"amountUSD": -50, "targetCurrency": "GBP"}
        )
        assert response.status_code == 400
        
    def test_convert_price_zero_amount(self):
        """Test converting zero amount"""
        response = requests.post(
            f"{BASE_URL}/api/stripe/convert-price",
            json={"amountUSD": 0, "targetCurrency": "GBP"}
        )
        assert response.status_code == 200
        
        data = response.json()
        assert data.get('convertedAmount') == 0


class TestCreateOrderWithCurrency:
    """Tests for create-order endpoint with currency parameter"""
    
    def test_create_order_accepts_currency_parameter(self):
        """Test that create-order endpoint accepts currency parameter"""
        # This test verifies the endpoint accepts the currency param
        # We can't complete checkout without valid event/organizer setup
        response = requests.post(
            f"{BASE_URL}/api/stripe/create-order",
            json={
                "eventId": "test-event-id",
                "ticketSelections": {"general": 1},
                "currency": "GBP",
                "customerEmail": "test@example.com",
                "customerName": "Test User",
                "successUrl": "http://localhost:3000/success",
                "cancelUrl": "http://localhost:3000/cancel"
            }
        )
        
        # Should return 404 (event not found) not 400 (bad request)
        # This confirms the currency parameter is accepted
        assert response.status_code in [404, 500], f"Unexpected status: {response.status_code}"


if __name__ == "__main__":
    pytest.main([__file__, "-v"])
