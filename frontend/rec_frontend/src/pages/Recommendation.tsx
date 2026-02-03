import RecProd from "../components/RecProd";
import { useParams } from "react-router-dom";
import { useRecommendations } from "../hooks/useRecommendations";
import React, { useState, useEffect, useRef } from "react";
import "../App.css";

const ITEMS_PER_PAGE = 16;
const ICON_BASE = "https://frontend-service-381719694047.europe-west3.run.app";

const RecommendationPage: React.FC = () => {

  const [arrowLeft, setArrowLeft] = useState(`${ICON_BASE}/arrow_left.svg`);
  const [arrowRight, setArrowRight] = useState(`${ICON_BASE}/arrow_right.svg`);

  const handleProductRemoved = () => {
    setshowPopup(true);
    setTimeout(() => {
      setshowPopup(false);
      window.location.reload();
    }, 2000);
  };

  const [showPopup, setshowPopup] = useState(false);
  const popupRef = useRef<HTMLDivElement | null>(null);
  const { userId } = useParams();

  const [page, setPage] = useState(1);

  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (showPopup && popupRef.current && !popupRef.current.contains(event.target as Node)) {
        setshowPopup(false);
      }
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, [popupRef]);
  
  useEffect(() => {
    window.scrollTo({ top: 0, behavior: "smooth" });
  }, [page]);

  if (!userId || isNaN(Number(userId))) {
    return (
      <div className="p-5 text-center">
        <h1 className="text-3xl font-extrabold text-gray-900 mb-4">404 - Page Not Found</h1>
        <p className="text-gray-700">The user you are looking for does not exist.</p>
      </div>
    );
  }

  const numericUserId = Number(userId);
  const products = useRecommendations(numericUserId);

  const firstThree = products.slice(0, 3);
  const remaining = products.slice(3);

  const paginatedItems = page === 1
    ? remaining.slice(0, ITEMS_PER_PAGE)
    : remaining.slice((page - 1) * ITEMS_PER_PAGE, (page) * ITEMS_PER_PAGE);

  const totalPages = Math.ceil(remaining.length / ITEMS_PER_PAGE);

  const total = products.length;
  if (total === 0) {
    return (
      <div className="py-5 pb-12 h-auto flex flex-col items-center w-full">
        <h2 className="text-3xl font-extrabold mb-8 tracking-tight animate-fadeIn border-b-2" style={{ color: 'inherit' }}>
          Recommended For You
        </h2>
        <div className="text-center w-1/3" style={{ color: 'inherit' }}>
          Sorry, but you still don't have enough activity history to personalize your recommendations...
        </div>
      </div>
    );
  }

  return (
    <div className="p-5 w-full md:w-5/6 mx-auto flex flex-col justify-center mx-auto">
      <h1 className="text-3xl font-extrabold mb-8 tracking-tight animate-fadeIn border-b-2" style={{ color: 'inherit' }}>
        Recommended for You
      </h1>

      {/* FIRST ROW: 3 big products */}
      {page === 1 && (
        <div className="flex flex-col border-b-2 mb-8">
          <p className="w-full text-center font-extrabold tracking-tight text-3xl" style={{ color: 'inherit' }}>
            Top Recommended
          </p>
          <div className="flex scale-110 gap-24 mb-10 mt-10 justify-center">
            {firstThree.map((p) => (
              <RecProd key={p.id} product={p} userId={numericUserId} onRemoved={handleProductRemoved} />
            ))}
          </div>
        </div>
      )}

      {/* STANDARD GRID (12 per page) */}
      <div className="grid gap-10 grid-cols-2 md:grid-cols-3 lg:grid-cols-4">
        {paginatedItems.map((p) => (
          <RecProd key={p.id} product={p} userId={numericUserId} onRemoved={handleProductRemoved} />
        ))}
      </div>

      {/* PAGINATION */}
      <div className="flex justify-center gap-4 mt-10">

        <img
          id="rec-carousel-arrow-left"
          src={arrowLeft}
          onClick={() => setPage((p) => Math.max(1, p - 1))}
          onMouseEnter={() => setArrowLeft(`${ICON_BASE}/arrow_left_hover.svg`)}
          onMouseLeave={() => setArrowLeft(`${ICON_BASE}/arrow_left.svg`)}
          className="w-8 h-8 cursor-pointer hover:scale-120"
          alt="arrow left"
        />
        <span className="text-2xl font-medium" style={{ color: 'inherit', opacity: 0.7 }}>Page {page} / {totalPages}</span>
        <img
          id="rec-carousel-arrow-right"
          src={arrowRight}
          onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
          onMouseEnter={() => setArrowRight(`${ICON_BASE}/arrow_right_hover.svg`)}
          onMouseLeave={() => setArrowRight(`${ICON_BASE}/arrow_right.svg`)}
          className="w-8 h-8 cursor-pointer hover:scale-120"
          alt="arrow left"
        />

      

      </div>

      {showPopup && (
        <div
          ref={popupRef}
          className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 text-center w-[240px] h-[160px] bg-gray-600 text-white p-3 rounded-xl shadow-xl text-[12px] animate-fadeIn z-10"
        >
          Product Removed from Recommendations and Feedback Registered
        </div>
      )}
    </div>
  );
};

export default RecommendationPage;