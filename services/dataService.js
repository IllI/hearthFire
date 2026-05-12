import { db, storage } from '../lib/firebase';
import { collection, getDocs, addDoc, doc, getDoc, updateDoc, deleteDoc, query, orderBy, limit, where, Timestamp, serverTimestamp } from 'firebase/firestore';
import { ref, uploadBytes, getDownloadURL, deleteObject } from 'firebase/storage';

// Products
export async function getProducts() {
  const querySnapshot = await getDocs(collection(db, "products"));
  return querySnapshot.docs.map(doc => ({
    id: doc.id,
    ...doc.data()
  }));
}

export async function getProductById(productId) {
  const docRef = doc(db, "products", productId);
  const docSnap = await getDoc(docRef);
  
  if (docSnap.exists()) {
    return {
      id: docSnap.id,
      ...docSnap.data()
    };
  } else {
    return null;
  }
}

export async function getFeaturedProducts(count = 4) {
  const productsRef = collection(db, "products");
  const q = query(
    productsRef, 
    where("featured", "==", true),
    limit(count)
  );
  const querySnapshot = await getDocs(q);
  
  return querySnapshot.docs.map(doc => ({
    id: doc.id,
    ...doc.data()
  }));
}

export async function addProduct(productData) {
  const docRef = await addDoc(collection(db, "products"), {
    ...productData,
    createdAt: serverTimestamp()
  });
  
  return {
    id: docRef.id,
    ...productData
  };
}

export async function updateProduct(productId, productData) {
  const productRef = doc(db, "products", productId);
  await updateDoc(productRef, {
    ...productData,
    updatedAt: serverTimestamp()
  });
  
  return {
    id: productId,
    ...productData
  };
}

export async function deleteProduct(productId) {
  await deleteDoc(doc(db, "products", productId));
  return { success: true };
}

// Helper for image uploads
export async function uploadProductImage(file) {
  const storageRef = ref(storage, `products/${Date.now()}_${file.name}`);
  await uploadBytes(storageRef, file);
  return await getDownloadURL(storageRef);
}

export async function deleteProductImage(imageUrl) {
  try {
    // Extract the path from the URL
    const imageRef = ref(storage, imageUrl);
    await deleteObject(imageRef);
    return { success: true };
  } catch (error) {
    console.error("Error deleting image:", error);
    return { success: false, error: error.message };
  }
}

// Orders
export async function getOrders() {
  const querySnapshot = await getDocs(collection(db, "orders"));
  return querySnapshot.docs.map(doc => ({
    id: doc.id,
    ...doc.data()
  }));
}

export async function getOrdersByUserId(userId) {
  const ordersRef = collection(db, "orders");
  const q = query(
    ordersRef,
    where("userId", "==", userId),
    orderBy("createdAt", "desc")
  );
  
  const querySnapshot = await getDocs(q);
  return querySnapshot.docs.map(doc => ({
    id: doc.id,
    ...doc.data()
  }));
}

export async function createOrder(orderData) {
  const docRef = await addDoc(collection(db, "orders"), {
    ...orderData,
    createdAt: serverTimestamp(),
    status: "pending"
  });
  
  return {
    id: docRef.id,
    ...orderData
  };
}

// Categories
export async function getCategories() {
  const querySnapshot = await getDocs(collection(db, "categories"));
  return querySnapshot.docs.map(doc => ({
    id: doc.id,
    ...doc.data()
  }));
}

export async function addCategory(categoryData) {
  const docRef = await addDoc(collection(db, "categories"), {
    ...categoryData,
    createdAt: serverTimestamp()
  });
  
  return {
    id: docRef.id,
    ...categoryData
  };
}

// Additional methods for orders, delivery schedules, etc. 