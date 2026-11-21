import { issueReceipt } from "./receipt_sender.ts";

const customerEmail = process.env.RECEIPT_RECIPIENT;
if (!customerEmail) throw new Error("RECEIPT_RECIPIENT is required");

const result = await issueReceipt({
  orderId: "ord_1042",
  customerEmail,
  customerName: "Mina Chen",
  items: [{ name: "Desk lamp", quantity: 1, amountCents: 4800 }],
  currency: "USD"
});

console.log(JSON.stringify(result, null, 2));
