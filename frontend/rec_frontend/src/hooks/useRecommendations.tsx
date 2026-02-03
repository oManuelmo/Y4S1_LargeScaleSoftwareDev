import { useState, useEffect, useMemo } from "react";

export interface Product {
  id: number;
  name: string;
  price: number;
  images?: { url: string }[];
  rating?: number;
  reviewsCount?: number;
  vendor?: { name: string; region: string };
  categories?: { name: string }[];
  recommendationReason?: string;
  reasonProducts?: Array<{ id: number; name?: string; image_url?: string }>;
}

interface RawRecommendation {
  product_id?: number;
  product?: {
    product_id?: number;
    name?: string;
    price?: number;
    image_url?: string;
  };
  reason?: string;
  rank: number;
  reason_products?: Array<{
    product_id?: number;
    name?: string;
    price?: number;
    image_url?: string;
  }>;
  reason_product_id?: number;
  reason_product?:
    | {
        product_id?: number;
        name?: string;
        price?: number;
        image_url?: string;
      }
    | string;
}

export const useRecommendations = (userId: number = 1) => {
  const [rawProducts, setRawProducts] = useState<RawRecommendation[]>([]);

  useEffect(() => {
    const fetchRecommendations = async () => {
      try {
        const apiUrl = import.meta.env.BACKEND_API_URL || 'https://backend-service-381719694047.europe-west3.run.app';
        const res = await fetch(
          `${apiUrl}/api/v1/recommendations/${userId}`
        );
        const json = await res.json();
        if (json.success) {
          console.log("Raw API response:", json);
          console.log("Recommendations count:", json.recommendations?.length);
          if (json.recommendations && json.recommendations.length > 0) {
            console.log("First recommendation full object:", json.recommendations[0]);
            console.log("First recommendation reason:", json.recommendations[0].reason);
            console.log("First recommendation reason_products:", json.recommendations[0].reason_products);
          }
          setRawProducts(json.recommendations);
        }
      } catch (error) {
        console.error("Failed to load recommendations:", error);
      }
    };
    fetchRecommendations();
  }, [userId]);

  const products: Product[] = useMemo(
    () =>
      rawProducts.filter(Boolean).map((r) => {
        const p = r.product;
        const reasonProducts =
          r.reason_products?.map((rp) => ({
            id: rp.product_id ?? 0,
            name: rp.name,
            image_url: rp.image_url,
          })) || [];

        if (reasonProducts.length === 0 && r.reason_product_id) {
          const single = r.reason_product;
          reasonProducts.push({
            id: r.reason_product_id,
            name:
              typeof single === "string"
                ? single
                : single?.name ?? undefined,
            image_url: typeof single === "string" ? undefined : single?.image_url,
          });
        }

        return {
          id: p?.product_id ?? r.product_id ?? 0,
          name: p?.name ?? `Product ${r.product_id ?? "unknown"}`,
          price: p?.price ?? 0,
          images: p?.image_url ? [{ url: p.image_url }] : [],
          recommendationReason: r.reason ?? "",
          reasonProducts: reasonProducts,
          rank: r.rank ?? 0,
        };
      }),
    [rawProducts]
  );

  return products;
};
