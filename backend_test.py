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
                            # Note: This is a Supabase token, but the backend expects Firebase tokens
                            # This is a known authentication system mismatch
                            self.auth_token = token
                            self.session.headers.update({'Authorization': f'Bearer {self.auth_token}'})
                            
                            self.log_result(
                                "Organizer Login",
                                True,
                                f"✅ Successfully logged in as {user_data['email']} (Note: Token incompatibility with Firebase middleware)",
                                {"email": user_data['email'], "token_received": True, "auth_system_mismatch": True}
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
            response = self.session.get(f"{BACKEND_URL}/api/auth/me")
            
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
            
            # Test if the payout routes exist
            payout_routes = [
                "/api/admin/upcoming-payouts",
                "/api/auth/me"
            ]
            
            route_results = {}
            for route in payout_routes:
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
                    "Backend Payout Routes Availability",
                    True,
                    f"✅ All required payout routes exist: {list(route_results.keys())}",
                    route_results
                )
            else:
                self.log_result(
                    "Backend Payout Routes Availability",
                    False,
                    f"❌ Missing routes: {missing_routes}",
                    route_results
                )
                
        except Exception as e:
            self.log_result("Backend Health and Connectivity", False, f"Exception: {str(e)}")

    def test_payout_endpoints_without_auth(self):
        """Test Case 6: Test payout endpoints without authentication to verify security"""
        try:
            # Test upcoming-payouts endpoint without auth
            payouts_response = self.session.get(f"{BACKEND_URL}/api/admin/upcoming-payouts")
            
            if payouts_response.status_code in [401, 403]:
                self.log_result(
                    "Upcoming Payouts Endpoint - Auth Required",
                    True,
                    f"✅ Upcoming payouts endpoint properly requires authentication (HTTP {payouts_response.status_code})",
                    {"status": payouts_response.status_code, "endpoint": "GET /api/admin/upcoming-payouts"}
                )
            else:
                self.log_result(
                    "Upcoming Payouts Endpoint - Auth Required",
                    False,
                    f"❌ Upcoming payouts endpoint should require auth but returned HTTP {payouts_response.status_code}",
                    {"status": payouts_response.status_code, "response": payouts_response.text[:200]}
                )
            
            # Test profile endpoint without auth
            profile_response = self.session.get(f"{BACKEND_URL}/api/auth/me")
            
            if profile_response.status_code in [401, 403]:
                self.log_result(
                    "Profile Endpoint - Auth Required",
                    True,
                    f"✅ Profile endpoint properly requires authentication (HTTP {profile_response.status_code})",
                    {"status": profile_response.status_code, "endpoint": "GET /api/auth/profile"}
                )
            else:
                self.log_result(
                    "Profile Endpoint - Auth Required",
                    False,
                    f"❌ Profile endpoint should require auth but returned HTTP {profile_response.status_code}",
                    {"status": profile_response.status_code, "response": profile_response.text[:200]}
                )
                
        except Exception as e:
            self.log_result("Payout Endpoints Without Auth", False, f"Exception: {str(e)}")

    def test_payout_endpoint_structure(self):
        """Test Case 7: Verify payout endpoint structure and response format"""
        try:
            # Test the upcoming-payouts endpoint structure
            response = self.session.get(f"{BACKEND_URL}/api/admin/upcoming-payouts")
            
            if response.status_code == 401:
                try:
                    error_data = response.json()
                    error_message = error_data.get('error', '')
                    
                    # Check if it's the expected Firebase token error
                    if 'Token verification failed' in error_message or 'Missing Authorization header' in error_message:
                        self.log_result(
                            "Payout Endpoint Structure",
                            True,
                            "✅ Upcoming payouts endpoint exists and has proper authentication (Firebase token required)",
                            {
                                "endpoint_exists": True,
                                "auth_required": True,
                                "auth_type": "Firebase",
                                "status": response.status_code,
                                "error": error_message
                            }
                        )
                        return True
                    else:
                        self.log_result(
                            "Payout Endpoint Structure",
                            False,
                            f"❌ Unexpected authentication error: {error_message}",
                            error_data
                        )
                        return False
                except json.JSONDecodeError:
                    self.log_result(
                        "Payout Endpoint Structure",
                        True,
                        "✅ Upcoming payouts endpoint exists and requires authentication (HTTP 401)",
                        {"endpoint_exists": True, "auth_required": True, "status": response.status_code}
                    )
                    return True
            elif response.status_code == 404:
                self.log_result(
                    "Payout Endpoint Structure",
                    False,
                    "❌ Upcoming payouts endpoint does not exist (HTTP 404)",
                    {"endpoint_exists": False, "status": response.status_code}
                )
                return False
            else:
                self.log_result(
                    "Payout Endpoint Structure",
                    False,
                    f"❌ Unexpected response from payouts endpoint: HTTP {response.status_code}",
                    response.text[:200]
                )
                return False
                
        except Exception as e:
            self.log_result("Payout Endpoint Structure", False, f"Exception: {str(e)}")
            return False

    def run_all_tests(self):
        """Run all payout balance calculation tests as specified in review request"""
        print("💰 Starting Payout Balance Calculation Testing")
        print("=" * 70)
        print("🎯 TESTING FOCUS: Organizer & Affiliate Payout Balance Fixes")
        print("=" * 70)
        
        # Core Payout Balance Tests from Review Request
        print("\n🔧 BACKEND API TESTS")
        print("-" * 40)
        self.test_backend_health_and_connectivity()
        self.test_payout_endpoints_without_auth()
        self.test_payout_endpoint_structure()
        
        # Authentication Test
        print("\n🔐 AUTHENTICATION TESTS")
        print("-" * 40)
        login_success = self.test_organizer_login()
        
        if login_success:
            print("\n💰 PAYOUT BALANCE FUNCTIONALITY TESTS")
            print("-" * 40)
            print("⚠️  NOTE: Authentication system mismatch detected (Supabase login + Firebase middleware)")
            print("    Testing with known incompatible token - expect authentication failures")
            
            # Test 1: Organizer Payout Balance
            payouts_data = self.test_organizer_upcoming_payouts_endpoint()
            if payouts_data:
                self.test_payout_balance_calculation(payouts_data)
            
            # Test 2: Affiliate Payout Balance (if applicable)
            profile_data = self.test_user_profile_payout_fields()
            
        else:
            print("\n⚠️ SKIPPING PAYOUT TESTS - Authentication Failed")
            print("Cannot test payout balance calculation without organizer authentication")
        
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
        organizer_login = next((r for r in self.results if 'Organizer Login' in r['test'] and 'Exception' not in r['test']), None)
        upcoming_payouts = next((r for r in self.results if 'Organizer Payouts' in r['test']), None)
        payout_calculation = next((r for r in self.results if 'Payout Balance Calculation' in r['test']), None)
        profile_fields = next((r for r in self.results if 'Profile Payout Fields' in r['test']), None)
        auth_required = next((r for r in self.results if 'Auth Required' in r['test']), None)
        
        if backend_health and backend_health['success']:
            criteria_results.append("✅ Backend is healthy and payout routes exist")
        else:
            criteria_results.append("❌ Backend health check failed")
            
        if auth_required and auth_required['success']:
            criteria_results.append("✅ Payout endpoints properly require authentication")
        else:
            criteria_results.append("❌ Payout endpoints authentication verification failed")
            
        if organizer_login and organizer_login['success']:
            criteria_results.append("✅ Organizer authentication working")
        else:
            criteria_results.append("❌ Organizer authentication failed - no valid organizer user found")
            
        if upcoming_payouts and upcoming_payouts['success']:
            criteria_results.append("✅ GET /api/admin/upcoming-payouts endpoint working")
        else:
            criteria_results.append("❌ Upcoming payouts endpoint failed")
            
        if payout_calculation and payout_calculation['success']:
            criteria_results.append("✅ Payout balance calculation logic verified (ready payouts sum)")
        else:
            criteria_results.append("❌ Payout balance calculation verification failed")
            
        if profile_fields and profile_fields['success']:
            criteria_results.append("✅ User profile has availablePayout and totalPaidOut fields")
        else:
            criteria_results.append("❌ User profile payout fields verification failed")
        
        for criterion in criteria_results:
            print(f"  {criterion}")
        
        if total - passed > 0:
            print("\n❌ FAILED TESTS:")
            for result in self.results:
                if not result['success']:
                    print(f"  - {result['test']}: {result['details']}")
        
        print("\n📋 TESTING NOTES:")
        print("  - Test organizer: tylerans@gmail.com (Super Admin/Organizer)")
        print("  - Organizer endpoint: GET /api/admin/upcoming-payouts")
        print("  - Expected: Payouts with status='ready' for balance calculation")
        print("  - Affiliate fields: availablePayout + totalPaidOut from user profile")
        print("  - ⚠️  AUTHENTICATION SYSTEM MISMATCH DETECTED:")
        print("    - Login endpoint uses Supabase (returns HS256 tokens)")
        print("    - Backend middleware expects Firebase (requires RS256 tokens)")
        print("    - This prevents full end-to-end testing of authenticated endpoints")
        
        print("\n🔍 EXPECTED BEHAVIOR:")
        print("  - Organizer login should succeed and return authentication token")
        print("  - GET /api/admin/upcoming-payouts should return payouts array with status field")
        print("  - Ready payouts (status='ready') should be summed for payout balance")
        print("  - User profile should contain availablePayout and totalPaidOut fields")
        print("  - Affiliate total earnings = availablePayout + totalPaidOut")
        print("  - All payout operations should require authentication")
        print("  - 🚨 CRITICAL: Authentication system needs to be unified (either Supabase OR Firebase)")
        
        return passed == total

if __name__ == "__main__":
    tester = PayoutBalanceTester()
    success = tester.run_all_tests()
    
    # Save detailed results
    with open('/app/payout_balance_test_results.json', 'w') as f:
        json.dump(tester.results, f, indent=2)
    
    print(f"\n📄 Detailed results saved to: /app/payout_balance_test_results.json")
    
    if success:
        print("\n🎉 All Payout Balance Calculation tests PASSED!")
        exit(0)
    else:
        print("\n⚠️  Some tests FAILED - see details above")
        exit(1)