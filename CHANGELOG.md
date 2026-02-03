# Changelog

## [Sprint 3] - 14/12/2025

### Added

#### #171 "Not Interested" Button in the Recommendations

- Created a "Not Interested" table on the database
- Added routes to mark or remove a product as not interested for a user
- Created a button on each product to mark the product as not interested
- Removed the product from the recommendations when it is marked as not interested
- Implemented not interested on the model training so that items similar to the not interested doesn't become recommended

##### Contributors

- ricardoyang00
- VLUX04
- Minigonga

#### #68 Product Recommendation via Wishlisted Products

- Implemented wishlist data influence to product recommendations

##### Contributors

- Minigonga
- oManuelmo
- ricardoyang00

#### #181 Action Influence Hierarchy on Recommendations

- Made an hierarchy for the recommendation process
- Provided percentages for each action, showing that reviews have the greatest influence, followed by orders and then wishlists

##### Contributors

- ricardoyang00

#### #517 More Relevant Recommendations need to be more prominent

- Added a score for every recommendation
- Ordered the recommendation by score
- Top 3 recommendations are displayed with more prominence

##### Contributors

- ricardoyang00
- VLUX04

#### #612 Integrate Sentry error tracking for core services

- Add comprehensive error tracking and monitoring using Sentry to capture production errors in real-time across the Python surprise job and Node.js API services.

##### Contributors

- ricardoyang00

#### #611 Recommendation Engine Documentation

- Added "How It Works" section explaining data sources and weighting hierarchy
- Documented SVD (Singular Value Decomposition) model with algorithm, purpose, features, and configuration
- Detailed all 5 recommendation features
- Updated project structure documentation with file purposes
- Added testing instructions with coverage examples
- Improved organization and readability

##### Contributors

- ricardoyang00

#### #610 UI Refactor of Recommendations' Carousel

- Updated the navigation arrows
- Changed the spacing of the products' card 

##### Contributors

- VLUX04

#### #609 UI Refactor of Recommended Products' Card

- Changed the product card to look and behave similarly to the standadrd product catalog listings.

##### Contributors

- VLUX04

#### #606 Swagger Integration

- Implemented the OpenAPI into the project
- Made it able to test the endpoints directly in the browser

##### Contributors

- Minigonga

#### #615 UI Response for Empty Recommendations

- Added graceful handling to empty recommendations on the Recommendation UI

##### Contributors

- VLUX04

#### #606 UI for Recommended Products' Ratings

- Added the product's review rating to the recommendation card

##### Contributors

- VLUX04

#### #631 PubSub for product updates

- Implemented the ingestion of Product events via PubSub

##### Contributors

- oManuelmo

#### #632 PubSub for user updates

- Implemented the ingestion of User events via PubSub

##### Contributors

- oManuelmo

#### #633 PubSub for seller updates

- Implemented the ingestion of Seller events via PubSub

##### Contributors

- oManuelmo

#### #634 PubSub for wishlist updates

- Implemented the ingestion of Like/Wishlist events via PubSub

##### Contributors

- oManuelmo

### Changed

#### Enhanced ML Pipeline

- Updated `SVDRecommender` class to also support "wishlist" and "not_interested" model sources
- Enhanced main execution script to process the models all with different and specific weights

#### API Improvements

- Added two routes to be able to call them on the frontend and change the `not_interested` data
- Changed `/api/v1/sync/jumpseller` to get the login directly from the code

#### Frontend Improvements

- Added pages to the recommendation page

#### Database Updates

- Removed the id from `order_item` and `wishlist` (no longer needed)
- Added `not_interested` table

### Fixed

#### #658 Frontend Bug Fix

- Made the navbar buttons visible
- Corrected the carousel animation
- Made all the products card sizes equal
- Changed the product card to always have rounded design
- Made the frontend match with the MIPS theme

##### Contributors

- oManuelmo

#### #618 Fix Missing Images on Module Federation Frontend

- Corrected a problem where the images were failing to load on MIPS

##### Contributors

- VLUX04

#### #616 Prevent PostgreSQL Schema Loss on Terraform Redeployment

- Corrected a problem where the PostgresSQL schema was being lost on every redeploy

##### Contributors

- ricardoyang00

#### #646 Bug of connection to Jumpseller

- Corrected a problem with the connection to Jumpseller when the code deployed

##### Contributors

- oManuelmo

#### #646 Deployment Bug (Backend Error)

- Corrected the backend error that was given when doing the terraform apply

##### Contributors

- oManuelmo

---

## [Sprint 2] - 30/11/2025

### Added

#### #446 Product Recommendation via Purchase History

- Implemented second SVD model trained on implicit feedback from order history
- Added order and order_item tables to database schema to capture purchase data
- Extended Jumpseller API synchronization to fetch complete order history with line items
- Created `get_order_history_data()` function to process up to 50 recent orders per customer
- Implemented intelligent merging of review-based and order-based predictions with 60/40 weighting
- Added `run_orders_recommendation_job()` to train and generate order-based recommendations
- Enhanced `merge_recommendations()` function to combine dual-model predictions

##### Contributors

- ricardoyang00
- oManuelmo
- Minigonga

#### #172 Display to User why an Item was Recommended

- Developed sophisticated explainable AI system that generates context-aware explanations
- Implemented confidence-scored messaging based on predicted rating strength (high/medium/low confidence)
- Created varied explanation templates (10+ different phrasings) to avoid repetitiveness
- Implemented `_generate_explanation()` method that references specific user-rated products
- Added explanation tooltips to frontend product cards with hover interactions
- Stored explanations alongside recommendations in Redis for efficient retrieval

##### Contributors

- ricardoyang00
- VLUX04

#### #76 Product Recommendations on Homepage

- Deployed production-ready React micro-frontend to Google Cloud Platform
- Implemented dynamic routing with user-specific URLs (`/user/{userId}`)
- Created responsive grid layout adapting from 1 to 4 columns based on screen size
- Integrated frontend with live backend API
- Implemented `useRecommendations` custom React hook for data fetching
- Added 404 error handling for invalid user IDs
- Created RecProd component with image, name, price, and explanation tooltip

##### Contributors

- VLUX04

#### #323 Linking New Users without Recommendations yet to the Best Selling Products

- When users don't have recommendations yet they are displayed a text and image that redirects them to the Best Selling Products Section of the Landing Page

##### Contributors

- ricardoyang00
- oManuelmo

#### Automation & Infrastructure

- Configured Google Cloud Scheduler to trigger ML jobs daily at 2:00 AM UTC
- Deployed Cloud Run Job (`surprise-job`) for automated model training
- Added automatic Redis cache refresh after model training completes
- Extended Terraform configuration to manage Cloud Scheduler resources
- Added IAM roles for Cloud Run Invoker to service accounts

### Changed

#### Enhanced ML Pipeline

- Increased recommendation limit from 10 to 50 products per user
- Improved cold-start filtering with minimum interaction thresholds (2+ interactions required)
- Updated `SVDRecommender` class to support multiple model sources ("reviews" vs "orders")
- Modified `recommend()` method to return predictions with scores for merging
- Enhanced main execution script to process and merge dual-model predictions

#### API Improvements

- Added minimum recommendation threshold (7+ recommendations) for quality assurance
- Enhanced `/api/v1/recommendations/:customer_id` endpoint with better error handling
- Improved fallback mechanisms for users with insufficient data
- Updated response format to include model source information (COMBINED/REVIEWS/ORDERS)
- Extended `/api/v1/sync/jumpseller` to synchronize order data

#### Database Updates

- Removed `sells_last_month` column from product table (no longer needed)
- Added `order` table with customer_id and ordered_at fields
- Added `order_item` table with order_id, product_id, and quantity fields
- Updated TypeORM entities to support new order-related tables

### Fixed

- Improved data consistency in Jumpseller synchronization
- Enhanced error handling for Redis connection failures
- Fixed product data retrieval issues in recommendation responses

---

## [Sprint 1] - 23/11/2025

### Added

#### #71 Product Recommendation via Product Reviews

- Implemented SVD (Singular Value Decomposition) collaborative filtering model using Surprise library
- Created `SVDRecommender` class with training and prediction capabilities
- Developed `get_recent_reviews_data()` function to fetch up to 10 recent reviews per user
- Added matrix factorization algorithm to learn latent user and item factors
- Created `run_reviews_recommendation_job()` for batch recommendation generation
- Implemented per-user recommendation storage in Redis with `recommendations:user:{customer_id}` keys

##### Contributors

- ricardoyang00
- oManuelmo
- Minigonga

#### #72 Recommendations Dynamic Update according to Recent Activity

- Set up Redis (Memorystore) as high-performance caching layer
- Implemented recommendation pre-computation and storage pipeline
- Created `store_recommendations()` function to serialize predictions to Redis
- Added recommendation expiry and refresh mechanisms
- Developed batch job architecture for processing all active users
- Integrated Python ML service with PostgreSQL for data access
- Configured VPC connector for secure Cloud SQL access

##### Contributors

- ricardoyang00
- oManuelmo
- VLUX04

#### #333 Product Recommendation Page

- Built React-based micro-frontend using Rsbuild and Module Federation
- Implemented Material-UI components for product cards
- Created initial UI with product image, name, and price display
- Added Module Federation configuration to expose recommendation page component
- Developed responsive layout for product grid
- Integrated with backend API for recommendation fetching
- Added basic error handling and loading states

##### Contributors

- VLUX04

### Infrastructure & Deployment

#### Google Cloud Platform Setup

- Deployed backend API as Cloud Run service
- Configured Cloud SQL (PostgreSQL 16) with private networking
- Set up Google Cloud Memorystore for Redis with LRU eviction
- Created Terraform infrastructure-as-code for all GCP resources
- Configured Google Secret Manager for credential management
- Set up VPC connector for service communication
- Created Docker containers for API and ML services
- Pushed images to Google Artifact Registry (europe-west3 region)

#### Database & Schema

- Created `customer` table with email and ID fields
- Created `product` table with name, price, and image_url
- Created `review` table with rating (1-5), customer_id, and product_id
- Created `wishlist` table for user product preferences
- Implemented database initialization scripts (01-schema.sql, 02-populate.sql)

#### API Development

- Built Node.js/Express backend with TypeScript
- Implemented `/api/v1/recommendations/:customer_id` endpoint
- Added `/api/v1/sync/jumpseller` for marketplace data synchronization
- Created `/api/v1/health` endpoint for service monitoring
- Developed TypeORM entities for database access
- Added Jumpseller API integration for customer, product, and review data
- Implemented CORS configuration for cross-origin requests
