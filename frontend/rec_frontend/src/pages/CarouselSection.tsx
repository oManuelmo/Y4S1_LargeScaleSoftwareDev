import React, { useState, useEffect, useRef } from "react";
import { useParams, useNavigate } from "react-router-dom";
import RecProd from "../components/RecProd";
import { useRecommendations } from "../hooks/useRecommendations";
import "../App.css";

const ICON_BASE = "https://frontend-service-381719694047.europe-west3.run.app";

const CarouselSection: React.FC = () => {
  const { userId } = useParams();
  if (!userId || isNaN(Number(userId))) {
    return (
      <div className="p-5 text-center">
        <h1 className="text-3xl font-extrabold text-gray-900 mb-4">
          404 - Page Not Found
        </h1>
        <p className="text-gray-700">
          The user you are looking for does not exist.
        </p>
      </div>
    );
  }

  const handleProductRemoved = () => {
    setshowPopup(true)
    setTimeout(() => {
      setshowPopup(false);
      window.location.reload();
    }, 2000);
  };

  const [showPopup, setshowPopup] = useState(false);
  const popupRef = useRef<HTMLDivElement | null>(null);
  const navigate = useNavigate();
  const numericUserId = Number(userId);
  const products = useRecommendations(numericUserId);
  const [arrowLeft, setArrowLeft] = useState(`${ICON_BASE}/arrow_left.svg`);
  const [arrowRight, setArrowRight] = useState(`${ICON_BASE}/arrow_right.svg`);
  const [index, setIndex] = useState(0);

  const [positions, setPositions] = useState<number[]>([-3, -2, -1, 0, 1, 2, 3]);

  useEffect(() => {
    const handleResize = () => {
      const w = window.innerWidth;

      if (w < 500) {
        setPositions([-1, 0, 1]);
      } else if (w < 750) {
        setPositions([-1, 0, 1, 2]);
      } else if (w < 1100) {
        setPositions([-2, -1, 0, 1, 2]);
      } else {
        setPositions([-3, -2, -1, 0, 1, 2, 3]);
      }
    };

    handleResize();
    window.addEventListener("resize", handleResize);

    return () => window.removeEventListener("resize", handleResize);
  }, []);

  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (showPopup && popupRef.current && !popupRef.current.contains(event.target as Node)) {
        setshowPopup(false);
      }
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, [popupRef]);

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

  const handlePrev = () => setIndex((i) => (i - 1 + total) % total);
  const handleNext = () => setIndex((i) => (i + 1) % total);

  const get = (i: number) => products[(i + total) % total];

  const activeRange = (() => {
    const w = window.innerWidth;

    if (w < 500) return [0, 0];
    if (w < 750) return [0, 1];
    return [-1, 1];
  })();

  const visible = positions.map((pos) => ({
    ...get(index + pos),
    offset: pos,
    isActive: pos >= activeRange[0] && pos <= activeRange[1],
    isBehind: pos === positions[0] || pos === positions[positions.length - 1],
  }));  
  return (
    <div className="py-5 h-auto w-full relative">
      <h2 className="text-4xl font-extrabold mb-4 text-center tracking-tight" style={{ color: 'inherit' }}>
        Recommended For You
      </h2>

      <div className="flex flex-col items-center w-full px-8">

        {/* FRAME */}
        <div
          id="rec-carousel-frame"
          className="w-full h-[400px] flex justify-center items-center"
        >
          {visible.map((p) => {
            const w = window.innerWidth;
            let centerOffset = 0;

            if (w >= 500 && w < 750) {
              centerOffset = -115;
            }

            return (
              <div
                key={p.id}
                className={`absolute transition-all duration-500 ease-in-out ${
                  p.isActive ? "pointer-events-auto" : "pointer-events-none"
                }`}
                style={{
                  transform: `translateX(${p.isBehind ? 0 : p.offset * 230 + centerOffset}px) scale(${p.isActive ? 1 : 0.78})`,
                  opacity: p.isActive ? 1 : p.isBehind ? 0 : 0.3,
                  zIndex: p.isActive ? 10 : p.isBehind ? 0 : 5,
                  transition: 'transform 500ms ease-in-out, opacity 500ms ease-in-out',
                  willChange: 'transform, opacity',
                }}
              >
                <RecProd product={p} userId={numericUserId} onRemoved={handleProductRemoved}/>
              </div>
            );
          })}
        </div>

        {/* Arrows and See More */}
        <div className="flex flex-row gap-8">
          <img
            id="rec-carousel-arrow-left"
            src={arrowLeft}
            onClick={handlePrev}
            onMouseEnter={() => setArrowLeft(`${ICON_BASE}/arrow_left_hover.svg`)}
            onMouseLeave={() => setArrowLeft(`${ICON_BASE}/arrow_left.svg`)}
            className="w-8 h-8 cursor-pointer hover:scale-120"
            alt="arrow left"
          />

          <button
            id="rec-see-more-button"
            onClick={() => navigate("/recommendations/user/1")}
            className="text-2xl font-medium transition-all 
                          active:scale-110 hover:scale-110
                          tracking-tight cursor-pointer"
            style={{ color: 'inherit', opacity: 0.7 }}
            onMouseEnter={(e) => e.currentTarget.style.opacity = '1'}
            onMouseLeave={(e) => e.currentTarget.style.opacity = '0.7'}
          >
            See More
          </button>

          <img
            id="rec-carousel-arrow-right"
            src={arrowRight}
            onClick={handleNext}
            onMouseEnter={() => setArrowRight(`${ICON_BASE}/arrow_right_hover.svg`)}
            onMouseLeave={() => setArrowRight(`${ICON_BASE}/arrow_right.svg`)}
            className="w-8 h-8 cursor-pointer hover:scale-120"
            alt="arrow left"
          />
        </div>
      </div>
      {showPopup && (
        <div
          ref={popupRef}
          className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 text-center absolute w-[240px] h-[160]px bg-gray-600 text-white p-3 rounded-xl shadow-xl text-[12px] animate-fadeIn z-10"
        >
          Product Removed from Recommendations and Feedback Registered
        </div>
      )}
    </div>
  );
};

export default CarouselSection;
