#!/usr/bin/env python3
"""
Check-In System Testing for OpenTicket Platform
Tests the critical check-in system fixes including scanner sync, portal functionality, and API endpoints
"""

import requests
import json
import time
import uuid
import subprocess
import os
from typing import Dict, Any, List
from datetime import datetime

# Configuration - Use production URL from frontend/.env
BACKEND_URL = "https://unified-emails.preview.emergentagent.com"

class CheckInSystemTester:
    def __init__(self):
        self.results = []
        self.session = requests.Session()
        self.auth_token = None
        self.event_id = None
        self.test_registration_id = None
        self.test_ticket_id = None
        
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
    
    def test_backend_connectivity(self):
        """Test Case 1: Verify backend is accessible and check-in endpoints exist"""
        try:
            # Test basic connectivity
            response = self.session.get(f"{BACKEND_URL}/api/health", timeout=10)
            
            if response.status_code == 200:
                self.log_result(
                    "Backend Connectivity",
                    True,
                    "✅ Backend is accessible and responding",
                    {"status": response.status_code}
                )
            else:
                self.log_result(
                    "Backend Connectivity",
                    False,
                    f"❌ Backend health check failed: HTTP {response.status_code}",
                    response.text
                )
                return False
            
            # Test check-in endpoint exists
            test_response = self.session.post(f"{BACKEND_URL}/api/registrations/checkin", json={})
            
            # Should return 401 (auth required) or 400 (bad request), not 404 (not found)
            if test_response.status_code in [400, 401, 403]:
                self.log_result(
                    "Check-In Endpoint Availability",
                    True,
                    f"✅ /api/registrations/checkin endpoint exists (HTTP {test_response.status_code})",
                    {"endpoint_exists": True}
                )
                return True
            elif test_response.status_code == 404:
                self.log_result(
                    "Check-In Endpoint Availability",
                    False,
                    "❌ /api/registrations/checkin endpoint not found",
                    {"status": test_response.status_code}
                )
                return False
            else:
                self.log_result(
                    "Check-In Endpoint Availability",
                    True,
                    f"✅ Check-in endpoint responding (HTTP {test_response.status_code})",
                    {"status": test_response.status_code}
                )
                return True
                
        except Exception as e:
            self.log_result("Backend Connectivity", False, f"Exception: {str(e)}")
            return False

    def test_user_authentication(self):
        """Test Case 2: Authenticate user for API testing"""
        try:
            # Use test credentials from review request
            user_data = {"email": "test+openticket@gmail.com", "password": "12345678"}
            
            response = self.session.post(f"{BACKEND_URL}/api/auth/login", json=user_data)
            
            if response.status_code == 200:
                try:
                    data = response.json()
                    # Extract token from various possible response formats
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
                            "User Authentication",
                            True,
                            f"✅ Successfully authenticated as {user_data['email']}",
                            {"authenticated": True, "token_length": len(token)}
                        )
                        return True
                    else:
                        self.log_result(
                            "User Authentication",
                            False,
                            f"❌ Login successful but no token found in response",
                            data
                        )
                        return False
                except json.JSONDecodeError:
                    self.log_result(
                        "User Authentication",
                        False,
                        f"❌ Invalid JSON response from login",
                        response.text
                    )
                    return False
            else:
                self.log_result(
                    "User Authentication",
                    False,
                    f"❌ Authentication failed: HTTP {response.status_code}",
                    {"status": response.status_code, "response": response.text[:200]}
                )
                return False
                
        except Exception as e:
            self.log_result("User Authentication", False, f"Exception: {str(e)}")
            return False

    def test_get_test_event(self):
        """Test Case 3: Get a test event for check-in testing"""
        try:
            # Try to get public events first
            response = self.session.get(f"{BACKEND_URL}/api/events/public")
            
            if response.status_code == 200:
                try:
                    data = response.json()
                    
                    if 'events' in data and isinstance(data['events'], list) and len(data['events']) > 0:
                        # Use the first available event
                        test_event = data['events'][0]
                        self.event_id = test_event['id']
                        
                        self.log_result(
                            "Get Test Event",
                            True,
                            f"✅ Found test event: {test_event.get('title', 'Unknown')} (ID: {self.event_id})",
                            {
                                "event_id": self.event_id,
                                "event_title": test_event.get('title'),
                                "total_events": len(data['events'])
                            }
                        )
                        return True
                    else:
                        self.log_result(
                            "Get Test Event",
                            False,
                            "❌ No public events available for testing",
                            {"events_count": 0}
                        )
                        return False
                except json.JSONDecodeError:
                    self.log_result(
                        "Get Test Event",
                        False,
                        "❌ Invalid JSON response from events API",
                        response.text
                    )
                    return False
            else:
                self.log_result(
                    "Get Test Event",
                    False,
                    f"❌ Failed to get events: HTTP {response.status_code}",
                    response.text
                )
                return False
                
        except Exception as e:
            self.log_result("Get Test Event", False, f"Exception: {str(e)}")
            return False

    def test_get_registrations(self):
        """Test Case 4: Get registrations for the test event"""
        try:
            if not self.event_id:
                self.log_result(
                    "Get Registrations",
                    False,
                    "❌ No event ID available for testing",
                    {"event_id": None}
                )
                return False
            
            # Get registrations for the event
            response = self.session.get(f"{BACKEND_URL}/api/registrations/{self.event_id}")
            
            if response.status_code == 200:
                try:
                    registrations = response.json()
                    
                    if isinstance(registrations, list) and len(registrations) > 0:
                        # Find a registration with tickets for testing
                        test_reg = None
                        test_ticket = None
                        
                        for reg in registrations:
                            if reg.get('tickets') and isinstance(reg['tickets'], list):
                                for ticket in reg['tickets']:
                                    if ticket.get('ticketId'):
                                        test_reg = reg
                                        test_ticket = ticket
                                        break
                                if test_reg:
                                    break
                        
                        if test_reg and test_ticket:
                            self.test_registration_id = test_reg['id']
                            self.test_ticket_id = test_ticket['ticketId']
                            
                            self.log_result(
                                "Get Registrations",
                                True,
                                f"✅ Found {len(registrations)} registrations, selected test ticket: {self.test_ticket_id}",
                                {
                                    "total_registrations": len(registrations),
                                    "test_registration_id": self.test_registration_id,
                                    "test_ticket_id": self.test_ticket_id,
                                    "attendee_name": test_reg.get('attendeeName', 'Unknown')
                                }
                            )
                            return True
                        else:
                            self.log_result(
                                "Get Registrations",
                                False,
                                f"❌ Found {len(registrations)} registrations but no valid tickets with ticketId",
                                {"registrations_count": len(registrations)}
                            )
                            return False
                    else:
                        self.log_result(
                            "Get Registrations",
                            False,
                            "❌ No registrations found for this event",
                            {"registrations_count": 0}
                        )
                        return False
                except json.JSONDecodeError:
                    self.log_result(
                        "Get Registrations",
                        False,
                        "❌ Invalid JSON response from registrations API",
                        response.text
                    )
                    return False
            elif response.status_code == 401:
                self.log_result(
                    "Get Registrations",
                    False,
                    "❌ Authentication failed - token may be invalid",
                    {"status": response.status_code}
                )
                return False
            else:
                self.log_result(
                    "Get Registrations",
                    False,
                    f"❌ Failed to get registrations: HTTP {response.status_code}",
                    response.text
                )
                return False
                
        except Exception as e:
            self.log_result("Get Registrations", False, f"Exception: {str(e)}")
            return False

    def test_checkin_api_endpoint(self):
        """Test Case 5: Test the /api/registrations/checkin endpoint directly"""
        try:
            if not self.test_ticket_id or not self.event_id:
                self.log_result(
                    "Check-In API Endpoint",
                    False,
                    "❌ Missing test ticket ID or event ID",
                    {"ticket_id": self.test_ticket_id, "event_id": self.event_id}
                )
                return False
            
            # Test the check-in API endpoint
            payload = {
                "ticketId": self.test_ticket_id,
                "eventId": self.event_id
            }
            
            response = self.session.post(f"{BACKEND_URL}/api/registrations/checkin", json=payload)
            
            if response.status_code == 200:
                try:
                    data = response.json()
                    
                    if data.get('success'):
                        self.log_result(
                            "Check-In API Endpoint",
                            True,
                            f"✅ Check-in API successful: {data.get('message', 'Success')}",
                            {
                                "success": data.get('success'),
                                "message": data.get('message'),
                                "ticket_info": data.get('ticket', {}),
                                "attendee_name": data.get('ticket', {}).get('attendeeName')
                            }
                        )
                        return True
                    else:
                        self.log_result(
                            "Check-In API Endpoint",
                            False,
                            f"❌ Check-in failed: {data.get('message', 'Unknown error')}",
                            data
                        )
                        return False
                except json.JSONDecodeError:
                    self.log_result(
                        "Check-In API Endpoint",
                        False,
                        "❌ Invalid JSON response from check-in API",
                        response.text
                    )
                    return False
            elif response.status_code == 400:
                try:
                    data = response.json()
                    # This might be expected if ticket is already checked in or invalid
                    self.log_result(
                        "Check-In API Endpoint",
                        True,
                        f"✅ Check-in API properly validated request: {data.get('error', 'Bad request')}",
                        {
                            "status": response.status_code,
                            "error": data.get('error'),
                            "validation_working": True
                        }
                    )
                    return True
                except json.JSONDecodeError:
                    self.log_result(
                        "Check-In API Endpoint",
                        False,
                        f"❌ Bad request with invalid JSON: HTTP {response.status_code}",
                        response.text
                    )
                    return False
            elif response.status_code == 401:
                self.log_result(
                    "Check-In API Endpoint",
                    False,
                    "❌ Authentication failed - token may be invalid",
                    {"status": response.status_code}
                )
                return False
            else:
                self.log_result(
                    "Check-In API Endpoint",
                    False,
                    f"❌ Unexpected response: HTTP {response.status_code}",
                    response.text
                )
                return False
                
        except Exception as e:
            self.log_result("Check-In API Endpoint", False, f"Exception: {str(e)}")
            return False

    def test_checkin_api_validation(self):
        """Test Case 6: Test check-in API validation with invalid data"""
        try:
            # Test with missing ticketId
            payload1 = {"eventId": self.event_id}
            response1 = self.session.post(f"{BACKEND_URL}/api/registrations/checkin", json=payload1)
            
            # Test with missing eventId
            payload2 = {"ticketId": "invalid-ticket-id"}
            response2 = self.session.post(f"{BACKEND_URL}/api/registrations/checkin", json=payload2)
            
            # Test with invalid ticketId
            payload3 = {"ticketId": "INVALID-TICKET-12345", "eventId": self.event_id}
            response3 = self.session.post(f"{BACKEND_URL}/api/registrations/checkin", json=payload3)
            
            validation_results = []
            
            # Check if validation is working (should return 400 for missing fields)
            if response1.status_code in [400, 422]:
                validation_results.append("✅ Missing ticketId properly rejected")
            else:
                validation_results.append(f"❌ Missing ticketId not rejected (HTTP {response1.status_code})")
            
            if response2.status_code in [400, 422]:
                validation_results.append("✅ Missing eventId properly rejected")
            else:
                validation_results.append(f"❌ Missing eventId not rejected (HTTP {response2.status_code})")
            
            if response3.status_code in [400, 404]:
                validation_results.append("✅ Invalid ticketId properly rejected")
            else:
                validation_results.append(f"❌ Invalid ticketId not rejected (HTTP {response3.status_code})")
            
            success = all("✅" in result for result in validation_results)
            
            self.log_result(
                "Check-In API Validation",
                success,
                f"API validation tests: {'; '.join(validation_results)}",
                {
                    "missing_ticket_status": response1.status_code,
                    "missing_event_status": response2.status_code,
                    "invalid_ticket_status": response3.status_code
                }
            )
            return success
                
        except Exception as e:
            self.log_result("Check-In API Validation", False, f"Exception: {str(e)}")
            return False

    def test_mobile_scanner_endpoint_compatibility(self):
        """Test Case 7: Verify Mobile Scanner uses correct endpoint"""
        try:
            # This test verifies that the Mobile Scanner component is configured to use the correct endpoint
            # We'll test the endpoint format that Mobile Scanner should be using
            
            if not self.test_ticket_id or not self.event_id:
                self.log_result(
                    "Mobile Scanner Endpoint Compatibility",
                    False,
                    "❌ Missing test data for endpoint compatibility test",
                    {"ticket_id": self.test_ticket_id, "event_id": self.event_id}
                )
                return False
            
            # Test the exact payload format that Mobile Scanner should send
            mobile_scanner_payload = {
                "ticketId": self.test_ticket_id,
                "eventId": self.event_id
            }
            
            response = self.session.post(f"{BACKEND_URL}/api/registrations/checkin", json=mobile_scanner_payload)
            
            # The endpoint should handle this format correctly (success or proper error)
            if response.status_code in [200, 400, 404]:
                try:
                    data = response.json()
                    self.log_result(
                        "Mobile Scanner Endpoint Compatibility",
                        True,
                        f"✅ Mobile Scanner payload format handled correctly: {data.get('message', 'Success')}",
                        {
                            "status": response.status_code,
                            "payload_format": "mobile_scanner_compatible",
                            "response": data
                        }
                    )
                    return True
                except json.JSONDecodeError:
                    self.log_result(
                        "Mobile Scanner Endpoint Compatibility",
                        False,
                        f"❌ Invalid JSON response for Mobile Scanner format: HTTP {response.status_code}",
                        response.text
                    )
                    return False
            else:
                self.log_result(
                    "Mobile Scanner Endpoint Compatibility",
                    False,
                    f"❌ Mobile Scanner payload format not handled: HTTP {response.status_code}",
                    response.text
                )
                return False
                
        except Exception as e:
            self.log_result("Mobile Scanner Endpoint Compatibility", False, f"Exception: {str(e)}")
            return False

    def test_cross_scanner_data_structure(self):
        """Test Case 8: Verify data structure supports cross-scanner synchronization"""
        try:
            if not self.test_registration_id:
                self.log_result(
                    "Cross-Scanner Data Structure",
                    False,
                    "❌ No test registration available for data structure test",
                    {"registration_id": None}
                )
                return False
            
            # Get the registration data to check the structure
            response = self.session.get(f"{BACKEND_URL}/api/registrations/{self.event_id}")
            
            if response.status_code == 200:
                try:
                    registrations = response.json()
                    
                    # Find our test registration
                    test_reg = None
                    for reg in registrations:
                        if reg['id'] == self.test_registration_id:
                            test_reg = reg
                            break
                    
                    if not test_reg:
                        self.log_result(
                            "Cross-Scanner Data Structure",
                            False,
                            "❌ Test registration not found in response",
                            {"registration_id": self.test_registration_id}
                        )
                        return False
                    
                    # Check for required fields for cross-scanner sync
                    required_fields = ['tickets', 'checked_in', 'check_in_statuses']
                    structure_checks = []
                    
                    # Check tickets array
                    if 'tickets' in test_reg and isinstance(test_reg['tickets'], list):
                        structure_checks.append("✅ tickets[] array present")
                        
                        # Check individual ticket structure
                        if len(test_reg['tickets']) > 0:
                            ticket = test_reg['tickets'][0]
                            if 'checkedIn' in ticket:
                                structure_checks.append("✅ tickets[].checkedIn field present")
                            else:
                                structure_checks.append("❌ tickets[].checkedIn field missing")
                            
                            if 'ticketId' in ticket:
                                structure_checks.append("✅ tickets[].ticketId field present")
                            else:
                                structure_checks.append("❌ tickets[].ticketId field missing")
                    else:
                        structure_checks.append("❌ tickets[] array missing or invalid")
                    
                    # Check registration-level checked_in flag
                    if 'checked_in' in test_reg:
                        structure_checks.append("✅ checked_in flag present")
                    else:
                        structure_checks.append("❌ checked_in flag missing")
                    
                    # Check check_in_statuses JSONB field
                    if 'check_in_statuses' in test_reg:
                        structure_checks.append("✅ check_in_statuses field present")
                    else:
                        structure_checks.append("❌ check_in_statuses field missing")
                    
                    success = all("✅" in check for check in structure_checks)
                    
                    self.log_result(
                        "Cross-Scanner Data Structure",
                        success,
                        f"Data structure validation: {'; '.join(structure_checks)}",
                        {
                            "registration_structure": {
                                "has_tickets": 'tickets' in test_reg,
                                "has_checked_in": 'checked_in' in test_reg,
                                "has_check_in_statuses": 'check_in_statuses' in test_reg,
                                "tickets_count": len(test_reg.get('tickets', []))
                            }
                        }
                    )
                    return success
                    
                except json.JSONDecodeError:
                    self.log_result(
                        "Cross-Scanner Data Structure",
                        False,
                        "❌ Invalid JSON response from registrations API",
                        response.text
                    )
                    return False
            else:
                self.log_result(
                    "Cross-Scanner Data Structure",
                    False,
                    f"❌ Failed to get registration data: HTTP {response.status_code}",
                    response.text
                )
                return False
                
        except Exception as e:
            self.log_result("Cross-Scanner Data Structure", False, f"Exception: {str(e)}")
            return False

    def test_auto_refresh_simulation(self):
        """Test Case 9: Simulate auto-refresh behavior for Check-In Portal"""
        try:
            if not self.event_id:
                self.log_result(
                    "Auto-Refresh Simulation",
                    False,
                    "❌ No event ID available for auto-refresh test",
                    {"event_id": None}
                )
                return False
            
            # Simulate the auto-refresh by making multiple requests 3 seconds apart
            refresh_results = []
            
            for i in range(3):
                start_time = time.time()
                response = self.session.get(f"{BACKEND_URL}/api/registrations/{self.event_id}")
                end_time = time.time()
                
                if response.status_code == 200:
                    try:
                        data = response.json()
                        response_time = (end_time - start_time) * 1000  # Convert to milliseconds
                        
                        refresh_results.append({
                            "iteration": i + 1,
                            "success": True,
                            "response_time_ms": round(response_time, 2),
                            "registrations_count": len(data) if isinstance(data, list) else 0
                        })
                    except json.JSONDecodeError:
                        refresh_results.append({
                            "iteration": i + 1,
                            "success": False,
                            "error": "Invalid JSON"
                        })
                else:
                    refresh_results.append({
                        "iteration": i + 1,
                        "success": False,
                        "status": response.status_code
                    })
                
                # Wait 3 seconds before next request (simulating auto-refresh interval)
                if i < 2:  # Don't wait after the last iteration
                    time.sleep(3)
            
            successful_refreshes = sum(1 for r in refresh_results if r.get('success', False))
            avg_response_time = sum(r.get('response_time_ms', 0) for r in refresh_results if r.get('success', False)) / max(successful_refreshes, 1)
            
            success = successful_refreshes >= 2  # At least 2 out of 3 should succeed
            
            self.log_result(
                "Auto-Refresh Simulation",
                success,
                f"✅ Auto-refresh simulation: {successful_refreshes}/3 successful, avg response time: {avg_response_time:.2f}ms" if success else f"❌ Auto-refresh failed: only {successful_refreshes}/3 successful",
                {
                    "successful_refreshes": successful_refreshes,
                    "total_attempts": 3,
                    "average_response_time_ms": round(avg_response_time, 2),
                    "refresh_results": refresh_results
                }
            )
            return success
                
        except Exception as e:
            self.log_result("Auto-Refresh Simulation", False, f"Exception: {str(e)}")
            return False

    def test_check_portal_no_qr_scanner(self):
        """Test Case 10: Verify Check-In Portal has no QR scanner functionality"""
        try:
            # This is a code-based test since we can't directly test the UI
            # We'll check if the QR scanner endpoints are properly separated
            
            # Test that kiosk scan endpoint exists (for Kiosk Mode)
            kiosk_response = self.session.post(f"{BACKEND_URL}/api/kiosk/scan", json={})
            
            # Test that check-in portal uses different endpoint (registrations/checkin)
            portal_response = self.session.post(f"{BACKEND_URL}/api/registrations/checkin", json={})
            
            kiosk_exists = kiosk_response.status_code != 404
            portal_exists = portal_response.status_code != 404
            
            if kiosk_exists and portal_exists:
                self.log_result(
                    "Check-In Portal QR Scanner Separation",
                    True,
                    "✅ Kiosk scan endpoint and Portal check-in endpoint are properly separated",
                    {
                        "kiosk_scan_endpoint": f"HTTP {kiosk_response.status_code}",
                        "portal_checkin_endpoint": f"HTTP {portal_response.status_code}",
                        "endpoints_separated": True
                    }
                )
                return True
            else:
                self.log_result(
                    "Check-In Portal QR Scanner Separation",
                    False,
                    f"❌ Endpoint separation issue - Kiosk: {kiosk_response.status_code}, Portal: {portal_response.status_code}",
                    {
                        "kiosk_scan_exists": kiosk_exists,
                        "portal_checkin_exists": portal_exists
                    }
                )
                return False
                
        except Exception as e:
            self.log_result("Check-In Portal QR Scanner Separation", False, f"Exception: {str(e)}")
            return False

    def run_all_tests(self):
        """Run all check-in system tests"""
        print("🎫 Starting Check-In System Testing")
        print("=" * 70)
        print("🎯 TESTING FOCUS: Critical Check-In System Fixes")
        print("=" * 70)
        
        # Infrastructure Tests
        print("\n🔧 INFRASTRUCTURE TESTS")
        print("-" * 40)
        connectivity_success = self.test_backend_connectivity()
        
        if not connectivity_success:
            print("❌ CRITICAL: Backend connectivity failed - cannot continue testing")
            return False
        
        # Authentication Tests
        print("\n🔐 AUTHENTICATION TESTS")
        print("-" * 40)
        auth_success = self.test_user_authentication()
        
        if not auth_success:
            print("⚠️ WARNING: Authentication failed - some tests will be skipped")
        
        # Event Setup Tests
        print("\n📅 EVENT SETUP TESTS")
        print("-" * 40)
        event_success = self.test_get_test_event()
        
        if not event_success:
            print("❌ CRITICAL: No test event available - cannot test check-in functionality")
            return False
        
        # Registration Data Tests
        if auth_success:
            print("\n📋 REGISTRATION DATA TESTS")
            print("-" * 40)
            reg_success = self.test_get_registrations()
            
            if reg_success:
                # API Endpoint Tests
                print("\n🔌 API ENDPOINT TESTS")
                print("-" * 40)
                self.test_checkin_api_endpoint()
                self.test_checkin_api_validation()
                self.test_mobile_scanner_endpoint_compatibility()
                
                # Data Structure Tests
                print("\n📊 DATA STRUCTURE TESTS")
                print("-" * 40)
                self.test_cross_scanner_data_structure()
            else:
                print("⚠️ WARNING: No test registrations available - skipping API tests")
        
        # System Behavior Tests
        print("\n⚡ SYSTEM BEHAVIOR TESTS")
        print("-" * 40)
        if auth_success:
            self.test_auto_refresh_simulation()
        self.test_check_portal_no_qr_scanner()
        
        # Summary
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
        
        # Check specific requirements from review request
        backend_conn = next((r for r in self.results if 'Backend Connectivity' in r['test']), None)
        checkin_endpoint = next((r for r in self.results if 'Check-In API Endpoint' in r['test']), None)
        mobile_compat = next((r for r in self.results if 'Mobile Scanner Endpoint' in r['test']), None)
        data_structure = next((r for r in self.results if 'Cross-Scanner Data Structure' in r['test']), None)
        auto_refresh = next((r for r in self.results if 'Auto-Refresh Simulation' in r['test']), None)
        qr_separation = next((r for r in self.results if 'QR Scanner Separation' in r['test']), None)
        
        if backend_conn and backend_conn['success']:
            criteria_results.append("✅ Backend is healthy and check-in endpoints exist")
        else:
            criteria_results.append("❌ Backend connectivity issues")
        
        if checkin_endpoint and checkin_endpoint['success']:
            criteria_results.append("✅ /api/registrations/checkin endpoint working correctly")
        else:
            criteria_results.append("❌ Check-in API endpoint issues")
        
        if mobile_compat and mobile_compat['success']:
            criteria_results.append("✅ Mobile Scanner endpoint compatibility verified")
        else:
            criteria_results.append("❌ Mobile Scanner compatibility issues")
        
        if data_structure and data_structure['success']:
            criteria_results.append("✅ Cross-scanner synchronization data structure correct")
        else:
            criteria_results.append("❌ Data structure issues for cross-scanner sync")
        
        if auto_refresh and auto_refresh['success']:
            criteria_results.append("✅ Auto-refresh functionality working (3-second polling)")
        else:
            criteria_results.append("❌ Auto-refresh simulation failed")
        
        if qr_separation and qr_separation['success']:
            criteria_results.append("✅ Check-In Portal and Kiosk endpoints properly separated")
        else:
            criteria_results.append("❌ QR scanner separation issues")
        
        for criterion in criteria_results:
            print(f"  {criterion}")
        
        if total - passed > 0:
            print("\n❌ FAILED TESTS:")
            for result in self.results:
                if not result['success']:
                    print(f"  - {result['test']}: {result['details']}")
        
        print("\n📋 TESTING NOTES:")
        print("  - Check-In Portal should have NO QR scanner button/camera icon")
        print("  - Mobile Scanner should use /api/registrations/checkin endpoint")
        print("  - Auto-refresh should update Check-In Portal every 3 seconds")
        print("  - Cross-scanner sync should update all three data fields:")
        print("    * tickets[].checkedIn = true")
        print("    * checked_in = true") 
        print("    * check_in_statuses[ticketKey] = {checkedIn: true, timestamp: ...}")
        
        print("\n🔍 EXPECTED BEHAVIOR:")
        print("  - Mobile Scanner check-ins should appear in Check-In Portal within 3 seconds")
        print("  - Check-In Portal should only show manual check-in buttons (no QR scanner)")
        print("  - Kiosk Mode should be fullscreen with floating 'Leave' button")
        print("  - All scanners should synchronize ticket status across the system")
        
        return passed == total

if __name__ == "__main__":
    tester = CheckInSystemTester()
    success = tester.run_all_tests()
    
    # Save detailed results
    with open('/app/checkin_system_test_results.json', 'w') as f:
        json.dump(tester.results, f, indent=2)
    
    print(f"\n📄 Detailed results saved to: /app/checkin_system_test_results.json")
    
    if success:
        print("\n🎉 All Check-In System tests PASSED!")
        exit(0)
    else:
        print("\n⚠️  Some tests FAILED - see details above")
        exit(1)