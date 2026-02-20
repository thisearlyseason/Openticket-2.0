/**
 * Migration Script: Populate type field in financial_transactions
 * Run this once to backfill existing data
 */
import supabase from '../services/supabase.js';

async function migrateTransactionTypes() {
    console.log('Starting migration: Populating type field in financial_transactions...\n');

    try {
        // Fetch all transactions without type
        const { data: transactions, error: fetchError } = await supabase
            .from('financial_transactions')
            .select('id, transaction_type, type')
            .is('type', null);

        if (fetchError) throw fetchError;

        console.log(`Found ${transactions?.length || 0} transactions to update\n`);

        if (!transactions || transactions.length === 0) {
            console.log('✅ No transactions need updating');
            return;
        }

        // Update transactions in batches
        let updated = 0;
        const batchSize = 50;

        for (let i = 0; i < transactions.length; i += batchSize) {
            const batch = transactions.slice(i, i + batchSize);
            
            for (const tx of batch) {
                let type = 'event'; // Default

                // Determine type based on transaction_type
                if (tx.transaction_type === 'ticket_sale') {
                    type = 'event';
                } else if (tx.transaction_type === 'subscription') {
                    type = 'subscription';
                } else if (tx.transaction_type === 'platform_fee') {
                    type = 'platform_fee';
                } else if (tx.transaction_type === 'refund') {
                    type = 'event'; // Refunds are still event-related
                }

                const { error: updateError } = await supabase
                    .from('financial_transactions')
                    .update({ type })
                    .eq('id', tx.id);

                if (updateError) {
                    console.error(`❌ Error updating transaction ${tx.id}:`, updateError);
                } else {
                    updated++;
                }
            }

            console.log(`Progress: ${Math.min(i + batchSize, transactions.length)}/${transactions.length}`);
        }

        console.log(`\n✅ Migration complete: ${updated} transactions updated`);
    } catch (error) {
        console.error('❌ Migration failed:', error);
        throw error;
    }
}

// Run migration
migrateTransactionTypes()
    .then(() => {
        console.log('\n✅ Migration successful');
        process.exit(0);
    })
    .catch((error) => {
        console.error('\n❌ Migration failed:', error);
        process.exit(1);
    });
