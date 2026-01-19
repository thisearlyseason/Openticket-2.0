#!/usr/bin/env python3
"""
Backend API Testing for OpenTicket Platform - Kiosk Mode Implementation
Tests the complete Kiosk Mode backend API implementation for event organizers
"""

import requests
import json
import time
import uuid
import subprocess
import os
from typing import Dict, Any

# Configuration - Use production URL from frontend/.env
BACKEND_URL = "https://scan-entry-3.preview.emergentagent.com"

class KioskModeTester:
    def __init__(self):
        self.results = []
        self.session = requests.Session()
        self.auth_token = None
        self.event_id = None
        self.kiosk_token = None
        
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
    
    def test_user_login(self):
        """Test Case 1: Login as test user"""
        # Use the credentials from the review request
        user_data = {"email": "test+openticket@gmail.com", "password": "12345678"}
        
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
                            "User Login",
                            True,
                            f"✅ Successfully logged in as {user_data['email']}",
                            {"email": user_data['email'], "token_received": True}
                        )
                        return True
                    else:
                        self.log_result(
                            "User Login - Token Missing",
                            False,
                            f"❌ Login successful for {user_data['email']} but no token found",
                            data
                        )
                except json.JSONDecodeError:
                    self.log_result(
                        "User Login - JSON Error",
                        False,
                        f"❌ Invalid JSON response for {user_data['email']}",
                        response.text
                    )
            elif response.status_code == 401:
                self.log_result(
                    "User Login - Invalid Credentials",
                    False,
                    f"❌ Invalid credentials for {user_data['email']}",
                    {"status": response.status_code}
                )
            else:
                self.log_result(
                    "User Login - Unexpected Response",
                    False,
                    f"❌ Unexpected response for {user_data['email']}: HTTP {response.status_code}",
                    response.text
                )
                    
        except Exception as e:
            self.log_result("User Login - Exception", False, f"Exception for {user_data['email']}: {str(e)}")
        
        return False

    def test_get_user_events(self):
        """Test Case 2: Get list of user's events"""
        try:
            if not self.auth_token:
                self.log_result(
                    "Get User Events - Authentication Required",
                    False,
                    "❌ Cannot test without authentication token",
                    {"auth_token": None}
                )
                return False
            
            response = self.session.get(f"{BACKEND_URL}/api/events/")
            
            if response.status_code == 200:
                try:
                    data = response.json()
                    
                    if 'events' in data and isinstance(data['events'], list):
                        events = data['events']
                        
                        if len(events) > 0:
                            # Select first event for testing
                            self.event_id = events[0]['id']
                            
                            self.log_result(
                                "Get User Events",
                                True,
                                f"✅ Successfully retrieved {len(events)} events, selected event: {self.event_id}",
                                {
                                    "total_events": len(events),
                                    "selected_event_id": self.event_id,
                                    "event_title": events[0].get('title', 'Unknown')
                                }
                            )
                            return True
                        else:
                            self.log_result(
                                "Get User Events - No Events",
                                False,
                                "❌ User has no events available for testing",
                                {"events_count": 0}
                            )
                            return False
                    else:
                        self.log_result(
                            "Get User Events - Invalid Response",
                            False,
                            "❌ Response missing 'events' array",
                            data
                        )
                        return False
                except json.JSONDecodeError:
                    self.log_result(
                        "Get User Events - JSON Error",
                        False,
                        "❌ Invalid JSON response",
                        response.text
                    )
                    return False
            elif response.status_code == 401:
                self.log_result(
                    "Get User Events - Authentication",
                    False,
                    "❌ Authentication failed - token may be invalid",
                    {"status": response.status_code}
                )
                return False
            else:
                self.log_result(
                    "Get User Events",
                    False,
                    f"❌ Unexpected status code: {response.status_code}",
                    response.text
                )
                return False
                
        except Exception as e:
            self.log_result("Get User Events", False, f"Exception: {str(e)}")
            return False

    def test_generate_kiosk_token(self):
        """Test Case 3: Generate a new kiosk token"""
        try:
            if not self.auth_token or not self.event_id:
                self.log_result(
                    "Generate Kiosk Token - Prerequisites",
                    False,
                    "❌ Cannot test without authentication token and event ID",
                    {"auth_token": bool(self.auth_token), "event_id": bool(self.event_id)}
                )
                return False
            
            payload = {
                "eventId": self.event_id,
                "paymentEnabled": True,
                "pinCode": "1234"
            }
            
            response = self.session.post(f"{BACKEND_URL}/api/kiosk/generate", json=payload)
            
            if response.status_code == 200:
                try:
                    data = response.json()
                    
                    if data.get('success') and 'token' in data:
                        self.kiosk_token = data['token']
                        
                        self.log_result(
                            "Generate Kiosk Token",
                            True,
                            f"✅ Successfully generated kiosk token: {self.kiosk_token[:8]}...",
                            {
                                "token_id": self.kiosk_token,
                                "expires_at": data.get('expiresAt'),
                                "kiosk_url": data.get('kioskUrl')
                            }
                        )
                        return True
                    else:
                        self.log_result(
                            "Generate Kiosk Token - Invalid Response",
                            False,
                            "❌ Response missing success or token field",
                            data
                        )
                        return False
                except json.JSONDecodeError:
                    self.log_result(
                        "Generate Kiosk Token - JSON Error",
                        False,
                        "❌ Invalid JSON response",
                        response.text
                    )
                    return False
            elif response.status_code == 401:
                self.log_result(
                    "Generate Kiosk Token - Authentication",
                    False,
                    "❌ Authentication failed - token may be invalid",
                    {"status": response.status_code}
                )
                return False
            elif response.status_code == 403:
                self.log_result(
                    "Generate Kiosk Token - Authorization",
                    False,
                    "❌ Access denied - user may not own this event",
                    {"status": response.status_code}
                )
                return False
            else:
                self.log_result(
                    "Generate Kiosk Token",
                    False,
                    f"❌ Unexpected status code: {response.status_code}",
                    response.text
                )
                return False
                
        except Exception as e:
            self.log_result("Generate Kiosk Token", False, f"Exception: {str(e)}")
            return False

    def test_get_kiosk_status(self):
        """Test Case 4: Get current kiosk status"""
        try:
            if not self.auth_token or not self.event_id:
                self.log_result(
                    "Get Kiosk Status - Prerequisites",
                    False,
                    "❌ Cannot test without authentication token and event ID",
                    {"auth_token": bool(self.auth_token), "event_id": bool(self.event_id)}
                )
                return False
            
            response = self.session.get(f"{BACKEND_URL}/api/kiosk/status/{self.event_id}")
            
            if response.status_code == 200:
                try:
                    data = response.json()
                    
                    if data.get('success'):
                        is_active = data.get('active', False)
                        
                        self.log_result(
                            "Get Kiosk Status",
                            True,
                            f"✅ Successfully retrieved kiosk status: {'Active' if is_active else 'Inactive'}",
                            {
                                "active": is_active,
                                "token_info": data.get('token'),
                                "kiosk_url": data.get('kioskUrl')
                            }
                        )
                        return True
                    else:
                        self.log_result(
                            "Get Kiosk Status - Invalid Response",
                            False,
                            "❌ Response missing success field",
                            data
                        )
                        return False
                except json.JSONDecodeError:
                    self.log_result(
                        "Get Kiosk Status - JSON Error",
                        False,
                        "❌ Invalid JSON response",
                        response.text
                    )
                    return False
            elif response.status_code == 401:
                self.log_result(
                    "Get Kiosk Status - Authentication",
                    False,
                    "❌ Authentication failed - token may be invalid",
                    {"status": response.status_code}
                )
                return False
            elif response.status_code == 403:
                self.log_result(
                    "Get Kiosk Status - Authorization",
                    False,
                    "❌ Access denied - user may not own this event",
                    {"status": response.status_code}
                )
                return False
            else:
                self.log_result(
                    "Get Kiosk Status",
                    False,
                    f"❌ Unexpected status code: {response.status_code}",
                    response.text
                )
                return False
                
        except Exception as e:
            self.log_result("Get Kiosk Status", False, f"Exception: {str(e)}")
            return False

    def test_validate_kiosk_token(self):
        """Test Case 5: Validate kiosk token"""
        try:
            if not self.kiosk_token or not self.event_id:
                self.log_result(
                    "Validate Kiosk Token - Prerequisites",
                    False,
                    "❌ Cannot test without kiosk token and event ID",
                    {"kiosk_token": bool(self.kiosk_token), "event_id": bool(self.event_id)}
                )
                return False
            
            payload = {
                "tokenId": self.kiosk_token,
                "eventId": self.event_id
            }
            
            response = self.session.post(f"{BACKEND_URL}/api/kiosk/validate", json=payload)
            
            if response.status_code == 200:
                try:
                    data = response.json()
                    
                    if data.get('success') and 'token' in data and 'event' in data:
                        self.log_result(
                            "Validate Kiosk Token",
                            True,
                            f"✅ Successfully validated kiosk token",
                            {
                                "token_valid": True,
                                "event_title": data['event'].get('title'),
                                "permissions": data['token'].get('permissions'),
                                "payment_enabled": data['token'].get('paymentEnabled')
                            }
                        )
                        return True
                    else:
                        self.log_result(
                            "Validate Kiosk Token - Invalid Response",
                            False,
                            "❌ Response missing required fields",
                            data
                        )
                        return False
                except json.JSONDecodeError:
                    self.log_result(
                        "Validate Kiosk Token - JSON Error",
                        False,
                        "❌ Invalid JSON response",
                        response.text
                    )
                    return False
            elif response.status_code == 404:
                self.log_result(
                    "Validate Kiosk Token - Not Found",
                    False,
                    "❌ Token not found or invalid",
                    {"status": response.status_code}
                )
                return False
            elif response.status_code == 403:
                self.log_result(
                    "Validate Kiosk Token - Forbidden",
                    False,
                    "❌ Token has been revoked or expired",
                    {"status": response.status_code}
                )
                return False
            else:
                self.log_result(
                    "Validate Kiosk Token",
                    False,
                    f"❌ Unexpected status code: {response.status_code}",
                    response.text
                )
                return False
                
        except Exception as e:
            self.log_result("Validate Kiosk Token", False, f"Exception: {str(e)}")
            return False

    def test_guest_search(self):
        """Test Case 6: Search for guests"""
        try:
            if not self.kiosk_token or not self.event_id:
                self.log_result(
                    "Guest Search - Prerequisites",
                    False,
                    "❌ Cannot test without kiosk token and event ID",
                    {"kiosk_token": bool(self.kiosk_token), "event_id": bool(self.event_id)}
                )
                return False
            
            # Test search with a common query
            params = {
                "query": "test",
                "tokenId": self.kiosk_token,
                "eventId": self.event_id
            }
            
            response = self.session.get(f"{BACKEND_URL}/api/kiosk/guest-search", params=params)
            
            if response.status_code == 200:
                try:
                    data = response.json()
                    
                    if data.get('success') and 'results' in data:
                        results = data['results']
                        
                        self.log_result(
                            "Guest Search",
                            True,
                            f"✅ Successfully searched guests, found {len(results)} results",
                            {
                                "search_query": "test",
                                "results_count": len(results),
                                "results_structure": "valid"
                            }
                        )
                        return True
                    else:
                        self.log_result(
                            "Guest Search - Invalid Response",
                            False,
                            "❌ Response missing required fields",
                            data
                        )
                        return False
                except json.JSONDecodeError:
                    self.log_result(
                        "Guest Search - JSON Error",
                        False,
                        "❌ Invalid JSON response",
                        response.text
                    )
                    return False
            elif response.status_code == 403:
                self.log_result(
                    "Guest Search - Forbidden",
                    False,
                    "❌ Token invalid or expired",
                    {"status": response.status_code}
                )
                return False
            else:
                self.log_result(
                    "Guest Search",
                    False,
                    f"❌ Unexpected status code: {response.status_code}",
                    response.text
                )
                return False
                
        except Exception as e:
            self.log_result("Guest Search", False, f"Exception: {str(e)}")
            return False

    def test_invalid_ticket_scan(self):
        """Test Case 7: Scan invalid ticket"""
        try:
            if not self.kiosk_token or not self.event_id:
                self.log_result(
                    "Invalid Ticket Scan - Prerequisites",
                    False,
                    "❌ Cannot test without kiosk token and event ID",
                    {"kiosk_token": bool(self.kiosk_token), "event_id": bool(self.event_id)}
                )
                return False
            
            payload = {
                "qrCode": "INVALID_CODE_12345",
                "tokenId": self.kiosk_token,
                "eventId": self.event_id,
                "deviceId": "test-device"
            }
            
            response = self.session.post(f"{BACKEND_URL}/api/kiosk/scan", json=payload)
            
            if response.status_code == 200:
                try:
                    data = response.json()
                    
                    # For invalid tickets, we expect success: false, status: 'invalid'
                    if not data.get('success') and data.get('status') == 'invalid':
                        self.log_result(
                            "Invalid Ticket Scan",
                            True,
                            f"✅ Successfully handled invalid ticket scan: {data.get('message')}",
                            {
                                "success": data.get('success'),
                                "status": data.get('status'),
                                "message": data.get('message')
                            }
                        )
                        return True
                    else:
                        self.log_result(
                            "Invalid Ticket Scan - Unexpected Response",
                            False,
                            "❌ Expected invalid ticket response but got different result",
                            data
                        )
                        return False
                except json.JSONDecodeError:
                    self.log_result(
                        "Invalid Ticket Scan - JSON Error",
                        False,
                        "❌ Invalid JSON response",
                        response.text
                    )
                    return False
            elif response.status_code == 403:
                self.log_result(
                    "Invalid Ticket Scan - Forbidden",
                    False,
                    "❌ Token invalid or expired",
                    {"status": response.status_code}
                )
                return False
            else:
                self.log_result(
                    "Invalid Ticket Scan",
                    False,
                    f"❌ Unexpected status code: {response.status_code}",
                    response.text
                )
                return False
                
        except Exception as e:
            self.log_result("Invalid Ticket Scan", False, f"Exception: {str(e)}")
            return False

    def test_revoke_kiosk_token(self):
        """Test Case 8: Revoke kiosk token"""
        try:
            if not self.auth_token or not self.event_id:
                self.log_result(
                    "Revoke Kiosk Token - Prerequisites",
                    False,
                    "❌ Cannot test without authentication token and event ID",
                    {"auth_token": bool(self.auth_token), "event_id": bool(self.event_id)}
                )
                return False
            
            payload = {
                "eventId": self.event_id
            }
            
            response = self.session.post(f"{BACKEND_URL}/api/kiosk/revoke", json=payload)
            
            if response.status_code == 200:
                try:
                    data = response.json()
                    
                    if data.get('success'):
                        self.log_result(
                            "Revoke Kiosk Token",
                            True,
                            f"✅ Successfully revoked kiosk token",
                            {
                                "success": data.get('success'),
                                "message": data.get('message')
                            }
                        )
                        return True
                    else:
                        self.log_result(
                            "Revoke Kiosk Token - Invalid Response",
                            False,
                            "❌ Response missing success field",
                            data
                        )
                        return False
                except json.JSONDecodeError:
                    self.log_result(
                        "Revoke Kiosk Token - JSON Error",
                        False,
                        "❌ Invalid JSON response",
                        response.text
                    )
                    return False
            elif response.status_code == 401:
                self.log_result(
                    "Revoke Kiosk Token - Authentication",
                    False,
                    "❌ Authentication failed - token may be invalid",
                    {"status": response.status_code}
                )
                return False
            elif response.status_code == 403:
                self.log_result(
                    "Revoke Kiosk Token - Authorization",
                    False,
                    "❌ Access denied - user may not own this event",
                    {"status": response.status_code}
                )
                return False
            else:
                self.log_result(
                    "Revoke Kiosk Token",
                    False,
                    f"❌ Unexpected status code: {response.status_code}",
                    response.text
                )
                return False
                
        except Exception as e:
            self.log_result("Revoke Kiosk Token", False, f"Exception: {str(e)}")
            return False

    def test_validate_revoked_token(self):
        """Test Case 9: Validate revoked token (should fail)"""
        try:
            if not self.kiosk_token or not self.event_id:
                self.log_result(
                    "Validate Revoked Token - Prerequisites",
                    False,
                    "❌ Cannot test without kiosk token and event ID",
                    {"kiosk_token": bool(self.kiosk_token), "event_id": bool(self.event_id)}
                )
                return False
            
            payload = {
                "tokenId": self.kiosk_token,
                "eventId": self.event_id
            }
            
            response = self.session.post(f"{BACKEND_URL}/api/kiosk/validate", json=payload)
            
            if response.status_code == 403:
                try:
                    data = response.json()
                    
                    if 'error' in data:
                        self.log_result(
                            "Validate Revoked Token",
                            True,
                            f"✅ Successfully rejected revoked token: {data.get('error')}",
                            {
                                "status": response.status_code,
                                "error": data.get('error')
                            }
                        )
                        return True
                    else:
                        self.log_result(
                            "Validate Revoked Token - Missing Error",
                            False,
                            "❌ Expected error message in response",
                            data
                        )
                        return False
                except json.JSONDecodeError:
                    self.log_result(
                        "Validate Revoked Token - JSON Error",
                        False,
                        "❌ Invalid JSON response",
                        response.text
                    )
                    return False
            elif response.status_code == 200:
                self.log_result(
                    "Validate Revoked Token - Unexpected Success",
                    False,
                    "❌ Revoked token should not validate successfully",
                    response.json()
                )
                return False
            else:
                self.log_result(
                    "Validate Revoked Token",
                    False,
                    f"❌ Unexpected status code: {response.status_code}",
                    response.text
                )
                return False
                
        except Exception as e:
            self.log_result("Validate Revoked Token", False, f"Exception: {str(e)}")
            return False

    def test_backend_health_and_connectivity(self):
        """Test Case 10: Verify backend is healthy and kiosk endpoints exist"""
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
            
            # Test if the kiosk routes exist
            kiosk_routes = [
                "/api/kiosk/generate",
                "/api/kiosk/validate",
                "/api/kiosk/revoke",
                "/api/kiosk/scan",
                "/api/kiosk/guest-search"
            ]
            
            route_results = {}
            for route in kiosk_routes:
                try:
                    route_response = self.session.post(f"{BACKEND_URL}{route}", json={}, timeout=5)
                    # 400/401/403 = route exists but needs proper data/auth, 404 = route doesn't exist
                    if route_response.status_code == 404:
                        route_results[route] = {"exists": False, "status": 404}
                    else:
                        route_results[route] = {"exists": True, "status": route_response.status_code}
                except Exception as route_error:
                    route_results[route] = {"exists": False, "error": str(route_error)}
            
            missing_routes = [route for route, result in route_results.items() if not result.get("exists", False)]
            
            if not missing_routes:
                self.log_result(
                    "Backend Kiosk Routes Availability",
                    True,
                    f"✅ All required kiosk routes exist: {list(route_results.keys())}",
                    route_results
                )
            else:
                self.log_result(
                    "Backend Kiosk Routes Availability",
                    False,
                    f"❌ Missing routes: {missing_routes}",
                    route_results
                )
                
        except Exception as e:
            self.log_result("Backend Health and Connectivity", False, f"Exception: {str(e)}")

    def run_all_tests(self):
        """Run all kiosk mode tests as specified in review request"""
        print("🏪 Starting Kiosk Mode Backend API Testing")
        print("=" * 70)
        print("🎯 TESTING FOCUS: Complete Kiosk Mode Implementation")
        print("=" * 70)
        
        # Backend Infrastructure Tests
        print("\n🔧 BACKEND INFRASTRUCTURE TESTS")
        print("-" * 40)
        self.test_backend_health_and_connectivity()
        
        # Authentication & Event Setup Tests
        print("\n🔐 AUTHENTICATION & EVENT SETUP TESTS")
        print("-" * 40)
        login_success = self.test_user_login()
        
        if login_success:
            events_success = self.test_get_user_events()
            
            if events_success:
                print("\n🏪 KIOSK MODE FUNCTIONALITY TESTS")
                print("-" * 40)
                
                # Organizer Endpoints (Require Auth Token)
                print("📋 Testing Organizer Endpoints...")
                generate_success = self.test_generate_kiosk_token()
                status_success = self.test_get_kiosk_status()
                
                if generate_success:
                    # Kiosk Device Endpoints (No Auth, Token-Based)
                    print("\n📱 Testing Kiosk Device Endpoints...")
                    validate_success = self.test_validate_kiosk_token()
                    search_success = self.test_guest_search()
                    scan_success = self.test_invalid_ticket_scan()
                    
                    # Test revocation flow
                    print("\n🔒 Testing Token Revocation...")
                    revoke_success = self.test_revoke_kiosk_token()
                    if revoke_success:
                        self.test_validate_revoked_token()
                else:
                    print("⚠️ SKIPPING KIOSK DEVICE TESTS - Token generation failed")
            else:
                print("⚠️ SKIPPING KIOSK TESTS - No events available")
        else:
            print("\n⚠️ SKIPPING ALL KIOSK TESTS - Authentication Failed")
            print("Cannot test kiosk functionality without user authentication")
        
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
        user_login = next((r for r in self.results if 'User Login' in r['test'] and 'Exception' not in r['test']), None)
        get_events = next((r for r in self.results if 'Get User Events' in r['test']), None)
        generate_token = next((r for r in self.results if 'Generate Kiosk Token' in r['test']), None)
        kiosk_status = next((r for r in self.results if 'Get Kiosk Status' in r['test']), None)
        validate_token = next((r for r in self.results if 'Validate Kiosk Token' in r['test'] and 'Revoked' not in r['test']), None)
        guest_search = next((r for r in self.results if 'Guest Search' in r['test']), None)
        invalid_scan = next((r for r in self.results if 'Invalid Ticket Scan' in r['test']), None)
        revoke_token = next((r for r in self.results if 'Revoke Kiosk Token' in r['test']), None)
        validate_revoked = next((r for r in self.results if 'Validate Revoked Token' in r['test']), None)
        
        if backend_health and backend_health['success']:
            criteria_results.append("✅ Backend is healthy and kiosk routes exist")
        else:
            criteria_results.append("❌ Backend health check failed")
            
        if user_login and user_login['success']:
            criteria_results.append("✅ User authentication working")
        else:
            criteria_results.append("❌ User authentication failed")
            
        if get_events and get_events['success']:
            criteria_results.append("✅ Event retrieval working")
        else:
            criteria_results.append("❌ Event retrieval failed")
            
        if generate_token and generate_token['success']:
            criteria_results.append("✅ POST /api/kiosk/generate endpoint working")
        else:
            criteria_results.append("❌ Kiosk token generation failed")
            
        if kiosk_status and kiosk_status['success']:
            criteria_results.append("✅ GET /api/kiosk/status/:eventId endpoint working")
        else:
            criteria_results.append("❌ Kiosk status endpoint failed")
            
        if validate_token and validate_token['success']:
            criteria_results.append("✅ POST /api/kiosk/validate endpoint working")
        else:
            criteria_results.append("❌ Kiosk token validation failed")
            
        if guest_search and guest_search['success']:
            criteria_results.append("✅ GET /api/kiosk/guest-search endpoint working")
        else:
            criteria_results.append("❌ Guest search endpoint failed")
            
        if invalid_scan and invalid_scan['success']:
            criteria_results.append("✅ POST /api/kiosk/scan endpoint working (invalid ticket handling)")
        else:
            criteria_results.append("❌ Ticket scan endpoint failed")
            
        if revoke_token and revoke_token['success']:
            criteria_results.append("✅ POST /api/kiosk/revoke endpoint working")
        else:
            criteria_results.append("❌ Token revocation failed")
            
        if validate_revoked and validate_revoked['success']:
            criteria_results.append("✅ Revoked token validation properly rejected")
        else:
            criteria_results.append("❌ Revoked token validation failed")
        
        for criterion in criteria_results:
            print(f"  {criterion}")
        
        if total - passed > 0:
            print("\n❌ FAILED TESTS:")
            for result in self.results:
                if not result['success']:
                    print(f"  - {result['test']}: {result['details']}")
        
        print("\n📋 TESTING NOTES:")
        print("  - Test user: test+openticket@gmail.com")
        print("  - Organizer endpoints require authentication token")
        print("  - Kiosk device endpoints use token-based authentication")
        print("  - Invalid ticket scan should return success: false, status: 'invalid'")
        print("  - Revoked tokens should be rejected with HTTP 403")
        
        print("\n🔍 EXPECTED BEHAVIOR:")
        print("  - User login should succeed and return authentication token")
        print("  - Event list should contain at least one event for testing")
        print("  - Kiosk token generation should return token, expiresAt, and kioskUrl")
        print("  - Token validation should return token info and event data")
        print("  - Guest search should work with token authentication")
        print("  - Invalid ticket scan should be handled gracefully")
        print("  - Token revocation should succeed and invalidate the token")
        print("  - Revoked token validation should fail with appropriate error")
        
        return passed == total

if __name__ == "__main__":
    tester = KioskModeTester()
    success = tester.run_all_tests()
    
    # Save detailed results
    with open('/app/kiosk_mode_test_results.json', 'w') as f:
        json.dump(tester.results, f, indent=2)
    
    print(f"\n📄 Detailed results saved to: /app/kiosk_mode_test_results.json")
    
    if success:
        print("\n🎉 All Kiosk Mode tests PASSED!")
        exit(0)
    else:
        print("\n⚠️  Some tests FAILED - see details above")
        exit(1)