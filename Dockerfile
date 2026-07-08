FROM node:22-bookworm-slim AS frontend-build
WORKDIR /workspace/frontend
COPY frontend/package*.json ./
RUN npm ci
COPY frontend/ ./
RUN npm run build

FROM node:22-bookworm-slim AS backend-build
WORKDIR /workspace/backend
COPY backend/package*.json ./
RUN npm ci
COPY backend/ ./
RUN npm run build

FROM node:22-bookworm-slim AS runtime
WORKDIR /app

RUN apt-get update \
  && apt-get install -y --no-install-recommends darktable ca-certificates \
  && rm -rf /var/lib/apt/lists/*

ENV NODE_ENV=production \
  PORT=3000 \
  PUBLIC_DIR=/app/public \
  UPLOADS_DIR=/app/uploads \
  RAW_CONVERTER_COMMAND=darktable-cli

COPY backend/package*.json ./
RUN npm ci --omit=dev

COPY --from=backend-build /workspace/backend/dist ./dist
COPY --from=frontend-build /workspace/frontend/dist/frontend/browser ./public

RUN mkdir -p /app/uploads

EXPOSE 3000
CMD ["node", "dist/main.js"]
