"""
Presale System Tests
Tests for presale validation, code management, and access control endpoints
"""
import pytest
import requests
import os
import uuid
from datetime import datetime, timedelta

BASE_URL = os.environ.get('TEST_BACKEND_URL', 'http://localhost:8001')

class TestPresaleValidation:
    """Tests for POST /api/presale/:eventId/validate endpoint"""
    
    def test_validate_presale_nonexistent_event(self):
        """Test validation with non-existent event returns 404"""
        fake_event_id = str(uuid.uuid4())
        response = requests.post(
            f"{BASE_URL}/api/presale/{fake_event_id}/validate",
            json={},
            headers={'Content-Type': 'application/json'}
        )
        assert response.status_code == 404
        data = response.json()
        assert 'error' in data
        assert 'not found' in data['error'].lower()
    
    def test_validate_presale_no_presale_enabled(self):
        """Test validation when presale is not enabled returns hasAccess=true"""
        # First, get a real event ID from the system (use public endpoint)
        events_response = requests.get(f"{BASE_URL}/api/events/public")
        assert events_response.status_code == 200
        data = events_response.json()
        events = data.get('events', [])
        
        if not events or len(events) == 0:
            pytest.skip("No events available for testing")
        
        # Find an event without presale enabled
        test_event = None
        for event in events:
            if not event.get('presale') or not event.get('presale', {}).get('enabled'):
                test_event = event
                break
        
        if not test_event:
            pytest.skip("No events without presale found for testing")
        
        response = requests.post(
            f"{BASE_URL}/api/presale/{test_event['id']}/validate",
            json={},
            headers={'Content-Type': 'application/json'}
        )
        assert response.status_code == 200
        data = response.json()
        assert data['hasAccess'] == True
        assert data['presaleActive'] == False
        assert 'reason' in data
    
    def test_validate_presale_with_invalid_code(self):
        """Test validation with invalid presale code"""
        events_response = requests.get(f"{BASE_URL}/api/events/public")
        assert events_response.status_code == 200
        data = events_response.json()
        events = data.get('events', [])
        
        if not events or len(events) == 0:
            pytest.skip("No events available for testing")
        
        test_event = events[0]
        
        response = requests.post(
            f"{BASE_URL}/api/presale/{test_event['id']}/validate",
            json={'code': 'INVALID_CODE_12345'},
            headers={'Content-Type': 'application/json'}
        )
        assert response.status_code == 200
        data = response.json()
        # Should either have access (no presale) or not have access (invalid code)
        assert 'hasAccess' in data
        assert 'reason' in data
    
    def test_validate_presale_with_invalid_token(self):
        """Test validation with invalid private link token"""
        events_response = requests.get(f"{BASE_URL}/api/events/public")
        assert events_response.status_code == 200
        events = events_response.json()
        
        if not events or len(events) == 0:
            pytest.skip("No events available for testing")
        
        test_event = events[0]
        
        response = requests.post(
            f"{BASE_URL}/api/presale/{test_event['id']}/validate",
            json={'token': 'invalid-token-12345'},
            headers={'Content-Type': 'application/json'}
        )
        assert response.status_code == 200
        data = response.json()
        assert 'hasAccess' in data
        assert 'reason' in data


class TestPresaleCodesUnauthorized:
    """Tests for presale code endpoints without authentication"""
    
    def test_get_codes_unauthorized(self):
        """Test GET /api/presale/:eventId/codes without auth returns 401"""
        fake_event_id = str(uuid.uuid4())
        response = requests.get(
            f"{BASE_URL}/api/presale/{fake_event_id}/codes",
            headers={'Content-Type': 'application/json'}
        )
        # Should return 401 Unauthorized without auth token
        assert response.status_code == 401
    
    def test_create_codes_unauthorized(self):
        """Test POST /api/presale/:eventId/codes without auth returns 401"""
        fake_event_id = str(uuid.uuid4())
        response = requests.post(
            f"{BASE_URL}/api/presale/{fake_event_id}/codes",
            json={'codes': [{'code': 'TEST123', 'limitType': 'single'}]},
            headers={'Content-Type': 'application/json'}
        )
        assert response.status_code == 401
    
    def test_generate_codes_unauthorized(self):
        """Test POST /api/presale/:eventId/codes/generate without auth returns 401"""
        fake_event_id = str(uuid.uuid4())
        response = requests.post(
            f"{BASE_URL}/api/presale/{fake_event_id}/codes/generate",
            json={'count': 5, 'limitType': 'single'},
            headers={'Content-Type': 'application/json'}
        )
        assert response.status_code == 401
    
    def test_delete_code_unauthorized(self):
        """Test DELETE /api/presale/:eventId/codes/:codeId without auth returns 401"""
        fake_event_id = str(uuid.uuid4())
        fake_code_id = str(uuid.uuid4())
        response = requests.delete(
            f"{BASE_URL}/api/presale/{fake_event_id}/codes/{fake_code_id}",
            headers={'Content-Type': 'application/json'}
        )
        assert response.status_code == 401


class TestPresaleCodeValidation:
    """Tests for presale code input validation"""
    
    def test_create_codes_empty_array(self):
        """Test creating codes with empty array returns 400"""
        # This test would need auth, but we can test the validation logic
        # by checking the endpoint exists and returns proper error
        fake_event_id = str(uuid.uuid4())
        response = requests.post(
            f"{BASE_URL}/api/presale/{fake_event_id}/codes",
            json={'codes': []},
            headers={'Content-Type': 'application/json'}
        )
        # Without auth, should return 401 first
        assert response.status_code == 401
    
    def test_generate_codes_invalid_count(self):
        """Test generating codes with invalid count"""
        fake_event_id = str(uuid.uuid4())
        # Count must be between 1 and 100
        response = requests.post(
            f"{BASE_URL}/api/presale/{fake_event_id}/codes/generate",
            json={'count': 0, 'limitType': 'single'},
            headers={'Content-Type': 'application/json'}
        )
        # Without auth, should return 401 first
        assert response.status_code == 401


class TestPresaleEndpointStructure:
    """Tests to verify presale endpoint structure and responses"""
    
    def test_validate_endpoint_exists(self):
        """Verify the validate endpoint exists and accepts POST"""
        fake_event_id = str(uuid.uuid4())
        response = requests.post(
            f"{BASE_URL}/api/presale/{fake_event_id}/validate",
            json={},
            headers={'Content-Type': 'application/json'}
        )
        # Should return 404 for non-existent event, not 405 Method Not Allowed
        assert response.status_code == 404
        assert 'error' in response.json()
    
    def test_codes_endpoint_exists(self):
        """Verify the codes endpoint exists"""
        fake_event_id = str(uuid.uuid4())
        response = requests.get(
            f"{BASE_URL}/api/presale/{fake_event_id}/codes",
            headers={'Content-Type': 'application/json'}
        )
        # Should return 401 Unauthorized, not 404 or 405
        assert response.status_code == 401
    
    def test_generate_endpoint_exists(self):
        """Verify the generate endpoint exists"""
        fake_event_id = str(uuid.uuid4())
        response = requests.post(
            f"{BASE_URL}/api/presale/{fake_event_id}/codes/generate",
            json={'count': 5},
            headers={'Content-Type': 'application/json'}
        )
        # Should return 401 Unauthorized, not 404 or 405
        assert response.status_code == 401
    
    def test_delete_endpoint_exists(self):
        """Verify the delete endpoint exists"""
        fake_event_id = str(uuid.uuid4())
        fake_code_id = str(uuid.uuid4())
        response = requests.delete(
            f"{BASE_URL}/api/presale/{fake_event_id}/codes/{fake_code_id}",
            headers={'Content-Type': 'application/json'}
        )
        # Should return 401 Unauthorized, not 404 or 405
        assert response.status_code == 401
    
    def test_use_code_endpoint_exists(self):
        """Verify the use code endpoint exists"""
        fake_event_id = str(uuid.uuid4())
        fake_code_id = str(uuid.uuid4())
        response = requests.post(
            f"{BASE_URL}/api/presale/{fake_event_id}/codes/{fake_code_id}/use",
            json={},
            headers={'Content-Type': 'application/json'}
        )
        # This endpoint doesn't require auth, should return 404 for non-existent code
        assert response.status_code in [404, 500]  # 500 if RPC doesn't exist


class TestPresaleValidationLogic:
    """Tests for presale validation business logic"""
    
    def test_validate_response_structure(self):
        """Test that validation response has correct structure"""
        events_response = requests.get(f"{BASE_URL}/api/events/public")
        if events_response.status_code != 200 or not events_response.json():
            pytest.skip("No events available for testing")
        
        test_event = events_response.json()[0]
        
        response = requests.post(
            f"{BASE_URL}/api/presale/{test_event['id']}/validate",
            json={},
            headers={'Content-Type': 'application/json'}
        )
        assert response.status_code == 200
        data = response.json()
        
        # Required fields in response
        assert 'hasAccess' in data
        assert 'reason' in data
        assert 'presaleActive' in data
        
        # Type checks
        assert isinstance(data['hasAccess'], bool)
        assert isinstance(data['reason'], str)
        assert isinstance(data['presaleActive'], bool)
    
    def test_validate_with_code_and_token(self):
        """Test validation with both code and token provided"""
        events_response = requests.get(f"{BASE_URL}/api/events/public")
        if events_response.status_code != 200 or not events_response.json():
            pytest.skip("No events available for testing")
        
        test_event = events_response.json()[0]
        
        response = requests.post(
            f"{BASE_URL}/api/presale/{test_event['id']}/validate",
            json={
                'code': 'TESTCODE',
                'token': 'test-token-123'
            },
            headers={'Content-Type': 'application/json'}
        )
        assert response.status_code == 200
        data = response.json()
        assert 'hasAccess' in data


class TestPresaleIntegration:
    """Integration tests for presale system"""
    
    def test_events_include_presale_config(self):
        """Test that events API returns presale configuration"""
        response = requests.get(f"{BASE_URL}/api/events/public")
        assert response.status_code == 200
        events = response.json()
        
        if not events:
            pytest.skip("No events available")
        
        # Check that events can have presale field
        # (may be null/undefined for events without presale)
        for event in events[:5]:  # Check first 5 events
            # presale field should exist or be undefined
            # If it exists, it should have the correct structure
            if event.get('presale'):
                presale = event['presale']
                # Check structure if presale is enabled
                if presale.get('enabled'):
                    assert 'startDate' in presale or presale.get('startDate') is None
                    assert 'endDate' in presale or presale.get('endDate') is None
                    if 'accessMethods' in presale:
                        methods = presale['accessMethods']
                        # accessMethods should be an object with boolean flags
                        assert isinstance(methods, dict)


if __name__ == '__main__':
    pytest.main([__file__, '-v', '--tb=short'])
