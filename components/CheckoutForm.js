import { useState, useEffect } from 'react';
import { CardElement, useStripe, useElements } from '@stripe/react-stripe-js';

export default function CheckoutForm({ onPaymentSuccess, onPaymentError, amount }) {
  const stripe = useStripe();
  const elements = useElements();
  const [error, setError] = useState(null);
  const [processing, setProcessing] = useState(false);
  const [succeeded, setSucceeded] = useState(false);
  const [isDev, setIsDev] = useState(false);
  
  // Add states for billing information
  const [name, setName] = useState('');
  const [line1, setLine1] = useState('');
  const [line2, setLine2] = useState('');
  const [city, setCity] = useState('');
  const [state, setState] = useState('');
  const [postalCode, setPostalCode] = useState('');
  const [country, setCountry] = useState('US');
  
  // Check if we're in development mode
  useEffect(() => {
    setIsDev(process.env.NODE_ENV === 'development');
  }, []);
  
  const handleSubmit = async (event) => {
    event.preventDefault();
    
    if (!stripe || !elements) {
      // Stripe.js has not loaded yet. Make sure to disable form submission until Stripe.js has loaded.
      return;
    }

    // Validate required fields
    if (!name.trim()) {
      setError('Cardholder name is required');
      return;
    }
    
    if (!line1.trim() || !city.trim() || !state.trim() || !postalCode.trim()) {
      setError('Please fill out all required billing address fields');
      return;
    }

    setProcessing(true);
    
    try {
      // First create a payment intent on the server
      const response = await fetch('/api/payments/create-payment-intent', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          amount: amount, // Pass the amount in cents
          metadata: {
            name: name
          }
        }),
      });
      
      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || 'Failed to create payment intent');
      }
      
      const paymentIntentData = await response.json();
      
      // Use the client secret to confirm the payment with billing details
      const { error, paymentIntent } = await stripe.confirmCardPayment(paymentIntentData.clientSecret, {
        payment_method: {
          card: elements.getElement(CardElement),
          billing_details: {
            name: name,
            address: {
              line1: line1,
              line2: line2 || undefined, // Don't send empty string
              city: city,
              state: state,
              postal_code: postalCode,
              country: country
            }
          }
        },
      });

      if (error) {
        setError(error.message);
        setProcessing(false);
        onPaymentError(error.message);
        return;
      }

      // Payment confirmed successfully
      setSucceeded(true);
      setError(null);
      setProcessing(false);
      
      // Pass the payment information to the parent component
      onPaymentSuccess({
        id: paymentIntent.payment_method,
        type: 'credit_card',
        paymentIntentId: paymentIntent.id,
        // These fields will be available in the response if you need them
        last4: paymentIntent.payment_method_details?.card?.last4 || '****',
        brand: paymentIntent.payment_method_details?.card?.brand || 'card',
        billingName: name,
        billingAddress: {
          line1,
          line2,
          city,
          state,
          postalCode,
          country
        }
      });
    } catch (err) {
      console.error('Payment error:', err);
      setError(err.message || 'An unexpected error occurred.');
      setProcessing(false);
      onPaymentError(err.message || 'An unexpected error occurred.');
    }
  };

  const handleCardChange = (event) => {
    // Listen for changes in the CardElement
    // and display any errors as the customer types their card details
    setError(event.error ? event.error.message : '');
  };

  const cardElementOptions = {
    style: {
      base: {
        color: '#32325d',
        fontFamily: 'Arial, sans-serif',
        fontSmoothing: 'antialiased',
        fontSize: '16px',
        '::placeholder': {
          color: '#aab7c4'
        }
      },
      invalid: {
        color: '#fa755a',
        iconColor: '#fa755a'
      }
    },
    hidePostalCode: true, // We collect postal code in our own field
    // Add these options to try improving the development experience
    iconStyle: 'solid',
    // Set test card support to improve the development experience
    supportedCountries: ['US', 'CA', 'GB'],
    // Tell Stripe this is a test
    test: isDev
  };

  return (
    <div className="mt-4">
      {isDev && (
        <div className="bg-yellow-50 p-3 border border-yellow-200 rounded-md mb-4">
          <p className="text-yellow-700 text-sm">
            <span className="font-semibold">Development Mode:</span> The warning about "Automatic payment methods filling" is normal in development because you're using HTTP instead of HTTPS. This won't appear in production.
          </p>
          <p className="text-yellow-700 text-sm mt-1">
            For testing, you can use card number: <span className="font-mono">4242 4242 4242 4242</span> with any future expiry date and any CVC.
          </p>
        </div>
      )}
      <form id="payment-form" onSubmit={handleSubmit}>
        {/* Cardholder Name */}
        <div className="mb-4">
          <label htmlFor="name" className="block text-sm font-medium text-gray-700 mb-1">
            Cardholder Name <span className="text-red-500">*</span>
          </label>
          <input
            id="name"
            type="text"
            value={name}
            onChange={(e) => setName(e.target.value)}
            className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-green-500"
            placeholder="Full name on card"
            required
          />
        </div>
        
        {/* Billing Address */}
        <div className="mb-4">
          <h3 className="font-medium text-gray-700 mb-2">Billing Address</h3>
          
          <div className="mb-2">
            <label htmlFor="line1" className="block text-sm font-medium text-gray-700 mb-1">
              Address Line 1 <span className="text-red-500">*</span>
            </label>
            <input
              id="line1"
              type="text"
              value={line1}
              onChange={(e) => setLine1(e.target.value)}
              className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-green-500"
              placeholder="Street address"
              required
            />
          </div>
          
          <div className="mb-2">
            <label htmlFor="line2" className="block text-sm font-medium text-gray-700 mb-1">
              Address Line 2
            </label>
            <input
              id="line2"
              type="text"
              value={line2}
              onChange={(e) => setLine2(e.target.value)}
              className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-green-500"
              placeholder="Apt, suite, unit, etc. (optional)"
            />
          </div>
          
          <div className="grid grid-cols-2 gap-2 mb-2">
            <div>
              <label htmlFor="city" className="block text-sm font-medium text-gray-700 mb-1">
                City <span className="text-red-500">*</span>
              </label>
              <input
                id="city"
                type="text"
                value={city}
                onChange={(e) => setCity(e.target.value)}
                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-green-500"
                required
              />
            </div>
            <div>
              <label htmlFor="state" className="block text-sm font-medium text-gray-700 mb-1">
                State <span className="text-red-500">*</span>
              </label>
              <input
                id="state"
                type="text"
                value={state}
                onChange={(e) => setState(e.target.value)}
                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-green-500"
                placeholder="State/Province"
                required
              />
            </div>
          </div>
          
          <div className="grid grid-cols-2 gap-2">
            <div>
              <label htmlFor="postalCode" className="block text-sm font-medium text-gray-700 mb-1">
                ZIP / Postal Code <span className="text-red-500">*</span>
              </label>
              <input
                id="postalCode"
                type="text"
                value={postalCode}
                onChange={(e) => setPostalCode(e.target.value)}
                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-green-500"
                required
              />
            </div>
            <div>
              <label htmlFor="country" className="block text-sm font-medium text-gray-700 mb-1">
                Country <span className="text-red-500">*</span>
              </label>
              <select
                id="country"
                value={country}
                onChange={(e) => setCountry(e.target.value)}
                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-green-500"
                required
              >
                <option value="US">United States</option>
                <option value="CA">Canada</option>
                <option value="GB">United Kingdom</option>
                {/* Add more countries as needed */}
              </select>
            </div>
          </div>
        </div>
        
        {/* Card Details */}
        <div className="mb-6">
          <label htmlFor="card-element" className="block text-sm font-medium text-gray-700 mb-2">
            Card Details <span className="text-red-500">*</span>
          </label>
          <div className="border rounded-md p-3 focus:ring-green-500 focus:border-green-500">
            <CardElement 
              id="card-element" 
              options={cardElementOptions} 
              onChange={handleCardChange} 
            />
          </div>
          {error && (
            <div className="text-red-600 text-sm mt-2">
              {error}
            </div>
          )}
        </div>
        
        <button
          disabled={processing || succeeded || !stripe}
          className="w-full bg-green-600 hover:bg-green-700 text-white font-bold py-3 px-4 rounded focus:outline-none focus:shadow-outline disabled:bg-gray-400"
        >
          {processing ? 'Processing...' : succeeded ? 'Payment Successful' : `Pay $${(amount / 100).toFixed(2)}`}
        </button>
      </form>
    </div>
  );
} 