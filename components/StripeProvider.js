import { useState, useEffect } from 'react';
import { loadStripe } from '@stripe/stripe-js';
import { Elements } from '@stripe/react-stripe-js';

// Stripe public key from environment variable
const stripePromise = loadStripe(process.env.NEXT_PUBLIC_STRIPE_PUBLIC_KEY);

export default function StripeProvider({ children }) {
  const [options, setOptions] = useState({
    locale: 'en',
    appearance: {
      theme: 'stripe',
      variables: {
        colorPrimary: '#22c55e', // Green-600
      },
    }
  });

  // Set additional options for development mode
  useEffect(() => {
    if (process.env.NODE_ENV === 'development') {
      setOptions(prevOptions => ({
        ...prevOptions,
        // These options help with development environment
        fonts: [
          { cssSrc: 'https://fonts.googleapis.com/css?family=Roboto' }
        ],
        loader: 'auto',
      }));
    }
  }, []);

  return (
    <Elements stripe={stripePromise} options={options}>
      {children}
    </Elements>
  );
} 