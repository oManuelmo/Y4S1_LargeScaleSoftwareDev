// test-gcp-pubsub.ts
import 'dotenv/config';
import { PubSub } from "@google-cloud/pubsub";
import dotenv from 'dotenv';
import path from 'path';

dotenv.config({ path: path.resolve(__dirname, '../../.env.development') });


async function testMIPSPubSub() {
  console.log("🔗 Testing connection to MIPS GCP Pub/Sub...");
  console.log("Using credentials from:", process.env.GOOGLE_APPLICATION_CREDENTIALS);
  
  try {
    const pubsub = new PubSub({
      projectId: process.env.GOOGLE_CLOUD_PROJECT,
      keyFilename: process.env.GOOGLE_APPLICATION_CREDENTIALS
    });
    
    // List all topics first
    console.log("\n📋 Listing all topics in project...");
    const [topics] = await pubsub.getTopics();
    console.log(`✅ Successfully connected! Found ${topics.length} topics`);
    
    // Check for MIPS-specific topics from your Terraform config
    console.log("\n🔍 Checking MIPS-PubSub topics from Terraform config:");
    
    const mipsTopics = [
      'new_review',
      'new_order',
      'review_moderation_topic',
      'product-updates-topic',
      'private_messages',
      'vendor-registration-topic',
      'product-costs-storage',
      'product-costs-request',
      'product-costs-response',
      'vendor-status-updates',
      'tracking-notifications',
      'products',
      'users',
      'wishlist','additional_topic_example'
    ];
    
    const foundTopics: string[] = [];
    
    for (const topicName of mipsTopics) {
      const topic = pubsub.topic(topicName);
      const [exists] = await topic.exists();
      
      if (exists) {
        console.log(`✅ FOUND topic: ${topicName}`);
        foundTopics.push(topicName);
        
        // List subscriptions for this topic
        try {
          const [subscriptions] = await topic.getSubscriptions();
          console.log(`   📫 Subscriptions (${subscriptions.length}):`);
          subscriptions.forEach((sub, i) => {
            const subName = sub.name.split('/').pop();
            console.log(`      ${i+1}. ${subName}`);
          });
        } catch (subError) {
          console.log(`   ⚠️ Could not list subscriptions: ${subError.message}`);
        }
      } else {
        console.log(`❌ MISSING topic: ${topicName}`);
      }
    }
    
    // Check subscriptions
    console.log("\n🔍 Checking MIPS-PubSub subscriptions from Terraform config:");
    
    const mipsSubscriptions = [
      'new_review_sub',
      'new_order_sub',
      'moderated_review_sub',
      'product-page-sync-sub',
      'bundle-bot-product-sub',
      'vendor-registration-sub',
      'vendor-registration-sub-team-3-2',
      'product-costs-storage-sub',
      'product-costs-request-sub',
      'product-costs-response-sub',
      'tracking-notifications-sub',
      'products-sub',
      'users-sub',
      'wishlist_sub','additional_subscription_example'
    ];
    
    for (const subName of mipsSubscriptions) {
      try {
        const subscription = pubsub.subscription(subName);
        const [exists] = await subscription.exists();
        
        if (exists) {
          console.log(`✅ FOUND subscription: ${subName}`);
          
          // Get topic for this subscription
          const [subscriptionInfo] = await subscription.getMetadata();
          const topicName = subscriptionInfo.topic?.split('/').pop();
          console.log(`   🔗 Connected to topic: ${topicName}`);
        } else {
          console.log(`❌ MISSING subscription: ${subName}`);
        }
      } catch (error) {
        console.log(`❌ ERROR checking subscription ${subName}: ${error.message}`);
      }
    }
    
    // Summary
    console.log("\n📊 SUMMARY:");
    console.log(`Topics found: ${foundTopics.length}/${mipsTopics.length}`);
    console.log(`Topics configured but might be missing: ${mipsTopics.length - foundTopics.length}`);
    
  } catch (error) {
    console.error("\n❌ Connection failed:", error.message);
  }
}

// Load environment variables
testMIPSPubSub();