FROM node:22-alpine

WORKDIR /app

COPY backend/package.json ./
RUN npm install --omit=dev

COPY backend/migrations ./migrations
COPY backend/scripts ./scripts
COPY backend/src ./src
COPY state.js ./state.js

EXPOSE 8080

CMD ["sh", "-c", "npm run migrate && npm start"]
