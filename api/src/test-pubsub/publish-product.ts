import { PubSub } from '@google-cloud/pubsub';
import protobuf from 'protobufjs';
import path from 'path';

// Point to emulator
process.env.PUBSUB_EMULATOR_HOST = process.env.PUBSUB_EMULATOR_HOST || 'localhost:8085';

const PROJECT_ID = process.env.PUBSUB_PROJECT || 'feup-ds';
const pubsub = new PubSub({ projectId: PROJECT_ID });

const TOPIC = 'products';
const SUBSCRIPTION = 'products-sub';

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

async function publishProductProto() {
  // Load proto definition
  const productRoot = await protobuf.load(path.join(__dirname, '../protos/products.proto'));
  const ProductMessage = productRoot.lookupType('product.v1.Product');

  const topic = await ensureTopicAndSubscription();

  const productPayload = {
    id: 1001,
    name: 'New Awesome Product',
    image_url: 'https://example.com/product-1001.jpg',
    price: 49.99,
  };

  const validationError = ProductMessage.verify(productPayload);
  if (validationError) throw new Error(validationError);

  const buffer = ProductMessage.encode(productPayload).finish();
  const messageId = await topic.publishMessage({ data: Buffer.from(buffer) });

  console.log('✅ Product message published via protobuf');
  console.log('Message ID:', messageId);
  console.log('Payload:', JSON.stringify(productPayload, null, 2));
}

publishProductProto().catch((err) => {
  console.error('❌ Error publishing product message:', err);
  process.exit(1);
});
