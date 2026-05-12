import Stripe from 'stripe';

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY);

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    const { amount, metadata = {} } = req.body;
    
    // Validate amount
    if (!amount || amount < 50) {
      return res.status(400).json({ error: 'Invalid amount. Minimum amount is $0.50.' });
    }

    // Enhance metadata with additional information
    const enhancedMetadata = {
      ...metadata,
      order_id: `order_${Date.now()}`, // Generate a temporary order ID
      source: 'hearthfire-farm-website',
      environment: process.env.NODE_ENV
    };

    // Create payment intent with Stripe
    const paymentIntent = await stripe.paymentIntents.create({
      amount,
      currency: 'usd',
      metadata: enhancedMetadata,
      // Auto capture payment
      capture_method: 'automatic',
      // Set up the following for better fraud protection
      setup_future_usage: metadata.name ? 'off_session' : undefined, // Only set if we have customer name
      description: `Hearthfire Farm Order - $${(amount / 100).toFixed(2)}`,
    });

    // Return the client secret
    res.status(200).json({
      clientSecret: paymentIntent.client_secret,
      id: paymentIntent.id
    });
  } catch (error) {
    console.error('Error creating payment intent:', error);
    
    // Handle specific Stripe errors
    if (error.type === 'StripeCardError') {
      return res.status(400).json({ error: error.message });
    }
    
    // Generic error
    res.status(500).json({ error: 'Error creating payment. Please try again.' });
  }
} 