#!/usr/bin/env python3
"""
Backend API Testing for OpenTicket Platform - Audit Fixes
Tests CORS security, analytics tracking, health endpoint, and analytics retrieval
"""

import requests
import json
import time
import uuid
from typing import Dict, Any

# Configuration
BACKEND_URL = "http://localhost:8001"
VALID_ORIGIN = "https://openticket.events"
INVALID_ORIGIN = "https://malicious-site.com"

class OpenTicketAPITester:
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
    
    def test_health_endpoint(self):
        """Test 1: Health endpoint should return status and uptime"""
        try:
            response = self.session.get(f"{BACKEND_URL}/api/health")
            
            if response.status_code == 200:
                data = response.json()
                if 'status' in data and 'uptime' in data:
                    self.log_result(
                        "Health Endpoint", 
                        True, 
                        f"Status: {data.get('status')}, Uptime: {data.get('uptime'):.2f}s",
                        data
                    )
                else:
                    self.log_result(
                        "Health Endpoint", 
                        False, 
                        "Missing required fields (status, uptime)",
                        data
                    )
            else:
                self.log_result(
                    "Health Endpoint", 
                    False, 
                    f"HTTP {response.status_code}",
                    response.text
                )
        except Exception as e:
            self.log_result("Health Endpoint", False, f"Exception: {str(e)}")
    
    def test_debug_endpoint_removed(self):
        """Test 2: Old /api/debug endpoint should NOT exist (404)"""
        try:
            response = self.session.get(f"{BACKEND_URL}/api/debug")
            
            if response.status_code == 404:
                self.log_result(
                    "Debug Endpoint Removed", 
                    True, 
                    "Correctly returns 404 - endpoint removed"
                )
            else:
                self.log_result(
                    "Debug Endpoint Removed", 
                    False, 
                    f"Expected 404, got HTTP {response.status_code}",
                    response.text[:200]
                )
        except Exception as e:
            self.log_result("Debug Endpoint Removed", False, f"Exception: {str(e)}")
    
    def test_cors_valid_origin(self):
        """Test 3: CORS should allow valid origins"""
        try:
            headers = {
                'Origin': VALID_ORIGIN,
                'Content-Type': 'application/json'
            }
            response = self.session.get(f"{BACKEND_URL}/api/health", headers=headers)
            
            if response.status_code == 200:
                cors_header = response.headers.get('Access-Control-Allow-Origin')
                if cors_header:
                    self.log_result(
                        "CORS Valid Origin", 
                        True, 
                        f"Valid origin accepted, CORS header: {cors_header}"
                    )
                else:
                    self.log_result(
                        "CORS Valid Origin", 
                        False, 
                        "No CORS header returned for valid origin"
                    )
            else:
                self.log_result(
                    "CORS Valid Origin", 
                    False, 
                    f"HTTP {response.status_code}",
                    response.text
                )
        except Exception as e:
            self.log_result("CORS Valid Origin", False, f"Exception: {str(e)}")
    
    def test_cors_invalid_origin(self):
        """Test 4: CORS should block unauthorized origins"""
        try:
            headers = {
                'Origin': INVALID_ORIGIN,
                'Content-Type': 'application/json'
            }
            response = self.session.get(f"{BACKEND_URL}/api/health", headers=headers)
            
            # CORS blocking can manifest in different ways:
            # 1. Server returns error (preferred)
            # 2. Server returns success but browser would block (less secure)
            
            if response.status_code >= 400:
                self.log_result(
                    "CORS Invalid Origin", 
                    True, 
                    f"Unauthorized origin blocked with HTTP {response.status_code}"
                )
            else:
                # Check if CORS header is missing or restrictive
                cors_header = response.headers.get('Access-Control-Allow-Origin')
                if not cors_header or cors_header != INVALID_ORIGIN:
                    self.log_result(
                        "CORS Invalid Origin", 
                        True, 
                        f"Origin not explicitly allowed in CORS header: {cors_header}"
                    )
                else:
                    self.log_result(
                        "CORS Invalid Origin", 
                        False, 
                        f"Unauthorized origin allowed, CORS header: {cors_header}"
                    )
        except Exception as e:
            # Network errors could indicate CORS blocking
            if "CORS" in str(e) or "Origin" in str(e):
                self.log_result("CORS Invalid Origin", True, f"CORS blocked: {str(e)}")
            else:
                self.log_result("CORS Invalid Origin", False, f"Exception: {str(e)}")
    
    def test_analytics_tracking(self):
        """Test 5: Analytics tracking endpoint"""
        try:
            # Generate a test event ID
            test_event_id = str(uuid.uuid4())
            
            payload = {
                "eventId": test_event_id,
                "referrer": "https://google.com"
            }
            
            headers = {
                'Content-Type': 'application/json',
                'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36'
            }
            
            response = self.session.post(
                f"{BACKEND_URL}/api/analytics/track", 
                json=payload,
                headers=headers
            )
            
            if response.status_code == 200:
                data = response.json()
                if data.get('success') == True:
                    self.log_result(
                        "Analytics Tracking", 
                        True, 
                        f"Successfully tracked page view for event {test_event_id}",
                        data
                    )
                else:
                    self.log_result(
                        "Analytics Tracking", 
                        False, 
                        "Response doesn't indicate success",
                        data
                    )
            else:
                self.log_result(
                    "Analytics Tracking", 
                    False, 
                    f"HTTP {response.status_code}",
                    response.text
                )
        except Exception as e:
            self.log_result("Analytics Tracking", False, f"Exception: {str(e)}")
    
    def test_analytics_tracking_device_parsing(self):
        """Test 6: Analytics should parse device type from user-agent"""
        try:
            test_event_id = str(uuid.uuid4())
            
            # Test different user agents
            test_cases = [
                {
                    "name": "Desktop Chrome",
                    "user_agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36",
                    "expected_device": "Desktop"
                },
                {
                    "name": "Mobile iPhone",
                    "user_agent": "Mozilla/5.0 (iPhone; CPU iPhone OS 14_6 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/14.0 Mobile/15E148 Safari/604.1",
                    "expected_device": "Mobile"
                },
                {
                    "name": "Tablet iPad",
                    "user_agent": "Mozilla/5.0 (iPad; CPU OS 14_6 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/14.0 Mobile/15E148 Safari/604.1",
                    "expected_device": "Tablet"
                }
            ]
            
            success_count = 0
            for test_case in test_cases:
                payload = {
                    "eventId": f"{test_event_id}-{test_case['name'].replace(' ', '-').lower()}",
                    "referrer": "https://google.com"
                }
                
                headers = {
                    'Content-Type': 'application/json',
                    'User-Agent': test_case['user_agent']
                }
                
                response = self.session.post(
                    f"{BACKEND_URL}/api/analytics/track", 
                    json=payload,
                    headers=headers
                )
                
                if response.status_code == 200 and response.json().get('success'):
                    success_count += 1
            
            if success_count == len(test_cases):
                self.log_result(
                    "Analytics Device Parsing", 
                    True, 
                    f"Successfully processed {success_count}/{len(test_cases)} different user agents"
                )
            else:
                self.log_result(
                    "Analytics Device Parsing", 
                    False, 
                    f"Only {success_count}/{len(test_cases)} user agents processed successfully"
                )
                
        except Exception as e:
            self.log_result("Analytics Device Parsing", False, f"Exception: {str(e)}")
    
    def test_analytics_retrieval_no_auth(self):
        """Test 7: Analytics retrieval should require authentication"""
        try:
            test_event_id = str(uuid.uuid4())
            
            # Test event analytics endpoint without auth
            response = self.session.get(f"{BACKEND_URL}/api/analytics/event/{test_event_id}")
            
            if response.status_code == 401:
                self.log_result(
                    "Analytics Auth Required", 
                    True, 
                    "Event analytics correctly requires authentication (401)"
                )
            else:
                self.log_result(
                    "Analytics Auth Required", 
                    False, 
                    f"Expected 401, got HTTP {response.status_code}",
                    response.text[:200]
                )
            
            # Test organizer analytics endpoint without auth
            response2 = self.session.get(f"{BACKEND_URL}/api/analytics/organizer")
            
            if response2.status_code == 401:
                self.log_result(
                    "Organizer Analytics Auth Required", 
                    True, 
                    "Organizer analytics correctly requires authentication (401)"
                )
            else:
                self.log_result(
                    "Organizer Analytics Auth Required", 
                    False, 
                    f"Expected 401, got HTTP {response2.status_code}",
                    response2.text[:200]
                )
                
        except Exception as e:
            self.log_result("Analytics Auth Required", False, f"Exception: {str(e)}")
    
    def test_analytics_missing_event_id(self):
        """Test 8: Analytics tracking should validate required fields"""
        try:
            # Test without eventId
            payload = {
                "referrer": "https://google.com"
            }
            
            response = self.session.post(
                f"{BACKEND_URL}/api/analytics/track", 
                json=payload,
                headers={'Content-Type': 'application/json'}
            )
            
            if response.status_code == 400:
                data = response.json()
                if 'error' in data and 'eventId' in data['error']:
                    self.log_result(
                        "Analytics Validation", 
                        True, 
                        "Correctly validates missing eventId (400)",
                        data
                    )
                else:
                    self.log_result(
                        "Analytics Validation", 
                        False, 
                        "Returns 400 but error message unclear",
                        data
                    )
            else:
                self.log_result(
                    "Analytics Validation", 
                    False, 
                    f"Expected 400, got HTTP {response.status_code}",
                    response.text
                )
                
        except Exception as e:
            self.log_result("Analytics Validation", False, f"Exception: {str(e)}")
    
    def run_all_tests(self):
        """Run all audit fix tests"""
        print("🔍 Starting OpenTicket Audit Fix Tests")
        print("=" * 50)
        
        # Test basic endpoints
        self.test_health_endpoint()
        self.test_debug_endpoint_removed()
        
        # Test CORS security
        self.test_cors_valid_origin()
        self.test_cors_invalid_origin()
        
        # Test analytics functionality
        self.test_analytics_tracking()
        self.test_analytics_tracking_device_parsing()
        self.test_analytics_retrieval_no_auth()
        self.test_analytics_missing_event_id()
        
        print("\n" + "=" * 50)
        print("📊 TEST SUMMARY")
        print("=" * 50)
        
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
        
        return passed == total

if __name__ == "__main__":
    tester = OpenTicketAPITester()
    success = tester.run_all_tests()
    
    # Save detailed results
    with open('/app/audit_test_results.json', 'w') as f:
        json.dump(tester.results, f, indent=2)
    
    print(f"\n📄 Detailed results saved to: /app/audit_test_results.json")
    
    if success:
        print("\n🎉 All audit fix tests PASSED!")
        exit(0)
    else:
        print("\n⚠️  Some tests FAILED - see details above")
        exit(1)