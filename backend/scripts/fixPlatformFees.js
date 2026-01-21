/**
 * DATA MIGRATION SCRIPT
 * Purpose: Fix historical financial transactions with incorrect platform fees
 * 
 * This script:
 * 1. Identifies transactions with platform_fee = 0 but should have a fee
 * 2. Recalculates correct platform fees based on event settings
 * 3. Updates financial_transactions and registrations tables
 * 
 * Run with: node /app/backend/scripts/fixPlatformFees.js
 */

import supabase from '../services/supabase.js';

// Platform fee calculation logic (copied from priceCalculator.js)
function calculatePlatformFee(amount, plan = 'free') {
    // Platform fee structure by plan
    const feeRates = {
        free: { percentage: 0.045, fixed: 0.99 },     // 4.5% + $0.99
        starter: { percentage: 0.035, fixed: 0.79 },  // 3.5% + $0.79
        pro: { percentage: 0.025, fixed: 0.59 },      // 2.5% + $0.59
        enterprise: { percentage: 0.015, fixed: 0.39 } // 1.5% + $0.39
    };

    const rate = feeRates[plan] || feeRates.free;
    const fee = (amount * rate.percentage) + rate.fixed;
    return Number(fee.toFixed(2));
}

async function fixPlatformFees() {
    console.log('🔍 Starting platform fee data migration...\n');

    try {
        // Step 1: Find all problematic transactions
        console.log('Step 1: Identifying transactions with missing platform fees...');
        
        const { data: transactions, error: txError } = await supabase
            .from('financial_transactions')
            .select(`
                id,
                registration_id,
                event_id,
                gross_amount,
                platform_fee,
                stripe_fee,
                organizer_net,
                transaction_type,
                registrations!inner(
                    id,
                    service_fee,
                    organizer_absorbed_fee,
                    events!inner(
                        id,
                        price_type,
                        absorb_fees,
                        owner_id,
                        profiles!inner(
                            id,
                            subscription
                        )
                    )
                )
            `)
            .eq('transaction_type', 'ticket_sale')
            .gt('gross_amount', 0)
            .eq('platform_fee', 0);

        if (txError) {
            console.error('❌ Error fetching transactions:', txError);
            return;
        }

        console.log(`Found ${transactions.length} transactions with missing platform fees\n`);

        if (transactions.length === 0) {
            console.log('✅ No transactions need fixing. Database is clean!');
            return;
        }

        // Step 2: Process each transaction
        let fixedCount = 0;
        let skippedCount = 0;
        let errorCount = 0;

        for (const tx of transactions) {
            const event = tx.registrations.events;
            const profile = event.profiles;
            
            // Skip free events
            if (event.price_type === 'free') {
                skippedCount++;
                continue;
            }

            // Extract plan from subscription JSONB field
            const organizerPlan = profile.subscription?.plan || 'free';
            const grossAmount = tx.gross_amount;
            const correctPlatformFee = calculatePlatformFee(grossAmount, organizerPlan);
            
            // Calculate corrected organizer net
            const stripeFee = tx.stripe_fee || 0;
            const correctedOrganizerNet = grossAmount - correctPlatformFee - stripeFee;

            console.log(`📝 Transaction ${tx.id}:`);
            console.log(`   Event: ${event.id} (${event.price_type})`);
            console.log(`   Organizer Plan: ${organizerPlan}`);
            console.log(`   Gross: $${grossAmount}`);
            console.log(`   Platform Fee: $0 → $${correctPlatformFee} ✅`);
            console.log(`   Absorb Fees: ${event.absorb_fees}`);
            console.log(`   Organizer Net: $${tx.organizer_net} → $${correctedOrganizerNet.toFixed(2)}`);

            try {
                // Update financial_transactions
                const { error: updateTxError } = await supabase
                    .from('financial_transactions')
                    .update({
                        platform_fee: correctPlatformFee,
                        organizer_absorbed_fee: event.absorb_fees || false,
                        organizer_net: correctedOrganizerNet
                    })
                    .eq('id', tx.id);

                if (updateTxError) {
                    console.error(`   ❌ Failed to update transaction: ${updateTxError.message}`);
                    errorCount++;
                    continue;
                }

                // Update registration
                const { error: updateRegError } = await supabase
                    .from('registrations')
                    .update({
                        service_fee: correctPlatformFee,
                        organizer_absorbed_fee: event.absorb_fees || false
                    })
                    .eq('id', tx.registration_id);

                if (updateRegError) {
                    console.error(`   ⚠️  Updated transaction but failed to update registration: ${updateRegError.message}`);
                }

                console.log(`   ✅ Fixed!\n`);
                fixedCount++;

            } catch (err) {
                console.error(`   ❌ Error: ${err.message}\n`);
                errorCount++;
            }
        }

        // Step 3: Summary
        console.log('\n' + '='.repeat(60));
        console.log('📊 MIGRATION SUMMARY');
        console.log('='.repeat(60));
        console.log(`Total Transactions Found: ${transactions.length}`);
        console.log(`✅ Successfully Fixed: ${fixedCount}`);
        console.log(`⏭️  Skipped (Free Events): ${skippedCount}`);
        console.log(`❌ Errors: ${errorCount}`);
        console.log('='.repeat(60) + '\n');

        if (fixedCount > 0) {
            console.log('✅ Migration completed successfully!');
            console.log('💡 Recommendation: Verify financial reports to ensure accuracy.\n');
        }

    } catch (error) {
        console.error('❌ Fatal error during migration:', error);
    }
}

// Run the migration
fixPlatformFees().then(() => {
    console.log('🏁 Script finished.');
    process.exit(0);
}).catch(error => {
    console.error('💥 Unhandled error:', error);
    process.exit(1);
});
