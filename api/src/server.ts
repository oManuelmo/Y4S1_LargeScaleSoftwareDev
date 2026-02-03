import express from "express";
import cors from "cors";
import * as Sentry from "@sentry/node";
import { nodeProfilingIntegration } from "@sentry/profiling-node";
import { redisDataSource } from "./redis-data-source";
import { pubSubDataSource } from "./pubsub-data-source";
import { getProductById, getAllNotInterestedByCustomerId, getProductByIdMock, saveCustomersToDB, AppDataSource, saveProductsToDB, getAllReviews, getReviewsByProductId, saveReviewsToDB, getAllProducts, saveOrdersToDB, getAllOrders, saveNotInterestedToDB, removeNotInterestedFromDB} from "./postgres-data-source"; 
import { listProducts } from "./information-retrieval";
import swaggerUi from "swagger-ui-express";
import { swaggerSpec } from "./swagger";

const extractReasonProductIds = (reason?: string): number[] => {
  if (!reason) return [];
  const matches = reason.matchAll(/Product\s*#(\d+)/gi);
  const ids: number[] = [];
  for (const match of matches) {
    const parsed = parseInt(match[1], 10);
    if (Number.isFinite(parsed)) {
      ids.push(parsed);
    }
  }
  return [...new Set(ids)];
};

// Initialize Sentry
if (process.env.SENTRY_DSN) {
  Sentry.init({
    serverName: "api-server",
    dsn: process.env.SENTRY_DSN,
    environment: process.env.SENTRY_ENVIRONMENT || "production",
    integrations: [
      Sentry.expressIntegration(),
      nodeProfilingIntegration(),
    ],
    tracesSampleRate: 0.1,
    profilesSampleRate: 0.1,
    attachStacktrace: true,
  });
  console.log("✅ Sentry initialized with DSN: " + process.env.SENTRY_DSN.substring(0, 50) + "...");
  console.log(`   Environment: ${process.env.SENTRY_ENVIRONMENT || "production"}`);
  console.log("   Trace sample rate: 0.1, Profile sample rate: 0.1");
} else {
  console.log("⚠️  SENTRY_DSN not set - error tracking disabled");
}

const app = express();

// Sentry middleware - before other middleware
if (process.env.SENTRY_DSN) {
  Sentry.setupExpressErrorHandler(app);
}

app.use(cors({
  origin: '*',
  credentials: false,
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization']
}));
app.options('*', cors());
app.use(express.json());
app.use("/api-docs", swaggerUi.serve, swaggerUi.setup(swaggerSpec));

// Health check endpoint

/**
 * @openapi
 * /api/v1/health:
 *   get:
 *     summary: Health check
 *     description: Checks API status and connectivity to Redis and PostgreSQL
 *     responses:
 *       200:
 *         description: API is running correctly
 *         content:
 *           application/json:
 *             example:
 *               status: OK
 *               message: API is running correctly,
 *               redis: connected
 *               postgres: connected
 *               timestamp: 2024-01-01T00:00:00.000Z
 *       500:
 *         description: Health check failed
 */
app.get("/api/v1/health", async (req, res) => {
  try {
    const redisStatus = redisDataSource.getClient()?.isOpen ? "connected" : "disconnected";
    const postgresStatus = AppDataSource.isInitialized ? "connected" : "disconnected";
    
    res.json({ 
      status: "OK", 
      message: "API is running correctly",
      redis: redisStatus,
      postgres: postgresStatus,
      timestamp: new Date().toISOString()
    });
  } catch (error) {
    res.status(500).json({
      status: "ERROR",
      message: "Health check failed",
      error: error.message
    });
  }
});


/**
 * @openapi
 * /api/v1/sync/jumpseller:
 *   post:
 *     summary: Synchronize data from Jumpseller
 *     description: Fetches customers, products, reviews and orders from Jumpseller and stores them in the database
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - login
 *               - authtoken
 *             properties:
 *               login:
 *                 type: string
 *               authtoken:
 *                 type: string
 *     responses:
 *       200:
 *         description: Synchronization completed successfully
 *       400:
 *         description: Missing or invalid credentials
 *       500:
 *         description: Synchronization failed
 */
app.post('/api/v1/sync/jumpseller', async (req, res) => {
    try {
        console.log("Starting Jumpseller data sync...");

        const { login, authtoken } = req.body;

        if (!login || !authtoken) {
            console.warn("No Jumpseller credentials provided in request body, using environment variables.");
            return res.status(400).json({
                success: false,
                error: "Jumpseller credentials (login and authtoken) are required in the request body."
            });
        }

        if (login && authtoken) {
            process.env.LOGIN_JUMPSELLER_API = login;
            process.env.TOKEN_JUMPSELLER_API = authtoken;
            console.log("Using provided credentials for this sync.");
        }

        await saveCustomersToDB();
        console.log("✅ Customers synced successfully.");

        await saveProductsToDB();
        console.log("✅ Products synced successfully.");

        await saveReviewsToDB();
        console.log("✅ Reviews synced successfully.");

        await saveOrdersToDB();
        console.log("✅ Orders synced successfully.");

        const reviews = await getAllReviews();
        console.log(`Current total reviews after sync: ${reviews.length}`);

        const products = await getAllProducts();
        console.log(products);

        const orders = await getAllOrders();
        console.log(orders);

        return res.status(200).json({
            success: true,
            message: "Jumpseller data synchronized successfully.",
            reviews_count: reviews.length,
            timestamp: new Date().toISOString()
        });
    } catch (error) {
        console.error("Error during Jumpseller data synchronization:", error);
        return res.status(500).json({
            success: false,
            error: "Failed to synchronize Jumpseller data.",
            details: error.message
        });
    }
});


/**
 * @openapi
 * /api/v1/recommendations/{customer_id}:
 *   get:
 *     summary: Get product recommendations for a customer
 *     description: Returns a list of recommended products for a given customer
 *     parameters:
 *       - in: path
 *         name: customer_id
 *         required: true
 *         schema:
 *           type: number
 *         description: Customer identifier
 *     responses:
 *       200:
 *         description: Recommendations retrieved successfully
 *         content:
 *           application/json:
 *             example:
 *               success: true
 *               recommendations: []
 *               source: recommendation_model
 *               count: 0
 *       400:
 *         description: Customer ID not provided
 *       500:
 *         description: Internal server error
 */
app.get('/api/v1/recommendations/:customer_id', async (req, res) => {
    const customerId = req.params.customer_id;

    if (!customerId) {
        return res.status(400).json({ success: false, error: "Customer ID is required" });
    }

    if (!redisDataSource.getClient().isOpen) {
      await redisDataSource.connect();
    }

    const redisClient = redisDataSource.getClient();

    if (!redisClient) {
        console.warn(`[Recommendations API] Redis client is unavailable.`);
        return res.status(503).json({
            success: true,
            recommendations: [],
            source: 'degraded_service'
        });
    }

    const redisKey = `recommendations:user:${customerId}`;

    try {
        const cachedData = await redisClient.get(redisKey);

        // if not found the user's recommendations, return empty list
        if (cachedData === null) {
            console.log(`[Cache Miss] Key ${redisKey} not found, returning empty recommendations.`);
            return res.status(200).json({
                success: true,
                recommendations: [],
                source: 'not_found',
                timestamp: new Date().toISOString()
            });
        }

        let recs: any;
        if (typeof cachedData === "string") {
            try {
                recs = JSON.parse(cachedData);
            } catch (parseErr) {
                console.error(`[Data Error] Failed to parse JSON for key ${redisKey}:`, parseErr);
                return res.status(500).json({ success: false, error: "Invalid recommendation data format" });
            }
        } else {
            recs = cachedData as any;
        }

        if (!recs.product_ids || !Array.isArray(recs.product_ids)) {
             console.error(`[Data Error] Invalid format for key ${redisKey}.`);
             return res.status(500).json({ success: false, error: "Invalid recommendation data format" });
        }

        // Return empty list if fewer than 7 recommendations
        if (recs.product_ids.length < 7) {
            console.log(`[Insufficient Recommendations] User ${customerId} has only ${recs.product_ids.length} recommendations, returning empty list.`);
            return res.status(200).json({
                success: true,
                recommendations: [],
                source: 'insufficient_data',
                count: 0,
                timestamp: recs.timestamp || new Date().toISOString()
            });
        }

        const notInterestedEntries = await getAllNotInterestedByCustomerId(parseInt(customerId));
        const notInterestedProductIds = new Set(notInterestedEntries.map(entry => entry.product_id));

        const recommendations = (await Promise.all(
          recs.product_ids.map(async (productId) => {
            if (notInterestedProductIds.has(productId)) return null;

            const product = await getProductById(productId);
            const reasonText = recs.explanations?.[productId] || "Recommended for you";
            const reasonProductIds = extractReasonProductIds(reasonText);
            const reasonProducts: any[] = [];

            for (const reasonProductId of reasonProductIds) {
              console.log(`[Recommendations API] Loading reason product ${reasonProductId} for recommended product ${productId}`);
              try {
                const reasonProduct = await getProductById(reasonProductId);
                console.log(`[Recommendations API] Loaded reason product:`, reasonProduct);
                if (reasonProduct) {
                  reasonProducts.push(reasonProduct);
                } else {
                  // Fallback: include minimal object with ID so frontend can still link
                  reasonProducts.push({ product_id: reasonProductId });
                }
              } catch (err) {
                console.warn(`[Recommendations API] Failed to load reason product ${reasonProductId}:`, err);
                // Fallback on error as well
                reasonProducts.push({ product_id: reasonProductId });
              }
            }

            return {
              product_id: productId,
              product,
              reason: reasonText,
              rank: recs.rankings?.[productId] || null,
              reason_products: reasonProducts,
            };
          })
        )).filter(Boolean);

        return res.status(200).json({
            success: true,
            recommendations,
            source: recs.model || 'unknown_model',
            count: recommendations.length,
            timestamp: recs.timestamp || new Date().toISOString()
        });

    } catch (error) {
        console.error(`[Recommendations API Error] Failed to process request for ${customerId}:`, error);
        return res.status(500).json({
            success: false,
            error: "Internal server error fetching recommendations"
        });
    }
});

/**
 * @openapi
 * /api/v1/products/{product_id}:
 *   get:
 *     summary: Get product by ID
 *     description: Retrieves a product by its unique identifier
 *     parameters:
 *       - in: path
 *         name: product_id
 *         required: true
 *         schema:
 *           type: number
 *         description: Product ID
 *     responses:
 *       200:
 *         description: Product retrieved successfully
 *       400:
 *         description: Invalid product ID
 *       404:
 *         description: Product not found
 *       500:
 *         description: Internal server error
 */
app.get('/api/v1/products/:product_id', async (req, res) => {
    const productId = parseInt(req.params.product_id);

    if (isNaN(productId)) {
        return res.status(400).json({ 
            success: false, 
            error: "Invalid product ID. Must be a number." 
        });
    }

    try {
        const product = await getProductById(productId);

        if (!product) {
            return res.status(404).json({
                success: false,
                error: `Product with ID ${productId} not found`
            });
        }

        return res.status(200).json({
            success: true,
            product: product,
            timestamp: new Date().toISOString()
        });

    } catch (error) {
        console.error(`[Product API Error] Failed to fetch product ${productId}:`, error);
        return res.status(500).json({
            success: false,
            error: "Internal server error fetching product"
        });
    }
});

/**
 * @openapi
 * /api/v1/reviews/product/{product_id}:
 *   get:
 *     summary: Get reviews for a product
 *     description: Returns all reviews and ratings for a specific product
 *     parameters:
 *       - in: path
 *         name: product_id
 *         required: true
 *         schema:
 *           type: number
 *         description: Product ID
 *     responses:
 *       200:
 *         description: Reviews retrieved successfully
 *         content:
 *           application/json:
 *             example:
 *               success: true
 *               product_id: 1
 *               reviews: []
 *               count: 0
 *               average_rating: "0.00"
 *       400:
 *         description: Invalid product ID
 *       500:
 *         description: Internal server error
 */
app.get('/api/v1/reviews/product/:product_id', async (req, res) => {
    const productId = parseInt(req.params.product_id);

    if (isNaN(productId)) {
        return res.status(400).json({ 
            success: false, 
            error: "Invalid product ID" 
        });
    }

    try {
        const productReviews = await getReviewsByProductId(productId);
        
        const avgRating = productReviews.length > 0
            ? productReviews.reduce((sum, r) => sum + r.rating, 0) / productReviews.length
            : 0;

        return res.status(200).json({
            success: true,
            product_id: productId,
            reviews: productReviews,
            count: productReviews.length,
            average_rating: parseFloat(avgRating.toFixed(2)),
            timestamp: new Date().toISOString()
        });

    } catch (error) {
        console.error(`[Reviews API Error] Failed to fetch reviews for product ${productId}:`, error);
        return res.status(500).json({
            success: false,
            error: "Internal server error fetching reviews"
        });
    }
});

/**
 * @openapi
 * /api/v1/not-interested:
 *   post:
 *     summary: Mark product as not interested
 *     description: Stores a product that a customer is not interested in
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - customer_id
 *               - product_id
 *             properties:
 *               customer_id:
 *                 type: number
 *               product_id:
 *                 type: number
 *     responses:
 *       201:
 *         description: Not interested product saved successfully
 *       400:
 *         description: Missing required fields
 *       500:
 *         description: Internal server error
 */
app.post('/api/v1/not-interested', async (req, res) => {
  const { customer_id, product_id } = req.body;

  if (!customer_id || !product_id) {
    return res.status(400).json({
      success: false,
      error: "customer_id and product_id are required"
    });
  }

  try {
    await saveNotInterestedToDB(customer_id, product_id);

    return res.status(201).json({
      success: true,
      message: `Saved NOT interested for customer ${customer_id}, product ${product_id}`,
    });

  } catch (error) {
    console.error("Error adding notInterested:", error);
    return res.status(500).json({
      success: false,
      error: "Internal server error"
    });
  }
});

/**
 * @openapi
 * /api/v1/not-interested:
 *   delete:
 *     summary: Remove product from not interested list
 *     description: Removes a product marked as not interested for a customer
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - customer_id
 *               - product_id
 *             properties:
 *               customer_id:
 *                 type: number
 *               product_id:
 *                 type: number
 *     responses:
 *       200:
 *         description: Not interested product removed successfully
 *       400:
 *         description: Missing required fields
 *       500:
 *         description: Internal server error
 */
app.delete('/api/v1/not-interested', async (req, res) => {
  const { customer_id, product_id } = req.body;

  if (!customer_id || !product_id) {
    return res.status(400).json({
      success: false,
      error: "customer_id and product_id are required"
    });
  }

  try {
    await removeNotInterestedFromDB(customer_id, product_id);

    return res.status(200).json({
      success: true,
      message: `Removed NOT interested for customer ${customer_id}, product ${product_id}`,
    });

  } catch (error) {
    console.error("Error removing notInterested:", error);
    return res.status(500).json({
      success: false,
      error: "Internal server error"
    });
  }
});

const PORT = process.env.PORT || 8080;

console.log("🔄 Starting server...");

// Start server FIRST, then initialize connections in background
app.listen(PORT, () => {
  console.log(`🚀 Server: http://localhost:${PORT}`);
  console.log(`🎯 Recommendations: http://localhost:${PORT}/api/v1/recommendations/1`);
  console.log(`❤️  Health: http://localhost:${PORT}/api/v1/health`);
  console.log(`🔄 Jumpseller Sync: POST http://localhost:${PORT}/api/v1/sync/jumpseller`);
  console.log(`   Body: { "login": "your_login", "authtoken": "your_token" }`);
  
  // Initialize connections after server is listening
  Promise.all([
    redisDataSource.connect(),
    AppDataSource.initialize()
  ]).then(() => {
    console.log("✅ Redis and PostgreSQL connected");
    
    // Optional: Initialize Pub/Sub for real-time updates
    pubSubDataSource.initialize().then(() => {
      console.log("✅ Pub/Sub data source initialized");
    }).catch((error) => {
      console.warn("⚠️  Pub/Sub initialization failed, continuing without real-time updates:", error.message);
    });
    
  }).catch((error) => {
    console.error("⚠️  Error connecting to services:", error.message);
    console.log("⚠️  Server running in degraded mode");
    if (process.env.SENTRY_DSN) {
      Sentry.captureException(error);
    }
  });

  // Global error handler for Express (catches errors in routes)
  app.use((err: any, req: express.Request, res: express.Response, next: express.NextFunction) => {
    console.error("❌ Unhandled error:", err);
    if (process.env.SENTRY_DSN) {
      console.log("📤 Sending to Sentry: " + err.constructor.name);
      Sentry.captureException(err);
      Sentry.captureMessage(`Error: ${err.message}`, "fatal");
      console.log("📤 Flushing Sentry...");
      Sentry.flush(5000).then(() => {
        console.log("✅ Sentry flush complete");
      });
    }
    res.status(500).json({
      success: false,
      error: "Internal server error",
      requestId: res.getHeader('x-sentry-id') || undefined
    });
  });
});