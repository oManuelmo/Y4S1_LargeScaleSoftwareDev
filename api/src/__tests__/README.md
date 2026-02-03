# PubSub Data Source Tests

This directory contains unit and integration tests for the PubSub data source functionality.

## Test Structure

### Unit Tests (`pubsub-data-source.spec.ts`)
- Mock-based tests that don't require external services
- Test all core functionality including:
  - Singleton pattern
  - Subscription initialization
  - Message parsing (protobuf decoding)
  - Review, Order, Product, User, Vendor, Wishlist, and NotInterested processing
  - Error handling
  - Message acknowledgment

### Integration Tests (`__tests__/pubsub-integration.test.ts`)
- End-to-end tests using actual PubSub emulator and PostgreSQL
- Test complete message flows from publishing to database persistence
- **Skipped by default** to speed up regular test runs

### Helpers (not tests)
- Utilities live in `src/test-helpers/` (e.g., `pubsub-test-helpers.ts`).
- These files are **excluded** from Jest discovery in `jest.config.js`.
- Do not suffix helper files with `.spec.ts` or `.test.ts` to avoid accidental execution.

## Running Tests

### Run All Tests (default)
```bash
npm test
```
Runs both `*.spec.ts` and `*.test.ts`.

### Run Only Unit Tests
```bash
npm run test:unit
```
Runs only `*.spec.ts` files.

### Run Integration Tests Only
```bash
# First, ensure Docker services are running
docker compose up -d

# Then run integration tests
npm run test:integration
```
Runs only `*.test.ts` files.

**Tip:** If you see Jest complaining "Your test suite must contain at least one test," it usually means a helper file was picked up as a test. Keep helpers under `src/test-helpers/` and avoid test suffixes.

### Run Specific Test File
```bash
npm test -- pubsub-data-source.spec.ts
```

### Run with Coverage
```bash
npm test -- --coverage
```

## Prerequisites for Integration Tests

1. **Docker services must be running:**
   ```bash
   docker compose up -d
   ```

2. **Required services:**
   - PubSub Emulator (port 8085)
   - PostgreSQL (port 5434)
   - Redis (port 6379)

3. **Environment variables:**
   - Automatically loaded from `.env.development`
   - Can be overridden with `SKIP_INTEGRATION=true` to force skip

## Test Helpers

The `src/test-helpers/pubsub-test-helpers.ts` file provides utility functions:
- `createTestPubSubClient()` - Create emulator-connected client
- `loadTestProtoMessages()` - Load all protobuf definitions
- `publishTestMessage()` - Helper to publish encoded messages
- `createTest*()` - Factory functions for test payloads
- `waitForProcessing()` - Delay for message processing
- `cleanupTestResources()` - Clean up topics/subscriptions

## Coverage

Current test coverage includes:
- ✅ All message types (Review, Order, Product, User, Vendor, Wishlist, NotInterested)
- ✅ Protobuf encoding/decoding
- ✅ Database entity creation and updates
- ✅ Composite primary keys (OrderItem)
- ✅ Placeholder customer creation
- ✅ Error handling and message acknowledgment
- ✅ Timestamp conversion
- ✅ Field name conversion (snake_case → camelCase)

## Continuous Integration

For CI environments, integration tests can be disabled by setting:
```bash
SKIP_INTEGRATION=true npm test
```

Or by not setting `RUN_INTEGRATION_TESTS=true`.
