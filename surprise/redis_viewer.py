import json
from persistence.connections import get_redis_connection


def view_all_recommendations():
    """
    Displays all recommendations stored in Redis.
    """
    r_client = get_redis_connection()
    
    if not r_client:
        print("❌ Redis connection failed.")
        return

    try:
        cursor = 0
        keys_found = 0
        
        print("\n" + "="*80)
        print("📊 ALL RECOMMENDATIONS IN REDIS")
        print("="*80 + "\n")
        
        while True:
            cursor, keys = r_client.scan(cursor, match="recommendations:user:*", count=100)
            
            for key in keys:
                keys_found += 1
                value = r_client.get(key)
                
                if value:
                    try:
                        data = json.loads(value)
                        key_str = key if isinstance(key, str) else key.decode()
                        customer_id = key_str.split(":")[-1]
                        
                        product_ids = data.get('product_ids', [])
                        explanations = data.get('explanations', {})
                        rankings = data.get('rankings', {})
                        
                        print(f"\n🔹 Customer ID: {customer_id}")
                        print(f"   Model: {data.get('model', 'N/A')}")
                        print(f"   Recommendations ({len(product_ids)} items):")
                        
                        for idx, pid in enumerate(product_ids[:5], 1):
                            explanation = explanations.get(str(pid), "N/A")
                            rank = rankings.get(str(pid), idx)
                            print(f"      #{rank}. Product {pid}")
                            print(f"         Reason: {explanation}")
                        
                        if len(product_ids) > 5:
                            print(f"      ... and {len(product_ids) - 5} more")
                    
                    except json.JSONDecodeError:
                        print(f"❌ Error decoding JSON for key: {key}")
            
            if cursor == 0:
                break
        
        print(f"\n{'='*80}")
        print(f"✅ Total customers with recommendations: {keys_found}")
        print(f"{'='*80}\n")
    
    except Exception as e:
        print(f"❌ Error reading Redis: {e}")
    
    finally:
        if r_client:
            r_client.close()


def view_customer_recommendations(customer_id: int):
    """
    Displays recommendations for a specific customer with rankings.
    """
    r_client = get_redis_connection()
    
    if not r_client:
        print("❌ Redis connection failed.")
        return

    try:
        key = f"recommendations:user:{customer_id}"
        value = r_client.get(key)
        
        if not value:
            print(f"❌ No recommendations found for customer {customer_id}")
            return
        
        data = json.loads(value)
        product_ids = data.get('product_ids', [])
        explanations = data.get('explanations', {})
        rankings = data.get('rankings', {}) 
        
        print(f"\n{'='*80}")
        print(f"📊 RECOMMENDATIONS FOR CUSTOMER {customer_id}")
        print(f"   (Key: {key})")
        print(f"{'='*80}\n")
        print(f"Model: {data.get('model')}")
        print(f"Total Recommendations: {len(product_ids)}\n")
        
        for idx, pid in enumerate(product_ids, 1):
            explanation = explanations.get(str(pid), "N/A")
            rank = rankings.get(str(pid), idx)
            print(f"#{rank}. Product {pid}")
            print(f"   Reason: {explanation}\n")
        
        print(f"{'='*80}\n")
    
    except json.JSONDecodeError:
        print(f"❌ Error decoding recommendation data")
    except Exception as e:
        print(f"❌ Error: {e}")
    
    finally:
        if r_client:
            r_client.close()


def debug_customer_data(customer_id: int):
    """
    Shows raw Redis data for debugging.
    """
    r_client = get_redis_connection()
    
    if not r_client:
        print("❌ Redis connection failed.")
        return

    try:
        key = f"recommendations:user:{customer_id}"
        value = r_client.get(key)
        
        if not value:
            print(f"❌ No data found for key: {key}")
            return
        
        print(f"\n📋 RAW DATA for {key}:")
        print(f"Type: {type(value)}")
        print(f"Length: {len(value)} bytes")
        
        data = json.loads(value)
        print(f"\n✅ Parsed JSON:")
        print(json.dumps(data, indent=2))
    
    except json.JSONDecodeError as e:
        print(f"\n❌ JSON Parse Error: {e}")
    except Exception as e:
        print(f"❌ Error: {e}")
    
    finally:
        if r_client:
            r_client.close()


def clear_all_recommendations():
    """
    Clears all recommendations from Redis.
    """
    r_client = get_redis_connection()
    
    if not r_client:
        print("❌ Redis connection failed.")
        return

    try:
        cursor = 0
        deleted_count = 0
        
        while True:
            cursor, keys = r_client.scan(cursor, match="recommendations:user:*", count=100)
            
            for key in keys:
                r_client.delete(key)
                deleted_count += 1
            
            if cursor == 0:
                break
        
        print(f"✅ Cleared {deleted_count} recommendation records from Redis")
    
    except Exception as e:
        print(f"❌ Error clearing Redis: {e}")
    
    finally:
        if r_client:
            r_client.close()


if __name__ == "__main__":
    import sys
    
    if len(sys.argv) > 1:
        if sys.argv[1] == "customer" and len(sys.argv) > 2:
            view_customer_recommendations(int(sys.argv[2]))
        elif sys.argv[1] == "clear":
            confirm = input("⚠️  This will delete ALL recommendations. Continue? (y/N): ")
            if confirm.lower() == "y":
                clear_all_recommendations()
            else:
                print("Cancelled.")
        else:
            print("Usage:")
            print("  python redis_viewer.py                    # View all recommendations")
            print("  python redis_viewer.py customer <id>      # View specific customer")
            print("  python redis_viewer.py clear              # Clear all recommendations")
    else:
        view_all_recommendations()