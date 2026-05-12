import { createWebhookHandler } from '../../../modules/stripe';
import firebase from '../../../lib/firebase-admin'; // This will be replaced with a generic db interface

// This is a placeholder for a generic db interface
const db = {
  updateOrderByPaymentIntent: async (paymentIntentId, data) => {
    const ordersRef = firebase.firestore().collection('orders');
    const snapshot = await ordersRef.where('paymentIntentId', '==', paymentIntentId).get();
    if (snapshot.empty) {
      console.log(`No orders found for payment intent ${paymentIntentId}`);
      return;
    }
    const batch = firebase.firestore().batch();
    snapshot.forEach(doc => {
      batch.update(doc.ref, data);
    });
    await batch.commit();
  }
};

export default createWebhookHandler(db);