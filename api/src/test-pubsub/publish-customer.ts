import { PubSub } from '@google-cloud/pubsub';
import protobuf from 'protobufjs';
import path from 'path';

// Point to emulator
process.env.PUBSUB_EMULATOR_HOST = process.env.PUBSUB_EMULATOR_HOST || 'localhost:8085';

const PROJECT_ID = process.env.PUBSUB_PROJECT || 'feup-ds';
const pubsub = new PubSub({ projectId: PROJECT_ID });

const TOPIC = 'users';
const SUBSCRIPTION = 'users-sub';

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

async function publishUserProto() {
  // Load proto definition
  const userRoot = await protobuf.load(path.join(__dirname, '../protos/users.proto'));
  const UserMessage = userRoot.lookupType('user.v1.User');

  const topic = await ensureTopicAndSubscription();

  const userPayload = {
    id: 8,
    name: 'John Doe',
    email: 'john.doe@example.com',
  };

  const validationError = UserMessage.verify(userPayload);
  if (validationError) throw new Error(validationError);

  const buffer = UserMessage.encode(userPayload).finish();
  const messageId = await topic.publishMessage({ data: Buffer.from(buffer) });

  console.log('✅ User message published via protobuf');
  console.log('Message ID:', messageId);
  console.log('Payload:', JSON.stringify(userPayload, null, 2));
}

publishUserProto().catch((err) => {
  console.error('❌ Error publishing user message:', err);
  process.exit(1);
});
