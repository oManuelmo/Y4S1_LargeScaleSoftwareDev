

<div align="center">

  <h1>Recommendations</h1>

  <p>A personalized product recommendation system combining ML algorithms, real-time data processing, and an intuitive user interface.</p>
  
  [![Deploy API](https://github.com/FEUP-MEIC-DS-2025-26/recommendations/actions/workflows/deloy-api.yml/badge.svg)](https://github.com/FEUP-MEIC-DS-2025-26/recommendations/actions/workflows/deloy-api.yml)
  [![Deploy Frontend](https://github.com/FEUP-MEIC-DS-2025-26/recommendations/actions/workflows/deploy-frontend.yml/badge.svg)](https://github.com/FEUP-MEIC-DS-2025-26/recommendations/actions/workflows/deploy-frontend.yml)
  [![Deploy Surprise Job](https://github.com/FEUP-MEIC-DS-2025-26/recommendations/actions/workflows/deploy-surprise.yml/badge.svg?branch=main)](https://github.com/FEUP-MEIC-DS-2025-26/recommendations/actions/workflows/deploy-surprise.yml)
  [![Node.js CI (Api)](https://github.com/FEUP-MEIC-DS-2025-26/recommendations/actions/workflows/ci.yml/badge.svg)](https://github.com/FEUP-MEIC-DS-2025-26/recommendations/actions/workflows/ci.yml)
  [![Python CI (Surprise)](https://github.com/FEUP-MEIC-DS-2025-26/recommendations/actions/workflows/python-ci.yml/badge.svg)](https://github.com/FEUP-MEIC-DS-2025-26/recommendations/actions/workflows/python-ci.yml)

</div>

---

## Project Structure

This project is organized into three main modules, each with its own comprehensive README:

| Module | Description | README |
|--------|-------------|--------|
| **API** | REST API serving recommendations and syncing Jumpseller data | [api/README.md](api/README.md) |
| **Frontend** | React-based UI for displaying personalized recommendations | [frontend/README.md](frontend/README.md) |
| **Surprise** | ML recommendation engine using SVD algorithms | [surprise/README.md](surprise/README.md) |

---

## Quick Start - Local Development

### Prerequisites
- `Docker` installed and running
- `docker-compose` installed

### Step 1: Start Databases

```bash
# Start PostgreSQL and Redis containers
docker compose up -d

# Verify containers are running
docker compose ps
```

### Step 2: Run Individual Modules

Each module has its own setup instructions. **See the respective README for detailed setup:**

- **API**: [api/README.md](api/README.md#local-development)
- **Frontend**: [frontend/README.md](frontend/README.md#local-development)
- **Surprise**: [surprise/README.md](surprise/README.md#local-development)

### Troubleshooting Databases

```bash
# If Redis has issues, stop system services
sudo systemctl stop redis
sudo systemctl stop redis-server

# Stop containers
docker compose down

# Clean restart
docker compose down -v && docker compose up -d
```

---

## Deployment

### Prerequisites
- [gcloud CLI](https://cloud.google.com/sdk/docs/install)
- [Terraform](https://learn.hashicorp.com/terraform/getting-started/install)

### Authentication

```bash
gcloud auth login
gcloud config set project feup-ds
gcloud auth configure-docker europe-west3-docker.pkg.dev
```

### Configuration

```bash
cd terraform-gcp
cp terraform.tfvars.example terraform.tfvars
# Fill in the required variables
```

> [!WARNING]  
> Never commit credentials to the repository, even if it's private, to avoid leaks.

### Build & Deploy

Follow the deployment instructions in each module's README:

- **API**: [api/README.md#deployment](api/README.md#deployment)
- **Frontend**: [frontend/README.md#deployment](frontend/README.md#deployment)
- **Surprise**: [surprise/README.md#deployment](surprise/README.md#deployment)

Then apply Terraform:

```bash
terraform init
terraform apply
```

---

## Testing & Quality Assurance

### API Testing

```bash
cd api
npm test
npm run lint
```

### Surprise Testing

```bash
cd surprise
pytest
```

See individual module READMEs for more testing details.

---

## Documentation

API documentation available at:
- **Production**: https://backend-service-3s5wr3evga-ey.a.run.app/api-docs/
- **Local**: http://localhost:8080/api-docs/

See [api/README.md#documentation](api/README.md#documentation) for more details.

---

@DS-T31
