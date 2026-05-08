FROM node:20-slim AS base
WORKDIR /app

# Puppeteer needs system Chromium (slim image doesn't ship it)
RUN apt-get update && apt-get install -y --no-install-recommends \
    chromium \
    fonts-liberation \
    libnss3 libxss1 libasound2 libatk-bridge2.0-0 libgtk-3-0 \
    libdrm2 libgbm1 libxkbcommon0 \
    ca-certificates \
  && rm -rf /var/lib/apt/lists/*

ENV PUPPETEER_SKIP_DOWNLOAD=true \
    PUPPETEER_EXECUTABLE_PATH=/usr/bin/chromium \
    NODE_ENV=production

# ─── deps stage (cache) ───────────────────────────────────────────
FROM base AS deps
COPY package*.json ./
RUN npm ci --omit=dev

# ─── runtime stage ────────────────────────────────────────────────
FROM base AS runner
COPY --from=deps /app/node_modules ./node_modules
COPY package*.json ./
COPY server.js scraper.js auth.js db.js ./
RUN mkdir -p uploads

EXPOSE 4000
HEALTHCHECK --interval=30s --timeout=5s --start-period=20s --retries=3 \
  CMD node -e "fetch('http://localhost:4000/api/health').then(r=>process.exit(r.ok?0:1)).catch(()=>process.exit(1))"

CMD ["node", "server.js"]
