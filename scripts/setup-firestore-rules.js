/*
  FIRESTORE SECURITY RULES SETUP GUIDE
  
  You're experiencing "Missing or insufficient permissions" errors because your Firestore database needs proper setup.
  
  STEP 1: CREATE A FIRESTORE DATABASE
  -----------------------------
  1. Go to https://console.firebase.google.com/project/hearthfire-farms/firestore
  2. Click "Create database"
  3. Choose "Start in test mode" (this allows all reads and writes for 30 days)
  4. Select a region close to your users (US regions are often good defaults)
  5. Click "Enable"

  STEP 2: IF YOU STILL HAVE PERMISSIONS ISSUES
  -----------------------------
  1. Go to https://console.firebase.google.com/project/hearthfire-farms/firestore/rules
  2. Make sure your rules look like this (test mode):
  
  ```
  rules_version = '2';
  service cloud.firestore {
    match /databases/{database}/documents {
      match /{document=**} {
        allow read, write: if true;
      }
    }
  }
  ```
  
  3. Click "Publish"
  
  IMPORTANT: Test mode rules allow ANYONE to read and write to your database.
  Only use these rules for development and NEVER in production.
  
  -----------------------------
  
  Once your app is working properly, you should update to the production rules:
  
  ```
  rules_version = '2';
  service cloud.firestore {
    match /databases/{database}/documents {
      // Allow public read access to products
      match /products/{productId} {
        allow read: if true;
        allow write: if request.auth != null && get(/databases/$(database)/documents/users/$(request.auth.uid)).data.role == 'admin';
      }
      
      // Allow read/write to user's own document
      match /users/{userId} {
        allow read: if request.auth != null && (request.auth.uid == userId || get(/databases/$(database)/documents/users/$(request.auth.uid)).data.role == 'admin');
        allow create: if request.auth != null && request.auth.uid == userId;
        allow update: if request.auth != null && (request.auth.uid == userId || get(/databases/$(database)/documents/users/$(request.auth.uid)).data.role == 'admin');
      }
      
      // Allow users to read/write their own orders
      match /orders/{orderId} {
        allow read: if request.auth != null && (resource.data.userId == request.auth.uid || get(/databases/$(database)/documents/users/$(request.auth.uid)).data.role == 'admin');
        allow create: if request.auth != null;
        allow update: if request.auth != null && get(/databases/$(database)/documents/users/$(request.auth.uid)).data.role == 'admin';
      }
      
      // Allow public read access to categories
      match /categories/{categoryId} {
        allow read: if true;
        allow write: if request.auth != null && get(/databases/$(database)/documents/users/$(request.auth.uid)).data.role == 'admin';
      }
    }
  }
  ```
*/

console.log("=== FIRESTORE DATABASE SETUP ===");
console.log("1. Please go to: https://console.firebase.google.com/project/hearthfire-farms/firestore");
console.log("2. Create a database in TEST MODE");
console.log("3. After setting up, run: npm run seed-db");
console.log("4. Start your app with: npm run dev");
console.log(""); 
console.log("For full instructions, view this file: scripts/setup-firestore-rules.js");
console.log("================================="); 