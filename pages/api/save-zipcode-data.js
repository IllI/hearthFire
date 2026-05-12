import fs from 'fs';
import path from 'path';
import admin from '../../lib/firebase-admin';

export default async function handler(req, res) {
  // Set CORS headers for cross-origin requests
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  // Handle preflight request
  if (req.method === 'OPTIONS') {
    res.status(200).end();
    return;
  }
  
  // Only handle POST requests
  if (req.method !== 'POST') {
    res.status(405).json({ error: 'Method not allowed' });
    return;
  }

  try {
    const data = req.body;
    
    // Validate that the data is GeoJSON
    if (!data || !data.type || data.type !== 'FeatureCollection' || !Array.isArray(data.features)) {
      res.status(400).json({ error: 'Invalid GeoJSON data' });
      return;
    }
    
    // Save the GeoJSON to a file
    const filePath = path.join(process.cwd(), 'public', 'atlanta-zipcodes.json');
    fs.writeFileSync(filePath, JSON.stringify(data));
    console.log('Saved zipcode data to:', filePath);
    
    // Also update the cache in Firestore
    try {
      const db = admin.firestore();
      await db.collection('system').doc('zipcodes').set({
        geojson: data,
        updatedAt: admin.firestore.FieldValue.serverTimestamp()
      });
      console.log('Updated Firestore cache with new zipcode data');
    } catch (firestoreError) {
      console.error('Error updating Firestore:', firestoreError);
      // Continue without failing the whole request
    }
    
    res.status(200).json({ 
      success: true, 
      message: 'Zipcode data saved successfully',
      featureCount: data.features.length
    });
  } catch (error) {
    console.error('Error saving zipcode data:', error);
    res.status(500).json({ error: 'Failed to save zipcode data' });
  }
} 