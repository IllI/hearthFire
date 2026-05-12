import { createPaymentIntentHandler } from '../../../modules/stripe';
import firebaseAdmin from '../../../lib/firebase-admin';

// This is a placeholder for a generic db interface
const db = {
  verifyIdToken: (token) => firebaseAdmin.auth().verifyIdToken(token),
  getOrder: async (orderId) => {
    const doc = await firebaseAdmin.firestore().collection('orders').doc(orderId).get();
    return doc.exists ? doc.data() : null;
  },
  updateOrder: (orderId, data) => firebaseAdmin.firestore().collection('orders').doc(orderId).update(data),
};

export default createPaymentIntentHandler(db);