import * as admin from 'firebase-admin';
import fs from 'fs';
import path from 'path';

// Global flag to track if we're in development mode
const isDevelopment = process.env.NODE_ENV === 'development';

// Create global flag to track if Firebase Admin has been initialized
if (!global.firebaseAdminInitialized) {
  global.firebaseAdminInitialized = false;
}

// Add a global flag to control mock data usage
// Force to false - we want to use real data unless we absolutely can't
if (typeof global.useMockData === 'undefined') {
  global.useMockData = false;
}

// Create global mock data for development (only if we need it as fallback)
if (isDevelopment && !global.mockDataInitialized) {
  // console.log('Preparing mock data as fallback for development mode');

  // Mock products
  global.mockProducts = [
    { id: 'product-1', name: 'Organic Carrots', price: 3.99, inventory: 50 },
    { id: 'product-2', name: 'Fresh Lettuce', price: 2.49, inventory: 30 },
    { id: 'product-3', name: 'Local Honey', price: 7.99, inventory: 15 },
  ];

  // Mock orders
  const now = new Date();
  const yesterday = new Date(now.getTime() - 24 * 60 * 60 * 1000);
  const twoDaysAgo = new Date(now.getTime() - 2 * 24 * 60 * 60 * 1000);

  global.mockOrders = [
    {
      id: 'order-1',
      orderId: 'ORD-order-123456',
      userId: 'admin-user-dev',
      customerName: 'Jane Smith',
      customerEmail: 'jane@example.com',
      total: 24.99,
      status: 'delivered',
      paymentStatus: 'completed',
      createdAt: {
        seconds: Math.floor(yesterday.getTime() / 1000),
        nanoseconds: 0,
        toDate: () => yesterday
      }
    },
    {
      id: 'order-2',
      orderId: 'ORD-order-234567',
      userId: 'user-123',
      customerName: 'John Doe',
      customerEmail: 'john@example.com',
      total: 36.50,
      status: 'processing',
      paymentStatus: 'completed',
      createdAt: {
        seconds: Math.floor(now.getTime() / 1000),
        nanoseconds: 0,
        toDate: () => now
      }
    },
    {
      id: 'order-3',
      orderId: 'ORD-order-345678',
      userId: 'user-456',
      customerName: 'Alice Johnson',
      customerEmail: 'alice@example.com',
      total: 19.95,
      status: 'shipped',
      paymentStatus: 'completed',
      createdAt: {
        seconds: Math.floor(twoDaysAgo.getTime() / 1000),
        nanoseconds: 0,
        toDate: () => twoDaysAgo
      }
    }
  ];

  // Mock delivery schedules
  const tomorrow = new Date(now.getTime() + 24 * 60 * 60 * 1000);
  const nextWeek = new Date(now.getTime() + 7 * 24 * 60 * 60 * 1000);

  global.mockDeliverySchedules = [
    {
      id: 'schedule-1',
      date: tomorrow.toISOString(),
      slots: [
        { id: 'morning', name: 'Morning', time: '9am - 12pm', available: true, maxOrders: 2, currentOrders: 0 },
        { id: 'afternoon', name: 'Afternoon', time: '1pm - 5pm', available: true, maxOrders: 2, currentOrders: 0 }
      ],
      zipCodes: ['12345', '23456', '34567'],
      cutoffTime: 24,
      note: 'Farm delivery'
    },
    {
      id: 'schedule-2',
      date: nextWeek.toISOString(),
      slots: [
        { id: 'morning', name: 'Morning', time: '9am - 12pm', available: true, maxOrders: 2, currentOrders: 0 },
        { id: 'afternoon', name: 'Afternoon', time: '1pm - 5pm', available: true, maxOrders: 2, currentOrders: 0 }
      ],
      zipCodes: ['12345', '23456', '34567'],
      cutoffTime: 24,
      note: 'Farm delivery'
    }
  ];

  // Add mock promotions for development
  if (isDevelopment && !global.mockPromotions) {
    global.mockPromotions = [
      {
        id: 'promo-1',
        code: 'TEST25',
        type: 'percentage',
        value: 25,
        description: 'Test promotion: 25% off your order',
        active: true,
        createdAt: new Date(),
        updatedAt: new Date()
      },
      {
        id: 'promo-2',
        code: 'FREEDEL',
        type: 'shipping',
        value: 0,
        description: 'Free delivery on your order',
        active: true,
        createdAt: new Date(),
        updatedAt: new Date()
      },
      {
        id: 'promo-3',
        code: 'WELCOME10',
        type: 'fixed',
        value: 10,
        description: '$10 off your first order',
        active: true,
        createdAt: new Date(),
        updatedAt: new Date()
      }
    ];
  }

  global.mockDataInitialized = true;
}

// Update mock Firestore to properly handle setting a document with auto-generated ID
const mockFirestore = {
  collection: (path) => ({
    doc: (id) => ({
      get: async () => ({
        exists: global[`${path}_${id}`] ? true : (path === 'users' && (id.includes('admin') || id === 'admin-user-dev')),
        data: () => {
          // Check if we have this document in our global storage
          if (global[`${path}_${id}`]) {
            return global[`${path}_${id}`];
          }

          // Return mock user data for admin user in development
          if (path === 'users' && (id.includes('admin') || id === 'admin-user-dev')) {
            return {
              role: 'admin',
              name: 'Admin User',
              email: 'admin@example.com'
            };
          }

          // Return mock product data
          if (path === 'products' && global.mockProducts) {
            const product = global.mockProducts.find(p => p.id === id);
            if (product) return product;
          }

          // Return mock order data
          if (path === 'orders' && global.mockOrders) {
            const order = global.mockOrders.find(o => o.id === id);
            if (order) return order;
          }

          // Return mock delivery schedule data
          if (path === 'deliverySchedules' && global.mockDeliverySchedules) {
            const schedule = global.mockDeliverySchedules.find(s => s.id === id);
            if (schedule) return schedule;
          }

          return null;
        }
      }),
      set: async (data) => {
        // console.log(`[MOCK] Set ${path}/${id}:`, data);
        // Store in global space for later retrieval
        global[`${path}_${id}`] = data;

        // Also update our collections
        if (path === 'orders') {
          if (!global.mockOrders) {
            global.mockOrders = [];
          }

          // Update if exists
          const existingIndex = global.mockOrders.findIndex(o => o.id === id);
          if (existingIndex >= 0) {
            global.mockOrders[existingIndex] = { id, ...data };
          } else {
            // Add new
            global.mockOrders.push({ id, ...data });
          }

          // console.log(`[MOCK] Updated mockOrders collection, now has ${global.mockOrders.length} items`);
        }

        return { id };
      },
      update: async (data) => {
        // console.log(`[MOCK] Update ${path}/${id}:`, data);

        // Retrieve existing document
        let existingDoc = global[`${path}_${id}`] || {};

        // Update with new data
        global[`${path}_${id}`] = { ...existingDoc, ...data };

        // Also update our collections
        if (path === 'orders') {
          if (!global.mockOrders) {
            global.mockOrders = [];
          }

          // Update if exists
          const existingIndex = global.mockOrders.findIndex(o => o.id === id);
          if (existingIndex >= 0) {
            global.mockOrders[existingIndex] = {
              id,
              ...global.mockOrders[existingIndex],
              ...data
            };
          }
        }

        return { id };
      }
    }),
    add: async (data) => {
      // console.log(`[MOCK] Adding new document to collection: ${path}`);
      // console.log(`[MOCK] Data:`, data);

      // Generate a unique ID for the new document
      const newId = `${path.slice(0, -1)}-${Date.now()}`;

      // Store in appropriate collection
      if (path === 'products') {
        if (!global.mockProducts) global.mockProducts = [];
        global.mockProducts.push({ id: newId, ...data });
        // console.log(`[MOCK] Added product with ID: ${newId}`);
      } else if (path === 'orders') {
        if (!global.mockOrders) global.mockOrders = [];
        global.mockOrders.push({ id: newId, ...data });
        // console.log(`[MOCK] Added order with ID: ${newId}`);
      } else if (path === 'deliverySchedules') {
        if (!global.mockDeliverySchedules) global.mockDeliverySchedules = [];

        // For schedules, convert date to string if it's a date object
        const scheduleData = { ...data };
        if (scheduleData.date && typeof scheduleData.date.toISOString === 'function') {
          scheduleData.date = scheduleData.date.toISOString();
        }

        global.mockDeliverySchedules.push({ id: newId, ...scheduleData });
        // console.log(`[MOCK] Added delivery schedule with ID: ${newId}`);
      } else {
        // console.log(`[MOCK] Added document to collection ${path} with ID: ${newId}`);
      }

      // Store in global space
      global[`${path}_${newId}`] = data;

      // Return a mock DocumentReference
      return {
        id: newId,
        path: `${path}/${newId}`,
        get: async () => ({
          id: newId,
          exists: true,
          data: () => ({ id: newId, ...data }),
          ref: { id: newId, path: `${path}/${newId}` }
        })
      };
    },
    where: (field, operator, value) => ({
      orderBy: (orderField, direction) => ({
        get: async () => {
          let result = [];

          // Handle different collection queries
          if (path === 'orders' && global.mockOrders) {
            // Filter by field/operator/value
            if (field === 'createdAt' && operator === '>=') {
              // Convert value to timestamp for comparison if needed
              const compareTime = typeof value === 'object' && value.seconds
                ? value.seconds * 1000
                : value instanceof Date
                  ? value.getTime()
                  : new Date(value).getTime();

              result = global.mockOrders.filter(order => {
                const orderTime = order.createdAt && order.createdAt.seconds
                  ? order.createdAt.seconds * 1000
                  : order.createdAt instanceof Date
                    ? order.createdAt.getTime()
                    : new Date(order.createdAt).getTime();

                return orderTime >= compareTime;
              });
            } else if (field === 'userId' && operator === '==') {
              result = global.mockOrders.filter(order => order.userId === value);
            }

            // Sort if orderBy is specified
            if (orderField === 'createdAt') {
              result.sort((a, b) => {
                const timeA = a.createdAt && a.createdAt.seconds
                  ? a.createdAt.seconds * 1000
                  : a.createdAt instanceof Date
                    ? a.createdAt.getTime()
                    : new Date(a.createdAt).getTime();

                const timeB = b.createdAt && b.createdAt.seconds
                  ? b.createdAt.seconds * 1000
                  : b.createdAt instanceof Date
                    ? b.createdAt.getTime()
                    : new Date(b.createdAt).getTime();

                return direction === 'asc' ? timeA - timeB : timeB - timeA;
              });
            }
          }

          return {
            docs: result.map(item => ({
              id: item.id,
              data: () => item,
              exists: true
            })),
            forEach: (callback) => result.map(item => ({
              id: item.id,
              data: () => item
            })).forEach(callback),
            size: result.length
          };
        }
      }),
      get: async () => {
        // console.log(`[MOCK] Query ${path} with conditions:`, conditions);

        // Handle different collection types
        if (path === 'products' && global.mockProducts) {
          // For products - filter for active products
          const results = global.mockProducts.filter(product => {
            // Apply conditions if necessary
            if (conditions.length === 0) return true;
            return true; // For simplicity, return all products
          });
          return createQuerySnapshot(results);
        } else if (path === 'orders' && global.mockOrders) {
          // For orders - filter by conditions
          const results = global.mockOrders.filter(order => {
            if (conditions.length === 0) return true;
            return true; // For simplicity, return all orders
          });
          return createQuerySnapshot(results);
        } else if (path === 'deliverySchedules' && global.mockDeliverySchedules) {
          // For delivery schedules - filter by conditions
          const results = global.mockDeliverySchedules.filter(schedule => {
            if (conditions.length === 0) return true;
            return true; // For simplicity, return all schedules
          });
          return createQuerySnapshot(results);
        } else if (path === 'promotions' && global.mockPromotions) {
          // For promotions - filter by code and active status if specified
          const results = global.mockPromotions.filter(promo => {
            // Apply all conditions
            return conditions.every(condition => {
              const [field, operator, value] = condition;

              // Handle different operators
              if (operator === '==') {
                return promo[field] === value;
              } else if (operator === '!=') {
                return promo[field] !== value;
              }
              return true;
            });
          });
          return createQuerySnapshot(results);
        }

        return createQuerySnapshot([]);
      }
    }),
    orderBy: () => ({
      limit: (count) => ({
        get: async () => {
          let result = [];

          // Handle collections
          if (path === 'products' && global.mockProducts) {
            result = global.mockProducts;
          } else if (path === 'orders' && global.mockOrders) {
            result = global.mockOrders;
          }

          // Limit results
          result = result.slice(0, count);

          return {
            docs: result.map(item => ({
              id: item.id,
              data: () => item,
              exists: true
            })),
            forEach: (callback) => result.map(item => ({
              id: item.id,
              data: () => item
            })).forEach(callback),
            size: result.length
          };
        }
      }),
      get: async () => {
        let result = [];

        // Handle collections
        if (path === 'products' && global.mockProducts) {
          result = global.mockProducts;
        } else if (path === 'orders' && global.mockOrders) {
          result = global.mockOrders;
        } else if (path === 'deliverySchedules' && global.mockDeliverySchedules) {
          result = global.mockDeliverySchedules;
        } else if (path === 'promotions' && global.mockPromotions) {
          console.log(`[MOCK] Returning ${global.mockPromotions.length} mock promotions`);
          result = global.mockPromotions;
        }

        return {
          docs: result.map(item => ({
            id: item.id,
            data: () => item,
            exists: true
          })),
          forEach: (callback) => result.map(item => ({
            id: item.id,
            data: () => item
          })).forEach(callback),
          size: result.length
        };
      }
    }),
    get: async () => {
      let result = [];

      // Handle collections
      if (path === 'products' && global.mockProducts) {
        result = global.mockProducts;
      } else if (path === 'orders' && global.mockOrders) {
        result = global.mockOrders;
      } else if (path === 'deliverySchedules' && global.mockDeliverySchedules) {
        result = global.mockDeliverySchedules;
      } else if (path === 'promotions' && global.mockPromotions) {
        console.log(`[MOCK] Returning ${global.mockPromotions.length} mock promotions`);
        result = global.mockPromotions;
      }

      return {
        docs: result.map(item => ({
          id: item.id,
          data: () => item,
          exists: true
        })),
        forEach: (callback) => result.map(item => ({
          id: item.id,
          data: () => item
        })).forEach(callback),
        size: result.length
      };
    }
  }),

  // Fix the runTransaction implementation to properly handle collection and document paths
  runTransaction: async (transactionHandler) => {
    // console.log(`[MOCK] Running Firestore transaction`);

    // Create a mock transaction object that captures collection and document information
    const mockTransaction = {
      // Store the operations to perform
      operations: [],

      // Set method for transactions
      set: function (docRef, data) {
        // Extract path information from the document reference
        // console.log(`[MOCK Transaction Debug] DocRef:`, docRef);

        // Try to extract path components more reliably
        let collection = docRef.path ? docRef.path.split('/')[0] :
          (docRef._collectionPath ||
            (docRef.parent && docRef.parent.id) || 'unknown-collection');

        let doc = docRef.id || docRef._documentPath || 'unknown-document';

        // If we still don't have valid paths, try to extract from the data object itself
        // This is crucial for order operations since we know the ID is in the data
        if (collection === 'unknown-collection' && data) {
          // For orders, we can extract from the data
          if (data.id && data.id.startsWith('order-')) {
            collection = 'orders';
            doc = data.id;
            // console.log(`[MOCK Transaction] Extracted order information from data: ${collection}/${doc}`);
          }
        }

        // console.log(`[MOCK Transaction] Setting document ${collection}/${doc}`);

        // Store the operation
        this.operations.push({
          type: 'set',
          collection,
          doc,
          data
        });

        // Actually set the data in our global mock storage
        global[`${collection}_${doc}`] = data;

        // Store with alternate key format to ensure persistence
        if (collection === 'orders') {
          global[`mockOrder_${doc}`] = data;

          // Update mockOrders global array
          if (!global.mockOrders) {
            global.mockOrders = [];
          }

          // Check if order already exists
          const existingIndex = global.mockOrders.findIndex(o => o.id === doc);
          if (existingIndex >= 0) {
            global.mockOrders[existingIndex] = { ...data, id: doc };
          } else {
            global.mockOrders.push({ ...data, id: doc });
          }

          // console.log(`[MOCK Orders] Updated mockOrders, now has ${global.mockOrders.length} items`);
        }
      },

      // Update method for transactions
      update: function (docRef, data) {
        // Extract path information more reliably
        let collection = docRef.path ? docRef.path.split('/')[0] :
          (docRef._collectionPath ||
            (docRef.parent && docRef.parent.id) || 'unknown-collection');

        let doc = docRef.id || docRef._documentPath || 'unknown-document';

        // If we still don't have valid paths, try to extract from the data object or arguments
        if (collection === 'unknown-collection') {
          // For user updates with order references, we can infer the collection
          if (data && data.orders && data.orders.constructor && data.orders.constructor.name === 'ArrayUnionTransform') {
            collection = 'users';
            // Try to extract doc ID from docRef
            if (docRef && docRef.path && docRef.path.includes('/')) {
              doc = docRef.path.split('/')[1];
            }
            // console.log(`[MOCK Transaction] Inferred user collection for array update: ${collection}/${doc}`);
          }
        }

        // console.log(`[MOCK Transaction] Updating document ${collection}/${doc}:`, data);

        // Store the operation
        this.operations.push({
          type: 'update',
          collection,
          doc,
          data
        });

        // Retrieve existing document
        let existingDoc = global[`${collection}_${doc}`] || {};

        // Handle array union operation specially
        if (data.orders && data.orders.constructor && data.orders.constructor.name === 'ArrayUnionTransform') {
          // console.log(`[MOCK Transaction] Processing ArrayUnion operation`);
          if (!existingDoc.orders) {
            existingDoc.orders = [];
          }

          // Add each element that doesn't already exist
          data.orders.elements.forEach(element => {
            if (!existingDoc.orders.includes(element)) {
              existingDoc.orders.push(element);
            }
          });

          // Update the document without the ArrayUnionTransform
          const { orders, ...restData } = data;
          global[`${collection}_${doc}`] = { ...existingDoc, ...restData, orders: existingDoc.orders };
        } else {
          // Standard update
          global[`${collection}_${doc}`] = { ...existingDoc, ...data };
        }

        // If this is updating a user document
        if (collection === 'users') {
          // Ensure we have this mock user available for future operations
          global[`${collection}_${doc}`] = global[`${collection}_${doc}`] || {
            id: doc,
            role: doc.includes('admin') ? 'admin' : 'customer',
            name: doc.includes('admin') ? 'Admin User' : 'Test Customer',
            email: doc.includes('admin') ? 'admin@example.com' : 'customer@example.com',
            orders: []
          };
        }
      }
    };

    // Decorate document references with collection and document path information
    const originalCollection = mockFirestore.collection;
    const modifiedCollection = function (collectionPath) {
      // console.log(`[MOCK] Creating collection reference for path: ${collectionPath}`);
      const collectionRef = originalCollection(collectionPath);
      collectionRef.id = collectionPath;
      collectionRef.path = collectionPath;

      const originalDoc = collectionRef.doc;

      collectionRef.doc = function (docId) {
        // console.log(`[MOCK] Creating document reference for doc: ${collectionPath}/${docId}`);
        const docRef = originalDoc(docId);
        docRef._collectionPath = collectionPath;
        docRef._documentPath = docId;
        docRef.id = docId;
        docRef.path = `${collectionPath}/${docId}`;
        docRef.parent = { id: collectionPath, path: collectionPath };

        // Add properties needed for transactions
        const originalSet = docRef.set;
        docRef.set = function (data) {
          // console.log(`[MOCK] Setting document directly: ${collectionPath}/${docId}`);
          global[`${collectionPath}_${docId}`] = data;

          // Also store using order-specific key format
          if (collectionPath === 'orders') {
            global[`mockOrder_${docId}`] = data;

            // Update mockOrders array if it exists
            if (!global.mockOrders) {
              global.mockOrders = [];
            }

            const existingIndex = global.mockOrders.findIndex(o => o.id === docId);
            if (existingIndex >= 0) {
              global.mockOrders[existingIndex] = { ...data, id: docId };
            } else {
              global.mockOrders.push({ ...data, id: docId });
            }

            // console.log(`[MOCK Orders] Updated mockOrders from direct set, now has ${global.mockOrders.length} items`);
          }

          return originalSet(data);
        };

        return docRef;
      };

      return collectionRef;
    };

    // Temporarily replace collection method with our enhanced version
    mockFirestore.collection = modifiedCollection;

    try {
      // Call the transaction handler with our mock transaction
      await transactionHandler(mockTransaction);
      // console.log(`[MOCK] Transaction completed successfully`);

      // Execute all collected operations (already done inline above)
      return { status: 'success' };
    } catch (error) {
      // console.error(`[MOCK] Transaction failed:`, error);
      throw error;
    } finally {
      // Restore original collection method
      mockFirestore.collection = originalCollection;
    }
  }
};

// Add FieldValue to admin mock
if (!admin.firestore) {
  admin.firestore = {};
}
admin.firestore.FieldValue = {
  arrayUnion: (...elements) => ({
    _methodName: 'arrayUnion',
    elements
  })
};

const mockAuth = {
  verifyIdToken: async (token) => {
    // console.log('[MOCK] Verifying token:', token);

    // In development mode, accept these special tokens
    if (isDevelopment && (token === 'dev-token' || token.includes('admin-override'))) {
      // console.log('[MOCK] Using admin override token in development');
      return {
        uid: 'admin-user-dev',
        email: 'admin@example.com',
        role: 'admin'
      };
    }

    // If there's a real token sent but verification fails in dev mode,
    // extract a user ID from the token if possible
    try {
      // Simple check if it looks like a Firebase token (has a dot)
      if (token && token.includes('.')) {
        // Try to decode the first part of the JWT
        const payload = JSON.parse(Buffer.from(token.split('.')[1], 'base64').toString());
        if (payload && payload.user_id) {
          return { uid: payload.user_id };
        }
      }
    } catch (e) {
      // If parsing fails, fall back to mock ID
      // console.log('Failed to parse token, using mock user ID');
    }

    // Default mock user
    return { uid: 'mock-user-id' };
  }
};

// Start with real implementations when possible
let firestore = null;
let auth = null;
let bucket = null;

// Flag to track if we're using mock implementations
let usingMockImplementations = false; // Default to false - we want to try real data first

// Function to check if we're using mock Firebase
export function isMockFirebase() {
  return usingMockImplementations || global.useMockData;
}

// Track the initialization promise
let initializationPromise = null;

// Private variables for initialization status tracking
let isInitialized = false;

/**
 * Asynchronously initializes the Firebase Admin SDK
 * This ensures that we don't have multiple concurrent initialization attempts
 * @returns {Promise<admin>} The initialized firebase admin instance
 */
export async function initAdmin() {
  // If already initialized, return the admin instance immediately
  if (isInitialized) {
    return Promise.resolve(admin);
  }

  // If initialization is in progress, return the existing promise
  if (initializationPromise) {
    return initializationPromise;
  }

  // Start the initialization process
  initializationPromise = new Promise((resolve, reject) => {
    try {
      console.log('Firebase Admin: Starting initialization...');

      // Check if any apps are already initialized
      if (admin.apps.length === 0) {
        // For development with mock data
        if (global.useMockData) {
          console.log('Firebase Admin: Using mock data in development mode');
          setupMockFirestore(admin);
          isInitialized = true;
          return resolve(admin);
        }

        // For production or development with real Firebase
        const serviceAccount = getServiceAccount();

        const config = {
          databaseURL: process.env.NEXT_PUBLIC_FIREBASE_DATABASE_URL || `https://${process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID}.firebaseio.com`,
          storageBucket: process.env.NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET
        };

        if (serviceAccount) {
          console.log('Firebase Admin: Initializing with service account cert');
          config.credential = admin.credential.cert(serviceAccount);
          admin.initializeApp(config);
        } else if (process.env.FUNCTIONS_EMULATOR || process.env.FUNCTION_NAME || process.env.FIREBASE_CONFIG || process.env.K_SERVICE || process.env.K_REVISION) {
          // We are in a Firebase environment (either emulator or cloud)
          console.log('Firebase Admin: Initializing in Firebase environment (Functions/Cloud)');
          admin.initializeApp();
        } else {
          // Last resort fallback
          console.log('Firebase Admin: Initializing with applicationDefault');
          try {
            admin.initializeApp({
              ...config,
              credential: admin.credential.applicationDefault()
            });
          } catch (e) {
            console.warn('Firebase Admin: applicationDefault failed, trying simple initializeApp');
            admin.initializeApp(config);
          }
        }

        console.log('Firebase Admin: Successfully initialized Firebase Admin SDK');
      } else {
        console.log('Firebase Admin: Already initialized, reusing existing app');
      }

      isInitialized = true;
      resolve(admin);
    } catch (error) {
      console.error('Firebase Admin: Initialization error:', error);
      initializationPromise = null; // Reset for retry
      reject(error);
    }
  });

  return initializationPromise;
}

/**
 * Get the Firebase service account credentials
 * This handles different environments (Vercel, local dev, etc.)
 */
function getServiceAccount() {
  // For Vercel and other environments that use environment variables
  if (process.env.FIREBASE_SERVICE_ACCOUNT_KEY) {
    try {
      return JSON.parse(process.env.FIREBASE_SERVICE_ACCOUNT_KEY);
    } catch (error) {
      console.error('Firebase Admin: Error parsing service account JSON', error);
      return null;
    }
  }

  // For local development with service account file
  try {
    const serviceAccountPath = path.join(process.cwd(), 'service-account.json');
    if (fs.existsSync(serviceAccountPath)) {
      return JSON.parse(fs.readFileSync(serviceAccountPath, 'utf8'));
    }
    return null;
  } catch (error) {
    console.warn('Firebase Admin: Error reading service account file', error);
    return null;
  }
}

// Mock Firestore functionality for development
function setupMockFirestore(adminInstance) {
  // Add mockFirestore to admin object
  adminInstance.mockFirestore = mockFirestore;
  return mockFirestore;
}

// Initialize Storage bucket if possible
try {
  bucket = admin.storage().bucket();
  console.log('✅ Firebase Storage bucket initialized:', bucket.name);
} catch (error) {
  console.warn('⚠️ Could not initialize Firebase Storage bucket:', error.message);
}

// Initialize firestore and auth with proper async initialization
export async function getFirestore() {
  await initAdmin();
  if (!firestore) {
    try {
      firestore = admin.firestore();
    } catch (error) {
      console.error('Firebase Admin: Error initializing Firestore:', error);
      if (isDevelopment) {
        console.log('Firebase Admin: Using mock Firestore in development');
        usingMockImplementations = true;
        firestore = mockFirestore;
      } else {
        throw error;
      }
    }
  }
  return firestore;
}

export async function getAuth() {
  await initAdmin();
  if (!auth) {
    try {
      auth = admin.auth();
    } catch (error) {
      console.error('Firebase Admin: Error initializing Auth:', error);
      if (isDevelopment) {
        console.log('Firebase Admin: Using mock Auth in development');
        usingMockImplementations = true;
        auth = mockAuth;
      } else {
        throw error;
      }
    }
  }
  return auth;
}

// Export firestore and auth for compatibility but with warning
export { firestore, auth };

// Also export firestore as db for compatibility with older code
export const db = firestore;

// Export function to create mock schedules for development
export function createMockDeliverySchedules() {
  console.log('Creating mock delivery schedules');

  const now = new Date();
  const tomorrow = new Date(now);
  tomorrow.setDate(tomorrow.getDate() + 1);

  const nextWeek = new Date(now);
  nextWeek.setDate(nextWeek.getDate() + 7);

  return [
    {
      id: 'test-schedule-1',
      date: tomorrow.toISOString(),
      slots: [
        { id: 'morning', name: 'Morning', time: '9am - 12pm', available: true, maxOrders: 2, currentOrders: 0 },
        { id: 'afternoon', name: 'Afternoon', time: '1pm - 5pm', available: true, maxOrders: 3, currentOrders: 0 }
      ],
      zipCodes: ['12345', '23456', '34567'],
      cutoffTime: '6pm day before',
      googleCalendarEventId: 'mock-event-1'
    },
    {
      id: 'test-schedule-2',
      date: nextWeek.toISOString(),
      slots: [
        { id: 'morning', name: 'Morning', time: '9am - 12pm', available: true, maxOrders: 2, currentOrders: 0 },
        { id: 'afternoon', name: 'Afternoon', time: '1pm - 5pm', available: true, maxOrders: 3, currentOrders: 0 }
      ],
      zipCodes: ['12345', '23456', '34567'],
      cutoffTime: '6pm day before',
      googleCalendarEventId: 'mock-event-2'
    }
  ];
}

// Set global flags for use in API routes
global.usingFirebaseMock = usingMockImplementations;

// Legacy initAdminAsync function for backward compatibility
export const initAdminAsync = initAdmin;

export default admin;

// Helper function to create mock query snapshots
function createQuerySnapshot(items) {
  return {
    docs: items.map(item => ({
      id: item.id,
      exists: true,
      data: () => item,
      ref: { id: item.id }
    })),
    empty: items.length === 0,
    size: items.length,
    forEach: (callback) => items.forEach((item, index) => {
      callback({
        id: item.id,
        exists: true,
        data: () => item,
        ref: { id: item.id }
      }, index);
    })
  };
}