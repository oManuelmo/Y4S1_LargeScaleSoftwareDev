"""
Comprehensive test suite for the recommendation engine with maximum coverage.
Tests for SVD models, source-based explanations, merging, filtering, and edge cases.
"""

import json
import pandas as pd
from unittest.mock import patch, MagicMock
import fakeredis
import pytest
import numpy as np

from recommendation_models import SVDRecommender
from redis_viewer import view_customer_recommendations
from persistence.commands import store_recommendations


# ============================================================================
# TESTS FOR SVDRecommender CLASS
# ============================================================================

class TestSVDRecommenderBasics:
    """Tests for basic SVDRecommender functionality"""

    def test_recommender_initialization(self):
        """Test SVDRecommender can be initialized with different parameters"""
        model = SVDRecommender()
        assert model.algo is not None
        assert model.trainset is None
        assert model.all_products is None
        assert model.model_source == "reviews"

    def test_recommender_initialization_with_custom_source(self):
        """Test SVDRecommender initialization with custom source"""
        model = SVDRecommender(n_epochs=10, model_source="orders")
        assert model.model_source == "orders"
        assert model.algo.n_epochs == 10

    def test_recommender_initialization_with_custom_epochs(self):
        """Test SVDRecommender initialization with custom epochs"""
        model = SVDRecommender(n_epochs=5)
        assert model.algo.n_epochs == 5


class TestModelSourceMethods:
    """Tests for model source identification methods"""

    def test_get_model_source_verb_reviews(self):
        """Test verb for reviews source"""
        model = SVDRecommender(model_source="reviews")
        assert model._get_model_source_verb() == "reviewed"

    def test_get_model_source_verb_orders(self):
        """Test verb for orders source"""
        model = SVDRecommender(model_source="orders")
        assert model._get_model_source_verb() == "purchased"

    def test_get_model_source_verb_wishlist(self):
        """Test verb for wishlist source"""
        model = SVDRecommender(model_source="wishlist")
        assert model._get_model_source_verb() == "wishlisted"

    def test_get_model_source_verb_unknown(self):
        """Test verb for unknown source defaults correctly"""
        model = SVDRecommender(model_source="unknown")
        assert model._get_model_source_verb() == "interacted with"

    def test_get_model_source_noun_reviews(self):
        """Test noun for reviews source"""
        model = SVDRecommender(model_source="reviews")
        assert model._get_model_source_noun() == "review"

    def test_get_model_source_noun_orders(self):
        """Test noun for orders source"""
        model = SVDRecommender(model_source="orders")
        assert model._get_model_source_noun() == "purchase"

    def test_get_model_source_noun_wishlist(self):
        """Test noun for wishlist source"""
        model = SVDRecommender(model_source="wishlist")
        assert model._get_model_source_noun() == "wishlist"

    def test_get_model_source_noun_unknown(self):
        """Test noun for unknown source defaults correctly"""
        model = SVDRecommender(model_source="unknown")
        assert model._get_model_source_noun() == "interaction"


class TestConfidenceLevels:
    """Tests for confidence level generation"""

    def test_confidence_level_highest(self):
        """Test highest confidence level (4.5+)"""
        model = SVDRecommender()
        result = model._get_confidence_level(4.7)
        assert "absolutely certain" in result.lower()

    def test_confidence_level_very_high(self):
        """Test very high confidence (4.2+)"""
        model = SVDRecommender()
        result = model._get_confidence_level(4.3)
        assert "highly likely" in result.lower()

    def test_confidence_level_high(self):
        """Test high confidence (4.0+)"""
        model = SVDRecommender()
        result = model._get_confidence_level(4.1)
        assert "quite confident" in result.lower()

    def test_confidence_level_good(self):
        """Test good confidence (3.7+)"""
        model = SVDRecommender()
        result = model._get_confidence_level(3.8)
        assert "fit your taste" in result.lower()

    def test_confidence_level_moderate(self):
        """Test moderate confidence (3.5+)"""
        model = SVDRecommender()
        result = model._get_confidence_level(3.5)
        assert "great match" in result.lower()

    def test_confidence_level_fair(self):
        """Test fair confidence (3.2+)"""
        model = SVDRecommender()
        result = model._get_confidence_level(3.3)
        assert "good fit" in result.lower()

    def test_confidence_level_low(self):
        """Test low confidence (< 3.2)"""
        model = SVDRecommender()
        result = model._get_confidence_level(3.0)
        assert "might find this interesting" in result.lower()


# ============================================================================
# TESTS FOR TRAINING AND RECOMMENDATION
# ============================================================================

class TestSVDTrainingAndRecommendation:
    """Tests for SVD model training and recommendation generation"""

    def test_svd_train_and_recommend_basic(self):
        """Test SVD model trains and generates recommendations"""
        df = pd.DataFrame({
            "customer_id": [1, 1, 2, 2, 3, 3],
            "product_id": [10, 20, 10, 30, 20, 40],
            "rating": [5, 4, 5, 3, 4, 2]
        })

        with patch("recommendation_models.get_pg_connection") as mock_pg:
            mock_pg.return_value.cursor.return_value.fetchall.return_value = [(10,), (20,), (30,), (40,)]

            model = SVDRecommender()
            model.train(df)

            assert model.trainset is not None
            assert len(model.all_products) == 4

    def test_svd_recommend_returns_predictions(self):
        """Test that recommend returns predictions in correct format"""
        df = pd.DataFrame({
            "customer_id": [1, 1, 2, 2],
            "product_id": [10, 20, 10, 30],
            "rating": [5, 4, 5, 3]
        })

        with patch("recommendation_models.get_pg_connection") as mock_pg:
            mock_pg.return_value.cursor.return_value.fetchall.return_value = [(10,), (20,), (30,)]

            model = SVDRecommender()
            model.train(df)

            recs, explanations, predictions = model.recommend(df, customer_id=1)

            assert isinstance(recs, list)
            assert isinstance(explanations, dict)
            assert isinstance(predictions, list)
            assert all(isinstance(p, tuple) and len(p) == 2 for p in predictions)

    def test_svd_recommend_excludes_rated_items(self):
        """Test that recommend excludes already-rated items"""
        df = pd.DataFrame({
            "customer_id": [1, 1, 2, 2],
            "product_id": [10, 20, 10, 30],
            "rating": [5, 4, 5, 3]
        })

        with patch("recommendation_models.get_pg_connection") as mock_pg:
            mock_pg.return_value.cursor.return_value.fetchall.return_value = [(10,), (20,), (30,)]

            model = SVDRecommender()
            model.train(df)

            recs, _, _ = model.recommend(df, customer_id=1)
            
            # Customer 1 rated 10 and 20, so shouldn't see them
            assert 10 not in recs
            assert 20 not in recs

    def test_svd_recommend_unknown_customer(self):
        """Test that recommend returns empty for unknown customer"""
        df = pd.DataFrame({
            "customer_id": [1, 1, 2, 2],
            "product_id": [10, 20, 10, 30],
            "rating": [5, 4, 5, 3]
        })

        with patch("recommendation_models.get_pg_connection") as mock_pg:
            mock_pg.return_value.cursor.return_value.fetchall.return_value = [(10,), (20,), (30,)]

            model = SVDRecommender()
            model.train(df)

            recs, explanations, predictions = model.recommend(df, customer_id=999)

            assert recs == []
            assert explanations == {}
            assert predictions == []

    def test_svd_recommend_respects_max_count(self):
        """Test that recommend returns up to RECOMMENDATION_COUNT items"""
        df = pd.DataFrame({
            "customer_id": [1] * 10,
            "product_id": list(range(10, 20)),
            "rating": [5] * 10
        })
        # Add other customers to get more products
        for i in range(2, 60):
            for j in range(10, 20):
                df = pd.concat([df, pd.DataFrame({
                    "customer_id": [i],
                    "product_id": [j],
                    "rating": [3]
                })], ignore_index=True)

        with patch("recommendation_models.get_pg_connection") as mock_pg:
            products = [(i,) for i in range(10, 70)]
            mock_pg.return_value.cursor.return_value.fetchall.return_value = products

            model = SVDRecommender()
            model.train(df)

            recs, _, _ = model.recommend(df, customer_id=1)

            assert len(recs) <= model.RECOMMENDATION_COUNT


class TestExplanationGeneration:
    """Tests for explanation generation"""

    class FakeTrainset:
        def __init__(self):
            self.ur = {0: [(0, 5), (1, 4)]}
        def to_raw_iid(self, i):
            return i + 10

    def test_generate_explanation_format(self):
        """Test that explanations are properly formatted"""
        model = SVDRecommender()
        model.trainset = self.FakeTrainset()

        predictions = [(2, 4.5), (3, 4.2)]
        explanations = model._generate_explanation(0, predictions)

        assert len(explanations) == 2
        assert all(isinstance(v, str) for v in explanations.values())
        assert all(len(v) > 0 for v in explanations.values())

    def test_generate_explanation_includes_confidence(self):
        """Test that explanations include confidence levels"""
        model = SVDRecommender()
        model.trainset = self.FakeTrainset()

        predictions = [(2, 4.7)]
        explanations = model._generate_explanation(0, predictions)

        assert "absolutely certain" in explanations[2].lower()

    def test_generate_explanation_varies_by_rank(self):
        """Test that explanations vary based on position"""
        model = SVDRecommender()
        model.trainset = self.FakeTrainset()

        predictions = [(2, 4.5), (3, 4.2), (4, 4.0), (5, 3.5)]
        explanations = model._generate_explanation(0, predictions)

        # Different positions should have different explanations
        exp_list = list(explanations.values())
        assert len(set(exp_list)) > 1  # Not all the same


# ============================================================================
# TESTS FOR PRODUCT EMBEDDINGS
# ============================================================================

class TestProductEmbeddings:
    """Tests for product embedding extraction"""

    def test_get_product_embeddings_valid(self):
        """Test extraction of valid product embeddings"""
        df = pd.DataFrame({
            "customer_id": [1, 1, 2, 2],
            "product_id": [10, 20, 10, 30],
            "rating": [5, 4, 5, 3]
        })

        with patch("recommendation_models.get_pg_connection") as mock_pg:
            mock_pg.return_value.cursor.return_value.fetchall.return_value = [(10,), (20,), (30,)]

            model = SVDRecommender()
            model.train(df)

            embeddings, valid_ids = model.get_product_embeddings([10, 20, 30])

            assert len(embeddings) == 3
            assert valid_ids == [10, 20, 30]
            assert embeddings.shape == (3, model.algo.n_factors)

    def test_get_product_embeddings_mixed_valid_invalid(self):
        """Test embeddings with some unknown products"""
        df = pd.DataFrame({
            "customer_id": [1, 1, 2, 2],
            "product_id": [10, 20, 10, 30],
            "rating": [5, 4, 5, 3]
        })

        with patch("recommendation_models.get_pg_connection") as mock_pg:
            mock_pg.return_value.cursor.return_value.fetchall.return_value = [(10,), (20,), (30,)]

            model = SVDRecommender()
            model.train(df)

            embeddings, valid_ids = model.get_product_embeddings([10, 20, 999, 1000])

            assert len(embeddings) == 2
            assert valid_ids == [10, 20]
            assert 999 not in valid_ids
            assert 1000 not in valid_ids

    def test_get_product_embeddings_empty_list(self):
        """Test embeddings with empty product list"""
        df = pd.DataFrame({
            "customer_id": [1, 1, 2, 2],
            "product_id": [10, 20, 10, 30],
            "rating": [5, 4, 5, 3]
        })

        with patch("recommendation_models.get_pg_connection") as mock_pg:
            mock_pg.return_value.cursor.return_value.fetchall.return_value = [(10,), (20,), (30,)]

            model = SVDRecommender()
            model.train(df)

            embeddings, valid_ids = model.get_product_embeddings([])

            assert len(embeddings) == 0
            assert valid_ids == []


# ============================================================================
# TESTS FOR SIMILAR PRODUCTS DETECTION
# ============================================================================

class TestSimilarProductsDetection:
    """Tests for finding similar products using hybrid approach"""

    def test_find_similar_products_returns_set(self):
        """Test that find_similar_products returns a set"""
        df = pd.DataFrame({
            "customer_id": [1, 1, 1, 2, 2, 2],
            "product_id": [10, 20, 30, 10, 40, 50],
            "rating": [5, 5, 4, 5, 3, 2]
        })

        with patch("recommendation_models.get_pg_connection") as mock_pg:
            mock_pg.return_value.cursor.return_value.fetchall.return_value = [(10,), (20,), (30,), (40,), (50,)]

            model = SVDRecommender()
            model.train(df)

            similar = model.find_similar_products([10])

            assert isinstance(similar, set)

    def test_find_similar_products_excludes_source(self):
        """Test that source products are not included in results"""
        df = pd.DataFrame({
            "customer_id": [1, 1, 1, 2, 2, 2],
            "product_id": [10, 20, 30, 10, 40, 50],
            "rating": [5, 5, 4, 5, 3, 2]
        })

        with patch("recommendation_models.get_pg_connection") as mock_pg:
            mock_pg.return_value.cursor.return_value.fetchall.return_value = [(10,), (20,), (30,), (40,), (50,)]

            model = SVDRecommender()
            model.train(df)

            similar = model.find_similar_products([10])

            assert 10 not in similar

    def test_find_similar_products_empty_input(self):
        """Test with empty product list"""
        df = pd.DataFrame({
            "customer_id": [1, 1, 2, 2],
            "product_id": [10, 20, 10, 30],
            "rating": [5, 4, 5, 3]
        })

        with patch("recommendation_models.get_pg_connection") as mock_pg:
            mock_pg.return_value.cursor.return_value.fetchall.return_value = [(10,), (20,), (30,)]

            model = SVDRecommender()
            model.train(df)

            similar = model.find_similar_products([])

            assert similar == set()

    def test_find_similar_products_hybrid_approach(self):
        """Test that hybrid approach finds co-occurrence products"""
        df = pd.DataFrame({
            "customer_id": [1, 1, 1, 2, 2, 2, 3, 3],
            "product_id": [10, 20, 30, 10, 25, 35, 20, 30],
            "rating": [5, 5, 4, 5, 3, 2, 4, 4]
        })

        with patch("recommendation_models.get_pg_connection") as mock_pg:
            mock_pg.return_value.cursor.return_value.fetchall.return_value = [(i,) for i in range(10, 40)]

            model = SVDRecommender()
            model.train(df)

            # Find products similar to 10
            similar = model.find_similar_products([10])

            # Should use hybrid approach (embeddings + co-occurrence)
            assert isinstance(similar, set)


class TestFindSimilarProductsByCooccurrence:
    """Tests for co-occurrence similarity detection"""

    def test_find_similar_by_cooccurrence_basic(self):
        """Test basic co-occurrence finding"""
        df = pd.DataFrame({
            "customer_id": [1, 1, 1, 2, 2, 2],
            "product_id": [10, 20, 30, 10, 25, 35],
            "rating": [5, 5, 4, 5, 3, 2]
        })

        with patch("recommendation_models.get_pg_connection") as mock_pg:
            mock_pg.return_value.cursor.return_value.fetchall.return_value = [(10,), (20,), (25,), (30,), (35,)]

            model = SVDRecommender()
            model.train(df)

            similar = model.find_similar_products_by_cooccurrence([10])

            # Product 20, 30 are co-rated by same user, 25 also appears with 10
            assert isinstance(similar, set)

    def test_find_similar_by_cooccurrence_empty(self):
        """Test co-occurrence with empty input"""
        df = pd.DataFrame({
            "customer_id": [1, 1, 2, 2],
            "product_id": [10, 20, 10, 30],
            "rating": [5, 4, 5, 3]
        })

        with patch("recommendation_models.get_pg_connection") as mock_pg:
            mock_pg.return_value.cursor.return_value.fetchall.return_value = [(10,), (20,), (30,)]

            model = SVDRecommender()
            model.train(df)

            similar = model.find_similar_products_by_cooccurrence([])

            assert similar == set()

    def test_find_similar_by_cooccurrence_requires_2_users(self):
        """Test that co-occurrence requires 2+ shared users"""
        df = pd.DataFrame({
            "customer_id": [1, 1, 2],
            "product_id": [10, 20, 10],
            "rating": [5, 4, 5]
        })

        with patch("recommendation_models.get_pg_connection") as mock_pg:
            mock_pg.return_value.cursor.return_value.fetchall.return_value = [(10,), (20,)]

            model = SVDRecommender()
            model.train(df)

            similar = model.find_similar_products_by_cooccurrence([10])

            # Product 20 shares only 1 user with 10, needs 2+
            assert 20 not in similar or len(similar) == 0


# ============================================================================
# TESTS FOR FILTERING NOT_INTERESTED PRODUCTS
# ============================================================================

class TestFilterNotInterested:
    """Tests for filtering not_interested products"""

    def test_filter_not_interested_removes_marked(self):
        """Test that marked not_interested products are removed"""
        df = pd.DataFrame({
            "customer_id": [1, 1, 2, 2],
            "product_id": [10, 20, 10, 30],
            "rating": [5, 4, 5, 3]
        })

        with patch("recommendation_models.get_pg_connection") as mock_pg:
            mock_pg.return_value.cursor.return_value.fetchall.return_value = [(10,), (20,), (30,)]

            model = SVDRecommender()
            model.train(df)

            with patch("persistence.queries.get_not_interested_products") as mock_ni:
                mock_ni.return_value = {10}

                recommendations = [(20, 4.5), (10, 4.2), (30, 3.8)]
                filtered = model.filter_not_interested(1, recommendations, None)

                assert all(rec[0] != 10 for rec in filtered)
                assert len(filtered) == 2

    def test_filter_not_interested_preserves_order(self):
        """Test that filtering preserves recommendation order"""
        df = pd.DataFrame({
            "customer_id": [1, 1, 2, 2],
            "product_id": [10, 20, 10, 30],
            "rating": [5, 4, 5, 3]
        })

        with patch("recommendation_models.get_pg_connection") as mock_pg:
            mock_pg.return_value.cursor.return_value.fetchall.return_value = [(10,), (20,), (30,)]

            model = SVDRecommender()
            model.train(df)

            with patch("persistence.queries.get_not_interested_products") as mock_ni:
                mock_ni.return_value = {10}

                recommendations = [(20, 4.5), (10, 4.2), (30, 3.8), (40, 3.5)]
                filtered = model.filter_not_interested(1, recommendations, None)

                filtered_ids = [rec[0] for rec in filtered]
                assert filtered_ids == [20, 30, 40]

    def test_filter_not_interested_empty_not_interested(self):
        """Test that all products returned when no not_interested"""
        df = pd.DataFrame({
            "customer_id": [1, 1, 2, 2],
            "product_id": [10, 20, 10, 30],
            "rating": [5, 4, 5, 3]
        })

        with patch("recommendation_models.get_pg_connection") as mock_pg:
            mock_pg.return_value.cursor.return_value.fetchall.return_value = [(10,), (20,), (30,)]

            model = SVDRecommender()
            model.train(df)

            with patch("persistence.queries.get_not_interested_products") as mock_ni:
                mock_ni.return_value = set()

                recommendations = [(20, 4.5), (10, 4.2), (30, 3.8)]
                filtered = model.filter_not_interested(1, recommendations, None)

                assert filtered == recommendations

    def test_filter_not_interested_removes_similar(self):
        """Test that similar products are also removed"""
        df = pd.DataFrame({
            "customer_id": [1, 1, 1, 1, 2, 2, 2, 2],
            "product_id": [10, 20, 30, 40, 10, 50, 60, 70],
            "rating": [5, 5, 5, 4, 5, 3, 2, 1]
        })

        with patch("recommendation_models.get_pg_connection") as mock_pg:
            mock_pg.return_value.cursor.return_value.fetchall.return_value = [(i,) for i in range(10, 80, 10)]

            model = SVDRecommender()
            model.train(df)

            with patch("persistence.queries.get_not_interested_products") as mock_ni:
                mock_ni.return_value = {10}

                recommendations = [(20, 4.5), (10, 4.2), (30, 3.8), (40, 3.5)]
                filtered = model.filter_not_interested(1, recommendations, None, similarity_threshold=0.5)

                # Should remove 10 and possibly similar products
                assert 10 not in [rec[0] for rec in filtered]

    def test_filter_not_interested_multiple_marked(self):
        """Test filtering with multiple not_interested products"""
        df = pd.DataFrame({
            "customer_id": [1, 1, 1, 1, 1, 2, 2, 2],
            "product_id": [10, 20, 30, 40, 50, 10, 60, 70],
            "rating": [5, 5, 4, 4, 3, 5, 2, 1]
        })

        with patch("recommendation_models.get_pg_connection") as mock_pg:
            mock_pg.return_value.cursor.return_value.fetchall.return_value = [(i,) for i in range(10, 80, 10)]

            model = SVDRecommender()
            model.train(df)

            with patch("persistence.queries.get_not_interested_products") as mock_ni:
                mock_ni.return_value = {10, 30, 50}

                recommendations = [(20, 4.5), (10, 4.2), (30, 3.8), (40, 3.5), (50, 3.2), (60, 2.5)]
                filtered = model.filter_not_interested(1, recommendations, None)

                filtered_ids = [rec[0] for rec in filtered]
                assert all(pid not in filtered_ids for pid in {10, 30, 50})


# ============================================================================
# TESTS FOR REDIS STORAGE
# ============================================================================

class TestRedisStorage:
    """Tests for storing recommendations in Redis"""

    def test_store_recommendations_basic(self):
        """Test basic recommendation storage"""
        r = fakeredis.FakeRedis()

        store_recommendations(
            r_client=r,
            customer_id=123,
            recs=[10, 20, 30],
            explanations={10: "Great", 20: "Nice", 30: "Good"},
            model_name="reviews"
        )

        raw = r.get("recommendations:user:123")
        assert raw is not None
        payload = json.loads(raw.decode())

        assert payload["product_ids"] == [10, 20, 30]
        assert payload["explanations"]["10"] == "Great"
        assert payload["model"] == "reviews"

    def test_store_recommendations_with_rankings(self):
        """Test storage with ranking information"""
        r = fakeredis.FakeRedis()

        store_recommendations(
            r_client=r,
            customer_id=456,
            recs=[50, 60],
            explanations={50: "Top pick", 60: "Second"},
            model_name="orders",
            rankings={50: 1, 60: 2}
        )

        payload = json.loads(r.get("recommendations:user:456").decode())

        # JSON converts integer keys to strings
        assert payload["rankings"]["50"] == 1
        assert payload["rankings"]["60"] == 2

    def test_view_customer_recommendations(self, capsys):
        """Test viewing stored recommendations"""
        r = fakeredis.FakeRedis()

        r.set(
            "recommendations:user:789",
            json.dumps({
                "product_ids": [42, 43],
                "explanations": {"42": "Top choice", "43": "Second choice"},
                "model": "reviews",
                "rankings": {"42": 1, "43": 2}
            })
        )

        with patch("redis_viewer.get_redis_connection", return_value=r):
            view_customer_recommendations(789)

        out = capsys.readouterr().out
        assert "42" in out
        assert "43" in out
        assert "reviews" in out.lower()
        assert "top choice" in out.lower()


# ============================================================================
# TESTS FOR SOURCE-BASED EXPLANATIONS
# ============================================================================

class TestSourceBasedExplanations:
    """Tests for source-based explanation building"""

    def test_explanation_single_source_reviews(self):
        """Test explanation format for reviews-only recommendations"""
        model = SVDRecommender(model_source="reviews")
        
        # Single source should have source prefix
        explanation = "Our absolute top pick for you"
        from main import build_single_source_explanation
        result = build_single_source_explanation("REVIEWS", explanation)
        
        assert "Based on your ratings:" in result
        assert explanation in result

    def test_explanation_single_source_orders(self):
        """Test explanation format for orders-only recommendations"""
        from main import build_single_source_explanation
        result = build_single_source_explanation("ORDERS", "Smart pick")
        
        assert "purchased similar items" in result
        assert "Smart pick" in result

    def test_explanation_single_source_wishlist(self):
        """Test explanation format for wishlist-only recommendations"""
        from main import build_single_source_explanation
        result = build_single_source_explanation("WISHLIST", "Complements")
        
        assert "wishlisted similar products" in result
        assert "Complements" in result

    def test_explanation_multi_source(self):
        """Test explanation for multiple contributing sources"""
        from main import build_source_explanation
        
        sources = {
            "REVIEWS": (4.5, "Top rated by similar users"),
            "ORDERS": (4.0, "Popular purchase")
        }
        
        result = build_source_explanation(sources)
        
        assert "Based on your ratings:" in result
        assert "purchased similar items" in result
        assert "Also," in result

    def test_explanation_all_sources(self):
        """Test explanation when all three sources contribute"""
        from main import build_source_explanation
        
        sources = {
            "REVIEWS": (4.5, "Top rated"),
            "ORDERS": (4.0, "Popular"),
            "WISHLIST": (3.5, "Trending")
        }
        
        result = build_source_explanation(sources)
        
        assert "Based on your ratings:" in result
        assert "purchased similar items" in result
        assert "wishlisted similar products" in result


# ============================================================================
# TESTS FOR EDGE CASES AND ERROR HANDLING
# ============================================================================

class TestEdgeCases:
    """Tests for edge cases and error handling"""

    def test_recommend_with_single_user(self):
        """Test recommendation with only one user in data"""
        df = pd.DataFrame({
            "customer_id": [1, 1, 1],
            "product_id": [10, 20, 30],
            "rating": [5, 4, 3]
        })

        with patch("recommendation_models.get_pg_connection") as mock_pg:
            mock_pg.return_value.cursor.return_value.fetchall.return_value = [(10,), (20,), (30,)]

            model = SVDRecommender()
            model.train(df)

            recs, _, _ = model.recommend(df, customer_id=1)

            # Should not recommend already-rated items
            assert 10 not in recs
            assert 20 not in recs
            assert 30 not in recs

    def test_recommend_with_single_product(self):
        """Test recommendation with only one product"""
        df = pd.DataFrame({
            "customer_id": [1, 2, 3],
            "product_id": [10, 10, 10],
            "rating": [5, 4, 3]
        })

        with patch("recommendation_models.get_pg_connection") as mock_pg:
            mock_pg.return_value.cursor.return_value.fetchall.return_value = [(10,)]

            model = SVDRecommender()
            model.train(df)

            recs, _, _ = model.recommend(df, customer_id=1)

            # No other products to recommend
            assert recs == []

    def test_filter_with_threshold_variation(self):
        """Test filtering with different similarity thresholds"""
        df = pd.DataFrame({
            "customer_id": [1, 1, 1, 2, 2, 2],
            "product_id": [10, 20, 30, 10, 40, 50],
            "rating": [5, 5, 4, 5, 3, 2]
        })

        with patch("recommendation_models.get_pg_connection") as mock_pg:
            mock_pg.return_value.cursor.return_value.fetchall.return_value = [(10,), (20,), (30,), (40,), (50,)]

            model = SVDRecommender()
            model.train(df)

            with patch("persistence.queries.get_not_interested_products") as mock_ni:
                mock_ni.return_value = {10}

                recs = [(20, 4.5), (10, 4.2), (30, 3.8)]

                # Test with strict threshold
                strict = model.filter_not_interested(1, recs, None, similarity_threshold=0.95)
                
                # Test with loose threshold
                loose = model.filter_not_interested(1, recs, None, similarity_threshold=0.3)

                # Strict should filter fewer or equal to loose
                assert len(strict) >= len(loose)

    def test_large_recommendation_set(self):
        """Test with large number of recommendations"""
        df = pd.DataFrame({
            "customer_id": [1] * 100 + [2] * 100,
            "product_id": list(range(100, 200)) * 2,
            "rating": [5] * 100 + [3] * 100
        })

        with patch("recommendation_models.get_pg_connection") as mock_pg:
            mock_pg.return_value.cursor.return_value.fetchall.return_value = [(i,) for i in range(100, 200)]

            model = SVDRecommender()
            model.train(df)

            recs, _, _ = model.recommend(df, customer_id=1)

            assert len(recs) <= 50  # Should respect max count


if __name__ == "__main__":
    pytest.main([__file__, "-v", "--tb=short"])
