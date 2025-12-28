import { EmailService } from '../backend/services/emailService.js';

// Mock Data
const event = {
    title: "Test Event 2024",
    date: new Date().toISOString(),
    location: "123 Test St, Tech City"
};

const tickets = [
    { id: "tkt-123", name: "VIP Pass", tierId: "vip", attendeeName: "John Doe" },
    { id: "tkt-124", name: "General Admission", tierId: "ga", attendeeName: "Jane Doe" }
];

console.log("Running Email Service Test...");
EmailService.sendConfirmation("test@example.com", tickets, event)
    .then(result => {
        console.log("Test Result:", result ? "SUCCESS" : "FAILURE");
    })
    .catch(err => {
        console.error("Test Error:", err);
    });
