# Stripe Module

This module provides a set of functions for interacting with the Stripe API. It is designed to be a drop-in replacement for the existing Stripe integration.

## Usage

To use the Stripe module, you first need to configure it with your database provider. This is done by creating a `db` object that implements the following methods:

- `verifyIdToken(token)`
- `getOrder(orderId)`
- `updateOrder(orderId, data)`
- `updateOrderByPaymentIntent(paymentIntentId, data)`

Once you have configured the `db` object, you can use the following functions to interact with the Stripe service:

- `createPaymentIntentHandler(db)`
- `createWebhookHandler(db)`