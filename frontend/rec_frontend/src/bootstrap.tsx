import React from "react";
import ReactDOM from "react-dom/client";
import { BrowserRouter, Routes, Route } from "react-router-dom";

import Carousel from "./pages/CarouselSection";
import RecommendationPage from "./pages/Recommendation";
import App from "./App";

const rootEl = document.getElementById("root");

if (rootEl) {
  const root = ReactDOM.createRoot(rootEl);
  root.render(
    <React.StrictMode>
      <BrowserRouter>
        <Routes>
          <Route path="/" element={<App/>} />
          <Route path="/carousel/user/:userId" element={<Carousel/>} />
          <Route path="/recommendations/user/:userId" element={<RecommendationPage />} />
        </Routes>
      </BrowserRouter>
    </React.StrictMode>
  );
}
