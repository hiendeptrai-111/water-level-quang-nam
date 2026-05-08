# ─── Stage 1: build ────────────────────────────────────────────
FROM node:20-alpine AS builder
WORKDIR /app

COPY package*.json ./
RUN npm ci

COPY . .

# Vite reads VITE_* vars at build time; pass via build arg
ARG VITE_API_URL=http://localhost:4000
ENV VITE_API_URL=$VITE_API_URL
RUN npm run build

# ─── Stage 2: nginx ────────────────────────────────────────────
FROM nginx:1.27-alpine AS runner
COPY nginx.conf /etc/nginx/conf.d/default.conf
COPY --from=builder /app/dist /usr/share/nginx/html

EXPOSE 80
# nginx:alpine không có curl/wget mặc định, dùng nc thay thế
HEALTHCHECK --interval=30s --timeout=3s --retries=3 \
  CMD nc -z localhost 80 || exit 1

CMD ["nginx", "-g", "daemon off;"]
