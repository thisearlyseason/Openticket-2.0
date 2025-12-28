
SELECT id, email, payment_status, stripe_checkout_session_id 
FROM registrations 
WHERE stripe_checkout_session_id = 'cs_test_b1auluRl19pYPBUMnzmhbMS6iaJStJt6c3iykxLN7g8VRB2k3YE3SrcY6m';
