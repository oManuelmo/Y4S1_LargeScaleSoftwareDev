FROM node:25-alpine3.21

WORKDIR /app

COPY package.json ./
RUN npm install

COPY . .

# Set environment variables during build
ENV PUBLIC_URL=https://frontend-service-381719694047.europe-west3.run.app/
ENV ASSET_PREFIX=https://frontend-service-381719694047.europe-west3.run.app/

RUN npm run build

RUN npm install -g serve

EXPOSE 3000

CMD ["serve", "-s", "dist", "-l", "3000", "--single", "--cors"]