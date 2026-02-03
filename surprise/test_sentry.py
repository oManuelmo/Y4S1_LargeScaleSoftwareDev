#!/usr/bin/env python3
"""
Quick test to verify Sentry is properly capturing errors
"""
import sentry_sdk

# Hardcoded DSN for testing
sentry_dsn = "https://3886968ad4175d0d6d9831ef6601f37d@o4510490159480832.ingest.de.sentry.io/4510490192445520"
print(f"SENTRY_DSN: {sentry_dsn}")

if not sentry_dsn:
    print("❌ SENTRY_DSN not set!")
    exit(1)

# Initialize Sentry
sentry_sdk.init(
    server_name="test-surprise",
    release="python-test-v1.0.0",
    dsn=sentry_dsn,
    environment="production",
    traces_sample_rate=1.0,
    profiles_sample_rate=1.0,
)

print("✅ Sentry initialized")

# Create a test error
try:
    print("Creating test error...")
    raise ValueError("This is a test error from the surprise job")
except Exception as e:
    print(f"Capturing error: {e}")
    sentry_sdk.capture_exception(e)
    sentry_sdk.capture_message(f"Test message: {e}", level="error")

print("📤 Flushing Sentry...")
sentry_sdk.flush(timeout=10)
print("✅ Done - check Sentry dashboard!")
