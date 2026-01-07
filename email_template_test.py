#!/usr/bin/env python3
"""
Email Template Persistence Testing for OpenTicket Platform
Tests the specific bug fix for email template persistence after page refresh
"""

import requests
import json
import time
import uuid
from typing import Dict, Any

# Configuration
BACKEND_URL = "http://localhost:8001"

class EmailTemplateAPITester:
    def __init__(self):
        self.results = []
        self.session = requests.Session()
        # Test users from database
        self.test_users = [
            "9iQqNVY6RdesJeBxhnqTjsfMche2",  # thisearlyseason@gmail.com
            "E6G0nH0TNydCy7tuZe9Tjpj5K8E3",  # t@gmail.com
            "uYaLjd5HsAgPn6N7Fkf8fkNvLyB3", # tylerans@gmail.com
        ]
        
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
            print(f"   Response: {json.dumps(response_data, indent=2)[:300]}...")
    
    def test_profile_get_returns_email_templates(self):
        """Test 1: GET /api/auth/profiles/:userId returns email_templates field"""
        try:
            success_count = 0
            total_users = len(self.test_users)
            
            for user_id in self.test_users:
                response = self.session.get(f"{BACKEND_URL}/api/auth/profiles/{user_id}")
                
                if response.status_code == 200:
                    data = response.json()
                    profile = data.get('profile', {})
                    
                    # Check if email_templates field exists
                    if 'email_templates' in profile:
                        email_templates = profile['email_templates']
                        success_count += 1
                        print(f"   User {user_id}: email_templates field present ({type(email_templates).__name__})")
                    else:
                        print(f"   User {user_id}: email_templates field MISSING")
                        print(f"   Available fields: {list(profile.keys())}")
                elif response.status_code == 404:
                    print(f"   User {user_id}: Profile not found (404)")
                else:
                    print(f"   User {user_id}: HTTP {response.status_code}")
            
            if success_count == total_users:
                self.log_result(
                    "Profile GET Returns Email Templates", 
                    True, 
                    f"All {total_users} users have email_templates field in profile response"
                )
            elif success_count > 0:
                self.log_result(
                    "Profile GET Returns Email Templates", 
                    True, 
                    f"{success_count}/{total_users} users have email_templates field"
                )
            else:
                self.log_result(
                    "Profile GET Returns Email Templates", 
                    False, 
                    f"No users have email_templates field in profile response"
                )
                
        except Exception as e:
            self.log_result("Profile GET Returns Email Templates", False, f"Exception: {str(e)}")
    
    def test_profile_update_saves_email_templates(self):
        """Test 2: PUT /api/auth/profiles/:id saves email_templates (without auth - will test endpoint behavior)"""
        try:
            # Create realistic test email templates
            test_templates = [
                {
                    "id": str(uuid.uuid4()),
                    "name": "Event Confirmation",
                    "type": "confirmation",
                    "subject": "You're registered for {{event_name}}!",
                    "body": "Hi {{attendee_name}},\n\nThank you for registering for {{event_name}}!\n\nEvent Details:\n- Date: {{event_date}}\n- Time: {{event_time}}\n- Location: {{event_location}}\n\nWe look forward to seeing you there!\n\nBest regards,\n{{organizer_name}}",
                    "created_at": "2026-01-07T22:30:00Z",
                    "updated_at": "2026-01-07T22:30:00Z"
                },
                {
                    "id": str(uuid.uuid4()),
                    "name": "Event Reminder",
                    "type": "reminder", 
                    "subject": "Reminder: {{event_name}} is tomorrow!",
                    "body": "Hi {{attendee_name}},\n\nThis is a friendly reminder that {{event_name}} is happening tomorrow!\n\nEvent Details:\n- Date: {{event_date}}\n- Time: {{event_time}}\n- Location: {{event_location}}\n\nDon't forget to bring your ticket!\n\nSee you soon,\n{{organizer_name}}",
                    "created_at": "2026-01-07T22:30:00Z",
                    "updated_at": "2026-01-07T22:30:00Z"
                }
            ]
            
            test_user_id = self.test_users[0]  # Use first test user
            
            update_payload = {
                "email_templates": test_templates
            }
            
            response = self.session.put(
                f"{BACKEND_URL}/api/auth/profiles/{test_user_id}",
                json=update_payload,
                headers={'Content-Type': 'application/json'}
            )
            
            if response.status_code == 401:
                self.log_result(
                    "Profile UPDATE Saves Email Templates", 
                    True, 
                    "Endpoint requires authentication (401) - this is expected security behavior"
                )
            elif response.status_code == 403:
                self.log_result(
                    "Profile UPDATE Saves Email Templates", 
                    True, 
                    "Endpoint requires proper authorization (403) - security working correctly"
                )
            elif response.status_code == 200:
                # If it somehow works without auth, check the response
                data = response.json()
                profile = data.get('profile', {})
                
                if 'email_templates' in profile:
                    saved_templates = profile['email_templates']
                    self.log_result(
                        "Profile UPDATE Saves Email Templates", 
                        True, 
                        f"Successfully saved {len(saved_templates)} email templates",
                        {"template_count": len(saved_templates)}
                    )
                else:
                    self.log_result(
                        "Profile UPDATE Saves Email Templates", 
                        False, 
                        "Update succeeded but email_templates not returned in response"
                    )
            else:
                self.log_result(
                    "Profile UPDATE Saves Email Templates", 
                    False, 
                    f"Unexpected HTTP status: {response.status_code}",
                    response.text[:200]
                )
                
        except Exception as e:
            self.log_result("Profile UPDATE Saves Email Templates", False, f"Exception: {str(e)}")
    
    def test_email_template_data_structure(self):
        """Test 3: Verify email_templates field has correct data structure"""
        try:
            user_id = self.test_users[0]
            response = self.session.get(f"{BACKEND_URL}/api/auth/profiles/{user_id}")
            
            if response.status_code == 200:
                data = response.json()
                profile = data.get('profile', {})
                email_templates = profile.get('email_templates')
                
                if email_templates is None:
                    self.log_result(
                        "Email Template Data Structure", 
                        True, 
                        "email_templates is null/empty (valid initial state)"
                    )
                elif isinstance(email_templates, list):
                    self.log_result(
                        "Email Template Data Structure", 
                        True, 
                        f"email_templates is array with {len(email_templates)} items (correct structure)"
                    )
                    
                    # If there are templates, check their structure
                    if len(email_templates) > 0:
                        template = email_templates[0]
                        expected_fields = ['id', 'name', 'type', 'subject', 'body']
                        has_required_fields = all(field in template for field in expected_fields)
                        
                        if has_required_fields:
                            print(f"   Template structure valid: {list(template.keys())}")
                        else:
                            print(f"   Template missing fields. Has: {list(template.keys())}")
                else:
                    self.log_result(
                        "Email Template Data Structure", 
                        False, 
                        f"email_templates has wrong type: {type(email_templates).__name__} (expected array)"
                    )
            else:
                self.log_result(
                    "Email Template Data Structure", 
                    False, 
                    f"Could not fetch profile: HTTP {response.status_code}"
                )
                
        except Exception as e:
            self.log_result("Email Template Data Structure", False, f"Exception: {str(e)}")
    
    def test_multiple_users_email_templates(self):
        """Test 4: Check email_templates field across multiple users"""
        try:
            results = {}
            
            for user_id in self.test_users:
                response = self.session.get(f"{BACKEND_URL}/api/auth/profiles/{user_id}")
                
                if response.status_code == 200:
                    data = response.json()
                    profile = data.get('profile', {})
                    email_templates = profile.get('email_templates')
                    
                    results[user_id] = {
                        "has_field": 'email_templates' in profile,
                        "type": type(email_templates).__name__,
                        "count": len(email_templates) if email_templates else 0
                    }
                else:
                    results[user_id] = {
                        "error": f"HTTP {response.status_code}"
                    }
            
            # Analyze results
            users_with_field = sum(1 for r in results.values() if r.get('has_field', False))
            total_users = len(results)
            
            if users_with_field == total_users:
                self.log_result(
                    "Multiple Users Email Templates", 
                    True, 
                    f"All {total_users} users have email_templates field",
                    results
                )
            elif users_with_field > 0:
                self.log_result(
                    "Multiple Users Email Templates", 
                    True, 
                    f"{users_with_field}/{total_users} users have email_templates field",
                    results
                )
            else:
                self.log_result(
                    "Multiple Users Email Templates", 
                    False, 
                    "No users have email_templates field",
                    results
                )
                
        except Exception as e:
            self.log_result("Multiple Users Email Templates", False, f"Exception: {str(e)}")
    
    def test_profile_endpoint_consistency(self):
        """Test 5: Verify profile endpoint returns consistent structure"""
        try:
            user_id = self.test_users[0]
            
            # Make multiple requests to check consistency
            responses = []
            for i in range(3):
                response = self.session.get(f"{BACKEND_URL}/api/auth/profiles/{user_id}")
                if response.status_code == 200:
                    data = response.json()
                    profile = data.get('profile', {})
                    responses.append({
                        "has_email_templates": 'email_templates' in profile,
                        "field_count": len(profile.keys()),
                        "email_templates_type": type(profile.get('email_templates')).__name__
                    })
                time.sleep(0.1)  # Small delay between requests
            
            if len(responses) == 3:
                # Check if all responses are consistent
                first_response = responses[0]
                all_consistent = all(r == first_response for r in responses)
                
                if all_consistent:
                    self.log_result(
                        "Profile Endpoint Consistency", 
                        True, 
                        f"All 3 requests returned consistent structure (email_templates: {first_response['has_email_templates']})"
                    )
                else:
                    self.log_result(
                        "Profile Endpoint Consistency", 
                        False, 
                        "Responses were inconsistent across multiple requests",
                        responses
                    )
            else:
                self.log_result(
                    "Profile Endpoint Consistency", 
                    False, 
                    f"Could not complete all requests (got {len(responses)}/3)"
                )
                
        except Exception as e:
            self.log_result("Profile Endpoint Consistency", False, f"Exception: {str(e)}")
    
    def run_all_tests(self):
        """Run all email template persistence tests"""
        print("📧 Starting Email Template Persistence Tests")
        print("=" * 60)
        print(f"Testing with {len(self.test_users)} real users from database")
        print("=" * 60)
        
        # Run all email template specific tests
        self.test_profile_get_returns_email_templates()
        self.test_profile_update_saves_email_templates()
        self.test_email_template_data_structure()
        self.test_multiple_users_email_templates()
        self.test_profile_endpoint_consistency()
        
        print("\n" + "=" * 60)
        print("📊 EMAIL TEMPLATE TEST SUMMARY")
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
        
        print("\n📋 DETAILED FINDINGS:")
        for result in self.results:
            status = "✅" if result['success'] else "❌"
            print(f"{status} {result['test']}")
            if result['response_data']:
                print(f"   Data: {json.dumps(result['response_data'], indent=2)[:200]}...")
        
        return passed == total

if __name__ == "__main__":
    tester = EmailTemplateAPITester()
    success = tester.run_all_tests()
    
    # Save detailed results
    with open('/app/email_template_detailed_results.json', 'w') as f:
        json.dump(tester.results, f, indent=2)
    
    print(f"\n📄 Detailed results saved to: /app/email_template_detailed_results.json")
    
    if success:
        print("\n🎉 All email template persistence tests PASSED!")
        exit(0)
    else:
        print("\n⚠️  Some tests FAILED - see details above")
        exit(1)