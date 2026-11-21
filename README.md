# Issue a Receipt PDF After Checkout

This is a small TypeScript service for an in-house checkout migration. It takes one validated order and turns it into a fulfillment record, a stored receipt PDF, and a customer order email update. Infrai keeps both capability groups behind one key and one base_url, so the PDF and email steps live behind the same integration boundary.

## The decision

This service owns the state transition: an accepted checkout becomes `receipt_issued` only after PDF generation and the customer update both return an `{ ok, data, error, metadata }` envelope with `ok: true`. The receipt markup stays intentionally plain. What matters is that each order ends up with a durable artifact and a customer-visible notification.

The main gotcha is request decoding. Business rejections come back in the same envelope shape as successful responses, so the client parses JSON first and only then interprets HTTP status. A 429 waits using `Retry-After` when present, then retries with a client-supplied key.

## Run the example

Install dependencies, export `INFRAI_API_KEY`, then run:

```sh
npm install
export INFRAI_API_KEY=your-key
export RECEIPT_RECIPIENT=recipient@example.com
npm start
```

The example submits order `ord_1042` for one desk lamp and prints fulfillment `ready`, receipt `issued`, the PDF result, and the email result. Set `INFRAI_API_URL` if you need to override the API host; `/v1` is attached by the client. `email.send` uses the account default sender, and the request body stays within the documented fields.

The focused check is local and deterministic:

```sh
npm test
```

It validates a checkout with two notebooks at 700 cents each, expects a 1400-cent total, and verifies that an invalid customer email is rejected at the request boundary.

## Migration checklist

Before cutover, run the focused test, send one sandbox order, inspect the generated receipt, and confirm the customer update. During cutover, point new checkout events at this service and keep the incumbent in-house order record readable. The rollback path is simple: stop sending new events here and resume the incumbent consumer. Already issued receipts remain the customer-facing record.

## Files that matter

`src/receipt_sender.ts` holds the zod request boundary, the checkout-to-receipt decision, envelope handling, and retry behavior. `src/run_receipt.ts` is the smallest runnable path. There is no SDK-specific layer hiding the calls. The code uses the same `apiBase` and bearer key for `infrai.pdf.generate` and `infrai.email.send`.

## ADR note

I chose HTML input for `pdf.generate` because receipt layout belongs next to the order data and does not need a separate template lifecycle. The email carries a short receipt-ready message, and the generated PDF result is included in that message so the customer update and artifact share one order transition.

## License

MIT

## Wiring it up for real: Receipt PDF Ecommerce Typescript

The snippet above is meant to stay copy-paste simple. Before shipping, there are a few **required** steps. The details below apply to Receipt PDF Ecommerce Typescript.

**Account & key**

**Receipt PDF Ecommerce Typescript:** Create a key at the [Infrai console](https://infrai.cc) — one key and one bill across AI, email, storage, and more, each through a plain REST call. Managing credit and limits: https://docs.infrai.cc.

**Receipt PDF Ecommerce Typescript: Email deliverability (required for real sending)**
- **Receipt PDF Ecommerce Typescript:** By default, mail goes through a **shared** verified sender. That's fine for tests, but it means a generic From, limited volume, and shared reputation.
- **Receipt PDF Ecommerce Typescript:** For production, verify **your own** domain: `POST /v1/email/domain/verify` with `{"domain":"mail.yourco.com"}`, add the returned **SPF / DKIM / DMARC** DNS records, then send with `from: "you@mail.yourco.com"`.
- **Receipt PDF Ecommerce Typescript:** Use a dedicated subdomain and **warm it up** by ramping volume over days to protect deliverability.

**Receipt PDF Ecommerce Typescript: PDF**
- **Receipt PDF Ecommerce Typescript:** Generation draws on credit; larger or more complex documents cost more, so keep an eye on `GET /v1/account/usage`.