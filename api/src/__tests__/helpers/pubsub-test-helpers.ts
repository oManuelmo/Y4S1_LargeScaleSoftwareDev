/**
 * Test utilities and helpers for PubSub tests
 */

import { PubSub } from '@google-cloud/pubsub';
import protobuf from 'protobufjs';
import path from 'path';

export interface TestMessage {
  topicName: string;
  payload: any;
  protoType: protobuf.Type;
}

/**
 * Create a test PubSub client connected to emulator
 */
export function createTestPubSubClient(): PubSub {
  const projectId = process.env.PUBSUB_PROJECT || 'feup-ds';
  process.env.PUBSUB_EMULATOR_HOST = process.env.PUBSUB_EMULATOR_HOST || 'localhost:8085';
  
  return new PubSub({ projectId });
}

/**
 * Load all protobuf message types for testing
 */
export async function loadTestProtoMessages() {
  const reviewRoot = await protobuf.load(path.join(__dirname, '../protos/new_review.proto'));
  const orderRoot = await protobuf.load(path.join(__dirname, '../protos/new_order.proto'));
  const productRoot = await protobuf.load(path.join(__dirname, '../protos/products.proto'));
  const userRoot = await protobuf.load(path.join(__dirname, '../protos/users.proto'));
  const vendorRoot = await protobuf.load(path.join(__dirname, '../protos/vendor_registration.proto'));
  const wishlistRoot = await protobuf.load(path.join(__dirname, '../protos/wishlist.proto'));
  const notInterestedRoot = await protobuf.load(path.join(__dirname, '../protos/not_interested.proto'));

  return {
    Review: reviewRoot.lookupType('review.v1.Review'),
    Order: orderRoot.lookupType('order.v1.Order'),
    Product: productRoot.lookupType('product.v1.Product'),
    User: userRoot.lookupType('user.v1.User'),
    Vendor: vendorRoot.lookupType('vendor.v1.Vendor'),
    Wishlist: wishlistRoot.lookupType('wishlist.v1.Wishlist'),
    NotInterested: notInterestedRoot.lookupType('notinterested.v1.NotInterested'),
  };
}

/**
 * Publish a test message to a topic
 */
export async function publishTestMessage(
  pubsub: PubSub,
  topicName: string,
  message: protobuf.Type,
  payload: any
): Promise<string> {
  const topic = pubsub.topic(topicName);
  
  // Ensure topic exists
  const [exists] = await topic.exists();
  if (!exists) {
    await pubsub.createTopic(topicName);
  }

  // Encode and publish
  const buffer = message.encode(payload).finish();
  const messageId = await topic.publishMessage({ data: buffer });
  
  return messageId;
}

/**
 * Wait for message processing with timeout
 */
export function waitForProcessing(ms: number = 2000): Promise<void> {
  return new Promise(resolve => setTimeout(resolve, ms));
}

/**
 * Create a test review payload
 */
export function createTestReview(overrides: Partial<any> = {}) {
  return {
    id: 9999,
    productId: 999,
    customerId: 999,
    rating: 5,
    comment: 'Test review',
    createdAt: { seconds: Math.floor(Date.now() / 1000), nanos: 0 },
    ...overrides,
  };
}

/**
 * Create a test order payload
 */
export function createTestOrder(overrides: Partial<any> = {}) {
  return {
    id: 9999,
    customerId: 999,
    createdAt: { seconds: Math.floor(Date.now() / 1000), nanos: 0 },
    items: [
      { orderId: 9999, productId: 999, quantity: 1 },
    ],
    ...overrides,
  };
}

/**
 * Create a test product payload
 */
export function createTestProduct(overrides: Partial<any> = {}) {
  return {
    id: 9999,
    name: 'Test Product',
    imageUrl: 'https://example.com/test.jpg',
    price: 99.99,
    ...overrides,
  };
}

/**
 * Create a test user payload
 */
export function createTestUser(overrides: Partial<any> = {}) {
  return {
    id: 9999,
    name: 'Test User',
    email: 'test@example.com',
    ...overrides,
  };
}

/**
 * Create a test wishlist payload
 */
export function createTestWishlist(overrides: Partial<any> = {}) {
  return {
    customerId: 999,
    productId: 999,
    createdAt: { seconds: Math.floor(Date.now() / 1000), nanos: 0 },
    ...overrides,
  };
}

/**
 * Create a test not interested payload
 */
export function createTestNotInterested(overrides: Partial<any> = {}) {
  return {
    userId: 999,
    productId: 999,
    createdAt: { seconds: Math.floor(Date.now() / 1000), nanos: 0 },
    ...overrides,
  };
}

/**
 * Clean up test topics and subscriptions
 */
export async function cleanupTestResources(pubsub: PubSub, topicNames: string[]): Promise<void> {
  for (const topicName of topicNames) {
    try {
      const topic = pubsub.topic(topicName);
      const [exists] = await topic.exists();
      
      if (exists) {
        // Delete all subscriptions for this topic
        const [subscriptions] = await topic.getSubscriptions();
        for (const subscription of subscriptions) {
          await subscription.delete();
        }
        
        // Delete the topic
        await topic.delete();
      }
    } catch (error) {
      console.error(`Failed to cleanup topic ${topicName}:`, error);
    }
  }
}
