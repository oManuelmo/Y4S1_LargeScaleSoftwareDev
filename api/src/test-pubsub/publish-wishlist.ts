import { PubSub } from '@google-cloud/pubsub';
import protobuf from 'protobufjs';
import path from 'path';

// Point to emulator
process.env.PUBSUB_EMULATOR_HOST = process.env.PUBSUB_EMULATOR_HOST || 'localhost:8085';

const PROJECT_ID = process.env.PUBSUB_PROJECT || 'feup-ds';
const pubsub = new PubSub({ projectId: PROJECT_ID });

const TOPIC = 'wishlist';
const SUBSCRIPTION = 'wishlist_sub';

async function ensureTopicAndSubscription() {
  const topic = pubsub.topic(TOPIC);
  const [topicExists] = await topic.exists();
  if (!topicExists) {
    await pubsub.createTopic(TOPIC);
    console.log(`🆕 Created topic ${TOPIC}`);
  }

  const subscription = topic.subscription(SUBSCRIPTION);
  const [subExists] = await subscription.exists();
  if (!subExists) {
    await topic.createSubscription(SUBSCRIPTION);
    console.log(`🆕 Created subscription ${SUBSCRIPTION}`);
  }

  return topic;
}

async function publishWishlistProto() {
  // Load proto definition
  const wishlistRoot = await protobuf.load(path.join(__dirname, '../protos/wishlist.proto'));
  const WishlistMessage = wishlistRoot.lookupType('wishlist.v1.Wishlist');

  const topic = await ensureTopicAndSubscription();

  const nowSeconds = Math.floor(Date.now() / 1000);
  const wishlistPayload = {
    productId: 123,
    customerId: 8,
    createdAt: { seconds: nowSeconds, nanos: 0 },
  };

  const validationError = WishlistMessage.verify(wishlistPayload);
  
  if (validationError) {
    console.error('❌ Validation error:', validationError);
    throw new Error(validationError);
  }

  const buffer = WishlistMessage.encode(wishlistPayload).finish();
  
  if (buffer.length === 0) {
    throw new Error('Encoded buffer is empty!');
  }

  const messageId = await topic.publishMessage({ data: buffer });

  console.log('✅ Wishlist message published via protobuf');
  console.log('Message ID:', messageId);
  console.log('Payload:', JSON.stringify(wishlistPayload, null, 2));
}

publishWishlistProto().catch((err) => {
  console.error('❌ Error publishing wishlist message:', err);
  process.exit(1);
});
