"""
Test cases for new features:
1. Live Revenue Dashboard Widget - /api/admin/organizer/live-sales endpoint
2. Share Event functionality (frontend only - no backend endpoint needed)
"""
import pytest
import requests
import os

BASE_URL = os.environ.get('VITE_BACKEND_URL', 'https://www.openticket.events')

class TestLiveSalesEndpoint:
    """Tests for /api/admin/organizer/live-sales endpoint"""
    
    def test_live_sales_requires_auth(self):
        """Test that live-sales endpoint requires authentication"""
        response = requests.get(f"{BASE_URL}/api/admin/organizer/live-sales")
        # Should return 401 or 403 without auth
        assert response.status_code in [401, 403], f"Expected 401/403, got {response.status_code}"
        print(f"✅ Live sales endpoint correctly requires auth (status: {response.status_code})")
    
    def test_live_sales_endpoint_exists(self):
        """Test that the endpoint exists (not 404)"""
        response = requests.get(f"{BASE_URL}/api/admin/organizer/live-sales")
        # Should NOT be 404 - endpoint should exist
        assert response.status_code != 404, "Live sales endpoint not found (404)"
        print(f"✅ Live sales endpoint exists (status: {response.status_code})")


class TestHealthEndpoint:
    """Basic health check tests"""
    
    def test_health_endpoint(self):
        """Test that health endpoint returns 200"""
        response = requests.get(f"{BASE_URL}/api/health")
        assert response.status_code == 200, f"Health check failed: {response.status_code}"
        print("✅ Health endpoint working")


class TestAdminEndpoints:
    """Test admin endpoints exist"""
    
    def test_organizer_financial_summary_requires_auth(self):
        """Test organizer financial summary requires auth"""
        response = requests.get(f"{BASE_URL}/api/admin/organizer/financial-summary")
        assert response.status_code in [401, 403], f"Expected 401/403, got {response.status_code}"
        print(f"✅ Financial summary endpoint requires auth (status: {response.status_code})")
    
    def test_organizer_audit_logs_requires_auth(self):
        """Test organizer audit logs requires auth"""
        response = requests.get(f"{BASE_URL}/api/admin/organizer/audit-logs")
        assert response.status_code in [401, 403], f"Expected 401/403, got {response.status_code}"
        print(f"✅ Audit logs endpoint requires auth (status: {response.status_code})")


if __name__ == "__main__":
    pytest.main([__file__, "-v", "--tb=short"])
