// Email Service for Hearthfire Farm
// Handles sending automated emails to customers and admins

const nodemailer = require('nodemailer');
const { formatDeliveryDate, formatPhoneNumber } = require('../utils/formatters');

// Email configuration
let transporter = null;
let isUsingFallback = false;

// Initialize email transporter
const initializeTransporter = async () => {
  if (transporter) return transporter;

  // Email configuration - typically stored in environment variables
  // These will need to be set in your environment or .env file
  const config = {
    host: process.env.EMAIL_HOST || 'mail.spacemail.com', // Updated to match Spaceship config
    port: parseInt(process.env.EMAIL_PORT || '465'),      // Updated to use SSL port
    secure: process.env.EMAIL_SECURE === 'true',          // Should be true for port 465
    auth: {
      user: process.env.EMAIL_USER || 'info@hearthfirefarm.com',
      pass: process.env.EMAIL_PASSWORD ? process.env.EMAIL_PASSWORD.trim() : undefined
    },
    // Debug output for troubleshooting but hide sensitive info
    debug: process.env.NODE_ENV === 'development',
    logger: process.env.NODE_ENV === 'development',
    // Add timeout options for reliability
    connectionTimeout: 10000, // 10 seconds
    greetingTimeout: 10000,
    // For SSL connections, we don't need opportunisticTLS
    opportunisticTLS: false,
    // SSL already provides encryption
    tls: {
      rejectUnauthorized: true 
    },
    authMethod: 'LOGIN'
  };

  console.log(`Email service initializing with host: ${config.host}, port: ${config.port}, user: ${config.auth.user}`);
  
  // For development mode, use ethereal.email for testing if no password is provided
  if (process.env.NODE_ENV === 'development' && !process.env.EMAIL_PASSWORD) {
    console.log('No email password provided - using test email account for development');
    return await createTestAccount();
  }

  // Attempt to create the transporter with the primary configuration
  try {
    transporter = nodemailer.createTransport(config);
    console.log('Email transporter created successfully');
    
    // Verify the connection
    try {
      await transporter.verify();
      console.log('SMTP connection verified successfully');
      return transporter;
    } catch (verifyError) {
      console.error('Connection verification failed:', verifyError.message);
      throw verifyError;
    }
  } catch (primaryError) {
    console.error('Failed to create email transporter with primary config:', primaryError.message);
    
    // Try with an alternative SMTP server configuration
    try {
      console.log('Attempting with alternative SMTP server...');
      
      // Try different connection parameters while keeping the same server
      let alternativeConfigs = [
        { 
          ...config, 
          port: 465, 
          secure: true,
          tls: { rejectUnauthorized: false }
        },
        { 
          ...config, 
          authMethod: 'LOGIN',
          tls: { rejectUnauthorized: false }
        },
        { 
          ...config, 
          port: 25, 
          secure: false,
          tls: { rejectUnauthorized: false }
        }
      ];
      
      for (const altConfig of alternativeConfigs) {
        try {
          console.log(`Trying alternative config: port=${altConfig.port}, secure=${altConfig.secure}, authMethod=${altConfig.authMethod}`);
          
          const altTransporter = nodemailer.createTransport(altConfig);
          await altTransporter.verify();
          console.log(`Connected successfully with alternative config: port=${altConfig.port}, secure=${altConfig.secure}`);
          transporter = altTransporter;
          return transporter;
        } catch (configError) {
          console.error(`Failed with alternative config:`, configError.message);
          // Continue to next configuration
        }
      }
      
      // If primary server failed, try alternative servers
      let alternativeHosts = [
        { host: 'smtp.spaceship.com', port: 587, secure: false },
        { host: 'mail.hearthfirefarm.com', port: 587, secure: false },
        { host: 'smtp.hearthfirefarm.com', port: 587, secure: false },
        { host: 'outgoing.spaceship.com', port: 587, secure: false },
      ];
      
      for (const alternative of alternativeHosts) {
        try {
          console.log(`Trying alternative host: ${alternative.host}:${alternative.port}`);
          
          const altConfig = {
            ...config,
            host: alternative.host,
            port: alternative.port,
            secure: alternative.secure,
            tls: { rejectUnauthorized: false }
          };
          
          const altTransporter = nodemailer.createTransport(altConfig);
          await altTransporter.verify();
          console.log(`Connected successfully to alternative SMTP server: ${alternative.host}`);
          transporter = altTransporter;
          return transporter;
        } catch (hostError) {
          console.error(`Failed to connect to ${alternative.host}:`, hostError.message);
          // Continue to next alternative
        }
      }
      
      // If we reach here, none of the alternatives worked
      throw new Error('All alternative SMTP servers failed');
    } catch (altError) {
      console.error('Failed to connect to all alternative SMTP servers:', altError.message);
      
      // Finally, fall back to Ethereal for testing purposes
      console.log('Falling back to Ethereal email testing service');
      isUsingFallback = true;
      return await createTestAccount();
    }
  }
};

// For development: create a test account with ethereal.email
const createTestAccount = async () => {
  try {
    // Generate test SMTP service account
    const testAccount = await nodemailer.createTestAccount();
    
    // Create a test transporter
    transporter = nodemailer.createTransport({
      host: 'smtp.ethereal.email',
      port: 587,
      secure: false,
      auth: {
        user: testAccount.user,
        pass: testAccount.pass
      }
    });
    
    console.log('Created test email account:', testAccount.user);
    isUsingFallback = true;
    return transporter;
  } catch (error) {
    console.error('Failed to create test email account:', error);
    throw error;
  }
};

// Format order items for email display
const formatOrderItems = (items) => {
  if (!items || !Array.isArray(items) || items.length === 0) {
    return '<p>No items found in order</p>';
  }
  
  const itemsHtml = items.map(item => `
    <tr>
      <td style="padding: 8px; border-bottom: 1px solid #ddd;">${item.name}</td>
      <td style="padding: 8px; border-bottom: 1px solid #ddd; text-align: center;">${item.quantity}</td>
      <td style="padding: 8px; border-bottom: 1px solid #ddd; text-align: right;">$${parseFloat(item.price).toFixed(2)}</td>
      <td style="padding: 8px; border-bottom: 1px solid #ddd; text-align: right;">$${(parseFloat(item.price) * parseInt(item.quantity)).toFixed(2)}</td>
    </tr>
  `).join('');
  
  return `
    <table style="width: 100%; border-collapse: collapse; margin-bottom: 20px;">
      <thead>
        <tr style="background-color: #f2f2f2;">
          <th style="padding: 10px; text-align: left;">Item</th>
          <th style="padding: 10px; text-align: center;">Quantity</th>
          <th style="padding: 10px; text-align: right;">Price</th>
          <th style="padding: 10px; text-align: right;">Total</th>
        </tr>
      </thead>
      <tbody>
        ${itemsHtml}
      </tbody>
    </table>
  `;
};

// Generate HTML for order summary section
const generateOrderSummary = (order) => {
  // Determine the fee based on order type
  const feeAmount = order.orderType === 'pickup' ? 0 : (order.deliveryFee || 10.00);
  
  // Calculate the correct total
  const total = parseFloat(order.subtotal || 0) + parseFloat(feeAmount) + parseFloat(order.tax || 0);
  
  return `
    <div style="margin-top: 20px; margin-bottom: 20px; padding: 15px; background-color: #f8f8f8; border-radius: 5px;">
      <h3 style="margin-top: 0;">Order Summary</h3>
      <p>
        <strong>Subtotal:</strong> $${parseFloat(order.subtotal || 0).toFixed(2)}<br>
        <strong>${order.orderType === 'pickup' ? 'Pickup' : 'Delivery'} Fee:</strong> $${parseFloat(feeAmount).toFixed(2)}<br>
        <strong>Tax:</strong> $${parseFloat(order.tax || 0).toFixed(2)}<br>
        <strong>Total:</strong> $${parseFloat(total).toFixed(2)}
      </p>
    </div>
  `;
};

// Generate HTML for pickup info
const generatePickupInfo = (order) => {
  if (!order.pickupInfo) return '';
  
  const pickupDate = order.pickupInfo.date 
    ? formatDeliveryDate(order.pickupInfo.date)
    : 'Not specified';
  
  return `
    <div style="margin-top: 20px; margin-bottom: 20px; padding: 15px; background-color: #f8f8f8; border-radius: 5px;">
      <h3 style="margin-top: 0;">Pickup Information</h3>
      <p>
        <strong>Location:</strong> ${order.pickupInfo.locationName || 'Not specified'}<br>
        <strong>Address:</strong> ${order.pickupInfo.address || 'Not specified'}<br>
        <strong>Date:</strong> ${pickupDate}<br>
        <strong>Time:</strong> ${order.pickupInfo.time || '9:00 AM - 2:00 PM'}<br>
        ${order.pickupInfo.instructions ? `<strong>Instructions:</strong> ${order.pickupInfo.instructions}<br>` : ''}
      </p>
    </div>
  `;
};

// Generate HTML for delivery info
const generateDeliveryInfo = (order) => {
  if (!order.deliveryInfo) return '';
  
  const deliveryDate = order.deliveryInfo.date 
    ? formatDeliveryDate(order.deliveryInfo.date)
    : 'Not specified';
  
  const address = order.deliveryInfo.address ? 
    `${order.deliveryInfo.address.street || ''}, 
     ${order.deliveryInfo.address.city || ''}, 
     ${order.deliveryInfo.address.state || ''} 
     ${order.deliveryInfo.address.zip || ''}` 
    : 'Not specified';
  
  return `
    <div style="margin-top: 20px; margin-bottom: 20px; padding: 15px; background-color: #f8f8f8; border-radius: 5px;">
      <h3 style="margin-top: 0;">Delivery Information</h3>
      <p>
        <strong>Address:</strong> ${address}<br>
        <strong>Date:</strong> ${deliveryDate}<br>
        <strong>Time Slot:</strong> ${order.deliveryInfo.timeSlot || 'Not specified'}<br>
        ${order.deliveryInfo.instructions ? `<strong>Instructions:</strong> ${order.deliveryInfo.instructions}<br>` : ''}
      </p>
    </div>
  `;
};

// Send order confirmation email to customer
const sendOrderConfirmationToCustomer = async (order) => {
  try {
    const transport = await initializeTransporter();
    
    // Format customer name
    const customerName = order.customerName || 'Valued Customer';
    
    // Generate order items HTML
    const itemsHtml = formatOrderItems(order.items);
    
    // Generate order info based on type
    const orderTypeInfo = order.orderType === 'pickup' 
      ? generatePickupInfo(order) 
      : generateDeliveryInfo(order);
    
    // Generate order summary
    const orderSummary = generateOrderSummary(order);
    
    // Create email content
    const emailContent = `
      <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
        <div style="background-color: #4CAF50; padding: 20px; text-align: center;">
          <h1 style="color: white; margin: 0;">Order Confirmation</h1>
        </div>
        
        <div style="padding: 20px;">
          <p>Dear ${customerName},</p>
          
          <p>Thank you for your order with Hearthfire Farm! Your order has been received and is being processed.</p>
          
          <div style="margin-top: 20px; padding: 15px; background-color: #f8f8f8; border-radius: 5px;">
            <h3 style="margin-top: 0;">Order Details</h3>
            <p><strong>Order Number:</strong> ${order.id || order.orderId}</p>
            <p><strong>Order Date:</strong> ${new Date().toLocaleDateString('en-US', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' })}</p>
            <p><strong>Order Type:</strong> ${order.orderType === 'pickup' ? 'Pickup' : 'Delivery'}</p>
            <p><strong>Payment Method:</strong> ${order.paymentMethod === 'credit' ? 'Credit Card' : 'Cash on Delivery/Pickup'}</p>
          </div>
          
          <h3 style="margin-top: 30px;">Items Ordered</h3>
          ${itemsHtml}
          
          ${orderTypeInfo}
          
          ${orderSummary}
          
          <p style="margin-top: 30px;">If you have any questions about your order, please don't hesitate to contact us at <a href="mailto:info@hearthfirefarm.com">info@hearthfirefarm.com</a>.</p>
          
          <p>Thank you for supporting local, sustainable farming!</p>
          
          <p>Sincerely,<br>The Hearthfire Farm Team</p>
        </div>
        
        <div style="background-color: #f2f2f2; padding: 15px; text-align: center; font-size: 12px; color: #666;">
          <p>This is an automated email. Please do not reply to this message.</p>
          <p>&copy; ${new Date().getFullYear()} Hearthfire Farm. All rights reserved.</p>
        </div>
      </div>
    `;
    
    // Send the email
    const info = await transport.sendMail({
      from: '"Hearthfire Farm" <info@hearthfirefarm.com>',
      to: order.customerEmail,
      subject: `Hearthfire Farm - Order Confirmation #${order.id || order.orderId}`,
      html: emailContent
    });
    
    console.log(`Order confirmation email sent to customer: ${info.messageId}`);
    
    // For development or when using fallback, log the test URL
    if (process.env.NODE_ENV === 'development' || isUsingFallback) {
      const previewUrl = nodemailer.getTestMessageUrl(info);
      if (previewUrl) {
        console.log('Preview URL: %s', previewUrl);
      }
    }
    
    return {
      ...info,
      previewUrl: (process.env.NODE_ENV === 'development' || isUsingFallback) ? nodemailer.getTestMessageUrl(info) : null
    };
  } catch (error) {
    console.error('Failed to send order confirmation email to customer:', error);
    // Don't throw the error to prevent order processing from failing
    return null;
  }
};

// Send order notification to admin
const sendOrderNotificationToAdmin = async (order) => {
  try {
    const transport = await initializeTransporter();
    
    // Format customer info
    const customerName = order.customerName || 'Guest Customer';
    const customerEmail = order.customerEmail || 'No email provided';
    const customerPhone = order.customerPhone ? formatPhoneNumber(order.customerPhone) : 'No phone provided';
    
    // Generate order items HTML
    const itemsHtml = formatOrderItems(order.items);
    
    // Generate order info based on type
    const orderTypeInfo = order.orderType === 'pickup' 
      ? generatePickupInfo(order) 
      : generateDeliveryInfo(order);
    
    // Generate order summary
    const orderSummary = generateOrderSummary(order);
    
    // Get order view links
    const orderUrl = `https://hearthfire-farm.web.app/admin/orders/${order.id || order.orderId}`;
    
    // Create email content
    const emailContent = `
      <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
        <div style="background-color: #3F51B5; padding: 20px; text-align: center;">
          <h1 style="color: white; margin: 0;">New Order Received</h1>
        </div>
        
        <div style="padding: 20px;">
          <p><strong>A new order has been placed!</strong></p>
          
          <div style="margin-top: 20px; padding: 15px; background-color: #f8f8f8; border-radius: 5px;">
            <h3 style="margin-top: 0;">Order Information</h3>
            <p><strong>Order Number:</strong> ${order.id || order.orderId}</p>
            <p><strong>Order Date:</strong> ${new Date().toLocaleDateString('en-US', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' })}</p>
            <p><strong>Order Type:</strong> ${order.orderType === 'pickup' ? 'Pickup' : 'Delivery'}</p>
            <p><strong>Payment Method:</strong> ${order.paymentMethod === 'credit' ? 'Credit Card' : 'Cash on Delivery/Pickup'}</p>
            <p><strong>Payment Status:</strong> ${order.paymentStatus || 'Pending'}</p>
          </div>
          
          <div style="margin-top: 20px; padding: 15px; background-color: #f8f8f8; border-radius: 5px;">
            <h3 style="margin-top: 0;">Customer Information</h3>
            <p><strong>Name:</strong> ${customerName}</p>
            <p><strong>Email:</strong> ${customerEmail}</p>
            <p><strong>Phone:</strong> ${customerPhone}</p>
          </div>
          
          <h3 style="margin-top: 30px;">Items Ordered</h3>
          ${itemsHtml}
          
          ${orderTypeInfo}
          
          ${orderSummary}
          
          <div style="margin-top: 30px; text-align: center;">
            <a href="${orderUrl}" style="display: inline-block; background-color: #3F51B5; color: white; padding: 12px 20px; text-decoration: none; border-radius: 4px; font-weight: bold;">View Order Details</a>
          </div>
        </div>
        
        <div style="background-color: #f2f2f2; padding: 15px; text-align: center; font-size: 12px; color: #666;">
          <p>This is an automated notification from your Hearthfire Farm website.</p>
          <p>&copy; ${new Date().getFullYear()} Hearthfire Farm. All rights reserved.</p>
        </div>
      </div>
    `;
    
    // Send the email
    const info = await transport.sendMail({
      from: '"Hearthfire Farm System" <info@hearthfirefarm.com>',
      to: 'info@hearthfirefarm.com',
      subject: `New ${order.orderType === 'pickup' ? 'Pickup' : 'Delivery'} Order #${order.id || order.orderId}`,
      html: emailContent
    });
    
    console.log(`Order notification email sent to admin: ${info.messageId}`);
    
    // For development or when using fallback, log the test URL
    if (process.env.NODE_ENV === 'development' || isUsingFallback) {
      const previewUrl = nodemailer.getTestMessageUrl(info);
      if (previewUrl) {
        console.log('Preview URL: %s', previewUrl);
      }
    }
    
    return {
      ...info,
      previewUrl: (process.env.NODE_ENV === 'development' || isUsingFallback) ? nodemailer.getTestMessageUrl(info) : null
    };
  } catch (error) {
    console.error('Failed to send order notification email to admin:', error);
    // Don't throw the error to prevent order processing from failing
    return null;
  }
};

// Send order status update email to customer
const sendOrderStatusUpdateToCustomer = async (order, previousStatus) => {
  try {
    const transport = await initializeTransporter();
    
    // Format customer name
    const customerName = order.customerName || 'Valued Customer';
    
    // Determine status change message
    let statusMessage = '';
    let statusColor = '#4CAF50'; // Default green
    
    switch (order.status) {
      case 'processing':
        statusMessage = 'Your order is now being processed and prepared for fulfillment.';
        statusColor = '#3F51B5'; // Blue
        break;
      case 'ready':
        statusMessage = order.orderType === 'pickup' 
          ? 'Your order is ready for pickup at the designated location and time.' 
          : 'Your order is ready for delivery and will be delivered at the scheduled time.';
        statusColor = '#FF9800'; // Orange
        break;
      case 'delivered':
        statusMessage = 'Your order has been delivered successfully. Thank you for choosing Hearthfire Farm!';
        break;
      case 'completed':
        statusMessage = 'Your order has been completed. Thank you for choosing Hearthfire Farm!';
        break;
      case 'cancelled':
        statusMessage = 'Your order has been cancelled as requested.';
        statusColor = '#F44336'; // Red
        break;
      default:
        statusMessage = `Your order status has been updated from "${previousStatus}" to "${order.status}".`;
    }
    
    // Create email content
    const emailContent = `
      <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
        <div style="background-color: ${statusColor}; padding: 20px; text-align: center;">
          <h1 style="color: white; margin: 0;">Order Status Update</h1>
        </div>
        
        <div style="padding: 20px;">
          <p>Dear ${customerName},</p>
          
          <p>We wanted to inform you that the status of your order with Hearthfire Farm has been updated.</p>
          
          <div style="margin-top: 20px; padding: 15px; background-color: #f8f8f8; border-radius: 5px; text-align: center;">
            <h3 style="margin-top: 0;">Your Order Status: <span style="color: ${statusColor};">${order.status.toUpperCase()}</span></h3>
            <p>${statusMessage}</p>
          </div>
          
          <div style="margin-top: 20px; padding: 15px; background-color: #f8f8f8; border-radius: 5px;">
            <h3 style="margin-top: 0;">Order Details</h3>
            <p><strong>Order Number:</strong> ${order.id || order.orderId}</p>
            <p><strong>Order Date:</strong> ${new Date(order.createdAt?._seconds ? order.createdAt._seconds * 1000 : order.createdAt || Date.now()).toLocaleDateString('en-US', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' })}</p>
            <p><strong>Order Type:</strong> ${order.orderType === 'pickup' ? 'Pickup' : 'Delivery'}</p>
          </div>
          
          ${order.orderType === 'pickup' ? generatePickupInfo(order) : generateDeliveryInfo(order)}
          
          <p style="margin-top: 30px;">If you have any questions about your order, please don't hesitate to contact us at <a href="mailto:info@hearthfirefarm.com">info@hearthfirefarm.com</a>.</p>
          
          <p>Thank you for supporting local, sustainable farming!</p>
          
          <p>Sincerely,<br>The Hearthfire Farm Team</p>
        </div>
        
        <div style="background-color: #f2f2f2; padding: 15px; text-align: center; font-size: 12px; color: #666;">
          <p>This is an automated email. Please do not reply to this message.</p>
          <p>&copy; ${new Date().getFullYear()} Hearthfire Farm. All rights reserved.</p>
        </div>
      </div>
    `;
    
    // Send the email
    const info = await transport.sendMail({
      from: '"Hearthfire Farm" <info@hearthfirefarm.com>',
      to: order.customerEmail,
      subject: `Hearthfire Farm - Order #${order.id || order.orderId} Status Update`,
      html: emailContent
    });
    
    console.log(`Order status update email sent to customer: ${info.messageId}`);
    
    // For development or when using fallback, log the test URL
    if (process.env.NODE_ENV === 'development' || isUsingFallback) {
      const previewUrl = nodemailer.getTestMessageUrl(info);
      if (previewUrl) {
        console.log('Preview URL: %s', previewUrl);
      }
    }
    
    return {
      ...info,
      previewUrl: (process.env.NODE_ENV === 'development' || isUsingFallback) ? nodemailer.getTestMessageUrl(info) : null
    };
  } catch (error) {
    console.error('Failed to send order status update email to customer:', error);
    // Don't throw the error to prevent order processing from failing
    return null;
  }
};

// Send account registration confirmation
const sendAccountRegistrationConfirmation = async (user) => {
  try {
    const transport = await initializeTransporter();
    
    // Create email content
    const emailContent = `
      <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
        <div style="background-color: #4CAF50; padding: 20px; text-align: center;">
          <h1 style="color: white; margin: 0;">Welcome to Hearthfire Farm</h1>
        </div>
        
        <div style="padding: 20px;">
          <p>Dear ${user.displayName || 'Valued Customer'},</p>
          
          <p>Thank you for creating an account with Hearthfire Farm! We're excited to have you as part of our community.</p>
          
          <p>With your new account, you can:</p>
          <ul>
            <li>Track your orders</li>
            <li>View your order history</li>
            <li>Save your delivery information for faster checkout</li>
            <li>Receive updates about special offers and new products</li>
          </ul>
          
          <div style="margin-top: 30px; text-align: center;">
            <a href="https://hearthfire-farm.web.app/account" style="display: inline-block; background-color: #4CAF50; color: white; padding: 12px 20px; text-decoration: none; border-radius: 4px; font-weight: bold;">Visit Your Account</a>
          </div>
          
          <p style="margin-top: 30px;">If you have any questions or need assistance, please don't hesitate to contact us at <a href="mailto:info@hearthfirefarm.com">info@hearthfirefarm.com</a>.</p>
          
          <p>Thank you for supporting local, sustainable farming!</p>
          
          <p>Sincerely,<br>The Hearthfire Farm Team</p>
        </div>
        
        <div style="background-color: #f2f2f2; padding: 15px; text-align: center; font-size: 12px; color: #666;">
          <p>This is an automated email. Please do not reply to this message.</p>
          <p>&copy; ${new Date().getFullYear()} Hearthfire Farm. All rights reserved.</p>
        </div>
      </div>
    `;
    
    // Send the email
    const info = await transport.sendMail({
      from: '"Hearthfire Farm" <info@hearthfirefarm.com>',
      to: user.email,
      subject: 'Welcome to Hearthfire Farm!',
      html: emailContent
    });
    
    console.log(`Account registration confirmation email sent: ${info.messageId}`);
    
    // For development or when using fallback, log the test URL
    if (process.env.NODE_ENV === 'development' || isUsingFallback) {
      const previewUrl = nodemailer.getTestMessageUrl(info);
      if (previewUrl) {
        console.log('Preview URL: %s', previewUrl);
      }
    }
    
    return {
      ...info,
      previewUrl: (process.env.NODE_ENV === 'development' || isUsingFallback) ? nodemailer.getTestMessageUrl(info) : null
    };
  } catch (error) {
    console.error('Failed to send account registration confirmation email:', error);
    // Don't throw the error to prevent registration from failing
    return null;
  }
};

// Export all functions
module.exports = {
  sendOrderConfirmationToCustomer,
  sendOrderNotificationToAdmin,
  sendOrderStatusUpdateToCustomer,
  sendAccountRegistrationConfirmation
}; 