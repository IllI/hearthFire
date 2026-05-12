// Simple script to test order creation
import fetch from 'node-fetch';

async function createTestOrder() {
  try {
    console.log('Creating test order...');
    
    const orderData = {
      items: [
        {
          productId: 'test-1',
          name: 'Test Product',
          price: 19.99,
          quantity: 1,
          unit: 'item',
          subtotal: 19.99
        }
      ],
      subtotal: 19.99,
      tax: 1.60,
      deliveryFee: 4.99,
      total: 26.58,
      deliveryInfo: {
        date: new Date().toISOString(),
        timeSlot: '9am - 12pm',
        address: {
          street: '123 Test St',
          city: 'Testville',
          state: 'TS',
          zip: '12345'
        },
        instructions: 'Test delivery instructions'
      },
      paymentMethod: 'credit'
    };
    
    const response = await fetch('http://localhost:3001/api/orders', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': 'Bearer dev-token'
      },
      body: JSON.stringify(orderData)
    });
    
    const result = await response.json();
    
    if (!response.ok) {
      throw new Error(`API error: ${result.error || 'Unknown error'}`);
    }
    
    console.log('Order created successfully:');
    console.log('Order ID:', result.id);
    console.log('---');
    console.log('Order data:', JSON.stringify(result, null, 2));
    
    // Now try to fetch the order we just created
    console.log('\nFetching the created order...');
    const getResponse = await fetch(`http://localhost:3001/api/orders/${result.id}`, {
      headers: {
        'Authorization': 'Bearer dev-token'
      }
    });
    
    const getResult = await getResponse.json();
    
    if (!getResponse.ok) {
      throw new Error(`API error fetching order: ${getResult.error || 'Unknown error'}`);
    }
    
    console.log('Order fetched successfully:');
    console.log('Order ID:', getResult.id);
    console.log('---');
    console.log('Order data:', JSON.stringify(getResult, null, 2));
    
  } catch (error) {
    console.error('Error:', error.message);
  }
}

createTestOrder(); 