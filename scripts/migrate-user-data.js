/**
 * User Data Migration Script
 * 
 * This script sets up a proper user data structure in Firestore and extracts customer
 * information from existing orders to create proper user profiles.
 */

const fs = require('fs');
const path = require('path');
const { initializeApp, cert } = require('firebase-admin/app');
const { getFirestore, FieldValue } = require('firebase-admin/firestore');
const dotenv = require('dotenv');

// Load environment variables
dotenv.config({ path: path.join(__dirname, '..', '.env.local') });

// Parse the service account key
const serviceAccountKey = JSON.parse(process.env.FIREBASE_SERVICE_ACCOUNT_KEY);

// Initialize Firebase Admin
const app = initializeApp({
  credential: cert(serviceAccountKey)
});

const db = getFirestore();

async function createUsersCollection() {
  console.log('Checking if users collection exists...');
  
  // Check if users collection exists and has documents
  const usersSnapshot = await db.collection('users').limit(1).get();
  
  if (!usersSnapshot.empty) {
    console.log('Users collection already exists with data.');
    return;
  }
  
  console.log('Setting up users collection structure...');
  
  // Create default admin user if none exists
  const adminEmail = 'admin@example.com';
  
  await db.collection('users').doc('admin-user-1').set({
    name: 'Admin User',
    email: adminEmail,
    phone: '555-789-0123',
    role: 'admin',
    createdAt: new Date(),
    orders: [],
    lastLogin: null,
    metadata: {
      creationMethod: 'migration-script'
    }
  });
  
  console.log('Created default admin user.');
}

async function migrateCustomerDataFromOrders() {
  console.log('Checking for customer data in existing orders...');
  
  // Get all orders
  const ordersSnapshot = await db.collection('orders').get();
  
  if (ordersSnapshot.empty) {
    console.log('No existing orders found.');
    return;
  }
  
  console.log(`Found ${ordersSnapshot.size} orders. Extracting customer information...`);
  
  // Map to store unique customers by email
  const customerMap = new Map();
  
  // Process each order to extract customer data
  ordersSnapshot.forEach(doc => {
    const order = doc.data();
    
    if (order.customerEmail && !customerMap.has(order.customerEmail)) {
      customerMap.set(order.customerEmail, {
        name: order.customerName || 'Unknown Customer',
        email: order.customerEmail,
        orders: [doc.id],
        orderIds: [doc.id],
        orderCount: 1,
        totalSpent: order.total || 0,
        address: order.deliveryInfo?.address || null,
        lastOrderDate: order.createdAt || new Date(),
        createdAt: new Date(),
        role: 'customer',
        metadata: {
          source: 'order-migration',
          firstOrderId: doc.id
        }
      });
    } else if (order.customerEmail) {
      // Update existing customer record
      const customer = customerMap.get(order.customerEmail);
      customer.orders.push(doc.id);
      customer.orderIds.push(doc.id);
      customer.orderCount += 1;
      customer.totalSpent += (order.total || 0);
      
      // Update last order date if this order is more recent
      if (order.createdAt && order.createdAt > customer.lastOrderDate) {
        customer.lastOrderDate = order.createdAt;
      }
      
      // Update address if missing
      if (!customer.address && order.deliveryInfo?.address) {
        customer.address = order.deliveryInfo.address;
      }
    }
  });
  
  console.log(`Extracted ${customerMap.size} unique customers from orders.`);
  
  // Create user documents for each customer
  let count = 0;
  for (const [email, customerData] of customerMap.entries()) {
    // Generate a customer ID
    const customerId = `customer-${Date.now()}-${count}`;
    
    // Create a new document in the users collection
    await db.collection('users').doc(customerId).set(customerData);
    count++;
    
    console.log(`Created user document for ${email} with ID: ${customerId}`);
  }
  
  console.log(`Migration complete. Added ${count} customers to users collection.`);
}

async function updateOrdersWithUserReferences() {
  console.log('Updating orders with proper user references...');
  
  // Get all users
  const usersSnapshot = await db.collection('users').get();
  const emailToUserIdMap = new Map();
  
  // Build a map of email to user ID
  usersSnapshot.forEach(doc => {
    const userData = doc.data();
    if (userData.email) {
      emailToUserIdMap.set(userData.email, doc.id);
    }
  });
  
  // Get all orders
  const ordersSnapshot = await db.collection('orders').get();
  
  let updatedCount = 0;
  for (const doc of ordersSnapshot.docs) {
    const order = doc.data();
    
    if (order.customerEmail && emailToUserIdMap.has(order.customerEmail)) {
      const userId = emailToUserIdMap.get(order.customerEmail);
      
      // Update the order with the proper userId
      await db.collection('orders').doc(doc.id).update({
        userId: userId
      });
      
      updatedCount++;
    }
  }
  
  console.log(`Updated ${updatedCount} orders with proper user references.`);
}

async function createUserStatsCollection() {
  console.log('Creating user_stats collection for analytics...');
  
  // Get all users
  const usersSnapshot = await db.collection('users').get();
  
  for (const doc of usersSnapshot.docs) {
    const userData = doc.data();
    
    // Create stats document
    await db.collection('user_stats').doc(doc.id).set({
      userId: doc.id,
      orderCount: userData.orderCount || 0,
      totalSpent: userData.totalSpent || 0,
      lastOrderDate: userData.lastOrderDate || null,
      firstOrderDate: userData.createdAt || null,
      averageOrderValue: userData.orderCount > 0 ? 
        userData.totalSpent / userData.orderCount : 0,
      lastUpdated: new Date()
    });
  }
  
  console.log(`Created ${usersSnapshot.size} user_stats documents.`);
}

async function main() {
  try {
    console.log('Starting user data migration...');
    
    // Step 1: Create users collection structure
    await createUsersCollection();
    
    // Step 2: Migrate customer data from existing orders
    await migrateCustomerDataFromOrders();
    
    // Step 3: Update orders with proper user references
    await updateOrdersWithUserReferences();
    
    // Step 4: Create user stats collection for analytics
    await createUserStatsCollection();
    
    console.log('User data migration completed successfully!');
  } catch (error) {
    console.error('Error during migration:', error);
  }
}

main(); 