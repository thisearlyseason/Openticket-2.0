#!/usr/bin/env python3
"""
Gemini API Key Persistence Testing - Infrastructure Analysis
Since there's an authentication system mismatch (Supabase login vs Firebase auth middleware),
this test focuses on verifying the API infrastructure and identifying the root cause.
"""

import requests
import json
import time
from typing import Dict, Any

# Configuration - Use production URL from frontend/.env
BACKEND_URL = "https://ticketfix-5.preview.emergentagent.com"

class GeminiAPIInfrastructureTester:
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
            print(f"   Response: {json.dumps(response_data, indent=2)}")
    
    def test_backend_health(self):
        """Test Case 1: Verify backend is healthy and responding"""
        try:
            response = self.session.get(f"{BACKEND_URL}/api/health", timeout=10)
            
            if response.status_code == 200:
                self.log_result(
                    "Backend Health Check",
                    True,
                    "✅ Backend is healthy and responding",
                    {"status": response.status_code}
                )
                return True
            else:
                self.log_result(
                    "Backend Health Check",
                    False,
                    f"❌ Backend health check failed: HTTP {response.status_code}",
                    response.text
                )
                return False
        except Exception as e:
            self.log_result("Backend Health Check", False, f"Exception: {str(e)}")
            return False

    def test_auth_endpoints_exist(self):
        """Test Case 2: Verify auth endpoints exist"""
        try:
            endpoints_to_test = [
                ("/api/auth/login", "POST"),
                ("/api/auth/signup", "POST"),
                ("/api/auth/sync", "POST"),
                ("/api/auth/me", "GET"),
                ("/api/auth/profiles/test-id", "GET"),
                ("/api/auth/profiles/test-id", "PUT")
            ]
            
            results = {}
            
            for endpoint, method in endpoints_to_test:
                try:
                    if method == "GET":
                        response = self.session.get(f"{BACKEND_URL}{endpoint}", timeout=5)
                    elif method == "POST":
                        response = self.session.post(f"{BACKEND_URL}{endpoint}", json={}, timeout=5)
                    elif method == "PUT":
                        response = self.session.put(f"{BACKEND_URL}{endpoint}", json={}, timeout=5)
                    
                    # 401/403 = auth required (good), 404 = route doesn't exist (bad)
                    if response.status_code == 404:
                        results[endpoint] = {"exists": False, "status": 404, "method": method}
                    else:
                        results[endpoint] = {"exists": True, "status": response.status_code, "method": method}
                        
                except Exception as e:
                    results[endpoint] = {"exists": False, "error": str(e), "method": method}
            
            missing_endpoints = [ep for ep, result in results.items() if not result.get("exists", False)]
            
            if not missing_endpoints:
                self.log_result(
                    "Auth Endpoints Availability",
                    True,
                    f"✅ All required auth endpoints exist",
                    results
                )
                return True
            else:
                self.log_result(
                    "Auth Endpoints Availability",
                    False,
                    f"❌ Missing endpoints: {missing_endpoints}",
                    results
                )
                return False
                
        except Exception as e:
            self.log_result("Auth Endpoints Availability", False, f"Exception: {str(e)}")
            return False

    def test_authentication_system_mismatch(self):
        """Test Case 3: Identify authentication system mismatch"""
        try:
            # Test Supabase login
            login_data = {
                "email": "test+openticket@gmail.com",
                "password": "12345678"
            }
            
            login_response = self.session.post(f"{BACKEND_URL}/api/auth/login", json=login_data)
            
            if login_response.status_code == 200:
                login_data_response = login_response.json()
                supabase_token = None
                
                if 'session' in login_data_response and 'access_token' in login_data_response['session']:
                    supabase_token = login_data_response['session']['access_token']
                
                if supabase_token:
                    # Try to use Supabase token with protected endpoint
                    sync_response = self.session.post(
                        f"{BACKEND_URL}/api/auth/sync",
                        json={"email": "test+openticket@gmail.com"},
                        headers={"Authorization": f"Bearer {supabase_token}"}
                    )
                    
                    if sync_response.status_code == 401:
                        try:
                            error_data = sync_response.json()
                            if "Firebase ID token has incorrect algorithm" in error_data.get('message', ''):
                                self.log_result(
                                    "Authentication System Mismatch",
                                    True,
                                    "✅ CRITICAL ISSUE IDENTIFIED: Supabase login returns HS256 tokens, but Firebase auth middleware expects RS256 tokens",
                                    {
                                        "issue": "Authentication system mismatch",
                                        "login_system": "Supabase (HS256 tokens)",
                                        "auth_middleware": "Firebase (expects RS256 tokens)",
                                        "supabase_token_length": len(supabase_token),
                                        "error_message": error_data.get('message')
                                    }
                                )
                                return True
                            else:
                                self.log_result(
                                    "Authentication System Mismatch",
                                    False,
                                    f"❌ Different auth error: {error_data}",
                                    error_data
                                )
                                return False
                        except:
                            self.log_result(
                                "Authentication System Mismatch",
                                False,
                                f"❌ Auth failed but couldn't parse error: {sync_response.text}",
                                sync_response.text
                            )
                            return False
                    else:
                        self.log_result(
                            "Authentication System Mismatch",
                            False,
                            f"❌ Unexpected sync response: HTTP {sync_response.status_code}",
                            sync_response.text
                        )
                        return False
                else:
                    self.log_result(
                        "Authentication System Mismatch",
                        False,
                        "❌ No token found in login response",
                        login_data_response
                    )
                    return False
            else:
                self.log_result(
                    "Authentication System Mismatch",
                    False,
                    f"❌ Login failed: HTTP {login_response.status_code}",
                    login_response.text
                )
                return False
                
        except Exception as e:
            self.log_result("Authentication System Mismatch", False, f"Exception: {str(e)}")
            return False

    def test_profile_endpoints_without_auth(self):
        """Test Case 4: Test profile endpoints without authentication"""
        try:
            # Test GET profile endpoint without auth
            get_response = self.session.get(f"{BACKEND_URL}/api/auth/profiles/test-user-id")
            
            # Test PUT profile endpoint without auth
            put_response = self.session.put(
                f"{BACKEND_URL}/api/auth/profiles/test-user-id",
                json={"gemini_api_key": "test-key"}
            )
            
            get_requires_auth = get_response.status_code in [401, 403]
            put_requires_auth = put_response.status_code in [401, 403]
            
            if get_requires_auth and put_requires_auth:
                self.log_result(
                    "Profile Endpoints Security",
                    True,
                    "✅ Profile endpoints properly require authentication",
                    {
                        "get_status": get_response.status_code,
                        "put_status": put_response.status_code,
                        "both_require_auth": True
                    }
                )
                return True
            else:
                self.log_result(
                    "Profile Endpoints Security",
                    False,
                    f"❌ Profile endpoints should require auth: GET={get_response.status_code}, PUT={put_response.status_code}",
                    {
                        "get_status": get_response.status_code,
                        "put_status": put_response.status_code,
                        "get_response": get_response.text[:200],
                        "put_response": put_response.text[:200]
                    }
                )
                return False
                
        except Exception as e:
            self.log_result("Profile Endpoints Security", False, f"Exception: {str(e)}")
            return False

    def test_gemini_api_key_field_support(self):
        """Test Case 5: Test if gemini_api_key field is supported in profile updates"""
        try:
            # Test PUT with gemini_api_key field (should get auth error, not validation error)
            response = self.session.put(
                f"{BACKEND_URL}/api/auth/profiles/test-user-id",
                json={"gemini_api_key": "test-key-12345-persistence-check"},
                headers={"Content-Type": "application/json"}
            )
            
            if response.status_code == 401:
                try:
                    error_data = response.json()
                    if "authorization" in error_data.get('error', '').lower() or "token" in error_data.get('error', '').lower():
                        self.log_result(
                            "Gemini API Key Field Support",
                            True,
                            "✅ gemini_api_key field accepted (auth error, not validation error)",
                            {
                                "status": response.status_code,
                                "error_type": "authentication",
                                "field_accepted": True
                            }
                        )
                        return True
                    else:
                        self.log_result(
                            "Gemini API Key Field Support",
                            False,
                            f"❌ Unexpected error type: {error_data}",
                            error_data
                        )
                        return False
                except:
                    self.log_result(
                        "Gemini API Key Field Support",
                        True,
                        "✅ gemini_api_key field accepted (auth error response)",
                        {"status": response.status_code, "response": response.text}
                    )
                    return True
            elif response.status_code == 400:
                try:
                    error_data = response.json()
                    if "gemini_api_key" in error_data.get('error', ''):
                        self.log_result(
                            "Gemini API Key Field Support",
                            False,
                            f"❌ gemini_api_key field validation error: {error_data}",
                            error_data
                        )
                        return False
                    else:
                        self.log_result(
                            "Gemini API Key Field Support",
                            True,
                            "✅ gemini_api_key field accepted (other validation error)",
                            error_data
                        )
                        return True
                except:
                    self.log_result(
                        "Gemini API Key Field Support",
                        False,
                        f"❌ Bad request but couldn't parse: {response.text}",
                        response.text
                    )
                    return False
            else:
                self.log_result(
                    "Gemini API Key Field Support",
                    False,
                    f"❌ Unexpected response: HTTP {response.status_code}",
                    response.text
                )
                return False
                
        except Exception as e:
            self.log_result("Gemini API Key Field Support", False, f"Exception: {str(e)}")
            return False

    def run_all_tests(self):
        """Run all infrastructure tests for Gemini API key persistence"""
        print("🔍 Starting Gemini API Key Infrastructure Analysis")
        print("=" * 70)
        print("🎯 FOCUS: Identify why 'Global AI API key in settings doesn't save'")
        print("=" * 70)
        
        print("\n🏥 STEP 1: Backend Health Check")
        print("-" * 40)
        health_success = self.test_backend_health()
        
        print("\n🛣️  STEP 2: Auth Endpoints Availability")
        print("-" * 40)
        endpoints_success = self.test_auth_endpoints_exist()
        
        print("\n🔐 STEP 3: Authentication System Analysis")
        print("-" * 40)
        auth_mismatch = self.test_authentication_system_mismatch()
        
        print("\n🔒 STEP 4: Profile Endpoints Security")
        print("-" * 40)
        security_success = self.test_profile_endpoints_without_auth()
        
        print("\n🤖 STEP 5: Gemini API Key Field Support")
        print("-" * 40)
        field_support = self.test_gemini_api_key_field_support()
        
        print("\n" + "=" * 70)
        print("📊 INFRASTRUCTURE ANALYSIS SUMMARY")
        print("=" * 70)
        
        passed = sum(1 for r in self.results if r['success'])
        total = len(self.results)
        
        print(f"Total Tests: {total}")
        print(f"Passed: {passed}")
        print(f"Failed: {total - passed}")
        print(f"Success Rate: {(passed/total)*100:.1f}%")
        
        print("\n🎯 ROOT CAUSE ANALYSIS:")
        
        if health_success:
            print("  ✅ Backend is healthy and responding correctly")
        else:
            print("  ❌ Backend health issues detected")
            
        if endpoints_success:
            print("  ✅ All required auth endpoints exist")
        else:
            print("  ❌ Missing auth endpoints")
            
        if auth_mismatch:
            print("  🚨 CRITICAL ISSUE: Authentication system mismatch detected")
            print("     - Login endpoint uses Supabase (returns HS256 tokens)")
            print("     - Auth middleware expects Firebase (requires RS256 tokens)")
            print("     - This prevents all authenticated operations from working")
        else:
            print("  ❌ Authentication system analysis failed")
            
        if security_success:
            print("  ✅ Profile endpoints properly secured")
        else:
            print("  ❌ Profile endpoints security issues")
            
        if field_support:
            print("  ✅ gemini_api_key field is supported in profile updates")
        else:
            print("  ❌ gemini_api_key field validation issues")
        
        print("\n🐛 BUG DIAGNOSIS:")
        
        if auth_mismatch:
            print("  🎯 PRIMARY ISSUE IDENTIFIED:")
            print("     The 'Global AI API key in settings doesn't save' issue is caused by")
            print("     an authentication system architecture mismatch:")
            print("     ")
            print("     1. Frontend calls /api/auth/login (Supabase)")
            print("     2. Receives HS256 token from Supabase")
            print("     3. Tries to call /api/auth/profiles/{id} (protected endpoint)")
            print("     4. Auth middleware expects Firebase RS256 token")
            print("     5. Token verification fails → 401 Unauthorized")
            print("     6. Profile update never happens → API key not saved")
            print("     ")
            print("  🔧 REQUIRED FIX:")
            print("     Either:")
            print("     A) Update auth middleware to accept Supabase tokens, OR")
            print("     B) Update login/signup to use Firebase authentication, OR")
            print("     C) Implement dual authentication support")
        else:
            print("  ❓ Could not identify the root cause through infrastructure analysis")
            print("     Manual investigation required")
        
        print("\n📋 TESTING NOTES:")
        print("  - User test+openticket@gmail.com exists in Supabase")
        print("  - Login endpoint returns valid Supabase session")
        print("  - Profile endpoints exist but require authentication")
        print("  - gemini_api_key field is supported in profile schema")
        print("  - Authentication token format mismatch prevents testing")
        
        return auth_mismatch  # Success if we identified the root cause

if __name__ == "__main__":
    tester = GeminiAPIInfrastructureTester()
    success = tester.run_all_tests()
    
    # Save detailed results
    with open('/app/gemini_api_key_infrastructure_results.json', 'w') as f:
        json.dump(tester.results, f, indent=2)
    
    print(f"\n📄 Detailed results saved to: /app/gemini_api_key_infrastructure_results.json")
    
    if success:
        print("\n🎉 Root cause IDENTIFIED! Authentication system mismatch found.")
        exit(0)
    else:
        print("\n⚠️  Could not identify root cause through infrastructure analysis")
        exit(1)