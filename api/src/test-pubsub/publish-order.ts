import { PubSub } from '@google-cloud/pubsub';
import protobuf from 'protobufjs';
import path from 'path';

// Point to emulator
process.env.PUBSUB_EMULATOR_HOST = process.env.PUBSUB_EMULATOR_HOST || 'localhost:8085';

const PROJECT_ID = process.env.PUBSUB_PROJECT || 'feup-ds';
const pubsub = new PubSub({ projectId: PROJECT_ID });

const TOPIC = 'new_order';
const SUBSCRIPTION = 'new_order_sub';

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

async function publishOrderProto() {
  // Load proto definition
  const orderRoot = await protobuf.load(path.join(__dirname, '../protos/new_order.proto'));
  const OrderMessage = orderRoot.lookupType('order.v1.Order');

  const topic = await ensureTopicAndSubscription();

  const nowSeconds = Math.floor(Date.now() / 1000);
  const orderPayload = {
    id: 1001,
    customerId: 8,
    createdAt: { seconds: nowSeconds, nanos: 0 },
    items: [
      { orderId: 1001, productId: 123, quantity: 2 },
      { orderId: 1001, productId: 456, quantity: 1 },
    ],
  };

  const validationError = OrderMessage.verify(orderPayload);
  if (validationError) throw new Error(validationError);

  const buffer = OrderMessage.encode(orderPayload).finish();
  const messageId = await topic.publishMessage({ data: Buffer.from(buffer) });

  console.log('✅ Order message published via protobuf');
  console.log('Message ID:', messageId);
  console.log('Payload:', JSON.stringify(orderPayload, null, 2));
}

publishOrderProto().catch((err) => {
  console.error('❌ Error publishing order message:', err);
  process.exit(1);
});