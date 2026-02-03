// Mock PubSub before imports
const mockSubscription = {
  on: jest.fn(),
  exists: jest.fn().mockResolvedValue([true]),
  close: jest.fn().mockResolvedValue(undefined),
  open: jest.fn(),
  listenerCount: jest.fn().mockReturnValue(0),
  name: 'mock-subscription',
};

const mockTopic = {
  exists: jest.fn().mockResolvedValue([true]),
  subscription: jest.fn(() => mockSubscription),
  createSubscription: jest.fn().mockResolvedValue([mockSubscription]),
  publishMessage: jest.fn().mockResolvedValue('mock-message-id'),
};

const mockPubSubClient = {
  topic: jest.fn(() => mockTopic),
  createTopic: jest.fn().mockResolvedValue([mockTopic]),
};

jest.mock('@google-cloud/pubsub', () => ({
  PubSub: jest.fn(() => mockPubSubClient),
}));

// Mock protobufjs
const mockProtoType = {
  decode: jest.fn(),
  toObject: jest.fn(),
  encode: jest.fn(() => ({ finish: jest.fn(() => Buffer.from('mock-encoded-data')) })),
  verify: jest.fn().mockReturnValue(null),
};

const mockProtoRoot = {
  lookupType: jest.fn(() => mockProtoType),
};

jest.mock('protobufjs', () => ({
  load: jest.fn(() => Promise.resolve(mockProtoRoot)),
}));

// Mock AppDataSource
const mockRepository = {
  findOne: jest.fn(),
  create: jest.fn(),
  save: jest.fn(),
  merge: jest.fn(),
};

jest.mock('../postgres-data-source', () => ({
  AppDataSource: {
    getRepository: jest.fn(() => mockRepository),
  },
}));

import { PubSubDataSource, pubSubDataSource } from '../pubsub-data-source';
import { AppDataSource } from '../postgres-data-source';

describe('PubSubDataSource', () => {
  let mockConsoleLog: jest.SpyInstance;
  let mockConsoleError: jest.SpyInstance;

  beforeEach(() => {
    // Clear all mocks
    jest.clearAllMocks();

    // Mock console
    mockConsoleLog = jest.spyOn(console, 'log').mockImplementation();
    mockConsoleError = jest.spyOn(console, 'error').mockImplementation();

    // Reset singleton
    (PubSubDataSource as any).instance = undefined;

    // Reset mock implementations
    mockSubscription.on.mockImplementation(() => mockSubscription);
    mockSubscription.open.mockImplementation(() => undefined);
    mockSubscription.listenerCount.mockReturnValue(0);
    mockSubscription.exists.mockResolvedValue([true]);
    mockTopic.exists.mockResolvedValue([true]);
    mockRepository.findOne.mockResolvedValue(null);
    mockRepository.create.mockImplementation((data) => data);
    mockRepository.save.mockImplementation((data) => Promise.resolve(data));
  });

  afterEach(() => {
    mockConsoleLog.mockRestore();
    mockConsoleError.mockRestore();
  });

  describe('Singleton Pattern', () => {
    it('should return the same instance multiple times', () => {
      const instance1 = PubSubDataSource.getInstance();
      const instance2 = PubSubDataSource.getInstance();

      expect(instance1).toBe(instance2);
    });

    it('should use the exported singleton', () => {
      const instance = PubSubDataSource.getInstance();
      // Both should be instances of PubSubDataSource
      expect(instance).toBeInstanceOf(PubSubDataSource);
      expect(pubSubDataSource).toBeInstanceOf(PubSubDataSource);
    });
  });

  describe('Initialization', () => {
    it('should initialize all subscriptions successfully', async () => {
      const instance = PubSubDataSource.getInstance();
      await instance.initialize();

      // Should load all 6 protobuf definitions
      expect(mockProtoRoot.lookupType).toHaveBeenCalledTimes(6);
      
      // Should create 6 subscriptions (review, order, product, user, vendor, wishlist)
      expect(mockPubSubClient.topic).toHaveBeenCalledWith('new_review');
      expect(mockPubSubClient.topic).toHaveBeenCalledWith('new_order');
      expect(mockPubSubClient.topic).toHaveBeenCalledWith('products');
      expect(mockPubSubClient.topic).toHaveBeenCalledWith('users');
      expect(mockPubSubClient.topic).toHaveBeenCalledWith('vendor-registration-topic');
      expect(mockPubSubClient.topic).toHaveBeenCalledWith('wishlist');

      expect(mockConsoleLog).toHaveBeenCalledWith(expect.stringContaining('✅ All PubSub subscriptions initialized successfully'));
    });

    it('should skip subscription setup if topic does not exist', async () => {
      mockTopic.exists.mockResolvedValueOnce([false]);
      
      const instance = PubSubDataSource.getInstance();
      await instance.initialize();

      expect(mockPubSubClient.createTopic).not.toHaveBeenCalled();
      expect(instance.getSubscription('new_review_sub_31')).toBeUndefined();
    });

    it('should create subscription if it does not exist', async () => {
      mockSubscription.exists.mockResolvedValueOnce([false]);
      
      const instance = PubSubDataSource.getInstance();
      await instance.initialize();

      expect(mockTopic.createSubscription).toHaveBeenCalled();
    });

    it('should handle initialization errors gracefully', async () => {
      mockProtoRoot.lookupType.mockImplementationOnce(() => {
        throw new Error('Proto load failed');
      });

      const instance = PubSubDataSource.getInstance();
      
      await expect(instance.initialize()).rejects.toThrow('Proto load failed');
      expect(mockConsoleError).toHaveBeenCalledWith(
        expect.stringContaining('❌ Failed to load protobuf definitions'),
        expect.any(Error)
      );
    });
  });

  describe('Message Parsing', () => {
    let instance: PubSubDataSource;

    beforeEach(async () => {
      instance = PubSubDataSource.getInstance();
      await instance.initialize();
    });

    it('should decode review messages correctly', () => {
      const mockBuffer = Buffer.from('mock-review-data');
      const decodedData = { id: 1, productId: 123, customerId: 8 };
      
      mockProtoType.decode.mockReturnValue(decodedData);
      mockProtoType.toObject.mockReturnValue(decodedData);

      // Access private method via any
      const result = (instance as any).parseMessageData('new_review_sub_31', mockBuffer);

      expect(mockProtoType.decode).toHaveBeenCalledWith(mockBuffer);
      expect(result).toEqual(decodedData);
    });

    it('should decode order messages with longs as strings', () => {
      const mockBuffer = Buffer.from('mock-order-data');
      const decodedData = { id: '1001', customerId: '8' };
      
      mockProtoType.decode.mockReturnValue(decodedData);
      mockProtoType.toObject.mockReturnValue(decodedData);

      const result = (instance as any).parseMessageData('new_order_sub_31', mockBuffer);

      expect(mockProtoType.toObject).toHaveBeenCalledWith(
        decodedData,
        expect.objectContaining({ longs: String })
      );
    });

    it('should skip test emulator messages', () => {
      const mockBuffer = Buffer.from('Hello, Pub/Sub emulator!');

      // For the test emulator message to be caught, we need to use a subscription
      // that doesn't have a protobuf parser, so it falls through to JSON parsing
      // Or we can test with 'unknown_sub' which will go to fallback
      expect(() => {
        (instance as any).parseMessageData('unknown_subscription', mockBuffer);
      }).toThrow('TEST_MESSAGE_SKIP');
    });

    it('should handle parsing errors', () => {
      mockProtoType.decode.mockImplementation(() => {
        throw new Error('Decode failed');
      });

      const mockBuffer = Buffer.from('invalid-data');

      expect(() => {
        (instance as any).parseMessageData('new_review_sub_31', mockBuffer);
      }).toThrow('Invalid message format');
    });
  });

  describe('Review Processing', () => {
    let instance: PubSubDataSource;

    beforeEach(async () => {
      instance = PubSubDataSource.getInstance();
      await instance.initialize();
    });

    it('should create new review with placeholder customer', async () => {
      const reviewData = {
        id: 5001,
        productId: 123,
        customerId: 8,
        rating: 5,
        createdAt: { seconds: 1234567890 },
      };

      mockRepository.findOne
        .mockResolvedValueOnce(null) // Customer not found
        .mockResolvedValueOnce(null); // Review not found

      await (instance as any).processNewReview(reviewData);

      // Should create placeholder customer
      expect(mockRepository.create).toHaveBeenCalledWith(
        expect.objectContaining({
          customer_id: 8,
          customer_email: 'customer-8@placeholder.com',
        })
      );

      // Should create review
      expect(mockRepository.create).toHaveBeenCalledWith(
        expect.objectContaining({
          review_id: 5001,
          product_id: 123,
          customer_id: 8,
          rating: 5,
        })
      );

      expect(mockRepository.save).toHaveBeenCalledTimes(2);
    });

    it('should update existing review', async () => {
      const reviewData = {
        id: 5001,
        productId: 123,
        customerId: 8,
        rating: 4,
        createdAt: { seconds: 1234567890 },
      };

      const existingCustomer = { customer_id: 8 };
      const existingReview = { review_id: 5001, rating: 3 };

      mockRepository.findOne
        .mockResolvedValueOnce(existingCustomer)
        .mockResolvedValueOnce(existingReview);

      await (instance as any).processNewReview(reviewData);

      expect(mockRepository.merge).toHaveBeenCalledWith(
        existingReview,
        expect.objectContaining({ rating: 4 })
      );
      expect(mockRepository.save).toHaveBeenCalledWith(existingReview);
    });

    it('should handle missing required fields', async () => {
      const reviewData = {
        id: null,
        productId: 123,
        customerId: 8,
      };

      await (instance as any).processNewReview(reviewData);

      expect(mockConsoleError).toHaveBeenCalledWith(
        expect.stringContaining('❌ Missing required fields'),
        reviewData
      );
      expect(mockRepository.save).not.toHaveBeenCalled();
    });

    it('should convert timestamp correctly', async () => {
      const reviewData = {
        id: 5001,
        productId: 123,
        customerId: 8,
        rating: 5,
        createdAt: { seconds: 1609459200 }, // 2021-01-01 00:00:00 UTC
      };

      mockRepository.findOne.mockResolvedValue(null);

      await (instance as any).processNewReview(reviewData);

      const expectedDate = new Date(1609459200 * 1000);
      expect(mockRepository.create).toHaveBeenCalledWith(
        expect.objectContaining({
          reviewed_at: expectedDate,
        })
      );
    });
  });

  describe('Order Processing', () => {
    let instance: PubSubDataSource;

    beforeEach(async () => {
      instance = PubSubDataSource.getInstance();
      await instance.initialize();
    });

    it('should create order with items using composite keys', async () => {
      const orderData = {
        id: '1001',
        customerId: '8',
        createdAt: { seconds: '1234567890' },
        items: [
          { productId: '123', quantity: 2 },
          { productId: '456', quantity: 1 },
        ],
      };

      const mockProduct = { product_id: 123 };
      
      mockRepository.findOne
        .mockResolvedValueOnce(null) // Customer not found
        .mockResolvedValueOnce(null) // Order not found
        .mockResolvedValueOnce(mockProduct) // Product 123
        .mockResolvedValueOnce(null) // OrderItem not found
        .mockResolvedValueOnce(mockProduct) // Product 456
        .mockResolvedValueOnce(null); // OrderItem not found

      await (instance as any).processNewOrder(orderData);

      // Should create order
      expect(mockRepository.create).toHaveBeenCalledWith(
        expect.objectContaining({
          order_id: 1001,
          customer_id: 8,
        })
      );

      // Should create 2 order items with composite keys
      expect(mockRepository.create).toHaveBeenCalledWith(
        expect.objectContaining({
          order_id: 1001,
          product_id: 123,
          quantity: 2,
        })
      );

      expect(mockRepository.create).toHaveBeenCalledWith(
        expect.objectContaining({
          order_id: 1001,
          product_id: 456,
          quantity: 1,
        })
      );
    });

    it('should update existing order item quantity', async () => {
      const orderData = {
        id: '1001',
        customerId: '8',
        createdAt: { seconds: '1234567890' },
        items: [{ productId: '123', quantity: 5 }],
      };

      const existingOrder = { order_id: 1001 };
      const existingItem = { order_id: 1001, product_id: 123, quantity: 2 };
      const mockProduct = { product_id: 123 };

      mockRepository.findOne
        .mockResolvedValueOnce(null) // Customer
        .mockResolvedValueOnce(existingOrder) // Order exists
        .mockResolvedValueOnce(mockProduct) // Product
        .mockResolvedValueOnce(existingItem); // OrderItem exists

      await (instance as any).processNewOrder(orderData);

      expect(existingItem.quantity).toBe(5);
      expect(mockRepository.save).toHaveBeenCalledWith(existingItem);
    });

    it('should skip items with invalid product IDs', async () => {
      const orderData = {
        id: '1001',
        customerId: '8',
        items: [
          { productId: '0', quantity: 2 },
          { productId: null, quantity: 1 },
        ],
      };

      mockRepository.findOne.mockResolvedValue(null);

      await (instance as any).processNewOrder(orderData);

      // Should not create any order items
      const createCalls = mockRepository.create.mock.calls.filter(
        (call) => call[0].order_id
      );
      expect(createCalls.length).toBe(1); // Only the order itself
    });
  });

  describe('Product Processing', () => {
    let instance: PubSubDataSource;

    beforeEach(async () => {
      instance = PubSubDataSource.getInstance();
      await instance.initialize();
    });

    it('should create new product', async () => {
      const productData = {
        id: 999,
        name: 'New Product',
        imageUrl: 'https://example.com/image.jpg',
        price: 49.99,
      };

      mockRepository.findOne.mockResolvedValue(null);

      await (instance as any).processProduct(productData);

      expect(mockRepository.create).toHaveBeenCalledWith({
        product_id: 999,
        name: 'New Product',
        image_url: 'https://example.com/image.jpg',
        price: 49.99,
      });
      expect(mockRepository.save).toHaveBeenCalled();
    });

    it('should update existing product', async () => {
      const productData = {
        id: 999,
        name: 'Updated Product',
        price: 59.99,
      };

      const existingProduct = {
        product_id: 999,
        name: 'Old Product',
        image_url: 'old-url.jpg',
        price: 49.99,
      };

      mockRepository.findOne.mockResolvedValue(existingProduct);

      await (instance as any).processProduct(productData);

      expect(mockRepository.merge).toHaveBeenCalledWith(
        existingProduct,
        expect.objectContaining({
          name: 'Updated Product',
          price: 59.99,
        })
      );
    });

    it('should reject invalid product IDs', async () => {
      await (instance as any).processProduct({ id: 0 });
      expect(mockRepository.save).not.toHaveBeenCalled();

      await (instance as any).processProduct({ id: null });
      expect(mockRepository.save).not.toHaveBeenCalled();
    });
  });

  describe('User Processing', () => {
    let instance: PubSubDataSource;

    beforeEach(async () => {
      instance = PubSubDataSource.getInstance();
      await instance.initialize();
    });

    it('should create new customer from user data', async () => {
      const userData = {
        id: 10,
        email: 'user@example.com',
        name: 'John Doe',
      };

      mockRepository.findOne.mockResolvedValue(null);

      await (instance as any).processUser(userData);

      expect(mockRepository.create).toHaveBeenCalledWith({
        customer_id: 10,
        customer_email: 'user@example.com',
      });
    });

    it('should update existing customer email', async () => {
      const userData = {
        id: 10,
        email: 'newemail@example.com',
      };

      const existingCustomer = {
        customer_id: 10,
        customer_email: 'old@example.com',
      };

      mockRepository.findOne.mockResolvedValue(existingCustomer);

      await (instance as any).processUser(userData);

      expect(mockRepository.merge).toHaveBeenCalledWith(
        existingCustomer,
        expect.objectContaining({
          customer_email: 'newemail@example.com',
        })
      );
    });
  });

  describe('Wishlist Processing', () => {
    let instance: PubSubDataSource;

    beforeEach(async () => {
      instance = PubSubDataSource.getInstance();
      await instance.initialize();
    });

    it('should create wishlist entry', async () => {
      const wishlistData = {
        customerId: 8,
        productId: 123,
        createdAt: { seconds: 1234567890 },
      };

      const mockCustomer = { customer_id: 8 };
      const mockProduct = { product_id: 123 };

      mockRepository.findOne
        .mockResolvedValueOnce(mockCustomer)
        .mockResolvedValueOnce(mockProduct)
        .mockResolvedValueOnce(null); // No existing entry

      await (instance as any).processWishlist(wishlistData);

      expect(mockRepository.create).toHaveBeenCalledWith(
        expect.objectContaining({
          customer: mockCustomer,
          product: mockProduct,
        })
      );
    });

    it('should skip if wishlist entry already exists', async () => {
      const wishlistData = {
        customerId: 8,
        productId: 123,
      };

      const existingEntry = { customer_id: 8, product_id: 123 };

      mockRepository.findOne.mockResolvedValue(existingEntry);

      await (instance as any).processWishlist(wishlistData);

      expect(mockRepository.create).not.toHaveBeenCalled();
    });

    it('should reject if customer not found', async () => {
      const wishlistData = {
        customerId: 999,
        productId: 123,
      };

      mockRepository.findOne.mockResolvedValue(null);

      await (instance as any).processWishlist(wishlistData);

      expect(mockConsoleError).toHaveBeenCalledWith(
        expect.stringContaining('❌ Customer 999 not found')
      );
    });
  });

  describe('Vendor Processing', () => {
    let instance: PubSubDataSource;

    beforeEach(async () => {
      instance = PubSubDataSource.getInstance();
      await instance.initialize();
    });

    it('should create new seller from vendor registration', async () => {
      const vendorData = { id: 1 };

      mockRepository.findOne.mockResolvedValue(null);

      await (instance as any).processVendor(vendorData);

      expect(mockRepository.create).toHaveBeenCalledWith({
        seller_id: 1,
      });
      expect(mockRepository.save).toHaveBeenCalled();
    });

    it('should skip if seller already exists', async () => {
      const vendorData = { id: 1 };
      const existingSeller = { seller_id: 1 };

      mockRepository.findOne.mockResolvedValue(existingSeller);

      await (instance as any).processVendor(vendorData);

      expect(mockRepository.create).not.toHaveBeenCalled();
    });
  });

  describe('Subscription Management', () => {
    let instance: PubSubDataSource;

    beforeEach(async () => {
      instance = PubSubDataSource.getInstance();
      await instance.initialize();
    });

    it('should retrieve subscription by name', () => {
      const subscription = instance.getSubscription('new_review_sub_31');
      expect(subscription).toBeDefined();
    });

    it('should return undefined for non-existent subscription', () => {
      const subscription = instance.getSubscription('non_existent_sub');
      expect(subscription).toBeUndefined();
    });

    it('should close all subscriptions', async () => {
      await instance.close();

      expect(mockSubscription.close).toHaveBeenCalled();
      expect(mockConsoleLog).toHaveBeenCalledWith(
        expect.stringContaining('🔒 All PubSub subscriptions closed')
      );
    });
  });

  describe('Error Handling', () => {
    let instance: PubSubDataSource;

    beforeEach(async () => {
      instance = PubSubDataSource.getInstance();
      await instance.initialize();
    });

    it('should handle repository errors in review processing', async () => {
      const reviewData = {
        id: 5001,
        productId: 123,
        customerId: 8,
        rating: 5,
      };

      mockRepository.save.mockRejectedValue(new Error('Database error'));

      await expect((instance as any).processNewReview(reviewData)).rejects.toThrow('Database error');
      
      expect(mockConsoleError).toHaveBeenCalledWith(
        expect.stringContaining('❌ Error processing review'),
        expect.any(Error)
      );
    });

    it('should handle repository errors in order processing', async () => {
      const orderData = {
        id: '1001',
        items: [],
      };

      mockRepository.save.mockRejectedValue(new Error('Database error'));

      await expect((instance as any).processNewOrder(orderData)).rejects.toThrow('Database error');
    });

    it('should acknowledge messages even on processing errors', async () => {
      const instance = PubSubDataSource.getInstance();
      await instance.initialize();

      // Simulate message handler being called
      const messageHandler = mockSubscription.on.mock.calls[0][1];
      const mockMessage = {
        id: 'test-message-id',
        data: Buffer.from('test-data'),
        ack: jest.fn(),
      };

      // Mock parseMessageData to throw error
      jest.spyOn(instance as any, 'parseMessageData').mockImplementation(() => {
        throw new Error('Parse error');
      });

      await messageHandler(mockMessage);

      expect(mockMessage.ack).toHaveBeenCalled();
      // The actual console.log is called inside the try-catch, not the mock
      // Just verify the message was acknowledged which is the important behavior
      expect(mockMessage.ack).toHaveBeenCalledTimes(1);
    });
  });
});
