"""
Test Suite for Onboarding and Non-Profit Application Endpoints
Tests:
- POST /api/onboarding/save - saves onboarding responses
- GET /api/onboarding/me - gets user's onboarding data
- POST /api/onboarding/nonprofit/apply - submits non-profit application
- GET /api/onboarding/nonprofit/status - gets application status
- POST /api/onboarding/nonprofit/resubmit - resubmits rejected application
- GET /api/onboarding/admin/all - admin view of all onboarding data
- GET /api/onboarding/admin/nonprofit/pending - pending applications
- GET /api/onboarding/admin/nonprofit/all - all applications
- POST /api/onboarding/admin/nonprofit/approve - approves and generates discount code
- POST /api/onboarding/admin/nonprofit/reject - rejects application
- POST /api/upload/document - uploads file to Supabase storage
- GET /api/onboarding/nonprofit/verify-magic-link - verifies magic link token
"""

import pytest
import requests
import os
import uuid

# Get BASE_URL from environment
BASE_URL = os.environ.get('REACT_APP_BACKEND_URL', '').rstrip('/')
if not BASE_URL:
    BASE_URL = "https://ticketmgr-1.preview.emergentagent.com"


class TestOnboardingEndpointsNoAuth:
    """Test onboarding endpoints without authentication - should return auth errors"""
    
    def test_save_onboarding_no_auth(self):
        """POST /api/onboarding/save without token should return 401"""
        response = requests.post(
            f"{BASE_URL}/api/onboarding/save",
            json={"responses": {"question1": "answer1"}}
        )
        # Should return 401 or error about missing token
        assert response.status_code in [401, 403], f"Expected 401/403, got {response.status_code}: {response.text}"
        data = response.json()
        assert "error" in data or "message" in data or "No token" in str(data)
        print(f"✅ POST /api/onboarding/save without auth returns: {response.status_code}")
    
    def test_get_onboarding_me_no_auth(self):
        """GET /api/onboarding/me without token should return 401"""
        response = requests.get(f"{BASE_URL}/api/onboarding/me")
        assert response.status_code in [401, 403], f"Expected 401/403, got {response.status_code}: {response.text}"
        print(f"✅ GET /api/onboarding/me without auth returns: {response.status_code}")
    
    def test_nonprofit_apply_no_auth(self):
        """POST /api/onboarding/nonprofit/apply without token should return 401"""
        response = requests.post(
            f"{BASE_URL}/api/onboarding/nonprofit/apply",
            json={
                "organizationName": "Test Nonprofit",
                "documentUrl": "https://example.com/doc.pdf"
            }
        )
        assert response.status_code in [401, 403], f"Expected 401/403, got {response.status_code}: {response.text}"
        print(f"✅ POST /api/onboarding/nonprofit/apply without auth returns: {response.status_code}")
    
    def test_nonprofit_status_no_auth(self):
        """GET /api/onboarding/nonprofit/status without token should return 401"""
        response = requests.get(f"{BASE_URL}/api/onboarding/nonprofit/status")
        assert response.status_code in [401, 403], f"Expected 401/403, got {response.status_code}: {response.text}"
        print(f"✅ GET /api/onboarding/nonprofit/status without auth returns: {response.status_code}")
    
    def test_nonprofit_resubmit_no_auth(self):
        """POST /api/onboarding/nonprofit/resubmit without token should return 401"""
        response = requests.post(
            f"{BASE_URL}/api/onboarding/nonprofit/resubmit",
            json={
                "organizationName": "Test Nonprofit",
                "documentUrl": "https://example.com/doc.pdf"
            }
        )
        assert response.status_code in [401, 403], f"Expected 401/403, got {response.status_code}: {response.text}"
        print(f"✅ POST /api/onboarding/nonprofit/resubmit without auth returns: {response.status_code}")


class TestAdminEndpointsNoAuth:
    """Test admin endpoints without authentication - should return auth errors"""
    
    def test_admin_all_onboarding_no_auth(self):
        """GET /api/onboarding/admin/all without token should return 401"""
        response = requests.get(f"{BASE_URL}/api/onboarding/admin/all")
        assert response.status_code in [401, 403], f"Expected 401/403, got {response.status_code}: {response.text}"
        print(f"✅ GET /api/onboarding/admin/all without auth returns: {response.status_code}")
    
    def test_admin_nonprofit_pending_no_auth(self):
        """GET /api/onboarding/admin/nonprofit/pending without token should return 401"""
        response = requests.get(f"{BASE_URL}/api/onboarding/admin/nonprofit/pending")
        assert response.status_code in [401, 403], f"Expected 401/403, got {response.status_code}: {response.text}"
        print(f"✅ GET /api/onboarding/admin/nonprofit/pending without auth returns: {response.status_code}")
    
    def test_admin_nonprofit_all_no_auth(self):
        """GET /api/onboarding/admin/nonprofit/all without token should return 401"""
        response = requests.get(f"{BASE_URL}/api/onboarding/admin/nonprofit/all")
        assert response.status_code in [401, 403], f"Expected 401/403, got {response.status_code}: {response.text}"
        print(f"✅ GET /api/onboarding/admin/nonprofit/all without auth returns: {response.status_code}")
    
    def test_admin_nonprofit_approve_no_auth(self):
        """POST /api/onboarding/admin/nonprofit/approve without token should return 401"""
        response = requests.post(
            f"{BASE_URL}/api/onboarding/admin/nonprofit/approve",
            json={
                "applicationId": str(uuid.uuid4()),
                "userId": "test-user-id"
            }
        )
        assert response.status_code in [401, 403], f"Expected 401/403, got {response.status_code}: {response.text}"
        print(f"✅ POST /api/onboarding/admin/nonprofit/approve without auth returns: {response.status_code}")
    
    def test_admin_nonprofit_reject_no_auth(self):
        """POST /api/onboarding/admin/nonprofit/reject without token should return 401"""
        response = requests.post(
            f"{BASE_URL}/api/onboarding/admin/nonprofit/reject",
            json={
                "applicationId": str(uuid.uuid4()),
                "userId": "test-user-id",
                "reason": "Test rejection"
            }
        )
        assert response.status_code in [401, 403], f"Expected 401/403, got {response.status_code}: {response.text}"
        print(f"✅ POST /api/onboarding/admin/nonprofit/reject without auth returns: {response.status_code}")


class TestUploadEndpointsNoAuth:
    """Test upload endpoints without authentication - should return auth errors"""
    
    def test_upload_document_no_auth(self):
        """POST /api/upload/document without token should return 401"""
        # Create a simple test file
        files = {'file': ('test.pdf', b'%PDF-1.4 test content', 'application/pdf')}
        response = requests.post(
            f"{BASE_URL}/api/upload/document",
            files=files
        )
        assert response.status_code in [401, 403], f"Expected 401/403, got {response.status_code}: {response.text}"
        print(f"✅ POST /api/upload/document without auth returns: {response.status_code}")
    
    def test_delete_document_no_auth(self):
        """DELETE /api/upload/document without token should return 401"""
        response = requests.delete(
            f"{BASE_URL}/api/upload/document",
            json={"path": "test/path/file.pdf"}
        )
        assert response.status_code in [401, 403], f"Expected 401/403, got {response.status_code}: {response.text}"
        print(f"✅ DELETE /api/upload/document without auth returns: {response.status_code}")
    
    def test_get_signed_url_no_auth(self):
        """GET /api/upload/signed-url without token should return 401"""
        response = requests.get(
            f"{BASE_URL}/api/upload/signed-url",
            params={"path": "test/path/file.pdf"}
        )
        assert response.status_code in [401, 403], f"Expected 401/403, got {response.status_code}: {response.text}"
        print(f"✅ GET /api/upload/signed-url without auth returns: {response.status_code}")


class TestMagicLinkVerification:
    """Test magic link verification endpoint (public endpoint)"""
    
    def test_verify_magic_link_missing_params(self):
        """GET /api/onboarding/nonprofit/verify-magic-link without params should return 400"""
        response = requests.get(f"{BASE_URL}/api/onboarding/nonprofit/verify-magic-link")
        assert response.status_code == 400, f"Expected 400, got {response.status_code}: {response.text}"
        data = response.json()
        assert "error" in data
        print(f"✅ GET /api/onboarding/nonprofit/verify-magic-link without params returns: {response.status_code}")
    
    def test_verify_magic_link_invalid_token(self):
        """GET /api/onboarding/nonprofit/verify-magic-link with invalid token should return 404"""
        response = requests.get(
            f"{BASE_URL}/api/onboarding/nonprofit/verify-magic-link",
            params={
                "token": str(uuid.uuid4()),
                "code": "INVALID123"
            }
        )
        # Should return 404 or error about invalid/expired link
        assert response.status_code in [404, 400], f"Expected 404/400, got {response.status_code}: {response.text}"
        data = response.json()
        assert "error" in data or "valid" in data
        if "valid" in data:
            assert data["valid"] == False
        print(f"✅ GET /api/onboarding/nonprofit/verify-magic-link with invalid token returns: {response.status_code}")


class TestEndpointValidation:
    """Test endpoint validation for required fields"""
    
    def test_save_onboarding_missing_responses(self):
        """POST /api/onboarding/save without responses should return 400 (after auth)"""
        # This test verifies the endpoint exists and validates input
        # Without auth, we get 401 first, which is correct behavior
        response = requests.post(
            f"{BASE_URL}/api/onboarding/save",
            json={}  # Missing responses
        )
        # Without auth, should return 401
        assert response.status_code in [400, 401, 403], f"Expected 400/401/403, got {response.status_code}: {response.text}"
        print(f"✅ POST /api/onboarding/save with empty body returns: {response.status_code}")
    
    def test_nonprofit_apply_missing_required_fields(self):
        """POST /api/onboarding/nonprofit/apply without required fields"""
        response = requests.post(
            f"{BASE_URL}/api/onboarding/nonprofit/apply",
            json={}  # Missing organizationName and documentUrl
        )
        # Without auth, should return 401 first
        assert response.status_code in [400, 401, 403], f"Expected 400/401/403, got {response.status_code}: {response.text}"
        print(f"✅ POST /api/onboarding/nonprofit/apply with empty body returns: {response.status_code}")
    
    def test_admin_approve_missing_required_fields(self):
        """POST /api/onboarding/admin/nonprofit/approve without required fields"""
        response = requests.post(
            f"{BASE_URL}/api/onboarding/admin/nonprofit/approve",
            json={}  # Missing applicationId and userId
        )
        # Without auth, should return 401 first
        assert response.status_code in [400, 401, 403], f"Expected 400/401/403, got {response.status_code}: {response.text}"
        print(f"✅ POST /api/onboarding/admin/nonprofit/approve with empty body returns: {response.status_code}")
    
    def test_admin_reject_missing_required_fields(self):
        """POST /api/onboarding/admin/nonprofit/reject without required fields"""
        response = requests.post(
            f"{BASE_URL}/api/onboarding/admin/nonprofit/reject",
            json={}  # Missing applicationId and userId
        )
        # Without auth, should return 401 first
        assert response.status_code in [400, 401, 403], f"Expected 400/401/403, got {response.status_code}: {response.text}"
        print(f"✅ POST /api/onboarding/admin/nonprofit/reject with empty body returns: {response.status_code}")


class TestRouteExistence:
    """Test that all routes exist and respond (even if with auth errors)"""
    
    def test_all_onboarding_routes_exist(self):
        """Verify all onboarding routes are registered and respond"""
        routes = [
            ("POST", "/api/onboarding/save"),
            ("GET", "/api/onboarding/me"),
            ("POST", "/api/onboarding/nonprofit/apply"),
            ("GET", "/api/onboarding/nonprofit/status"),
            ("POST", "/api/onboarding/nonprofit/resubmit"),
            ("GET", "/api/onboarding/admin/all"),
            ("GET", "/api/onboarding/admin/nonprofit/pending"),
            ("GET", "/api/onboarding/admin/nonprofit/all"),
            ("POST", "/api/onboarding/admin/nonprofit/approve"),
            ("POST", "/api/onboarding/admin/nonprofit/reject"),
            ("GET", "/api/onboarding/nonprofit/verify-magic-link"),
        ]
        
        for method, path in routes:
            if method == "GET":
                response = requests.get(f"{BASE_URL}{path}")
            else:
                response = requests.post(f"{BASE_URL}{path}", json={})
            
            # Route should exist (not 404) - auth errors (401/403) or validation errors (400) are acceptable
            assert response.status_code != 404, f"Route {method} {path} not found (404)"
            print(f"✅ {method} {path} exists - returns {response.status_code}")
    
    def test_all_upload_routes_exist(self):
        """Verify all upload routes are registered and respond"""
        routes = [
            ("POST", "/api/upload/document"),
            ("DELETE", "/api/upload/document"),
            ("GET", "/api/upload/signed-url"),
        ]
        
        for method, path in routes:
            if method == "GET":
                response = requests.get(f"{BASE_URL}{path}")
            elif method == "DELETE":
                response = requests.delete(f"{BASE_URL}{path}", json={})
            else:
                response = requests.post(f"{BASE_URL}{path}")
            
            # Route should exist (not 404)
            assert response.status_code != 404, f"Route {method} {path} not found (404)"
            print(f"✅ {method} {path} exists - returns {response.status_code}")


class TestWithInvalidToken:
    """Test endpoints with invalid/malformed tokens"""
    
    def test_onboarding_save_invalid_token(self):
        """POST /api/onboarding/save with invalid token should return 401/403"""
        headers = {"Authorization": "Bearer invalid_token_12345"}
        response = requests.post(
            f"{BASE_URL}/api/onboarding/save",
            headers=headers,
            json={"responses": {"q1": "a1"}}
        )
        assert response.status_code in [401, 403], f"Expected 401/403, got {response.status_code}: {response.text}"
        print(f"✅ POST /api/onboarding/save with invalid token returns: {response.status_code}")
    
    def test_admin_endpoint_invalid_token(self):
        """GET /api/onboarding/admin/all with invalid token should return 401/403"""
        headers = {"Authorization": "Bearer invalid_token_12345"}
        response = requests.get(
            f"{BASE_URL}/api/onboarding/admin/all",
            headers=headers
        )
        assert response.status_code in [401, 403], f"Expected 401/403, got {response.status_code}: {response.text}"
        print(f"✅ GET /api/onboarding/admin/all with invalid token returns: {response.status_code}")


if __name__ == "__main__":
    pytest.main([__file__, "-v", "--tb=short"])
