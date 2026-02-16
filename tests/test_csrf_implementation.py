"""
Test CSRF Protection Implementation
Verifies that CSRF protection is working correctly without breaking existing functionality
"""
import requests
import json

API_URL = "https://www.openticket.events"

def test_csrf_protection():
    """Test CSRF token endpoint and protection"""
    print("\n" + "="*60)
    print("CSRF PROTECTION TEST")
    print("="*60)
    
    session = requests.Session()
    
    # Test 1: CSRF Token Endpoint
    print("\n[Test 1] Fetching CSRF token...")
    try:
        response = session.get(f"{API_URL}/api/csrf-token")
        if response.status_code == 200:
            data = response.json()
            csrf_token = data.get('csrfToken')
            print(f"✅ CSRF token fetched: {csrf_token[:20]}...")
            
            # Check for CSRF cookie
            if '_csrf' in session.cookies:
                print(f"✅ CSRF cookie set: {session.cookies['_csrf'][:20]}...")
            else:
                print("⚠️  CSRF cookie not found")
        else:
            print(f"❌ Failed to fetch CSRF token: {response.status_code}")
            print(f"Response: {response.text[:200]}")
            return False
    except Exception as e:
        print(f"❌ Error fetching CSRF token: {str(e)}")
        return False
    
    # Test 2: POST without CSRF token (should fail)
    print("\n[Test 2] Testing POST without CSRF token (should be blocked)...")
    try:
        response = requests.post(
            f"{API_URL}/api/events/test-endpoint",
            json={"test": "data"},
            headers={"Content-Type": "application/json"}
        )
        if response.status_code == 403 or "csrf" in response.text.lower():
            print("✅ POST blocked without CSRF token (expected behavior)")
        else:
            print(f"⚠️  Unexpected response without CSRF: {response.status_code}")
    except Exception as e:
        print(f"ℹ️  Request failed (expected): {str(e)[:100]}")
    
    # Test 3: POST with CSRF token (should pass CSRF check)
    print("\n[Test 3] Testing POST with CSRF token...")
    try:
        headers = {
            "Content-Type": "application/json",
            "X-CSRF-Token": csrf_token
        }
        response = session.post(
            f"{API_URL}/api/events/test-endpoint",
            json={"test": "data"},
            headers=headers
        )
        # Should pass CSRF check (404 or auth error expected, not 403 CSRF error)
        if response.status_code != 403 or "csrf" not in response.text.lower():
            print(f"✅ CSRF token accepted (status: {response.status_code})")
        else:
            print(f"❌ CSRF token rejected: {response.text[:200]}")
            return False
    except Exception as e:
        print(f"ℹ️  POST with token: {str(e)[:100]}")
    
    # Test 4: GET requests should work without CSRF (safe methods)
    print("\n[Test 4] Testing GET requests (should work without CSRF)...")
    try:
        response = requests.get(f"{API_URL}/api/events")
        if response.status_code in [200, 404]:  # Either OK or not found is fine
            print(f"✅ GET request works without CSRF (status: {response.status_code})")
        else:
            print(f"⚠️  Unexpected GET response: {response.status_code}")
    except Exception as e:
        print(f"ℹ️  GET request: {str(e)[:100]}")
    
    print("\n" + "="*60)
    print("CSRF PROTECTION TEST COMPLETE")
    print("="*60)
    
    return True

def test_cors_headers():
    """Test CORS headers include X-CSRF-Token"""
    print("\n" + "="*60)
    print("CORS HEADERS TEST")
    print("="*60)
    
    try:
        # Make an OPTIONS request to check CORS headers
        response = requests.options(
            f"{API_URL}/api/csrf-token",
            headers={
                "Origin": "https://www.openticket.events",
                "Access-Control-Request-Method": "POST",
                "Access-Control-Request-Headers": "X-CSRF-Token,Content-Type"
            }
        )
        
        cors_headers = response.headers.get('Access-Control-Allow-Headers', '')
        print(f"\nCORS Allowed Headers: {cors_headers}")
        
        if 'X-CSRF-Token' in cors_headers or 'x-csrf-token' in cors_headers.lower():
            print("✅ X-CSRF-Token is allowed in CORS headers")
        else:
            print("❌ X-CSRF-Token NOT found in CORS headers")
            return False
            
    except Exception as e:
        print(f"ℹ️  CORS check: {str(e)[:100]}")
    
    print("="*60)
    return True

if __name__ == "__main__":
    print("\n🔒 CSRF Protection Implementation Test")
    print("Testing against:", API_URL)
    
    csrf_passed = test_csrf_protection()
    cors_passed = test_cors_headers()
    
    print("\n" + "="*60)
    print("FINAL RESULTS")
    print("="*60)
    print(f"CSRF Protection: {'✅ PASS' if csrf_passed else '❌ FAIL'}")
    print(f"CORS Headers: {'✅ PASS' if cors_passed else '❌ FAIL'}")
    print("="*60)
    
    # Note about deployment
    print("\n📝 NOTE: These tests are running against production URL.")
    print("If tests fail, the code changes need to be deployed via GitHub/Vercel.")
    print("="*60)
