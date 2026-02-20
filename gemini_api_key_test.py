#!/usr/bin/env python3
"""
Gemini API Key Persistence Testing for OpenTicket Platform
Tests the specific issue: Global AI API key in settings doesn't save - it removes on logout/page reload

Test Requirements from Review Request:
1. Login and get user profile
2. Update profile with Gemini API key
3. Verify it was saved - Get profile
4. Simulate logout/reload - Get profile again
5. Verify gemini_api_key is still present
"""

import requests
import json
import time
import uuid
from typing import Dict, Any

# Configuration - Use production URL from frontend/.env
BACKEND_URL = "https://payout-system-14.preview.emergentagent.com"

class GeminiAPIKeyTester:
    def __init__(self):
        self.results = []
        self.session = requests.Session()
        self.auth_token = None
        self.user_id = None
        self.test_api_key = "test-key-12345-persistence-check"
        
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
    
    def test_login_and_get_profile(self):
        """Test Case 1: Login and get user profile"""
        try:
            # Login with the specified test user
            login_data = {
                "email": "test+openticket@gmail.com",
                "password": "12345678"
            }
            
            response = self.session.post(f"{BACKEND_URL}/api/auth/login", json=login_data)
            
            if response.status_code == 200:
                try:
                    data = response.json()
                    # Check for different possible token fields in Supabase response
                    token = None
                    if 'session' in data and data['session'] and 'access_token' in data['session']:
                        token = data['session']['access_token']
                        # Get user ID from session
                        if 'user' in data['session'] and 'id' in data['session']['user']:
                            self.user_id = data['session']['user']['id']
                    elif 'token' in data:
                        token = data['token']
                    elif 'access_token' in data:
                        token = data['access_token']
                    
                    if token and self.user_id:
                        self.auth_token = token
                        self.session.headers.update({'Authorization': f'Bearer {self.auth_token}'})
                        
                        self.log_result(
                            "Login and Authentication",
                            True,
                            f"✅ Successfully logged in as {login_data['email']}",
                            {"email": login_data['email'], "user_id": self.user_id, "token_received": True}
                        )
                        return True
                    else:
                        self.log_result(
                            "Login and Authentication",
                            False,
                            f"❌ Login successful but missing token or user_id",
                            {"token_present": bool(token), "user_id_present": bool(self.user_id), "response": data}
                        )
                        return False
                except json.JSONDecodeError:
                    self.log_result(
                        "Login and Authentication",
                        False,
                        f"❌ Invalid JSON response",
                        response.text
                    )
                    return False
            elif response.status_code == 401:
                self.log_result(
                    "Login and Authentication",
                    False,
                    f"❌ Invalid login credentials for {login_data['email']}",
                    {"status": response.status_code, "response": response.text}
                )
                return False
            else:
                self.log_result(
                    "Login and Authentication",
                    False,
                    f"❌ Unexpected response: HTTP {response.status_code}",
                    response.text
                )
                return False
                    
        except Exception as e:
            self.log_result("Login and Authentication", False, f"Exception: {str(e)}")
            return False

    def test_get_initial_profile(self):
        """Test Case 2: Get initial user profile to check current gemini_api_key"""
        try:
            if not self.auth_token or not self.user_id:
                self.log_result(
                    "Get Initial Profile",
                    False,
                    "❌ Cannot test without authentication token and user ID",
                    {"auth_token": bool(self.auth_token), "user_id": bool(self.user_id)}
                )
                return False
            
            response = self.session.get(f"{BACKEND_URL}/api/auth/profiles/{self.user_id}")
            
            if response.status_code == 200:
                try:
                    data = response.json()
                    profile = data.get('profile', {})
                    
                    current_gemini_key = profile.get('gemini_api_key')
                    
                    self.log_result(
                        "Get Initial Profile",
                        True,
                        f"✅ Successfully retrieved profile. Current gemini_api_key: {current_gemini_key or 'None'}",
                        {
                            "profile_id": profile.get('id'),
                            "email": profile.get('email'),
                            "current_gemini_api_key": current_gemini_key,
                            "subscription_settings": profile.get('subscription', {}).get('settings', {})
                        }
                    )
                    return profile
                except json.JSONDecodeError:
                    self.log_result(
                        "Get Initial Profile",
                        False,
                        "❌ Invalid JSON response",
                        response.text
                    )
                    return False
            else:
                self.log_result(
                    "Get Initial Profile",
                    False,
                    f"❌ Failed to get profile: HTTP {response.status_code}",
                    response.text
                )
                return False
                
        except Exception as e:
            self.log_result("Get Initial Profile", False, f"Exception: {str(e)}")
            return False

    def test_update_profile_with_gemini_key(self):
        """Test Case 3: Update profile with Gemini API key"""
        try:
            if not self.auth_token or not self.user_id:
                self.log_result(
                    "Update Profile with Gemini Key",
                    False,
                    "❌ Cannot test without authentication token and user ID",
                    {"auth_token": bool(self.auth_token), "user_id": bool(self.user_id)}
                )
                return False
            
            # Update profile with gemini_api_key as specified in review request
            update_data = {
                "gemini_api_key": self.test_api_key
            }
            
            response = self.session.put(
                f"{BACKEND_URL}/api/auth/profiles/{self.user_id}",
                json=update_data,
                headers={"Content-Type": "application/json"}
            )
            
            if response.status_code == 200:
                try:
                    data = response.json()
                    profile = data.get('profile', {})
                    
                    # Check if the gemini_api_key was saved
                    saved_key = profile.get('gemini_api_key')
                    
                    if saved_key == self.test_api_key:
                        self.log_result(
                            "Update Profile with Gemini Key",
                            True,
                            f"✅ Successfully updated profile with gemini_api_key: {saved_key}",
                            {
                                "updated_gemini_api_key": saved_key,
                                "matches_test_key": saved_key == self.test_api_key,
                                "subscription_data": profile.get('subscription', {})
                            }
                        )
                        return True
                    else:
                        self.log_result(
                            "Update Profile with Gemini Key",
                            False,
                            f"❌ Gemini API key not saved correctly. Expected: {self.test_api_key}, Got: {saved_key}",
                            {
                                "expected": self.test_api_key,
                                "actual": saved_key,
                                "profile_response": profile
                            }
                        )
                        return False
                except json.JSONDecodeError:
                    self.log_result(
                        "Update Profile with Gemini Key",
                        False,
                        "❌ Invalid JSON response",
                        response.text
                    )
                    return False
            else:
                self.log_result(
                    "Update Profile with Gemini Key",
                    False,
                    f"❌ Failed to update profile: HTTP {response.status_code}",
                    response.text
                )
                return False
                
        except Exception as e:
            self.log_result("Update Profile with Gemini Key", False, f"Exception: {str(e)}")
            return False

    def test_verify_key_saved(self):
        """Test Case 4: Verify gemini_api_key was saved - Get profile again"""
        try:
            if not self.auth_token or not self.user_id:
                self.log_result(
                    "Verify Key Saved",
                    False,
                    "❌ Cannot test without authentication token and user ID",
                    {"auth_token": bool(self.auth_token), "user_id": bool(self.user_id)}
                )
                return False
            
            response = self.session.get(f"{BACKEND_URL}/api/auth/profiles/{self.user_id}")
            
            if response.status_code == 200:
                try:
                    data = response.json()
                    profile = data.get('profile', {})
                    
                    saved_key = profile.get('gemini_api_key')
                    
                    if saved_key == self.test_api_key:
                        self.log_result(
                            "Verify Key Saved",
                            True,
                            f"✅ Gemini API key persisted correctly: {saved_key}",
                            {
                                "gemini_api_key": saved_key,
                                "matches_test_key": True,
                                "stored_in_subscription_settings": bool(profile.get('subscription', {}).get('settings', {}).get('gemini_api_key'))
                            }
                        )
                        return True
                    else:
                        self.log_result(
                            "Verify Key Saved",
                            False,
                            f"❌ Gemini API key not found or incorrect. Expected: {self.test_api_key}, Got: {saved_key}",
                            {
                                "expected": self.test_api_key,
                                "actual": saved_key,
                                "subscription_settings": profile.get('subscription', {}).get('settings', {})
                            }
                        )
                        return False
                except json.JSONDecodeError:
                    self.log_result(
                        "Verify Key Saved",
                        False,
                        "❌ Invalid JSON response",
                        response.text
                    )
                    return False
            else:
                self.log_result(
                    "Verify Key Saved",
                    False,
                    f"❌ Failed to get profile: HTTP {response.status_code}",
                    response.text
                )
                return False
                
        except Exception as e:
            self.log_result("Verify Key Saved", False, f"Exception: {str(e)}")
            return False

    def test_simulate_logout_reload(self):
        """Test Case 5: Simulate logout/reload - Get profile again to verify persistence"""
        try:
            if not self.user_id:
                self.log_result(
                    "Simulate Logout/Reload",
                    False,
                    "❌ Cannot test without user ID",
                    {"user_id": bool(self.user_id)}
                )
                return False
            
            # Simulate logout by clearing session and creating new one
            old_token = self.auth_token
            self.session = requests.Session()  # New session (simulates page reload)
            
            # Re-authenticate to simulate login after reload
            login_data = {
                "email": "test+openticket@gmail.com",
                "password": "12345678"
            }
            
            response = self.session.post(f"{BACKEND_URL}/api/auth/login", json=login_data)
            
            if response.status_code == 200:
                try:
                    data = response.json()
                    # Get new token
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
                        
                        # Now get profile to check if gemini_api_key persisted
                        profile_response = self.session.get(f"{BACKEND_URL}/api/auth/profiles/{self.user_id}")
                        
                        if profile_response.status_code == 200:
                            profile_data = profile_response.json()
                            profile = profile_data.get('profile', {})
                            
                            saved_key = profile.get('gemini_api_key')
                            
                            if saved_key == self.test_api_key:
                                self.log_result(
                                    "Simulate Logout/Reload",
                                    True,
                                    f"✅ Gemini API key persisted after logout/reload: {saved_key}",
                                    {
                                        "gemini_api_key": saved_key,
                                        "persisted_correctly": True,
                                        "old_token": old_token[:20] + "..." if old_token else None,
                                        "new_token": token[:20] + "..." if token else None
                                    }
                                )
                                return True
                            else:
                                self.log_result(
                                    "Simulate Logout/Reload",
                                    False,
                                    f"❌ Gemini API key lost after logout/reload. Expected: {self.test_api_key}, Got: {saved_key}",
                                    {
                                        "expected": self.test_api_key,
                                        "actual": saved_key,
                                        "profile_after_reload": profile
                                    }
                                )
                                return False
                        else:
                            self.log_result(
                                "Simulate Logout/Reload",
                                False,
                                f"❌ Failed to get profile after reload: HTTP {profile_response.status_code}",
                                profile_response.text
                            )
                            return False
                    else:
                        self.log_result(
                            "Simulate Logout/Reload",
                            False,
                            "❌ Failed to get new token after re-login",
                            data
                        )
                        return False
                except json.JSONDecodeError:
                    self.log_result(
                        "Simulate Logout/Reload",
                        False,
                        "❌ Invalid JSON response during re-login",
                        response.text
                    )
                    return False
            else:
                self.log_result(
                    "Simulate Logout/Reload",
                    False,
                    f"❌ Failed to re-login after logout simulation: HTTP {response.status_code}",
                    response.text
                )
                return False
                
        except Exception as e:
            self.log_result("Simulate Logout/Reload", False, f"Exception: {str(e)}")
            return False

    def test_database_persistence_check(self):
        """Test Case 6: Direct database check - verify key is in subscription.settings JSONB field"""
        try:
            if not self.auth_token or not self.user_id:
                self.log_result(
                    "Database Persistence Check",
                    False,
                    "❌ Cannot test without authentication token and user ID",
                    {"auth_token": bool(self.auth_token), "user_id": bool(self.user_id)}
                )
                return False
            
            response = self.session.get(f"{BACKEND_URL}/api/auth/profiles/{self.user_id}")
            
            if response.status_code == 200:
                try:
                    data = response.json()
                    profile = data.get('profile', {})
                    
                    # Check both top-level (mapped from subscription.settings) and subscription.settings directly
                    top_level_key = profile.get('gemini_api_key')
                    subscription_settings = profile.get('subscription', {}).get('settings', {})
                    settings_key = subscription_settings.get('gemini_api_key')
                    
                    # Both should match and equal our test key
                    persistence_check = (
                        top_level_key == self.test_api_key and 
                        settings_key == self.test_api_key
                    )
                    
                    if persistence_check:
                        self.log_result(
                            "Database Persistence Check",
                            True,
                            f"✅ Gemini API key properly stored in database subscription.settings JSONB field",
                            {
                                "top_level_gemini_api_key": top_level_key,
                                "subscription_settings_gemini_api_key": settings_key,
                                "both_match_test_key": persistence_check,
                                "subscription_structure": subscription_settings
                            }
                        )
                        return True
                    else:
                        self.log_result(
                            "Database Persistence Check",
                            False,
                            f"❌ Gemini API key not properly stored in database",
                            {
                                "expected": self.test_api_key,
                                "top_level": top_level_key,
                                "subscription_settings": settings_key,
                                "full_subscription": profile.get('subscription', {})
                            }
                        )
                        return False
                except json.JSONDecodeError:
                    self.log_result(
                        "Database Persistence Check",
                        False,
                        "❌ Invalid JSON response",
                        response.text
                    )
                    return False
            else:
                self.log_result(
                    "Database Persistence Check",
                    False,
                    f"❌ Failed to get profile for database check: HTTP {response.status_code}",
                    response.text
                )
                return False
                
        except Exception as e:
            self.log_result("Database Persistence Check", False, f"Exception: {str(e)}")
            return False

    def run_all_tests(self):
        """Run all Gemini API key persistence tests as specified in review request"""
        print("🤖 Starting Gemini API Key Persistence Testing")
        print("=" * 70)
        print("🎯 TESTING FOCUS: Global AI API key in settings doesn't save - removes on logout/page reload")
        print("=" * 70)
        
        # Test sequence as specified in review request
        print("\n🔐 STEP 1: Login and get user profile")
        print("-" * 40)
        login_success = self.test_login_and_get_profile()
        
        if not login_success:
            print("\n⚠️ STOPPING TESTS - Login Failed")
            print("Cannot proceed without successful authentication")
            return False
        
        print("\n📋 STEP 2: Get initial profile state")
        print("-" * 40)
        initial_profile = self.test_get_initial_profile()
        
        print("\n🔧 STEP 3: Update profile with Gemini API key")
        print("-" * 40)
        update_success = self.test_update_profile_with_gemini_key()
        
        print("\n✅ STEP 4: Verify it was saved - Get profile")
        print("-" * 40)
        verify_success = self.test_verify_key_saved()
        
        print("\n🔄 STEP 5: Simulate logout/reload - Get profile again")
        print("-" * 40)
        reload_success = self.test_simulate_logout_reload()
        
        print("\n💾 STEP 6: Database persistence verification")
        print("-" * 40)
        db_success = self.test_database_persistence_check()
        
        print("\n" + "=" * 70)
        print("📊 TEST SUMMARY")
        print("=" * 70)
        
        passed = sum(1 for r in self.results if r['success'])
        total = len(self.results)
        
        print(f"Total Tests: {total}")
        print(f"Passed: {passed}")
        print(f"Failed: {total - passed}")
        print(f"Success Rate: {(passed/total)*100:.1f}%")
        
        # Success Criteria Check from Review Request
        print("\n🎯 SUCCESS CRITERIA VERIFICATION:")
        
        criteria_results = []
        
        if login_success:
            criteria_results.append("✅ Login successful and user profile retrieved")
        else:
            criteria_results.append("❌ Login failed - cannot test persistence")
            
        if update_success:
            criteria_results.append("✅ PUT /api/auth/profiles/{userId} returns 200 and saves gemini_api_key")
        else:
            criteria_results.append("❌ Profile update with gemini_api_key failed")
            
        if verify_success:
            criteria_results.append("✅ GET /api/auth/profiles/{userId} returns profile with gemini_api_key field")
        else:
            criteria_results.append("❌ Gemini API key not found in profile after update")
            
        if reload_success:
            criteria_results.append("✅ Gemini API key persists after logout/reload simulation")
        else:
            criteria_results.append("❌ Gemini API key lost after logout/reload - THIS IS THE REPORTED BUG")
            
        if db_success:
            criteria_results.append("✅ Key properly stored in subscription.settings JSONB field")
        else:
            criteria_results.append("❌ Key not properly stored in database")
        
        for criterion in criteria_results:
            print(f"  {criterion}")
        
        # Detailed failure analysis
        if total - passed > 0:
            print("\n❌ FAILED TESTS:")
            for result in self.results:
                if not result['success']:
                    print(f"  - {result['test']}: {result['details']}")
        
        print("\n🔍 EXPECTED BEHAVIOR (from Review Request):")
        print("  - PUT request should return 200")
        print("  - GET request should return profile with gemini_api_key: 'test-key-12345-persistence-check'")
        print("  - Second GET (after simulated reload) should still have the key")
        print("  - Key should persist in database subscription.settings JSONB field")
        
        print("\n📋 WHAT TO CHECK:")
        print("  - Is the key being saved to database?")
        print("  - Is it in the subscription.settings JSONB field?")
        print("  - Is it being correctly extracted and returned in GET response?")
        print("  - Any errors in the update/retrieval process?")
        
        # Determine if the reported bug exists
        bug_exists = not (update_success and verify_success and reload_success and db_success)
        
        if bug_exists:
            print("\n🐛 BUG CONFIRMATION:")
            print("  The reported issue 'Global AI API key in settings doesn't save - removes on logout/page reload' appears to be CONFIRMED")
            print("  One or more persistence tests failed, indicating the gemini_api_key is not being properly saved or retrieved")
        else:
            print("\n✅ BUG STATUS:")
            print("  The reported issue appears to be RESOLVED - all persistence tests passed")
            print("  Gemini API key is being properly saved and persists across logout/reload")
        
        return passed == total

if __name__ == "__main__":
    tester = GeminiAPIKeyTester()
    success = tester.run_all_tests()
    
    # Save detailed results
    with open('/app/gemini_api_key_test_results.json', 'w') as f:
        json.dump(tester.results, f, indent=2)
    
    print(f"\n📄 Detailed results saved to: /app/gemini_api_key_test_results.json")
    
    if success:
        print("\n🎉 All Gemini API Key Persistence tests PASSED!")
        exit(0)
    else:
        print("\n⚠️  Some tests FAILED - Gemini API key persistence issue confirmed")
        exit(1)