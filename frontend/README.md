# Frontend - Recommendations UI

React-based user interface for displaying personalized product recommendations with an intuitive and interactive design.

## Features

- 🎨 **Responsive Design**: Works seamlessly on desktop and mobile devices
- 🎯 **Recommendation Cards**: Beautiful display of personalized product recommendations
- 💬 **Explanation Tooltips**: "Why was this recommended?" tooltips with product links
- ❌ **Not Interested**: Easy product filtering with "Not Interested" functionality
- ⭐ **Reviews Integration**: Real-time product reviews and ratings
- 🔗 **Smart Linking**: Clickable product references in recommendation explanations
- 📱 **Module Federation**: Modular architecture for scalability

---

## Local Development

### Prerequisites

- `npm` (Node.js 18.x or higher)
- Backend API running on `http://localhost:8080`
- Environment file configured

### Setup

```bash
cd frontend/rec_frontend
npm install
npm run dev
```

The frontend will start at `http://localhost:3000`


---

## Key Components

### RecProd Component

Displays a single product recommendation with:
- Product image and details
- Star rating and reviews count
- "Why was this recommended?" explanation
- "Not Interested" functionality
- Linked product references in explanations

### Recommendation Page

Shows all recommendations with:
- Top 3 featured recommendations
- Paginated grid of additional recommendations
- Search and filtering capabilities

---

## Available Scripts

### Development

```bash
npm run dev
```

Starts the development server with hot module replacement.

---

## Deployment

### Prerequisites

- Docker installed
- Google Cloud authentication configured
- Terraform setup completed (see root README)

### Build Docker Image

```bash
cd rec_frontend

docker buildx build --platform linux/amd64 \
  -t europe-west3-docker.pkg.dev/feup-ds/my-repo/frontend:latest .

docker push europe-west3-docker.pkg.dev/feup-ds/my-repo/frontend:latest
```

This image will be deployed by Terraform to Google Cloud Run.

---

## API Integration

The frontend communicates with the backend API for:

- **Recommendations**: `GET /api/v1/recommendations/{customer_id}`
- **Product Reviews**: `GET /api/v1/reviews/product/{product_id}`
- **Not Interested**: `POST /api/v1/not-interested`
- **Remove Not Interested**: `DELETE /api/v1/not-interested`

See [api/README.md](../api/README.md) for API documentation.

---

## Architecture

- **Framework**: React 18
- **Build Tool**: Rsbuild (fast Rust-based bundler)
- **Styling**: Tailwind CSS
- **Type Safety**: TypeScript
- **HTTP Client**: Fetch API
- **Module Federation**: Modular component architecture
