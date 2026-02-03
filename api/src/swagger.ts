import swaggerJsdoc from "swagger-jsdoc";

export const swaggerOptions = {
  definition: {
    openapi: "3.0.0",
    info: {
      title: "Recommendations API",
      version: "1.0.0",
      description: "API for product recommendations, sync and catalog",
    },
    servers: [
      {
        url: "http://localhost:8080",
        description: "Local development server",
      },
      {
        url: "https://backend-service-3s5wr3evga-ey.a.run.app/",
        description: "Cloud server",
      },
    ],
  },
  apis: ["./src/**/*.ts"],
};

export const swaggerSpec = swaggerJsdoc(swaggerOptions);