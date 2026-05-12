// Test script for order creation (CommonJS version)
const fetch = require('node-fetch');

// Use port 3001 which was used in previous successful tests
const SERVER_URL = 'http://localhost:3001';

async function createTestOrder() {
  console.log('Creating test order with customer information...');
  console.log(`Server URL: ${SERVER_URL}`);
  
  // Check if server is running first
  try {
    console.log('Checking if server is running...');
    const healthCheck = await fetch(`${SERVER_URL}/api/delivery/test`);
    console.log(`Server status: ${healthCheck.status} ${healthCheck.statusText}`);
    
    if (!healthCheck.ok) {
      console.log('WARNING: Server health check failed, but proceeding anyway');
    }
  } catch (error) {
    console.error('ERROR: Server appears to be down or not responding:', error.message);
    console.log('Make sure the Next.js development server is running on port 3001');
    throw new Error('Server unavailable');
  }
  
  const orderData = {
    items: [
      {
        productId: "test-1",
        name: "Test Product",
        price: 19.99,
        quantity: 1,
        unit: "item",
        subtotal: 19.99
      }
    ],
    subtotal: 19.99,
    tax: 1.6,
    deliveryFee: 4.99,
    total: 26.58,
    deliveryInfo: {
      date: "2023-07-30",
      timeSlot: "10:00 AM - 12:00 PM",
      address: {
        street: "123 Test St",
        city: "Test City",
        state: "CA",
        zip: "90210"
      },
      instructions: "Leave at the door"
    },
    paymentMethod: "credit",
    // Include customer information explicitly
    customerName: "Test Customer",
    customerEmail: "test@example.com"
  };

  try {
    // First, create the order
    console.log(`Submitting order to: ${SERVER_URL}/api/orders`);
    const response = await fetch(`${SERVER_URL}/api/orders`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': 'Bearer dev-token'
      },
      body: JSON.stringify(orderData)
    });

    console.log(`POST response status: ${response.status} ${response.statusText}`);
    
    // Check content type
    const contentType = response.headers.get('content-type');
    console.log(`Response content type: ${contentType}`);
    
    if (!contentType || !contentType.includes('application/json')) {
      // If not JSON, get the text response
      const text = await response.text();
      console.error('Non-JSON response received:', text.substring(0, 500) + (text.length > 500 ? '...' : ''));
      throw new Error('Non-JSON response received');
    }

    if (!response.ok) {
      const errorData = await response.json();
      console.error('Server error details:', JSON.stringify(errorData, null, 2));
      throw new Error(`Failed to create order: ${errorData.error || response.statusText}`);
    }

    const orderResult = await response.json();
    console.log('Order created successfully!');
    console.log('Order ID:', orderResult.id);
    console.log('Order details:', JSON.stringify(orderResult, null, 2));

    // Then, fetch the order to verify it was saved
    console.log('\nFetching the created order...');
    const getResponse = await fetch(`${SERVER_URL}/api/orders/${orderResult.id}`, {
      headers: {
        'Authorization': 'Bearer dev-token'
      }
    });

    if (!getResponse.ok) {
      const errorData = await getResponse.json();
      throw new Error(`Failed to fetch order: ${errorData.error || getResponse.statusText}`);
    }

    const fetchedOrder = await getResponse.json();
    console.log('Order fetched successfully!');
    console.log('Order details from GET request:', JSON.stringify(fetchedOrder, null, 2));

    // Verify customer information is present
    if (fetchedOrder.customerName && fetchedOrder.customerEmail) {
      console.log('\nCustomer information is correctly included:');
      console.log(`Name: ${fetchedOrder.customerName}`);
      console.log(`Email: ${fetchedOrder.customerEmail}`);
    } else {
      console.error('\nERROR: Customer information is missing from the fetched order!');
    }

    return fetchedOrder;
  } catch (error) {
    console.error('Error:', error.message);
    throw error;
  }
}

// Execute the test
createTestOrder()
  .then(order => {
    console.log('\nOrder creation test completed successfully!');
    if (order && order.id) {
      console.log(`Visit the order page at: ${SERVER_URL}/orders/${order.id}/confirmation`);
    }
  })
  .catch(error => {
    console.error('\nOrder creation test failed:', error);
    process.exit(1);
  }); 