"""
Test Push Notification Integration for Ticket Sales
Tests the push notification system integration in Stripe webhook handlers
"""

import pytest
import requests
import os
import json
import re

BASE_URL = os.environ.get('REACT_APP_BACKEND_URL', 'https://www.openticket.events').rstrip('/')

class TestPushNotificationEndpoints:
    """Test push notification API endpoints"""
    
    def test_vapid_key_endpoint(self):
        """Test VAPID public key endpoint returns valid key"""
        response = requests.get(f"{BASE_URL}/api/push/vapid-key")
        assert response.status_code == 200, f"Expected 200, got {response.status_code}"
        
        data = response.json()
        assert 'publicKey' in data, "Response should contain publicKey"
        assert 'enabled' in data, "Response should contain enabled flag"
        assert data['enabled'] == True, "Push notifications should be enabled"
        assert len(data['publicKey']) > 50, "VAPID key should be a valid length"
        print(f"✅ VAPID key endpoint working, key length: {len(data['publicKey'])}")
    
    def test_push_subscribe_requires_auth(self):
        """Test push subscribe endpoint requires authentication"""
        response = requests.post(f"{BASE_URL}/api/push/subscribe", json={
            "subscription": {
                "endpoint": "https://test.example.com",
                "keys": {"p256dh": "test", "auth": "test"}
            }
        })
        assert response.status_code == 401, f"Expected 401 for unauthenticated request, got {response.status_code}"
        print("✅ Push subscribe correctly requires authentication")
    
    def test_push_status_requires_auth(self):
        """Test push status endpoint requires authentication"""
        response = requests.get(f"{BASE_URL}/api/push/status")
        assert response.status_code == 401, f"Expected 401 for unauthenticated request, got {response.status_code}"
        print("✅ Push status correctly requires authentication")
    
    def test_push_test_requires_auth(self):
        """Test push test notification endpoint requires authentication"""
        response = requests.post(f"{BASE_URL}/api/push/test")
        assert response.status_code == 401, f"Expected 401 for unauthenticated request, got {response.status_code}"
        print("✅ Push test correctly requires authentication")


class TestNotificationEndpoints:
    """Test in-app notification API endpoints"""
    
    def test_notifications_get_requires_auth(self):
        """Test notifications GET endpoint requires authentication"""
        response = requests.get(f"{BASE_URL}/api/notifications/test-user-id")
        assert response.status_code == 401, f"Expected 401 for unauthenticated request, got {response.status_code}"
        print("✅ Notifications GET correctly requires authentication")
    
    def test_notifications_create_requires_auth(self):
        """Test notifications POST endpoint requires authentication"""
        response = requests.post(f"{BASE_URL}/api/notifications", json={
            "userId": "test-user",
            "message": "Test notification"
        })
        assert response.status_code == 401, f"Expected 401 for unauthenticated request, got {response.status_code}"
        print("✅ Notifications POST correctly requires authentication")
    
    def test_notifications_broadcast_requires_auth(self):
        """Test notifications broadcast endpoint requires authentication"""
        response = requests.post(f"{BASE_URL}/api/notifications/broadcast", json={
            "message": "Test broadcast",
            "target": "all"
        })
        assert response.status_code == 401, f"Expected 401 for unauthenticated request, got {response.status_code}"
        print("✅ Notifications broadcast correctly requires authentication")


class TestStripeWebhookCodeReview:
    """Code review tests for Stripe webhook push notification integration"""
    
    def test_checkout_completed_notification_code_structure(self):
        """Verify checkout.session.completed handler has correct notification code"""
        webhook_file = '/app/backend/controllers/stripeWebhookController.js'
        
        with open(webhook_file, 'r') as f:
            content = f.read()
        
        # Check PushService import
        assert "import PushService from '../services/pushService.js'" in content, \
            "PushService should be imported"
        print("✅ PushService import found")
        
        # Check notification code in handleCheckoutCompleted
        # Find the handleCheckoutCompleted function
        checkout_match = re.search(
            r'async function handleCheckoutCompleted.*?(?=async function|export|$)', 
            content, 
            re.DOTALL
        )
        assert checkout_match, "handleCheckoutCompleted function should exist"
        checkout_code = checkout_match.group(0)
        
        # Verify notification payload structure
        assert "New Ticket Sale" in checkout_code, \
            "Notification should have 'New Ticket Sale' title"
        assert "PushService.sendNotification" in checkout_code, \
            "Should call PushService.sendNotification"
        assert "organizerId" in checkout_code, \
            "Should get organizerId from event"
        assert "attendee_name" in checkout_code or "attendeeName" in checkout_code, \
            "Notification should include attendee name"
        assert "grossAmount" in checkout_code, \
            "Notification should include sale amount"
        assert "ticketCount" in checkout_code, \
            "Notification should include ticket count"
        
        # Verify database insert for in-app notifications
        assert ".from('notifications')" in checkout_code, \
            "Should insert into notifications table"
        assert "type: 'new_sale'" in checkout_code, \
            "Notification type should be 'new_sale'"
        
        print("✅ handleCheckoutCompleted has correct notification structure")
        print("  - Includes attendee name")
        print("  - Includes sale amount")
        print("  - Includes ticket count")
        print("  - Saves to notifications database")
    
    def test_payment_intent_succeeded_notification_code_structure(self):
        """Verify payment_intent.succeeded handler has correct notification code for at-door payments"""
        webhook_file = '/app/backend/controllers/stripeWebhookController.js'
        
        with open(webhook_file, 'r') as f:
            content = f.read()
        
        # Find the handlePaymentIntentSucceeded function
        payment_match = re.search(
            r'async function handlePaymentIntentSucceeded.*?(?=async function|export|/\*\*)', 
            content, 
            re.DOTALL
        )
        assert payment_match, "handlePaymentIntentSucceeded function should exist"
        payment_code = payment_match.group(0)
        
        # Verify notification payload structure for at-door payments
        assert "At-Door Payment" in payment_code, \
            "Notification should have 'At-Door Payment' title"
        assert "PushService.sendNotification" in payment_code, \
            "Should call PushService.sendNotification"
        assert "organizerId" in payment_code, \
            "Should get organizerId from event"
        
        # Verify database insert for in-app notifications
        assert ".from('notifications')" in payment_code, \
            "Should insert into notifications table"
        assert "type: 'door_sale'" in payment_code, \
            "Notification type should be 'door_sale'"
        
        print("✅ handlePaymentIntentSucceeded has correct notification structure")
        print("  - Includes 'At-Door Payment' title")
        print("  - Saves to notifications database with type 'door_sale'")
    
    def test_notification_payload_contains_required_fields(self):
        """Verify notification payloads contain all required fields"""
        webhook_file = '/app/backend/controllers/stripeWebhookController.js'
        
        with open(webhook_file, 'r') as f:
            content = f.read()
        
        # Check for required notification data fields
        required_fields = [
            'eventId',
            'registrationId',
            'attendeeName',
            'ticketCount',
            'amount',
            'currency',
            'url'
        ]
        
        # Find notification payload in checkout handler
        checkout_notification_match = re.search(
            r'const notification = \{[\s\S]*?data: \{[\s\S]*?\}[\s\S]*?\};',
            content
        )
        assert checkout_notification_match, "Notification payload should be defined"
        notification_code = checkout_notification_match.group(0)
        
        for field in required_fields:
            assert field in notification_code, f"Notification data should contain '{field}'"
        
        print("✅ Notification payload contains all required fields:")
        for field in required_fields:
            print(f"  - {field}")


class TestPushServiceCodeReview:
    """Code review tests for PushService implementation"""
    
    def test_push_service_has_send_notification(self):
        """Verify PushService has sendNotification function"""
        push_service_file = '/app/backend/services/pushService.js'
        
        with open(push_service_file, 'r') as f:
            content = f.read()
        
        assert "export const sendNotification" in content, \
            "PushService should export sendNotification function"
        assert "webPush.sendNotification" in content, \
            "sendNotification should use web-push library"
        print("✅ PushService has sendNotification function using web-push")
    
    def test_push_service_handles_missing_subscription(self):
        """Verify PushService handles missing subscription gracefully"""
        push_service_file = '/app/backend/services/pushService.js'
        
        with open(push_service_file, 'r') as f:
            content = f.read()
        
        assert "if (!subscription)" in content, \
            "Should check for missing subscription"
        assert "return false" in content, \
            "Should return false when no subscription"
        print("✅ PushService handles missing subscription gracefully")
    
    def test_push_service_has_vapid_configuration(self):
        """Verify PushService has VAPID configuration"""
        push_service_file = '/app/backend/services/pushService.js'
        
        with open(push_service_file, 'r') as f:
            content = f.read()
        
        assert "VAPID_PUBLIC_KEY" in content, \
            "Should use VAPID_PUBLIC_KEY from env"
        assert "VAPID_PRIVATE_KEY" in content, \
            "Should use VAPID_PRIVATE_KEY from env"
        assert "webPush.setVapidDetails" in content, \
            "Should configure web-push with VAPID details"
        print("✅ PushService has proper VAPID configuration")


class TestNotificationSettingsComponent:
    """Code review tests for NotificationSettings component"""
    
    def test_notification_settings_has_correct_types(self):
        """Verify NotificationSettings shows correct notification types for organizers"""
        component_file = '/app/components/NotificationSettings.tsx'
        
        with open(component_file, 'r') as f:
            content = f.read()
        
        # Check for required notification types
        required_types = [
            'New ticket sales',
            'At-door payments',
            'Check-in confirmations',
            'Event reminders',
            'Event updates',
            'Refund notifications'
        ]
        
        for notification_type in required_types:
            assert notification_type in content, \
                f"NotificationSettings should list '{notification_type}'"
        
        print("✅ NotificationSettings shows all required notification types:")
        for notification_type in required_types:
            print(f"  - {notification_type}")
    
    def test_notification_settings_has_enable_disable_toggle(self):
        """Verify NotificationSettings has enable/disable functionality"""
        component_file = '/app/components/NotificationSettings.tsx'
        
        with open(component_file, 'r') as f:
            content = f.read()
        
        assert "handleSubscribe" in content, \
            "Should have subscribe handler"
        assert "handleUnsubscribe" in content, \
            "Should have unsubscribe handler"
        assert "Enable Notifications" in content, \
            "Should have enable button text"
        assert "Disable" in content, \
            "Should have disable button"
        print("✅ NotificationSettings has enable/disable toggle functionality")


class TestWebhookIntegration:
    """Integration tests for webhook endpoint"""
    
    def test_webhook_endpoint_exists(self):
        """Test webhook endpoint exists and responds"""
        # Webhook endpoint should reject requests without proper signature
        response = requests.post(
            f"{BASE_URL}/api/webhook",
            headers={"Content-Type": "application/json"},
            data="{}"
        )
        # Should return 400 (bad signature) not 404 (not found)
        assert response.status_code in [400, 500], \
            f"Webhook endpoint should exist, got {response.status_code}"
        print(f"✅ Webhook endpoint exists (returns {response.status_code} for invalid signature)")
    
    def test_health_endpoint(self):
        """Test health endpoint to verify backend is running"""
        response = requests.get(f"{BASE_URL}/api/health")
        assert response.status_code == 200, f"Health check failed: {response.status_code}"
        print("✅ Backend health check passed")


if __name__ == "__main__":
    pytest.main([__file__, "-v", "--tb=short"])
