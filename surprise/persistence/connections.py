import os
import redis
import psycopg2
import argparse
import json
from dotenv import load_dotenv




APP_ENV = os.getenv("APP_ENV")
if APP_ENV is None or APP_ENV == 'development':
    print("Detected local/development environment. Loading configuration from .env.development.")
    load_dotenv(dotenv_path='.env.development', override=True)
    APP_ENV = os.getenv("APP_ENV", "local") 
else:
    print(f"Detected environment: **{APP_ENV}**. Skipping local .env file load.")





# --- Environment Variables ---
REDIS_HOST = os.getenv("REDIS_HOST")
REDIS_PORT = os.getenv("REDIS_PORT")
REDIS_PASSWORD = os.getenv("REDIS_PASSWORD")

PG_HOST = os.getenv("PG_HOST")
PG_PORT = os.getenv("PG_PORT")
PG_USER = os.getenv("PG_USER")
PG_PASSWORD = os.getenv("PG_PASSWORD")
PG_NAME = os.getenv("PG_NAME")





# --- PostgreSQL Connection ---
def get_pg_connection():
    """
    Establishes and returns a connection to PostgreSQL.
    Uses environment variables for configuration.
    This setup is portable to GCP.
    """
    if not PG_HOST or not PG_NAME or not PG_USER:
        raise ConnectionError("PostgreSQL connection details (HOST, NAME, or USER) not fully set.")

    print(f"Connecting to PostgreSQL at {PG_HOST}:{PG_PORT}/{PG_NAME}...")
    try:
        conn = psycopg2.connect(
            host=PG_HOST,
            port=PG_PORT,
            user=PG_USER,
            password=PG_PASSWORD,
            dbname=PG_NAME,
            connect_timeout=5
        )
        conn.cursor() 
        print("✅ PostgreSQL connection successful!")
        return conn
    except psycopg2.Error as e:
        print(f"❌ PostgreSQL connection failed: {e}")
        return None


# --- Redis Connection ---
def get_redis_connection():
    """
    Establishes and returns a connection to Redis.
    Uses environment variables for configuration.
    This setup is portable to GCP (e.g., in a GKE pod or Cloud Run container).
    """
    if not REDIS_HOST:
        raise ConnectionError("REDIS_HOST not set in environment.")

    print(f"Connecting to Redis at {REDIS_HOST}:{REDIS_PORT}...")
    try:
        r = redis.Redis(
            host=REDIS_HOST,
            port=int(REDIS_PORT),
            password=REDIS_PASSWORD,
            decode_responses=True,
            socket_timeout=5
        )
        r.ping()
        print("✅ Redis connection successful!")
        return r
    except redis.exceptions.ConnectionError as e:
        print(f"❌ Redis connection failed: {e}")
        return None


def inspect_redis_key(key: str):
    """Fetches and displays the content of a specified Redis key."""
    print(f"\n--- Inspecting Redis Key: **{key}** ---")
    r_client = get_redis_connection()
    if not r_client:
        print("❌ Could not connect to Redis.")
        return

    try:
        value = r_client.get(key)
        
        if value is None:
            print(f"Key '{key}' **does not exist**.")
            return

        if isinstance(value, bytes):
            decoded_value = value.decode('utf-8')
        else:
            decoded_value = value

        try:
            data = json.loads(decoded_value)
            print("Content (JSON):")
            print(json.dumps(data, indent=4))
        except json.JSONDecodeError:
            print("Content (String):")
            print(decoded_value)
            
        ttl = r_client.ttl(key)
        if ttl >= 0:
            print(f"TTL (Time To Live): {ttl} seconds")
        else:
            print("TTL (Time To Live): None (Key is permanent)")

    except Exception as e:
        print(f"❌ Error inspecting Redis key: {e}")



# --- Connection Tests/Execution Check ---
if __name__ == "__main__":

    parser = argparse.ArgumentParser(
        description="Run connection tests or inspect Redis content.",
        formatter_class=argparse.RawTextHelpFormatter
    )
    parser.add_argument(
        '--key', 
        type=str, 
        help="Specify a Redis key to inspect and display its content (e.g., --key recommendations:global:popular)"
    )
    
    parser.add_argument(
        '--no-tests',
        action='store_true',
        help="Skip running the default Redis and PostgreSQL connection tests."
    )

    parser.add_argument(
        '--show-all',
        action='store_true',
        help="List all Redis keys and their stored content."
    )
    
    args = parser.parse_args()

    if args.key:
        inspect_redis_key(args.key)
        exit(0)
    
    if args.show_all:
        r = get_redis_connection()
        if not r:
            print("❌ Could not connect to Redis.")
        else:
            print("\n--- Redis: Listing All Keys and Values ---")
            keys = r.keys("*")
            
            if not keys:
                print("No keys found.")
            else:
                for key in keys:
                    try:
                        raw = r.get(key)
                        value = raw

                        # Try to pretty-print JSON
                        try:
                            parsed = json.loads(raw)
                            value = json.dumps(parsed, indent=4)
                        except:
                            pass

                        print(f"\n🔑 Key: {key}")
                        print(f"📦 Value:\n{value}")
                    except Exception as e:
                        print(f"❌ Error reading key {key}: {e}")
        exit(0)

    if not args.no_tests and not args.key:
        print(f"--- Running in environment: **{APP_ENV}** ---")
        print("\n--- Testing Redis Connection ---")
        redis_client = get_redis_connection()
        if redis_client:
            try:
                test_key = "app_test_key"
                redis_client.set(test_key, "Connected!")
                value = redis_client.get(test_key)
                print(f"Redis test: Set '{test_key}' and got value '{value}'")
                redis_client.delete(test_key)
            except Exception as e:
                print(f"❌ Redis operational test failed: {e}")
            finally:
                pass


        print("\n--- Testing PostgreSQL Connection ---")
        pg_conn = get_pg_connection()
        if pg_conn:
            try:
                with pg_conn.cursor() as cursor:
                    cursor.execute("SELECT 1;")
                    result = cursor.fetchone()
                    print(f"PostgreSQL test: Ran 'SELECT 1;' and got result: {result}")
                
            except Exception as e:
                print(f"❌ PostgreSQL operational test failed: {e}")
            finally:
                pg_conn.close()
                print("PostgreSQL connection closed.")