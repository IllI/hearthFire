// Script to seed the Firestore database with initial test products
const { initializeApp } = require('firebase/app');
const { getFirestore, collection, addDoc, serverTimestamp } = require('firebase/firestore');
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

// Sample product data
const sampleProducts = [
  {
    name: 'Fresh Organic Carrots',
    description: 'Locally grown organic carrots, harvested at peak freshness.',
    price: 3.99,
    image: 'https://images.unsplash.com/photo-1447175008436-054170c2e979?q=80&w=2942&auto=format&fit=crop',
    quantity: 50,
    category: 'vegetables',
    featured: true,
    unit: 'bunch'
  },
  {
    name: 'Red Delicious Apples',
    description: 'Sweet and crisp apples perfect for snacking or baking.',
    price: 4.99,
    image: 'https://images.unsplash.com/photo-1560806887-1e4cd0b6cbd6?q=80&w=3174&auto=format&fit=crop',
    quantity: 100,
    category: 'fruits',
    featured: true,
    unit: 'lb'
  },
  {
    name: 'Fresh Spinach',
    description: 'Nutrient-rich spinach leaves, perfect for salads and cooking.',
    price: 2.99,
    image: 'https://images.unsplash.com/photo-1576045057995-568f588f82fb?q=80&w=3000&auto=format&fit=crop',
    quantity: 30,
    category: 'vegetables',
    featured: false,
    unit: 'bunch'
  },
  {
    name: 'Heirloom Tomatoes',
    description: 'Colorful, flavorful heirloom tomatoes grown without pesticides.',
    price: 5.99,
    image: 'https://images.unsplash.com/photo-1582284540020-8acbe03f4924?q=80&w=3000&auto=format&fit=crop',
    quantity: 40,
    category: 'vegetables',
    featured: true,
    unit: 'lb'
  },
  {
    name: 'Fresh Strawberries',
    description: 'Sweet, juicy strawberries picked at the peak of ripeness.',
    price: 6.99,
    image: 'https://images.unsplash.com/photo-1543158181-e6f9f6712055?q=80&w=3000&auto=format&fit=crop',
    quantity: 25,
    category: 'fruits',
    featured: true,
    unit: 'basket'
  },
  {
    name: 'Organic Kale',
    description: 'Fresh, crisp kale leaves rich in vitamins and minerals.',
    price: 3.49,
    image: 'https://images.unsplash.com/photo-1615232934385-9a49b9b0743e?q=80&w=3174&auto=format&fit=crop',
    quantity: 35,
    category: 'vegetables',
    featured: false,
    unit: 'bunch'
  }
];

// Sample categories
const sampleCategories = [
  {
    name: 'Vegetables',
    slug: 'vegetables',
    description: 'Fresh, locally grown vegetables',
    image: 'https://images.unsplash.com/photo-1540420773420-3366772f4999?q=80&w=3184&auto=format&fit=crop'
  },
  {
    name: 'Fruits',
    slug: 'fruits',
    description: 'Sweet and delicious seasonal fruits',
    image: 'https://images.unsplash.com/photo-1619566636858-adf3ef46400b?q=80&w=3000&auto=format&fit=crop'
  },
  {
    name: 'Dairy',
    slug: 'dairy',
    description: 'Fresh dairy products from local farms',
    image: 'https://images.unsplash.com/photo-1628088062854-d1870b4553da?q=80&w=3000&auto=format&fit=crop'
  }
];

// Function to add products to Firestore
async function seedProducts() {
  console.log('Starting to seed products...');

  try {
    // Add products
    for (const product of sampleProducts) {
      const docRef = await addDoc(collection(db, 'products'), {
        ...product,
        createdAt: serverTimestamp()
      });
      console.log(`Added product: ${product.name} with ID: ${docRef.id}`);
    }

    // Add categories
    for (const category of sampleCategories) {
      const docRef = await addDoc(collection(db, 'categories'), {
        ...category,
        createdAt: serverTimestamp()
      });
      console.log(`Added category: ${category.name} with ID: ${docRef.id}`);
    }

    console.log('Database seeding completed successfully!');
  } catch (error) {
    console.error('Error seeding database:', error);
  }
}

// Run the seeding function
seedProducts(); 