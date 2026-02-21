# 🎯 Production Testing Guide (Beginner-Friendly)

## What is This Document?
This guide will help you test your OpenTicket platform to make sure everything works perfectly before going live. We'll walk through each test step-by-step, telling you exactly WHERE to click and WHAT to do.

---

## 🛠️ What You'll Need

### 1. Your Login Details
- **Email**: `tylerans@gmail.com`
- **Password**: `Jevan2908`

### 2. Access to These Places
- ✅ Your OpenTicket website: https://www.openticket.events
- ✅ Stripe Dashboard: https://dashboard.stripe.com
- ✅ Supabase Dashboard: https://dcjdurvgkveblvtinoms.supabase.co

### 3. Tools You Need
- **Google Chrome** or **Firefox** browser
- **Supabase account** (already set up)
- **Stripe account** (already set up)

---

## 📍 PHASE 1: Basic Website Testing

### ✅ Test 1: Check if Website Loads

**What we're testing**: Making sure your website is up and running

**Step-by-step**:

1. **Open your browser** (Chrome or Firefox)
2. **Type this in the address bar**: `https://www.openticket.events`
3. **Press Enter**
4. **Wait 5 seconds**

**✅ What you should see**:
- The OpenTicket homepage with "TICKETS SOLD. VIBES UNCOMPROMISED."
- Two buttons: "START SELLING" and "FIND EVENTS"
- A navigation menu at the top with "Pricing", "Explore", "Sign In"

**❌ If something's wrong**:
- If you see an error page, screenshot it and let me know
- If the page doesn't load after 10 seconds, let me know

---

### ✅ Test 2: Login as Super Admin

**What we're testing**: Making sure you can log in to your admin dashboard

**Step-by-step**:

1. **Click "Sign In"** (top right corner of the homepage)
2. **Where you'll land**: A login page with email and password fields
3. **Type your email**: `tylerans@gmail.com`
4. **Type your password**: `Jevan2908`
5. **Click the "Sign In" button**
6. **Wait 3-5 seconds**

**✅ What you should see**:
- You should be redirected to your dashboard
- You should see your name/email in the top right
- You should see menu options like "Dashboard", "Events", "Analytics"

**❌ If something's wrong**:
- If you get "Invalid credentials", double-check the email and password
- If nothing happens after clicking Sign In, check your internet connection
- Screenshot any error messages you see

---

## 💳 PHASE 2: Stripe Payment Testing

### ✅ Test 3: Create a Test Event

**What we're testing**: Can you create an event and set ticket prices?

**Step-by-step**:

1. **After logging in**, look for a button that says **"Create Event"** or **"New Event"**
   - WHERE: Usually in your dashboard or under "Events" menu
2. **Click "Create Event"**
3. **Fill in these details**:
   - **Event Name**: `TEST - Production Ready Event`
   - **Event Date**: Pick any date in the future (at least 7 days from now)
   - **Ticket Price**: `$100.00`
   - **Event Description**: `This is a test event for production verification`
4. **Click "Create" or "Save Event"**

**✅ What you should see**:
- Success message: "Event created successfully" (or similar)
- Your new event appears in your events list
- The event shows the price as $100.00

**❌ If something's wrong**:
- If you can't find "Create Event" button, look under the main navigation menu
- If you get an error, screenshot it

---

### ✅ Test 4: Buy a Test Ticket (Stripe Payment)

**What we're testing**: Can someone buy a ticket using Stripe?

**Step-by-step**:

1. **Go to your event page**:
   - WHERE: Click on the event you just created ("TEST - Production Ready Event")
   - You should see a "Buy Tickets" or "Get Tickets" button

2. **Click "Buy Tickets" or "Get Tickets"**

3. **Fill in attendee information**:
   - **Name**: `Test User`
   - **Email**: `test@example.com`
   - **Quantity**: `1 ticket`

4. **Click "Proceed to Checkout"** (or similar button)

5. **On the Stripe payment page**, use this TEST card:
   - **Card Number**: `4242 4242 4242 4242`
   - **Expiry Date**: Any future date (e.g., `12/28`)
   - **CVC**: Any 3 digits (e.g., `123`)
   - **ZIP Code**: Any 5 digits (e.g., `10001`)

6. **Click "Pay" or "Complete Purchase"**

7. **Wait 5-10 seconds**

**✅ What you should see**:
- Success page saying "Thank you for your purchase!" or "Order confirmed!"
- An email sent to `test@example.com` with the ticket
- The transaction appears in your admin dashboard

**❌ If something's wrong**:
- If payment fails, make sure you used card `4242 4242 4242 4242`
- If you see "Stripe is not configured", let me know
- Screenshot any error messages

---

### ✅ Test 5: Verify Payment in Stripe Dashboard

**What we're testing**: Did the money show up in Stripe?

**Step-by-step**:

1. **Open a new browser tab**
2. **Go to**: https://dashboard.stripe.com
3. **Log in with your Stripe credentials**
4. **Click "Payments" in the left sidebar**
   - WHERE: Look for a menu item with a dollar sign icon ($) or credit card icon
5. **Look for your $100 payment**
   - It should be at the top of the list (most recent)
   - It should show: **$100.00**
   - Status should be: **Succeeded** (green)

**✅ What you should see**:
- A payment for **$100.00**
- Customer email: `test@example.com`
- Status: **Succeeded**
- Application Fee: Between $5-6 (platform fee)

**❌ If something's wrong**:
- If you don't see the payment, wait 30 seconds and refresh the page
- If the amount is wrong, note what it shows
- If status says "Failed", screenshot it

---

## 🔄 PHASE 3: Refund Testing

### ✅ Test 6: Issue a Partial Refund

**What we're testing**: Can you refund money to a customer?

**Step-by-step**:

1. **In Stripe Dashboard**, stay on the "Payments" page
2. **Click on the $100 payment** you just made
3. **Look for a "Refund" button** (usually top right of the payment details)
4. **Click "Refund"**
5. **A popup will appear asking for the refund amount**:
   - **WHERE**: Look for an input box labeled "Amount"
   - **Type**: `50.00` (partial refund - half the amount)
6. **Click "Refund $50.00"** (or the confirm button)
7. **Wait 5 seconds**

**✅ What you should see**:
- Success message: "Refund successful"
- The payment details page now shows:
  - **Amount Charged**: $100.00
  - **Amount Refunded**: $50.00
  - **Net Amount**: $50.00

**❌ If something's wrong**:
- If there's no "Refund" button, you might not have the right permissions
- If refund fails, screenshot the error message

---

### ✅ Test 7: Verify Refund in Database

**What we're testing**: Is the refund recorded correctly in your database?

**Step-by-step**:

1. **Open a new browser tab**
2. **Go to**: https://dcjdurvgkveblvtinoms.supabase.co
3. **Log in to your Supabase account**
4. **Click "Table Editor"** in the left sidebar
   - WHERE: Look for an icon that looks like a spreadsheet or table
5. **Select the table**: `financial_transactions`
   - WHERE: In the list of tables on the left, click on `financial_transactions`
6. **Look at the most recent rows** (at the top)
7. **Find the refund transaction**:
   - Look for a row where `transaction_type` = `refund`
   - The `gross_amount` should be **-$50.00** (negative number)

**✅ What you should see**:
- **Two rows** for your test purchase:
  1. First row: `transaction_type` = `ticket_sale`, `gross_amount` = `100.00`
  2. Second row: `transaction_type` = `refund`, `gross_amount` = `-50.00`

**❌ If something's wrong**:
- If you don't see a refund row, wait 30 seconds and click the refresh button
- If the amounts don't match, note what they show

---

## 💰 PHASE 4: Payout Testing

### ✅ Test 8: Request Organizer Payout

**What we're testing**: Can organizers request their money?

**Step-by-step**:

1. **Go back to your OpenTicket dashboard**: https://www.openticket.events
2. **Look for "Financials" or "Payouts"** in the main menu
   - WHERE: Check the sidebar or top navigation
3. **Click "Financials" or "Payouts"**
4. **You should see**:
   - **Pending Balance**: The money you're owed
   - **Available to Withdraw**: Amount you can request now
5. **Click "Request Payout"** or "Withdraw" button
6. **Confirm the payout** if a confirmation popup appears

**✅ What you should see**:
- Success message: "Payout requested successfully"
- Your pending balance should update
- Status should change to "Requested" or "Processing"

**❌ If something's wrong**:
- If you can't find the Financials page, let me know
- If there's no money to withdraw, we need to check the earlier steps
- Screenshot any error messages

---

### ✅ Test 9: Check Payout in Stripe

**What we're testing**: Did the payout request reach Stripe?

**Step-by-step**:

1. **Go back to Stripe Dashboard**: https://dashboard.stripe.com
2. **Click "Connect" in the left sidebar**
   - WHERE: Look for "Connect" in the menu (might be under "More+")
3. **Click "Payouts"**
4. **Look for your payout request**
   - It should show your business name
   - Amount should match what you requested
   - Status might be "Pending" or "In Transit"

**✅ What you should see**:
- A payout entry with the correct amount
- Destination: Your connected bank account
- Estimated arrival date

**❌ If something's wrong**:
- If you don't see the payout, refresh after 1 minute
- If amount is wrong, note the difference

---

## 🔒 PHASE 5: Security Testing

### ✅ Test 10: Try Making a Huge Purchase (Should Be Blocked)

**What we're testing**: The system should block suspicious large purchases

**Step-by-step**:

1. **Create another test event** (same as Test 3):
   - Event Name: `TEST - High Price Event`
   - Ticket Price: **$55,000.00** (yes, fifty-five thousand)
2. **Try to buy a ticket** for this event
3. **Go through checkout** with the test card `4242 4242 4242 4242`

**✅ What you SHOULD see**:
- **Error message**: "Transaction amount exceeds maximum allowed ($50,000.00)"
- The purchase should **NOT** go through
- You should **NOT** be charged

**❌ If something's wrong (BAD SIGN)**:
- If the $55,000 purchase succeeds, **STOP IMMEDIATELY** and let me know
- This is a critical security issue that needs fixing

---

### ✅ Test 11: Rate Limiting Test (Spam Protection)

**What we're testing**: The system should block someone trying to spam checkout

**This test is OPTIONAL - only do it if you're comfortable**

**Step-by-step**:

1. **Go to any event page**
2. **Click "Buy Tickets"** and go to checkout
3. **Click "Complete Purchase"** button
4. **Quickly click the browser back button**
5. **Repeat steps 2-4 about 12 times rapidly** (trying to spam the system)

**✅ What you SHOULD see**:
- After about 10 attempts, you should see:
- **Error message**: "Too many checkout attempts. Please try again later."
- You should be temporarily blocked for about 15 minutes

**❌ If something's wrong**:
- If you can make unlimited attempts without being blocked, let me know
- If you get blocked after just 2-3 attempts, that's too strict - let me know

---

## 📊 PHASE 6: Financial Accuracy Testing

### ✅ Test 12: Verify the Math is Correct

**What we're testing**: When you sell a $100 ticket, does the money split correctly?

**Step-by-step**:

1. **Go to Supabase**: https://dcjdurvgkveblvtinoms.supabase.co
2. **Table Editor → financial_transactions**
3. **Find your original $100 ticket sale** (not the refund)
4. **Write down these numbers**:
   - `gross_amount`: Should be **100.00**
   - `platform_fee`: Should be around **5.49** (5.49%)
   - `stripe_fee`: Should be around **3.20** (2.9% + $0.30)
   - `organizer_net`: Should be around **91.31**

5. **Check the math**:
   - Add up: `platform_fee` + `stripe_fee` + `organizer_net`
   - Does it equal `gross_amount`?

**✅ What you should see**:
- ✅ `5.49 + 3.20 + 91.31 = 100.00` (or within 2 cents)
- The numbers should add up perfectly

**❌ If something's wrong**:
- If the numbers don't add up (difference more than $0.02), note the amounts
- If any field is empty or null, screenshot it

---

## 🎫 PHASE 7: End-to-End Customer Experience

### ✅ Test 13: Complete Customer Journey (As a Real User)

**What we're testing**: The full experience from finding an event to getting a ticket

**Step-by-step**:

1. **Open a NEW browser** (or incognito window)
   - WHY: So you're not logged in as admin
2. **Go to**: https://www.openticket.events
3. **Click "FIND EVENTS"**
4. **Find your test event**: "TEST - Production Ready Event"
5. **Click on the event** to view details
6. **Click "Buy Tickets" or "Get Tickets"**
7. **Fill in YOUR real email address** (so you get the ticket)
   - Name: Your real name
   - Email: Your real email
8. **Complete payment** with test card `4242 4242 4242 4242`
9. **After payment succeeds**:
   - Check your email inbox
   - Look for an email from OpenTicket

**✅ What you should see**:
- ✅ Clear event details page
- ✅ Easy checkout process
- ✅ Success page after payment
- ✅ Email with ticket/confirmation within 2 minutes
- ✅ The email should have:
  - Event name and date
  - Your ticket QR code or ticket number
  - Instructions for the event

**❌ If something's wrong**:
- If no email arrives after 5 minutes, check spam folder
- If the email looks broken or unprofessional, screenshot it
- If anything in the process feels confusing, note it down

---

## 📧 PHASE 8: Email Testing

### ✅ Test 14: Check Ticket Confirmation Email

**What we're testing**: Do customers get professional, working emails?

**Step-by-step**:

1. **Open your email inbox** (the one you used in Test 13)
2. **Find the email from OpenTicket**
3. **Check these things**:
   - [ ] Email has OpenTicket branding/logo
   - [ ] Event name is correct
   - [ ] Event date and time are correct
   - [ ] Ticket price shows correctly
   - [ ] There's a QR code or ticket ID
   - [ ] There's a link to view the ticket online
   - [ ] Email doesn't look "broken" (no weird formatting)
   - [ ] All images load properly

4. **Click any links in the email** to make sure they work

**✅ What you should see**:
- Professional email that looks good
- All information is correct
- Links work and take you to the right pages
- QR code is visible and clear

**❌ If something's wrong**:
- If email looks unprofessional or broken, forward it to yourself and screenshot it
- If links don't work, note which ones
- If QR code is missing, let me know

---

## 🎉 FINAL CHECKLIST

After completing all tests above, fill this out:

### Core Functionality
- [ ] ✅ Website loads correctly
- [ ] ✅ Login works
- [ ] ✅ Can create events
- [ ] ✅ Can buy tickets with Stripe
- [ ] ✅ Payments show in Stripe dashboard
- [ ] ✅ Can issue refunds
- [ ] ✅ Refunds recorded in database
- [ ] ✅ Can request payouts
- [ ] ✅ Emails arrive and look good

### Security
- [ ] ✅ Large purchases ($55k) are blocked
- [ ] ✅ Rate limiting prevents spam
- [ ] ✅ Financial math is correct (within 2 cents)

### User Experience
- [ ] ✅ Checkout process is smooth
- [ ] ✅ Confirmation emails are professional
- [ ] ✅ No confusing error messages
- [ ] ✅ Everything works on mobile (optional: test on your phone)

---

## 🚨 If You Find Issues

**For each problem, tell me**:
1. **Which test** were you doing? (Test number and name)
2. **What did you do?** (Step-by-step what you clicked)
3. **What happened?** (The error or unexpected behavior)
4. **Screenshot** (If possible, take a screenshot)

**Example**:
> "Test 4 - Buy a Test Ticket. I clicked 'Buy Tickets', filled in my info, used card 4242... but when I clicked 'Pay', I got error 'Stripe not configured'. Screenshot attached."

---

## ✅ If Everything Works

**Great! Your platform is production-ready!**

**Next steps**:
1. Switch Stripe from Test mode to Live mode (I can help with this)
2. Update your domain/branding if needed
3. Start promoting your events!

---

## 📞 Quick Reference

**Your website**: https://www.openticket.events  
**Stripe Dashboard**: https://dashboard.stripe.com  
**Supabase Dashboard**: https://dcjdurvgkveblvtinoms.supabase.co  

**Test Card**: 4242 4242 4242 4242 (Expiry: any future date, CVC: 123)  

**Your admin login**:  
- Email: tylerans@gmail.com  
- Password: Jevan2908  

---

**Document Version**: 2.0 - Beginner Friendly  
**Last Updated**: February 21, 2026  
**Estimated Time**: 2-3 hours (take breaks!)
