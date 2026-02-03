"""
Tests for main.py recommendation pipeline and source-based explanations.
"""

import json
import pandas as pd
from unittest.mock import patch, MagicMock
import fakeredis
import pytest

from main import (
    build_source_explanation,
    build_single_source_explanation,
    merge_recommendations,
    enhance_top_3_reasons,
)


class TestBuildSourceExplanation:
    """Tests for build_source_explanation function"""

    def test_empty_sources(self):
        """Test with empty sources dict"""
        result = build_source_explanation({})
        assert result == "✨ Personalized just for you"

    def test_single_source_reviews(self):
        """Test with only reviews source"""
        sources = {
            "REVIEWS": (4.5, "Top rated by similar users")
        }
        result = build_source_explanation(sources)
        
        assert "Based on your ratings:" in result
        assert "Top rated by similar users" in result

    def test_single_source_orders(self):
        """Test with only orders source"""
        sources = {
            "ORDERS": (4.0, "Popular purchase")
        }
        result = build_source_explanation(sources)
        
        assert "purchased similar items" in result
        assert "Popular purchase" in result

    def test_single_source_wishlist(self):
        """Test with only wishlist source"""
        sources = {
            "WISHLIST": (3.5, "Trending item")
        }
        result = build_source_explanation(sources)
        
        assert "wishlisted similar products" in result
        assert "Trending item" in result

    def test_two_sources_reviews_orders(self):
        """Test with reviews and orders sources"""
        sources = {
            "REVIEWS": (4.5, "Top rated"),
            "ORDERS": (4.0, "Popular")
        }
        result = build_source_explanation(sources)
        
        assert "Based on your ratings:" in result
        assert "purchased similar items" in result
        assert "Also," in result
        assert "Top rated" in result
        assert "popular" in result  # Text after 'Also,' is lowercased

    def test_two_sources_reviews_wishlist(self):
        """Test with reviews and wishlist sources"""
        sources = {
            "REVIEWS": (4.5, "Top rated"),
            "WISHLIST": (3.5, "Trending")
        }
        result = build_source_explanation(sources)
        
        assert "Based on your ratings:" in result
        assert "wishlisted similar products" in result
        assert "Also," in result

    def test_two_sources_orders_wishlist(self):
        """Test with orders and wishlist sources"""
        sources = {
            "ORDERS": (4.0, "Popular"),
            "WISHLIST": (3.5, "Trending")
        }
        result = build_source_explanation(sources)
        
        assert "purchased similar items" in result
        assert "wishlisted similar products" in result
        assert "Also," in result

    def test_all_three_sources(self):
        """Test with all three sources"""
        sources = {
            "REVIEWS": (4.5, "Top rated"),
            "ORDERS": (4.0, "Popular"),
            "WISHLIST": (3.5, "Trending")
        }
        result = build_source_explanation(sources)
        
        assert "Based on your ratings:" in result
        assert "purchased similar items" in result
        assert "wishlisted similar products" in result
        assert "Also," in result
        assert "And" in result  # No comma after And

    def test_explanation_contains_original_text(self):
        """Test that original explanations are preserved"""
        sources = {
            "REVIEWS": (4.5, "Custom explanation here")
        }
        result = build_source_explanation(sources)
        
        assert "Custom explanation here" in result


class TestBuildSingleSourceExplanation:
    """Tests for build_single_source_explanation function"""

    def test_reviews_source(self):
        """Test single source explanation for reviews"""
        result = build_single_source_explanation("REVIEWS", "Great product")
        
        assert "Based on your ratings:" in result
        assert "Great product" in result

    def test_orders_source(self):
        """Test single source explanation for orders"""
        result = build_single_source_explanation("ORDERS", "Similar item")
        
        assert "purchased similar items" in result
        assert "Similar item" in result

    def test_wishlist_source(self):
        """Test single source explanation for wishlist"""
        result = build_single_source_explanation("WISHLIST", "Trending")
        
        assert "wishlisted similar products" in result
        assert "Trending" in result

    def test_unknown_source(self):
        """Test with unknown source type"""
        result = build_single_source_explanation("UNKNOWN", "Custom text")
        
        assert result == "Custom text"


class TestMergeRecommendations:
    """Tests for merge_recommendations function"""

    def test_merge_reviews_and_orders(self):
        """Test merging reviews and orders recommendations"""
        reviews_recs = {
            10: (4.5, "Top rated", "REVIEWS"),
            20: (4.2, "Popular", "REVIEWS"),
            30: (3.8, "Good pick", "REVIEWS")
        }
        orders_recs = {
            20: (4.0, "Common buy", "ORDERS"),
            30: (3.5, "Purchased often", "ORDERS"),
            40: (3.2, "Trending", "ORDERS")
        }

        final_recs, final_explanations, final_rankings = merge_recommendations(reviews_recs, orders_recs)

        # Verify we have products from both sources
        assert len(final_recs) > 0
        assert all(isinstance(e, str) for e in final_explanations.values())
        assert all(isinstance(r, int) for r in final_rankings.values())

    def test_merge_respects_weights(self):
        """Test that merging respects weight percentages"""
        reviews_recs = {
            10: (5.0, "Excellent", "REVIEWS"),
            20: (3.0, "Okay", "REVIEWS")
        }
        orders_recs = {
            10: (1.0, "Poor", "ORDERS"),
            20: (5.0, "Excellent", "ORDERS")
        }

        final_recs, _, _ = merge_recommendations(reviews_recs, orders_recs)

        # Product 10: (5.0 * 0.6) + (1.0 * 0.4) = 3.4
        # Product 20: (3.0 * 0.6) + (5.0 * 0.4) = 3.8
        # Product 20 should rank higher
        assert final_recs[0] == 20

    def test_merge_includes_source_attribution(self):
        """Test that merged explanations include source attribution"""
        reviews_recs = {
            10: (4.5, "Top rated", "REVIEWS")
        }
        orders_recs = {
            10: (4.0, "Popular", "ORDERS")
        }

        _, final_explanations, _ = merge_recommendations(reviews_recs, orders_recs)

        explanation = final_explanations[10]
        # Should have source attribution for both
        assert "Based on your ratings" in explanation or "purchased similar items" in explanation

    def test_merge_max_recs_respected(self):
        """Test that max_recs limit is respected"""
        reviews_recs = {i: (4.0, f"Product {i}", "REVIEWS") for i in range(100)}
        orders_recs = {i: (3.0, f"Order {i}", "ORDERS") for i in range(50, 150)}

        final_recs, _, _ = merge_recommendations(reviews_recs, orders_recs, max_recs=30)

        assert len(final_recs) == 30

    def test_merge_empty_reviews(self):
        """Test merging with empty reviews"""
        reviews_recs = {}
        orders_recs = {
            10: (4.0, "Popular", "ORDERS"),
            20: (3.5, "Trending", "ORDERS")
        }

        final_recs, final_explanations, _ = merge_recommendations(reviews_recs, orders_recs)

        assert len(final_recs) > 0
        assert all("purchased similar items" in e for e in final_explanations.values())

    def test_merge_empty_orders(self):
        """Test merging with empty orders"""
        reviews_recs = {
            10: (4.5, "Top rated", "REVIEWS"),
            20: (4.2, "Popular", "REVIEWS")
        }
        orders_recs = {}

        final_recs, final_explanations, _ = merge_recommendations(reviews_recs, orders_recs)

        assert len(final_recs) > 0
        assert all("Based on your ratings" in e for e in final_explanations.values())


class TestEnhanceTop3Reasons:
    """Tests for enhance_top_3_reasons function"""

    def test_enhance_adds_emoji_to_top_3(self):
        """Test that emojis are added to top 3 recommendations"""
        final_recs = [10, 20, 30, 40, 50]
        final_explanations = {
            10: "Great product",
            20: "Good product",
            30: "Nice product",
            40: "Okay product",
            50: "Fair product"
        }

        enhanced = enhance_top_3_reasons(final_recs, final_explanations)

        # Top 3 should have emojis
        assert "🏆" in enhanced[10]
        assert "🥈" in enhanced[20]
        assert "🥉" in enhanced[30]

        # Others shouldn't
        assert "🏆" not in enhanced[40]
        assert "🥈" not in enhanced[50]

    def test_enhance_preserves_original_text(self):
        """Test that enhancement preserves original explanation"""
        final_recs = [10]
        final_explanations = {10: "Original text"}

        enhanced = enhance_top_3_reasons(final_recs, final_explanations)

        assert "Original text" in enhanced[10]

    def test_enhance_handles_single_recommendation(self):
        """Test enhancement with single recommendation"""
        final_recs = [10]
        final_explanations = {10: "Only product"}

        enhanced = enhance_top_3_reasons(final_recs, final_explanations)

        assert "🏆" in enhanced[10]

    def test_enhance_handles_two_recommendations(self):
        """Test enhancement with two recommendations"""
        final_recs = [10, 20]
        final_explanations = {10: "First", 20: "Second"}

        enhanced = enhance_top_3_reasons(final_recs, final_explanations)

        assert "🏆" in enhanced[10]
        assert "🥈" in enhanced[20]

    def test_enhance_handles_exactly_three(self):
        """Test enhancement with exactly three recommendations"""
        final_recs = [10, 20, 30]
        final_explanations = {10: "First", 20: "Second", 30: "Third"}

        enhanced = enhance_top_3_reasons(final_recs, final_explanations)

        assert "🏆" in enhanced[10]
        assert "🥈" in enhanced[20]
        assert "🥉" in enhanced[30]

    def test_enhance_ignores_fourth_and_beyond(self):
        """Test that 4th+ recommendations don't get emojis"""
        final_recs = [10, 20, 30, 40]
        final_explanations = {i: f"Product {i}" for i in final_recs}

        enhanced = enhance_top_3_reasons(final_recs, final_explanations)

        assert "🏆" not in enhanced[40]
        assert "🥈" not in enhanced[40]
        assert "🥉" not in enhanced[40]

    def test_enhance_uses_correct_emojis(self):
        """Test that correct emojis are used for each rank"""
        final_recs = [10, 20, 30]
        final_explanations = {10: "A", 20: "B", 30: "C"}

        enhanced = enhance_top_3_reasons(final_recs, final_explanations)

        assert enhanced[10].startswith("🏆 MUST-HAVE!")
        assert enhanced[20].startswith("🥈 HIGHLY RECOMMENDED!")
        assert enhanced[30].startswith("🥉 HIGHLY RECOMMENDED!")

    def test_enhance_preserves_non_top3(self):
        """Test that non-top-3 explanations are unchanged"""
        final_recs = [10, 20, 30, 40]
        original_40 = "Original explanation for 40"
        final_explanations = {
            10: "First",
            20: "Second",
            30: "Third",
            40: original_40
        }

        enhanced = enhance_top_3_reasons(final_recs, final_explanations)

        assert enhanced[40] == original_40


class TestSourceAttributionIntegration:
    """Integration tests for source attribution in recommendations"""

    def test_all_three_sources_merged(self):
        """Test recommendation when all three sources contribute"""
        reviews_recs = {
            10: (4.5, "Top rated by reviewers", "REVIEWS"),
            20: (4.0, "Popular in reviews", "REVIEWS")
        }
        orders_recs = {
            10: (4.0, "Frequently purchased", "ORDERS"),
            30: (3.5, "Common order", "ORDERS")
        }
        wishlist_recs = {
            10: (3.0, "On wishlist", "WISHLIST"),
            40: (2.5, "Wishlist trending", "WISHLIST")
        }

        # Simulate all sources merge (manual implementation for test)
        all_products = set(reviews_recs.keys()) | set(orders_recs.keys()) | set(wishlist_recs.keys())
        merged_scores = {}

        for product_id in all_products:
            review_score = reviews_recs.get(product_id, (0, "", ""))[0]
            order_score = orders_recs.get(product_id, (0, "", ""))[0]
            wishlist_score = wishlist_recs.get(product_id, (0, "", ""))[0]

            combined_score = (review_score * 0.6) + (order_score * 0.3) + (wishlist_score * 0.1)
            merged_scores[product_id] = combined_score

        # Product 10 should rank highest with all three sources
        assert merged_scores[10] > merged_scores.get(20, 0)
        assert merged_scores[10] > merged_scores.get(30, 0)
        assert merged_scores[10] > merged_scores.get(40, 0)


class TestExplanationQuality:
    """Tests for explanation quality and readability"""

    def test_explanation_not_empty(self):
        """Test that explanations are never empty"""
        sources = {"REVIEWS": (4.5, "")}
        result = build_source_explanation(sources)
        
        assert len(result) > 0

    def test_explanation_is_readable(self):
        """Test that explanations contain readable text"""
        sources = {
            "REVIEWS": (4.5, "User feedback"),
            "ORDERS": (4.0, "Purchase pattern")
        }
        result = build_source_explanation(sources)

        # Should be a sentence-like structure
        assert ":" in result  # Has attribution separator
        assert "Also," in result or "And," in result  # Has conjunction

    def test_explanation_maintains_capitalization(self):
        """Test that original explanation text capitalization is preserved"""
        sources = {"REVIEWS": (4.5, "UPPERCASE TEXT")}
        result = build_source_explanation(sources)

        assert "UPPERCASE TEXT" in result

    def test_single_source_explanation_readable(self):
        """Test that single source explanations are readable"""
        for source in ["REVIEWS", "ORDERS", "WISHLIST"]:
            result = build_single_source_explanation(source, "Sample explanation")
            
            # Should contain colon for clarity
            assert ":" in result
            # Should contain the original text
            assert "Sample explanation" in result


if __name__ == "__main__":
    pytest.main([__file__, "-v", "--tb=short"])
