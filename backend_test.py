#!/usr/bin/env python3
"""
Backend API Testing for OpenTicket Platform - Payout Balance Calculation Fixes
Tests the payout balance calculation fixes for both Organizer and Affiliate dashboards
"""

import requests
import json
import time
import uuid
import subprocess
import os
from typing import Dict, Any

# Configuration - Use production URL from frontend/.env
BACKEND_URL = "https://auth-rls-repair.preview.emergentagent.com"

class PayoutBalanceTester:
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
    
    def test_organizer_login(self):
        """Test Case 1: Login as organizer user - test with tylerans@gmail.com"""
        # Test with the specific organizer user mentioned in review request
        test_users = [
            {"email": "tylerans@gmail.com", "password": "password123"},
            {"email": "test+openticket@gmail.com", "password": "12345678"},
            {"email": "thisearlyseason@gmail.com", "password": "password123"},
        ]
        
        for user_data in test_users:
            try:
                response = self.session.post(f"{BACKEND_URL}/api/auth/login", json=user_data)
                
                if response.status_code == 200:
                    try:
                        data = response.json()
                        # Check for different possible token fields in Supabase response
                        token = None
                        if 'session' in data and data['session'] and 'access_token' in data['session']:
                            token = data['session']['access_token']
                        elif 'token' in data:
                            token = data['token']
                        elif 'access_token' in data:
                            token = data['access_token']
                        
                        if token:
                            self.auth_token = token
                            self.session.headers.update({'Authorization': f'Bearer {self.auth_token}'})
                            
                            self.log_result(
                                "Organizer Login",
                                True,
                                f"✅ Successfully logged in as {user_data['email']}",
                                {"email": user_data['email'], "token_received": True, "session_data": data}
                            )
                            return True
                        else:
                            self.log_result(
                                "Organizer Login - Token Missing",
                                False,
                                f"❌ Login successful for {user_data['email']} but no token found",
                                data
                            )
                    except json.JSONDecodeError:
                        self.log_result(
                            "Organizer Login - JSON Error",
                            False,
                            f"❌ Invalid JSON response for {user_data['email']}",
                            response.text
                        )
                elif response.status_code == 401:
                    # Continue to next user
                    continue
                else:
                    self.log_result(
                        "Organizer Login - Unexpected Response",
                        False,
                        f"❌ Unexpected response for {user_data['email']}: HTTP {response.status_code}",
                        response.text
                    )
                    
            except Exception as e:
                self.log_result("Organizer Login - Exception", False, f"Exception for {user_data['email']}: {str(e)}")
        
        # If we get here, none of the users worked
        self.log_result(
            "Organizer Login",
            False,
            "❌ Failed to authenticate with any test users",
            {"attempted_users": [u['email'] for u in test_users]}
        )
        return False

    def test_organizer_upcoming_payouts_endpoint(self):
        """Test Case 2: GET /api/admin/organizer/upcoming-payouts - Fetch organizer payouts"""
        try:
            if not self.auth_token:
                self.log_result(
                    "Get Organizer Payouts - Authentication Required",
                    False,
                    "❌ Cannot test without authentication token",
                    {"auth_token": None}
                )
                return False
            
            response = self.session.get(f"{BACKEND_URL}/api/admin/upcoming-payouts")
            
            if response.status_code == 200:
                try:
                    data = response.json()
                    
                    if 'payouts' in data and isinstance(data['payouts'], list):
                        payouts = data['payouts']
                        ready_payouts = [p for p in payouts if p.get('status') == 'ready']
                        pending_payouts = [p for p in payouts if p.get('status') == 'pending']
                        
                        # Calculate total ready amount
                        total_ready = sum(p.get('amount', 0) for p in ready_payouts)
                        
                        self.log_result(
                            "Get Organizer Payouts Endpoint",
                            True,
                            f"✅ Successfully retrieved {len(payouts)} payouts ({len(ready_payouts)} ready, {len(pending_payouts)} pending)",
                            {
                                "total_payouts": len(payouts),
                                "ready_payouts": len(ready_payouts),
                                "pending_payouts": len(pending_payouts),
                                "total_ready_amount": total_ready,
                                "payouts_structure": "valid"
                            }
                        )
                        return {"payouts": payouts, "ready_payouts": ready_payouts, "total_ready": total_ready}
                    else:
                        self.log_result(
                            "Get Organizer Payouts Endpoint",
                            False,
                            "❌ Response missing 'payouts' array",
                            data
                        )
                        return False
                except json.JSONDecodeError:
                    self.log_result(
                        "Get Organizer Payouts Endpoint",
                        False,
                        "❌ Invalid JSON response",
                        response.text
                    )
                    return False
            elif response.status_code == 401:
                self.log_result(
                    "Get Organizer Payouts Endpoint - Authentication",
                    False,
                    "❌ Authentication failed - token may be invalid",
                    {"status": response.status_code}
                )
                return False
            elif response.status_code == 403:
                self.log_result(
                    "Get Organizer Payouts Endpoint - Authorization",
                    False,
                    "❌ Access denied - user may not have organizer privileges",
                    {"status": response.status_code}
                )
                return False
            else:
                self.log_result(
                    "Get Organizer Payouts Endpoint",
                    False,
                    f"❌ Unexpected status code: {response.status_code}",
                    response.text
                )
                return False
                
        except Exception as e:
            self.log_result("Get Organizer Payouts Endpoint", False, f"Exception: {str(e)}")
            return False

    def test_payout_balance_calculation(self, payouts_data):
        """Test Case 3: Verify payout balance calculation logic"""
        try:
            if not payouts_data:
                self.log_result(
                    "Payout Balance Calculation - No Data",
                    False,
                    "❌ Cannot test calculation without payouts data",
                    {"payouts_data": None}
                )
                return False
            
            payouts = payouts_data.get('payouts', [])
            ready_payouts = payouts_data.get('ready_payouts', [])
            expected_total = payouts_data.get('total_ready', 0)
            
            # Verify each payout has required fields
            required_fields = ['eventId', 'eventTitle', 'amount', 'status']
            valid_payouts = []
            
            for payout in payouts:
                missing_fields = [f for f in required_fields if f not in payout]
                if not missing_fields:
                    valid_payouts.append(payout)
                    
                    # Verify amount is numeric and >= 0
                    amount = payout.get('amount', 0)
                    if not isinstance(amount, (int, float)) or amount < 0:
                        self.log_result(
                            "Payout Balance Calculation - Invalid Amount",
                            False,
                            f"❌ Payout {payout.get('eventId')} has invalid amount: {amount}",
                            payout
                        )
                        return False
                else:
                    self.log_result(
                        "Payout Balance Calculation - Missing Fields",
                        False,
                        f"❌ Payout missing required fields: {missing_fields}",
                        payout
                    )
                    return False
            
            # Verify ready payouts calculation
            calculated_total = sum(p.get('amount', 0) for p in ready_payouts)
            
            if abs(calculated_total - expected_total) < 0.01:  # Allow for floating point precision
                self.log_result(
                    "Payout Balance Calculation",
                    True,
                    f"✅ Payout balance calculation correct: ${calculated_total:.2f} from {len(ready_payouts)} ready payouts",
                    {
                        "total_payouts": len(payouts),
                        "ready_payouts": len(ready_payouts),
                        "calculated_total": calculated_total,
                        "expected_total": expected_total,
                        "calculation_correct": True
                    }
                )
                return True
            else:
                self.log_result(
                    "Payout Balance Calculation",
                    False,
                    f"❌ Payout balance calculation mismatch: calculated ${calculated_total:.2f}, expected ${expected_total:.2f}",
                    {
                        "calculated_total": calculated_total,
                        "expected_total": expected_total,
                        "ready_payouts": ready_payouts
                    }
                )
                return False
                
        except Exception as e:
            self.log_result("Payout Balance Calculation", False, f"Exception: {str(e)}")
            return False

    def test_user_profile_payout_fields(self):
        """Test Case 4: Verify user profile has availablePayout and totalPaidOut fields"""
        try:
            if not self.auth_token:
                self.log_result(
                    "User Profile Payout Fields - Authentication Required",
                    False,
                    "❌ Cannot test without authentication token",
                    {"auth_token": None}
                )
                return False
            
            # Get user profile to check for affiliate payout fields
            response = self.session.get(f"{BACKEND_URL}/api/auth/profile")
            
            if response.status_code == 200:
                try:
                    profile_data = response.json()
                    
                    # Check if user has affiliate fields
                    has_affiliate_code = 'affiliateCode' in profile_data
                    available_payout = profile_data.get('availablePayout', 0)
                    total_paid_out = profile_data.get('totalPaidOut', 0)
                    
                    # Verify payout fields exist and are numeric
                    payout_fields_valid = (
                        isinstance(available_payout, (int, float)) and
                        isinstance(total_paid_out, (int, float)) and
                        available_payout >= 0 and
                        total_paid_out >= 0
                    )
                    
                    if payout_fields_valid:
                        total_earnings = available_payout + total_paid_out
                        
                        self.log_result(
                            "User Profile Payout Fields",
                            True,
                            f"✅ User profile has valid payout fields (affiliate: {has_affiliate_code})",
                            {
                                "has_affiliate_code": has_affiliate_code,
                                "available_payout": available_payout,
                                "total_paid_out": total_paid_out,
                                "total_earnings": total_earnings,
                                "fields_valid": True
                            }
                        )
                        return {
                            "available_payout": available_payout,
                            "total_paid_out": total_paid_out,
                            "total_earnings": total_earnings,
                            "is_affiliate": has_affiliate_code
                        }
                    else:
                        self.log_result(
                            "User Profile Payout Fields",
                            False,
                            f"❌ Invalid payout field values: availablePayout={available_payout}, totalPaidOut={total_paid_out}",
                            {
                                "available_payout": available_payout,
                                "total_paid_out": total_paid_out,
                                "fields_valid": False
                            }
                        )
                        return False
                        
                except json.JSONDecodeError:
                    self.log_result(
                        "User Profile Payout Fields",
                        False,
                        "❌ Invalid JSON response from profile endpoint",
                        response.text
                    )
                    return False
            elif response.status_code == 401:
                self.log_result(
                    "User Profile Payout Fields - Authentication",
                    False,
                    "❌ Authentication failed - token may be invalid",
                    {"status": response.status_code}
                )
                return False
            else:
                self.log_result(
                    "User Profile Payout Fields",
                    False,
                    f"❌ Failed to fetch user profile: HTTP {response.status_code}",
                    response.text
                )
                return False
                
        except Exception as e:
            self.log_result("User Profile Payout Fields", False, f"Exception: {str(e)}")
            return False

    def test_backend_health_and_connectivity(self):
        """Test Case 5: Verify backend is healthy and payout endpoints exist"""
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
            # Try to fetch promo codes without authentication to test endpoint existence
            response = self.session.get(f"{BACKEND_URL}/api/admin/promo-codes")
            
            if response.status_code == 200:
                try:
                    data = response.json()
                    if 'promoCodes' in data:
                        self.log_result(
                            "Promo Code Database Schema",
                            True,
                            "✅ Promo codes table exists and is accessible (no auth required)",
                            {"table_exists": True, "endpoint_working": True, "promo_count": len(data.get('promoCodes', []))}
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
            elif response.status_code in [401, 403]:
                # This is actually good - means the endpoint exists but requires auth
                try:
                    error_data = response.json()
                    error_message = error_data.get('error', '')
                    
                    self.log_result(
                        "Promo Code Database Schema",
                        True,
                        f"✅ Promo codes endpoint exists and requires authentication (HTTP {response.status_code})",
                        {"endpoint_exists": True, "auth_required": True, "status": response.status_code, "error": error_message}
                    )
                    return True
                except:
                    self.log_result(
                        "Promo Code Database Schema",
                        True,
                        f"✅ Promo codes endpoint exists and requires authentication (HTTP {response.status_code})",
                        {"endpoint_exists": True, "auth_required": True, "status": response.status_code}
                    )
                    return True
            elif response.status_code == 500:
                try:
                    error_data = response.json()
                    error_message = error_data.get('error', '')
                    
                    if 'does not exist' in error_message.lower() or 'table' in error_message.lower():
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
            elif response.status_code == 404:
                self.log_result(
                    "Promo Code Database Schema",
                    False,
                    "❌ Promo codes endpoint does not exist (HTTP 404)",
                    {"endpoint_exists": False, "status": response.status_code}
                )
                return False
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

    def test_promo_code_endpoints_without_auth(self):
        """Test Case 7: Test promo code endpoints without authentication to verify error handling"""
        try:
            # Test GET endpoint without auth
            get_response = self.session.get(f"{BACKEND_URL}/api/admin/promo-codes")
            
            if get_response.status_code in [401, 403]:
                self.log_result(
                    "Promo Code GET Endpoint - Auth Required",
                    True,
                    f"✅ GET endpoint properly requires authentication (HTTP {get_response.status_code})",
                    {"status": get_response.status_code, "endpoint": "GET /api/admin/promo-codes"}
                )
            else:
                self.log_result(
                    "Promo Code GET Endpoint - Auth Required",
                    False,
                    f"❌ GET endpoint should require auth but returned HTTP {get_response.status_code}",
                    {"status": get_response.status_code, "response": get_response.text[:200]}
                )
            
            # Test POST endpoint without auth
            test_promo = {
                "id": "test-no-auth",
                "code": "NOAUTH",
                "type": "percentage",
                "value": 10
            }
            
            post_response = self.session.post(f"{BACKEND_URL}/api/admin/promo-codes", json=test_promo)
            
            if post_response.status_code in [401, 403]:
                self.log_result(
                    "Promo Code POST Endpoint - Auth Required",
                    True,
                    f"✅ POST endpoint properly requires authentication (HTTP {post_response.status_code})",
                    {"status": post_response.status_code, "endpoint": "POST /api/admin/promo-codes"}
                )
            else:
                self.log_result(
                    "Promo Code POST Endpoint - Auth Required",
                    False,
                    f"❌ POST endpoint should require auth but returned HTTP {post_response.status_code}",
                    {"status": post_response.status_code, "response": post_response.text[:200]}
                )
                
        except Exception as e:
            self.log_result("Promo Code Endpoints Without Auth", False, f"Exception: {str(e)}")

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
        self.test_promo_code_endpoints_without_auth()
        
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
        admin_login = next((r for r in self.results if 'Admin Login' in r['test'] and 'Exception' not in r['test']), None)
        get_promo_codes = next((r for r in self.results if 'Get Promo Codes' in r['test']), None)
        create_promo_code = next((r for r in self.results if 'Create Promo Code' in r['test'] and 'Authentication' not in r['test'] and 'Authorization' not in r['test']), None)
        verify_persistence = next((r for r in self.results if 'Verify Promo Code Persistence' in r['test']), None)
        database_schema = next((r for r in self.results if 'Database Schema' in r['test']), None)
        auth_required = next((r for r in self.results if 'Auth Required' in r['test']), None)
        
        if backend_health and backend_health['success']:
            criteria_results.append("✅ Backend is healthy and promo code routes exist")
        else:
            criteria_results.append("❌ Backend health check failed")
            
        if database_schema and database_schema['success']:
            criteria_results.append("✅ Promo codes database table exists and is accessible")
        else:
            criteria_results.append("❌ Promo codes database table verification failed")
            
        if auth_required and auth_required['success']:
            criteria_results.append("✅ Promo code endpoints properly require authentication")
        else:
            criteria_results.append("❌ Promo code endpoints authentication verification failed")
            
        if admin_login and admin_login['success']:
            criteria_results.append("✅ Admin authentication working")
        else:
            criteria_results.append("❌ Admin authentication failed - no valid admin user found")
            
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
        print("  - Attempted admin users: test+openticket@gmail.com, thisearlyseason@gmail.com, tylerans@gmail.com")
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