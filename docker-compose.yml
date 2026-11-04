FROM node:22-slim

WORKDIR /app

COPY server/package*.json ./server/
RUN npm --prefix server install --omit=dev

COPY client/dist ./client/dist
COPY server ./server

ENV NODE_ENV=production
EXPOSE 5000

CMD ["node", "server/src/server.js"]
