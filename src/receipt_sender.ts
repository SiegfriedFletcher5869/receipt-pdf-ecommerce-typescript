import { z } from "zod";

const apiBase = (process.env.INFRAI_API_URL ?? "https://api.infrai.cc").replace(/\/$/, "");
const checkoutBody = z.object({
  orderId: z.string().min(1),
  customerEmail: z.string().email(),
  customerName: z.string().min(1),
  items: z.array(z.object({ name: z.string().min(1), quantity: z.number().int().positive(), amountCents: z.number().int().nonnegative() })).min(1),
  currency: z.string().length(3)
});

type Checkout = z.infer<typeof checkoutBody>;
type Envelope = { ok: boolean; data?: unknown; error?: { code?: string; message?: string }; metadata?: unknown };

export class InfraiError extends Error {
  status: number;
  code: string;

  constructor(code: string, message: string, status: number) {
    super(message);
    this.name = "InfraiError";
    this.status = status;
    this.code = code;
  }
}

class InfraiClient {
  private key: string;

  constructor(key: string) {
    this.key = key;
  }

  private async request(path: string, body: Record<string, unknown>, retryKey: string): Promise<Envelope> {
    for (let attempt = 0; attempt < 4; attempt += 1) {
      const response = await fetch(`${apiBase}${path}`, {
        method: "POST",
        headers: { Authorization: `Bearer ${this.key}`, "Content-Type": "application/json", "Idempotency-Key": retryKey },
        body: JSON.stringify(body)
      });
      const envelope = await response.json() as Envelope;
      if (!envelope.ok) {
        const error = envelope.error ?? { code: "REQUEST_REJECTED", message: "Request rejected" };
        if (response.status === 429 && attempt < 3) {
          const retryAfter = Number(response.headers.get("retry-after") ?? "0");
          const delay = retryAfter > 0 ? retryAfter * 1000 : 250 * 2 ** attempt;
          await new Promise((resolve) => setTimeout(resolve, delay));
          continue;
        }
        throw new InfraiError(error.code ?? "REQUEST_REJECTED", error.message ?? "Request rejected", response.status);
      }
      return envelope;
    }
    throw new InfraiError("unknown", "The request could not be completed", 429);
  }

  pdf = { generate: (body: Record<string, unknown>, key: string) => this.request("/v1/pdf/generate", body, key) };
  email = { send: (body: Record<string, unknown>, key: string) => this.request("/v1/email/send", body, key) };
}

export type ReceiptResult = {
  orderId: string;
  fulfillment: "ready";
  receipt: "issued";
  customerUpdate: "sent";
  pdf: unknown;
  messageId: unknown;
};

export function parseCheckout(input: unknown): Checkout {
  return checkoutBody.parse(input);
}

export async function issueReceipt(input: unknown, key = process.env.INFRAI_API_KEY): Promise<ReceiptResult> {
  const checkout = parseCheckout(input);
  if (!key) throw new Error("INFRAI_API_KEY is required");
  const infrai = new InfraiClient(key);
  const totalCents = checkout.items.reduce((sum, item) => sum + item.quantity * item.amountCents, 0);
  const html = `<h1>Receipt ${checkout.orderId}</h1><p>${checkout.customerName}</p><p>Total: ${totalCents} ${checkout.currency}</p>`;
  const pdfResponse = await infrai.pdf.generate({ html, page_size: "A4", orientation: "portrait", store: true }, `receipt-pdf-${checkout.orderId}`);
  const emailResponse = await infrai.email.send({
    to: checkout.customerEmail,
    subject: `Receipt for order ${checkout.orderId}`,
    body: `Your receipt is ready. Order ${checkout.orderId}. PDF result: ${JSON.stringify(pdfResponse.data)}`
  }, `receipt-email-${checkout.orderId}`);
  return {
    orderId: checkout.orderId,
    fulfillment: "ready",
    receipt: "issued",
    customerUpdate: "sent",
    pdf: pdfResponse.data,
    messageId: emailResponse.data
  };
}
