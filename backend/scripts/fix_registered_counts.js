/**
 * Fix Script: Recalculate registered_count for all events
 * 
 * This script:
 * 1. Fetches all events
 * 2. For each event, counts actual non-refunded tickets
 * 3. Updates registered_count to match reality
 * 
 * Run this ONCE to fix existing data after refund bug fix is deployed
 */

import supabase from '../services/supabase.js';

async function recalculateRegisteredCounts() {
    console.log('🔧 Starting registered_count recalculation...\n');

    try {
        // 1. Fetch all events
        const { data: events, error: eventsError } = await supabase
            .from('events')
            .select('id, title, registered_count');

        if (eventsError) {
            console.error('Error fetching events:', eventsError);
            return;
        }

        console.log(`Found ${events.length} events to process\n`);

        let fixed = 0;
        let unchanged = 0;
        let errors = 0;

        // 2. Process each event
        for (const event of events) {
            try {
                // Fetch all registrations for this event
                const { data: registrations, error: regError } = await supabase
                    .from('registrations')
                    .select('id, payment_status, tickets')
                    .eq('event_id', event.id);

                if (regError) {
                    console.error(`❌ Error fetching registrations for event ${event.title}:`, regError.message);
                    errors++;
                    continue;
                }

                // Count actual non-refunded tickets
                let actualCount = 0;
                registrations.forEach(reg => {
                    // Only count paid/completed registrations that aren't refunded
                    if (reg.payment_status === 'paid' || reg.payment_status === 'completed') {
                        if (reg.tickets && Array.isArray(reg.tickets)) {
                            reg.tickets.forEach(ticket => {
                                // Count ticket if not refunded
                                if (ticket.status !== 'refunded') {
                                    actualCount += ticket.quantity || 1;
                                }
                            });
                        } else {
                            // Legacy: no ticket breakdown, count as 1
                            actualCount += 1;
                        }
                    }
                });

                const currentCount = event.registered_count || 0;

                if (actualCount !== currentCount) {
                    // Update the count
                    const { error: updateError } = await supabase
                        .from('events')
                        .update({ registered_count: actualCount })
                        .eq('id', event.id);

                    if (updateError) {
                        console.error(`❌ Error updating event ${event.title}:`, updateError.message);
                        errors++;
                    } else {
                        console.log(`✅ Fixed: "${event.title}" - ${currentCount} → ${actualCount} (${actualCount - currentCount > 0 ? '+' : ''}${actualCount - currentCount})`);
                        fixed++;
                    }
                } else {
                    console.log(`✓ OK: "${event.title}" - ${currentCount} tickets (no change needed)`);
                    unchanged++;
                }

            } catch (err) {
                console.error(`❌ Error processing event ${event.title}:`, err.message);
                errors++;
            }
        }

        // 3. Summary
        console.log('\n' + '='.repeat(60));
        console.log('📊 RECALCULATION COMPLETE');
        console.log('='.repeat(60));
        console.log(`Total events processed: ${events.length}`);
        console.log(`✅ Fixed: ${fixed}`);
        console.log(`✓ Already correct: ${unchanged}`);
        console.log(`❌ Errors: ${errors}`);
        console.log('='.repeat(60));

    } catch (error) {
        console.error('Fatal error:', error);
    }
}

// Run if executed directly
if (import.meta.url === `file://${process.argv[1]}`) {
    recalculateRegisteredCounts()
        .then(() => {
            console.log('\n✅ Script completed');
            process.exit(0);
        })
        .catch(err => {
            console.error('\n❌ Script failed:', err);
            process.exit(1);
        });
}

export default recalculateRegisteredCounts;
