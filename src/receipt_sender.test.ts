import assert from "node:assert/strict";
import { parseCheckout } from "./receipt_sender.ts";

const checkout = parseCheckout({
  orderId: "ord_test",
  customerEmail: "buyer@example.com",
  customerName: "Test Buyer",
  items: [{ name: "Notebook", quantity: 2, amountCents: 700 }],
  currency: "USD"
});

assert.equal(checkout.items[0].quantity * checkout.items[0].amountCents, 1400);
assert.throws(() => parseCheckout({ ...checkout, customerEmail: "not-an-email" }));
console.log("receipt boundary: valid checkout totals 1400 cents; invalid email is rejected");
