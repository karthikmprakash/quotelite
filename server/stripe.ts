import Stripe from "stripe";

export function stripeClient(secret: string): Stripe {
  const host = process.env.STRIPE_API_HOST;
  if (!host) return new Stripe(secret);
  const url = new URL(host);
  const protocol = url.protocol === "https:" ? "https" : "http";
  return new Stripe(secret, {
    host: url.hostname,
    port: Number(url.port || (protocol === "https" ? 443 : 80)),
    protocol,
  });
}

export async function chargeTestCard(input: {
  secret: string;
  amountCents: number;
  invoiceId: string;
  idempotencyKey: string;
  paymentMethod: string;
}) {
  const stripe = stripeClient(input.secret);
  const params: Stripe.PaymentIntentCreateParams = {
    amount: input.amountCents,
    currency: "usd",
    payment_method: input.paymentMethod,
    confirm: true,
    automatic_payment_methods: { enabled: true, allow_redirects: "never" },
    metadata: { invoiceId: input.invoiceId },
  };
  const intent = await stripe.paymentIntents.create(params, { idempotencyKey: input.idempotencyKey });
  return intent;
}
