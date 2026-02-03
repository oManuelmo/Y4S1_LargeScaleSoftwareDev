import { PubSub } from '@google-cloud/pubsub';
import protobuf from 'protobufjs';
import path from 'path';

// Point to emulator
process.env.PUBSUB_EMULATOR_HOST = process.env.PUBSUB_EMULATOR_HOST || 'localhost:8085';

const PROJECT_ID = process.env.PUBSUB_PROJECT || 'feup-ds';
const pubsub = new PubSub({ projectId: PROJECT_ID });

const TOPIC = 'new_review';
const SUBSCRIPTION = 'new_review_sub';

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

async function publishReviewProto() {
  // Load proto definition
  const reviewRoot = await protobuf.load(path.join(__dirname, '../protos/new_review.proto'));
  const ReviewMessage = reviewRoot.lookupType('review.v1.Review');

  const topic = await ensureTopicAndSubscription();

  const nowSeconds = Math.floor(Date.now() / 1000);
  const reviewPayload = {
    id: 5001,
    productId: 123,
    customerId: 8,
    rating: 5,
    comment: 'Great product! Highly recommended.',
    createdAt: { seconds: nowSeconds, nanos: 0 },
  };

  const validationError = ReviewMessage.verify(reviewPayload);
  if (validationError) throw new Error(validationError);

  const buffer = ReviewMessage.encode(reviewPayload).finish();
  const messageId = await topic.publishMessage({ data: Buffer.from(buffer) });

  console.log('✅ Review message published via protobuf');
  console.log('Message ID:', messageId);
  console.log('Payload:', JSON.stringify(reviewPayload, null, 2));
}

publishReviewProto().catch((err) => {
  console.error('❌ Error publishing review message:', err);
  process.exit(1);
});
