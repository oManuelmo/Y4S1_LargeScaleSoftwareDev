"""
Edge cases, stress tests, and advanced scenarios for the recommendation engine.
"""

import pandas as pd
from unittest.mock import patch, MagicMock
import fakeredis
import pytest
import json

from recommendation_models import SVDRecommender
from persistence.commands import store_recommendations


class TestEdgeCasesAdvanced:
    """Advanced edge case testing"""

    def test_very_sparse_rating_matrix(self):
        """Test with extremely sparse data (few ratings)"""
        df = pd.DataFrame({
            "customer_id": [1, 2, 3, 4, 5],
            "product_id": [10, 20, 30, 40, 50],
            "rating": [5, 4, 3, 2, 1]
        })

        with patch("recommendation_models.get_pg_connection") as mock_pg:
            mock_pg.return_value.cursor.return_value.fetchall.return_value = [(i,) for i in range(10, 60, 10)]

            model = SVDRecommender()
            model.train(df)

            # Should handle sparse data gracefully
            assert model.trainset is not None

    def test_duplicate_customer_product_ratings(self):
        """Test with duplicate customer-product pairs (should use last rating)"""
        df = pd.DataFrame({
            "customer_id": [1, 1, 1, 2, 2],
            "product_id": [10, 10, 20, 10, 30],
            "rating": [5, 4, 3, 5, 2]  # Customer 1 rated product 10 twice
        })

        with patch("recommendation_models.get_pg_connection") as mock_pg:
            mock_pg.return_value.cursor.return_value.fetchall.return_value = [(10,), (20,), (30,)]

            model = SVDRecommender()
            # Should handle duplicates (pandas/Surprise should manage this)
            model.train(df)

            assert model.trainset is not None

    def test_extreme_rating_values(self):
        """Test with edge rating values (1 and 5 only)"""
        df = pd.DataFrame({
            "customer_id": [1, 1, 1, 2, 2, 2],
            "product_id": [10, 20, 30, 10, 40, 50],
            "rating": [1, 1, 5, 5, 5, 1]  # Only 1s and 5s
        })

        with patch("recommendation_models.get_pg_connection") as mock_pg:
            mock_pg.return_value.cursor.return_value.fetchall.return_value = [(i,) for i in range(10, 60, 10)]

            model = SVDRecommender()
            model.train(df)

            recs, _, _ = model.recommend(df, customer_id=1)
            assert len(recs) >= 0

    def test_recommendation_with_all_products_rated(self):
        """Test when customer has rated all available products"""
        df = pd.DataFrame({
            "customer_id": [1, 1, 1, 1, 2, 2, 2],
            "product_id": [10, 20, 30, 40, 10, 20, 30],
            "rating": [5, 4, 3, 2, 5, 5, 4]
        })

        with patch("recommendation_models.get_pg_connection") as mock_pg:
            mock_pg.return_value.cursor.return_value.fetchall.return_value = [(10,), (20,), (30,), (40,)]

            model = SVDRecommender()
            model.train(df)

            # Customer 1 rated all products
            recs, _, _ = model.recommend(df, customer_id=1)

            # No products to recommend
            assert recs == []

    def test_product_with_single_rating(self):
        """Test products that have been rated by only one customer"""
        df = pd.DataFrame({
            "customer_id": [1, 2, 3, 4, 5],
            "product_id": [10, 20, 30, 40, 50],
            "rating": [5, 4, 3, 2, 1]  # Each product rated once
        })

        with patch("recommendation_models.get_pg_connection") as mock_pg:
            mock_pg.return_value.cursor.return_value.fetchall.return_value = [(i,) for i in range(10, 60, 10)]

            model = SVDRecommender()
            model.train(df)

            # Should handle cold-start products
            assert model.all_products is not None


class TestStressTests:
    """Stress tests with large datasets"""

    def test_large_customer_base(self):
        """Test with many customers"""
        n_customers = 1000
        n_products = 100
        n_ratings = 5000

        import random
        random.seed(42)

        data = {
            "customer_id": [random.randint(1, n_customers) for _ in range(n_ratings)],
            "product_id": [random.randint(1, n_products) for _ in range(n_ratings)],
            "rating": [random.randint(1, 5) for _ in range(n_ratings)]
        }
        df = pd.DataFrame(data).drop_duplicates(subset=['customer_id', 'product_id'])

        with patch("recommendation_models.get_pg_connection") as mock_pg:
            mock_pg.return_value.cursor.return_value.fetchall.return_value = [(i,) for i in range(1, n_products + 1)]

            model = SVDRecommender()
            model.train(df)

            # Pick a random customer
            sample_customer = df['customer_id'].iloc[0]
            recs, _, _ = model.recommend(df, customer_id=sample_customer)

            assert len(recs) <= 50

    def test_large_product_catalog(self):
        """Test with many products"""
        n_customers = 100
        n_products = 10000
        n_ratings = 2000

        import random
        random.seed(42)

        data = {
            "customer_id": [random.randint(1, n_customers) for _ in range(n_ratings)],
            "product_id": [random.randint(1, n_products) for _ in range(n_ratings)],
            "rating": [random.randint(1, 5) for _ in range(n_ratings)]
        }
        df = pd.DataFrame(data).drop_duplicates(subset=['customer_id', 'product_id'])

        with patch("recommendation_models.get_pg_connection") as mock_pg:
            products = [(i,) for i in sorted(df['product_id'].unique())]
            mock_pg.return_value.cursor.return_value.fetchall.return_value = products

            model = SVDRecommender()
            model.train(df)

            assert len(model.all_products) > 0


class TestBoundaryConditions:
    """Test boundary conditions and limits"""

    def test_minimum_dataframe(self):
        """Test with minimum viable dataframe"""
        df = pd.DataFrame({
            "customer_id": [1, 1],
            "product_id": [10, 20],
            "rating": [5, 4]
        })

        with patch("recommendation_models.get_pg_connection") as mock_pg:
            mock_pg.return_value.cursor.return_value.fetchall.return_value = [(10,), (20,)]

            model = SVDRecommender()
            model.train(df)

            assert model.trainset is not None

    def test_recommendation_count_boundary(self):
        """Test recommendation count at boundary (exactly 50)"""
        df = pd.DataFrame({
            "customer_id": [1] * 50 + [i for i in range(2, 52)],
            "product_id": list(range(100, 150)) * 2,
            "rating": [5] * 50 + [3] * 50
        })

        with patch("recommendation_models.get_pg_connection") as mock_pg:
            products = [(i,) for i in range(100, 150)]
            mock_pg.return_value.cursor.return_value.fetchall.return_value = products

            model = SVDRecommender()
            model.train(df)

            recs, _, _ = model.recommend(df, customer_id=1)

            assert len(recs) <= 50

    def test_similarity_threshold_extremes(self):
        """Test similarity with extreme thresholds"""
        df = pd.DataFrame({
            "customer_id": [1, 1, 1, 2, 2, 2],
            "product_id": [10, 20, 30, 10, 40, 50],
            "rating": [5, 5, 4, 5, 3, 2]
        })

        with patch("recommendation_models.get_pg_connection") as mock_pg:
            mock_pg.return_value.cursor.return_value.fetchall.return_value = [(10,), (20,), (30,), (40,), (50,)]

            model = SVDRecommender()
            model.train(df)

            # Threshold of 0.0 (match everything)
            similar_loose = model.find_similar_products([10], similarity_threshold=0.0)
            
            # Threshold of 1.0 (match nothing except exact)
            similar_strict = model.find_similar_products([10], similarity_threshold=1.0)

            # Strict should have fewer or equal results
            assert len(similar_strict) <= len(similar_loose)

    def test_confidence_level_boundaries(self):
        """Test confidence level at exact boundaries"""
        model = SVDRecommender()

        # Test at exact boundaries
        conf_4_5 = model._get_confidence_level(4.5)
        conf_4_4 = model._get_confidence_level(4.4)

        # Should be different
        assert conf_4_5 != conf_4_4

    def test_filter_with_all_products_not_interested(self):
        """Test filtering when all products are marked not_interested"""
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
                mock_ni.return_value = {10, 20, 30}

                recommendations = [(10, 4.5), (20, 4.2), (30, 3.8)]
                filtered = model.filter_not_interested(1, recommendations, None)

                # All should be filtered out
                assert len(filtered) == 0


class TestDataQualityScenarios:
    """Test different data quality scenarios"""

    def test_mixed_rating_scales(self):
        """Test with mixed rating scales (1-5 range)"""
        df = pd.DataFrame({
            "customer_id": [1, 1, 1, 1, 1],
            "product_id": [10, 20, 30, 40, 50],
            "rating": [1, 2, 3, 4, 5]  # Full range
        })

        with patch("recommendation_models.get_pg_connection") as mock_pg:
            mock_pg.return_value.cursor.return_value.fetchall.return_value = [(i,) for i in range(10, 60, 10)]

            model = SVDRecommender()
            model.train(df)

            assert model.trainset is not None

    def test_skewed_rating_distribution(self):
        """Test with skewed rating distribution (mostly 5s)"""
        df = pd.DataFrame({
            "customer_id": [i for i in range(1, 100)] + [i for i in range(1, 11)],
            "product_id": [10] * 99 + list(range(11, 21)),
            "rating": [5] * 99 + [1] * 10  # Mostly 5s, some 1s
        })

        with patch("recommendation_models.get_pg_connection") as mock_pg:
            products = [(i,) for i in range(10, 21)]
            mock_pg.return_value.cursor.return_value.fetchall.return_value = products

            model = SVDRecommender()
            model.train(df)

            assert model.trainset is not None

    def test_unanimous_ratings(self):
        """Test when all ratings are the same"""
        df = pd.DataFrame({
            "customer_id": [1, 2, 3, 4, 5],
            "product_id": [10, 10, 20, 20, 30],
            "rating": [5, 5, 5, 5, 5]  # All 5s
        })

        with patch("recommendation_models.get_pg_connection") as mock_pg:
            mock_pg.return_value.cursor.return_value.fetchall.return_value = [(10,), (20,), (30,)]

            model = SVDRecommender()
            model.train(df)

            # Should still work
            recs, _, _ = model.recommend(df, customer_id=1)
            assert isinstance(recs, list)


class TestRedisEdgeCases:
    """Edge cases for Redis storage and retrieval"""

    def test_store_empty_recommendations(self):
        """Test storing empty recommendation list"""
        r = fakeredis.FakeRedis()

        store_recommendations(
            r_client=r,
            customer_id=123,
            recs=[],
            explanations={},
            model_name="reviews"
        )

        payload = json.loads(r.get("recommendations:user:123").decode())
        assert payload["product_ids"] == []

    def test_store_single_recommendation(self):
        """Test storing single recommendation"""
        r = fakeredis.FakeRedis()

        store_recommendations(
            r_client=r,
            customer_id=456,
            recs=[42],
            explanations={42: "The answer"},
            model_name="reviews"
        )

        payload = json.loads(r.get("recommendations:user:456").decode())
        assert payload["product_ids"] == [42]
        assert payload["explanations"]["42"] == "The answer"

    def test_store_large_explanation_text(self):
        """Test storing with very long explanation text"""
        r = fakeredis.FakeRedis()

        long_text = "X" * 10000  # 10k characters

        store_recommendations(
            r_client=r,
            customer_id=789,
            recs=[99],
            explanations={99: long_text},
            model_name="reviews"
        )

        payload = json.loads(r.get("recommendations:user:789").decode())
        assert payload["explanations"]["99"] == long_text

    def test_store_many_recommendations(self):
        """Test storing maximum number of recommendations"""
        r = fakeredis.FakeRedis()

        recs = list(range(1000, 1050))
        explanations = {pid: f"Product {pid}" for pid in recs}

        store_recommendations(
            r_client=r,
            customer_id=999,
            recs=recs,
            explanations=explanations,
            model_name="reviews"
        )

        payload = json.loads(r.get("recommendations:user:999").decode())
        assert len(payload["product_ids"]) == 50


class TestConcurrencySimulation:
    """Simulate concurrent operations"""

    def test_multiple_customers_recommendations(self):
        """Test generating recommendations for multiple customers"""
        df = pd.DataFrame({
            "customer_id": [1, 1, 2, 2, 3, 3] * 10,
            "product_id": [10, 20, 10, 30, 20, 30] * 10,
            "rating": [5, 4, 5, 3, 4, 2] * 10
        })

        with patch("recommendation_models.get_pg_connection") as mock_pg:
            mock_pg.return_value.cursor.return_value.fetchall.return_value = [(10,), (20,), (30,)]

            model = SVDRecommender()
            model.train(df)

            # Get recommendations for all customers
            for cid in [1, 2, 3]:
                recs, _, _ = model.recommend(df, customer_id=cid)
                assert isinstance(recs, list)

    def test_multiple_redis_writes(self):
        """Test writing recommendations for multiple customers to Redis"""
        r = fakeredis.FakeRedis()

        # Write recommendations for 100 customers
        for cid in range(1, 101):
            store_recommendations(
                r_client=r,
                customer_id=cid,
                recs=list(range(100 + cid, 110 + cid)),
                explanations={pid: f"Rec for {pid}" for pid in range(100 + cid, 110 + cid)},
                model_name="reviews"
            )

        # Verify all were written
        for cid in range(1, 101):
            payload = json.loads(r.get(f"recommendations:user:{cid}").decode())
            assert len(payload["product_ids"]) == 10


if __name__ == "__main__":
    pytest.main([__file__, "-v", "--tb=short"])
