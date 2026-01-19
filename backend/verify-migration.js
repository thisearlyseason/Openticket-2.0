#!/usr/bin/env node

/**
 * Kiosk Mode Migration Verification Script
 * Run this after executing the migration SQL to verify everything is set up correctly
 */

import('dotenv/config').then(() => {
  import('./services/supabase.js').then(async ({ default: supabase }) => {
    console.log('\n🔍 Verifying Kiosk Mode Database Migration...\n');
    console.log('=' .repeat(60));
    
    let allPassed = true;
    
    // Test 1: Check kiosk_tokens table
    console.log('\n1️⃣  Testing kiosk_tokens table...');
    try {
      const { data, error } = await supabase
        .from('kiosk_tokens')
        .select('id')
        .limit(0);
      
      if (error) {
        console.log('   ❌ FAILED:', error.message);
        allPassed = false;
      } else {
        console.log('   ✅ PASSED: kiosk_tokens table exists');
      }
    } catch (err) {
      console.log('   ❌ ERROR:', err.message);
      allPassed = false;
    }
    
    // Test 2: Check kiosk_logs table
    console.log('\n2️⃣  Testing kiosk_logs table...');
    try {
      const { data, error } = await supabase
        .from('kiosk_logs')
        .select('id')
        .limit(0);
      
      if (error) {
        console.log('   ❌ FAILED:', error.message);
        allPassed = false;
      } else {
        console.log('   ✅ PASSED: kiosk_logs table exists');
      }
    } catch (err) {
      console.log('   ❌ ERROR:', err.message);
      allPassed = false;
    }
    
    // Test 3: Check active_kiosk_tokens view
    console.log('\n3️⃣  Testing active_kiosk_tokens view...');
    try {
      const { data, error } = await supabase
        .from('active_kiosk_tokens')
        .select('token_id')
        .limit(0);
      
      if (error) {
        console.log('   ❌ FAILED:', error.message);
        allPassed = false;
      } else {
        console.log('   ✅ PASSED: active_kiosk_tokens view exists');
      }
    } catch (err) {
      console.log('   ❌ ERROR:', err.message);
      allPassed = false;
    }
    
    // Test 4: Check events table columns
    console.log('\n4️⃣  Testing events table columns...');
    try {
      const { data, error } = await supabase
        .from('events')
        .select('kiosk_enabled, kiosk_token_id')
        .limit(1);
      
      if (error) {
        console.log('   ❌ FAILED:', error.message);
        allPassed = false;
      } else {
        console.log('   ✅ PASSED: events.kiosk_enabled column exists');
        console.log('   ✅ PASSED: events.kiosk_token_id column exists');
      }
    } catch (err) {
      console.log('   ❌ ERROR:', err.message);
      allPassed = false;
    }
    
    // Test 5: Check registrations table columns
    console.log('\n5️⃣  Testing registrations table columns...');
    try {
      const { data, error } = await supabase
        .from('registrations')
        .select('checked_in_method, checked_in_device, payment_source, kiosk_device_id')
        .limit(1);
      
      if (error) {
        console.log('   ❌ FAILED:', error.message);
        allPassed = false;
      } else {
        console.log('   ✅ PASSED: registrations.checked_in_method column exists');
        console.log('   ✅ PASSED: registrations.checked_in_device column exists');
        console.log('   ✅ PASSED: registrations.payment_source column exists');
        console.log('   ✅ PASSED: registrations.kiosk_device_id column exists');
      }
    } catch (err) {
      console.log('   ❌ ERROR:', err.message);
      allPassed = false;
    }
    
    // Final summary
    console.log('\n' + '='.repeat(60));
    if (allPassed) {
      console.log('\n🎉 SUCCESS! All migration checks passed!');
      console.log('✅ Kiosk Mode is ready to use\n');
      process.exit(0);
    } else {
      console.log('\n❌ FAILED! Some checks did not pass');
      console.log('⚠️  Please run the migration SQL in Supabase SQL Editor\n');
      process.exit(1);
    }
  });
});
