import json
from typing import List, Dict

def store_recommendations(r_client, customer_id: int, recs: List[int], explanations: Dict[int, str], model_name: str, rankings: Dict[int, int] = None):
    """
    Store recommendations in Redis with ranking information.
    
    Args:
        r_client: Redis client
        customer_id: Customer ID
        recs: List of recommended product IDs (in order)
        explanations: Dict of {product_id: explanation}
        model_name: Model name (REVIEWS, ORDERS, COMBINED)
        rankings: Dict of {product_id: rank} (1-based)
    """
    
    if not rankings:
        rankings = {pid: rank + 1 for rank, pid in enumerate(recs)}
    
    data = {
        "product_ids": recs,
        "explanations": explanations,
        "rankings": rankings,
        "model": model_name
    }
    
    key = f"recommendations:user:{customer_id}"
    
    try:
        r_client.set(key, json.dumps(data))
        print(f"✅ Stored {len(recs)} recommendations for customer {customer_id}")
    except Exception as e:
        print(f"❌ Error storing recommendations for customer {customer_id}: {e}")