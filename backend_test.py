#!/usr/bin/env python3
"""
Backend API Testing for OpenTicket Platform - Resend Email Service Integration
Tests the Resend email service integration after replacing MailerLite
"""

import requests
import json
import time
import uuid
from typing import Dict, Any

# Configuration - Use production URL from frontend/.env
BACKEND_URL = "https://savvy-tix.preview.emergentagent.com"

class ResendEmailServiceTester:
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
    
    def test_email_status_endpoint(self):
        """Test 1: GET /api/email/status - Should return Resend as configured"""
        try:
            response = self.session.get(f"{BACKEND_URL}/api/email/status")
            
            if response.status_code == 200:
                data = response.json()
                
                # Check expected fields
                expected_fields = ['configured', 'available', 'provider']
                missing_fields = [field for field in expected_fields if field not in data]
                
                if missing_fields:
                    self.log_result(
                        "Email Status Endpoint", 
                        False, 
                        f"Missing required fields: {missing_fields}",
                        data
                    )
                    return
                
                # Check if Resend is configured
                if data.get('provider') == 'resend':
                    self.log_result(
                        "Email Status Endpoint", 
                        True, 
                        f"Resend configured: {data.get('configured')}, available: {data.get('available')}, provider: {data.get('provider')}",
                        data
                    )
                else:
                    self.log_result(
                        "Email Status Endpoint", 
                        False, 
                        f"Expected provider 'resend', got '{data.get('provider')}'",
                        data
                    )
            else:
                self.log_result(
                    "Email Status Endpoint", 
                    False, 
                    f"HTTP {response.status_code}",
                    response.text
                )
        except Exception as e:
            self.log_result("Email Status Endpoint", False, f"Exception: {str(e)}")

    def test_email_providers_endpoint(self):
        """Test 2: GET /api/email/providers - Should list Resend as default provider"""
        try:
            response = self.session.get(f"{BACKEND_URL}/api/email/providers")
            
            if response.status_code == 200:
                data = response.json()
                
                # Check structure
                if 'providers' not in data or 'defaultProvider' not in data:
                    self.log_result(
                        "Email Providers Endpoint", 
                        False, 
                        "Missing 'providers' or 'defaultProvider' fields",
                        data
                    )
                    return
                
                providers = data.get('providers', [])
                default_provider = data.get('defaultProvider')
                
                # Find Resend provider
                resend_provider = next((p for p in providers if p.get('id') == 'resend'), None)
                gmail_provider = next((p for p in providers if p.get('id') == 'gmail'), None)
                
                if not resend_provider:
                    self.log_result(
                        "Email Providers Endpoint", 
                        False, 
                        "Resend provider not found in providers list",
                        data
                    )
                    return
                
                if default_provider != 'resend':
                    self.log_result(
                        "Email Providers Endpoint", 
                        False, 
                        f"Expected default provider 'resend', got '{default_provider}'",
                        data
                    )
                    return
                
                # Check Resend provider details
                resend_configured = resend_provider.get('configured', False)
                gmail_configured = gmail_provider.get('configured', False) if gmail_provider else False
                
                self.log_result(
                    "Email Providers Endpoint", 
                    True, 
                    f"Resend (configured: {resend_configured}), Gmail (configured: {gmail_configured}), default: {default_provider}",
                    data
                )
            else:
                self.log_result(
                    "Email Providers Endpoint", 
                    False, 
                    f"HTTP {response.status_code}",
                    response.text
                )
        except Exception as e:
            self.log_result("Email Providers Endpoint", False, f"Exception: {str(e)}")

    def test_email_send_single(self):
        """Test 3: POST /api/email/send - Test single email send"""
        try:
            payload = {
                "to": "test@example.com",
                "subject": "Test Subject",
                "html": "<p>Hello World</p>"
            }
            
            response = self.session.post(
                f"{BACKEND_URL}/api/email/send",
                json=payload,
                headers={'Content-Type': 'application/json'}
            )
            
            if response.status_code == 200:
                data = response.json()
                
                if data.get('success') == True:
                    if data.get('simulated') == True:
                        self.log_result(
                            "Email Send Single", 
                            True, 
                            f"Successfully simulated email send (API key not configured): {data.get('messageId')}",
                            data
                        )
                    else:
                        self.log_result(
                            "Email Send Single", 
                            True, 
                            f"Successfully sent email via {data.get('provider', 'unknown')}: {data.get('messageId')}",
                            data
                        )
                else:
                    self.log_result(
                        "Email Send Single", 
                        False, 
                        "Response doesn't indicate success",
                        data
                    )
            else:
                self.log_result(
                    "Email Send Single", 
                    False, 
                    f"HTTP {response.status_code}",
                    response.text
                )
        except Exception as e:
            self.log_result("Email Send Single", False, f"Exception: {str(e)}")

    def test_email_send_test_template(self):
        """Test 4: POST /api/email/send-test - Test template email"""
        try:
            payload = {
                "to": "test@example.com",
                "template": {
                    "subject": "Test {{event_title}}",
                    "body": "<p>Hi {{attendee_name}}, welcome to {{event_title}} on {{event_date}} at {{event_location}}!</p>"
                }
            }
            
            response = self.session.post(
                f"{BACKEND_URL}/api/email/send-test",
                json=payload,
                headers={'Content-Type': 'application/json'}
            )
            
            if response.status_code == 200:
                data = response.json()
                
                if data.get('success') == True:
                    if data.get('simulated') == True or data.get('preview') == True:
                        self.log_result(
                            "Email Send Test Template", 
                            True, 
                            f"Successfully generated test email preview/simulation: {data.get('messageId')}",
                            data
                        )
                    else:
                        self.log_result(
                            "Email Send Test Template", 
                            True, 
                            f"Successfully sent test email via {data.get('provider', 'unknown')}: {data.get('messageId')}",
                            data
                        )
                else:
                    self.log_result(
                        "Email Send Test Template", 
                        False, 
                        "Response doesn't indicate success",
                        data
                    )
            else:
                self.log_result(
                    "Email Send Test Template", 
                    False, 
                    f"HTTP {response.status_code}",
                    response.text
                )
        except Exception as e:
            self.log_result("Email Send Test Template", False, f"Exception: {str(e)}")

    def test_email_send_validation_missing_fields(self):
        """Test 5: POST /api/email/send without required fields → 400 error"""
        try:
            # Test missing 'to' field
            payload = {
                "subject": "Test Subject",
                "html": "<p>Hello World</p>"
            }
            
            response = self.session.post(
                f"{BACKEND_URL}/api/email/send",
                json=payload,
                headers={'Content-Type': 'application/json'}
            )
            
            if response.status_code == 400:
                data = response.json()
                if 'error' in data and 'to' in data['error']:
                    self.log_result(
                        "Email Send Validation - Missing Fields", 
                        True, 
                        "Correctly validates missing 'to' field (400)",
                        data
                    )
                else:
                    self.log_result(
                        "Email Send Validation - Missing Fields", 
                        False, 
                        "Returns 400 but error message unclear",
                        data
                    )
            else:
                self.log_result(
                    "Email Send Validation - Missing Fields", 
                    False, 
                    f"Expected 400, got HTTP {response.status_code}",
                    response.text
                )
        except Exception as e:
            self.log_result("Email Send Validation - Missing Fields", False, f"Exception: {str(e)}")

    def test_email_send_test_validation_missing_template(self):
        """Test 6: POST /api/email/send-test without template → 400 error"""
        try:
            payload = {
                "to": "test@example.com"
            }
            
            response = self.session.post(
                f"{BACKEND_URL}/api/email/send-test",
                json=payload,
                headers={'Content-Type': 'application/json'}
            )
            
            if response.status_code == 400:
                data = response.json()
                if 'error' in data and 'template' in data['error']:
                    self.log_result(
                        "Email Send Test Validation - Missing Template", 
                        True, 
                        "Correctly validates missing template (400)",
                        data
                    )
                else:
                    self.log_result(
                        "Email Send Test Validation - Missing Template", 
                        False, 
                        "Returns 400 but error message unclear",
                        data
                    )
            else:
                self.log_result(
                    "Email Send Test Validation - Missing Template", 
                    False, 
                    f"Expected 400, got HTTP {response.status_code}",
                    response.text
                )
        except Exception as e:
            self.log_result("Email Send Test Validation - Missing Template", False, f"Exception: {str(e)}")

    def test_mailerlite_references_removed(self):
        """Test 7: Verify MailerLite references are completely removed"""
        try:
            # Test email status doesn't mention MailerLite
            status_response = self.session.get(f"{BACKEND_URL}/api/email/status")
            providers_response = self.session.get(f"{BACKEND_URL}/api/email/providers")
            
            mailerlite_found = False
            references = []
            
            if status_response.status_code == 200:
                status_data = status_response.json()
                status_text = json.dumps(status_data).lower()
                if 'mailerlite' in status_text:
                    mailerlite_found = True
                    references.append("status endpoint")
            
            if providers_response.status_code == 200:
                providers_data = providers_response.json()
                providers_text = json.dumps(providers_data).lower()
                if 'mailerlite' in providers_text:
                    mailerlite_found = True
                    references.append("providers endpoint")
            
            if mailerlite_found:
                self.log_result(
                    "MailerLite References Removed", 
                    False, 
                    f"MailerLite references still found in: {', '.join(references)}",
                    {"status": status_data if status_response.status_code == 200 else None,
                     "providers": providers_data if providers_response.status_code == 200 else None}
                )
            else:
                self.log_result(
                    "MailerLite References Removed", 
                    True, 
                    "No MailerLite references found in API responses"
                )
        except Exception as e:
            self.log_result("MailerLite References Removed", False, f"Exception: {str(e)}")

    def test_resend_configuration_check(self):
        """Test 8: Verify Resend configuration is properly detected"""
        try:
            response = self.session.get(f"{BACKEND_URL}/api/email/status")
            
            if response.status_code == 200:
                data = response.json()
                
                # Check if the response indicates proper Resend configuration detection
                provider = data.get('provider')
                configured = data.get('configured')
                available = data.get('available')
                message = data.get('message', '')
                
                if provider == 'resend':
                    if configured and available:
                        self.log_result(
                            "Resend Configuration Check", 
                            True, 
                            f"Resend properly configured and available. Message: {message}",
                            data
                        )
                    elif not configured and not available:
                        # This is also valid - means API key is not set but service is properly detecting it
                        if 'not configured' in message.lower() or 'api key' in message.lower():
                            self.log_result(
                                "Resend Configuration Check", 
                                True, 
                                f"Resend properly detects missing configuration. Message: {message}",
                                data
                            )
                        else:
                            self.log_result(
                                "Resend Configuration Check", 
                                False, 
                                f"Unclear configuration status. Message: {message}",
                                data
                            )
                    else:
                        self.log_result(
                            "Resend Configuration Check", 
                            False, 
                            f"Inconsistent configuration status: configured={configured}, available={available}",
                            data
                        )
                else:
                    self.log_result(
                        "Resend Configuration Check", 
                        False, 
                        f"Expected provider 'resend', got '{provider}'",
                        data
                    )
            else:
                self.log_result(
                    "Resend Configuration Check", 
                    False, 
                    f"HTTP {response.status_code}",
                    response.text
                )
        except Exception as e:
            self.log_result("Resend Configuration Check", False, f"Exception: {str(e)}")
    
    def run_all_tests(self):
        """Run all Resend email service integration tests"""
        print("🔍 Starting Resend Email Service Integration Tests")
        print("=" * 60)
        
        # Core Resend Integration Tests
        print("\n📧 RESEND EMAIL SERVICE TESTS")
        print("-" * 40)
        self.test_email_status_endpoint()
        self.test_email_providers_endpoint()
        self.test_email_send_single()
        self.test_email_send_test_template()
        
        # Validation Tests
        print("\n✅ VALIDATION TESTS")
        print("-" * 40)
        self.test_email_send_validation_missing_fields()
        self.test_email_send_test_validation_missing_template()
        
        # Migration Verification Tests
        print("\n🔄 MIGRATION VERIFICATION TESTS")
        print("-" * 40)
        self.test_mailerlite_references_removed()
        self.test_resend_configuration_check()
        
        print("\n" + "=" * 60)
        print("📊 TEST SUMMARY")
        print("=" * 60)
        
        passed = sum(1 for r in self.results if r['success'])
        total = len(self.results)
        
        print(f"Total Tests: {total}")
        print(f"Passed: {passed}")
        print(f"Failed: {total - passed}")
        print(f"Success Rate: {(passed/total)*100:.1f}%")
        
        # Categorize results
        core_tests = [r for r in self.results if any(keyword in r['test'] for keyword in ['Email Status', 'Email Providers', 'Email Send'])]
        validation_tests = [r for r in self.results if 'Validation' in r['test']]
        migration_tests = [r for r in self.results if any(keyword in r['test'] for keyword in ['MailerLite', 'Configuration Check'])]
        
        if core_tests:
            core_passed = sum(1 for r in core_tests if r['success'])
            print(f"\n📧 CORE FUNCTIONALITY: {core_passed}/{len(core_tests)} passed ({(core_passed/len(core_tests))*100:.1f}%)")
        
        if validation_tests:
            validation_passed = sum(1 for r in validation_tests if r['success'])
            print(f"✅ VALIDATION: {validation_passed}/{len(validation_tests)} passed ({(validation_passed/len(validation_tests))*100:.1f}%)")
        
        if migration_tests:
            migration_passed = sum(1 for r in migration_tests if r['success'])
            print(f"🔄 MIGRATION: {migration_passed}/{len(migration_tests)} passed ({(migration_passed/len(migration_tests))*100:.1f}%)")
        
        if total - passed > 0:
            print("\n❌ FAILED TESTS:")
            for result in self.results:
                if not result['success']:
                    print(f"  - {result['test']}: {result['details']}")
        
        return passed == total

if __name__ == "__main__":
    tester = ResendEmailServiceTester()
    success = tester.run_all_tests()
    
    # Save detailed results
    with open('/app/resend_email_test_results.json', 'w') as f:
        json.dump(tester.results, f, indent=2)
    
    print(f"\n📄 Detailed results saved to: /app/resend_email_test_results.json")
    
    if success:
        print("\n🎉 All Resend Email Service Integration tests PASSED!")
        exit(0)
    else:
        print("\n⚠️  Some tests FAILED - see details above")
        exit(1)