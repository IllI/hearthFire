// Test script for order creation
import fetch from 'node-fetch';

async function createTestOrder() {
  console.log('Creating test order with customer information...');
  
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
    console.log('Submitting order...');
    const response = await fetch('http://localhost:3001/api/orders', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': 'Bearer dev-token'
      },
      body: JSON.stringify(orderData)
    });

    if (!response.ok) {
      const errorData = await response.json();
      throw new Error(`Failed to create order: ${errorData.error || response.statusText}`);
    }

    const orderResult = await response.json();
    console.log('Order created successfully!');
    console.log('Order ID:', orderResult.id);
    console.log('Order details:', JSON.stringify(orderResult, null, 2));

    // Then, fetch the order to verify it was saved
    console.log('\nFetching the created order...');
    const getResponse = await fetch(`http://localhost:3001/api/orders/${orderResult.id}`, {
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
    console.log(`Visit the order page at: http://localhost:3001/orders/${order.id}/confirmation`);
  })
  .catch(error => {
    console.error('\nOrder creation test failed:', error);
    process.exit(1);
  }); 