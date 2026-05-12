// Script to seed the Firestore database with real orders
const { initializeApp } = require('firebase/app');
const { getFirestore, collection, addDoc, serverTimestamp, Timestamp } = require('firebase/firestore');
require('dotenv').config({ path: '.env.local' });

// Firebase configuration from environment variables
const firebaseConfig = {
  apiKey: process.env.NEXT_PUBLIC_FIREBASE_API_KEY,
  authDomain: process.env.NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN,
  projectId: process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID,
  storageBucket: process.env.NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET,
  messagingSenderId: process.env.NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID,
  appId: process.env.NEXT_PUBLIC_FIREBASE_APP_ID,
  measurementId: process.env.NEXT_PUBLIC_FIREBASE_MEASUREMENT_ID
};

// Initialize Firebase
const app = initializeApp(firebaseConfig);
const db = getFirestore(app);

// Sample order data - these will be saved to Firestore as real data
const sampleOrders = [
  {
    orderId: 'ORD-2023-001',
    customerName: 'John Doe',
    customerEmail: 'john@example.com',
    userId: 'user-001',
    items: [
      {
        productId: 'product-1',
        name: 'Organic Carrots',
        price: 3.99,
        quantity: 2,
        unit: 'bunch',
        subtotal: 7.98
      },
      {
        productId: 'product-2',
        name: 'Fresh Lettuce',
        price: 2.49,
        quantity: 1,
        unit: 'head',
        subtotal: 2.49
      }
    ],
    subtotal: 10.47,
    tax: 0.84,
    deliveryFee: 5.00,
    total: 16.31,
    deliveryInfo: {
      date: new Date(Date.now() - 3 * 24 * 60 * 60 * 1000).toISOString(), // 3 days ago
      timeSlot: '9am - 12pm',
      address: {
        street: '123 Farm Lane',
        city: 'Farmville',
        state: 'CA',
        zip: '90210'
      }
    },
    status: 'delivered',
    paymentStatus: 'paid',
    paymentMethod: 'credit_card'
  },
  {
    orderId: 'ORD-2023-002',
    customerName: 'Jane Smith',
    customerEmail: 'jane@example.com',
    userId: 'user-002',
    items: [
      {
        productId: 'product-3',
        name: 'Fresh Spinach',
        price: 2.99,
        quantity: 1,
        unit: 'bunch',
        subtotal: 2.99
      },
      {
        productId: 'product-4',
        name: 'Heirloom Tomatoes',
        price: 5.99,
        quantity: 2,
        unit: 'lb',
        subtotal: 11.98
      },
      {
        productId: 'product-5',
        name: 'Fresh Strawberries',
        price: 6.99,
        quantity: 1,
        unit: 'basket',
        subtotal: 6.99
      }
    ],
    subtotal: 21.96,
    tax: 1.76,
    deliveryFee: 5.00,
    total: 28.72,
    deliveryInfo: {
      date: new Date(Date.now() - 1 * 24 * 60 * 60 * 1000).toISOString(), // 1 day ago
      timeSlot: '1pm - 5pm',
      address: {
        street: '456 Garden Avenue',
        city: 'Harvestville',
        state: 'CA',
        zip: '90211'
      }
    },
    status: 'processing',
    paymentStatus: 'paid',
    paymentMethod: 'paypal'
  },
  {
    orderId: 'ORD-2023-003',
    customerName: 'Bob Johnson',
    customerEmail: 'bob@example.com',
    userId: 'user-003',
    items: [
      {
        productId: 'product-6',
        name: 'Organic Kale',
        price: 3.49,
        quantity: 2,
        unit: 'bunch',
        subtotal: 6.98
      },
      {
        productId: 'product-7',
        name: 'Red Delicious Apples',
        price: 4.99,
        quantity: 3,
        unit: 'lb',
        subtotal: 14.97
      },
      {
        productId: 'product-8',
        name: 'Fresh Milk',
        price: 4.49,
        quantity: 1,
        unit: 'gallon',
        subtotal: 4.49
      }
    ],
    subtotal: 26.44,
    tax: 2.12,
    deliveryFee: 5.00,
    total: 33.56,
    deliveryInfo: {
      date: new Date().toISOString(), // Today
      timeSlot: '9am - 12pm',
      address: {
        street: '789 Orchard Street',
        city: 'Cropfield',
        state: 'CA',
        zip: '90215'
      }
    },
    status: 'pending',
    paymentStatus: 'paid',
    paymentMethod: 'credit_card'
  }
];

// Function to add orders to Firestore
async function seedOrders() {
  console.log('Starting to seed orders...');

  try {
    // Add orders with date timestamps for proper sorting and display
    for (const order of sampleOrders) {
      // Convert dates to Firestore timestamps for proper querying
      const createdAtDate = new Date(order.deliveryInfo.date);
      
      // Create a Firestore compatible order object
      const firestoreOrder = {
        ...order,
        createdAt: Timestamp.fromDate(createdAtDate),
        updatedAt: serverTimestamp()
      };
      
      const docRef = await addDoc(collection(db, 'orders'), firestoreOrder);
      console.log(`Added order: ${order.orderId} with ID: ${docRef.id}`);
    }

    console.log('Order seeding completed successfully!');
  } catch (error) {
    console.error('Error seeding orders database:', error);
  }
}

// Run the seeding function
seedOrders(); 