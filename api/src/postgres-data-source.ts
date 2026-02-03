import { DataSource} from "typeorm";
import { Customer } from "./entities/Customer";
import { Product } from "./entities/Product";
import { Review } from "./entities/Review";
import { Order } from "./entities/Order";
import { OrderItem } from "./entities/OrderItem";
import { NotInterested } from "./entities/NotInterested";
import { listCustomers, listProducts, listReviews, listOrders } from './information-retrieval'; 
import { Seller } from "./entities/Seller";
import { Wishlist } from "./entities/Wishlist";

export const AppDataSource = new DataSource({
  type: "postgres",
  host: process.env.POSTGRES_HOST,
  port: parseInt(process.env.POSTGRES_PORT),
  username: process.env.POSTGRES_USER,
  password: process.env.POSTGRES_PASSWORD,
  database: process.env.POSTGRES_DATABASE,
  synchronize: true,
  logging: false,
  entities: [Customer, Product, Review, Order, OrderItem, NotInterested, Seller, Wishlist],
  migrations: [],
  subscribers: [],
});

export async function saveCustomersToDB() {
  try {
    const customerRepository = AppDataSource.getRepository(Customer);
    const apiCustomers = await listCustomers();

    for (const item of apiCustomers) {
      const customerData = item.customer;
      if (!customerData) continue;

      const existingCustomer = await customerRepository.findOne({
        where: { customer_email: customerData.email },
      });

      if (existingCustomer) {
        console.log(`Customer with email ${customerData.email} already exists, skipping.`);
        continue;
      }

      const customer = customerRepository.create({
        customer_id: customerData.id,
        customer_email: customerData.email || null,
      });

      await customerRepository.save(customer);
      console.log(`Saved customer ${customerData.email}`);
    }
  } catch (error) {
    console.error('Error saving customers to DB:', error);
  }
}

export async function getAllCustomers(): Promise<Customer[]> {
  const customerRepository = AppDataSource.getRepository(Customer);
  const customers = await customerRepository.find();
  return customers;
}

export async function saveProductsToDB() {
  try {
    const productRepository = AppDataSource.getRepository(Product);
    const apiProducts = await listProducts();
    
    for (const item of apiProducts) {
      const productData = item.product;
      if (!productData) continue;
      
      let imageUrl = null;
      for (const image of productData.images){
        if (image.position == 1){
          imageUrl = image.url;
          break;
        }
      }
      
      const existingProduct = await productRepository.findOne({
        where: { product_id: productData.id },
      });

      if (existingProduct) {
        console.log(`Product with ID ${productData.id} already exists, skipping.`);
        continue;
      }

      const product = productRepository.create({
        product_id: productData.id,
        image_url: imageUrl,
        name: productData.name || null,
        price: productData.price || null,
      });

      await productRepository.save(product);
      console.log(`Saved product ${productData.name} with ID ${productData.id}`);
    }
  } catch (error) {
    console.error('Error saving products to DB:', error);
  }
}

export async function getAllProducts(): Promise<Product[]> {
  const productRepository = AppDataSource.getRepository(Product);
  const products = await productRepository.find();
  return products;
} 

export async function getProductById(productId: number): Promise<Product | null> {
  const productRepository = AppDataSource.getRepository(Product);
  const product = await productRepository.findOne({
    where: { product_id: productId }
  });

  console.log(`Fetched product by ID ${productId}:`, product);
  return product;
}

export async function getProductByIdMock(productId: number): Promise<Product | null> {
  const mockProduct = new Product();
  mockProduct.product_id = productId;
  mockProduct.name = "Product " + productId;
  mockProduct.price = 24.99 + productId;
  mockProduct.image_url = "https://picsum.photos/200?random=" + productId;
  
  return mockProduct;
}

export async function saveReviewsToDB() {
  try {
    const reviewRepository = AppDataSource.getRepository(Review);
    const customerRepository = AppDataSource.getRepository(Customer);
    const apiReviews = await listReviews();
    
    if (!apiReviews || apiReviews.length === 0) {
      console.log("No reviews fetched from API");
      return;
    }

    for (const item of apiReviews) {
      const reviewData = item.review || item;
      if (!reviewData) continue;
      
      const customer = await customerRepository.findOne({
        where: { customer_email: reviewData.customer_email },
      });

      if (!customer) {
        console.log(`No customer found with email ${reviewData.customer_email}, skipping review`);
        continue;
      }

      let customer_id = customer.customer_id;
      console.log(`${customer_id}, ${reviewData.product_id} ||| ${reviewData.review}`);
      
      const existingReview = await reviewRepository.findOne({
        where: {
          review_id: reviewData.id,
        },
      });

      if (existingReview) {
        console.log(
          `Review for product ${reviewData.id} already exists, ${customer_id}, ${reviewData.product_id} skipping.`
        );
        continue;
      }

      const review = reviewRepository.create({
        review_id: reviewData.id,
        product_id: reviewData.product_id,
        customer_id: customer_id,
        rating: reviewData.rating || 0,
        reviewed_at: reviewData.date
          ? new Date(reviewData.date)
          : new Date(),
      });

      await reviewRepository.save(review);
      console.log(
        `Saved review for product ${reviewData.product_id} by customer ${customer_id}`
      );
    }
  } catch (error) {
    console.error('Error saving reviews to DB:', error);
  }
}

export async function getAllReviews(): Promise<Review[]> {
  const reviewRepository = AppDataSource.getRepository(Review);
  const reviews = await reviewRepository.find();
  return reviews;
}

export async function getReviewsByProductId(productId: number): Promise<Review[]> {
  const reviewRepository = AppDataSource.getRepository(Review);
  const reviews = await reviewRepository.find({ 
    where: { product_id: productId },
    order: { reviewed_at: 'DESC' }
  });
  return reviews;
}

export async function saveOrdersToDB() {
  try {
    const orderRepository = AppDataSource.getRepository(Order);
    const itemRepository = AppDataSource.getRepository(OrderItem);

    const apiOrders = await listOrders();
    if (!apiOrders || apiOrders.length === 0) {
      console.log("No Orders fetched from API");
      return;
    }
    
    let count = 70456;
    for (const item of apiOrders) {
      const orderData = item.order || item;
      if (!orderData) continue;

      const customer_id = orderData.customer?.id;
      const products = orderData.products || [];

      const existingOrder = await orderRepository.findOne({
        where: { order_id: orderData.id },
        relations: ["items"]
      });

      if (existingOrder) {
        console.log(`Order ${orderData.id} already exists — skipping`);
        continue;
      }

      const order = orderRepository.create({
        order_id: orderData.id,
        customer_id: customer_id,
        ordered_at: new Date(orderData.created_at),
        items: []
      });

      for (const p of products) {
        const item = itemRepository.create({
          product_id: p.id || count++,
          order: undefined
        });
        order.items.push(item);
      }

      await orderRepository.save(order);
      console.log(`Saved order ${order.order_id} with ${products.length} items.`);
    }
  } catch (error) {
    console.error('Error saving orders to DB:', error);
  }
}

export async function getAllOrders(): Promise<Order[]> {
  const orderRepository = AppDataSource.getRepository(Order);

  const orders = await orderRepository.find({
    relations: ["items"],
    order: {
      order_id: "ASC"
    }
  });

  return orders;
}

export async function saveNotInterestedToDB(customerId: number, productId: number) {
  try {
    const notInterestedRepository = AppDataSource.getRepository(NotInterested);

    const existing = await notInterestedRepository.findOne({
      where: { customer_id: customerId, product_id: productId },
    });

    if (existing) {
      console.log(`Customer ${customerId} is already marked as NOT interested in product ${productId}, skipping.`);
      return;
    }

    const newEntry = notInterestedRepository.create({
      customer_id: customerId,
      product_id: productId,
    });

    await notInterestedRepository.save(newEntry);

    console.log(`Saved NOT interested: customer ${customerId}, product ${productId}.`);
  } catch (error) {
    console.error("Error saving notInterested record:", error);
  }
}

export async function removeNotInterestedFromDB(customerId: number, productId: number) {
  try {
    const notInterestedRepository = AppDataSource.getRepository(NotInterested);

    const existingNotInterested = await notInterestedRepository.findOne({
      where: { customer_id: customerId, product_id: productId },
    });

    if (!existingNotInterested) {
      console.log(`Customer ${customerId} is not marked as not interested in product ${productId}, skipping.`);
      return;
    }

    await notInterestedRepository.remove(existingNotInterested);

    console.log(`Removed 'not interested' for customer ${customerId} from product ${productId}.`);
  } catch (error) {
    console.error('Error saving removing notInterested from DB:', error);
  }
}

export async function getAllNotInterested(): Promise<NotInterested[]> {
  const notInterestedRepository = AppDataSource.getRepository(NotInterested);
  const notInterestedEntries = await notInterestedRepository.find();
  return notInterestedEntries;
}

export async function getAllNotInterestedByCustomerId(customerId: number): Promise<NotInterested[]> {
  const notInterestedRepository = AppDataSource.getRepository(NotInterested);
  return await notInterestedRepository.find({
    where: { customer_id: customerId },
  });
}
