FROM node:20-alpine

WORKDIR /app

COPY package*.json ./
RUN npm ci --omit=dev --no-audit --no-fund

COPY db ./db
COPY public ./public
COPY src ./src
COPY README.md ./

ENV NODE_ENV=production
EXPOSE 3000

CMD ["sh", "-c", "npm run db:migrate && npm start"]
