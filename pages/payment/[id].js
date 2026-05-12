import { useState, useEffect } from 'react';
import { useRouter } from 'next/router';
import { useAuth } from '../../contexts/AuthContext';
import Layout from '../../components/Layout';
import StripePaymentForm from '../../components/StripePaymentForm';
import Link from 'next/link';

export default function PaymentPage() {
  const { currentUser } = useAuth();
  const router = useRouter();
  const { id } = router.query; // id is the order id
  
  const [order, setOrder] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [paymentSuccess, setPaymentSuccess] = useState(false);
  
  useEffect(() => {
    if (!id || !currentUser) return;
    
    async function fetchOrder() {
      try {
        const token = await currentUser.getIdToken();
        
        const response = await fetch(`/api/orders/${id}`, {
          headers: {
            'Authorization': `Bearer ${token}`
          }
        });
        
        if (!response.ok) {
          throw new Error('Failed to fetch order');
        }
        
        const data = await response.json();
        setOrder(data);
      } catch (err) {
        console.error('Error fetching order:', err);
        setError('Failed to load order details. Please try again later.');
      } finally {
        setLoading(false);
      }
    }
    
    fetchOrder();
  }, [id, currentUser]);
  
  const handlePaymentSuccess = () => {
    setPaymentSuccess(true);
    
    // Redirect to success page after a short delay
    setTimeout(() => {
      router.push(`/orders/${id}/confirmation`);
    }, 2000);
  };
  
  if (loading) {
    return (
      <Layout title="Payment">
        <div className="max-w-4xl mx-auto px-4 py-12">
          <div className="flex justify-center">
            <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-green-500"></div>
          </div>
        </div>
      </Layout>
    );
  }
  
  if (error || !order) {
    return (
      <Layout title="Payment">
        <div className="max-w-4xl mx-auto px-4 py-12">
          <div className="bg-red-50 p-4 rounded-md">
            <h1 className="text-xl font-bold text-red-800">Error</h1>
            <p className="text-red-700">{error || 'Order not found'}</p>
            <div className="mt-4">
              <Link href="/account/orders" className="text-green-600 hover:text-green-800">
                View your orders
              </Link>
            </div>
          </div>
        </div>
      </Layout>
    );
  }
  
  return (
    <Layout title="Payment">
      <div className="max-w-4xl mx-auto px-4 py-12">
        <h1 className="text-3xl font-bold mb-8">Complete Your Payment</h1>
        
        <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
          <div className="bg-white shadow-md rounded-lg p-6">
            <h2 className="text-xl font-medium mb-4">Order Summary</h2>
            <div className="mb-4">
              <p className="text-gray-700">Order #: <strong>{order.orderId}</strong></p>
              <p className="text-gray-700">Total: <strong>${(order.total / 100).toFixed(2)}</strong></p>
            </div>
            
            <div className="mb-4">
              <h3 className="font-medium mb-2">Items:</h3>
              <ul className="space-y-1">
                {order.items.map((item, index) => (
                  <li key={index} className="text-sm">
                    {item.name} × {item.quantity} - ${(item.subtotal / 100).toFixed(2)}
                  </li>
                ))}
              </ul>
            </div>
          </div>
          
          <div className="bg-white shadow-md rounded-lg p-6">
            {paymentSuccess ? (
              <div className="text-center">
                <svg className="w-16 h-16 text-green-500 mx-auto" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                </svg>
                <h2 className="text-xl font-medium mt-4 mb-2">Payment Successful!</h2>
                <p className="text-gray-600 mb-4">Redirecting to order confirmation...</p>
                <div className="animate-pulse">
                  <div className="h-2 bg-gray-200 rounded w-32 mx-auto"></div>
                </div>
              </div>
            ) : (
              <StripePaymentForm orderId={id} onSuccess={handlePaymentSuccess} />
            )}
          </div>
        </div>
        
        <div className="mt-8">
          <Link href="/account/orders" className="text-green-600 hover:text-green-800">
            &larr; Return to your orders
          </Link>
        </div>
      </div>
    </Layout>
  );
} 