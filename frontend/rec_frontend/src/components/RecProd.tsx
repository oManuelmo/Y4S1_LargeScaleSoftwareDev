import React, { useState, useRef, useEffect } from "react";
import { useProductReviews } from "../hooks/useProductReviews";

interface RecProdProps {
  userId: number;
  product: {
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
    rank?: number;
  };
  onRemoved?: (productId: number) => void;
}


const ICON_BASE = "https://frontend-service-381719694047.europe-west3.run.app";
const BACKEND_BASE = import.meta.env.BACKEND_API_URL || "https://backend-service-381719694047.europe-west3.run.app";

const markNotInterested = async (customerId: number, productId: number) => {
  console.log(customerId, productId)
  try {
    const response = await fetch('https://backend-service-381719694047.europe-west3.run.app/api/v1/not-interested', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        customer_id: customerId,
        product_id: productId,
      }),
    });

    const data = await response.json();

    if (response.ok) {
      console.log('Success:', data.message);
      return true;
    } else {
      console.error('Error:', data.error);
      return false;
    }
  } catch (err) {
    console.error('Network error:', err);
    return false;
  }
};

const RecProd: React.FC<RecProdProps> = ({ product, userId, onRemoved }) => {
  const [showReasonTip, setShowReasonTip] = useState(false);
  const [showNotInterestedTip, setShowNotInterestedTip] = useState(false);
  const [showReason, setShowReason] = useState(false);
  const [showWarning, setShowWarning] = useState(false);
  const wrapperRef = useRef<HTMLDivElement | null>(null);
  const [reasonIcon, setReasonIcon] = useState(`${ICON_BASE}/reason.svg`);
  const [notInterestedIcon, setNotInterestedIcon] = useState(`${ICON_BASE}/not_interested.svg`);
  
  // Fetch real reviews from API
  const { reviewsData } = useProductReviews(product.id);


  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (wrapperRef.current && !wrapperRef.current.contains(event.target as Node)) {
        setShowReason(false);
        setShowWarning(false);
        return;
      }
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, [showReason, showWarning]);

  const imgSrc =
    product.images && product.images.length > 0
      ? product.images[0].url.startsWith("http")
        ? product.images[0].url
        : `${BACKEND_BASE}${product.images[0].url}`
      : "";

  // Replace Product #ID with product names in reason text
  const formatReasonText = (reason: string) => {
    console.log("=== formatReasonText Debug ===");
    console.log("Product ID:", product.id);
    console.log("reasonProducts:", product.reasonProducts);
    console.log("reasonProducts length:", product.reasonProducts?.length);
    console.log("reasonProducts is array:", Array.isArray(product.reasonProducts));
    
    if (!product.reasonProducts || product.reasonProducts.length === 0) {
      console.log("No reason products available for product", product.id);
      return reason;
    }
    
    console.log("Original reason:", reason);
    
    let formattedReason = reason;
    product.reasonProducts.forEach(rp => {
      const productName = rp.name || `Product #${rp.id}`;
      const productUrl = `https://frontend.madeinportugal.store/product/${rp.id}`;
      const regex = new RegExp(`Product\\s*#${rp.id}`, 'gi');
      console.log(`Attempting to replace "Product #${rp.id}" with "${productName}"`);
      formattedReason = formattedReason.replace(regex, `<a href="${productUrl}" class="font-semibold text-yellow-300 underline hover:text-yellow-400 cursor-pointer" target="_blank" rel="noopener noreferrer" onclick="event.stopPropagation();">${productName}</a>`);
    });
    
    console.log("Formatted reason:", formattedReason);
    return formattedReason;
  };

  return (
    <div className="relative flex flex-col items-center justify-center">
      <div ref={wrapperRef}
        className={`
          w-[220px] rounded-xl shadow
          ${showWarning ? "cursor-arrow" : "cursor-pointer"}
        `}
        style={{
          backgroundColor: 'var(--card-bg, #ffffff)',
          color: 'var(--card-text, #111111)',
          transition: 'transform 300ms ease-in-out, box-shadow 300ms ease-in-out',
          willChange: 'transform, box-shadow',
        }}
        onMouseEnter={(e) => {
          e.currentTarget.style.transform = 'translateY(-4px)';
          e.currentTarget.style.boxShadow = '0 20px 25px -5px rgba(0, 0, 0, 0.1), 0 10px 10px -5px rgba(0, 0, 0, 0.04)';
        }}
        onMouseLeave={(e) => {
          e.currentTarget.style.transform = 'translateY(0)';
          e.currentTarget.style.boxShadow = '0 1px 3px 0 rgba(0, 0, 0, 0.1), 0 1px 2px 0 rgba(0, 0, 0, 0.06)';
        }}
        >
        {/* Product Image */}
        <div className="w-full overflow-hidden rounded-t-xl flex-shrink-0" style={{ height: '180px', aspectRatio: '1 / 1' }}>
          {imgSrc ? (
            <img
              src={imgSrc}
              alt={product.name}
              className="w-full h-full object-cover"
            />
          ) : (
            <div className="h-full flex justify-center items-center text-base" style={{ backgroundColor: 'rgba(128, 128, 128, 0.1)', opacity: 0.6 }}>
              No image
            </div>
          )}
        </div>

        <div className="p-3">

          {/* Name */}
          <p
            className="font-bold text-[15px] leading-tight cursor-help line-clamp-2 min-h-[38px]"
            title={product.name}
          >
            {product.name}
          </p>

          {/* Rating */}
          <div className="flex items-center mt-1">
            {/* Stars */}
            <div className="flex">
              {Array.from({ length: 5 }).map((_, i) => {
                const rating = reviewsData?.average_rating || product.rating || 0;
                const filled = i < Math.round(rating);
                return (
                  <svg
                    key={i}
                    className={`w-4 h-4 ${filled ? "text-yellow-400" : "text-gray-300"}`}
                    fill="currentColor"
                    viewBox="0 0 20 20"
                  >
                    <path d="M9.049 2.927c.3-.921 1.603-.921 1.902 0l1.07 3.292a1 1 0 00.95.69h3.462c.969 0 1.371 1.24.588 1.81l-2.8 2.033a1 1 0 00-.364 1.118l1.07 3.292c.3.921-.755 1.688-1.54 1.118l-2.8-2.033a1 1 0 00-1.175 0l-2.8 2.033c-.784.57-1.838-.197-1.539-1.118l1.07-3.292a1 1 0 00-.364-1.118L2.98 8.72c-.783-.57-.38-1.81.588-1.81h3.461a1 1 0 00.951-.69l1.07-3.292z"/>
                  </svg>
                );
              })}
            </div>

            {/* Reviews count */}
            <p className="ml-1 text-sm" style={{ opacity: 0.7 }}>
              ({reviewsData?.count || product.reviewsCount || 0})
            </p>
          </div>

          {/* Vendor */}
          <p className="text-sm mt-1" style={{ opacity: 0.7 }}>
            {product.vendor ? product.vendor.name : "Unknown Vendor"}
          </p>
          <p className="text-[11px]" style={{ opacity: 0.6 }}>
            {product.vendor ? product.vendor.region : "Unknown Region"}
          </p>

          {/* Price + Category */}
          <div className="flex justify-between items-center mt-2">
            <p className="text-[16px] font-bold">
              €{(() => {
                const n = typeof product.price === 'number' ? product.price : parseFloat(String(product.price ?? ''));
                return Number.isFinite(n) ? n.toFixed(2) : '0.00';
              })()}
            </p>

            <span className="text-xs px-2 py-1 rounded-full" style={{ backgroundColor: 'rgba(128, 128, 128, 0.2)', opacity: 0.8 }}>
              {product.categories?.[0]?.name ?? "No Category"}
            </span>
          </div>
          <div className="flex flex-row gap-4 justify-end pr-3">
            {/* Why recommended? */}
            <div className="relative">
              {product.recommendationReason && (
                <img
                  id="rec-reason-icon"
                  src={reasonIcon}
                  alt="Why recommended"
                  className="mt-1 w-5 h-5 cursor-pointer"
                  onMouseEnter={() => {
                    setReasonIcon(`${ICON_BASE}/reason_hover.svg`);
                    setShowReasonTip(true);
                  }}
                  onMouseLeave={() => {
                    setReasonIcon(`${ICON_BASE}/reason.svg`);
                    setShowReasonTip(false);
                  }}
                  onClick={(e) => {
                    e.preventDefault();
                    setShowReason(true);
                  }}
                />
                
              )}
              {showReasonTip && (
              <div className="absolute -top-9 left-1/2 -translate-x-1/2 bg-black text-white text-[10px] px-2 py-1 rounded whitespace-nowrap shadow z-50">
                Why was this recommended?
                {/* Triangle */}
                <div className="absolute -bottom-1 left-1/2 -translate-x-1/2 
                                w-0 h-0 
                                border-l-4 border-r-4 border-t-4 
                                border-l-transparent border-r-transparent border-t-black">
                </div>
              </div>
              )}
            </div>

            {/* Not Interested */}
            <div className="relative">
              <img
                id="rec-not-interested-icon"
                src={notInterestedIcon}
                alt="Not interested"
                className="mt-1 w-5 h-5 cursor-pointer"
                onMouseEnter={() => {
                  setNotInterestedIcon(`${ICON_BASE}/not_interested_hover.svg`);
                  setShowNotInterestedTip(true);
                }}
                onMouseLeave={() => {
                  setNotInterestedIcon(`${ICON_BASE}/not_interested.svg`)
                  setShowNotInterestedTip(false);
                }}
                onClick={(e) => {
                    e.preventDefault();
                    setShowWarning(true);
                  }}
              />
              {showNotInterestedTip && (
                <div className="absolute -top-9 left-1/2 -translate-x-1/2 bg-black text-white text-[10px] px-2 py-1 rounded whitespace-nowrap shadow z-50">
                  Not Interested
                  {/* Triangle */}
                  <div className="absolute -bottom-1 left-1/2 -translate-x-1/2 
                                  w-0 h-0 
                                  border-l-4 border-r-4 border-t-4 
                                  border-l-transparent border-r-transparent border-t-black">
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>

        {/* Reason Bubble */}
        {showReason && product.recommendationReason && (
          <div
            className="absolute w-[220px] h-[180px] top-[0] backdrop-blur-md bg-gray-800/50 text-white p-3 rounded-t-xl shadow-xl text-[12px] animate-fadeIn"
          >
            <div
              className="hover:overflow-y-auto hover:![-webkit-box-orient:unset] hover:![-webkit-line-clamp:unset]"
              style={{
                display: '-webkit-box',
                WebkitLineClamp: 9,
                WebkitBoxOrient: 'vertical',
                textOverflow: 'ellipsis',
                lineHeight: '1.4',
              }}
              dangerouslySetInnerHTML={{ __html: formatReasonText(product.recommendationReason) }}
            />
          </div>
        )}
        {/* Warning Popup */}
        {showWarning && (
          <div
            className="flex flex-col justify-center absolute w-[220px] top-[0] h-full backdrop-blur-md bg-gray-800/50 text-white p-3 rounded-xl shadow-xl text-[12px] animate-fadeIn pointer-events-auto"
          >
            <div>
              <h3 className="font-bold text-xl flex justify-center">
                Not Interested?
              </h3>
              <p className="flex justify-center" >
                This is action is irreversible
              </p>
              <div className="flex flex-col justify-center gap-2 pt-4">
                  <button 
                    id="rec-cancel-remove"
                    className="bg-gray-700 rounded-xl hover:bg-green-800 pb-1 pt-1 pr-3 pl-3 hover:cursor-pointer"
                    onClick={(e) => {
                      e.preventDefault();
                      setShowWarning(false);
                    }}
                    >
                      Keep it
                  </button>
                  <button 
                    id="rec-confirm-remove"
                    className="bg-gray-700 rounded-xl hover:bg-red-800 pb-1 pt-1 pr-3 pl-3 hover:cursor-pointer"
                    onClick={async (e) => {
                      e.preventDefault();
                      const success = await markNotInterested(userId, product.id);
                      if (success && onRemoved) {
                        onRemoved(product.id);
                      }
                    }}
                    >
                      Yes, Remove
                  </button>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

export default RecProd;