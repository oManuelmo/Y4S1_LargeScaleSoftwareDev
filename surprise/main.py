from typing import Dict, List, Tuple
from persistence.connections import get_redis_connection, get_pg_connection
from recommendation_models import SVDRecommender
from persistence.queries import (
    get_recent_reviews_data,
    get_order_history_data,
    get_wishlist_data
)
from persistence.commands import store_recommendations
import sentry_sdk
import os

# Initialize Sentry with enhanced logging
sentry_dsn = os.environ.get("SENTRY_DSN")
sentry_env = os.environ.get("SENTRY_ENVIRONMENT", "production")

if sentry_dsn:
    sentry_sdk.init(
        server_name="surprise-job",
        release="python-v1.0.0",
        dsn=sentry_dsn,
        environment=sentry_env,
        traces_sample_rate=0.1,
        profiles_sample_rate=0.1,
        attach_stacktrace=True,
        include_local_variables=True,
    )
    print(f"✅ Sentry initialized with DSN: {sentry_dsn[:50]}...")
    print(f"   Environment: {sentry_env}")
    print(f"   Trace sample rate: 0.1, Profile sample rate: 0.1")
else:
    print("⚠️  SENTRY_DSN not set - error tracking disabled")

def build_source_explanation(sources: Dict[str, Tuple[float, str]]) -> str:
    """
    Build a clear explanation showing which sources contributed to this recommendation.
    
    Args:
        sources: Dict with keys from {"REVIEWS", "ORDERS", "WISHLIST"} 
                and values as (score, explanation) tuples
    
    Returns:
        A human-readable explanation indicating the source(s)
    """
    if not sources:
        return "✨ Personalized just for you"
    
    parts = []
    
    # Add reviews source
    if "REVIEWS" in sources:
        score, explanation = sources["REVIEWS"]
        parts.append(f"Based on your ratings: {explanation}")
    
    # Add orders source
    if "ORDERS" in sources:
        score, explanation = sources["ORDERS"]
        parts.append(f"Because you've purchased similar items: {explanation}")
    
    # Add wishlist source
    if "WISHLIST" in sources:
        score, explanation = sources["WISHLIST"]
        parts.append(f"Because you wishlisted similar products: {explanation}")
    
    # Combine all parts
    if len(parts) == 1:
        return parts[0]
    elif len(parts) == 2:
        return f"{parts[0]} Also, {parts[1].lower()}"
    else:
        return f"{parts[0]} Also, {' And '.join([p.lower() for p in parts[1:]])}"


def build_single_source_explanation(source_type: str, explanation: str) -> str:
    """
    Build explanation for single source recommendations.
    """
    if source_type == "REVIEWS":
        return f"Based on your ratings: {explanation}"
    elif source_type == "ORDERS":
        return f"Because you've purchased similar items: {explanation}"
    elif source_type == "WISHLIST":
        return f"Because you wishlisted similar products: {explanation}"
    else:
        return explanation


def merge_recommendations(reviews_recs: Dict[int, Tuple], orders_recs: Dict[int, Tuple], max_recs: int = 50) -> Tuple[List[int], Dict[int, str], Dict[int, int]]:
    """
    Merge recommendations from both models with combined explanations showing sources.
    """
    merged_scores = {}
    merged_sources = {}
    all_products = set(reviews_recs.keys()) | set(orders_recs.keys())
    
    for product_id in all_products:
        review_score = reviews_recs.get(product_id, (0, "", ""))[0]
        order_score = orders_recs.get(product_id, (0, "", ""))[0]
        
        # Weighted average: prioritize reviews (60%) over orders (40%)
        combined_score = (review_score * 0.6) + (order_score * 0.4)
        
        # Collect source information for explanation building
        sources = {}
        if product_id in reviews_recs:
            sources["REVIEWS"] = (review_score, reviews_recs[product_id][1])
        if product_id in orders_recs:
            sources["ORDERS"] = (order_score, orders_recs[product_id][1])
        
        merged_scores[product_id] = combined_score
        merged_sources[product_id] = sources
    
    # Sort and take top max_recs
    sorted_products = sorted(merged_scores.items(), key=lambda x: x[1], reverse=True)[:max_recs]
    
    final_recs = [pid for pid, _ in sorted_products]
    final_explanations = {pid: build_source_explanation(merged_sources[pid]) for pid, _ in sorted_products}
    final_rankings = {pid: rank + 1 for rank, (pid, _) in enumerate(sorted_products)}
    return final_recs, final_explanations, final_rankings


def run_reviews_recommendation_job(pg_conn):
    """Trains SVD model on explicit reviews."""
    print("\n=== REVIEWS MODEL ===")
    reviews_df = get_recent_reviews_data(pg_conn=pg_conn)
    
    if reviews_df.empty:
        print("No review data found.")
        return {}, None

    model = SVDRecommender(model_source="reviews")
    model.train(reviews_df)

    users_recs = {}
    users_to_predict = reviews_df['customer_id'].unique()
    
    for customer_id in users_to_predict:
        top_recs, explanations, predictions = model.recommend(reviews_df, customer_id)
        if top_recs:
            users_recs[int(customer_id)] = {
                pid: (score, explanations.get(pid, ""), "REVIEWS")
                for pid, score in predictions
            }
    
    print(f"✅ Generated reviews-based recs for {len(users_recs)} users.")
    return users_recs, model


def run_orders_recommendation_job(pg_conn):
    """Trains SVD model on implicit order feedback."""
    print("\n=== ORDERS MODEL ===")
    orders_df = get_order_history_data(pg_conn=pg_conn)
    
    if orders_df.empty:
        print("No order data found.")
        return {}, None

    model = SVDRecommender(model_source="orders")
    model.train(orders_df)

    users_recs = {}
    users_to_predict = orders_df['customer_id'].unique()
    
    for customer_id in users_to_predict:
        top_recs, explanations, predictions = model.recommend(orders_df, customer_id)
        if top_recs:
            users_recs[int(customer_id)] = {
                pid: (score, explanations.get(pid, ""), "ORDERS")
                for pid, score in predictions
            }
    
    print(f"✅ Generated orders-based recs for {len(users_recs)} users.")
    return users_recs, model


def run_wishlist_recommendation_job(pg_conn):
    """Trains SVD model on implicit wishlist feedback."""
    print("\n=== WISHLIST MODEL ===")
    wishlist_df = get_wishlist_data(pg_conn=pg_conn)
    
    if wishlist_df.empty:
        print("No wishlist data found.")
        return {}, None

    model = SVDRecommender(model_source="wishlist")
    model.train(wishlist_df)

    users_recs = {}
    users_to_predict = wishlist_df['customer_id'].unique()
    
    for customer_id in users_to_predict:
        top_recs, explanations, predictions = model.recommend(wishlist_df, customer_id)
        if top_recs:
            users_recs[int(customer_id)] = {
                pid: (score, explanations.get(pid, ""), "WISHLIST")
                for pid, score in predictions
            }
    
    print(f"✅ Generated wishlist-based recs for {len(users_recs)} users.")
    return users_recs, model


def enhance_top_3_reasons(final_recs: List[int], final_explanations: Dict[int, str]) -> Dict[int, str]:
    """
    Enhance the top 3 product reasons with special highlighting.
    Applied after all merging and sorting is done.
    """
    enhanced_explanations = final_explanations.copy()
    
    for rank, product_id in enumerate(final_recs[:3], 1):
        original_reason = enhanced_explanations.get(product_id, "")
        
        if rank == 1:
            enhanced_explanations[product_id] = f"🏆 MUST-HAVE! {original_reason}"
        elif rank == 2:
            enhanced_explanations[product_id] = f"🥈 HIGHLY RECOMMENDED! {original_reason}"
        elif rank == 3:
            enhanced_explanations[product_id] = f"🥉 HIGHLY RECOMMENDED! {original_reason}"
    
    return enhanced_explanations


if __name__ == "__main__":
    print("Starting recommendation jobs...\n")
    
    pg_conn = get_pg_connection()
    r_client = get_redis_connection()
    
    if not pg_conn or not r_client:
        print("❌ Database or Redis connection failed. Aborting.")
        exit(1)
    
    try:
        # Run all three models
        reviews_recs, reviews_model = run_reviews_recommendation_job(pg_conn)
        orders_recs, orders_model = run_orders_recommendation_job(pg_conn)
        wishlist_recs, wishlist_model = run_wishlist_recommendation_job(pg_conn)
        
        all_users = set(reviews_recs.keys()) | set(orders_recs.keys()) | set(wishlist_recs.keys())
        
        for customer_id in all_users:
            review_user_recs = reviews_recs.get(customer_id, {})
            orders_user_recs = orders_recs.get(customer_id, {})
            wishlist_user_recs = wishlist_recs.get(customer_id, {})
            
            # Handle all combinations: determine which models have data
            has_reviews = bool(review_user_recs)
            has_orders = bool(orders_user_recs)
            has_wishlist = bool(wishlist_user_recs)
            
            if has_reviews and has_orders and has_wishlist:
                # Merge all three models with weighted priority
                # Reviews (60%) > Orders (30%) > Wishlist (10%)
                all_products = set(review_user_recs.keys()) | set(orders_user_recs.keys()) | set(wishlist_user_recs.keys())
                merged_scores = {}
                merged_sources = {}
                
                for product_id in all_products:
                    review_score = review_user_recs.get(product_id, (0, "", ""))[0]
                    order_score = orders_user_recs.get(product_id, (0, "", ""))[0]
                    wishlist_score = wishlist_user_recs.get(product_id, (0, "", ""))[0]
                    
                    combined_score = (review_score * 0.6) + (order_score * 0.3) + (wishlist_score * 0.1)
                    
                    # Collect source information for explanation building
                    sources = {}
                    if product_id in review_user_recs:
                        sources["REVIEWS"] = (review_score, review_user_recs[product_id][1])
                    if product_id in orders_user_recs:
                        sources["ORDERS"] = (order_score, orders_user_recs[product_id][1])
                    if product_id in wishlist_user_recs:
                        sources["WISHLIST"] = (wishlist_score, wishlist_user_recs[product_id][1])
                    
                    merged_scores[product_id] = combined_score
                    merged_sources[product_id] = sources
                
                sorted_products = sorted(merged_scores.items(), key=lambda x: x[1], reverse=True)[:50]
                final_recs = [pid for pid, _ in sorted_products]
                final_explanations = {pid: build_source_explanation(merged_sources[pid]) for pid, _ in sorted_products}
                
                if reviews_model:
                    filtered_recs = reviews_model.filter_not_interested(customer_id, [(p, 1.0) for p in final_recs], pg_conn)
                    final_recs = [p[0] for p in filtered_recs]
                    final_explanations = {pid: final_explanations[pid] for pid in final_recs}
                
                final_rankings = {pid: rank + 1 for rank, pid in enumerate(final_recs)}
                final_explanations = enhance_top_3_reasons(final_recs, final_explanations)
                store_recommendations(r_client, customer_id, final_recs, final_explanations, "ALL_SOURCES", final_rankings)
                
            elif has_reviews and has_orders:
                # Merge reviews and orders
                final_recs, final_explanations, final_rankings = merge_recommendations(review_user_recs, orders_user_recs, max_recs=50)
                
                if reviews_model:
                    filtered_recs = reviews_model.filter_not_interested(customer_id, [(p, 1.0) for p in final_recs], pg_conn)
                    final_recs = [p[0] for p in filtered_recs]
                
                final_explanations = enhance_top_3_reasons(final_recs, final_explanations)
                store_recommendations(r_client, customer_id, final_recs, final_explanations, "REVIEWS_ORDERS", final_rankings)
                
            elif has_reviews and has_wishlist:
                # Merge reviews and wishlist: Reviews (85%) > Wishlist (15%)
                all_products = set(review_user_recs.keys()) | set(wishlist_user_recs.keys())
                merged_scores = {}
                merged_sources = {}
                
                for product_id in all_products:
                    review_score = review_user_recs.get(product_id, (0, "", ""))[0]
                    wishlist_score = wishlist_user_recs.get(product_id, (0, "", ""))[0]
                    
                    combined_score = (review_score * 0.85) + (wishlist_score * 0.15)
                    
                    sources = {}
                    if product_id in review_user_recs:
                        sources["REVIEWS"] = (review_score, review_user_recs[product_id][1])
                    if product_id in wishlist_user_recs:
                        sources["WISHLIST"] = (wishlist_score, wishlist_user_recs[product_id][1])
                    
                    merged_scores[product_id] = combined_score
                    merged_sources[product_id] = sources
                
                sorted_products = sorted(merged_scores.items(), key=lambda x: x[1], reverse=True)[:50]
                final_recs = [pid for pid, _ in sorted_products]
                final_explanations = {pid: build_source_explanation(merged_sources[pid]) for pid, _ in sorted_products}
                
                if reviews_model:
                    filtered_recs = reviews_model.filter_not_interested(customer_id, [(p, 1.0) for p in final_recs], pg_conn)
                    final_recs = [p[0] for p in filtered_recs]
                    final_explanations = {pid: final_explanations[pid] for pid in final_recs}
                
                final_rankings = {pid: rank + 1 for rank, pid in enumerate(final_recs)}
                final_explanations = enhance_top_3_reasons(final_recs, final_explanations)
                store_recommendations(r_client, customer_id, final_recs, final_explanations, "REVIEWS_WISHLIST", final_rankings)
                
            elif has_orders and has_wishlist:
                # Merge orders and wishlist: Orders (75%) > Wishlist (25%)
                all_products = set(orders_user_recs.keys()) | set(wishlist_user_recs.keys())
                merged_scores = {}
                merged_sources = {}
                
                for product_id in all_products:
                    order_score = orders_user_recs.get(product_id, (0, "", ""))[0]
                    wishlist_score = wishlist_user_recs.get(product_id, (0, "", ""))[0]
                    
                    combined_score = (order_score * 0.75) + (wishlist_score * 0.25)
                    
                    sources = {}
                    if product_id in orders_user_recs:
                        sources["ORDERS"] = (order_score, orders_user_recs[product_id][1])
                    if product_id in wishlist_user_recs:
                        sources["WISHLIST"] = (wishlist_score, wishlist_user_recs[product_id][1])
                    
                    merged_scores[product_id] = combined_score
                    merged_sources[product_id] = sources
                
                sorted_products = sorted(merged_scores.items(), key=lambda x: x[1], reverse=True)[:50]
                final_recs = [pid for pid, _ in sorted_products]
                final_explanations = {pid: build_source_explanation(merged_sources[pid]) for pid, _ in sorted_products}
                
                if orders_model:
                    filtered_recs = orders_model.filter_not_interested(customer_id, [(p, 1.0) for p in final_recs], pg_conn)
                    final_recs = [p[0] for p in filtered_recs]
                    final_explanations = {pid: final_explanations[pid] for pid in final_recs}
                
                final_rankings = {pid: rank + 1 for rank, pid in enumerate(final_recs)}
                final_explanations = enhance_top_3_reasons(final_recs, final_explanations)
                store_recommendations(r_client, customer_id, final_recs, final_explanations, "ORDERS_WISHLIST", final_rankings)
                
            elif review_user_recs:
                # Only reviews
                sorted_recs = sorted(review_user_recs.items(), key=lambda x: x[1][0], reverse=True)[:50]
                final_recs = [pid for pid, _ in sorted_recs]
                final_explanations = {pid: build_single_source_explanation("REVIEWS", explanation) 
                                     for pid, (score, explanation, _) in sorted_recs}
                
                if reviews_model:
                    filtered_recs = reviews_model.filter_not_interested(customer_id, [(p, 1.0) for p in final_recs], pg_conn)
                    final_recs = [p[0] for p in filtered_recs]
                    final_explanations = {pid: final_explanations[pid] for pid in final_recs}
                
                final_rankings = {pid: rank + 1 for rank, pid in enumerate(final_recs)}
                final_explanations = enhance_top_3_reasons(final_recs, final_explanations)
                store_recommendations(r_client, customer_id, final_recs, final_explanations, "REVIEWS", final_rankings)
                
            elif orders_user_recs:
                # Only orders
                sorted_recs = sorted(orders_user_recs.items(), key=lambda x: x[1][0], reverse=True)[:50]
                final_recs = [pid for pid, _ in sorted_recs]
                final_explanations = {pid: build_single_source_explanation("ORDERS", explanation) 
                                     for pid, (score, explanation, _) in sorted_recs}
                
                if orders_model:
                    filtered_recs = orders_model.filter_not_interested(customer_id, [(p, 1.0) for p in final_recs], pg_conn)
                    final_recs = [p[0] for p in filtered_recs]
                    final_explanations = {pid: final_explanations[pid] for pid in final_recs}
                
                final_rankings = {pid: rank + 1 for rank, pid in enumerate(final_recs)}
                final_explanations = enhance_top_3_reasons(final_recs, final_explanations)
                store_recommendations(r_client, customer_id, final_recs, final_explanations, "ORDERS", final_rankings)
            
            elif wishlist_user_recs:
                # Only wishlist
                sorted_recs = sorted(wishlist_user_recs.items(), key=lambda x: x[1][0], reverse=True)[:50]
                final_recs = [pid for pid, _ in sorted_recs]
                final_explanations = {pid: build_single_source_explanation("WISHLIST", explanation) 
                                     for pid, (score, explanation, _) in sorted_recs}
                
                if wishlist_model:
                    filtered_recs = wishlist_model.filter_not_interested(customer_id, [(p, 1.0) for p in final_recs], pg_conn)
                    final_recs = [p[0] for p in filtered_recs]
                    final_explanations = {pid: final_explanations[pid] for pid in final_recs}
                
                final_rankings = {pid: rank + 1 for rank, pid in enumerate(final_recs)}
                final_explanations = enhance_top_3_reasons(final_recs, final_explanations)
                store_recommendations(r_client, customer_id, final_recs, final_explanations, "WISHLIST", final_rankings)
    
    except Exception as e:
        error_msg = f"❌ Error during recommendation jobs: {str(e)}"
        print(error_msg)
        sentry_sdk.capture_message(error_msg, level="fatal")
        sentry_sdk.capture_exception(e)
        print("📤 Flushing Sentry before exit...")
        sentry_sdk.flush(timeout=5)
        raise e
    
    finally:
        if pg_conn:
            pg_conn.close()
        
        # Ensure Sentry events are sent before process exits
        print("📤 Final Sentry flush...")
        sentry_sdk.flush(timeout=5)
        
        print("\n--- All Recommendation Jobs Finished ---")