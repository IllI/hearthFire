import { useState, useEffect } from 'react';
import { loadStripe } from '@stripe/stripe-js';
import {
  Elements,
  CardElement,
  useStripe,
  useElements
} from '@stripe/react-stripe-js';
import { useAuth } from '../contexts/AuthContext';
import { createPaymentIntent, processPayment } from './stripe';

// Load Stripe outside of component rendering to avoid recreating Stripe object on every render
const stripePromise = loadStripe(process.env.NEXT_PUBLIC_STRIPE_PUBLIC_KEY);

export default function StripePaymentForm({ orderId, onSuccess }) {
  return (
    <Elements stripe={stripePromise}>
      <PaymentForm orderId={orderId} onSuccess={onSuccess} />
    </Elements>
  );
}

function PaymentForm({ orderId, onSuccess }) {
  const stripe = useStripe();
  const elements = useElements();
  const { currentUser } = useAuth();
  
  const [clientSecret, setClientSecret] = useState('');
  const [error, setError] = useState(null);
  const [processing, setProcessing] = useState(false);
  const [succeeded, setSucceeded] = useState(false);
  
  useEffect(() => {
    // Create a PaymentIntent as soon as the page loads
    async function createPaymentIntent() {
      try {
        if (!currentUser) return;
        
        const token = await currentUser.getIdToken();
        
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
        setClientSecret(data.clientSecret);
      } catch (error) {
        console.error('Error creating payment intent:', error);
        setError(error.message);
      }
    }
    
    createPaymentIntent();
  }, [orderId, currentUser]);
  
  const handleSubmit = async (event) => {
    event.preventDefault();
    
    if (!stripe || !elements) {
      // Stripe.js has not loaded yet
      return;
    }
    
    setProcessing(true);
    setError(null);
    
    const cardElement = elements.getElement(CardElement);
    
    try {
      const { error, paymentIntent } = await stripe.confirmCardPayment(clientSecret, {
        payment_method: {
          card: cardElement
        }
      });
      
      if (error) {
        throw error;
      }
      
      if (paymentIntent.status === 'succeeded') {
        setSucceeded(true);
        onSuccess && onSuccess();
      }
    } catch (error) {
      console.error('Payment error:', error);
      setError(error.message);
    } finally {
      setProcessing(false);
    }
  };
  
  const handleCardChange = (event) => {
    setError(event.error ? event.error.message : '');
  };
  
  const cardStyle = {
    style: {
      base: {
        color: "#32325d",
        fontFamily: 'Arial, sans-serif',
        fontSmoothing: "antialiased",
        fontSize: "16px",
        "::placeholder": {
          color: "#aab7c4"
        }
      },
      invalid: {
        color: "#fa755a",
        iconColor: "#fa755a"
      }
    }
  };
  
  return (
    <form onSubmit={handleSubmit}>
      <h3 className="text-lg font-medium mb-4">Payment Details</h3>
      
      <div className="mb-4">
        <CardElement 
          options={cardStyle} 
          onChange={handleCardChange} 
          className="p-3 border rounded-md"
        />
      </div>
      
      {error && (
        <div className="bg-red-50 p-3 rounded-md text-red-700 text-sm mb-4">
          {error}
        </div>
      )}
      
      <button
        type="submit"
        disabled={processing || !stripe || !clientSecret || succeeded}
        className="w-full bg-green-600 hover:bg-green-700 text-white py-2 px-4 rounded-md disabled:bg-gray-400"
      >
        {processing ? 'Processing...' : succeeded ? 'Payment Successful' : 'Pay Now'}
      </button>
    </form>
  );
} 

const StripePaymentForm = ({ orderId, apiEndpoint, onPaymentSuccess, onPaymentError }) => {
  const [stripe, setStripe] = useState(null);
  const [elements, setElements] = useState(null);
  const [paymentIntent, setPaymentIntent] = useState(null);
  const [error, setError] = useState(null);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    const initializeStripe = async () => {
      const stripeInstance = await loadStripe(process.env.NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY);
      setStripe(stripeInstance);
    };
    initializeStripe();
  }, []);

  useEffect(() => {
    if (stripe) {
      const elementsInstance = stripe.elements();
      setElements(elementsInstance);
    }
  }, [stripe]);

  useEffect(() => {
    const fetchPaymentIntent = async () => {
      try {
        // This is a placeholder for getting the authentication token.
        // In a real application, you would replace this with your actual authentication logic.
        const token = 'your-auth-token';
        const { clientSecret } = await createPaymentIntent(orderId, token, apiEndpoint);
        setPaymentIntent({ clientSecret });
      } catch (error) {
        setError(error.message);
      }
    };
    if (orderId) {
      fetchPaymentIntent();
    }
  }, [orderId, apiEndpoint]);

  const handleSubmit = async (event) => {
    event.preventDefault();
    
    if (!stripe || !elements) {
      // Stripe.js has not loaded yet
      return;
    }
    
    setLoading(true);

    try {
      const result = await processPayment(stripe, elements, CardElement, paymentIntent.clientSecret);
      if (result.error) {
        setError(result.error.message);
        if (onPaymentError) {
          onPaymentError(result.error);
        }
      } else {
        if (onPaymentSuccess) {
          onPaymentSuccess(result.paymentIntent);
        }
      }
    } catch (error) {
      setError(error.message);
      if (onPaymentError) {
        onPaymentError(error);
      }
    }

    setLoading(false);
  };

  return (
    <form onSubmit={handleSubmit}>
      <h3 className="text-lg font-medium mb-4">Payment Details</h3>
      
      <div className="mb-4">
        <CardElement 
          options={cardStyle} 
          onChange={handleCardChange} 
          className="p-3 border rounded-md"
        />
      </div>
      
      {error && (
        <div className="bg-red-50 p-3 rounded-md text-red-700 text-sm mb-4">
          {error}
        </div>
      )}
      
      <button
        type="submit"
        disabled={processing || !stripe || !clientSecret || succeeded}
        className="w-full bg-green-600 hover:bg-green-700 text-white py-2 px-4 rounded-md disabled:bg-gray-400"
      >
        {processing ? 'Processing...' : succeeded ? 'Payment Successful' : 'Pay Now'}
      </button>
    </form>
  );
}