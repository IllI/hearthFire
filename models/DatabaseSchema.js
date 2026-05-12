/**
 * Firestore Database Schema for Hearthfire Farm
 * This file serves as documentation for the database structure
 */

const schema = {
  products: {
    productId: {
      name: 'String', // Product name
      description: 'String', // Product description
      price: 'Number', // Price in cents
      images: ['String'], // Array of image URLs
      category: 'String', // e.g., 'vegetables', 'fruits', 'dairy'
      quantity: 'Number', // Current inventory count - Original field name in the database
      stock: 'Number', // Current inventory count - Alternative field name, synced with quantity
      unit: 'String', // e.g., 'lb', 'oz', 'each'
      organic: 'Boolean', // Is this product organic?
      featured: 'Boolean', // Should this be featured on homepage?
      availableDates: [{ // Dates when this product is available for delivery
        date: 'Timestamp',
        availableQuantity: 'Number'
      }],
      nutrition: {
        calories: 'Number',
        protein: 'Number',
        carbs: 'Number',
        fat: 'Number'
      },
      createdAt: 'Timestamp',
      updatedAt: 'Timestamp'
    }
  },
  
  categories: {
    categoryId: {
      name: 'String',
      description: 'String',
      image: 'String',
      order: 'Number', // For controlling display order
      createdAt: 'Timestamp'
    }
  },
  
  users: {
    userId: {
      email: 'String',
      name: 'String',
      phone: 'String',
      address: {
        street: 'String',
        city: 'String',
        state: 'String',
        zip: 'String',
        coordinates: {
          latitude: 'Number',
          longitude: 'Number'
        }
      },
      role: 'String', // 'customer', 'admin'
      orderHistory: ['OrderReference'],
      favoriteProducts: ['ProductReference'],
      createdAt: 'Timestamp'
    }
  },
  
  orders: {
    orderId: {
      userId: 'String',
      items: [{
        productId: 'String',
        name: 'String',
        price: 'Number',
        quantity: 'Number',
        subtotal: 'Number'
      }],
      subtotal: 'Number',
      tax: 'Number',
      deliveryFee: 'Number',
      total: 'Number',
      status: 'String', // 'pending', 'processing', 'delivered', 'cancelled'
      paymentStatus: 'String', // 'pending', 'paid', 'failed', 'refunded'
      paymentMethod: 'String',
      paymentId: 'String', // Reference to payment processor
      deliveryDate: 'Timestamp',
      deliveryTimeSlot: 'String', // e.g., 'morning', 'afternoon'
      deliveryInstructions: 'String',
      createdAt: 'Timestamp',
      updatedAt: 'Timestamp'
    }
  },
  
  deliverySchedules: {
    scheduleId: {
      date: 'Timestamp',
      slots: [{
        time: 'String', // e.g., '9am-12pm'
        maxOrders: 'Number',
        currentOrders: 'Number',
        available: 'Boolean'
      }],
      cutoffTime: 'Timestamp', // Order deadline for this delivery date
      zipCodes: ['String'], // Zip codes available for this date
      note: 'String' // Any special notes for this delivery date
    }
  }
};

export default schema; 