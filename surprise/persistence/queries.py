import pandas as pd
import warnings
from typing import Any, Set
import sentry_sdk

# Suppress pandas SQLAlchemy warning for psycopg2 connections
warnings.filterwarnings('ignore', category=UserWarning, message='.*SQLAlchemy.*')

MIN_REVIEWS_PER_USER = 2
MAX_REVIEWS_PER_USER = 50
MIN_ORDERS_PER_USER = 2
MAX_ORDERS_PER_USER = 50
MIN_WISHLIST_PER_USER = 2
MAX_WISHLIST_PER_USER = 50

def get_recent_reviews_data(pg_conn: Any) -> pd.DataFrame:
    """
    Fetches up to MAX_REVIEWS_PER_USER PER CUSTOMER (most recent).
    Filters out cold-start customers (MIN_REVIEWS_PER_USER).
    """
    
    print(f"Fetching up to {MAX_REVIEWS_PER_USER} most recent reviews per customer...")
    
    query = f"""
    WITH RankedReviews AS (
        SELECT 
            customer_id,
            product_id, 
            rating,
            reviewed_at,
            ROW_NUMBER() OVER(PARTITION BY customer_id ORDER BY reviewed_at DESC) as rn
        FROM review
    ),
    LimitedReviews AS (
        SELECT 
            customer_id,
            product_id, 
            rating
        FROM RankedReviews
        WHERE rn <= {MAX_REVIEWS_PER_USER}
    )
    SELECT 
        customer_id,
        product_id, 
        rating
    FROM LimitedReviews;
    """
    
    try:
        df = pd.read_sql(query, pg_conn)
    except Exception as e:
        error_msg = f"❌ Error fetching reviews: {e}"
        print(error_msg)
        print(f"📤 Sending to Sentry: {type(e).__name__}")
        sentry_sdk.capture_message(error_msg, level="error")
        sentry_sdk.capture_exception(e)
        print("📤 Flushing Sentry...")
        sentry_sdk.flush(timeout=3)
        print("✅ Sentry flush complete")
        return pd.DataFrame()

    active_users = df.groupby('customer_id').filter(lambda x: len(x) >= MIN_REVIEWS_PER_USER)
    
    print(f"Found {len(active_users['customer_id'].unique())} customers with >= {MIN_REVIEWS_PER_USER} recent reviews.")
    
    return active_users


def get_order_history_data(pg_conn: Any) -> pd.DataFrame:
    """
    Fetches up to MAX_ORDERS_PER_USER PER CUSTOMER (most recent).
    Each product purchased = implicit rating of 5.
    Filters out cold-start customers (MIN_ORDERS_PER_USER).
    """
    
    print(f"Fetching up to {MAX_ORDERS_PER_USER} most recent orders per customer...")
    
    query = f"""
    WITH RankedOrders AS (
        SELECT 
            o.customer_id,
            oi.product_id,
            o.ordered_at,
            ROW_NUMBER() OVER(PARTITION BY o.customer_id ORDER BY o.ordered_at DESC) as rn
        FROM "order" o
        INNER JOIN order_item oi ON o.order_id = oi.order_id
    ),
    LimitedOrders AS (
        SELECT 
            customer_id,
            product_id
        FROM RankedOrders
        WHERE rn <= {MAX_ORDERS_PER_USER}
    )
    SELECT 
        customer_id,
        product_id,
        5 as rating
    FROM LimitedOrders;
    """
    
    try:
        df = pd.read_sql(query, pg_conn)
    except Exception as e:
        error_msg = f"❌ Error fetching orders: {e}"
        print(error_msg)
        print(f"📤 Sending to Sentry: {type(e).__name__}")
        sentry_sdk.capture_message(error_msg, level="error")
        sentry_sdk.capture_exception(e)
        print("📤 Flushing Sentry...")
        sentry_sdk.flush(timeout=3)
        print("✅ Sentry flush complete")
        return pd.DataFrame()

    active_users = df.groupby('customer_id').filter(lambda x: len(x) >= MIN_ORDERS_PER_USER)
    
    print(f"Found {len(active_users['customer_id'].unique())} customers with >= {MIN_ORDERS_PER_USER} recent orders.")
    
    return active_users


def get_not_interested_products(pg_conn: Any, customer_id: int) -> Set[int]:
    """
    Fetch all products the customer marked as not_interested.
    """
    query = """
    SELECT product_id FROM not_interested
    WHERE customer_id = %s;
    """
    
    try:
        df = pd.read_sql(query, pg_conn, params=[customer_id])
        return set(df['product_id'].tolist())
    except Exception as e:
        error_msg = f"❌ Error fetching not_interested products for customer {customer_id}: {e}"
        print(error_msg)
        print(f"📤 Sending to Sentry: {type(e).__name__}")
        sentry_sdk.capture_message(error_msg, level="error")
        sentry_sdk.capture_exception(e)
        print("📤 Flushing Sentry...")
        sentry_sdk.flush(timeout=3)
        print("✅ Sentry flush complete")
        return set()


def get_wishlist_data(pg_conn: Any) -> pd.DataFrame:
    """
    Fetches up to MAX_WISHLIST_PER_USER PER CUSTOMER (most recent).
    Each wishlist item = implicit rating of 3 (lowest explicit interest).
    Filters out cold-start customers (MIN_WISHLIST_PER_USER).
    """
    
    print(f"Fetching up to {MAX_WISHLIST_PER_USER} most recent wishlist items per customer...")
    
    query = f"""
    WITH RankedWishlist AS (
        SELECT 
            customer_id,
            product_id,
            created_at,
            ROW_NUMBER() OVER(PARTITION BY customer_id ORDER BY created_at DESC) as rn
        FROM wishlist
    ),
    LimitedWishlist AS (
        SELECT 
            customer_id,
            product_id
        FROM RankedWishlist
        WHERE rn <= {MAX_WISHLIST_PER_USER}
    )
    SELECT 
        customer_id,
        product_id,
        3 as rating
    FROM LimitedWishlist;
    """
    
    try:
        df = pd.read_sql(query, pg_conn)
    except Exception as e:
        error_msg = f"❌ Error fetching wishlist: {e}"
        print(error_msg)
        print(f"📤 Sending to Sentry: {type(e).__name__}")
        sentry_sdk.capture_message(error_msg, level="error")
        sentry_sdk.capture_exception(e)
        print("📤 Flushing Sentry...")
        sentry_sdk.flush(timeout=3)
        print("✅ Sentry flush complete")
        return pd.DataFrame()

    active_users = df.groupby('customer_id').filter(lambda x: len(x) >= MIN_WISHLIST_PER_USER)
    
    print(f"Found {len(active_users['customer_id'].unique())} customers with >= {MIN_WISHLIST_PER_USER} recent wishlist items.")
    
    return active_users