# Surprise - ML Recommendation Engine

A machine learning-powered recommendation system using [Surprise](https://surpriselib.com), a Python library for building and analyzing recommender systems. The engine generates personalized product recommendations based on customer behavior across multiple data sources.

---

## How It Works

### Data Sources & Weighting

The recommendation engine ingests user behavior from three primary sources with a hierarchical weighting strategy:

| Source | Implicit Rating | Weight | Signal Type |
|--------|-----------------|--------|-------------|
| **Reviews** | 1-5 stars | 60% | Explicit feedback - strongest signal |
| **Orders** | 5.0 | 30% | Purchase commitment - implicit feedback |
| **Wishlist** | 3.0 | 10% | Aspirational interest - weakest signal |

When multiple sources contribute to a recommendation, they are combined using their respective weights. If only one or two sources are available, weights are rebalanced proportionally.

### Models

**SVD (Singular Value Decomposition)**
- **Algorithm**: Latent factor model that decomposes the user-product rating matrix
- **Purpose**: Learns latent representations of users and products in a shared embedding space
- **Features**:
  - Handles sparse data effectively (users don't rate all products)
  - Uncovers hidden patterns and similarities between users/products
  - Generates confidence scores (1-5 scale) for recommendations
  - Produces product embeddings for similarity detection
- **Configuration**: 20 max epochs, optimized for convergence without overfitting

### Recommendation Features

**1. Multi-Source Explanations**
Each recommendation includes a clear source attribution explaining why it was suggested:
- "Based on your ratings: ..." (Reviews-based)
- "Because you've purchased similar items: ..." (Orders-based)
- "Because you wishlisted similar products: ..." (Wishlist-based)

**2. Confidence Levels**
Recommendations are rated on a 7-tier confidence system:
- 4.5+: "🏆 MUST-HAVE!" - Absolutely certain
- 4.2+: "🥈 HIGHLY RECOMMENDED!" - Very likely to match your taste
- 4.0+: "Quite confident" - Strong match
- 3.7+: "Fits your taste" - Good recommendation
- 3.5+: "Great match" - Solid pick
- 3.2+: "Good fit" - Moderate confidence
- <3.2: "Might find this interesting" - Lower confidence but still relevant

**3. Hybrid Similarity Detection**
Filters unwanted products using a two-method approach:
- **SVD Embeddings**: Compares product vector similarity (cosine distance, threshold 0.65)
- **Co-occurrence Analysis**: Identifies products rated by similar customers (2+ shared users minimum)
- **Result**: Union of both methods ensures comprehensive filtering

**4. Dynamic Filtering**
Removes products customers marked as "not interested" and similar alternatives, maintaining recommendation order integrity.

**5. Ranking with Emoji Enhancement**
Top 3 recommendations are highlighted with achievement badges:
- 🏆 Rank 1: MUST-HAVE!
- 🥈 Rank 2: HIGHLY RECOMMENDED!
- 🥉 Rank 3: HIGHLY RECOMMENDED!

---

## Local Development

### Prerequisites

- `Python 3.11`
- PostgreSQL running (via `docker compose up`)
- Redis running (via `docker compose up`)

### Setup

```bash
cd surprise

uv venv --python 3.11
source .venv/bin/activate

uv pip install -r requirements.txt
```

### Running the Engine

```bash
# Make sure PostgreSQL and Redis are running
cd surprise
source .venv/bin/activate

python main.py
```

---

## Project Structure

- `main.py`: Orchestration engine that coordinates model training and recommendation merging
- `recommendation_models.py`: SVD model implementation with training and inference logic
- `persistence/connections.py`: Database connection management (PostgreSQL & Redis)
- `persistence/queries.py`: Data fetching layer from PostgreSQL
- `persistence/commands.py`: Data persistence layer to Redis

---

## Testing

Run the comprehensive test suite (450+ test cases covering all functionality):

```bash
cd surprise
pytest
```

---

## Deployment

### Prerequisites

- Docker installed
- Google Cloud authentication configured
- Terraform setup completed (see root README)

### Build Docker Image

Build and push the production image:

```bash
docker buildx build --platform linux/amd64 \
  -t europe-west3-docker.pkg.dev/feup-ds/my-repo/surprise:latest .

docker push europe-west3-docker.pkg.dev/feup-ds/my-repo/surprise:latest
```

This image will be deployed by Terraform to Google Cloud Run.

### Cloud Run Job

The recommendation engine runs as a GCP Cloud Run Job triggered daily at 2:00 AM to generate fresh recommendations for all customers.
