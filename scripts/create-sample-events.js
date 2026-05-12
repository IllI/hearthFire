const admin = require('firebase-admin');
const serviceAccount = require('../firebase-credentials.json');

// Initialize Firebase Admin
if (!admin.apps.length) {
  admin.initializeApp({
    credential: admin.credential.cert(serviceAccount)
  });
}

const db = admin.firestore();

// Sample events data
const sampleEvents = [
  // Delivery Events
  {
    type: 'delivery',
    date: admin.firestore.Timestamp.fromDate(new Date(Date.now() + 2 * 24 * 60 * 60 * 1000)), // 2 days from now
    description: 'Standard delivery day for all zip codes in our delivery area'
  },
  {
    type: 'delivery',
    date: admin.firestore.Timestamp.fromDate(new Date(Date.now() + 9 * 24 * 60 * 60 * 1000)), // 9 days from now
    description: 'Standard delivery day for all zip codes in our delivery area'
  },
  {
    type: 'delivery',
    date: admin.firestore.Timestamp.fromDate(new Date(Date.now() + 16 * 24 * 60 * 60 * 1000)), // 16 days from now
    description: 'Standard delivery day for all zip codes in our delivery area'
  },
  
  // Pickup Events - Location 1 (Farmers Market)
  {
    type: 'pickup',
    date: admin.firestore.Timestamp.fromDate(new Date(Date.now() + 3 * 24 * 60 * 60 * 1000)), // 3 days from now
    description: 'Pickup your order at East Atlanta Village Farmers Market',
    location: {
      id: 'eav-market',
      name: 'East Atlanta Village Farmers Market',
      address: '572 Stokeswood Ave SE, Atlanta, GA 30316',
      lat: 33.7370,
      lng: -84.3395
    }
  },
  {
    type: 'pickup',
    date: admin.firestore.Timestamp.fromDate(new Date(Date.now() + 10 * 24 * 60 * 60 * 1000)), // 10 days from now
    description: 'Pickup your order at East Atlanta Village Farmers Market',
    location: {
      id: 'eav-market',
      name: 'East Atlanta Village Farmers Market',
      address: '572 Stokeswood Ave SE, Atlanta, GA 30316',
      lat: 33.7370,
      lng: -84.3395
    }
  },
  
  // Pickup Events - Location 2 (Farm Stand)
  {
    type: 'pickup',
    date: admin.firestore.Timestamp.fromDate(new Date(Date.now() + 5 * 24 * 60 * 60 * 1000)), // 5 days from now
    description: 'Pickup your order at Hearthfire Farm Stand',
    location: {
      id: 'farm-stand',
      name: 'Hearthfire Farm Stand',
      address: '1234 Main St, Decatur, GA 30030',
      lat: 33.7748,
      lng: -84.2963
    }
  },
  {
    type: 'pickup',
    date: admin.firestore.Timestamp.fromDate(new Date(Date.now() + 12 * 24 * 60 * 60 * 1000)), // 12 days from now
    description: 'Pickup your order at Hearthfire Farm Stand',
    location: {
      id: 'farm-stand',
      name: 'Hearthfire Farm Stand',
      address: '1234 Main St, Decatur, GA 30030',
      lat: 33.7748,
      lng: -84.2963
    }
  }
];

// Add events to Firestore
async function addSampleEvents() {
  try {
    // First, clear existing events
    const eventsRef = db.collection('events');
    const snapshot = await eventsRef.get();
    
    console.log(`Deleting ${snapshot.size} existing events...`);
    
    const batch = db.batch();
    snapshot.docs.forEach(doc => {
      batch.delete(doc.ref);
    });
    
    await batch.commit();
    console.log('Existing events deleted');
    
    // Add new sample events
    console.log(`Adding ${sampleEvents.length} sample events...`);
    
    for (const event of sampleEvents) {
      await eventsRef.add(event);
    }
    
    console.log('Sample events added successfully');
  } catch (error) {
    console.error('Error:', error);
  }
}

// Run the function
addSampleEvents()
  .then(() => process.exit(0))
  .catch(error => {
    console.error('Error:', error);
    process.exit(1);
  }); 