import { PubSub } from '@google-cloud/pubsub';
import protobuf from 'protobufjs';
import path from 'path';

// Point to emulator
process.env.PUBSUB_EMULATOR_HOST = process.env.PUBSUB_EMULATOR_HOST || 'localhost:8085';

const PROJECT_ID = process.env.PUBSUB_PROJECT || 'feup-ds';
const pubsub = new PubSub({ projectId: PROJECT_ID });

const TOPIC = 'vendor_registration';
const SUBSCRIPTION = 'vendor_registration_sub_team_3_2';

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

async function publishVendorProto() {
  // Load proto definition
  const vendorRoot = await protobuf.load(path.join(__dirname, '../protos/vendor_registration.proto'));
  const VendorMessage = vendorRoot.lookupType('vendor.v1.Vendor');

  const topic = await ensureTopicAndSubscription();

  const vendorPayload = {
    id: 1,
  };

  const validationError = VendorMessage.verify(vendorPayload);
  if (validationError) throw new Error(validationError);

  const buffer = VendorMessage.encode(vendorPayload).finish();
  const messageId = await topic.publishMessage({ data: Buffer.from(buffer) });

  console.log('✅ Vendor message published via protobuf');
  console.log('Message ID:', messageId);
  console.log('Payload:', JSON.stringify(vendorPayload, null, 2));
}

publishVendorProto().catch((err) => {
  console.error('❌ Error publishing vendor message:', err);
  process.exit(1);
});
