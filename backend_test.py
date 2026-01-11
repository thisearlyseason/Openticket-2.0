#!/usr/bin/env python3
"""
Backend API Testing for OpenTicket Platform - Unique Ticket Generation System Testing
Tests the unique ticket generation system and check-in API as requested in review
"""

import requests
import json
import time
import uuid
import subprocess
from typing import Dict, Any

# Configuration - Use production URL from frontend/.env
BACKEND_URL = "https://pass-hand.preview.emergentagent.com"

class TicketSystemTester:
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
    
    def test_ticket_generator_utility(self):
        """Test Case 1: Ticket Generator Utility - Test unique ID generation"""
        try:
            # Test the ticket generator utility directly via Node.js
            test_script = """
const { generateTicketId, generateTicketNumber, generateUniqueTickets } = require('/app/backend/utils/ticketGenerator.js');

// Test 1: Generate ticket IDs
console.log('Test 1: Ticket ID Generation');
const id1 = generateTicketId();
const id2 = generateTicketId();
console.log('ID 1:', id1);
console.log('ID 2:', id2);
console.log('IDs are unique:', id1 !== id2);

// Test 2: Generate ticket numbers
console.log('\\nTest 2: Ticket Number Generation');
const num1 = generateTicketNumber();
const num2 = generateTicketNumber();
console.log('Number 1:', num1);
console.log('Number 2:', num2);
console.log('Numbers are unique:', num1 !== num2);

// Test 3: Generate unique tickets from tier
console.log('\\nTest 3: Unique Tickets from Tier');
const tickets = [{
  tierId: 'general',
  name: 'General Admission',
  quantity: 3,
  price: 25.00
}];
const uniqueTickets = generateUniqueTickets(tickets, 'reg-123', 'John Doe', []);
console.log('Generated', uniqueTickets.length, 'unique tickets');
uniqueTickets.forEach((t, i) => {
  console.log(`Ticket ${i+1}: ${t.ticketNumber} (${t.ticketId})`);
});

// Output results as JSON for parsing
console.log('\\n=== RESULTS ===');
console.log(JSON.stringify({
  id1: id1,
  id2: id2,
  idsUnique: id1 !== id2,
  num1: num1,
  num2: num2,
  numbersUnique: num1 !== num2,
  ticketCount: uniqueTickets.length,
  tickets: uniqueTickets.map(t => ({
    ticketId: t.ticketId,
    ticketNumber: t.ticketNumber,
    qrCodeData: t.qrCodeData,
    quantity: t.quantity
  }))
}));
"""
            
            # Write test script to temporary file
            with open('/tmp/test_ticket_generator.js', 'w') as f:
                f.write(test_script)
            
            # Execute the test script
            result = subprocess.run(
                ['node', '/tmp/test_ticket_generator.js'],
                capture_output=True,
                text=True,
                cwd='/app'
            )
            
            if result.returncode == 0:
                output_lines = result.stdout.strip().split('\n')
                
                # Find the JSON results
                json_start = -1
                for i, line in enumerate(output_lines):
                    if line.strip() == '=== RESULTS ===':
                        json_start = i + 1
                        break
                
                if json_start != -1 and json_start < len(output_lines):
                    try:
                        results = json.loads(output_lines[json_start])
                        
                        # Validate results
                        success = True
                        issues = []
                        
                        # Check ticket ID format
                        if not results['id1'].startswith('TKT-') or not results['id2'].startswith('TKT-'):
                            success = False
                            issues.append("Ticket IDs don't follow TKT-{timestamp}-{hash} format")
                        
                        # Check ticket number format
                        if not results['num1'].startswith('TKT-') or not results['num2'].startswith('TKT-'):
                            success = False
                            issues.append("Ticket numbers don't follow TKT-{6 chars} format")
                        
                        # Check uniqueness
                        if not results['idsUnique']:
                            success = False
                            issues.append("Generated ticket IDs are not unique")
                        
                        if not results['numbersUnique']:
                            success = False
                            issues.append("Generated ticket numbers are not unique")
                        
                        # Check ticket generation
                        if results['ticketCount'] != 3:
                            success = False
                            issues.append(f"Expected 3 tickets, got {results['ticketCount']}")
                        
                        # Check individual ticket properties
                        for i, ticket in enumerate(results['tickets']):
                            if ticket['quantity'] != 1:
                                success = False
                                issues.append(f"Ticket {i+1} has quantity {ticket['quantity']}, expected 1")
                            
                            if ticket['qrCodeData'] != ticket['ticketId']:
                                success = False
                                issues.append(f"Ticket {i+1} QR code data doesn't match ticket ID")
                        
                        if success:
                            self.log_result(
                                "Ticket Generator Utility",
                                True,
                                f"✅ All tests passed: Generated unique IDs, numbers, and {results['ticketCount']} individual tickets",
                                results
                            )
                        else:
                            self.log_result(
                                "Ticket Generator Utility",
                                False,
                                f"❌ Issues found: {'; '.join(issues)}",
                                results
                            )
                    except json.JSONDecodeError as e:
                        self.log_result(
                            "Ticket Generator Utility",
                            False,
                            f"❌ Failed to parse test results: {str(e)}",
                            result.stdout
                        )
                else:
                    self.log_result(
                        "Ticket Generator Utility",
                        False,
                        "❌ Could not find test results in output",
                        result.stdout
                    )
            else:
                self.log_result(
                    "Ticket Generator Utility",
                    False,
                    f"❌ Test script failed with return code {result.returncode}",
                    result.stderr
                )
        except Exception as e:
            self.log_result("Ticket Generator Utility", False, f"Exception: {str(e)}")

    def test_registration_creation_with_unique_tickets(self):
        """Test Case 2: Registration Creation with Unique Tickets"""
        try:
            # Test creating a registration with multiple tickets
            payload = {
                "event_id": "test-event-123",
                "attendee_name": "Alice Johnson",
                "attendee_email": "alice.johnson@example.com",
                "tickets": [
                    {
                        "tierId": "general",
                        "name": "General Admission",
                        "quantity": 2,
                        "price": 25.00
                    }
                ]
            }
            
            response = self.session.post(
                f"{BACKEND_URL}/api/registrations",
                json=payload,
                headers={'Content-Type': 'application/json'}
            )
            
            if response.status_code == 201:
                data = response.json()
                registration = data.get('registration', {})
                tickets = registration.get('tickets', [])
                
                success = True
                issues = []
                
                # Check that we got 2 individual tickets (not 1 with quantity=2)
                if len(tickets) != 2:
                    success = False
                    issues.append(f"Expected 2 individual tickets, got {len(tickets)}")
                
                # Check each ticket has unique identifiers
                ticket_ids = set()
                ticket_numbers = set()
                
                for i, ticket in enumerate(tickets):
                    # Check required fields
                    if not ticket.get('ticketId'):
                        success = False
                        issues.append(f"Ticket {i+1} missing ticketId")
                    else:
                        ticket_ids.add(ticket['ticketId'])
                    
                    if not ticket.get('ticketNumber'):
                        success = False
                        issues.append(f"Ticket {i+1} missing ticketNumber")
                    else:
                        ticket_numbers.add(ticket['ticketNumber'])
                    
                    if not ticket.get('qrCodeData'):
                        success = False
                        issues.append(f"Ticket {i+1} missing qrCodeData")
                    
                    # Check quantity is 1
                    if ticket.get('quantity') != 1:
                        success = False
                        issues.append(f"Ticket {i+1} has quantity {ticket.get('quantity')}, expected 1")
                    
                    # Check QR code data matches ticket ID
                    if ticket.get('qrCodeData') != ticket.get('ticketId'):
                        success = False
                        issues.append(f"Ticket {i+1} QR code data doesn't match ticket ID")
                    
                    # Check tier information is preserved
                    if ticket.get('tierId') != 'general':
                        success = False
                        issues.append(f"Ticket {i+1} has wrong tierId: {ticket.get('tierId')}")
                
                # Check uniqueness
                if len(ticket_ids) != len(tickets):
                    success = False
                    issues.append("Ticket IDs are not unique")
                
                if len(ticket_numbers) != len(tickets):
                    success = False
                    issues.append("Ticket numbers are not unique")
                
                if success:
                    self.log_result(
                        "Registration Creation with Unique Tickets",
                        True,
                        f"✅ Created registration with {len(tickets)} unique tickets, all with proper IDs and QR codes",
                        {
                            "registration_id": registration.get('id'),
                            "ticket_count": len(tickets),
                            "ticket_ids": [t.get('ticketId') for t in tickets],
                            "ticket_numbers": [t.get('ticketNumber') for t in tickets]
                        }
                    )
                else:
                    self.log_result(
                        "Registration Creation with Unique Tickets",
                        False,
                        f"❌ Issues found: {'; '.join(issues)}",
                        data
                    )
            else:
                self.log_result(
                    "Registration Creation with Unique Tickets",
                    False,
                    f"HTTP {response.status_code}",
                    response.text
                )
        except Exception as e:
            self.log_result("Registration Creation with Unique Tickets", False, f"Exception: {str(e)}")

    def test_checkin_api_authentication(self):
        """Test Case 3: Check-In API Authentication Requirements"""
        try:
            # Test check-in endpoint without authentication
            payload = {
                "ticketId": "TKT-1736789012345-a7f3x9",
                "eventId": "test-event-123"
            }
            
            response = self.session.post(
                f"{BACKEND_URL}/api/registrations/checkin",
                json=payload,
                headers={'Content-Type': 'application/json'}
            )
            
            # Should return 401 or 403 for missing authentication
            if response.status_code in [401, 403]:
                try:
                    data = response.json()
                    error_message = data.get('error', '')
                    
                    if 'authorization' in error_message.lower() or 'token' in error_message.lower():
                        self.log_result(
                            "Check-In API Authentication",
                            True,
                            f"✅ Properly requires authentication: HTTP {response.status_code} - {error_message}",
                            data
                        )
                    else:
                        self.log_result(
                            "Check-In API Authentication",
                            True,
                            f"✅ Properly blocks unauthorized access: HTTP {response.status_code}",
                            data
                        )
                except:
                    self.log_result(
                        "Check-In API Authentication",
                        True,
                        f"✅ Properly requires authentication: HTTP {response.status_code}",
                        response.text
                    )
            else:
                self.log_result(
                    "Check-In API Authentication",
                    False,
                    f"❌ Expected 401/403 for missing auth, got HTTP {response.status_code}",
                    response.text
                )
        except Exception as e:
            self.log_result("Check-In API Authentication", False, f"Exception: {str(e)}")

    def test_checkin_api_validation(self):
        """Test Case 4: Check-In API Validation and Error Handling"""
        try:
            test_cases = [
                {
                    "name": "Missing Ticket ID",
                    "payload": {"eventId": "test-event-123"},
                    "expected_status": 400,
                    "expected_error": "ticket id"
                },
                {
                    "name": "Missing Event ID", 
                    "payload": {"ticketId": "TKT-1736789012345-a7f3x9"},
                    "expected_status": [400, 401, 403],  # Could be validation or auth error
                    "expected_error": None
                },
                {
                    "name": "Invalid Ticket Format",
                    "payload": {"ticketId": "INVALID-FORMAT", "eventId": "test-event-123"},
                    "expected_status": [400, 401, 403, 404],
                    "expected_error": None
                }
            ]
            
            all_passed = True
            results = []
            
            for test_case in test_cases:
                try:
                    response = self.session.post(
                        f"{BACKEND_URL}/api/registrations/checkin",
                        json=test_case["payload"],
                        headers={'Content-Type': 'application/json'}
                    )
                    
                    expected_statuses = test_case["expected_status"]
                    if not isinstance(expected_statuses, list):
                        expected_statuses = [expected_statuses]
                    
                    if response.status_code in expected_statuses:
                        try:
                            data = response.json()
                            error_msg = data.get('error', '').lower()
                            
                            if test_case["expected_error"]:
                                if test_case["expected_error"].lower() in error_msg:
                                    results.append(f"✅ {test_case['name']}: Proper validation")
                                else:
                                    results.append(f"⚠️ {test_case['name']}: Expected error message not found")
                            else:
                                results.append(f"✅ {test_case['name']}: Proper error response")
                        except:
                            results.append(f"✅ {test_case['name']}: Proper error status")
                    else:
                        results.append(f"❌ {test_case['name']}: Expected {expected_statuses}, got {response.status_code}")
                        all_passed = False
                        
                except Exception as e:
                    results.append(f"❌ {test_case['name']}: Exception - {str(e)}")
                    all_passed = False
            
            self.log_result(
                "Check-In API Validation",
                all_passed,
                f"{'✅ All validation tests passed' if all_passed else '❌ Some validation tests failed'}: {'; '.join(results)}",
                {"test_results": results}
            )
            
        except Exception as e:
            self.log_result("Check-In API Validation", False, f"Exception: {str(e)}")

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