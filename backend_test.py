#!/usr/bin/env python3
"""
Backend API Testing for OpenTicket Platform - Complete Email System Testing
Tests the complete email system after fixes as requested in review
"""

import requests
import json
import time
import uuid
from typing import Dict, Any

# Configuration - Use production URL from frontend/.env
BACKEND_URL = "https://savvy-tix.preview.emergentagent.com"

class EmailSystemTester:
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
    
    def test_email_status_check(self):
        """Test Case 1: Email Status Check - GET /api/email/status"""
        try:
            response = self.session.get(f"{BACKEND_URL}/api/email/status")
            
            if response.status_code == 200:
                data = response.json()
                
                # Check expected response structure from review request
                expected_configured = True
                expected_available = True
                expected_provider = "resend"
                expected_sender = "tickets@openticket.events"
                
                # Validate response structure
                if (data.get('configured') == expected_configured and 
                    data.get('available') == expected_available and 
                    data.get('provider') == expected_provider and 
                    data.get('senderEmail') == expected_sender):
                    
                    self.log_result(
                        "Email Status Check", 
                        True, 
                        f"✅ Expected response: configured={data.get('configured')}, available={data.get('available')}, provider={data.get('provider')}, senderEmail={data.get('senderEmail')}",
                        data
                    )
                else:
                    self.log_result(
                        "Email Status Check", 
                        False, 
                        f"❌ Response mismatch - Expected: configured={expected_configured}, available={expected_available}, provider={expected_provider}, senderEmail={expected_sender}. Got: {data}",
                        data
                    )
            else:
                self.log_result(
                    "Email Status Check", 
                    False, 
                    f"HTTP {response.status_code}",
                    response.text
                )
        except Exception as e:
            self.log_result("Email Status Check", False, f"Exception: {str(e)}")

    def test_direct_email_send(self):
        """Test Case 2: Direct Email Send - POST /api/email/send to thisearlyseason@gmail.com"""
        try:
            payload = {
                "to": "thisearlyseason@gmail.com",
                "subject": "Backend Test Email",
                "html": "<h1>Backend Test Email</h1><p>This is a test email sent from the backend testing system to verify email functionality.</p>"
            }
            
            response = self.session.post(
                f"{BACKEND_URL}/api/email/send",
                json=payload,
                headers={'Content-Type': 'application/json'}
            )
            
            if response.status_code == 200:
                data = response.json()
                
                if data.get('success') == True and data.get('messageId'):
                    self.log_result(
                        "Direct Email Send", 
                        True, 
                        f"✅ Email sent successfully with messageId: {data.get('messageId')}",
                        data
                    )
                else:
                    self.log_result(
                        "Direct Email Send", 
                        False, 
                        "❌ Response doesn't indicate success or missing messageId",
                        data
                    )
            else:
                self.log_result(
                    "Direct Email Send", 
                    False, 
                    f"HTTP {response.status_code}",
                    response.text
                )
        except Exception as e:
            self.log_result("Direct Email Send", False, f"Exception: {str(e)}")

    def test_confirmation_email_simulation(self):
        """Test Case 3: Confirmation Email Test (simulating webhook call)"""
        try:
            # Simulate the confirmation email that would be sent by webhook
            # This tests the internal API that webhook would call
            payload = {
                "to": "thisearlyseason@gmail.com",
                "template": {
                    "subject": "Your Ticket Confirmation for {{event_title}}",
                    "body": """
                    <h2>Thank you for your purchase, {{attendee_name}}!</h2>
                    <p>Your tickets for <strong>{{event_title}}</strong> have been confirmed.</p>
                    <p><strong>Event Details:</strong></p>
                    <ul>
                        <li>Event: {{event_title}}</li>
                        <li>Date: {{event_date}}</li>
                        <li>Location: {{event_location}}</li>
                        <li>Ticket Type: {{ticket_type}}</li>
                        <li>Order ID: {{order_id}}</li>
                    </ul>
                    <p>We look forward to seeing you at the event!</p>
                    """
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
                    self.log_result(
                        "Confirmation Email Test", 
                        True, 
                        f"✅ Confirmation email template processed successfully: {data.get('messageId')}",
                        data
                    )
                else:
                    self.log_result(
                        "Confirmation Email Test", 
                        False, 
                        "❌ Response doesn't indicate success",
                        data
                    )
            else:
                self.log_result(
                    "Confirmation Email Test", 
                    False, 
                    f"HTTP {response.status_code}",
                    response.text
                )
        except Exception as e:
            self.log_result("Confirmation Email Test", False, f"Exception: {str(e)}")

    def check_backend_logs_for_email_errors(self):
        """Test Case 4: Check Backend Logs for Email Errors"""
        try:
            import subprocess
            
            # Check for email-related errors in backend logs
            result = subprocess.run(
                ["tail", "-50", "/var/log/supervisor/backend.out.log"],
                capture_output=True,
                text=True
            )
            
            if result.returncode == 0:
                log_content = result.stdout.lower()
                
                # Check for old Gmail/nodemailer errors
                gmail_errors = [
                    "missing credentials",
                    "resend not configured",
                    "nodemailer",
                    "gmail service error",
                    "authentication failed"
                ]
                
                found_errors = []
                for error in gmail_errors:
                    if error in log_content:
                        found_errors.append(error)
                
                if found_errors:
                    self.log_result(
                        "Backend Logs Check", 
                        False, 
                        f"❌ Found old email service errors: {', '.join(found_errors)}",
                        {"log_excerpt": result.stdout[-500:]}  # Last 500 chars
                    )
                else:
                    # Check for positive email indicators
                    positive_indicators = [
                        "resend",
                        "email sent",
                        "✅ email sent"
                    ]
                    
                    found_positive = []
                    for indicator in positive_indicators:
                        if indicator in log_content:
                            found_positive.append(indicator)
                    
                    if found_positive:
                        self.log_result(
                            "Backend Logs Check", 
                            True, 
                            f"✅ No old email errors found. Found positive indicators: {', '.join(found_positive)}",
                            {"log_excerpt": result.stdout[-500:]}
                        )
                    else:
                        self.log_result(
                            "Backend Logs Check", 
                            True, 
                            "✅ No old email service errors found in logs",
                            {"log_excerpt": result.stdout[-500:]}
                        )
            else:
                self.log_result(
                    "Backend Logs Check", 
                    False, 
                    f"❌ Could not read backend logs: {result.stderr}",
                    None
                )
        except Exception as e:
            self.log_result("Backend Logs Check", False, f"Exception: {str(e)}")

    def test_email_service_configuration_validation(self):
        """Additional Test: Validate Email Service Configuration"""
        try:
            # Test that the email service is properly configured
            response = self.session.get(f"{BACKEND_URL}/api/email/providers")
            
            if response.status_code == 200:
                data = response.json()
                
                # Check that Resend is the default provider and configured
                providers = data.get('providers', [])
                default_provider = data.get('defaultProvider')
                
                resend_provider = next((p for p in providers if p.get('id') == 'resend'), None)
                
                if (default_provider == 'resend' and 
                    resend_provider and 
                    resend_provider.get('configured') == True):
                    
                    self.log_result(
                        "Email Service Configuration", 
                        True, 
                        f"✅ Resend is default provider and configured: {resend_provider.get('name')}",
                        data
                    )
                else:
                    self.log_result(
                        "Email Service Configuration", 
                        False, 
                        f"❌ Configuration issue - Default: {default_provider}, Resend configured: {resend_provider.get('configured') if resend_provider else 'Not found'}",
                        data
                    )
            else:
                self.log_result(
                    "Email Service Configuration", 
                    False, 
                    f"HTTP {response.status_code}",
                    response.text
                )
        except Exception as e:
            self.log_result("Email Service Configuration", False, f"Exception: {str(e)}")

    def test_webhook_email_functionality(self):
        """Additional Test: Test webhook-style email functionality"""
        try:
            # This simulates what happens when a webhook triggers confirmation emails
            # Testing the EmailService.sendConfirmation equivalent
            
            # Mock event details and ticket data
            event_details = {
                "title": "Test Event for Webhook",
                "date": "2026-01-15",
                "location": "Test Venue, San Francisco, CA"
            }
            
            tickets = [
                {"type": "General Admission", "price": "$25.00", "quantity": 2}
            ]
            
            # Create a confirmation email template
            payload = {
                "to": "thisearlyseason@gmail.com",
                "template": {
                    "subject": "Ticket Confirmation - {{event_title}}",
                    "body": f"""
                    <h2>Ticket Purchase Confirmed!</h2>
                    <p>Dear {{{{attendee_name}}}},</p>
                    <p>Your ticket purchase has been confirmed for:</p>
                    <h3>{{{{event_title}}}}</h3>
                    <p><strong>Date:</strong> {{{{event_date}}}}</p>
                    <p><strong>Location:</strong> {{{{event_location}}}}</p>
                    <p><strong>Tickets:</strong></p>
                    <ul>
                        <li>{tickets[0]['quantity']}x {tickets[0]['type']} - {tickets[0]['price']} each</li>
                    </ul>
                    <p>Order ID: {{{{order_id}}}}</p>
                    <p>Thank you for your purchase!</p>
                    """
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
                    self.log_result(
                        "Webhook Email Functionality", 
                        True, 
                        f"✅ Webhook-style confirmation email processed: {data.get('messageId')}",
                        data
                    )
                else:
                    self.log_result(
                        "Webhook Email Functionality", 
                        False, 
                        "❌ Webhook-style email failed",
                        data
                    )
            else:
                self.log_result(
                    "Webhook Email Functionality", 
                    False, 
                    f"HTTP {response.status_code}",
                    response.text
                )
        except Exception as e:
            self.log_result("Webhook Email Functionality", False, f"Exception: {str(e)}")
    
    def run_all_tests(self):
        """Run all email system tests as specified in review request"""
        print("🔍 Starting Complete Email System Testing")
        print("=" * 60)
        
        # Test Cases from Review Request
        print("\n📧 CORE EMAIL SYSTEM TESTS")
        print("-" * 40)
        self.test_email_status_check()
        self.test_direct_email_send()
        self.test_confirmation_email_simulation()
        self.check_backend_logs_for_email_errors()
        
        # Additional Validation Tests
        print("\n✅ ADDITIONAL VALIDATION TESTS")
        print("-" * 40)
        self.test_email_service_configuration_validation()
        self.test_webhook_email_functionality()
        
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
        core_tests = [r for r in self.results if any(keyword in r['test'] for keyword in ['Email Status', 'Direct Email', 'Confirmation Email', 'Backend Logs'])]
        additional_tests = [r for r in self.results if any(keyword in r['test'] for keyword in ['Configuration', 'Webhook'])]
        
        if core_tests:
            core_passed = sum(1 for r in core_tests if r['success'])
            print(f"\n📧 CORE EMAIL TESTS: {core_passed}/{len(core_tests)} passed ({(core_passed/len(core_tests))*100:.1f}%)")
        
        if additional_tests:
            additional_passed = sum(1 for r in additional_tests if r['success'])
            print(f"✅ ADDITIONAL TESTS: {additional_passed}/{len(additional_tests)} passed ({(additional_passed/len(additional_tests))*100:.1f}%)")
        
        # Success Criteria Check
        print("\n🎯 SUCCESS CRITERIA VERIFICATION:")
        status_test = next((r for r in self.results if 'Email Status' in r['test']), None)
        send_test = next((r for r in self.results if 'Direct Email' in r['test']), None)
        logs_test = next((r for r in self.results if 'Backend Logs' in r['test']), None)
        confirmation_test = next((r for r in self.results if 'Confirmation Email' in r['test']), None)
        
        criteria_met = []
        if status_test and status_test['success']:
            criteria_met.append("✅ Email status shows configured=true")
        else:
            criteria_met.append("❌ Email status check failed")
            
        if send_test and send_test['success']:
            criteria_met.append("✅ Direct emails send successfully")
        else:
            criteria_met.append("❌ Direct email sending failed")
            
        if logs_test and logs_test['success']:
            criteria_met.append("✅ No old Gmail/nodemailer errors in logs")
        else:
            criteria_met.append("❌ Found email service errors in logs")
            
        if confirmation_test and confirmation_test['success']:
            criteria_met.append("✅ Confirmation emails work when webhook is triggered")
        else:
            criteria_met.append("❌ Confirmation email functionality failed")
        
        for criterion in criteria_met:
            print(f"  {criterion}")
        
        if total - passed > 0:
            print("\n❌ FAILED TESTS:")
            for result in self.results:
                if not result['success']:
                    print(f"  - {result['test']}: {result['details']}")
        
        return passed == total

if __name__ == "__main__":
    tester = EmailSystemTester()
    success = tester.run_all_tests()
    
    # Save detailed results
    with open('/app/email_system_test_results.json', 'w') as f:
        json.dump(tester.results, f, indent=2)
    
    print(f"\n📄 Detailed results saved to: /app/email_system_test_results.json")
    
    if success:
        print("\n🎉 All Email System tests PASSED!")
        exit(0)
    else:
        print("\n⚠️  Some tests FAILED - see details above")
        exit(1)