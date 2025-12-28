
import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
dotenv.config();

const supabaseUrl = process.env.SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl || !supabaseKey) {
    console.error("Missing Supabase URL or Key");
    process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseKey);

async function auditDataIntegrity() {
    console.log("Starting Data Integrity Audit...");

    const { data: regs, error } = await supabase
        .from('registrations')
        .select('*');

    if (error) {
        console.error("Supabase Error:", error);
        return;
    }

    let issuesFound = 0;

    regs.forEach(r => {
        const issues = [];

        // Check 1: Paid but no Payment Intent (unless free)
        if (r.payment_status === 'paid' && r.total_amount > 0 && !r.stripe_payment_intent_id) {
            issues.push("PAID status but MISSING stripe_payment_intent_id");
        }

        // Check 2: Paid but Tickets are invalid/pending
        if (r.payment_status === 'paid') {
            const tickets = r.tickets || [];
            if (!Array.isArray(tickets) || tickets.length === 0) {
                issues.push("PAID status but NO TICKETS array");
            } else {
                const invalidTickets = tickets.filter(t => !t.id || t.status !== 'valid');
                if (invalidTickets.length > 0) {
                    issues.push(`PAID status but ${invalidTickets.length} tickets are INVALID/PENDING`);
                }
            }
        }

        // Check 3: Orphaned Session? (Pending for > 24 hours)
        if (r.payment_status === 'pending_payment') {
            const created = new Date(r.created_at || Date.now()); // fallback if missing
            const ageHours = (Date.now() - created.getTime()) / (1000 * 60 * 60);
            if (ageHours > 24) {
                // Not an issue per se, but good to know
                // issues.push(`Stale Pending Registration (> 24h old)`);
            }
        }

        if (issues.length > 0) {
            issuesFound++;
            console.log(`\n[ISSUE] Registration ${r.id} (${r.attendee_email}):`);
            issues.forEach(i => console.log(` - ${i}`));
        }
    });

    if (issuesFound === 0) {
        console.log("\n✅ Data Integrity Check Passed: No logical inconsistencies found.");
    } else {
        console.log(`\n❌ Found issues in ${issuesFound} registrations.`);
    }
}

auditDataIntegrity();
