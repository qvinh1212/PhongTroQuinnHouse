FROM node:22-alpine

WORKDIR /app

COPY package.json ./
RUN npm install --omit=dev

COPY migrations ./migrations
COPY scripts ./scripts
COPY src ./src

EXPOSE 8080

CMD ["sh", "-c", "npm run migrate && npm start"]
