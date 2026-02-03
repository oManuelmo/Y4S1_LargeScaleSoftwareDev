import { useState, useEffect } from "react";

interface Review {
  review_id: number;
  product_id: number;
  customer_id: number;
  rating: number;
  reviewed_at: string;
}

interface ReviewsData {
  average_rating: number;
  count: number;
  reviews: Review[];
}

export const useProductReviews = (productId: number) => {
  const [reviewsData, setReviewsData] = useState<ReviewsData | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchReviews = async () => {
      try {
        const apiUrl = import.meta.env.BACKEND_API_URL || 'https://backend-service-381719694047.europe-west3.run.app';
        const res = await fetch(`${apiUrl}/api/v1/reviews/product/${productId}`);
        const json = await res.json();
        
        if (json.success) {
          setReviewsData({
            average_rating: json.average_rating,
            count: json.count,
            reviews: json.reviews
          });
        }
      } catch (error) {
        console.error("Failed to load reviews:", error);
        setReviewsData(null);
      } finally {
        setLoading(false);
      }
    };

    fetchReviews();
  }, [productId]);

  return { reviewsData, loading };
};
