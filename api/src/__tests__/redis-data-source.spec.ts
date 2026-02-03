const mockRedisClient = {
  isOpen: false,
  connect: jest.fn(),
  disconnect: jest.fn(),
  get: jest.fn(),
  on: jest.fn(),
};

jest.mock('redis', () => ({
  createClient: jest.fn(() => mockRedisClient),
}));

import { RedisDataSource, redisDataSource } from '../redis-data-source';

describe('RedisDataSource', () => {
  let mockConsoleLog: jest.SpyInstance;
  let mockConsoleError: jest.SpyInstance;

  beforeEach(() => {
    // Reset all mocks
    jest.clearAllMocks();
    
    // Reset mock client state
    Object.assign(mockRedisClient, {
      isOpen: false,
      connect: jest.fn(),
      disconnect: jest.fn(),
      get: jest.fn(),
      on: jest.fn(),
    });
    
    // Mock console
    mockConsoleLog = jest.spyOn(console, 'log').mockImplementation();
    mockConsoleError = jest.spyOn(console, 'error').mockImplementation();
    
    // Reset singleton
    (RedisDataSource as any).instance = undefined;
  });

  afterEach(() => {
    mockConsoleLog.mockRestore();
    mockConsoleError.mockRestore();
  });

  describe('Singleton Pattern', () => {
    it('should return the same instance multiple times', () => {
      const instance1 = RedisDataSource.getInstance();
      const instance2 = RedisDataSource.getInstance();

      expect(instance1).toBe(instance2);
    });

    it('should create new instance only once', () => {
      const instance1 = RedisDataSource.getInstance();
      const instance2 = RedisDataSource.getInstance();

      const { createClient } = require('redis');
      expect(createClient).toHaveBeenCalledTimes(1);
    });
  });

  describe('Constructor and Configuration', () => {
    it('should create client with correct configuration', () => {
      process.env.NODE_ENV = 'development';
      process.env.REDIS_HOST = 'test-host';
      process.env.REDIS_PORT = '6380';
      process.env.REDIS_PASSWORD = 'test-password';

      RedisDataSource.getInstance();

      const { createClient } = require('redis');
      expect(createClient).toHaveBeenCalledWith({
        socket: {
          host: 'test-host',
          port: 6380,
          reconnectStrategy: expect.any(Function)
        },
        password: 'test-password',
      });
    });

    it('should set up event listeners', () => {
      RedisDataSource.getInstance();

      expect(mockRedisClient.on).toHaveBeenCalledWith('error', expect.any(Function));
      expect(mockRedisClient.on).toHaveBeenCalledWith('connect', expect.any(Function));
    });
  });

  describe('connect', () => {
    it('should connect when client is not open', async () => {
      mockRedisClient.isOpen = false;
      const dataSource = RedisDataSource.getInstance();

      await dataSource.connect();

      expect(mockRedisClient.connect).toHaveBeenCalledTimes(1);
    });

    it('should not connect when client is already open', async () => {
      mockRedisClient.isOpen = true;
      const dataSource = RedisDataSource.getInstance();

      await dataSource.connect();

      expect(mockRedisClient.connect).not.toHaveBeenCalled();
    });
  });

  describe('disconnect', () => {
    it('should disconnect when client is open', async () => {
      mockRedisClient.isOpen = true;
      const dataSource = RedisDataSource.getInstance();

      await dataSource.disconnect();

      expect(mockRedisClient.disconnect).toHaveBeenCalledTimes(1);
    });

    it('should not disconnect when client is not open', async () => {
      mockRedisClient.isOpen = false;
      const dataSource = RedisDataSource.getInstance();

      await dataSource.disconnect();

      expect(mockRedisClient.disconnect).not.toHaveBeenCalled();
    });
  });

  describe('getUserRecommendations', () => {
    it('should return parsed recommendations for user', async () => {
      const dataSource = RedisDataSource.getInstance();
      const mockRecommendations = [{ productId: 1, score: 0.9 }];
      mockRedisClient.get.mockResolvedValue(JSON.stringify(mockRecommendations));

      const result = await dataSource.getUserRecommendations('user123');

      expect(mockRedisClient.get).toHaveBeenCalledWith('recommendations:user123');
      expect(result).toEqual(mockRecommendations);
    });

    it('should return empty array when no data found', async () => {
      const dataSource = RedisDataSource.getInstance();
      mockRedisClient.get.mockResolvedValue(null);

      const result = await dataSource.getUserRecommendations('user123');

      expect(result).toEqual([]);
    });

    it('should handle JSON parse error and return empty array', async () => {
      const dataSource = RedisDataSource.getInstance();
      mockRedisClient.get.mockResolvedValue('invalid-json');

      const result = await dataSource.getUserRecommendations('user123');

      expect(result).toEqual([]);
      expect(mockConsoleError).toHaveBeenCalledWith(
        'Error getting recommendations for user user123:',
        expect.any(Error)
      );
    });

    it('should handle redis error and return empty array', async () => {
      const dataSource = RedisDataSource.getInstance();
      mockRedisClient.get.mockRejectedValue(new Error('Redis error'));

      const result = await dataSource.getUserRecommendations('user123');

      expect(result).toEqual([]);
      expect(mockConsoleError).toHaveBeenCalledWith(
        'Error getting recommendations for user user123:',
        expect.any(Error)
      );
    });
  });

  describe('getPopularProducts', () => {
    it('should return parsed popular products', async () => {
      const dataSource = RedisDataSource.getInstance();
      const mockPopularProducts = [{ productId: 1, popularity: 100 }];
      mockRedisClient.get.mockResolvedValue(JSON.stringify(mockPopularProducts));

      const result = await dataSource.getPopularProducts();

      expect(mockRedisClient.get).toHaveBeenCalledWith('recommendations:global:popular');
      expect(result).toEqual(mockPopularProducts);
    });

    it('should return empty array when no popular products found', async () => {
      const dataSource = RedisDataSource.getInstance();
      mockRedisClient.get.mockResolvedValue(null);

      const result = await dataSource.getPopularProducts();

      expect(result).toEqual([]);
    });

    it('should handle errors and return empty array', async () => {
      const dataSource = RedisDataSource.getInstance();
      mockRedisClient.get.mockRejectedValue(new Error('Redis error'));

      const result = await dataSource.getPopularProducts();

      expect(result).toEqual([]);
      expect(mockConsoleError).toHaveBeenCalledWith(
        'Error getting popular products:',
        expect.any(Error)
      );
    });
  });

  describe('Event Handlers', () => {
    it('should trigger connect event handler', () => {
      RedisDataSource.getInstance();
      
      // Get the connect event handler
      const connectCall = mockRedisClient.on.mock.calls.find((call: any) => call[0] === 'connect');
      const connectHandler = connectCall[1];
      
      connectHandler();
      
      expect(mockConsoleLog).toHaveBeenCalledWith('Redis Client Connected');
    });

    it('should trigger error event handler', () => {
      RedisDataSource.getInstance();
      
      // Get the error event handler
      const errorCall = mockRedisClient.on.mock.calls.find((call: any) => call[0] === 'error');
      const errorHandler = errorCall[1];
      const testError = new Error('Test error');
      
      errorHandler(testError);
      
      expect(mockConsoleError).toHaveBeenCalledWith('Redis Client Error', testError);
    });
  });

  describe('redisDataSource export', () => {
    it('should export singleton instance', () => {
      const instance1 = redisDataSource;
      const instance2 = redisDataSource;

      expect(instance1).toBe(instance2);
    });
  });

  describe('Reconnect Strategy', () => {
    it('should calculate reconnect delay correctly', () => {
      RedisDataSource.getInstance();

      const { createClient } = require('redis');
      const config = createClient.mock.calls[0][0];
      const reconnectStrategy = config.socket.reconnectStrategy;
      
      // Test the reconnect strategy function
      expect(reconnectStrategy(1)).toBe(50);
      expect(reconnectStrategy(2)).toBe(100);
      expect(reconnectStrategy(10)).toBe(500);
      expect(reconnectStrategy(50)).toBe(1000); // Max 1000ms
    });
  });
});