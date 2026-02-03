import { listProducts, listReviews, listCustomers, listOrders, initializeRealTimeUpdates } from "../information-retrieval";

global.fetch = jest.fn();

jest.mock('../pubsub-data-source', () => ({
  pubSubDataSource: {
    initialize: jest.fn()
  }
}));

import { pubSubDataSource } from "../pubsub-data-source";

describe("Information Retrieval Module", () => {
  const originalEnv = process.env;

  beforeEach(() => {
    jest.resetAllMocks();
    process.env = { ...originalEnv };
    
    process.env.LOGIN_JUMPSELLER_API = 'test-login';
    process.env.TOKEN_JUMPSELLER_API = 'test-token';
    process.env.JUMPSELLER_BASE_URL = 'https://api.test.com';
  });

  afterAll(() => {
    process.env = originalEnv;
  });

  describe("listProducts", () => {
    it("should fetch products successfully", async () => {
      const mockProducts = [{ id: 1, name: "Test Product" }];
      
      (fetch as jest.Mock).mockResolvedValue({
        ok: true,
        json: async () => mockProducts,
        status: 200
      });

      const result = await listProducts();

      expect(fetch).toHaveBeenCalledWith(
        "https://api.test.com/products.json",
        {
          method: "GET",
          headers: {
            "Authorization": "Basic " + btoa("test-login:test-token"),
            "Content-Type": "application/json",
          },
        }
      );
      expect(result).toEqual(mockProducts);
    });

    it("should handle HTTP error", async () => {
      (fetch as jest.Mock).mockResolvedValue({
        ok: false,
        status: 400,
        json: async () => ({ error: "Bad request" })
      });

      const result = await listProducts();

      expect(result).toEqual([]);
    });

    it("should handle network error", async () => {
      (fetch as jest.Mock).mockRejectedValue(new Error("Network error"));

      const result = await listProducts();

      expect(result).toEqual([]);
    });
  });

  describe("listReviews", () => {
    it("should fetch reviews successfully", async () => {
      const mockReviews = [{ id: 1, rating: 5, comment: "Great product" }];
      
      (fetch as jest.Mock).mockResolvedValue({
        ok: true,
        json: async () => mockReviews,
        status: 200
      });

      const result = await listReviews();

      expect(fetch).toHaveBeenCalledWith(
        "https://api.test.com/products/reviews.json",
        {
          method: "GET",
          headers: {
            "Authorization": "Basic " + btoa("test-login:test-token"),
            "Content-Type": "application/json",
          },
        }
      );
      expect(result).toEqual(mockReviews);
    });

    it("should return empty array on error", async () => {
      (fetch as jest.Mock).mockResolvedValue({
        ok: false,
        status: 500
      });

      const result = await listReviews();

      expect(result).toEqual([]);
    });
  });

  describe("listCustomers", () => {
    it("should fetch customers successfully", async () => {
      const mockCustomers = [{ id: 1, name: "John Doe", email: "john@test.com" }];
      
      (fetch as jest.Mock).mockResolvedValue({
        ok: true,
        json: async () => mockCustomers,
        status: 200
      });

      const result = await listCustomers();

      expect(fetch).toHaveBeenCalledWith(
        "https://api.test.com/customers.json",
        {
          method: "GET",
          headers: {
            "Authorization": "Basic " + btoa("test-login:test-token"),
            "Content-Type": "application/json",
          },
        }
      );
      expect(result).toEqual(mockCustomers);
    });
  });

  describe("listOrders", () => {
    it("should fetch orders successfully", async () => {
      const mockOrders = [{ id: 1, total: 99.99, status: "completed" }];
      
      (fetch as jest.Mock).mockResolvedValue({
        ok: true,
        json: async () => mockOrders,
        status: 200
      });

      const result = await listOrders();

      expect(fetch).toHaveBeenCalledWith(
        "https://api.test.com/orders.json",
        {
          method: "GET",
          headers: {
            "Authorization": "Basic " + btoa("test-login:test-token"),
            "Content-Type": "application/json",
          },
        }
      );
      expect(result).toEqual(mockOrders);
    });
  });

  describe("initializeRealTimeUpdates", () => {
    it("should initialize pubSubDataSource successfully", async () => {
      (pubSubDataSource.initialize as jest.Mock).mockResolvedValue(undefined);

      await initializeRealTimeUpdates();

      expect(pubSubDataSource.initialize).toHaveBeenCalledTimes(1);
    });

    it("should handle initialization errors gracefully", async () => {
      (pubSubDataSource.initialize as jest.Mock).mockRejectedValue(new Error("Connection failed"));

      await expect(initializeRealTimeUpdates()).resolves.toBeUndefined();
      
      expect(pubSubDataSource.initialize).toHaveBeenCalledTimes(1);
    });
  });
});