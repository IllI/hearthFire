import Stripe from 'stripe';
import { buffer } from 'micro';

// This function initializes Stripe and returns a handler for processing webhooks.
// It expects a `db` object with methods for interacting with the database.
export const createWebhookHandler = (db) => {
  const stripe = new Stripe(process.env.STRIPE_SECRET_KEY);
  const webhookSecret = process.env.STRIPE_WEBHOOK_SECRET;

  return async (req, res) => {
    if (req.method !== 'POST') {
      return res.status(405).json({ error: 'Method not allowed' });
    }

    try {
      const buf = await buffer(req);
      const signature = req.headers['stripe-signature'];

      // 1. Validate signature
      let event;
      try {
        if (webhookSecret) {
          event = stripe.webhooks.constructEvent(buf, signature, webhookSecret);
        } else {
          event = JSON.parse(buf.toString());
          console.warn('⚠️ Webhook signature verification disabled. Set STRIPE_WEBHOOK_SECRET for production.');
        }
      } catch (err) {
        console.error(`Webhook signature verification failed: ${err.message}`);
        return res.status(400).json({ error: `Webhook Error: ${err.message}` });
      }

      // 2. Handle the event
      switch (event.type) {
        case 'payment_intent.succeeded':
          const paymentIntent = event.data.object;
          console.log(`Payment intent ${paymentIntent.id} succeeded`);
          await db.updateOrderByPaymentIntent(paymentIntent.id, { paymentStatus: 'paid' });
          break;

        case 'payment_intent.payment_failed':
          const failedPayment = event.data.object;
          console.log(`Payment failed for intent ${failedPayment.id}. Reason: ${failedPayment.last_payment_error?.message || 'Unknown'}`);
          await db.updateOrderByPaymentIntent(failedPayment.id, { paymentStatus: 'failed' });
          break;

        default:
          console.log(`Unhandled event type ${event.type}`);
      }

      res.status(200).json({ received: true });
    } catch (err) {
      console.error(`Webhook error: ${err.message}`);
      res.status(500).json({ error: `Webhook Error: ${err.message}` });
    }
  };
};