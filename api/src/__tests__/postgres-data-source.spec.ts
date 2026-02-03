import { 
  AppDataSource,
  saveCustomersToDB,
  getAllCustomers,
  saveProductsToDB,
  getAllProducts,
  getProductById,
  getProductByIdMock,
  saveReviewsToDB,
  getAllReviews,
  saveOrdersToDB,
  getAllOrders
} from "../postgres-data-source";
import { Customer } from "../entities/Customer";
import { Product } from "../entities/Product";
import { Review } from "../entities/Review";
import { Order } from "../entities/Order";
import { OrderItem } from "../entities/OrderItem";
import { listCustomers, listProducts, listReviews, listOrders } from '../information-retrieval';

jest.mock('../information-retrieval');
jest.mock('typeorm', () => ({
  ...jest.requireActual('typeorm'),
  DataSource: jest.fn(),
}));

const mockListCustomers = listCustomers as jest.MockedFunction<typeof listCustomers>;
const mockListProducts = listProducts as jest.MockedFunction<typeof listProducts>;
const mockListReviews = listReviews as jest.MockedFunction<typeof listReviews>;
const mockListOrders = listOrders as jest.MockedFunction<typeof listOrders>;

const mockCustomerRepository = {
  findOne: jest.fn(),
  create: jest.fn(),
  save: jest.fn(),
  find: jest.fn(),
};

const mockProductRepository = {
  findOne: jest.fn(),
  create: jest.fn(),
  save: jest.fn(),
  find: jest.fn(),
};

const mockReviewRepository = {
  findOne: jest.fn(),
  create: jest.fn(),
  save: jest.fn(),
  find: jest.fn(),
};

const mockOrderRepository = {
  findOne: jest.fn(),
  create: jest.fn(),
  save: jest.fn(),
  find: jest.fn(),
};

const mockItemRepository = {
  create: jest.fn(),
};

describe("Database Service", () => {
  let mockConsoleLog: jest.SpyInstance;
  let mockConsoleError: jest.SpyInstance;

  beforeAll(() => {
    mockConsoleLog = jest.spyOn(console, 'log').mockImplementation();
    mockConsoleError = jest.spyOn(console, 'error').mockImplementation();
  });

  beforeEach(() => {
    jest.clearAllMocks();

    (AppDataSource.getRepository as jest.Mock) = jest.fn((entity) => {
      if (entity === Customer) return mockCustomerRepository;
      if (entity === Product) return mockProductRepository;
      if (entity === Review) return mockReviewRepository;
      if (entity === Order) return mockOrderRepository;
      if (entity === OrderItem) return mockItemRepository;
      return null;
    });
  });

  afterAll(() => {
    mockConsoleLog.mockRestore();
    mockConsoleError.mockRestore();
  });

  describe("saveCustomersToDB", () => {
    it("should save new customers to database", async () => {
      const mockApiCustomers = [
        { customer: { id: 1, email: "test1@example.com" } },
        { customer: { id: 2, email: "test2@example.com" } }
      ];

      mockListCustomers.mockResolvedValue(mockApiCustomers);
      mockCustomerRepository.findOne.mockResolvedValue(null); // Customer doesn't exist
      mockCustomerRepository.create.mockImplementation((data) => data);
      mockCustomerRepository.save.mockResolvedValue({});

      await saveCustomersToDB();

      expect(mockListCustomers).toHaveBeenCalledTimes(1);
      expect(mockCustomerRepository.findOne).toHaveBeenCalledTimes(2);
      expect(mockCustomerRepository.create).toHaveBeenCalledTimes(2);
      expect(mockCustomerRepository.save).toHaveBeenCalledTimes(2);
    });

    it("should skip existing customers", async () => {
      const mockApiCustomers = [
        { customer: { id: 1, email: "existing@example.com" } }
      ];

      mockListCustomers.mockResolvedValue(mockApiCustomers);
      mockCustomerRepository.findOne.mockResolvedValue({ id: 1 }); // Customer exists

      await saveCustomersToDB();

      expect(mockCustomerRepository.findOne).toHaveBeenCalledWith({
        where: { customer_email: "existing@example.com" }
      });
      expect(mockCustomerRepository.create).not.toHaveBeenCalled();
      expect(mockCustomerRepository.save).not.toHaveBeenCalled();
    });

    it("should handle empty API response", async () => {
      mockListCustomers.mockResolvedValue([]);

      await saveCustomersToDB();

      expect(mockListCustomers).toHaveBeenCalledTimes(1);
      expect(mockCustomerRepository.findOne).not.toHaveBeenCalled();
    });
  });

  describe("getAllCustomers", () => {
    it("should return all customers from database", async () => {
      const mockCustomers = [
        { customer_id: 1, customer_email: "test1@example.com" },
        { customer_id: 2, customer_email: "test2@example.com" }
      ];

      mockCustomerRepository.find.mockResolvedValue(mockCustomers);

      const result = await getAllCustomers();

      expect(mockCustomerRepository.find).toHaveBeenCalledTimes(1);
      expect(result).toEqual(mockCustomers);
    });
  });

  describe("saveProductsToDB", () => {
    it("should save new products to database", async () => {
      const mockApiProducts = [
        { 
          product: { 
            id: 1, 
            name: "Test Product", 
            price: 29.99,
            images: [{ position: 1, url: "http://example.com/image1.jpg" }]
          } 
        }
      ];

      mockListProducts.mockResolvedValue(mockApiProducts);
      mockProductRepository.findOne.mockResolvedValue(null); // Product doesn't exist
      mockProductRepository.create.mockImplementation((data) => data);
      mockProductRepository.save.mockResolvedValue({});

      await saveProductsToDB();

      expect(mockListProducts).toHaveBeenCalledTimes(1);
      expect(mockProductRepository.findOne).toHaveBeenCalledWith({
        where: { product_id: 1 }
      });
      expect(mockProductRepository.create).toHaveBeenCalledWith({
        product_id: 1,
        image_url: "http://example.com/image1.jpg",
        name: "Test Product",
        price: 29.99
      });
      expect(mockProductRepository.save).toHaveBeenCalledTimes(1);
    });

    it("should handle products without images", async () => {
      const mockApiProducts = [
        { 
          product: { 
            id: 2, 
            name: "No Image Product", 
            price: 19.99,
            images: []
          } 
        }
      ];

      mockListProducts.mockResolvedValue(mockApiProducts);
      mockProductRepository.findOne.mockResolvedValue(null);

      await saveProductsToDB();

      expect(mockProductRepository.create).toHaveBeenCalledWith({
        product_id: 2,
        image_url: null,
        name: "No Image Product",
        price: 19.99
      });
    });
  });

  describe("getAllProducts", () => {
    it("should return all products from database", async () => {
      const mockProducts = [
        { product_id: 1, name: "Product 1", price: 29.99 },
        { product_id: 2, name: "Product 2", price: 39.99 }
      ];

      mockProductRepository.find.mockResolvedValue(mockProducts);

      const result = await getAllProducts();

      expect(mockProductRepository.find).toHaveBeenCalledTimes(1);
      expect(result).toEqual(mockProducts);
    });
  });

  describe("getProductById", () => {
    it("should return product by ID", async () => {
      const mockProduct = { product_id: 1, name: "Test Product", price: 29.99 };
      
      mockProductRepository.findOne.mockResolvedValue(mockProduct);

      const result = await getProductById(1);

      expect(mockProductRepository.findOne).toHaveBeenCalledWith({
        where: { product_id: 1 }
      });
      expect(result).toEqual(mockProduct);
    });

    it("should return null for non-existent product", async () => {
      mockProductRepository.findOne.mockResolvedValue(null);

      const result = await getProductById(999);

      expect(result).toBeNull();
    });
  });

  describe("getProductByIdMock", () => {
    it("should return mock product with correct properties", async () => {
      const result = await getProductByIdMock(5);

      expect(result).toEqual({
        product_id: 5,
        name: "Product 5",
        price: 29.99, // 24.99 + 5
        image_url: "https://picsum.photos/200?random=5"
      });
    });
  });

  describe("saveReviewsToDB", () => {
    it("should save new reviews to database", async () => {
      const mockApiReviews = [
        { 
          review: { 
            id: 1, 
            customer_email: "test@example.com",
            product_id: 1,
            rating: 5,
            date: "2023-01-01"
          } 
        }
      ];

      mockListReviews.mockResolvedValue(mockApiReviews);
      mockCustomerRepository.findOne.mockResolvedValue({ customer_id: 1 });
      mockReviewRepository.findOne.mockResolvedValue(null); // Review doesn't exist
      mockReviewRepository.create.mockImplementation((data) => data);
      mockReviewRepository.save.mockResolvedValue({});

      await saveReviewsToDB();

      expect(mockListReviews).toHaveBeenCalledTimes(1);
      expect(mockCustomerRepository.findOne).toHaveBeenCalledWith({
        where: { customer_email: "test@example.com" }
      });
      expect(mockReviewRepository.create).toHaveBeenCalledWith({
        review_id: 1,
        product_id: 1,
        customer_id: 1,
        rating: 5,
        reviewed_at: new Date("2023-01-01")
      });
    });

    it("should skip reviews for non-existent customers", async () => {
      const mockApiReviews = [
        { 
          review: { 
            id: 1, 
            customer_email: "nonexistent@example.com",
            product_id: 1,
            rating: 5
          } 
        }
      ];

      mockListReviews.mockResolvedValue(mockApiReviews);
      mockCustomerRepository.findOne.mockResolvedValue(null); // Customer doesn't exist

      await saveReviewsToDB();

      expect(mockReviewRepository.create).not.toHaveBeenCalled();
      expect(mockReviewRepository.save).not.toHaveBeenCalled();
    });

    it("should handle empty reviews array", async () => {
      mockListReviews.mockResolvedValue([]);

      await saveReviewsToDB();

      expect(mockListReviews).toHaveBeenCalledTimes(1);
      expect(mockConsoleLog).toHaveBeenCalledWith("No reviews fetched from API");
    });
  });

  describe("getAllReviews", () => {
    it("should return all reviews from database", async () => {
      const mockReviews = [
        { review_id: 1, product_id: 1, customer_id: 1, rating: 5 },
        { review_id: 2, product_id: 2, customer_id: 2, rating: 4 }
      ];

      mockReviewRepository.find.mockResolvedValue(mockReviews);

      const result = await getAllReviews();

      expect(mockReviewRepository.find).toHaveBeenCalledTimes(1);
      expect(result).toEqual(mockReviews);
    });
  });

  describe("saveOrdersToDB", () => {
    it("should save new orders to database", async () => {
      const mockApiOrders = [
        { 
          order: { 
            id: 1, 
            customer: { id: 1 },
            created_at: "2023-01-01T00:00:00Z",
            products: [
              { id: 101 },
              { id: 102 }
            ]
          } 
        }
      ];

      mockListOrders.mockResolvedValue(mockApiOrders);
      mockOrderRepository.findOne.mockResolvedValue(null); // Order doesn't exist
      mockOrderRepository.create.mockImplementation((data) => ({ ...data, items: [] }));
      mockItemRepository.create.mockImplementation((data) => data);
      mockOrderRepository.save.mockResolvedValue({});

      await saveOrdersToDB();

      expect(mockListOrders).toHaveBeenCalledTimes(1);
      expect(mockOrderRepository.findOne).toHaveBeenCalledWith({
        where: { order_id: 1 },
        relations: ["items"]
      });
      expect(mockItemRepository.create).toHaveBeenCalledTimes(2);
      expect(mockOrderRepository.save).toHaveBeenCalledTimes(1);
    });

    it("should skip existing orders", async () => {
      const mockApiOrders = [
        { 
          order: { 
            id: 1, 
            customer: { id: 1 },
            created_at: "2023-01-01T00:00:00Z",
            products: []
          } 
        }
      ];

      mockListOrders.mockResolvedValue(mockApiOrders);
      mockOrderRepository.findOne.mockResolvedValue({ order_id: 1 }); // Order exists

      await saveOrdersToDB();

      expect(mockOrderRepository.create).not.toHaveBeenCalled();
      expect(mockOrderRepository.save).not.toHaveBeenCalled();
    });

    it("should handle empty orders array", async () => {
      mockListOrders.mockResolvedValue([]);

      await saveOrdersToDB();

      expect(mockListOrders).toHaveBeenCalledTimes(1);
      expect(mockConsoleLog).toHaveBeenCalledWith("No Orders fetched from API");
    });
  });

  describe("getAllOrders", () => {
    it("should return all orders with items from database", async () => {
      const mockOrders = [
        { 
          order_id: 1, 
          customer_id: 1, 
          items: [{ product_id: 101 }, { product_id: 102 }] 
        }
      ];

      mockOrderRepository.find.mockResolvedValue(mockOrders);

      const result = await getAllOrders();

      expect(mockOrderRepository.find).toHaveBeenCalledWith({
        relations: ["items"],
        order: { order_id: "ASC" }
      });
      expect(result).toEqual(mockOrders);
    });
  });

  describe("Error handling", () => {
    it("should handle API errors gracefully in saveCustomersToDB", async () => {
      mockListCustomers.mockRejectedValue(new Error("API Error"));

      await expect(saveCustomersToDB()).resolves.not.toThrow();
    });

    it("should handle database errors gracefully in saveProductsToDB", async () => {
      mockListProducts.mockResolvedValue([{ product: { id: 1, name: "Test", price: 10, images: [] } }]);
      mockProductRepository.findOne.mockRejectedValue(new Error("DB Error"));

      await expect(saveProductsToDB()).resolves.not.toThrow();
    });
  });
});