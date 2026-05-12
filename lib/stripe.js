import { loadStripe } from '@stripe/stripe-js';

// Load the Stripe.js library
let stripePromise;
export const getStripe = () => {
  if (!stripePromise) {
    stripePromise = loadStripe(process.env.NEXT_PUBLIC_STRIPE_PUBLIC_KEY);
  }
  return stripePromise;
};

/**
 * Create a payment intent for an order
 * @param {string} orderId - The ID of the order to create a payment intent for
 * @param {string} token - The Firebase authentication token
 * @returns {Promise<object>} - The client secret for the payment intent
 */
export const createPaymentIntent = async (orderId, token) => {
  try {
    const response = await fetch('/api/payment/create-payment-intent', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${token}`
      },
      body: JSON.stringify({ orderId })
    });

    if (!response.ok) {
      const errorData = await response.json();
      throw new Error(errorData.error || 'Failed to create payment intent');
    }

    const data = await response.json();
    return data.clientSecret;
  } catch (error) {
    console.error('Error creating payment intent:', error);
    throw error;
  }
};

/**
 * Process a payment with Stripe
 * @param {object} stripe - The Stripe instance
 * @param {object} elements - The Stripe Elements instance
 * @param {string} clientSecret - The client secret for the payment intent
 * @returns {Promise<object>} - The result of the payment
 */
export const processPayment = async (stripe, elements, clientSecret) => {
  try {
    if (!stripe || !elements || !clientSecret) {
      throw new Error('Missing required parameters for payment processing');
    }

    const cardElement = elements.getElement('card');
    if (!cardElement) {
      throw new Error('Card element not found');
    }

    const { error, paymentIntent } = await stripe.confirmCardPayment(clientSecret, {
      payment_method: {
        card: cardElement
      }
    });

    if (error) {
      throw error;
    }

    return { success: paymentIntent.status === 'succeeded', paymentIntent };
  } catch (error) {
    console.error('Payment processing error:', error);
    throw error;
  }
}; 