"""
Test Email Provider API Endpoints
Tests for the email delivery configuration feature:
- GET /api/email/status - Check email service status
- POST /api/email/send - Send email (simulated when credentials not configured)
- POST /api/email/send-bulk - Send bulk emails
"""
import pytest
import requests
import os

BASE_URL = os.environ.get('REACT_APP_BACKEND_URL', 'http://localhost:8001').rstrip('/')


class TestEmailStatus:
    """Tests for /api/email/status endpoint"""
    
    def test_email_status_returns_200(self):
        """Test that email status endpoint returns 200"""
        response = requests.get(f"{BASE_URL}/api/email/status")
        assert response.status_code == 200
        print(f"✅ GET /api/email/status returned 200")
    
    def test_email_status_returns_provider_info(self):
        """Test that email status returns provider information"""
        response = requests.get(f"{BASE_URL}/api/email/status")
        assert response.status_code == 200
        
        data = response.json()
        # Check required fields exist
        assert "configured" in data, "Response should have 'configured' field"
        assert "available" in data, "Response should have 'available' field"
        assert "provider" in data, "Response should have 'provider' field"
        assert "message" in data, "Response should have 'message' field"
        
        # Provider should be openticket_mailer
        assert data["provider"] == "openticket_mailer", f"Provider should be 'openticket_mailer', got '{data['provider']}'"
        print(f"✅ Email status returns correct provider info: {data}")
    
    def test_email_status_configured_is_boolean(self):
        """Test that configured field is a boolean"""
        response = requests.get(f"{BASE_URL}/api/email/status")
        data = response.json()
        
        assert isinstance(data["configured"], bool), "configured should be a boolean"
        assert isinstance(data["available"], bool), "available should be a boolean"
        print(f"✅ configured={data['configured']}, available={data['available']}")


class TestEmailSend:
    """Tests for /api/email/send endpoint"""
    
    def test_email_send_requires_fields(self):
        """Test that email send requires to, subject, html fields"""
        response = requests.post(f"{BASE_URL}/api/email/send", json={})
        assert response.status_code == 400
        
        data = response.json()
        assert "error" in data
        print(f"✅ POST /api/email/send returns 400 for missing fields: {data['error']}")
    
    def test_email_send_missing_to(self):
        """Test that email send fails without 'to' field"""
        response = requests.post(f"{BASE_URL}/api/email/send", json={
            "subject": "Test Subject",
            "html": "<p>Test content</p>"
        })
        assert response.status_code == 400
        print(f"✅ POST /api/email/send returns 400 when 'to' is missing")
    
    def test_email_send_missing_subject(self):
        """Test that email send fails without 'subject' field"""
        response = requests.post(f"{BASE_URL}/api/email/send", json={
            "to": "test@example.com",
            "html": "<p>Test content</p>"
        })
        assert response.status_code == 400
        print(f"✅ POST /api/email/send returns 400 when 'subject' is missing")
    
    def test_email_send_missing_html(self):
        """Test that email send fails without 'html' field"""
        response = requests.post(f"{BASE_URL}/api/email/send", json={
            "to": "test@example.com",
            "subject": "Test Subject"
        })
        assert response.status_code == 400
        print(f"✅ POST /api/email/send returns 400 when 'html' is missing")
    
    def test_email_send_simulated_success(self):
        """Test that email send returns simulated success when credentials not configured"""
        response = requests.post(f"{BASE_URL}/api/email/send", json={
            "to": "test@example.com",
            "subject": "Test Email Subject",
            "html": "<p>This is a test email</p>"
        })
        assert response.status_code == 200
        
        data = response.json()
        assert data["success"] == True, "success should be True"
        assert data.get("simulated") == True, "simulated should be True when credentials not configured"
        assert "messageId" in data, "Response should have messageId"
        print(f"✅ POST /api/email/send returns simulated success: {data}")
    
    def test_email_send_with_text_content(self):
        """Test that email send accepts optional text content"""
        response = requests.post(f"{BASE_URL}/api/email/send", json={
            "to": "test@example.com",
            "subject": "Test Email Subject",
            "html": "<p>This is a test email</p>",
            "text": "This is a test email"
        })
        assert response.status_code == 200
        
        data = response.json()
        assert data["success"] == True
        print(f"✅ POST /api/email/send accepts optional text content")


class TestEmailSendBulk:
    """Tests for /api/email/send-bulk endpoint"""
    
    def test_bulk_send_requires_recipients(self):
        """Test that bulk send requires recipients array"""
        response = requests.post(f"{BASE_URL}/api/email/send-bulk", json={
            "subject": "Test Subject",
            "html": "<p>Test content</p>"
        })
        assert response.status_code == 400
        
        data = response.json()
        assert "error" in data
        print(f"✅ POST /api/email/send-bulk returns 400 for missing recipients")
    
    def test_bulk_send_requires_non_empty_recipients(self):
        """Test that bulk send requires non-empty recipients array"""
        response = requests.post(f"{BASE_URL}/api/email/send-bulk", json={
            "recipients": [],
            "subject": "Test Subject",
            "html": "<p>Test content</p>"
        })
        assert response.status_code == 400
        print(f"✅ POST /api/email/send-bulk returns 400 for empty recipients array")
    
    def test_bulk_send_simulated_success(self):
        """Test that bulk send returns simulated success when credentials not configured"""
        response = requests.post(f"{BASE_URL}/api/email/send-bulk", json={
            "recipients": ["test1@example.com", "test2@example.com"],
            "subject": "Bulk Test Email",
            "html": "<p>This is a bulk test email</p>"
        })
        assert response.status_code == 200
        
        data = response.json()
        assert data["success"] == True, "success should be True"
        assert data.get("simulated") == True, "simulated should be True when credentials not configured"
        assert data["sent"] == 2, "sent count should match recipients count"
        assert data["failed"] == 0, "failed count should be 0"
        print(f"✅ POST /api/email/send-bulk returns simulated success: {data}")
    
    def test_bulk_send_with_recipient_objects(self):
        """Test that bulk send accepts recipient objects with name and email"""
        response = requests.post(f"{BASE_URL}/api/email/send-bulk", json={
            "recipients": [
                {"email": "test1@example.com", "name": "Test User 1"},
                {"email": "test2@example.com", "name": "Test User 2"}
            ],
            "subject": "Personalized Bulk Email",
            "html": "<p>Hello {{name}}, this is a test email</p>"
        })
        assert response.status_code == 200
        
        data = response.json()
        assert data["success"] == True
        assert data["sent"] == 2
        print(f"✅ POST /api/email/send-bulk accepts recipient objects with name")


if __name__ == "__main__":
    pytest.main([__file__, "-v"])
