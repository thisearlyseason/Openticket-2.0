#!/usr/bin/env python3
"""
Email Template Persistence Testing for OpenTicket Platform
Tests the specific email template persistence flow as requested
"""

import requests
import json
import time
from typing import Dict, Any

# Configuration from review request
BACKEND_URL = "http://localhost:8001"
TEST_USER_ID = "9iQqNVY6RdesJeBxhnqTjsfMche2"
TEST_USER_EMAIL = "thisearlyseason@gmail.com"

class EmailTemplatePersistenceTester:
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
    
    def test_get_profile_with_templates(self):
        """Test 1: GET Profile - Verify templates load correctly for specific user"""
        try:
            response = self.session.get(f"{BACKEND_URL}/api/auth/profiles/{TEST_USER_ID}")
            
            if response.status_code == 200:
                data = response.json()
                profile = data.get('profile', {})
                
                # Check if email_templates field exists
                if 'email_templates' in profile:
                    email_templates = profile['email_templates']
                    
                    if email_templates is None:
                        self.log_result(
                            "GET Profile Templates", 
                            True, 
                            "email_templates field exists but is null (user has no templates)",
                            {"email_templates": None}
                        )
                    elif isinstance(email_templates, list):
                        template_count = len(email_templates)
                        
                        # Verify each template has required fields
                        valid_templates = 0
                        for template in email_templates:
                            if all(field in template for field in ['id', 'name', 'type', 'subject', 'body']):
                                valid_templates += 1
                        
                        if template_count == 6 and valid_templates == 6:
                            self.log_result(
                                "GET Profile Templates", 
                                True, 
                                f"Found {template_count} templates, all with required fields (id, name, type, subject, body)",
                                {"template_count": template_count, "valid_templates": valid_templates}
                            )
                        elif template_count > 0:
                            self.log_result(
                                "GET Profile Templates", 
                                True, 
                                f"Found {template_count} templates, {valid_templates} with valid structure",
                                {"template_count": template_count, "valid_templates": valid_templates}
                            )
                        else:
                            self.log_result(
                                "GET Profile Templates", 
                                True, 
                                "email_templates field exists but is empty array",
                                {"email_templates": []}
                            )
                    else:
                        self.log_result(
                            "GET Profile Templates", 
                            False, 
                            f"email_templates field exists but is not an array: {type(email_templates)}",
                            {"email_templates_type": type(email_templates).__name__}
                        )
                else:
                    self.log_result(
                        "GET Profile Templates", 
                        False, 
                        "email_templates field missing from profile response",
                        {"available_fields": list(profile.keys())}
                    )
            elif response.status_code == 404:
                self.log_result(
                    "GET Profile Templates", 
                    False, 
                    f"User {TEST_USER_ID} not found in database",
                    {"status_code": 404}
                )
            else:
                self.log_result(
                    "GET Profile Templates", 
                    False, 
                    f"HTTP {response.status_code}",
                    response.text[:200]
                )
        except Exception as e:
            self.log_result("GET Profile Templates", False, f"Exception: {str(e)}")

    def test_put_profile_requires_auth(self):
        """Test 2: PUT Profile - Verify endpoint requires authentication"""
        try:
            # Test template data
            test_templates = [
                {
                    "id": "test-template-1",
                    "name": "Test Confirmation",
                    "type": "confirmation",
                    "subject": "Test Event Confirmation",
                    "body": "Thank you for registering!"
                }
            ]
            
            payload = {
                "email_templates": test_templates
            }
            
            response = self.session.put(
                f"{BACKEND_URL}/api/auth/profiles/{TEST_USER_ID}",
                json=payload,
                headers={'Content-Type': 'application/json'}
            )
            
            if response.status_code == 401:
                self.log_result(
                    "PUT Profile Auth Required", 
                    True, 
                    "Endpoint correctly requires authentication (401)",
                    {"status_code": 401}
                )
            elif response.status_code == 403:
                self.log_result(
                    "PUT Profile Auth Required", 
                    True, 
                    "Endpoint correctly requires authorization (403)",
                    {"status_code": 403}
                )
            else:
                self.log_result(
                    "PUT Profile Auth Required", 
                    False, 
                    f"Expected 401/403, got HTTP {response.status_code}",
                    response.text[:200]
                )
        except Exception as e:
            self.log_result("PUT Profile Auth Required", False, f"Exception: {str(e)}")

    def test_email_templates_field_mapping(self):
        """Test 3: Verify email_templates field mapping from subscription.settings"""
        try:
            response = self.session.get(f"{BACKEND_URL}/api/auth/profiles/{TEST_USER_ID}")
            
            if response.status_code == 200:
                data = response.json()
                profile = data.get('profile', {})
                
                # Check if subscription field exists (raw database field)
                subscription = profile.get('subscription', {})
                settings = subscription.get('settings', {})
                
                # Check if email_templates exists in both places
                top_level_templates = profile.get('email_templates')
                settings_templates = settings.get('email_templates')
                
                if top_level_templates is not None and settings_templates is not None:
                    # Both exist - verify they match
                    if top_level_templates == settings_templates:
                        self.log_result(
                            "Email Templates Field Mapping", 
                            True, 
                            "email_templates correctly mapped from subscription.settings to top level",
                            {"mapping_verified": True}
                        )
                    else:
                        self.log_result(
                            "Email Templates Field Mapping", 
                            False, 
                            "email_templates exists in both places but values don't match",
                            {"top_level_count": len(top_level_templates) if isinstance(top_level_templates, list) else "not_array",
                             "settings_count": len(settings_templates) if isinstance(settings_templates, list) else "not_array"}
                        )
                elif top_level_templates is not None:
                    self.log_result(
                        "Email Templates Field Mapping", 
                        True, 
                        "email_templates exists at top level (extracted from subscription.settings)",
                        {"top_level_exists": True, "settings_exists": False}
                    )
                elif settings_templates is not None:
                    self.log_result(
                        "Email Templates Field Mapping", 
                        False, 
                        "email_templates exists in subscription.settings but not mapped to top level",
                        {"top_level_exists": False, "settings_exists": True}
                    )
                else:
                    self.log_result(
                        "Email Templates Field Mapping", 
                        True, 
                        "No email_templates found in either location (user has no templates)",
                        {"both_null": True}
                    )
            else:
                self.log_result(
                    "Email Templates Field Mapping", 
                    False, 
                    f"Could not fetch profile: HTTP {response.status_code}",
                    response.text[:200]
                )
        except Exception as e:
            self.log_result("Email Templates Field Mapping", False, f"Exception: {str(e)}")

    def test_user_with_no_templates(self):
        """Test 4: Test with a user that has no templates"""
        try:
            # Use a different user ID that likely doesn't exist or has no templates
            test_user_id = "test-user-no-templates-123"
            
            response = self.session.get(f"{BACKEND_URL}/api/auth/profiles/{test_user_id}")
            
            if response.status_code == 404:
                self.log_result(
                    "User With No Templates", 
                    True, 
                    "Non-existent user correctly returns 404",
                    {"status_code": 404}
                )
            elif response.status_code == 200:
                data = response.json()
                profile = data.get('profile', {})
                email_templates = profile.get('email_templates')
                
                if email_templates == []:
                    self.log_result(
                        "User With No Templates", 
                        True, 
                        "User with no templates returns empty array []",
                        {"email_templates": []}
                    )
                elif email_templates is None:
                    self.log_result(
                        "User With No Templates", 
                        True, 
                        "User with no templates returns null (acceptable)",
                        {"email_templates": None}
                    )
                else:
                    self.log_result(
                        "User With No Templates", 
                        False, 
                        f"User with no templates returns unexpected value: {email_templates}",
                        {"email_templates": email_templates}
                    )
            else:
                self.log_result(
                    "User With No Templates", 
                    False, 
                    f"Unexpected HTTP {response.status_code}",
                    response.text[:200]
                )
        except Exception as e:
            self.log_result("User With No Templates", False, f"Exception: {str(e)}")

    def test_backend_service_health(self):
        """Test 5: Verify backend service is running correctly"""
        try:
            response = self.session.get(f"{BACKEND_URL}/api/health")
            
            if response.status_code == 200:
                data = response.json()
                if 'status' in data and data['status'] == 'ok':
                    self.log_result(
                        "Backend Service Health", 
                        True, 
                        f"Backend service healthy: {data.get('status')}",
                        data
                    )
                else:
                    self.log_result(
                        "Backend Service Health", 
                        False, 
                        "Backend responds but status not 'ok'",
                        data
                    )
            else:
                self.log_result(
                    "Backend Service Health", 
                    False, 
                    f"Health check failed: HTTP {response.status_code}",
                    response.text[:200]
                )
        except Exception as e:
            self.log_result("Backend Service Health", False, f"Exception: {str(e)}")

    def run_all_tests(self):
        """Run all email template persistence tests"""
        print("🔍 Starting Email Template Persistence Tests")
        print("=" * 60)
        print(f"Testing User: {TEST_USER_ID} ({TEST_USER_EMAIL})")
        print(f"Backend URL: {BACKEND_URL}")
        print("=" * 60)
        
        # Run tests in order
        self.test_backend_service_health()
        self.test_get_profile_with_templates()
        self.test_put_profile_requires_auth()
        self.test_email_templates_field_mapping()
        self.test_user_with_no_templates()
        
        print("\n" + "=" * 60)
        print("📊 TEST SUMMARY")
        print("=" * 60)
        
        passed = sum(1 for r in self.results if r['success'])
        total = len(self.results)
        
        print(f"Total Tests: {total}")
        print(f"Passed: {passed}")
        print(f"Failed: {total - passed}")
        print(f"Success Rate: {(passed/total)*100:.1f}%")
        
        if total - passed > 0:
            print("\n❌ FAILED TESTS:")
            for result in self.results:
                if not result['success']:
                    print(f"  - {result['test']}: {result['details']}")
        
        print("\n✅ PASSED TESTS:")
        for result in self.results:
            if result['success']:
                print(f"  - {result['test']}: {result['details']}")
        
        return passed == total

if __name__ == "__main__":
    tester = EmailTemplatePersistenceTester()
    success = tester.run_all_tests()
    
    # Save detailed results
    with open('/app/email_template_persistence_results.json', 'w') as f:
        json.dump(tester.results, f, indent=2)
    
    print(f"\n📄 Detailed results saved to: /app/email_template_persistence_results.json")
    
    if success:
        print("\n🎉 All Email Template Persistence tests PASSED!")
        exit(0)
    else:
        print("\n⚠️  Some tests FAILED - see details above")
        exit(1)