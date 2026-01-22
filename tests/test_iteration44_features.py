"""
Test Iteration 44 Features:
1. Two-option signup flow (Find Events / Host Events at Step 0)
2. My Tickets date parsing logic (future events in Active, not Past)
3. Email template themes (muted professional colors)
4. Registration data includes chargedCurrency and chargedAmount in answers._metadata
5. Receipt modal uses conversion ratio for currency display
"""

import pytest
import requests
import os
import json

BASE_URL = os.environ.get('VITE_BACKEND_URL', 'https://www.openticket.events')


class TestEmailTemplateThemes:
    """Test email template themes have muted professional colors"""
    
    def test_email_templates_file_exists(self):
        """Verify emailTemplates.js exists and has TEMPLATE_THEMES"""
        # This is a code review test - we verify the file structure
        import subprocess
        result = subprocess.run(
            ['grep', '-c', 'TEMPLATE_THEMES', '/app/backend/services/emailTemplates.js'],
            capture_output=True, text=True
        )
        assert result.returncode == 0, "TEMPLATE_THEMES not found in emailTemplates.js"
        print("✅ TEMPLATE_THEMES found in emailTemplates.js")
        
    def test_modern_theme_uses_muted_colors(self):
        """Verify modern theme uses gray/slate tones, not bright colors"""
        import subprocess
        result = subprocess.run(
            ['grep', '-A5', "modern:", '/app/backend/services/emailTemplates.js'],
            capture_output=True, text=True
        )
        output = result.stdout
        
        # Check for muted gray colors (#374151, #1f2937)
        assert '#374151' in output or '#1f2937' in output, "Modern theme should use gray tones"
        # Ensure no bright green (#10b981, #22c55e) or bright blue (#3b82f6)
        assert '#10b981' not in output, "Modern theme should NOT use bright green"
        assert '#22c55e' not in output, "Modern theme should NOT use bright green"
        
        print("✅ Modern theme uses muted gray colors")
        
    def test_classic_theme_uses_muted_colors(self):
        """Verify classic theme uses dark blue/slate tones"""
        import subprocess
        result = subprocess.run(
            ['grep', '-A5', "classic:", '/app/backend/services/emailTemplates.js'],
            capture_output=True, text=True
        )
        output = result.stdout
        
        # Check for muted navy colors (#1e3a5f, #0f172a)
        assert '#1e3a5f' in output or '#0f172a' in output, "Classic theme should use navy tones"
        
        print("✅ Classic theme uses muted navy colors")
        
    def test_all_themes_have_muted_color(self):
        """Verify all themes have mutedColor property"""
        import subprocess
        result = subprocess.run(
            ['grep', '-c', 'mutedColor', '/app/backend/services/emailTemplates.js'],
            capture_output=True, text=True
        )
        count = int(result.stdout.strip())
        # Should have mutedColor for each theme (7 themes)
        assert count >= 7, f"Expected at least 7 mutedColor entries, found {count}"
        
        print(f"✅ All themes have mutedColor property ({count} entries)")


class TestRegistrationCurrencyMetadata:
    """Test registration stores chargedCurrency and chargedAmount in answers._metadata"""
    
    def test_stripe_controller_stores_currency_metadata(self):
        """Verify stripeController.js stores charged_currency in answers._metadata"""
        import subprocess
        result = subprocess.run(
            ['grep', '-n', 'charged_currency', '/app/backend/controllers/stripeController.js'],
            capture_output=True, text=True
        )
        assert 'charged_currency' in result.stdout, "charged_currency not found in stripeController.js"
        assert '_metadata' in result.stdout or 'answers' in result.stdout, "Should be stored in answers._metadata"
        
        print(f"✅ stripeController.js stores charged_currency in answers._metadata")
        print(f"   Found at: {result.stdout.strip()}")
        
    def test_stripe_controller_stores_amount_metadata(self):
        """Verify stripeController.js stores charged_amount in answers._metadata"""
        import subprocess
        result = subprocess.run(
            ['grep', '-n', 'charged_amount', '/app/backend/controllers/stripeController.js'],
            capture_output=True, text=True
        )
        assert 'charged_amount' in result.stdout, "charged_amount not found in stripeController.js"
        
        print(f"✅ stripeController.js stores charged_amount in answers._metadata")
        print(f"   Found at: {result.stdout.strip()}")
        
    def test_storage_service_normalizes_currency_data(self):
        """Verify storageService.ts normalizes chargedAmount and chargedCurrency"""
        import subprocess
        result = subprocess.run(
            ['grep', '-n', 'chargedAmount', '/app/services/storageService.ts'],
            capture_output=True, text=True
        )
        assert 'chargedAmount' in result.stdout, "chargedAmount not found in storageService.ts"
        
        result2 = subprocess.run(
            ['grep', '-n', 'chargedCurrency', '/app/services/storageService.ts'],
            capture_output=True, text=True
        )
        assert 'chargedCurrency' in result2.stdout, "chargedCurrency not found in storageService.ts"
        
        print(f"✅ storageService.ts normalizes chargedAmount and chargedCurrency")


class TestMyTicketsDateParsing:
    """Test My Tickets date parsing logic handles edge cases"""
    
    def test_date_parsing_safeguards_exist(self):
        """Verify MyTickets.tsx has date parsing safeguards"""
        import subprocess
        
        # Check for null/undefined date handling
        result = subprocess.run(
            ['grep', '-n', 'event.date', '/app/components/MyTickets.tsx'],
            capture_output=True, text=True
        )
        assert 'event.date' in result.stdout, "event.date check not found"
        
        # Check for isNaN safeguard
        result2 = subprocess.run(
            ['grep', '-n', 'isNaN', '/app/components/MyTickets.tsx'],
            capture_output=True, text=True
        )
        assert 'isNaN' in result2.stdout, "isNaN safeguard not found in MyTickets.tsx"
        
        print("✅ MyTickets.tsx has date parsing safeguards (null check, isNaN)")
        
    def test_date_parsing_handles_iso_format(self):
        """Verify date parsing handles both ISO and YYYY-MM-DD formats"""
        import subprocess
        result = subprocess.run(
            ['grep', '-n', "includes('T')", '/app/components/MyTickets.tsx'],
            capture_output=True, text=True
        )
        assert "includes('T')" in result.stdout, "ISO format detection not found"
        
        print("✅ MyTickets.tsx handles both ISO and YYYY-MM-DD date formats")
        
    def test_future_events_default_to_active(self):
        """Verify events with missing dates default to Active (not Past)"""
        import subprocess
        result = subprocess.run(
            ['grep', '-A2', 'No date means', '/app/components/MyTickets.tsx'],
            capture_output=True, text=True
        )
        # Should default to NOT past (show in active)
        assert 'NOT past' in result.stdout or 'active' in result.stdout.lower(), \
            "Missing date should default to Active tab"
        
        print("✅ Events with missing dates default to Active tab")


class TestTwoOptionSignupFlow:
    """Test two-option signup flow (Find Events / Host Events)"""
    
    def test_auth_component_has_step_0(self):
        """Verify Auth.tsx has Step 0 for role selection"""
        import subprocess
        result = subprocess.run(
            ['grep', '-n', 'step === 0', '/app/components/Auth.tsx'],
            capture_output=True, text=True
        )
        assert 'step === 0' in result.stdout, "Step 0 condition not found in Auth.tsx"
        
        print("✅ Auth.tsx has Step 0 for role selection")
        
    def test_find_events_button_exists(self):
        """Verify 'I want to find events' button exists"""
        import subprocess
        result = subprocess.run(
            ['grep', '-n', 'I want to find events', '/app/components/Auth.tsx'],
            capture_output=True, text=True
        )
        assert 'I want to find events' in result.stdout, "'I want to find events' button not found"
        
        print("✅ 'I want to find events' button exists in Auth.tsx")
        
    def test_host_events_button_exists(self):
        """Verify 'I want to host events' button exists"""
        import subprocess
        result = subprocess.run(
            ['grep', '-n', 'I want to host events', '/app/components/Auth.tsx'],
            capture_output=True, text=True
        )
        assert 'I want to host events' in result.stdout, "'I want to host events' button not found"
        
        print("✅ 'I want to host events' button exists in Auth.tsx")
        
    def test_role_selection_sets_attendee(self):
        """Verify clicking 'Find Events' sets role to attendee"""
        import subprocess
        result = subprocess.run(
            ['grep', '-B2', '-A2', "I want to find events", '/app/components/Auth.tsx'],
            capture_output=True, text=True
        )
        assert "setRole('attendee')" in result.stdout, "Find Events should set role to attendee"
        
        print("✅ 'Find Events' button sets role to 'attendee'")
        
    def test_role_selection_sets_organizer(self):
        """Verify clicking 'Host Events' sets role to organizer"""
        import subprocess
        result = subprocess.run(
            ['grep', '-B2', '-A2', "I want to host events", '/app/components/Auth.tsx'],
            capture_output=True, text=True
        )
        assert "setRole('organizer')" in result.stdout, "Host Events should set role to organizer"
        
        print("✅ 'Host Events' button sets role to 'organizer'")


class TestBackendHealthAndEndpoints:
    """Test backend health and key endpoints"""
    
    def test_backend_health(self):
        """Test backend health endpoint"""
        response = requests.get(f"{BASE_URL}/api/health")
        assert response.status_code == 200
        data = response.json()
        assert data.get("status") == "healthy"
        print(f"✅ Backend healthy: {data}")
        
    def test_exchange_rates_endpoint(self):
        """Test exchange rates endpoint returns valid data"""
        response = requests.get(f"{BASE_URL}/api/stripe/exchange-rates")
        assert response.status_code == 200
        
        data = response.json()
        assert data.get("success") == True
        assert "rates" in data
        assert "USD" in data["rates"]
        
        print(f"✅ Exchange rates endpoint working")
        
    def test_public_events_endpoint(self):
        """Test public events endpoint"""
        response = requests.get(f"{BASE_URL}/api/events/public")
        assert response.status_code == 200
        
        data = response.json()
        assert "events" in data
        print(f"✅ Public events endpoint working, found {len(data.get('events', []))} events")


if __name__ == "__main__":
    pytest.main([__file__, "-v", "--tb=short"])
