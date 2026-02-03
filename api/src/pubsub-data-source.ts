import { PubSub } from "@google-cloud/pubsub";
import { AppDataSource } from "./postgres-data-source";
import { Customer } from "./entities/Customer";
import { Product } from "./entities/Product";
import { Review } from "./entities/Review";
import { Order } from "./entities/Order";
import { OrderItem } from "./entities/OrderItem";
import protobuf from "protobufjs";
import path from "path";
import { Seller } from "./entities/Seller";
import { Wishlist } from "./entities/Wishlist";
import { NotInterested } from "./entities/NotInterested";
import { GoogleAuth } from "google-auth-library";

// Set emulator host for development only
if (process.env.NODE_ENV === 'development' && process.env.PUBSUB_EMULATOR_HOST) {
  console.log('🔧 Development mode: Using PubSub emulator at', process.env.PUBSUB_EMULATOR_HOST);
} else {
  // Explicitly unset emulator host for production/real PubSub
  delete process.env.PUBSUB_EMULATOR_HOST;
  console.log('☁️  Production mode: Using real GCP Pub/Sub');
}

const projectID = process.env.PUBSUB_PROJECT || process.env.GOOGLE_CLOUD_PROJECT || 'feup-ds';
const credentialsPath = process.env.GOOGLE_APPLICATION_CREDENTIALS;

console.log('📡 Initializing Pub/Sub client for project:', projectID);
console.log('📁 Using credentials path:', credentialsPath || 'default credentials');

// Create PubSub client with explicit credentials like your friend does
const pubsub = new PubSub({ 
  projectId: projectID,
  ...(credentialsPath && { keyFilename: credentialsPath })
});

const TOPICS = {
  NEW_REVIEW: 'new_review',
  NEW_ORDER: 'new_order',
  PRODUCTS: 'products',
  USERS: 'users',
  VENDOR_REGISTRATION: 'vendor-registration-topic',
  WISHLIST: 'wishlist'
};

const SUBSCRIPTIONS = {
  NEW_REVIEW: 'new_review_sub_31',
  NEW_ORDER: 'new_order_sub_31',
  PRODUCTS: 'products-sub-31',
  USERS: 'users-sub-31',
  VENDOR_REGISTRATION: 'vendor-registration-sub-31',
  WISHLIST: 'wishlist_sub-31'
};

let ReviewMessage: protobuf.Type | null = null;
let OrderMessage: protobuf.Type | null = null;
let ProductMessage: protobuf.Type | null = null;
let UserMessage: protobuf.Type | null = null;
let VendorMessage: protobuf.Type | null = null;
let WishlistMessage: protobuf.Type | null = null;

async function loadProtobufDefinitions() {
  try {
    console.log("📚 Loading Protocol Buffer definitions...");
    
    // Load review proto
    const reviewRoot = await protobuf.load(path.join(__dirname, "protos", "new_review.proto"));
    ReviewMessage = reviewRoot.lookupType("review.v1.Review");
    console.log("✅ Review protobuf loaded");
    
    // Load order proto
    const orderRoot = await protobuf.load(path.join(__dirname, "protos", "new_order.proto"));
    OrderMessage = orderRoot.lookupType("order.v1.Order");
    console.log("✅ Order protobuf loaded");

    const productRoot = await protobuf.load(path.join(__dirname, "protos", "products.proto"));
    ProductMessage = productRoot.lookupType("product.v1.Product");
    console.log("✅ Product protobuf loaded");

    const userRoot = await protobuf.load(path.join(__dirname, "protos", "users.proto"));
    UserMessage = userRoot.lookupType("user.v1.User");
    console.log("✅ User protobuf loaded");

    const vendorRoot = await protobuf.load(path.join(__dirname, "protos", "vendor_registration.proto"));
    VendorMessage = vendorRoot.lookupType("vendor.v1.Vendor");
    console.log("✅ Vendor protobuf loaded");

    const wishlistRoot = await protobuf.load(path.join(__dirname, "protos", "wishlist.proto"));
    WishlistMessage = wishlistRoot.lookupType("wishlist.v1.Wishlist");
    console.log("✅ Wishlist protobuf loaded");

  } catch (error) {
    console.error("❌ Failed to load protobuf definitions:", error);
    throw error;
  }
}

export class PubSubDataSource {
  private static instance: PubSubDataSource;
  private subscriptions: Map<string, any> = new Map();

  private constructor() {}

  public static getInstance(): PubSubDataSource {
    if (!PubSubDataSource.instance) {
      PubSubDataSource.instance = new PubSubDataSource();
    }
    return PubSubDataSource.instance;
  }

  /**
   * Initialize all PubSub subscriptions
   */
  public async initialize(): Promise<void> {
    try {
      console.log('🚀 Initializing PubSub data source...');

      // Ensure protobuf message types are loaded before we subscribe
      await loadProtobufDefinitions();

      // Initialize new_review subscription
      await this.initializeSubscription(
        TOPICS.NEW_REVIEW,
        SUBSCRIPTIONS.NEW_REVIEW,
        this.processNewReview.bind(this)
      );

      
      // Initialize orders subscription
      await this.initializeSubscription(
        TOPICS.NEW_ORDER,
        SUBSCRIPTIONS.NEW_ORDER,
        this.processNewOrder.bind(this)
      );
      
      // Initialize products subscription
      await this.initializeSubscription(
        TOPICS.PRODUCTS,
        SUBSCRIPTIONS.PRODUCTS,
        this.processProduct.bind(this)
      );

      // Initialize users subscription
      await this.initializeSubscription(
        TOPICS.USERS,
        SUBSCRIPTIONS.USERS,
        this.processUser.bind(this)
      );

      // Initialize vendor registration subscription
      await this.initializeSubscription(
        TOPICS.VENDOR_REGISTRATION,
        SUBSCRIPTIONS.VENDOR_REGISTRATION,
        this.processVendor.bind(this)
      );

      // Initialize wishlist subscription
      await this.initializeSubscription(
        TOPICS.WISHLIST,
        SUBSCRIPTIONS.WISHLIST,
        this.processWishlist.bind(this)
      );
          

      console.log('✅ All PubSub subscriptions initialized successfully');
    } catch (error) {
      console.error('❌ Error initializing PubSub data source:', error);
      throw error;
    }
  }

  /**
   * Initialize a specific subscription
   */
  private async initializeSubscription(
    topicName: string,
    subscriptionName: string,
    messageHandler: (data: any) => Promise<void>
  ): Promise<void> {
    try {
      console.log(`📡 Setting up subscription: ${subscriptionName} for topic: ${topicName}`);

      const topic = pubsub.topic(topicName);
      
      // Check if topic exists
      let [topicExists] = await topic.exists();
      if (!topicExists) {
        console.warn(`⚠️ Topic ${topicName} does not exist, skipping subscription setup`);
        return;
      }

      // Get subscription
      const subscription = topic.subscription(subscriptionName);
      let [subscriptionExists] = await subscription.exists();

      if (!subscriptionExists) {
        console.log(`🆕 Subscription ${subscriptionName} does not exist, creating...`);
        await topic.createSubscription(subscriptionName);
        console.log(`✅ Subscription ${subscriptionName} created`);
      }

      // Store subscription for later access
      this.subscriptions.set(subscriptionName, subscription);

      // Start listening for messages
      this.startMessageHandler(subscription, subscriptionName, messageHandler);
      
      console.log(`✅ Subscription ${subscriptionName} initialized successfully`);

    } catch (error) {
      console.error(`❌ Error initializing subscription ${subscriptionName}:`, error);
      throw error;
    }
  }

  /**
   * Start handling incoming PubSub messages for a specific subscription
   */
  private startMessageHandler(
    subscription: any,
    subscriptionName: string,
    messageHandler: (data: any) => Promise<void>
  ): void {
    console.log(`🎧 Starting message handler for ${subscriptionName}`);
    
    // Debug: Log subscription state before opening
    console.log(`🔍 [${subscriptionName}] Subscription object:`, {
      name: subscription.name,
      isOpen: subscription.isOpen,
      messageListeners: subscription.listenerCount('message')
    });

    subscription.on('message', async (message: any) => {
      let parsedData: any = null;
      
      try {
        console.log(`📨 [${subscriptionName}] Received message: ${message.id}`);
        
        // Parse message data
        try {
          parsedData = this.parseMessageData(subscriptionName, message.data);
        } catch (parseError) {
          if (parseError.message === 'TEST_MESSAGE_SKIP') {
            console.log(`🔄 Acknowledging test message to prevent spam`);
            message.ack();
            return;
          }
          console.error(`❌ Failed to parse message, acknowledging to prevent loop`);
          message.ack();
          return;
        }
        
        await messageHandler(parsedData);
        message.ack();
        console.log(`✅ [${subscriptionName}] Message ${message.id} processed successfully`);
      } catch (error) {
        console.error(`❌ Error processing message ${message.id}:`, error.message);
        
        // ACKNOWLEDGE all errors to stop infinite spam
        console.log(`🔄 Acknowledging failed message to prevent spam`);
        message.ack();
      }
    });

    subscription.on('error', (error: Error) => {
      console.error(`💥 [${subscriptionName}] Subscription error:`, error);
    });

    subscription.on('close', () => {
      console.log(`🚪 [${subscriptionName}] Subscription closed`);
    });

    // Explicitly open the subscription to start pulling messages
    subscription.open();
    console.log(`👂 [${subscriptionName}] Now listening for messages... (subscription opened)`);
  }

  /**
   * Parse message data from buffer
   */
  private parseMessageData(subscriptionName: string, data: Buffer): any {
    // Try protobuf decoding first, fall back to JSON if it fails
    try {
      // Decode based on subscription/topic
      if (subscriptionName === SUBSCRIPTIONS.NEW_REVIEW) {
        if (!ReviewMessage) throw new Error('Review proto not loaded');
        
        // Try protobuf first
        try {
          const decoded = ReviewMessage.decode(data);
          console.log('✅ Decoded review message via protobuf');
          return ReviewMessage.toObject(decoded, {
            longs: Number,
            enums: String,
            defaults: true,
          });
        } catch (protoError: any) {
          // If protobuf fails, try JSON (messages published with { json: ... })
          console.log('⚠️ Protobuf decode failed, trying JSON fallback');
          const rawString = data.toString('utf-8').trim();
          const jsonData = JSON.parse(rawString);
          console.log('✅ Decoded review message via JSON');
          return jsonData;
        }
      }

      if (subscriptionName === SUBSCRIPTIONS.NEW_ORDER) {
        if (!OrderMessage) throw new Error('Order proto not loaded');
        
        try {
          const decoded = OrderMessage.decode(data);
          console.log('✅ Decoded order message via protobuf');
          return OrderMessage.toObject(decoded, {
            longs: String,
            enums: String,
            defaults: true,
          });
        } catch (protoError: any) {
          console.log('⚠️ Protobuf decode failed, trying JSON fallback');
          const rawString = data.toString('utf-8').trim();
          const jsonData = JSON.parse(rawString);
          console.log('✅ Decoded order message via JSON');
          return jsonData;
        }
      }

      if (subscriptionName === SUBSCRIPTIONS.PRODUCTS) {
        if (!ProductMessage) throw new Error('Product proto not loaded');
        
        try {
          const decoded = ProductMessage.decode(data);
          console.log('✅ Decoded product message via protobuf');
          return ProductMessage.toObject(decoded, {
            longs: Number,
            enums: String,
            defaults: true,
          });
        } catch (protoError: any) {
          console.log('⚠️ Protobuf decode failed, trying JSON fallback');
          const rawString = data.toString('utf-8').trim();
          const jsonData = JSON.parse(rawString);
          console.log('✅ Decoded product message via JSON');
          return jsonData;
        }
      }

      if (subscriptionName === SUBSCRIPTIONS.USERS) {
        if (!UserMessage) throw new Error('User proto not loaded');
        
        try {
          const decoded = UserMessage.decode(data);
          console.log('✅ Decoded user message via protobuf');
          return UserMessage.toObject(decoded, {
            longs: Number,
            enums: String,
            defaults: true,
          });
        } catch (protoError: any) {
          console.log('⚠️ Protobuf decode failed, trying JSON fallback');
          const rawString = data.toString('utf-8').trim();
          const jsonData = JSON.parse(rawString);
          console.log('✅ Decoded user message via JSON');
          return jsonData;
        }
      }

      if (subscriptionName === SUBSCRIPTIONS.VENDOR_REGISTRATION) {
        if (!VendorMessage) throw new Error('Vendor proto not loaded');
        
        try {
          const decoded = VendorMessage.decode(data);
          console.log('✅ Decoded vendor message via protobuf');
          return VendorMessage.toObject(decoded, {
            longs: Number,
            enums: String,
            defaults: true,
          });
        } catch (protoError: any) {
          console.log('⚠️ Protobuf decode failed, trying JSON fallback');
          const rawString = data.toString('utf-8').trim();
          const jsonData = JSON.parse(rawString);
          console.log('✅ Decoded vendor message via JSON');
          return jsonData;
        }
      }

      if (subscriptionName === SUBSCRIPTIONS.WISHLIST) {
        if (!WishlistMessage) throw new Error('Wishlist proto not loaded');
        
        try {
          const decoded = WishlistMessage.decode(data);
          console.log('✅ Decoded wishlist message via protobuf');
          return WishlistMessage.toObject(decoded, {
            longs: Number,
            enums: String,
            defaults: true,
          });
        } catch (protoError: any) {
          console.log('⚠️ Protobuf decode failed, trying JSON fallback');
          const rawString = data.toString('utf-8').trim();
          const jsonData = JSON.parse(rawString);
          console.log('✅ Decoded wishlist message via JSON');
          return jsonData;
        }
      }

      // Fallback to JSON for any other subscription (or manual testing)
      const rawString = data.toString('utf-8').trim();
      
      // Special-case test emulator messages
      if (rawString === 'Hello, Pub/Sub emulator!') {
        console.log('⚠️ Received non-payload test message, skipping...');
        throw new Error('TEST_MESSAGE_SKIP');
      }

      return JSON.parse(rawString);
    } catch (error: any) {
      if (error.message === 'TEST_MESSAGE_SKIP') throw error;
      console.error('❌ Error parsing message data:', error);
      throw new Error('Invalid message format');
    }
  }

  /**
   * Process new review message
   */
  private async processNewReview(reviewData: any): Promise<void> {
    try {
      console.log('⭐ Processing new review:', reviewData);

      const reviewRepository = AppDataSource.getRepository(Review);
      const customerRepository = AppDataSource.getRepository(Customer);

      // Validate required fields - use camelCase since protobufjs converts snake_case to camelCase
      if (!reviewData.id || reviewData.productId === null || reviewData.customerId === null) {
        console.error('❌ Missing required fields for review:', reviewData);
        return;
      }

      // Convert IDs to numbers (TypeORM expects numbers)
      const reviewId = Number(reviewData.id);
      const productId = Number(reviewData.productId ?? reviewData.product_id);
      const customerId = Number(reviewData.customerId ?? reviewData.customer_id);
      const rating = reviewData.rating ? Number(reviewData.rating) : 0;

      console.log(`🔢 Processing - Review: ${reviewId}, Product: ${productId}, Customer: ${customerId}, Rating: ${rating}`);

      // Step 1: Ensure customer exists
      let customer = await customerRepository.findOne({
        where: { customer_id: customerId }
      });

      if (!customer) {
        console.log(`👤 Creating placeholder customer with ID: ${customerId}`);
        customer = customerRepository.create({
          customer_id: customerId,
          customer_email: `customer-${customerId}@placeholder.com` // Temporary email
        });
        await customerRepository.save(customer);
        console.log(`✅ Created placeholder customer: ${customerId}`);
      }

      // Step 2: Check if review already exists
      const existingReview = await reviewRepository.findOne({
        where: { review_id: reviewId }
      });

      // created_at comes as google.protobuf.Timestamp { seconds, nanos }
      const reviewDate = reviewData.createdAt?.seconds
        ? new Date(Number(reviewData.createdAt.seconds) * 1000)
        : new Date();

      if (existingReview) {
        console.log(`📝 Updating existing review ${reviewId}`);
        reviewRepository.merge(existingReview, {
          rating: rating,
          reviewed_at: reviewDate,
        });
        await reviewRepository.save(existingReview);
        console.log(`✅ Updated review ${reviewId}`);
      } else {
        console.log(`✨ Creating new review ${reviewId}`);
        const review = reviewRepository.create({
          review_id: reviewId,
          product_id: productId,
          customer_id: customerId,
          rating: rating,
          reviewed_at: reviewDate,
        });
        await reviewRepository.save(review);
        console.log(`✅ Created new review ${reviewId}`);
      }

      console.log(`🎉 Successfully processed review ${reviewId}`);

    } catch (error) {
      console.error('❌ Error processing review:', error);
      throw error;
    }
  }

  /**
   * Process new order message
   */
  private async processNewOrder(orderData: any): Promise<void> {
    try {
      console.log('🛒 Processing new order...');
      console.log('📋 Order data received:', JSON.stringify(orderData, null, 2));
      const orderRepository = AppDataSource.getRepository(Order);
      const orderItemRepository = AppDataSource.getRepository(OrderItem);
      const productRepository = AppDataSource.getRepository(Product);
      const customerRepository = AppDataSource.getRepository(Customer);

      const orderId = Number(orderData.id);
      const customerId = (orderData.customerId ?? orderData.customer_id) ? Number(orderData.customerId ?? orderData.customer_id) : null;
      const orderDate = (orderData.createdAt ?? orderData.created_at)?.seconds
        ? new Date(Number((orderData.createdAt ?? orderData.created_at).seconds) * 1000)
        : new Date();

      console.log(`📦 Order ${orderId} for customer ${customerId ?? 'unknown'}`);

      // Find or create customer (placeholder email if missing)
      let customer = customerId
        ? await customerRepository.findOne({ where: { customer_id: customerId } })
        : null;

      if (!customer && customerId) {
        customer = customerRepository.create({
          customer_id: customerId,
          customer_email: `customer-${customerId}@placeholder.com`
        });
        await customerRepository.save(customer);
        console.log(`👤 Created new customer from order: ${customerId}`);
      }

      // Create or update the order
      let order = await orderRepository.findOne({
        where: { order_id: orderId }
      });

      if (!order) {
        console.log(`✨ Creating new order ${orderId}`);
        order = orderRepository.create({
          order_id: orderId,
          customer_id: customerId,
          ordered_at: orderDate,
        });
        await orderRepository.save(order);
        console.log(`✅ Created new order ${orderId}`);
      } else {
        console.log(`📝 Order ${orderId} already exists, skipping creation`);
      }

      // Process items array from proto
      if (orderData.items && Array.isArray(orderData.items)) {
        for (const item of orderData.items) {
          // protobufjs converts snake_case to camelCase in toObject()
          const productId = (item.productId ?? item.product_id) != null ? Number(String(item.productId ?? item.product_id)) : null;
          
          if (!productId || isNaN(productId) || productId === 0) {
            console.warn(`⚠️ Skipping item with invalid productId: ${item.productId}`);
            continue;
          }

          const product = await productRepository.findOne({ where: { product_id: productId } });

          if (product) {
            const quantity = item.quantity ?? item.Quantity ?? 0;
            console.log(`📊 Order includes product: ${productId}, Quantity: ${quantity}`);
            
            // Create order item - composite primary key is (order_id, product_id)
            const existingItem = await orderItemRepository.findOne({
              where: { order_id: orderId, product_id: productId }
            });

            if (!existingItem) {
              const orderItem = orderItemRepository.create({
                order_id: orderId,
                order: order,
                product_id: productId,
                quantity: Number(item.quantity ?? item.Quantity ?? 0),
              });
              await orderItemRepository.save(orderItem);
              console.log(`✅ Created order item for order ${orderId}, product ${productId}`);
            } else {
              console.log(`📝 Order item (${orderId}, ${productId}) already exists, updating quantity`);
              existingItem.quantity = Number(item.quantity ?? item.Quantity ?? 0);
              await orderItemRepository.save(existingItem);
            }
          } else {
            console.warn(`⚠️ Product ${productId} not found in database`);
          }
        }
      }

      console.log(`✅ Order ${orderId} processed successfully at ${orderDate.toISOString()}`);

    } catch (error) {
      console.error('❌ Error processing new order:', error);
      throw error;
    }
  }

  /**
   * Process product message
   */
  private async processProduct(productData: any): Promise<void> {
    try {
      console.log('🛍️ Processing product update:', productData);
      
      const productRepository = AppDataSource.getRepository(Product);
      const productId = Number(productData.id);
      
      if (!productId || isNaN(productId) || productId === 0) {
        console.error('❌ Invalid product ID in product update:', productData);
        return;
      }
      let product = await productRepository.findOne({ where: { product_id: productId } });
      
      if (!product) {
        console.log(`✨ Creating new product ${productId} from update`);
        product = productRepository.create({
          product_id: productId,
          name: productData.name || null,
          image_url: (productData.imageUrl ?? productData.image_url) || null,
          price: productData.price || null,
        });
        await productRepository.save(product);
        console.log(`✅ Created new product ${productId}`);
      }
      else {
        console.log(`📝 Updating existing product ${productId} from update`);
        productRepository.merge(product, {
          name: productData.name || product.name,
          image_url: (productData.imageUrl ?? productData.image_url) || product.image_url,
          price: productData.price || product.price,
        });
        await productRepository.save(product);
        console.log(`✅ Updated product ${productId}`);
      }
      
    } catch (error) {
      console.error('❌ Error processing product update:', error);
      throw error;
    }
  }

  /**
   * Process user message
   */
  private async processUser(userData: any): Promise<void> {
    try {
      console.log('👤 Processing user update:', userData);
      const customerRepository = AppDataSource.getRepository(Customer);
      const customerId = Number(userData.id);
      
      if (!customerId || isNaN(customerId) || customerId === 0) {
        console.error('❌ Invalid user ID in user update:', userData);
        return;
      }
      let customer = await customerRepository.findOne({ where: { customer_id: customerId } });
      
      if (!customer) {
        console.log(`✨ Creating new customer ${customerId} from user update`);
        customer = customerRepository.create({
          customer_id: customerId,
          customer_email: userData.email || null,
        });
        await customerRepository.save(customer);
        console.log(`✅ Created new customer ${customerId}`);
      }
      else {
        console.log(`📝 Updating existing customer ${customerId} from user update`);
        customerRepository.merge(customer, {
          customer_email: userData.email || customer.customer_email,
        });
        await customerRepository.save(customer);
        console.log(`✅ Updated customer ${customerId}`);
      }
    } catch (error) {
      console.error('❌ Error processing user update:', error);
      throw error;
    }
  } 

  /**
   * Process vendor registration message
   */
  private async processVendor(vendorData: any): Promise<void> {
    try {
      console.log('🏪 Processing vendor registration:', vendorData);
      const sellerRepository = AppDataSource.getRepository(Seller);
      const sellerId = Number(vendorData.id);
      if (!sellerId || isNaN(sellerId) || sellerId === 0) {
        console.error('❌ Invalid vendor ID in vendor registration:', vendorData);
        return;
      }
      let seller = await sellerRepository.findOne({ where: { seller_id: sellerId } });
      if (!seller) {
        console.log(`✨ Creating new seller ${sellerId} from vendor registration`);
        seller = sellerRepository.create({
          seller_id: sellerId,
        });
        await sellerRepository.save(seller);
        console.log(`✅ Created new seller ${sellerId}`);
      } else {
        console.log(`📝 Seller ${sellerId} already exists, skipping creation`);
      }
    } catch (error) {
      console.error('❌ Error processing vendor registration:', error);
      throw error;
    }
  }

  /**
   * Process wishlist message
   */
  private async processWishlist(wishlistData: any): Promise<void> {
    try {
      console.log('💖 Processing wishlist update:', wishlistData);
      const customerRepository = AppDataSource.getRepository(Customer);
      const productRepository = AppDataSource.getRepository(Product);
      const wishlistRepository = AppDataSource.getRepository(Wishlist);

      const customerId = Number(wishlistData.customerId ?? wishlistData.customer_id);
      const productId = Number(wishlistData.productId ?? wishlistData.product_id);

      if (!customerId || isNaN(customerId) || customerId === 0) {
        console.error('❌ Invalid customer ID in wishlist update:', wishlistData);
        return;
      }
      if (!productId || isNaN(productId) || productId === 0) {
        console.error('❌ Invalid product ID in wishlist update:', wishlistData);
        return;
      }

      const customer = await customerRepository.findOne({ where: { customer_id: customerId } });
      if (!customer) {
        console.error(`❌ Customer ${customerId} not found for wishlist update`);
        return;
      }

      const product = await productRepository.findOne({ where: { product_id: productId } });
      if (!product) {
        console.error(`❌ Product ${productId} not found for wishlist update`);
        return;
      }

      // Check if wishlist entry already exists
      const existingEntry = await wishlistRepository.findOne({
        where: { customer: { customer_id: customerId }, product: { product_id: productId } }
      });

      if (existingEntry) {
        console.log(`📝 Wishlist entry for customer ${customerId} and product ${productId} already exists, skipping.`);
        return;
      }

      // Create new wishlist entry
      const createdAt = (wishlistData.createdAt ?? wishlistData.created_at)?.seconds
        ? new Date(Number((wishlistData.createdAt ?? wishlistData.created_at).seconds) * 1000)
        : new Date();

      const wishlistEntry = wishlistRepository.create({
        customer_id: customerId,
        product_id: productId,
        customer: customer,
        product: product,
        created_at: createdAt,
      });
      await wishlistRepository.save(wishlistEntry);
      console.log(`✅ Added product ${productId} to customer ${customerId}'s wishlist`);
    } catch (error) {
      console.error('❌ Error processing wishlist update:', error);
      throw error;
    }
  }


  /**
   * Get a subscription by name
   */
  public getSubscription(subscriptionName: string): any {
    return this.subscriptions.get(subscriptionName);
  }

  /**
   * Close all subscriptions
   */
  public async close(): Promise<void> {
    for (const [name, subscription] of this.subscriptions) {
      await subscription.close();
      console.log(`🔒 Closed subscription: ${name}`);
    }
    this.subscriptions.clear();
    console.log('🔒 All PubSub subscriptions closed');
  }
}

export const pubSubDataSource = PubSubDataSource.getInstance();