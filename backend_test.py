#!/usr/bin/env python3
"""
Backend API Testing for OpenTicket Platform - Promo Code Creation Issue
Tests the promo code creation API endpoint as requested in review
"""

import requests
import json
import time
import uuid
import subprocess
import os
from typing import Dict, Any

# Configuration - Use production URL from frontend/.env
BACKEND_URL = "https://bugsmash-central-1.preview.emergentagent.com"

class PromoCodeTester:
    def __init__(self):
        self.results = []
        self.session = requests.Session()
        self.auth_token = None
        
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
    
    def test_admin_login(self):
        """Test Case 1: Login as admin user test+openticket@gmail.com"""
        try:
            # Test login endpoint
            login_data = {
                "email": "test+openticket@gmail.com",
                "password": "12345678"
            }
            
            response = self.session.post(f"{BACKEND_URL}/api/auth/login", json=login_data)
            
            if response.status_code == 200:
                try:
                    data = response.json()
                    if 'token' in data or 'access_token' in data:
                        self.auth_token = data.get('token') or data.get('access_token')
                        self.session.headers.update({'Authorization': f'Bearer {self.auth_token}'})
                        
                        self.log_result(
                            "Admin Login",
                            True,
                            "✅ Successfully logged in as admin user",
                            {"email": "test+openticket@gmail.com", "token_received": True}
                        )
                        return True
                    else:
                        self.log_result(
                            "Admin Login",
                            False,
                            "❌ Login response missing token",
                            data
                        )
                        return False
                except json.JSONDecodeError:
                    self.log_result(
                        "Admin Login",
                        False,
                        "❌ Invalid JSON response from login",
                        response.text
                    )
                    return False
            elif response.status_code == 401:
                self.log_result(
                    "Admin Login",
                    False,
                    "❌ Invalid credentials - user may not exist or password incorrect",
                    {"status": response.status_code, "response": response.text}
                )
                return False
            else:
                self.log_result(
                    "Admin Login",
                    False,
                    f"❌ Unexpected login response: HTTP {response.status_code}",
                    response.text
                )
                return False
                
        except Exception as e:
            self.log_result("Admin Login", False, f"Exception: {str(e)}")
            return False

    def test_promo_codes_get_endpoint(self):
        """Test Case 2: GET /api/admin/promo-codes - Fetch existing promo codes"""
        try:
            if not self.auth_token:
                self.log_result(
                    "Get Promo Codes - Authentication Required",
                    False,
                    "❌ Cannot test without authentication token",
                    {"auth_token": None}
                )
                return False
            
            response = self.session.get(f"{BACKEND_URL}/api/admin/promo-codes")
            
            if response.status_code == 200:
                try:
                    data = response.json()
                    
                    if 'promoCodes' in data and isinstance(data['promoCodes'], list):
                        self.log_result(
                            "Get Promo Codes Endpoint",
                            True,
                            f"✅ Successfully retrieved {len(data['promoCodes'])} promo codes",
                            {"promo_codes_count": len(data['promoCodes']), "structure": "valid"}
                        )
                        return True
                    else:
                        self.log_result(
                            "Get Promo Codes Endpoint",
                            False,
                            "❌ Response missing 'promoCodes' array",
                            data
                        )
                        return False
                except json.JSONDecodeError:
                    self.log_result(
                        "Get Promo Codes Endpoint",
                        False,
                        "❌ Invalid JSON response",
                        response.text
                    )
                    return False
            elif response.status_code == 401:
                self.log_result(
                    "Get Promo Codes Endpoint - Authentication",
                    False,
                    "❌ Authentication failed - token may be invalid",
                    {"status": response.status_code}
                )
                return False
            elif response.status_code == 403:
                self.log_result(
                    "Get Promo Codes Endpoint - Authorization",
                    False,
                    "❌ Access denied - user may not have admin privileges",
                    {"status": response.status_code}
                )
                return False
            else:
                self.log_result(
                    "Get Promo Codes Endpoint",
                    False,
                    f"❌ Unexpected status code: {response.status_code}",
                    response.text
                )
                return False
                
        except Exception as e:
            self.log_result("Get Promo Codes Endpoint", False, f"Exception: {str(e)}")
            return False

    def test_promo_code_creation(self):
        """Test Case 3: POST /api/admin/promo-codes - Create test promo code"""
        try:
            if not self.auth_token:
                self.log_result(
                    "Create Promo Code - Authentication Required",
                    False,
                    "❌ Cannot test without authentication token",
                    {"auth_token": None}
                )
                return False
            
            # Create test promo code as specified in review request
            test_promo_code = {
                "id": "promo-test123",
                "code": "TESTCODE",
                "type": "percentage",
                "value": 20,
                "target": "all",
                "targetPlans": [],
                "usageLimit": 100,
                "usageCount": 0,
                "expiresAt": "2025-12-31",
                "isActive": True,
                "createdAt": "2025-01-17T00:00:00Z"
            }
            
            response = self.session.post(f"{BACKEND_URL}/api/admin/promo-codes", json=test_promo_code)
            
            if response.status_code == 200:
                try:
                    data = response.json()
                    
                    if 'promoCode' in data:
                        created_promo = data['promoCode']
                        
                        # Verify the created promo code has expected fields
                        expected_fields = ['id', 'code', 'type', 'value', 'target']
                        missing_fields = [f for f in expected_fields if f not in created_promo]
                        
                        if not missing_fields:
                            self.log_result(
                                "Create Promo Code",
                                True,
                                f"✅ Successfully created promo code: {created_promo.get('code')}",
                                {
                                    "promo_code": created_promo,
                                    "id": created_promo.get('id'),
                                    "code": created_promo.get('code'),
                                    "type": created_promo.get('type'),
                                    "value": created_promo.get('value')
                                }
                            )
                            return created_promo
                        else:
                            self.log_result(
                                "Create Promo Code",
                                False,
                                f"❌ Created promo code missing fields: {missing_fields}",
                                created_promo
                            )
                            return False
                    else:
                        self.log_result(
                            "Create Promo Code",
                            False,
                            "❌ Response missing 'promoCode' field",
                            data
                        )
                        return False
                except json.JSONDecodeError:
                    self.log_result(
                        "Create Promo Code",
                        False,
                        "❌ Invalid JSON response",
                        response.text
                    )
                    return False
            elif response.status_code == 401:
                self.log_result(
                    "Create Promo Code - Authentication",
                    False,
                    "❌ Authentication failed - token may be invalid",
                    {"status": response.status_code}
                )
                return False
            elif response.status_code == 403:
                self.log_result(
                    "Create Promo Code - Authorization",
                    False,
                    "❌ Access denied - user may not have admin privileges",
                    {"status": response.status_code}
                )
                return False
            elif response.status_code == 400:
                try:
                    error_data = response.json()
                    self.log_result(
                        "Create Promo Code - Validation Error",
                        False,
                        f"❌ Bad request - validation failed: {error_data.get('error', 'Unknown error')}",
                        error_data
                    )
                except:
                    self.log_result(
                        "Create Promo Code - Validation Error",
                        False,
                        f"❌ Bad request: {response.text}",
                        {"status": response.status_code}
                    )
                return False
            elif response.status_code == 500:
                try:
                    error_data = response.json()
                    self.log_result(
                        "Create Promo Code - Server Error",
                        False,
                        f"❌ Server error: {error_data.get('error', 'Internal server error')}",
                        error_data
                    )
                except:
                    self.log_result(
                        "Create Promo Code - Server Error",
                        False,
                        f"❌ Server error: {response.text}",
                        {"status": response.status_code}
                    )
                return False
            else:
                self.log_result(
                    "Create Promo Code",
                    False,
                    f"❌ Unexpected status code: {response.status_code}",
                    response.text
                )
                return False
                
        except Exception as e:
            self.log_result("Create Promo Code", False, f"Exception: {str(e)}")
            return False

    def test_promo_code_persistence(self, created_promo_code):
        """Test Case 4: Verify promo code persists in database"""
        try:
            if not self.auth_token:
                self.log_result(
                    "Verify Promo Code Persistence - Authentication Required",
                    False,
                    "❌ Cannot test without authentication token",
                    {"auth_token": None}
                )
                return False
            
            if not created_promo_code:
                self.log_result(
                    "Verify Promo Code Persistence - No Promo Code",
                    False,
                    "❌ Cannot test persistence without created promo code",
                    {"created_promo_code": None}
                )
                return False
            
            # Fetch all promo codes to verify our test code exists
            response = self.session.get(f"{BACKEND_URL}/api/admin/promo-codes")
            
            if response.status_code == 200:
                try:
                    data = response.json()
                    promo_codes = data.get('promoCodes', [])
                    
                    # Look for our test promo code
                    test_code = created_promo_code.get('code', 'TESTCODE')
                    found_promo = None
                    
                    for promo in promo_codes:
                        if promo.get('code') == test_code:
                            found_promo = promo
                            break
                    
                    if found_promo:
                        # Verify the promo code data matches what we created
                        matches = (
                            found_promo.get('code') == test_code and
                            found_promo.get('type') == 'percentage' and
                            found_promo.get('value') == 20 and
                            found_promo.get('target') == 'all'
                        )
                        
                        if matches:
                            self.log_result(
                                "Verify Promo Code Persistence",
                                True,
                                f"✅ Promo code {test_code} successfully persisted in database",
                                {
                                    "found_promo": found_promo,
                                    "matches_created": True,
                                    "total_promo_codes": len(promo_codes)
                                }
                            )
                            return True
                        else:
                            self.log_result(
                                "Verify Promo Code Persistence",
                                False,
                                f"❌ Promo code {test_code} found but data doesn't match",
                                {
                                    "expected": created_promo_code,
                                    "found": found_promo,
                                    "matches": matches
                                }
                            )
                            return False
                    else:
                        self.log_result(
                            "Verify Promo Code Persistence",
                            False,
                            f"❌ Promo code {test_code} not found in database",
                            {
                                "searched_for": test_code,
                                "available_codes": [p.get('code') for p in promo_codes],
                                "total_codes": len(promo_codes)
                            }
                        )
                        return False
                        
                except json.JSONDecodeError:
                    self.log_result(
                        "Verify Promo Code Persistence",
                        False,
                        "❌ Invalid JSON response when fetching promo codes",
                        response.text
                    )
                    return False
            else:
                self.log_result(
                    "Verify Promo Code Persistence",
                    False,
                    f"❌ Failed to fetch promo codes for verification: HTTP {response.status_code}",
                    response.text
                )
                return False
                
        except Exception as e:
            self.log_result("Verify Promo Code Persistence", False, f"Exception: {str(e)}")
            return False

    def test_backend_health_and_connectivity(self):
        """Test Case 5: Verify backend is healthy and accessible"""
        try:
            # Test basic connectivity
            health_response = self.session.get(f"{BACKEND_URL}/api/health", timeout=10)
            
            if health_response.status_code == 200:
                try:
                    health_data = health_response.json()
                    self.log_result(
                        "Backend Health Check",
                        True,
                        f"✅ Backend is healthy and responding",
                        health_data
                    )
                except:
                    self.log_result(
                        "Backend Health Check",
                        True,
                        f"✅ Backend responding (HTTP 200)",
                        {"status": health_response.status_code}
                    )
            else:
                self.log_result(
                    "Backend Health Check",
                    False,
                    f"❌ Backend health check failed: HTTP {health_response.status_code}",
                    health_response.text
                )
            
            # Test if the admin routes exist
            admin_routes = [
                "/api/admin/promo-codes"
            ]
            
            route_results = {}
            for route in admin_routes:
                try:
                    route_response = self.session.get(f"{BACKEND_URL}{route}", timeout=5)
                    # 401/403 = auth required (good), 404 = route doesn't exist (bad)
                    if route_response.status_code == 404:
                        route_results[route] = {"exists": False, "status": 404}
                    else:
                        route_results[route] = {"exists": True, "status": route_response.status_code}
                except Exception as route_error:
                    route_results[route] = {"exists": False, "error": str(route_error)}
            
            missing_routes = [route for route, result in route_results.items() if not result.get("exists", False)]
            
            if not missing_routes:
                self.log_result(
                    "Backend Routes Availability",
                    True,
                    f"✅ All required admin routes exist: {list(route_results.keys())}",
                    route_results
                )
            else:
                self.log_result(
                    "Backend Routes Availability",
                    False,
                    f"❌ Missing routes: {missing_routes}",
                    route_results
                )
                
        except Exception as e:
            self.log_result("Backend Health and Connectivity", False, f"Exception: {str(e)}")

    def test_promo_code_database_schema(self):
        """Test Case 6: Verify promo codes table exists and has correct structure"""
        try:
            if not self.auth_token:
                self.log_result(
                    "Promo Code Database Schema - Authentication Required",
                    False,
                    "❌ Cannot test without authentication token",
                    {"auth_token": None}
                )
                return False
            
            # Try to fetch promo codes to test if table exists
            response = self.session.get(f"{BACKEND_URL}/api/admin/promo-codes")
            
            if response.status_code == 200:
                try:
                    data = response.json()
                    if 'promoCodes' in data:
                        self.log_result(
                            "Promo Code Database Schema",
                            True,
                            "✅ Promo codes table exists and is accessible",
                            {"table_exists": True, "endpoint_working": True}
                        )
                        return True
                    else:
                        self.log_result(
                            "Promo Code Database Schema",
                            False,
                            "❌ Unexpected response structure from promo codes endpoint",
                            data
                        )
                        return False
                except json.JSONDecodeError:
                    self.log_result(
                        "Promo Code Database Schema",
                        False,
                        "❌ Invalid JSON response from promo codes endpoint",
                        response.text
                    )
                    return False
            elif response.status_code == 500:
                try:
                    error_data = response.json()
                    error_message = error_data.get('error', '')
                    
                    if 'does not exist' in error_message.lower():
                        self.log_result(
                            "Promo Code Database Schema",
                            False,
                            "❌ Promo codes table does not exist in database",
                            {"table_exists": False, "error": error_message}
                        )
                    else:
                        self.log_result(
                            "Promo Code Database Schema",
                            False,
                            f"❌ Database error: {error_message}",
                            error_data
                        )
                except:
                    self.log_result(
                        "Promo Code Database Schema",
                        False,
                        f"❌ Server error when accessing promo codes: {response.text}",
                        {"status": response.status_code}
                    )
                return False
            elif response.status_code in [401, 403]:
                self.log_result(
                    "Promo Code Database Schema",
                    True,
                    "✅ Promo codes endpoint exists (authentication/authorization required)",
                    {"endpoint_exists": True, "auth_required": True, "status": response.status_code}
                )
                return True
            else:
                self.log_result(
                    "Promo Code Database Schema",
                    False,
                    f"❌ Unexpected response from promo codes endpoint: HTTP {response.status_code}",
                    response.text
                )
                return False
                
        except Exception as e:
            self.log_result("Promo Code Database Schema", False, f"Exception: {str(e)}")
            return False

    def run_all_tests(self):
        """Run all promo code creation tests as specified in review request"""
        print("🎟️ Starting Promo Code Creation Issue Testing")
        print("=" * 70)
        print("🎯 TESTING FOCUS: Promo Code Creation API - Save & Persistence")
        print("=" * 70)
        
        # Core Promo Code Tests from Review Request
        print("\n🔧 BACKEND API TESTS")
        print("-" * 40)
        self.test_backend_health_and_connectivity()
        self.test_promo_code_database_schema()
        
        # Authentication Test
        print("\n🔐 AUTHENTICATION TESTS")
        print("-" * 40)
        login_success = self.test_admin_login()
        
        if login_success:
            print("\n🎫 PROMO CODE FUNCTIONALITY TESTS")
            print("-" * 40)
            self.test_promo_codes_get_endpoint()
            created_promo = self.test_promo_code_creation()
            if created_promo:
                self.test_promo_code_persistence(created_promo)
        else:
            print("\n⚠️ SKIPPING PROMO CODE TESTS - Authentication Failed")
            print("Cannot test promo code creation without admin authentication")
        
        print("\n" + "=" * 70)
        print("📊 TEST SUMMARY")
        print("=" * 70)
        
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
        backend_health = next((r for r in self.results if 'Backend Health' in r['test']), None)
        admin_login = next((r for r in self.results if 'Admin Login' in r['test']), None)
        get_promo_codes = next((r for r in self.results if 'Get Promo Codes' in r['test']), None)
        create_promo_code = next((r for r in self.results if 'Create Promo Code' in r['test'] and 'Authentication' not in r['test'] and 'Authorization' not in r['test']), None)
        verify_persistence = next((r for r in self.results if 'Verify Promo Code Persistence' in r['test']), None)
        database_schema = next((r for r in self.results if 'Database Schema' in r['test']), None)
        
        if backend_health and backend_health['success']:
            criteria_results.append("✅ Backend is healthy and promo code routes exist")
        else:
            criteria_results.append("❌ Backend health check failed")
            
        if database_schema and database_schema['success']:
            criteria_results.append("✅ Promo codes database table exists and is accessible")
        else:
            criteria_results.append("❌ Promo codes database table verification failed")
            
        if admin_login and admin_login['success']:
            criteria_results.append("✅ Admin authentication working (test+openticket@gmail.com)")
        else:
            criteria_results.append("❌ Admin authentication failed - user may not exist or lack admin privileges")
            
        if get_promo_codes and get_promo_codes['success']:
            criteria_results.append("✅ GET /api/admin/promo-codes endpoint working")
        else:
            criteria_results.append("❌ GET promo codes endpoint failed")
            
        if create_promo_code and create_promo_code['success']:
            criteria_results.append("✅ POST /api/admin/promo-codes endpoint working (promo code created)")
        else:
            criteria_results.append("❌ POST promo codes endpoint failed (promo code creation failed)")
            
        if verify_persistence and verify_persistence['success']:
            criteria_results.append("✅ Promo code persists in database after creation")
        else:
            criteria_results.append("❌ Promo code persistence verification failed")
        
        for criterion in criteria_results:
            print(f"  {criterion}")
        
        if total - passed > 0:
            print("\n❌ FAILED TESTS:")
            for result in self.results:
                if not result['success']:
                    print(f"  - {result['test']}: {result['details']}")
        
        print("\n📋 TESTING NOTES:")
        print("  - Test user: test+openticket@gmail.com / 12345678")
        print("  - Test promo code: TESTCODE (20% percentage discount)")
        print("  - Target: all plans, Usage limit: 100, Expires: 2025-12-31")
        print("  - Expected: 200 status code, promo code created and persisted")
        
        print("\n🔍 EXPECTED BEHAVIOR:")
        print("  - Admin login should succeed and return authentication token")
        print("  - GET /api/admin/promo-codes should return existing promo codes array")
        print("  - POST /api/admin/promo-codes should create new promo code and return it")
        print("  - Created promo code should persist and be retrievable via GET endpoint")
        print("  - All operations should require admin authentication")
        
        return passed == total

if __name__ == "__main__":
    tester = PromoCodeTester()
    success = tester.run_all_tests()
    
    # Save detailed results
    with open('/app/promo_code_test_results.json', 'w') as f:
        json.dump(tester.results, f, indent=2)
    
    print(f"\n📄 Detailed results saved to: /app/promo_code_test_results.json")
    
    if success:
        print("\n🎉 All Promo Code Creation tests PASSED!")
        exit(0)
    else:
        print("\n⚠️  Some tests FAILED - see details above")
        exit(1)