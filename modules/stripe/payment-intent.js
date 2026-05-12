import Stripe from 'stripe';

// This function initializes Stripe and returns a handler for creating a payment intent.
// It expects a `db` object with methods for interacting with the database.
export const createPaymentIntentHandler = (db) => {
  const stripe = new Stripe(process.env.STRIPE_SECRET_KEY);

  return async (req, res) => {
    if (req.method !== 'POST') {
      res.setHeader('Allow', ['POST']);
      return res.status(405).json({ error: `Method ${req.method} Not Allowed` });
    }

    try {
      // 1. Verify authentication
      const authHeader = req.headers.authorization;
      if (!authHeader || !authHeader.startsWith('Bearer ')) {
        return res.status(401).json({ error: 'Unauthorized' });
      }
      const token = authHeader.split('Bearer ')[1];
      const { uid: userId } = await db.verifyIdToken(token);

      // 2. Get order ID from request
      const { orderId } = req.body;
      if (!orderId) {
        return res.status(400).json({ error: 'Order ID is required' });
      }

      // 3. Get order details from the database
      const orderData = await db.getOrder(orderId);
      if (!orderData) {
        return res.status(404).json({ error: 'Order not found' });
      }

      // 4. Verify that the order belongs to the authenticated user
      if (orderData.userId !== userId) {
        return res.status(403).json({ error: 'Forbidden: You do not have access to this order' });
      }

      // 5. Create payment intent with Stripe
      const paymentIntent = await stripe.paymentIntents.create({
        amount: orderData.total,
        currency: 'usd',
        metadata: {
          orderId: orderId,
          userId: userId
        }
      });

      // 6. Update order with payment intent ID
      await db.updateOrder(orderId, {
        paymentIntentId: paymentIntent.id,
      });

      // 7. Return the secret to the client
      return res.status(200).json({
        clientSecret: paymentIntent.client_secret
      });

    } catch (error) {
      console.error('Error creating payment intent:', error);
      // Handle specific errors from the db or Stripe if necessary
      if (error.code === 'auth/id-token-expired') {
        return res.status(401).json({ error: 'Token expired, please re-authenticate.' });
      }
      return res.status(500).json({ error: 'Failed to create payment intent' });
    }
  };
};