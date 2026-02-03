import pandas as pd
import numpy as np
from surprise import SVD, Dataset, Reader
from typing import List, Tuple, Dict, Any, Set
from persistence.connections import get_pg_connection
from sklearn.metrics.pairwise import cosine_similarity


class SVDRecommender:
    """
    Generates personalized recommendations based on SVD Matrix Factorization.
    """
    RECOMMENDATION_COUNT = 50
    MAX_EPOCHS = 20
    
    def __init__(self, n_epochs: int = MAX_EPOCHS, model_source: str = "reviews"):
        self.algo = SVD(n_epochs=n_epochs, verbose=False)
        self.trainset = None
        self.all_products = None
        self.model_source = model_source
        self.predictions = []

    def train(self, df):
        reader = Reader(rating_scale=(1, 5))
        data = Dataset.load_from_df(df[['customer_id', 'product_id', 'rating']], reader) 
        self.trainset = data.build_full_trainset()
        self.algo.fit(self.trainset)
        self.all_products = [int(row[0]) for row in self._get_all_products()]
        print(f"✅ {self.model_source.upper()} model trained successfully on {len(df)} interactions.")

    def recommend(self, df: pd.DataFrame, customer_id: int) -> Tuple[List[int], Dict[int, str], List[Tuple]]:
        """
        Returns: (top_product_ids, explanations_dict, predictions_with_scores)
        """
        try:
            inner_user_id = self.trainset.to_inner_uid(customer_id)
        except ValueError:
            return [], {}, []

        rated_items_inner = self.trainset.ur[inner_user_id]
        rated_product_ids = {int(self.trainset.to_raw_iid(i)) for i, _ in rated_items_inner}

        if not rated_product_ids:
            return [], {}, []

        predictions = []
        for product_id in self.all_products:
            if product_id not in rated_product_ids:
                try:
                    est = self.algo.predict(customer_id, product_id).est
                    predictions.append((product_id, est))
                except:
                    continue

        predictions.sort(key=lambda x: x[1], reverse=True)
        self.predictions = predictions
        
        # Return up to 50 recommendations
        top_recs = [pid for pid, _ in predictions[:self.RECOMMENDATION_COUNT]]
        explanations = self._generate_explanation(inner_user_id, predictions[:self.RECOMMENDATION_COUNT])

        return top_recs, explanations, predictions[:self.RECOMMENDATION_COUNT]

    def get_product_embeddings(self, product_ids: List[int]) -> Tuple[np.ndarray, List[int]]:
        """
        Extract product embeddings from trained SVD model.
        Returns: (embeddings array, list of product_ids that were found)
        """
        embeddings = []
        valid_product_ids = []
        
        for product_id in product_ids:
            try:
                inner_id = self.trainset.to_inner_iid(product_id)
                embedding = self.algo.qi[inner_id]
                embeddings.append(embedding)
                valid_product_ids.append(product_id)
            except ValueError:
                # Product not in training set, skip it
                continue
        
        return (np.array(embeddings) if embeddings else np.array([]), valid_product_ids)

    def find_similar_products_by_cooccurrence(self, product_ids: List[int]) -> Set[int]:
        """
        Find products similar to given products by analyzing co-occurrence patterns
        in the training data (users who rated these products also rated similar ones).
        """
        similar_products = set()
        
        if not product_ids or not self.trainset:
            return similar_products
        
        try:
            # For each product to exclude
            for product_id in product_ids:
                try:
                    inner_id = self.trainset.to_inner_iid(product_id)
                except ValueError:
                    continue
                
                # Get all users who rated this product
                users_who_rated = self.trainset.ir[inner_id]  # ir = item ratings (inverse of ur)
                
                if not users_who_rated:
                    continue
                
                # Collect all products rated by these users
                co_rated_products = {}
                for user_inner_id, _ in users_who_rated:
                    user_products = self.trainset.ur[user_inner_id]  # ur = user ratings
                    for product_inner_id, rating in user_products:
                        prod_id = int(self.trainset.to_raw_iid(product_inner_id))
                        if prod_id not in product_ids:  # Don't include the original product
                            co_rated_products[prod_id] = co_rated_products.get(prod_id, 0) + 1
                
                # Add frequently co-rated products (rated by 2+ users who also rated our product)
                for prod_id, frequency in co_rated_products.items():
                    if frequency >= 2:
                        similar_products.add(prod_id)
        
        except Exception as e:
            print(f"⚠️ Error finding similar products by co-occurrence: {e}")
        
        return similar_products

    def find_similar_products(self, product_ids: List[int], similarity_threshold: float = 0.7) -> Set[int]:
        """
        Find products similar to given product_ids using:
        1. SVD embeddings with cosine similarity (if available)
        2. Co-occurrence patterns from training data (fallback/complement)
        
        Uses a hybrid approach to catch similar products from different perspectives.
        """
        if not product_ids or not self.all_products:
            return set()
        
        similar_products = set()
        
        # Strategy 1: SVD Embedding Similarity
        try:
            target_embeddings, valid_target_ids = self.get_product_embeddings(product_ids)
            
            if len(target_embeddings) > 0:
                all_embeddings, valid_all_ids = self.get_product_embeddings(self.all_products)
                
                if len(all_embeddings) > 0:
                    similarities = cosine_similarity(target_embeddings, all_embeddings)
                    
                    for i in range(len(similarities)):
                        # Lower threshold (0.65) for embedding similarity to be more inclusive
                        similar_indices = np.where(similarities[i] >= 0.65)[0]
                        for idx in similar_indices:
                            similar_product_id = valid_all_ids[idx]
                            if similar_product_id not in valid_target_ids:
                                similar_products.add(similar_product_id)
        
        except Exception as e:
            print(f"⚠️ Error finding similar products by SVD embeddings: {e}")
        
        # Strategy 2: Co-occurrence similarity (always run as complement)
        try:
            cooccurrence_similar = self.find_similar_products_by_cooccurrence(product_ids)
            similar_products.update(cooccurrence_similar)
        
        except Exception as e:
            print(f"⚠️ Error finding similar products by co-occurrence: {e}")
        
        return similar_products

    def filter_not_interested(self, customer_id: int, recommendations: List[Tuple], 
                             pg_conn: Any, similarity_threshold: float = 0.7) -> List[Tuple]:
        """
        Filter recommendations by removing not_interested products
        and products similar to them using SVD embeddings.
        
        Args:
            customer_id: Customer ID
            recommendations: List of (product_id, score) tuples
            pg_conn: PostgreSQL connection
            similarity_threshold: Similarity threshold (0-1)
        
        Returns:
            Filtered list of (product_id, score) tuples
        """
        from persistence.queries import get_not_interested_products
        
        # Get explicitly marked not_interested products
        not_interested = get_not_interested_products(pg_conn, customer_id)
        
        if not not_interested:
            return recommendations
        
        # Find similar products
        similar_products = self.find_similar_products(list(not_interested), similarity_threshold)
        
        # Combine both sets
        exclude_ids = not_interested | similar_products
        
        if exclude_ids:
            print(f"   Filtering {len(exclude_ids)} products ({len(not_interested)} marked + {len(similar_products)} similar) for customer {customer_id}")
        
        # Filter recommendations
        filtered = [rec for rec in recommendations if rec[0] not in exclude_ids]
        
        return filtered

    def _get_all_products(self):
        pg_conn = get_pg_connection()
        cursor = pg_conn.cursor()
        cursor.execute("SELECT product_id FROM product;")
        rows = cursor.fetchall()
        cursor.close()
        pg_conn.close()
        return rows

    def _generate_explanation(self, inner_user_id: int, predictions_with_scores: List[Tuple]) -> Dict[int, str]:
        """
        Generate professional, conversational explanations with confidence scores.
        """
        explanations = {}
        try:
            rated_items = [(self.trainset.to_raw_iid(i), r) for i, r in self.trainset.ur[inner_user_id]]
            
            if not rated_items:
                for pid, score in predictions_with_scores:
                    confidence = self._get_confidence_level(score)
                    explanations[pid] = f"Trending item that matches your interests. {confidence}."
                return explanations
            
            top_rated = sorted(rated_items, key=lambda x: x[1], reverse=True)[:5]
            source_verb = self._get_model_source_verb()
            source_noun = self._get_model_source_noun()
            
            for idx, (product_id, predicted_score) in enumerate(predictions_with_scores):
                confidence = self._get_confidence_level(predicted_score)
                
                if top_rated:
                    similar_idx = idx % len(top_rated)
                    similar_prod = top_rated[similar_idx][0]
                    
                    if idx == 0:
                        explanations[product_id] = f"Our absolute top pick for you! Based on your love for Product #{similar_prod}, this is a must-see. {confidence}."
                    elif idx < 3:
                        reasons = [
                            f"Fans of Product #{similar_prod} adore this too. {confidence}.",
                            f"Premium match! You'll appreciate this like Product #{similar_prod}. {confidence}."
                        ]
                        explanations[product_id] = reasons[idx - 1]
                    elif idx < 6:
                        reasons = [
                            f"Following your taste for Product #{similar_prod}. {confidence}.",
                            f"Smart pick based on your {source_noun} of Product #{similar_prod}. {confidence}.",
                            f"Similar vibes to Product #{similar_prod}. Worth exploring! {confidence}."
                        ]
                        explanations[product_id] = reasons[(idx - 3) % len(reasons)]
                    elif idx < 12:
                        reasons = [
                            f"You might discover something new here. Pairs well with Product #{similar_prod}. {confidence}.",
                            f"Complements your interest in Product #{similar_prod}. {confidence}.",
                            f"Part of the same universe as Product #{similar_prod}. {confidence}."
                        ]
                        explanations[product_id] = reasons[(idx - 6) % len(reasons)]
                    else:
                        reasons = [
                            f"Worth a look if you enjoyed Product #{similar_prod}. {confidence}.",
                            f"An interesting option based on your activity. {confidence}.",
                            f"Explore this gem! Related to Product #{similar_prod}. {confidence}."
                        ]
                        explanations[product_id] = reasons[(idx - 12) % len(reasons)]
                else:
                    if idx == 0:
                        explanations[product_id] = f"Our absolute top pick for you. {confidence}."
                    elif idx < 5:
                        reasons = [
                            f"This is trending and perfect for your taste. {confidence}.",
                            f"A standout choice we think you'll love. {confidence}.",
                            f"Getting rave reviews from similar customers. {confidence}."
                        ]
                        explanations[product_id] = reasons[idx - 1]
                    else:
                        explanations[product_id] = f"Recommended based on your preferences. {confidence}."
        
        except Exception as e:
            print(f"Error generating explanations: {e}")
            for pid, score in predictions_with_scores:
                explanations[pid] = "✨ Personalized just for you"

        return explanations

    def _get_confidence_level(self, score: float) -> str:
        """Convert numeric score to conversational confidence label with personality."""
        if score >= 4.5:
            return "We're absolutely certain you'll love this"
        elif score >= 4.2:
            return "Highly likely to be a hit with you"
        elif score >= 4.0:
            return "We're quite confident this will appeal to you"
        elif score >= 3.7:
            return "This should fit your taste really well"
        elif score >= 3.5:
            return "This could be a great match"
        elif score >= 3.2:
            return "This could be a good fit"
        else:
            return "You might find this interesting"

    def _get_model_source_verb(self) -> str:
        """Get past tense verb for action."""
        if self.model_source == "reviews":
            return "reviewed"
        elif self.model_source == "orders":
            return "purchased"
        elif self.model_source == "wishlist":
            return "wishlisted"
        return "interacted with"

    def _get_model_source_noun(self) -> str:
        """Get noun form for 'your X of'."""
        if self.model_source == "reviews":
            return "review"
        elif self.model_source == "orders":
            return "purchase"
        elif self.model_source == "wishlist":
            return "wishlist"
        return "interaction"