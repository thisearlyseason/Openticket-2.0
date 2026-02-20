/**
 * Migration Script: Populate type field in financial_transactions
 * Run this once to backfill existing data after adding the 'type' column to the schema.
 * 
 * PREREQUISITE: Run this SQL in Supabase SQL Editor first:
 *   ALTER TABLE financial_transactions ADD COLUMN IF NOT EXISTS type TEXT;
 */
import supabase from '../services/supabase.js';

export async function migrateTransactionTypes() {
    console.log('Starting migration: Populating type field in financial_transactions...\n');

    // First check if 'type' column exists
    const { error: checkError } = await supabase
        .from('financial_transactions')
        .select('type')
        .limit(1);

    if (checkError && (checkError.message?.includes('column') || checkError.message?.includes('"type"'))) {
        const sql = `ALTER TABLE financial_transactions ADD COLUMN IF NOT EXISTS type TEXT;\n\nUPDATE financial_transactions SET type = CASE\n    WHEN transaction_type IN ('ticket_sale', 'checkin_payment', 'at_door_payment') THEN 'event'\n    WHEN transaction_type IN ('subscription', 'smm_subscription') THEN 'subscription'\n    WHEN transaction_type = 'platform_fee' THEN 'platform_fee'\n    WHEN transaction_type = 'refund' THEN 'refund'\n    ELSE 'event'\nEND WHERE type IS NULL;`;
        console.error('ERROR: "type" column does not exist in financial_transactions.');
        console.error('Please run the following SQL in your Supabase SQL Editor first:');
        console.error(sql);
        return { success: false, columnExists: false, sql };
    }

    try {
        const { data: transactions, error: fetchError } = await supabase
            .from('financial_transactions')
            .select('id, transaction_type, type')
            .or('type.is.null,type.eq.unknown');

        if (fetchError) throw fetchError;

        console.log(`Found ${transactions?.length || 0} transactions to update\n`);

        if (!transactions || transactions.length === 0) {
            console.log('No transactions need updating');
            return { success: true, updated: 0 };
        }

        const typeMap = {
            'ticket_sale': 'event',
            'checkin_payment': 'event',
            'at_door_payment': 'event',
            'subscription': 'subscription',
            'smm_subscription': 'subscription',
            'platform_fee': 'platform_fee',
            'refund': 'refund'
        };

        let updated = 0;
        const batchSize = 50;

        for (let i = 0; i < transactions.length; i += batchSize) {
            const batch = transactions.slice(i, i + batchSize);
            
            for (const tx of batch) {
                const type = typeMap[tx.transaction_type] || 'event';
                const { error: updateError } = await supabase
                    .from('financial_transactions')
                    .update({ type })
                    .eq('id', tx.id);

                if (updateError) {
                    console.error(`Error updating transaction ${tx.id}:`, updateError);
                } else {
                    updated++;
                }
            }

            console.log(`Progress: ${Math.min(i + batchSize, transactions.length)}/${transactions.length}`);
        }

        console.log(`\nMigration complete: ${updated} transactions updated`);
        return { success: true, updated };
    } catch (error) {
        console.error('Migration failed:', error);
        throw error;
    }
}

// Allow direct execution
if (import.meta.url === `file://${process.argv[1]}`) {
    migrateTransactionTypes()
        .then(result => {
            console.log('Result:', result);
            process.exit(result.success ? 0 : 1);
        })
        .catch(error => {
            console.error('Migration failed:', error);
            process.exit(1);
        });
}
