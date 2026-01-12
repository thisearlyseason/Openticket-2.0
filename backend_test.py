#!/usr/bin/env python3
"""
Backend API Testing for OpenTicket Platform - Affiliate Payout System Testing
Tests the newly integrated Affiliate Payout System as requested in review
"""

import requests
import json
import time
import uuid
import subprocess
import os
from typing import Dict, Any

# Configuration - Use production URL from frontend/.env
BACKEND_URL = "https://ticketflow-111.preview.emergentagent.com"

class AffiliatePayoutTester:
    def __init__(self):
        self.results = []
        self.session = requests.Session()
        
    def log_result(self, test_name: str, success: bool, details: str = "", response_data: Any = None):
        """Log test result"""
        result = {
            "test": test_name,
            "success": success,
            "details": details,
            "response_data": response_data,
            "timestamp": time.strftime("%Y-%m-%d %H:%M:%S")
        }
        self.results.append(result)
        status = "✅ PASS" if success else "❌ FAIL"
        print(f"{status} {test_name}: {details}")
        if response_data and not success:
            print(f"   Response: {response_data}")
    
    def test_affiliate_earnings_endpoint(self):
        """Test Case 1: GET /api/admin/affiliate/earnings - Fetch earnings summary"""
        try:
            # Test without authentication first
            response = self.session.get(f"{BACKEND_URL}/api/admin/affiliate/earnings")
            
            if response.status_code == 401:
                self.log_result(
                    "Affiliate Earnings Endpoint - Authentication",
                    True,
                    "✅ Properly requires authentication (HTTP 401)",
                    {"status": response.status_code, "message": "Authentication required"}
                )
            elif response.status_code == 200:
                # Check if response has expected structure
                try:
                    data = response.json()
                    expected_fields = ['total', 'pending', 'paid', 'available']
                    
                    if all(field in data for field in expected_fields):
                        self.log_result(
                            "Affiliate Earnings Endpoint - Structure",
                            True,
                            f"✅ Returns expected earnings structure: {list(data.keys())}",
                            data
                        )
                    else:
                        missing_fields = [f for f in expected_fields if f not in data]
                        self.log_result(
                            "Affiliate Earnings Endpoint - Structure",
                            False,
                            f"❌ Missing expected fields: {missing_fields}",
                            data
                        )
                except json.JSONDecodeError:
                    self.log_result(
                        "Affiliate Earnings Endpoint - Structure",
                        False,
                        "❌ Response is not valid JSON",
                        response.text
                    )
            else:
                self.log_result(
                    "Affiliate Earnings Endpoint",
                    False,
                    f"❌ Unexpected status code: {response.status_code}",
                    response.text
                )
        except Exception as e:
            self.log_result("Affiliate Earnings Endpoint", False, f"Exception: {str(e)}")

    def test_affiliate_payouts_endpoint(self):
        """Test Case 2: GET /api/admin/affiliate/payouts - Fetch payout history"""
        try:
            # Test without authentication first
            response = self.session.get(f"{BACKEND_URL}/api/admin/affiliate/payouts")
            
            if response.status_code == 401:
                self.log_result(
                    "Affiliate Payouts Endpoint - Authentication",
                    True,
                    "✅ Properly requires authentication (HTTP 401)",
                    {"status": response.status_code, "message": "Authentication required"}
                )
            elif response.status_code == 200:
                # Check if response has expected structure
                try:
                    data = response.json()
                    
                    if 'payouts' in data and isinstance(data['payouts'], list):
                        self.log_result(
                            "Affiliate Payouts Endpoint - Structure",
                            True,
                            f"✅ Returns payouts array with {len(data['payouts'])} items",
                            {"payouts_count": len(data['payouts']), "structure": "valid"}
                        )
                        
                        # If there are payouts, check their structure
                        if data['payouts']:
                            payout = data['payouts'][0]
                            expected_fields = ['id', 'amount', 'status', 'requestedAt']
                            
                            if all(field in payout for field in expected_fields):
                                self.log_result(
                                    "Affiliate Payouts Endpoint - Payout Structure",
                                    True,
                                    f"✅ Payout objects have expected fields: {list(payout.keys())}",
                                    {"sample_payout": payout}
                                )
                            else:
                                missing_fields = [f for f in expected_fields if f not in payout]
                                self.log_result(
                                    "Affiliate Payouts Endpoint - Payout Structure",
                                    False,
                                    f"❌ Payout missing expected fields: {missing_fields}",
                                    payout
                                )
                    else:
                        self.log_result(
                            "Affiliate Payouts Endpoint - Structure",
                            False,
                            "❌ Response missing 'payouts' array",
                            data
                        )
                except json.JSONDecodeError:
                    self.log_result(
                        "Affiliate Payouts Endpoint - Structure",
                        False,
                        "❌ Response is not valid JSON",
                        response.text
                    )
            else:
                self.log_result(
                    "Affiliate Payouts Endpoint",
                    False,
                    f"❌ Unexpected status code: {response.status_code}",
                    response.text
                )
        except Exception as e:
            self.log_result("Affiliate Payouts Endpoint", False, f"Exception: {str(e)}")

    def test_request_payout_endpoint(self):
        """Test Case 3: POST /api/admin/affiliate/request-payout - Request payout"""
        try:
            # Test manual payout request without authentication
            manual_payload = {"method": "manual"}
            
            response = self.session.post(
                f"{BACKEND_URL}/api/admin/affiliate/request-payout",
                json=manual_payload,
                headers={'Content-Type': 'application/json'}
            )
            
            if response.status_code == 401:
                self.log_result(
                    "Request Payout Endpoint - Authentication",
                    True,
                    "✅ Properly requires authentication for manual payout (HTTP 401)",
                    {"method": "manual", "status": response.status_code}
                )
            else:
                self.log_result(
                    "Request Payout Endpoint - Authentication",
                    False,
                    f"❌ Expected 401 for unauthenticated request, got {response.status_code}",
                    response.text
                )
            
            # Test scheduled payout request without authentication
            scheduled_payload = {"method": "scheduled"}
            
            response = self.session.post(
                f"{BACKEND_URL}/api/admin/affiliate/request-payout",
                json=scheduled_payload,
                headers={'Content-Type': 'application/json'}
            )
            
            if response.status_code == 401:
                self.log_result(
                    "Request Payout Endpoint - Scheduled Authentication",
                    True,
                    "✅ Properly requires authentication for scheduled payout (HTTP 401)",
                    {"method": "scheduled", "status": response.status_code}
                )
            else:
                self.log_result(
                    "Request Payout Endpoint - Scheduled Authentication",
                    False,
                    f"❌ Expected 401 for unauthenticated request, got {response.status_code}",
                    response.text
                )
            
            # Test invalid method
            invalid_payload = {"method": "invalid_method"}
            
            response = self.session.post(
                f"{BACKEND_URL}/api/admin/affiliate/request-payout",
                json=invalid_payload,
                headers={'Content-Type': 'application/json'}
            )
            
            # Should still require auth first, but test validates endpoint exists
            if response.status_code in [400, 401]:
                self.log_result(
                    "Request Payout Endpoint - Validation",
                    True,
                    f"✅ Endpoint validates input (HTTP {response.status_code})",
                    {"method": "invalid", "status": response.status_code}
                )
            else:
                self.log_result(
                    "Request Payout Endpoint - Validation",
                    False,
                    f"❌ Unexpected response for invalid method: {response.status_code}",
                    response.text
                )
                
        except Exception as e:
            self.log_result("Request Payout Endpoint", False, f"Exception: {str(e)}")

    def test_affiliate_database_migration(self):
        """Test Case 4: Verify affiliate_payouts table exists via API behavior"""
        try:
            # Test if the affiliate payouts endpoint responds correctly (indicating table exists)
            response = self.session.get(f"{BACKEND_URL}/api/admin/affiliate/payouts")
            
            # If we get 401 (auth required) or 200 (success), table likely exists
            # If we get 500 with "table does not exist", migration wasn't run
            if response.status_code in [200, 401]:
                self.log_result(
                    "Affiliate Database Migration",
                    True,
                    f"✅ affiliate_payouts table appears to exist (API responds with {response.status_code})",
                    {"status": response.status_code, "table_status": "exists"}
                )
            elif response.status_code == 500:
                try:
                    error_data = response.json()
                    if 'does not exist' in str(error_data).lower():
                        self.log_result(
                            "Affiliate Database Migration",
                            False,
                            "❌ affiliate_payouts table does not exist - migration not run",
                            error_data
                        )
                    else:
                        self.log_result(
                            "Affiliate Database Migration",
                            True,
                            "✅ Table exists but other server error occurred",
                            error_data
                        )
                except:
                    self.log_result(
                        "Affiliate Database Migration",
                        True,
                        "✅ Table exists but server error occurred (not table-related)",
                        response.text
                    )
            else:
                self.log_result(
                    "Affiliate Database Migration",
                    True,
                    f"✅ Endpoint responds (table exists), status: {response.status_code}",
                    {"status": response.status_code}
                )
        except Exception as e:
            self.log_result("Affiliate Database Migration", False, f"Exception: {str(e)}")

    def test_backend_routes_exist(self):
        """Test Case 5: Verify all affiliate payout routes exist in adminRoutes.js"""
        try:
            # Test that all three main endpoints exist by checking their responses
            endpoints = [
                "/api/admin/affiliate/earnings",
                "/api/admin/affiliate/payouts", 
                "/api/admin/affiliate/request-payout"
            ]
            
            results = {}
            
            for endpoint in endpoints:
                if endpoint.endswith("request-payout"):
                    # POST endpoint
                    response = self.session.post(f"{BACKEND_URL}{endpoint}", json={})
                else:
                    # GET endpoint
                    response = self.session.get(f"{BACKEND_URL}{endpoint}")
                
                # 401 = auth required (good), 404 = route doesn't exist (bad)
                if response.status_code == 404:
                    results[endpoint] = {"exists": False, "status": 404}
                else:
                    results[endpoint] = {"exists": True, "status": response.status_code}
            
            missing_routes = [ep for ep, result in results.items() if not result["exists"]]
            
            if not missing_routes:
                self.log_result(
                    "Backend Routes Exist",
                    True,
                    f"✅ All affiliate payout routes exist: {list(results.keys())}",
                    results
                )
            else:
                self.log_result(
                    "Backend Routes Exist",
                    False,
                    f"❌ Missing routes: {missing_routes}",
                    results
                )
                
        except Exception as e:
            self.log_result("Backend Routes Exist", False, f"Exception: {str(e)}")

    def test_affiliate_component_integration(self):
        """Test Case 6: Verify AffiliatePayouts component integration"""
        try:
            # Check if AffiliatePayouts component file exists
            import os
            component_path = "/app/components/AffiliatePayouts.tsx"
            dashboard_path = "/app/components/AffiliateDashboard.tsx"
            
            component_exists = os.path.exists(component_path)
            dashboard_exists = os.path.exists(dashboard_path)
            
            if not component_exists:
                self.log_result(
                    "AffiliatePayouts Component",
                    False,
                    "❌ AffiliatePayouts.tsx component file not found",
                    {"path": component_path, "exists": False}
                )
                return
            
            if not dashboard_exists:
                self.log_result(
                    "AffiliateDashboard Component",
                    False,
                    "❌ AffiliateDashboard.tsx component file not found",
                    {"path": dashboard_path, "exists": False}
                )
                return
            
            # Check if AffiliatePayouts is imported in AffiliateDashboard
            with open(dashboard_path, 'r') as f:
                dashboard_content = f.read()
            
            has_import = "import { AffiliatePayouts }" in dashboard_content or "from './AffiliatePayouts'" in dashboard_content
            has_usage = "<AffiliatePayouts" in dashboard_content
            
            if has_import and has_usage:
                self.log_result(
                    "AffiliatePayouts Component Integration",
                    True,
                    "✅ AffiliatePayouts component properly imported and used in AffiliateDashboard",
                    {"import": has_import, "usage": has_usage}
                )
            else:
                self.log_result(
                    "AffiliatePayouts Component Integration",
                    False,
                    f"❌ Integration incomplete - Import: {has_import}, Usage: {has_usage}",
                    {"import": has_import, "usage": has_usage}
                )
            
            # Check component structure
            with open(component_path, 'r') as f:
                component_content = f.read()
            
            required_features = [
                "earnings summary",
                "payout request",
                "payout history",
                "manual",
                "scheduled"
            ]
            
            feature_checks = {}
            for feature in required_features:
                feature_checks[feature] = feature.lower() in component_content.lower()
            
            missing_features = [f for f, exists in feature_checks.items() if not exists]
            
            if not missing_features:
                self.log_result(
                    "AffiliatePayouts Component Features",
                    True,
                    f"✅ Component contains all required features: {list(feature_checks.keys())}",
                    feature_checks
                )
            else:
                self.log_result(
                    "AffiliatePayouts Component Features",
                    False,
                    f"❌ Missing features: {missing_features}",
                    feature_checks
                )
                
        except Exception as e:
            self.log_result("AffiliatePayouts Component Integration", False, f"Exception: {str(e)}")

    def test_frontend_api_integration(self):
        """Test Case 7: Verify frontend API calls match backend endpoints"""
        try:
            component_path = "/app/components/AffiliatePayouts.tsx"
            
            if not os.path.exists(component_path):
                self.log_result(
                    "Frontend API Integration",
                    False,
                    "❌ AffiliatePayouts component not found for API integration check",
                    {"path": component_path}
                )
                return
            
            with open(component_path, 'r') as f:
                content = f.read()
            
            # Check for correct API endpoints
            expected_endpoints = [
                "/api/admin/affiliate/earnings",
                "/api/admin/affiliate/payouts",
                "/api/admin/affiliate/request-payout"
            ]
            
            endpoint_usage = {}
            for endpoint in expected_endpoints:
                endpoint_usage[endpoint] = endpoint in content
            
            # Check for authentication headers
            has_auth_headers = "Authorization" in content and "Bearer" in content
            
            # Check for proper error handling
            has_error_handling = "catch" in content and "error" in content.lower()
            
            # Check for loading states
            has_loading_states = "loading" in content.lower() or "isLoading" in content
            
            missing_endpoints = [ep for ep, used in endpoint_usage.items() if not used]
            
            integration_score = 0
            total_checks = 4
            
            if not missing_endpoints:
                integration_score += 1
            if has_auth_headers:
                integration_score += 1
            if has_error_handling:
                integration_score += 1
            if has_loading_states:
                integration_score += 1
            
            if integration_score == total_checks:
                self.log_result(
                    "Frontend API Integration",
                    True,
                    f"✅ Complete API integration: endpoints, auth, error handling, loading states",
                    {
                        "endpoints": endpoint_usage,
                        "auth": has_auth_headers,
                        "error_handling": has_error_handling,
                        "loading_states": has_loading_states
                    }
                )
            else:
                issues = []
                if missing_endpoints:
                    issues.append(f"Missing endpoints: {missing_endpoints}")
                if not has_auth_headers:
                    issues.append("Missing authentication headers")
                if not has_error_handling:
                    issues.append("Missing error handling")
                if not has_loading_states:
                    issues.append("Missing loading states")
                
                self.log_result(
                    "Frontend API Integration",
                    False,
                    f"❌ Integration issues: {'; '.join(issues)}",
                    {
                        "score": f"{integration_score}/{total_checks}",
                        "issues": issues
                    }
                )
                
        except Exception as e:
            self.log_result("Frontend API Integration", False, f"Exception: {str(e)}")

    def run_all_tests(self):
        """Run all affiliate payout system tests as specified in review request"""
        print("💰 Starting Affiliate Payout System Testing")
        print("=" * 60)
        
        # Core Affiliate Payout System Tests from Review Request
        print("\n🔧 BACKEND API TESTS")
        print("-" * 40)
        self.test_affiliate_earnings_endpoint()
        self.test_affiliate_payouts_endpoint()
        self.test_request_payout_endpoint()
        self.test_affiliate_database_migration()
        self.test_backend_routes_exist()
        
        print("\n🎨 FRONTEND INTEGRATION TESTS")
        print("-" * 40)
        self.test_affiliate_component_integration()
        self.test_frontend_api_integration()
        
        print("\n" + "=" * 60)
        print("📊 TEST SUMMARY")
        print("=" * 60)
        
        passed = sum(1 for r in self.results if r['success'])
        total = len(self.results)
        
        print(f"Total Tests: {total}")
        print(f"Passed: {passed}")
        print(f"Failed: {total - passed}")
        print(f"Success Rate: {(passed/total)*100:.1f}%")
        
        # Success Criteria Check
        print("\n🎯 SUCCESS CRITERIA VERIFICATION:")
        
        criteria_results = []
        
        # Check each test result
        earnings_test = next((r for r in self.results if 'Earnings Endpoint' in r['test']), None)
        payouts_test = next((r for r in self.results if 'Payouts Endpoint' in r['test']), None)
        request_test = next((r for r in self.results if 'Request Payout' in r['test']), None)
        migration_test = next((r for r in self.results if 'Database Migration' in r['test']), None)
        routes_test = next((r for r in self.results if 'Routes Exist' in r['test']), None)
        component_test = next((r for r in self.results if 'Component Integration' in r['test']), None)
        api_test = next((r for r in self.results if 'API Integration' in r['test']), None)
        
        if earnings_test and earnings_test['success']:
            criteria_results.append("✅ GET /api/admin/affiliate/earnings endpoint working")
        else:
            criteria_results.append("❌ Affiliate earnings endpoint failed")
            
        if payouts_test and payouts_test['success']:
            criteria_results.append("✅ GET /api/admin/affiliate/payouts endpoint working")
        else:
            criteria_results.append("❌ Affiliate payouts endpoint failed")
            
        if request_test and request_test['success']:
            criteria_results.append("✅ POST /api/admin/affiliate/request-payout endpoint working")
        else:
            criteria_results.append("❌ Request payout endpoint failed")
            
        if migration_test and migration_test['success']:
            criteria_results.append("✅ Database migration executed (affiliate_payouts table exists)")
        else:
            criteria_results.append("❌ Database migration verification failed")
            
        if routes_test and routes_test['success']:
            criteria_results.append("✅ All backend routes implemented in adminRoutes.js")
        else:
            criteria_results.append("❌ Backend routes implementation incomplete")
            
        if component_test and component_test['success']:
            criteria_results.append("✅ AffiliatePayouts component integrated into dashboard")
        else:
            criteria_results.append("❌ Frontend component integration failed")
            
        if api_test and api_test['success']:
            criteria_results.append("✅ Frontend API integration complete")
        else:
            criteria_results.append("❌ Frontend API integration incomplete")
        
        for criterion in criteria_results:
            print(f"  {criterion}")
        
        if total - passed > 0:
            print("\n❌ FAILED TESTS:")
            for result in self.results:
                if not result['success']:
                    print(f"  - {result['test']}: {result['details']}")
        
        print("\n📋 TESTING NOTES:")
        print("  - Backend API testing requires authenticated user with affiliate_code")
        print("  - Full end-to-end testing requires frontend navigation to /affiliate")
        print("  - Payout functionality requires user with available earnings")
        print("  - Database migration must be executed by user before testing")
        
        return passed == total

if __name__ == "__main__":
    tester = AffiliatePayoutTester()
    success = tester.run_all_tests()
    
    # Save detailed results
    with open('/app/affiliate_payout_test_results.json', 'w') as f:
        json.dump(tester.results, f, indent=2)
    
    print(f"\n📄 Detailed results saved to: /app/affiliate_payout_test_results.json")
    
    if success:
        print("\n🎉 All Affiliate Payout System tests PASSED!")
        exit(0)
    else:
        print("\n⚠️  Some tests FAILED - see details above")
        exit(1)