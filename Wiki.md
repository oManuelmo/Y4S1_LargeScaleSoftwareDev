# Recommendation System

**NOTE:** This is the documentation relative to the current [Recommendation System implementation](https://github.com/FEUP-MEIC-DS-2025-26/recommendations). If you are looking for the prototype documentation, please go to [this page](https://github.com/FEUP-MEIC-DS-2025-26/madeinportugal.store/wiki/%5B3.1-Prototype%5D-Recommendations).

## Development Guide

- **Instructions:** You can find the instructions on how to **compile**, **test** and **run** the project [here](https://github.com/FEUP-MEIC-DS-2025-26/recommendations/blob/main/README.md).
- **Documentation:** The **OpenAPI** documentation in **Swagger UI** can be found [here](https://backend-service-3s5wr3evga-ey.a.run.app/api-docs/). It can also be accessed it via `http://localhost:8080/api-docs/` when the code is running locally. 

## Vision

The long-term vision for the **Recommendation System** is to evolve into a fully integrated and intelligent personalization layer that enhances the shopping experience across the [madeinportugal.store](https://madeinportugal.store/) platform.
Our aim is to transform recommendations into a core capability that drives engagement, significantly enhances product discoverability, and improves user satisfaction.
The system will be built on a scalable, cloud-native architecture to support future growth and model complexity.

## Overview

The **Recommendation System** is a **microservices-based** platform designed to deliver **personalized product recommendations** to marketplace users. It integrates **machine learning** capabilities with a **scalable architecture** to provide intelligent, data-driven product suggestions, and consists of three core components: a machine learning service built with the **Surprise** library that generates recommendations based on user behavior patterns; a **Node.js** API backend that serves recommendations through RESTful endpoints; and a **React-based** micro-frontend module that displays recommended products to users. The system leverages **Redis** for high-performance caching of recommendation data and **PostgreSQL** for storing user interaction data such as wishlists and reviews. Additionally, since it is deployed on **Google Cloud Platform** using containerized infrastructure, the platform is designed to handle recommendations at scale.

## Purpose

The purpose of the **Recommendation System** is to enhance the user shopping experience by providing intelligent, personalized product suggestions based on individual user behavior and preferences. By analyzing user interactions including **wishlists**, **reviews**, and **order history**, the system aims to surface products that align with each user's interests, increasing engagement and conversion rates on the marketplace. Additionally, by providing the user the option to flag recommended products as **"Not Interested"**, the system ensures that the users have a direct way to personalize their recommendations, ensuring that across time they become more and more relevant.

## Key Features

- **Triple-Model Machine Learning System**: Employs three complementary SVD models trained on explicit review ratings, implicit order history, and wishlist data, intelligently merged to generate up to 50 personalized recommendations per user with multi-source explanations.
- **Smart Filtering System**: Implements "Not Interested" functionality that filters out marked products and similar items using collaborative filtering, preventing unwanted recommendations from appearing.
- **High-Performance Redis Caching**: Pre-computes and stores personalized recommendations in Redis with per-user keys, enabling sub-millisecond response times and reducing computational overhead on the API layer.
- **Real-Time Event-Driven Updates**: Integrated Google Cloud Pub/Sub for asynchronous processing of new reviews, orders, wishlists, products, and users, enabling near-instant recommendation updates.
- **Automated Daily Refresh**: Leverages Google Cloud Scheduler to trigger ML model retraining at 2:00 AM daily via Cloud Run Jobs, ensuring recommendations stay current with the latest user interactions.
- **Explainable Multi-Source Recommendations**: Generates context-aware explanations showing which data sources (reviews, orders, wishlists) contributed to each recommendation, enhancing transparency and trust.
- **Production-Ready Frontend**: Fully deployed React micro-frontend integrated with the live backend API, featuring responsive grid layouts, dynamic user routing, and seamless integration with the host application.
- **OpenAPI Documentation**: Comprehensive Swagger UI documentation at `/api-docs` endpoint, providing interactive API testing and clear endpoint specifications.
- **Error Tracking & Monitoring**: Integrated Sentry for production error tracking, performance monitoring, and profiling across both API and ML services.
- **Comprehensive Testing Suite**: Includes unit tests, integration tests, Pub/Sub integration tests with dedicated test helpers and mock implementations, and Surprise tests with 450+ test cases covering all functionality.
- **Cloud-Native Deployment**: Fully containerized using Docker with complete Google Cloud Platform deployment via Terraform, including Cloud SQL, Memorystore Redis, Cloud Run services, and Cloud Scheduler jobs for scalable production operations.
- **Simple Intuitive UI**: Clean and intuitive interface displaying personalized product recommendations with images, prices, explanatory tooltips and a "Not Interested" button for personalized user control.

## UI Description

### Product Recommendation Page

The Product Recommendation Page features a clean, responsive design that displays personalized product suggestions based on the user's activity across both reviews and purchase history. Both the landing page section and the specific page are only  visible and acessible if the user is logged in. The page uses dynamic routing with user-specific URLs to fetch and display tailored recommendations for each customer. The main content is organized in a responsive grid layout that adapts from single-column on mobile devices to up to four columns on larger screens, ensuring optimal viewing across all devices.

Each product card displays comprehensive information including the product image, name, price, and two interactive icons. When users presses the information icon, a tooltip appears showing the explanation for why that specific product was recommended, providing transparency into the recommendation logic and helping build user trust in the system's suggestions. Finally when the users press the "Not Interested" button, a confirmation modal appears to ensure the they truly want to go through with that action.

The frontend is fully integrated with the production backend API deployed on Google Cloud Run, fetching live recommendation data that combines insights from the review-based, order-based and wishlist-based ML models, with additional filtering through "Not Interested" user actions. If a user has insufficient interaction history (fewer than 7 recommendations), the system gracefully handles this by not displaying the recommendations section.

<p align="center">
  <img width="1000" height="600" src="https://github.com/user-attachments/assets/b045923b-aca0-4435-91f1-48c15ad21f37" alt="Product Recommendation Page">
  <p align="center">Figure 1: Product Recommendation Page</p>
</p>

<p align="center">
  <img width="1000" height="600" src="https://github.com/user-attachments/assets/7205cac0-2e95-4b75-ae89-15d135a9ed83" alt="Product Recommendation Page">
  <p align="center">Figure 2: Landing Page Product Recommendation Section</p>
</p>

## Technologies

### Web Application

The **Recommendation System Page** is built as a React-based micro-frontend using **Rsbuild** and **Module Federation**. **React** is a JavaScript library designed for building dynamic user interfaces with its Virtual DOM and component-oriented architecture, allowing dynamic updates without full page reloads. **Rsbuild** is a high-performance Rspack-based build tool that provides faster compilation times and optimized production builds compared to traditional bundlers like Webpack.

The frontend leverages **TypeScript** as its primary programming language, which enhances JavaScript with static type checking and analysis. For UI components, we use **Material-UI** (**MUI**), a comprehensive React component library that implements Google's Material Design principles, providing pre-built, accessible, and customizable components such as cards, icons, and layouts.

The most distinctive architectural decision is the adoption of **Module Federation**, a Webpack/Rspack feature that enables micro-frontend architecture. This allows our recommendation page component to be exposed as a federated module that can be dynamically imported and rendered by the main marketplace host application at runtime. This approach provides several advantages: independent deployment cycles, isolated development environments, and the ability to share dependencies like React across different micro-frontends efficiently.

### ML Integration

The machine learning component employs a sophisticated triple-model architecture built with **Python** and the **Surprise** (Simple Python RecommendatIon System Engine) library. The system trains three separate **SVD** (Singular Value Decomposition) models in parallel:

1. **Reviews Model**: Trained on explicit user feedback with ratings from 1-5 stars, capturing strong preference signals from users who actively review products.
2. **Orders Model**: Trained on implicit feedback from purchase history, where each order is converted to an implicit rating of 5.0, capturing behavioral signals even from users who don't leave reviews.
3. **Wishlist Model**: Trained on wishlist data with an implicit rating of 3.0, representing moderate interest in products users save for later.

All three models implement advanced data preprocessing, including per-user limits (up to 50 interactions) and cold-start filtering (minimum 2 interactions required). The recommendation generation process produces up to 50 predictions per user, which are then intelligently merged using a weighted combination: 60% weight for review-based predictions and 40% for order-based predictions when both are available. When all three sources are present, the system generates comprehensive multi-source explanations showing how each data type contributed to the recommendation.

A key innovation is the **smart filtering system** that implements "Not Interested" functionality. When a user marks a product as not interested, the system not only filters out that specific product but also identifies and excludes similar products using collaborative filtering techniques. This ensures that users don't see unwanted recommendations or closely related items, significantly improving recommendation relevance and user satisfaction.

The entire pipeline runs as an automated **Cloud Run Job** triggered daily at 2:00 AM by **Google Cloud Scheduler**. Upon completion, all recommendations with their multi-source explanations are serialized and stored in **Redis** with per-user keys (`recommendations:user:{customer_id}`) for sub-millisecond retrieval by the API layer. The system is also integrated with **Sentry** for comprehensive error tracking, performance monitoring, and profiling, ensuring production reliability.

### Microservice Communication

The recommendation service implements a comprehensive event-driven architecture using **Google Cloud Pub/Sub** for real-time data synchronization. The system subscribes to multiple topics across the marketplace ecosystem:

- **New Reviews** (`new_review` topic): Processes review events in real-time, updating the database and triggering recommendation recalculations when users rate products.
- **New Orders** (`new_order` topic): Captures purchase events instantly, feeding the implicit feedback model with fresh behavioral data.
- **Wishlist Updates** (`wishlist` topic): Monitors wishlist additions and removals, incorporating user interest signals into recommendations.
- **Product Changes** (`products` topic): Syncs product catalog updates, ensuring recommendations reference current inventory.
- **User Events** (`users` topic): Handles user profile changes and new customer registrations.
- **Vendor Registration** (`vendor-registration-topic`): Processes seller onboarding events for marketplace expansion.

All Pub/Sub messages use **Protocol Buffers** for efficient serialization, with dedicated `.proto` definitions for each message type. The system implements message validation, error handling with **Sentry** integration, and automatic retry logic for failed message processing.

The synchronization process captures the full spectrum of user interactions: explicit feedback through the reviews table, implicit feedback through orders and wishlists, and "not interested" signals. This comprehensive data collection enables the triple-model ML system to generate highly accurate recommendations by analyzing what users say (reviews), what they do (purchases), what they want (wishlists), and what they explicitly don't want (not interested items).

Additionally, the system maintains backward compatibility with the **Jumpseller API** integration for batch synchronization, providing a fallback mechanism and supporting initial data population. The API provides comprehensive **OpenAPI documentation** accessible at `/api-docs` endpoint using Swagger UI, enabling easy API exploration and testing.

### Infrastructure and Deployment

The system is fully deployed on **Google Cloud Platform** (**GCP**) using a comprehensive infrastructure-as-code approach with **Terraform**, managing all resources including networking, compute, storage, messaging, and scheduling components. The deployment architecture consists of three containerized services: the **Node.js API backend**, the **Python ML batch job**, and the **React frontend**, all packaged with **Docker** and pushed to **Google Artifact Registry** in the `europe-west3` region.

The **backend API** is deployed as a **Cloud Run** service (`backend-service`) providing a fully managed serverless platform that automatically scales based on incoming traffic. The service connects to **Cloud SQL** (PostgreSQL 16) via private IP networking through a **VPC Connector**, ensuring secure database access. The API includes comprehensive **OpenAPI documentation** served via Swagger UI at the `/api-docs` endpoint, providing interactive API exploration and testing capabilities. The **caching layer** utilizes **Google Cloud Memorystore for Redis** with LRU eviction policy and 100MB memory limit, storing pre-computed recommendations for instant retrieval.

The **Pub/Sub integration** enables real-time event processing through subscriptions to six different topics (`new_review`, `new_order`, `products`, `users`, `vendor-registration-topic`, `wishlist`). Each subscription processes Protocol Buffer-encoded messages, validating and storing data in Cloud SQL while triggering appropriate recommendation updates. The system implements robust error handling with automatic retries and dead-letter queues for failed messages. Nevertheless, other groups did not make the publishers for all of them, being the `new_review` the only one truly fully integrated. The rest of the topics are mocked, ready for whenever the **Publishers** are created.

The **ML batch job** is deployed as a **Cloud Run Job** (`surprise-job`) with automated execution via **Google Cloud Scheduler**. The scheduler triggers model retraining daily at 2:00 AM UTC (`0 2 * * *` cron expression), ensuring recommendations stay fresh with the latest user interactions. The job processes review, order, and wishlist data, trains triple SVD models, applies not-interested filtering, merges predictions, and updates Redis cache, all fully automated without manual intervention.

**Monitoring and observability** are provided through **Sentry** integration across both the API and ML services. Sentry captures exceptions, performance metrics, and profiling data with 10% trace and profile sampling rates, enabling proactive issue detection and resolution. Environment-specific configurations allow for separate tracking of development, staging, and production deployments.

Security is managed through **Google Secret Manager**, which stores sensitive credentials including database passwords, Redis authentication tokens, and Sentry DSN keys. Service accounts are configured with least-privilege IAM roles (Cloud SQL Client, Secret Manager Accessor, Cloud Run Invoker, Pub/Sub Subscriber) following security best practices. The entire infrastructure is version-controlled in Terraform, enabling reproducible deployments and easy environment management across development, staging, and production.

**Continuous Integration/Continuous Deployment** pipelines are implemented via GitHub Actions, with separate workflows for API deployment, frontend deployment, Surprise job deployment, and automated testing (Node.js CI and Python CI), ensuring code quality and reliable releases.

## Architecture

The data flow begins with the **React** client, which calls the backend API (**Recommendation API**) running on **Cloud Run**. For recommendations, the API first checks the **Redis** cache (**Memorystore**). If a pre-computed list exists, it is fetched and enriched with product data from the database (**Cloud SQL**, accessed via a **VPC Connector**). The recommendations in Redis are generated and periodically updated by a separate ML service (**Surprise**), also on Cloud Run, ensuring the backend remains focused on request handling and data serving.

**Jumpseller** is used because it is the standard platform adopted across the system, allowing easy access to the product data required for generating recommendations. The data obtained from Jumpseller is then processed to prepare it for model training. This preprocessing step removes unnecessary columns and formats the information in a way that supports efficient and accurate recommendation generation.

**GCP Pub/Sub** is incorporated to handle incremental data updates. Instead of repeatedly fetching the full dataset from Jumpseller, Pub/Sub delivers only new or modified data, making the update process significantly more efficient.

**Surprise** is a Python library designed to generate product recommendations based on user interactions. Because it includes a wide range of built-in models and algorithms, it offers a more efficient solution than developing new recommendation components from scratch. This approach reduces development effort and allows attention to be directed toward other aspects of the project. The Surprise module now implements a triple-model system that trains models based on reviews (explicit ratings), orders (implicit feedback with rating 5.0), and wishlists (implicit interest with rating 3.0), intelligently merging their predictions with weighted combinations. The system includes a **Cloud Run Job** triggered by **Cloud Scheduler** that trains all three models every day at 2:00 AM UTC, processes all active users, applies not-interested filtering to exclude unwanted products and similar items, generates up to 50 recommendations per user with multi-source explanations showing which data contributed to each suggestion, and refreshes the data in Redis automatically. The ML pipeline is monitored via **Sentry** for error tracking and performance profiling.

**Redis** functions as an in-memory cache that is periodically refreshed, ensuring rapid data retrieval and support for high-frequency updates. This makes caching especially valuable when handling negative reviews, which can influence existing recommendation results and may require immediate action. Since Redis is inherently designed for key-value storage and low-latency access, it offers an efficient and lightweight solution perfectly suited for the system's needs, directly enabling the daily update and fast data recovery crucial for the recommendation service.

### Architecture Diagram

Our architecture follows the diagram below:

<p align="center">
   <img width="1000" height="600" alt="image" src="https://github.com/user-attachments/assets/ec3230cd-eaae-4aa9-b3e5-e3c0850e2228" />
  <p align="center">Figure 3: Architecture Diagram</p>
</p>

### C4 Model Framework

The C4 model framework for our system can be found in the main [Excalidraw Whiteboard](https://excalidraw.com/#room=ea9b8e8ab91ec41aa71d,unD1AesOM0sSfVzioxfF7g).

## Platform Integration

We have achieved comprehensive platform integration, with the system being fully integrated with **Google Cloud Pub/Sub**, implementing real-time event-driven updates across six different topics. However, other groups did not implement the **Publisher** of their entities, being the only truly integrated the new reviews.

- **New Reviews**: Real-time review processing for instant recommendation updates
- **New Orders**: Purchase event streaming for behavioral analysis
- **Wishlist Updates**: Interest signal capture for preference modeling
- **Product Catalog**: Inventory synchronization and product data updates
- **User Management**: Customer profile and registration event handling
- **Vendor Registration**: Seller onboarding event processing

All Pub/Sub integrations use Protocol Buffers for efficient message serialization and include comprehensive error handling via Sentry. The system also maintains **Jumpseller API** integration for batch data synchronization and initial data population.

## Project Management

### Sprint 1 Overview

In Sprint 1, our team planned to work on the following issues:

- [#71 Product Recommendation via Product Reviews](https://github.com/FEUP-MEIC-DS-2025-26/madeinportugal.store/issues/71)
- [#72 Recommendations Dynamic Update according to Recent Activity](https://github.com/FEUP-MEIC-DS-2025-26/madeinportugal.store/issues/72)
- [#333 Product Recommendation Page](https://github.com/FEUP-MEIC-DS-2025-26/madeinportugal.store/issues/333)
- [#323 Popular Products Recommendation to New Users](https://github.com/FEUP-MEIC-DS-2025-26/madeinportugal.store/issues/323)

During the sprint, we had to refine the board and remove the issue [#323](https://github.com/FEUP-MEIC-DS-2025-26/madeinportugal.store/issues/323), since we were dependent on the work of another team in order to finalize it. Besides [#323](https://github.com/FEUP-MEIC-DS-2025-26/madeinportugal.store/issues/323), which we are waiting for the other team input, we were able to finish all the planned issues.

### Sprint 1 Review

Key takeaways from the sprint review:

- Well-implemented features, but still using mock data. Next focus should be on integrating with other services using Pub/Sub.
- For Sprint 2, teams should develop and integrate from the start, as most teams now have working services.

### Sprint 2 Overview

Building on Sprint 1 feedback, our team planned to work on the following issues in Sprint 2:

- [#76 Product Recommendations on Homepage](https://github.com/FEUP-MEIC-DS-2025-26/madeinportugal.store/issues/76)
- [#172 Display to User why an Item was Recommended](https://github.com/FEUP-MEIC-DS-2025-26/madeinportugal.store/issues/172)
- [#323 Linking New Users without Recommendations yet to the Best Selling Products](https://github.com/FEUP-MEIC-DS-2025-26/madeinportugal.store/issues/323)
- [#446 Product Recommendation via Purchase History](https://github.com/FEUP-MEIC-DS-2025-26/madeinportugal.store/issues/466)

 Which we were able to fully complete during the sprint.

### Sprint 2 Review

Key takeaways from the sprint review:

- Features were correctly developed and integrated from the start.
- Need to increase the number of Integration and Acceptance tests.
- Development Guide needs improvements to be more clear and better organized (Step-by-Step Instructions in the README.md).

### Sprint 3 Overview

In this final sprint, the team planned to complete all of issues that were left in the board, which involved working on the following:

- [#171 "Not Interested" Button in the Recommendations](https://github.com/FEUP-MEIC-DS-2025-26/madeinportugal.store/issues/171)
- [#68 Product Recommendation via Wishlisted Products](https://github.com/FEUP-MEIC-DS-2025-26/madeinportugal.store/issues/68)
- [#181 Action Influence Hierarchy on Recommendations](https://github.com/FEUP-MEIC-DS-2025-26/madeinportugal.store/issues/181)
- [#517 More Relevant Recommendations need to be more prominent](https://github.com/FEUP-MEIC-DS-2025-26/madeinportugal.store/issues/517)

 All of these were fully completed, but we also had to refine the board during the sprint, adding new feature issues ([#606](https://github.com/FEUP-MEIC-DS-2025-26/madeinportugal.store/issues/606), [#612](https://github.com/FEUP-MEIC-DS-2025-26/madeinportugal.store/issues/612), [#615](https://github.com/FEUP-MEIC-DS-2025-26/madeinportugal.store/issues/615), [#630](https://github.com/FEUP-MEIC-DS-2025-26/madeinportugal.store/issues/630), [#631](https://github.com/FEUP-MEIC-DS-2025-26/madeinportugal.store/issues/631), [#632](https://github.com/FEUP-MEIC-DS-2025-26/madeinportugal.store/issues/632), [#633](https://github.com/FEUP-MEIC-DS-2025-26/madeinportugal.store/issues/633), [#634](https://github.com/FEUP-MEIC-DS-2025-26/madeinportugal.store/issues/634) and [#638](https://github.com/FEUP-MEIC-DS-2025-26/madeinportugal.store/issues/638)), new task issues ([#609](https://github.com/FEUP-MEIC-DS-2025-26/madeinportugal.store/issues/601), [#610](https://github.com/FEUP-MEIC-DS-2025-26/madeinportugal.store/issues/610) and [#611](https://github.com/FEUP-MEIC-DS-2025-26/madeinportugal.store/issues/611)), and new bug issues ([#607](https://github.com/FEUP-MEIC-DS-2025-26/madeinportugal.store/issues/607), [#616](https://github.com/FEUP-MEIC-DS-2025-26/madeinportugal.store/issues/616), [#618](https://github.com/FEUP-MEIC-DS-2025-26/madeinportugal.store/issues/618), [#646](https://github.com/FEUP-MEIC-DS-2025-26/madeinportugal.store/issues/646) and [#656](https://github.com/FEUP-MEIC-DS-2025-26/madeinportugal.store/issues/658)).

### Sprint 3 Review

Key takeaways from the sprint review:

- Overall the final product is very good, with every initial planned feature implemented with some more;
- Our work efficiency and Scrum methodology improved consistently, sprint-by-sprint;
- Features implemented and with everything all setup to integrate that aren't due to other groups lack of completion of their tasks won't penalize our final grade. 

### Changelog

The changelog is available in the main repository, [here](https://github.com/FEUP-MEIC-DS-2025-26/recommendations/blob/main/CHANGELOG.md).

### Sprint Retrospectives

The sprint retrospectives are available in [this page](https://github.com/FEUP-MEIC-DS-2025-26/madeinportugal.store/wiki/Sprint-Retrospectives-3.1).

## Business Value

The Recommendation System delivers significant business value by transforming personalized product discovery into a core growth driver for the madeinportugal.store marketplace. By leveraging user behavior data—such as reviews, purchase history, and wishlists—the system provides highly relevant product suggestions that improve the overall shopping experience and reduce friction in product discovery.

From a commercial perspective, personalized recommendations directly contribute to increased user engagement, higher conversion rates, and improved average order value. By surfacing products aligned with individual user interests, the platform encourages users to spend more time browsing and increases the likelihood of purchase. The inclusion of explainable recommendations further strengthens user trust, making customers more confident in the suggestions presented and more likely to act on them.

The system also enhances customer retention by continuously learning from user interactions and adapting recommendations over time. Features such as the “Not Interested” mechanism empower users to explicitly refine their preferences, ensuring recommendations become progressively more accurate. This user-centric feedback loop reduces frustration, prevents recommendation fatigue, and promotes long-term loyalty to the platform.

From an operational and strategic standpoint, the cloud-native, microservices-based architecture enables the platform to scale efficiently as the marketplace grows in users, products, and vendors. Automated model retraining, real-time event-driven updates, and high-performance caching minimize manual intervention and infrastructure overhead while ensuring recommendations remain fresh and relevant. This scalability allows the business to introduce advanced personalization strategies without rearchitecting the system.

Additionally, the Recommendation System generates valuable behavioral insights that can inform broader business decisions, including marketing campaigns, product promotion strategies, and vendor performance analysis. By understanding what users like, buy, save, and explicitly reject, the marketplace gains a data-driven foundation for optimizing inventory exposure, promoting high-margin products, and supporting sellers more effectively.

Overall, the Recommendation System is not merely a technical enhancement but a strategic asset that strengthens customer experience, drives revenue growth, supports marketplace scalability, and reinforces the competitive positioning of madeinportugal.store in an increasingly personalized digital commerce environment.

[Presentation GIF on Youtube](https://youtu.be/Ltx0w_E2faE)