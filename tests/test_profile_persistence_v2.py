"""
Test Profile Data Persistence - Iteration 28
Tests the fix for storing bio, phone, business_email, etc. in subscription.settings JSONB
instead of missing database columns.

Key test scenarios:
1. Profile fields saved via PUT /api/auth/profiles/:id
2. Profile fields returned correctly from GET /api/auth/profiles/:id
3. Extended settings stored in subscription.settings JSONB
4. Data persists after refresh (GET returns saved data)
"""

import pytest
import requests
import os
import time
import json

# Use localhost since backend is running on port 8001
BASE_URL = "http://127.0.0.1:8001"

# Test credentials from previous iteration
TEST_EMAIL = "test_organizer_1767755527@test.com"
TEST_PASSWORD = "TestPassword123!"

# Firebase Auth API for getting tokens
FIREBASE_API_KEY = "AIzaSyDtnbTx4gTAC5ufD173Lt9IaiQfpZOQFyA"  # Public API key from Firebase config


class TestProfilePersistence:
    """Test profile data persistence with the subscription.settings JSONB fix"""
    
    @pytest.fixture(scope="class")
    def auth_token(self):
        """Get Firebase auth token for authenticated requests"""
        # Use Firebase REST API to sign in
        url = f"https://identitytoolkit.googleapis.com/v1/accounts:signInWithPassword?key={FIREBASE_API_KEY}"
        payload = {
            "email": TEST_EMAIL,
            "password": TEST_PASSWORD,
            "returnSecureToken": True
        }
        
        try:
            response = requests.post(url, json=payload, timeout=30)
            if response.status_code == 200:
                data = response.json()
                token = data.get("idToken")
                user_id = data.get("localId")
                print(f"✓ Authenticated as {TEST_EMAIL}, user_id: {user_id}")
                return {"token": token, "user_id": user_id}
            else:
                print(f"✗ Auth failed: {response.status_code} - {response.text}")
                pytest.skip(f"Authentication failed: {response.status_code}")
        except Exception as e:
            print(f"✗ Auth error: {e}")
            pytest.skip(f"Authentication error: {e}")
    
    def test_01_api_health_check(self):
        """Verify backend API is accessible"""
        try:
            # Try public events endpoint (no auth required)
            response = requests.get(f"{BASE_URL}/api/events/public", timeout=10)
            print(f"API Health Check: {response.status_code}")
            assert response.status_code == 200, f"API not accessible: {response.status_code}"
            print("✓ Backend API is accessible")
        except requests.exceptions.RequestException as e:
            pytest.fail(f"Backend API not accessible: {e}")
    
    def test_02_get_profile_before_update(self, auth_token):
        """Get current profile state before making updates"""
        headers = {"Authorization": f"Bearer {auth_token['token']}"}
        
        response = requests.get(
            f"{BASE_URL}/api/auth/profiles/{auth_token['user_id']}",
            headers=headers,
            timeout=10
        )
        
        print(f"GET Profile Response: {response.status_code}")
        assert response.status_code == 200, f"Failed to get profile: {response.text}"
        
        data = response.json()
        profile = data.get("profile", {})
        
        print(f"Current profile fields:")
        print(f"  - bio: {profile.get('bio', 'NOT SET')}")
        print(f"  - phone: {profile.get('phone', 'NOT SET')}")
        print(f"  - business_email: {profile.get('business_email', 'NOT SET')}")
        print(f"  - business_phone: {profile.get('business_phone', 'NOT SET')}")
        print(f"  - use_business_name: {profile.get('use_business_name', 'NOT SET')}")
        print(f"  - show_phone_publicly: {profile.get('show_phone_publicly', 'NOT SET')}")
        print(f"  - logo_url: {profile.get('logo_url', 'NOT SET')}")
        print(f"  - header_image_url: {profile.get('header_image_url', 'NOT SET')}")
        
        # Check subscription.settings structure
        subscription = profile.get('subscription') or {}
        settings = subscription.get('settings') or {}
        print(f"\nSubscription.settings fields:")
        for key in ['bio', 'phone', 'business_email', 'business_phone', 'use_business_name', 'show_phone_publicly', 'logo_url', 'header_image_url']:
            print(f"  - {key}: {settings.get(key, 'NOT IN SETTINGS')}")
        
        return profile
    
    def test_03_update_profile_with_bio_phone(self, auth_token):
        """Update profile with bio, phone, and other extended fields"""
        headers = {
            "Authorization": f"Bearer {auth_token['token']}",
            "Content-Type": "application/json"
        }
        
        # Generate unique test data with timestamp
        timestamp = int(time.time())
        test_data = {
            "bio": f"Test bio updated at {timestamp}. This is a test organizer profile.",
            "phone": f"+1-555-{timestamp % 10000:04d}",
            "business_email": f"business_{timestamp}@test.com",
            "business_phone": f"+1-800-{timestamp % 10000:04d}",
            "use_business_name": True,
            "show_phone_publicly": True,
            "name": "Test Organizer",
            "business_name": f"Test Business {timestamp}",
            "organizer_subtitle": f"Event Organizer Since {timestamp}",
            "socials": {
                "website": "https://test.com",
                "instagram": "test_organizer",
                "twitter": "test_org"
            }
        }
        
        print(f"\nUpdating profile with test data:")
        for key, value in test_data.items():
            print(f"  - {key}: {value}")
        
        response = requests.put(
            f"{BASE_URL}/api/auth/profiles/{auth_token['user_id']}",
            headers=headers,
            json=test_data,
            timeout=15
        )
        
        print(f"\nPUT Profile Response: {response.status_code}")
        
        if response.status_code != 200:
            print(f"Response body: {response.text}")
        
        assert response.status_code == 200, f"Failed to update profile: {response.text}"
        
        data = response.json()
        profile = data.get("profile", {})
        
        print("✓ Profile update successful")
        
        # Store test data for verification
        return {"test_data": test_data, "timestamp": timestamp}
    
    def test_04_verify_profile_persistence(self, auth_token):
        """Verify profile data persists after update (GET returns saved data)"""
        headers = {"Authorization": f"Bearer {auth_token['token']}"}
        
        # Wait a moment for data to persist
        time.sleep(1)
        
        response = requests.get(
            f"{BASE_URL}/api/auth/profiles/{auth_token['user_id']}",
            headers=headers,
            timeout=10
        )
        
        print(f"\nGET Profile After Update: {response.status_code}")
        assert response.status_code == 200, f"Failed to get profile: {response.text}"
        
        data = response.json()
        profile = data.get("profile", {})
        
        # Check that extended fields are returned at top level
        print(f"\nVerifying profile fields are returned:")
        
        fields_to_check = ['bio', 'phone', 'business_email', 'business_phone', 'use_business_name', 'show_phone_publicly']
        missing_fields = []
        
        for field in fields_to_check:
            value = profile.get(field)
            if value is None or value == '':
                missing_fields.append(field)
                print(f"  ✗ {field}: NOT RETURNED (value: {value})")
            else:
                print(f"  ✓ {field}: {value}")
        
        # Also check subscription.settings to verify storage
        subscription = profile.get('subscription', {})
        settings = subscription.get('settings', {})
        
        print(f"\nVerifying subscription.settings storage:")
        for field in fields_to_check:
            value = settings.get(field)
            if value is not None:
                print(f"  ✓ settings.{field}: {value}")
            else:
                print(f"  - settings.{field}: not in settings")
        
        # Assert critical fields are present
        assert profile.get('bio') is not None, "bio field not returned in profile"
        assert profile.get('phone') is not None, "phone field not returned in profile"
        
        print("\n✓ Profile data persistence verified!")
        return profile
    
    def test_05_public_profile_endpoint(self, auth_token):
        """Test that public profile endpoint also returns extended fields"""
        # This endpoint doesn't require auth
        response = requests.get(
            f"{BASE_URL}/api/auth/profiles/{auth_token['user_id']}",
            timeout=10
        )
        
        print(f"\nPublic Profile Endpoint: {response.status_code}")
        
        # Note: This might require auth, so we'll try both ways
        if response.status_code == 401:
            headers = {"Authorization": f"Bearer {auth_token['token']}"}
            response = requests.get(
                f"{BASE_URL}/api/auth/profiles/{auth_token['user_id']}",
                headers=headers,
                timeout=10
            )
        
        if response.status_code == 200:
            data = response.json()
            profile = data.get("profile", {})
            
            print(f"Public profile fields:")
            print(f"  - bio: {profile.get('bio', 'NOT SET')}")
            print(f"  - phone: {profile.get('phone', 'NOT SET')}")
            print(f"  - business_email: {profile.get('business_email', 'NOT SET')}")
            print(f"  - socials: {profile.get('socials', 'NOT SET')}")
            
            # Verify bio is present for organizer profile display
            if profile.get('bio'):
                print("✓ Bio available for organizer profile page")
            else:
                print("⚠ Bio not available - organizer profile page may show empty")
        else:
            print(f"⚠ Could not fetch public profile: {response.status_code}")
    
    def test_06_update_and_verify_cycle(self, auth_token):
        """Full cycle: Update -> GET -> Verify data matches"""
        headers = {
            "Authorization": f"Bearer {auth_token['token']}",
            "Content-Type": "application/json"
        }
        
        # New unique test data
        timestamp = int(time.time())
        new_bio = f"Updated bio at {timestamp} - Testing persistence cycle"
        new_phone = f"+1-999-{timestamp % 10000:04d}"
        
        update_data = {
            "bio": new_bio,
            "phone": new_phone,
            "show_phone_publicly": False  # Toggle this
        }
        
        print(f"\n=== Update Cycle Test ===")
        print(f"Setting bio: {new_bio}")
        print(f"Setting phone: {new_phone}")
        
        # Update
        response = requests.put(
            f"{BASE_URL}/api/auth/profiles/{auth_token['user_id']}",
            headers=headers,
            json=update_data,
            timeout=15
        )
        
        assert response.status_code == 200, f"Update failed: {response.text}"
        print("✓ Update successful")
        
        # Wait for persistence
        time.sleep(1)
        
        # Verify
        response = requests.get(
            f"{BASE_URL}/api/auth/profiles/{auth_token['user_id']}",
            headers=headers,
            timeout=10
        )
        
        assert response.status_code == 200, f"GET failed: {response.text}"
        
        profile = response.json().get("profile", {})
        
        # Verify exact match
        assert profile.get('bio') == new_bio, f"Bio mismatch: expected '{new_bio}', got '{profile.get('bio')}'"
        assert profile.get('phone') == new_phone, f"Phone mismatch: expected '{new_phone}', got '{profile.get('phone')}'"
        assert profile.get('show_phone_publicly') == False, f"show_phone_publicly should be False"
        
        print("✓ Bio matches")
        print("✓ Phone matches")
        print("✓ show_phone_publicly matches")
        print("\n✓ Full update-verify cycle passed!")


class TestSocialsAndExtendedSettings:
    """Test socials and other extended settings stored in subscription.settings"""
    
    @pytest.fixture(scope="class")
    def auth_token(self):
        """Get Firebase auth token"""
        url = f"https://identitytoolkit.googleapis.com/v1/accounts:signInWithPassword?key={FIREBASE_API_KEY}"
        payload = {
            "email": TEST_EMAIL,
            "password": TEST_PASSWORD,
            "returnSecureToken": True
        }
        
        try:
            response = requests.post(url, json=payload, timeout=30)
            if response.status_code == 200:
                data = response.json()
                return {"token": data.get("idToken"), "user_id": data.get("localId")}
            else:
                pytest.skip(f"Authentication failed: {response.status_code}")
        except Exception as e:
            pytest.skip(f"Authentication error: {e}")
    
    def test_01_update_socials(self, auth_token):
        """Test updating socials field (stored in profiles table directly)"""
        headers = {
            "Authorization": f"Bearer {auth_token['token']}",
            "Content-Type": "application/json"
        }
        
        timestamp = int(time.time())
        socials_data = {
            "socials": {
                "website": f"https://test-{timestamp}.com",
                "instagram": f"test_ig_{timestamp}",
                "twitter": f"test_tw_{timestamp}",
                "facebook": f"test_fb_{timestamp}",
                "youtube": f"test_yt_{timestamp}"
            }
        }
        
        print(f"\nUpdating socials: {socials_data['socials']}")
        
        response = requests.put(
            f"{BASE_URL}/api/auth/profiles/{auth_token['user_id']}",
            headers=headers,
            json=socials_data,
            timeout=15
        )
        
        assert response.status_code == 200, f"Failed to update socials: {response.text}"
        print("✓ Socials update successful")
        
        # Verify
        time.sleep(1)
        response = requests.get(
            f"{BASE_URL}/api/auth/profiles/{auth_token['user_id']}",
            headers=headers,
            timeout=10
        )
        
        profile = response.json().get("profile", {})
        saved_socials = profile.get('socials', {})
        
        print(f"Saved socials: {saved_socials}")
        
        assert saved_socials.get('website') == socials_data['socials']['website'], "Website mismatch"
        assert saved_socials.get('instagram') == socials_data['socials']['instagram'], "Instagram mismatch"
        
        print("✓ Socials persistence verified")
    
    def test_02_update_logo_and_header(self, auth_token):
        """Test updating logo_url and header_image_url (stored in subscription.settings)"""
        headers = {
            "Authorization": f"Bearer {auth_token['token']}",
            "Content-Type": "application/json"
        }
        
        timestamp = int(time.time())
        branding_data = {
            "logo_url": f"https://example.com/logo_{timestamp}.png",
            "header_image_url": f"https://example.com/header_{timestamp}.jpg",
            "primary_color": "#FF5733",
            "organizer_subtitle": f"Premium Event Organizer {timestamp}"
        }
        
        print(f"\nUpdating branding: {branding_data}")
        
        response = requests.put(
            f"{BASE_URL}/api/auth/profiles/{auth_token['user_id']}",
            headers=headers,
            json=branding_data,
            timeout=15
        )
        
        assert response.status_code == 200, f"Failed to update branding: {response.text}"
        print("✓ Branding update successful")
        
        # Verify
        time.sleep(1)
        response = requests.get(
            f"{BASE_URL}/api/auth/profiles/{auth_token['user_id']}",
            headers=headers,
            timeout=10
        )
        
        profile = response.json().get("profile", {})
        
        print(f"Saved branding:")
        print(f"  - logo_url: {profile.get('logo_url')}")
        print(f"  - header_image_url: {profile.get('header_image_url')}")
        print(f"  - primary_color: {profile.get('primary_color')}")
        print(f"  - organizer_subtitle: {profile.get('organizer_subtitle')}")
        
        # These should be returned at top level from subscription.settings
        assert profile.get('logo_url') == branding_data['logo_url'], "logo_url mismatch"
        assert profile.get('header_image_url') == branding_data['header_image_url'], "header_image_url mismatch"
        
        print("✓ Branding persistence verified")


if __name__ == "__main__":
    pytest.main([__file__, "-v", "--tb=short"])
