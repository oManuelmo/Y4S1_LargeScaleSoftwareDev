# API - Recommendations REST API

REST API for serving personalized product recommendations and synchronizing data from Jumpseller.

## Features

- 🎯 **Recommendations API**: Get personalized product recommendations for customers
- 🔄 **Jumpseller Sync**: Synchronize customers, products, reviews, and orders
- 📊 **Product Management**: Retrieve product details and reviews
- ❌ **Not Interested**: Mark and manage products customers aren't interested in
- ✅ **Health Checks**: Monitor API and database connectivity

---

## Local Development

### Prerequisites

- `Node.js 22.X` and `npm`
- PostgreSQL running (via `docker compose up`)
- Redis running (via `docker compose up`)

### Setup

```bash
cd api
npm install
npm run dev
```

The API will start at `http://localhost:8080`

### Testing Pub/Sub (Optional)

In a separate terminal, publish test messages:

```bash
cd api

# Test different data sources
npx tsx src/test-pubsub/publish-customer.ts
npx tsx src/test-pubsub/publish-product.ts
npx tsx src/test-pubsub/publish-review.ts
npx tsx src/test-pubsub/publish-order.ts
npx tsx src/test-pubsub/publish-seller.ts
npx tsx src/test-pubsub/publish-wishlist.ts
```

---

## API Endpoints

### Health Check

```http
GET /api/v1/health
```

Returns API status and database connectivity.

### Get Recommendations

```http
GET /api/v1/recommendations/{customer_id}
```

Get personalized product recommendations for a customer.

**Example:**
```bash
curl http://localhost:8080/api/v1/recommendations/1
```

### Get Product by ID

```http
GET /api/v1/products/{product_id}
```

### Get Product Reviews

```http
GET /api/v1/reviews/product/{product_id}
```

### Mark as Not Interested

```http
POST /api/v1/not-interested

{
  "customer_id": 1,
  "product_id": 38
}
```

### Remove from Not Interested

```http
DELETE /api/v1/not-interested

{
  "customer_id": 1,
  "product_id": 38
}
```

### Sync Jumpseller Data

```http
POST /api/v1/sync/jumpseller

{
  "login": "your_login",
  "authtoken": "your_token"
}
```

**Example:**
```bash
curl -X POST http://localhost:8080/api/v1/sync/jumpseller \
  -H "Content-Type: application/json" \
  -d '{
    "login": "your_login",
    "authtoken": "your_token"
  }'
```

---

## Documentation

### Swagger API Docs

- **Local**: http://localhost:8080/api-docs/
- **Production**: https://backend-service-3s5wr3evga-ey.a.run.app/api-docs/

Interactive API documentation with try-it-out functionality.

---

## Testing

```bash
# Test both integration and unit tests
npm run test

# Test unit tests
npm run test:unit

# Test integration tests (the API needs to be running locally, with redis and postgres)
npm run test:integraion
```

Runs Jest test suite for all endpoints and data sources.

---

## Code Quality

```bash
npm run lint

npm run type-check
```

ESLint configuration for TypeScript code quality checks and type check all the code.

---

## Deployment

### Prerequisites

- Docker installed
- Google Cloud authentication configured
- Terraform setup completed (see root README)

### Build Docker Image

```bash
docker buildx build --platform linux/amd64 \
  -t europe-west3-docker.pkg.dev/feup-ds/my-repo/backend:latest .

docker push europe-west3-docker.pkg.dev/feup-ds/my-repo/backend:latest
```

This image will be deployed by Terraform to Google Cloud Run.

---

## Architecture

- **Framework**: Express.js
- **Database**: PostgreSQL (data persistence)
- **Cache**: Redis (recommendations caching)
- **Message Queue**: Google Pub/Sub (real-time data sync)
- **Monitoring**: Sentry (error tracking and profiling)
- **Type Safety**: TypeScript with strict mode
