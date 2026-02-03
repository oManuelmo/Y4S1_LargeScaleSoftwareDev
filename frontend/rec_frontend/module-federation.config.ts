import { createModuleFederationConfig } from "@module-federation/rsbuild-plugin";

export default createModuleFederationConfig({
  name: "mips_recommendations",
  filename: 'remoteEntry.js',
  exposes: {
    "./CarouselSection": "./src/pages/CarouselSection.tsx",
    "./RecommendationPage": "./src/pages/Recommendation.tsx",
  },
  shared: {
    react: { 
      singleton: true, 
      requiredVersion: "^18.0.0",
      eager: true,
    },
    "react-dom": { 
      singleton: true, 
      requiredVersion: "^18.0.0",
      eager: true,
    },
    "@emotion/react": { 
      singleton: true, 
      requiredVersion: "^11.0.0",
      eager: true,
    },
    "react-router-dom": { 
      singleton: true, 
      // Make it more flexible
      requiredVersion: ">=6.0.0",
      eager: true,
    },
  },
  dts: false,
});
