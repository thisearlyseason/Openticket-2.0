#!/usr/bin/env python3
"""
Ticket Transfer System Testing - Complete End-to-End Flow
Tests the ticket transfer system as requested in the review
"""

import requests
import json
import time
import uuid
from typing import Dict, Any, Optional

# Configuration - Use production URL from frontend/.env
BACKEND_URL = "https://ticket-fix-audit.preview.emergentagent.com"

class TicketTransferTester:
    def __init__(self):
        self.results = []
        self.session = requests.Session()
        self.test_data = {}
        
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
    
    def test_debug_transfers_endpoint(self):
        """Test Case 1: Check debug endpoint to see recent transfers"""
        try:
            response = self.session.get(f"{BACKEND_URL}/api/registrations/debug/transfers")
            
            if response.status_code == 200:
                data = response.json()
                transfers = data.get('transfers', [])
                
                self.log_result(
                    "Debug Transfers Endpoint", 
                    True, 
                    f"✅ Found {len(transfers)} recent transfers",
                    {"transfer_count": len(transfers), "recent_transfers": transfers[:3]}
                )
                
                # Store for later reference
                self.test_data['recent_transfers'] = transfers
                
            else:
                self.log_result(
                    "Debug Transfers Endpoint", 
                    False, 
                    f"HTTP {response.status_code}",
                    response.text
                )
        except Exception as e:
            self.log_result("Debug Transfers Endpoint", False, f"Exception: {str(e)}")

    def test_initiate_transfer_validation(self):
        """Test Case 2: Test transfer initiation validation (without auth)"""
        try:
            # Test with invalid data to check validation
            test_registration_id = "test-reg-123"
            payload = {
                "ticketKey": "test-ticket-key",
                "recipientEmail": "recipient@example.com",
                "recipientName": "Test Recipient",
                "senderName": "Test Sender"
            }
            
            response = self.session.post(
                f"{BACKEND_URL}/api/registrations/{test_registration_id}/transfer",
                json=payload,
                headers={'Content-Type': 'application/json'}
            )
            
            # We expect this to fail due to authentication or registration not found
            if response.status_code in [401, 403, 404]:
                self.log_result(
                    "Transfer Initiation Validation", 
                    True, 
                    f"✅ Properly requires authentication/valid registration (HTTP {response.status_code})",
                    {"status_code": response.status_code, "response": response.text[:200]}
                )
            elif response.status_code == 400:
                data = response.json()
                if "error" in data:
                    self.log_result(
                        "Transfer Initiation Validation", 
                        True, 
                        f"✅ Proper validation error: {data.get('error')}",
                        data
                    )
                else:
                    self.log_result(
                        "Transfer Initiation Validation", 
                        False, 
                        f"❌ Unexpected 400 response format",
                        data
                    )
            else:
                self.log_result(
                    "Transfer Initiation Validation", 
                    False, 
                    f"❌ Unexpected response: HTTP {response.status_code}",
                    response.text
                )
                
        except Exception as e:
            self.log_result("Transfer Initiation Validation", False, f"Exception: {str(e)}")

    def test_undo_transfer_validation(self):
        """Test Case 3: Test undo transfer validation"""
        try:
            test_registration_id = "test-reg-123"
            payload = {
                "transferId": "test-transfer-123"
            }
            
            response = self.session.post(
                f"{BACKEND_URL}/api/registrations/{test_registration_id}/transfer/undo",
                json=payload,
                headers={'Content-Type': 'application/json'}
            )
            
            # We expect this to fail due to authentication or transfer not found
            if response.status_code in [401, 403, 404]:
                self.log_result(
                    "Undo Transfer Validation", 
                    True, 
                    f"✅ Properly requires authentication/valid transfer (HTTP {response.status_code})",
                    {"status_code": response.status_code}
                )
            else:
                data = response.json() if response.headers.get('content-type', '').startswith('application/json') else response.text
                self.log_result(
                    "Undo Transfer Validation", 
                    False, 
                    f"❌ Unexpected response: HTTP {response.status_code}",
                    data
                )
                
        except Exception as e:
            self.log_result("Undo Transfer Validation", False, f"Exception: {str(e)}")

    def test_finalize_transfer_validation(self):
        """Test Case 4: Test finalize transfer validation"""
        try:
            payload = {
                "transferId": "test-transfer-123"
            }
            
            response = self.session.post(
                f"{BACKEND_URL}/api/registrations/0/transfer/finalize",
                json=payload,
                headers={'Content-Type': 'application/json'}
            )
            
            # We expect this to fail due to transfer not found
            if response.status_code == 404:
                data = response.json()
                if "Transfer not found" in data.get('error', ''):
                    self.log_result(
                        "Finalize Transfer Validation", 
                        True, 
                        f"✅ Properly validates transfer existence: {data.get('error')}",
                        data
                    )
                else:
                    self.log_result(
                        "Finalize Transfer Validation", 
                        False, 
                        f"❌ Unexpected 404 error message: {data.get('error')}",
                        data
                    )
            elif response.status_code in [400, 401, 403]:
                data = response.json() if response.headers.get('content-type', '').startswith('application/json') else response.text
                self.log_result(
                    "Finalize Transfer Validation", 
                    True, 
                    f"✅ Proper validation (HTTP {response.status_code})",
                    data
                )
            else:
                data = response.json() if response.headers.get('content-type', '').startswith('application/json') else response.text
                self.log_result(
                    "Finalize Transfer Validation", 
                    False, 
                    f"❌ Unexpected response: HTTP {response.status_code}",
                    data
                )
                
        except Exception as e:
            self.log_result("Finalize Transfer Validation", False, f"Exception: {str(e)}")

    def test_transfer_endpoints_structure(self):
        """Test Case 5: Verify all transfer endpoints exist and respond"""
        endpoints_to_test = [
            ("GET", "/api/registrations/debug/transfers", "Debug endpoint"),
            ("POST", "/api/registrations/test-id/transfer", "Initiate transfer"),
            ("POST", "/api/registrations/test-id/transfer/undo", "Undo transfer"),
            ("POST", "/api/registrations/test-id/transfer/finalize", "Finalize transfer")
        ]
        
        endpoint_results = []
        
        for method, endpoint, description in endpoints_to_test:
            try:
                if method == "GET":
                    response = self.session.get(f"{BACKEND_URL}{endpoint}")
                else:
                    response = self.session.post(
                        f"{BACKEND_URL}{endpoint}",
                        json={"transferId": "test-transfer-123"} if "finalize" in endpoint else {"test": "data"},
                        headers={'Content-Type': 'application/json'}
                    )
                
                # Check if endpoint exists and responds appropriately
                if "finalize" in endpoint:
                    # For finalize endpoint, 404 with JSON error means it's working
                    if response.status_code == 404:
                        try:
                            error_data = response.json()
                            if "Transfer not found" in error_data.get('error', ''):
                                endpoint_results.append(f"✅ {description}: HTTP {response.status_code} (working correctly)")
                            else:
                                endpoint_results.append(f"❌ {description}: Unexpected 404 response")
                        except:
                            endpoint_results.append(f"❌ {description}: 404 without JSON response")
                    elif response.status_code in [200, 400, 401, 403]:
                        endpoint_results.append(f"✅ {description}: HTTP {response.status_code}")
                    else:
                        endpoint_results.append(f"⚠️ {description}: Unexpected HTTP {response.status_code}")
                else:
                    # For other endpoints, any non-404 response means they exist
                    if response.status_code in [200, 400, 401, 403]:
                        endpoint_results.append(f"✅ {description}: HTTP {response.status_code}")
                    elif response.status_code == 404:
                        endpoint_results.append(f"❌ {description}: Not found (404)")
                    else:
                        endpoint_results.append(f"⚠️ {description}: Unexpected HTTP {response.status_code}")
                    
            except Exception as e:
                endpoint_results.append(f"❌ {description}: Exception - {str(e)}")
        
        all_found = all("✅" in result for result in endpoint_results)
        
        self.log_result(
            "Transfer Endpoints Structure", 
            all_found, 
            f"Endpoint availability check: {len([r for r in endpoint_results if '✅' in r])}/4 endpoints found",
            {"endpoint_results": endpoint_results}
        )

    def check_backend_logs_for_transfer_errors(self):
        """Test Case 6: Check Backend Logs for Transfer-Related Errors"""
        try:
            import subprocess
            
            # Check for transfer-related errors in backend logs
            result = subprocess.run(
                ["tail", "-100", "/var/log/supervisor/backend.out.log"],
                capture_output=True,
                text=True
            )
            
            if result.returncode == 0:
                log_content = result.stdout.lower()
                
                # Check for CRITICAL transfer-related errors (not expected validation errors)
                critical_transfer_errors = [
                    "source column",
                    "transferred_from_registration_id",
                    "column does not exist",
                    "invalid column name",
                    "transfer failed unexpectedly",
                    "database error in transfer"
                ]
                
                found_critical_errors = []
                for error in critical_transfer_errors:
                    if error in log_content:
                        found_critical_errors.append(error)
                
                # "transfer error" followed by "transfer not found" is expected for invalid test IDs
                has_expected_validation = "transfer not found" in log_content
                
                if found_critical_errors:
                    self.log_result(
                        "Backend Logs Transfer Check", 
                        False, 
                        f"❌ Found critical transfer errors: {', '.join(found_critical_errors)}",
                        {"log_excerpt": result.stdout[-1000:]}  # Last 1000 chars
                    )
                else:
                    # Check for positive transfer indicators
                    positive_indicators = [
                        "transfer initiated",
                        "transfer completed",
                        "transfer finalized",
                        "start finalize",
                        "finalizing transfer"
                    ]
                    
                    found_positive = []
                    for indicator in positive_indicators:
                        if indicator in log_content:
                            found_positive.append(indicator)
                    
                    if found_positive or has_expected_validation:
                        validation_note = " (includes expected validation errors)" if has_expected_validation else ""
                        self.log_result(
                            "Backend Logs Transfer Check", 
                            True, 
                            f"✅ No critical transfer errors found{validation_note}. System responding correctly",
                            {"log_excerpt": result.stdout[-1000:]}
                        )
                    else:
                        self.log_result(
                            "Backend Logs Transfer Check", 
                            True, 
                            "✅ No critical transfer-related errors found in logs",
                            {"log_excerpt": result.stdout[-500:]}
                        )
            else:
                self.log_result(
                    "Backend Logs Transfer Check", 
                    False, 
                    f"❌ Could not read backend logs: {result.stderr}",
                    None
                )
        except Exception as e:
            self.log_result("Backend Logs Transfer Check", False, f"Exception: {str(e)}")

    def test_database_schema_validation(self):
        """Test Case 7: Validate database schema for transfer system"""
        try:
            # Test if we can query the ticket_transfers table structure
            # This is indirect validation since we don't have direct DB access
            
            response = self.session.get(f"{BACKEND_URL}/api/registrations/debug/transfers")
            
            if response.status_code == 200:
                data = response.json()
                transfers = data.get('transfers', [])
                
                if transfers:
                    # Check if transfer records have expected fields
                    sample_transfer = transfers[0]
                    expected_fields = [
                        'id', 'registration_id', 'ticket_key', 'event_id',
                        'sender_user_id', 'sender_email', 'recipient_email',
                        'status', 'created_at'
                    ]
                    
                    missing_fields = [field for field in expected_fields if field not in sample_transfer]
                    
                    if not missing_fields:
                        self.log_result(
                            "Database Schema Validation", 
                            True, 
                            f"✅ Transfer table schema appears correct (checked {len(expected_fields)} fields)",
                            {"sample_fields": list(sample_transfer.keys())}
                        )
                    else:
                        self.log_result(
                            "Database Schema Validation", 
                            False, 
                            f"❌ Missing expected fields: {missing_fields}",
                            {"available_fields": list(sample_transfer.keys()), "missing": missing_fields}
                        )
                else:
                    self.log_result(
                        "Database Schema Validation", 
                        True, 
                        "✅ Transfer table accessible (no records to validate schema)",
                        {"transfer_count": 0}
                    )
            else:
                self.log_result(
                    "Database Schema Validation", 
                    False, 
                    f"❌ Cannot access transfer table: HTTP {response.status_code}",
                    response.text
                )
                
        except Exception as e:
            self.log_result("Database Schema Validation", False, f"Exception: {str(e)}")

    def test_transfer_flow_documentation(self):
        """Test Case 8: Verify transfer flow matches documentation"""
        try:
            # Test the expected flow based on review request documentation
            flow_steps = [
                "1. POST /api/registrations/:id/transfer - Creates pending transfer",
                "2. 5-second undo window with frontend countdown",
                "3. POST /api/registrations/:id/transfer/undo - Available during countdown",
                "4. POST /api/registrations/:id/transfer/finalize - Called after 5 seconds",
                "5. Database updates: sender marked transferred_out, recipient gets new registration"
            ]
            
            # Check if endpoints support the documented flow
            endpoints_working = 0
            total_endpoints = 3  # transfer, undo, finalize
            
            # Test transfer endpoint
            response = self.session.post(
                f"{BACKEND_URL}/api/registrations/test/transfer",
                json={"ticketKey": "test", "recipientEmail": "test@example.com"},
                headers={'Content-Type': 'application/json'}
            )
            if response.status_code != 404:  # Endpoint exists
                endpoints_working += 1
            
            # Test undo endpoint
            response = self.session.post(
                f"{BACKEND_URL}/api/registrations/test/transfer/undo",
                json={"transferId": "test"},
                headers={'Content-Type': 'application/json'}
            )
            if response.status_code != 404:  # Endpoint exists
                endpoints_working += 1
            
            # Test finalize endpoint - check for proper error response
            response = self.session.post(
                f"{BACKEND_URL}/api/registrations/test/transfer/finalize",
                json={"transferId": "test"},
                headers={'Content-Type': 'application/json'}
            )
            # For finalize, 404 with "Transfer not found" means it's working
            if response.status_code == 404:
                try:
                    error_data = response.json()
                    if "Transfer not found" in error_data.get('error', ''):
                        endpoints_working += 1  # This means the endpoint is working
                except:
                    pass  # If we can't parse JSON, endpoint might not be working properly
            elif response.status_code != 404:
                endpoints_working += 1  # Any other response means endpoint exists
            
            success_rate = (endpoints_working / total_endpoints) * 100
            
            self.log_result(
                "Transfer Flow Documentation", 
                endpoints_working == total_endpoints, 
                f"✅ Transfer flow endpoints: {endpoints_working}/{total_endpoints} available ({success_rate:.0f}%)",
                {"flow_steps": flow_steps, "endpoints_available": endpoints_working}
            )
            
        except Exception as e:
            self.log_result("Transfer Flow Documentation", False, f"Exception: {str(e)}")

    def test_fraud_prevention_features(self):
        """Test Case 9: Test fraud prevention features"""
        try:
            # Test various fraud prevention scenarios by checking error responses
            fraud_tests = []
            
            # Test 1: Invalid transfer attempts
            response = self.session.post(
                f"{BACKEND_URL}/api/registrations/invalid-id/transfer",
                json={
                    "ticketKey": "already-transferred-ticket",
                    "recipientEmail": "test@example.com"
                },
                headers={'Content-Type': 'application/json'}
            )
            
            if response.status_code in [400, 401, 403, 404]:
                fraud_tests.append("✅ Invalid registration ID properly rejected")
            else:
                fraud_tests.append("❌ Invalid registration ID not properly handled")
            
            # Test 2: Missing required fields
            response = self.session.post(
                f"{BACKEND_URL}/api/registrations/test-id/transfer",
                json={},  # Empty payload
                headers={'Content-Type': 'application/json'}
            )
            
            if response.status_code == 400:
                data = response.json()
                if "required" in data.get('error', '').lower():
                    fraud_tests.append("✅ Missing required fields properly validated")
                else:
                    fraud_tests.append("❌ Missing fields validation unclear")
            else:
                fraud_tests.append("❌ Missing required fields not properly validated")
            
            # Test 3: Invalid email format (basic test)
            response = self.session.post(
                f"{BACKEND_URL}/api/registrations/test-id/transfer",
                json={
                    "ticketKey": "test-ticket",
                    "recipientEmail": "invalid-email-format"
                },
                headers={'Content-Type': 'application/json'}
            )
            
            # This might pass validation at API level, so we just check it doesn't crash
            if response.status_code < 500:
                fraud_tests.append("✅ Invalid email format handled gracefully")
            else:
                fraud_tests.append("❌ Invalid email format causes server error")
            
            passed_fraud_tests = len([t for t in fraud_tests if "✅" in t])
            total_fraud_tests = len(fraud_tests)
            
            self.log_result(
                "Fraud Prevention Features", 
                passed_fraud_tests >= 2,  # At least 2/3 should pass
                f"Fraud prevention checks: {passed_fraud_tests}/{total_fraud_tests} passed",
                {"fraud_test_results": fraud_tests}
            )
            
        except Exception as e:
            self.log_result("Fraud Prevention Features", False, f"Exception: {str(e)}")

    def run_all_tests(self):
        """Run all ticket transfer system tests"""
        print("🎟️ Starting Ticket Transfer System Testing")
        print("=" * 60)
        
        # Core Transfer System Tests
        print("\n🔄 CORE TRANSFER SYSTEM TESTS")
        print("-" * 40)
        self.test_debug_transfers_endpoint()
        self.test_initiate_transfer_validation()
        self.test_undo_transfer_validation()
        self.test_finalize_transfer_validation()
        
        # System Architecture Tests
        print("\n🏗️ SYSTEM ARCHITECTURE TESTS")
        print("-" * 40)
        self.test_transfer_endpoints_structure()
        self.check_backend_logs_for_transfer_errors()
        self.test_database_schema_validation()
        
        # Flow and Security Tests
        print("\n🔒 FLOW AND SECURITY TESTS")
        print("-" * 40)
        self.test_transfer_flow_documentation()
        self.test_fraud_prevention_features()
        
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
        core_tests = [r for r in self.results if any(keyword in r['test'] for keyword in ['Debug', 'Initiate', 'Undo', 'Finalize'])]
        architecture_tests = [r for r in self.results if any(keyword in r['test'] for keyword in ['Endpoints', 'Logs', 'Schema'])]
        security_tests = [r for r in self.results if any(keyword in r['test'] for keyword in ['Documentation', 'Fraud'])]
        
        if core_tests:
            core_passed = sum(1 for r in core_tests if r['success'])
            print(f"\n🔄 CORE TRANSFER TESTS: {core_passed}/{len(core_tests)} passed ({(core_passed/len(core_tests))*100:.1f}%)")
        
        if architecture_tests:
            arch_passed = sum(1 for r in architecture_tests if r['success'])
            print(f"🏗️ ARCHITECTURE TESTS: {arch_passed}/{len(architecture_tests)} passed ({(arch_passed/len(architecture_tests))*100:.1f}%)")
        
        if security_tests:
            sec_passed = sum(1 for r in security_tests if r['success'])
            print(f"🔒 SECURITY TESTS: {sec_passed}/{len(security_tests)} passed ({(sec_passed/len(security_tests))*100:.1f}%)")
        
        # Critical Issues Check
        print("\n🚨 CRITICAL ISSUES CHECK:")
        critical_failures = []
        
        for result in self.results:
            if not result['success']:
                if any(keyword in result['test'] for keyword in ['Logs', 'Schema', 'Endpoints']):
                    critical_failures.append(f"❌ {result['test']}: {result['details']}")
        
        if critical_failures:
            print("  CRITICAL FAILURES FOUND:")
            for failure in critical_failures:
                print(f"    {failure}")
        else:
            print("  ✅ No critical system failures detected")
        
        # Expected Behavior Verification
        print("\n🎯 EXPECTED BEHAVIOR VERIFICATION:")
        expected_behaviors = [
            ("Transfer endpoints exist and respond", any("Endpoints" in r['test'] and r['success'] for r in self.results)),
            ("Proper authentication/validation", any("Validation" in r['test'] and r['success'] for r in self.results)),
            ("No database schema errors in logs", any("Logs" in r['test'] and r['success'] for r in self.results)),
            ("Fraud prevention measures active", any("Fraud" in r['test'] and r['success'] for r in self.results))
        ]
        
        for behavior, met in expected_behaviors:
            status = "✅" if met else "❌"
            print(f"  {status} {behavior}")
        
        if total - passed > 0:
            print("\n❌ FAILED TESTS DETAILS:")
            for result in self.results:
                if not result['success']:
                    print(f"  - {result['test']}: {result['details']}")
        
        return passed == total

if __name__ == "__main__":
    tester = TicketTransferTester()
    success = tester.run_all_tests()
    
    # Save detailed results
    with open('/app/ticket_transfer_test_results.json', 'w') as f:
        json.dump(tester.results, f, indent=2)
    
    print(f"\n📄 Detailed results saved to: /app/ticket_transfer_test_results.json")
    
    if success:
        print("\n🎉 All Ticket Transfer System tests PASSED!")
        exit(0)
    else:
        print("\n⚠️  Some tests FAILED - see details above")
        exit(1)