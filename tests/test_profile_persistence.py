"""
Test Profile Data Persistence - Backend API Tests
Tests the profile controller endpoints for saving and retrieving organizer profile data.
Focus: bio, phone, socials, logo_url, header_image_url, use_business_name, etc.
"""

import pytest
import requests
import os
import time
import json

# Use localhost for internal testing
BASE_URL = "http://localhost:8001/api"

# Supabase direct access for verification
SUPABASE_URL = "https://dcjdurvgkveblvtinoms.supabase.co"
SUPABASE_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImRjamR1cnZna3ZlYmx2dGlub21zIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc2NjQxMDM4NSwiZXhwIjoyMDgxOTg2Mzg1fQ.YII1GuVBPgY0_4sT3-zdfjioBQjO9mYILbLA-Syu9c0"


class TestProfilePersistence:
    """Test profile data persistence for organizer profiles"""
    
    @pytest.fixture(scope="class")
    def existing_organizer_id(self):
        """Get an existing organizer ID from the database for testing"""
        # Use the known organizer ID from the events
        return "9iQqNVY6RdesJeBxhnqTjsfMche2"
    
    def test_get_profile_by_id_returns_profile_fields(self, existing_organizer_id):
        """Test that getProfileById returns all expected profile fields"""
        response = requests.get(f"{BASE_URL}/auth/profiles/{existing_organizer_id}")
        
        assert response.status_code == 200, f"Expected 200, got {response.status_code}: {response.text}"
        
        data = response.json()
        assert "profile" in data, "Response should contain 'profile' key"
        
        profile = data["profile"]
        
        # Check that essential fields are present in response
        expected_fields = [
            "id", "email", "name", "role",
            # Profile fields that should be returned
            "bio", "phone", "socials", "use_business_name",
            "business_name", "business_email", "business_phone",
            "show_phone_publicly", "logo_url", "header_image_url"
        ]
        
        for field in expected_fields:
            assert field in profile, f"Profile should contain '{field}' field"
        
        print(f"✓ Profile retrieved successfully with all expected fields")
        print(f"  - ID: {profile.get('id')}")
        print(f"  - Name: {profile.get('name')}")
        print(f"  - Bio: {profile.get('bio', 'Not set')[:50] if profile.get('bio') else 'Not set'}...")
        print(f"  - Phone: {profile.get('phone', 'Not set')}")
        print(f"  - Socials: {json.dumps(profile.get('socials', {}))[:100]}...")
    
    def test_get_profile_by_id_returns_extended_settings(self, existing_organizer_id):
        """Test that extended settings from subscription.settings are returned at top level"""
        response = requests.get(f"{BASE_URL}/auth/profiles/{existing_organizer_id}")
        
        assert response.status_code == 200
        profile = response.json()["profile"]
        
        # These fields should be extracted from subscription.settings and returned at top level
        extended_fields = [
            "logo_url", "header_image_url", "primary_color",
            "organizer_subtitle", "business_type"
        ]
        
        for field in extended_fields:
            # Field should exist in response (even if null)
            assert field in profile, f"Extended setting '{field}' should be in profile response"
        
        print(f"✓ Extended settings returned correctly")
        print(f"  - logo_url: {profile.get('logo_url', 'Not set')[:50] if profile.get('logo_url') else 'Not set'}...")
        print(f"  - header_image_url: {profile.get('header_image_url', 'Not set')[:50] if profile.get('header_image_url') else 'Not set'}...")
        print(f"  - primary_color: {profile.get('primary_color', 'Not set')}")
    
    def test_profile_not_found_returns_404(self):
        """Test that non-existent profile returns 404"""
        fake_id = "nonexistent-user-id-12345"
        response = requests.get(f"{BASE_URL}/auth/profiles/{fake_id}")
        
        assert response.status_code == 404, f"Expected 404 for non-existent profile, got {response.status_code}"
        print(f"✓ Non-existent profile correctly returns 404")
    
    def test_direct_supabase_profile_has_required_columns(self, existing_organizer_id):
        """Verify the Supabase profiles table has the required columns"""
        headers = {
            "apikey": SUPABASE_KEY,
            "Authorization": f"Bearer {SUPABASE_KEY}",
            "Content-Type": "application/json"
        }
        
        response = requests.get(
            f"{SUPABASE_URL}/rest/v1/profiles?id=eq.{existing_organizer_id}&select=*",
            headers=headers
        )
        
        assert response.status_code == 200, f"Supabase query failed: {response.text}"
        
        profiles = response.json()
        assert len(profiles) > 0, "Profile should exist in database"
        
        profile = profiles[0]
        
        # Check that DB columns exist
        db_columns = [
            "id", "email", "name", "role", "bio", "phone", "socials",
            "business_name", "business_email", "use_business_name",
            "business_phone", "show_phone_publicly", "image_url",
            "subscription"  # JSONB field that stores extended settings
        ]
        
        for col in db_columns:
            assert col in profile, f"Database should have '{col}' column"
        
        print(f"✓ Database schema verified - all required columns present")
        print(f"  - bio column exists: {'bio' in profile}")
        print(f"  - phone column exists: {'phone' in profile}")
        print(f"  - socials column exists: {'socials' in profile}")
        print(f"  - subscription column exists: {'subscription' in profile}")
    
    def test_profile_socials_structure(self, existing_organizer_id):
        """Test that socials field has correct structure"""
        response = requests.get(f"{BASE_URL}/auth/profiles/{existing_organizer_id}")
        
        assert response.status_code == 200
        profile = response.json()["profile"]
        
        socials = profile.get("socials")
        
        # Socials can be null or an object
        if socials is not None:
            assert isinstance(socials, dict), "Socials should be a dictionary/object"
            
            # Check for expected social link keys
            valid_social_keys = ["instagram", "facebook", "x", "youtube", "tiktok", "website"]
            for key in socials.keys():
                assert key in valid_social_keys, f"Unexpected social key: {key}"
            
            print(f"✓ Socials structure is valid: {json.dumps(socials)}")
        else:
            print(f"✓ Socials is null (not set)")


class TestPublicEventsWithOrganizerData:
    """Test that public events endpoint returns events with organizer data accessible"""
    
    def test_public_events_returns_owner_id(self):
        """Test that public events include owner_id for fetching organizer profile"""
        response = requests.get(f"{BASE_URL}/events/public")
        
        assert response.status_code == 200
        data = response.json()
        
        assert "events" in data, "Response should contain 'events' key"
        events = data["events"]
        
        if len(events) > 0:
            event = events[0]
            assert "owner_id" in event, "Event should have owner_id field"
            print(f"✓ Events include owner_id for organizer lookup")
            print(f"  - First event owner_id: {event['owner_id']}")
        else:
            print("⚠ No public events found to test")
    
    def test_can_fetch_organizer_for_event(self):
        """Test that we can fetch organizer profile for an event"""
        # Get a public event
        events_response = requests.get(f"{BASE_URL}/events/public")
        assert events_response.status_code == 200
        
        events = events_response.json().get("events", [])
        if len(events) == 0:
            pytest.skip("No public events available")
        
        event = events[0]
        owner_id = event.get("owner_id")
        
        # Fetch the organizer profile
        profile_response = requests.get(f"{BASE_URL}/auth/profiles/{owner_id}")
        assert profile_response.status_code == 200, f"Failed to fetch organizer profile: {profile_response.text}"
        
        profile = profile_response.json()["profile"]
        
        print(f"✓ Successfully fetched organizer profile for event")
        print(f"  - Event: {event.get('title')}")
        print(f"  - Organizer: {profile.get('name')}")
        print(f"  - Business Name: {profile.get('business_name', 'Not set')}")
        print(f"  - Bio: {profile.get('bio', 'Not set')[:50] if profile.get('bio') else 'Not set'}...")


class TestProfileFieldMapping:
    """Test that profile fields are correctly mapped between frontend and backend"""
    
    @pytest.fixture(scope="class")
    def existing_organizer_id(self):
        return "9iQqNVY6RdesJeBxhnqTjsfMche2"
    
    def test_snake_case_to_camel_case_mapping(self, existing_organizer_id):
        """Test that snake_case DB fields are returned correctly"""
        response = requests.get(f"{BASE_URL}/auth/profiles/{existing_organizer_id}")
        
        assert response.status_code == 200
        profile = response.json()["profile"]
        
        # These fields should be returned with snake_case (as stored in DB)
        # The frontend storageService.ts handles the mapping to camelCase
        snake_case_fields = [
            "business_name", "business_email", "use_business_name",
            "business_phone", "show_phone_publicly", "logo_url", "header_image_url"
        ]
        
        for field in snake_case_fields:
            assert field in profile, f"Field '{field}' should be in profile response"
        
        print(f"✓ All snake_case fields present in API response")
        print(f"  - business_name: {profile.get('business_name')}")
        print(f"  - use_business_name: {profile.get('use_business_name')}")
        print(f"  - show_phone_publicly: {profile.get('show_phone_publicly')}")


class TestSubscriptionSettingsExtraction:
    """Test that extended settings stored in subscription.settings are extracted correctly"""
    
    @pytest.fixture(scope="class")
    def existing_organizer_id(self):
        return "9iQqNVY6RdesJeBxhnqTjsfMche2"
    
    def test_subscription_settings_extracted_to_top_level(self, existing_organizer_id):
        """Test that settings from subscription.settings JSONB are returned at top level"""
        # First, check what's in the raw database
        headers = {
            "apikey": SUPABASE_KEY,
            "Authorization": f"Bearer {SUPABASE_KEY}",
            "Content-Type": "application/json"
        }
        
        db_response = requests.get(
            f"{SUPABASE_URL}/rest/v1/profiles?id=eq.{existing_organizer_id}&select=subscription",
            headers=headers
        )
        
        assert db_response.status_code == 200
        profiles = db_response.json()
        
        if len(profiles) > 0 and profiles[0].get("subscription"):
            subscription = profiles[0]["subscription"]
            settings = subscription.get("settings", {})
            
            print(f"  Raw subscription.settings in DB: {json.dumps(settings)[:200]}...")
            
            # Now check API response
            api_response = requests.get(f"{BASE_URL}/auth/profiles/{existing_organizer_id}")
            assert api_response.status_code == 200
            
            profile = api_response.json()["profile"]
            
            # Extended settings should be at top level
            if settings.get("logo_url"):
                assert profile.get("logo_url") == settings.get("logo_url"), "logo_url should be extracted"
            if settings.get("header_image_url"):
                assert profile.get("header_image_url") == settings.get("header_image_url"), "header_image_url should be extracted"
            if settings.get("primary_color"):
                assert profile.get("primary_color") == settings.get("primary_color"), "primary_color should be extracted"
            
            print(f"✓ Extended settings correctly extracted from subscription.settings")
        else:
            print(f"⚠ No subscription.settings found in database for this user")


if __name__ == "__main__":
    pytest.main([__file__, "-v", "--tb=short"])
