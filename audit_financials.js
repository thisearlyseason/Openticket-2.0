
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

async function auditFinancials() {
    console.log("Connecting via Supabase SDK...");

    const { data: regs, error } = await supabase
        .from('registrations')
        .select(`
            id, 
            attendee_name, 
            attendee_email, 
            payment_status,
            total_amount,
            service_fee,
            tax_amount,
            custom_fees_amount,
            tickets, 
            add_ons,
            created_at
        `)
        .order('created_at', { ascending: false })
        .limit(5);

    if (error) {
        console.error("Supabase Error:", error);
        return;
    }

    console.log("=== LATEST 5 FINANCIAL RECORDS (REMOTE) ===");
    regs.forEach(r => {
        console.log(`\nID: ${r.id}`);
        console.log(`Created: ${r.created_at}`);
        console.log(`User: ${r.attendee_name} (${r.attendee_email})`);
        console.log(`Status: ${r.payment_status}`);
        console.log(`Total Amount (Field): ${r.total_amount}`);
        console.log(`Service Fee: ${r.service_fee}`);
        console.log(`Tax: ${r.tax_amount}`);
        console.log(`Custom Fees: ${r.custom_fees_amount}`);

        // Calc check
        const tickets = Array.isArray(r.tickets) ? r.tickets : [];
        const addOns = Array.isArray(r.add_ons) ? r.add_ons : [];

        let calcTicketSum = 0;
        tickets.forEach(t => calcTicketSum += (Number(t.pricePerTicket) || 0) * (Number(t.quantity) || 1));

        let calcAddonSum = 0;
        addOns.forEach(a => calcAddonSum += (Number(a.price) || 0) * (Number(a.quantity) || 0));

        const calcGross = calcTicketSum + calcAddonSum + Number(r.custom_fees_amount || 0) + Number(r.tax_amount || 0) + Number(r.service_fee || 0);

        console.log(`Calculated Ticket Sum: ${calcTicketSum}`);
        console.log(`Calculated Addon Sum: ${calcAddonSum}`);
        console.log(`Calculated Total (Sum of Parts): ${calcGross}`);
        console.log(`Discrepancy: ${Number(r.total_amount) - calcGross}`);
    });
}

auditFinancials();
