FROM node:20-slim

# Install Playwright system dependencies (all of them to avoid missing libs)
RUN apt-get update && apt-get install -y --no-install-recommends \
    libnss3 libnspr4 libdbus-1-3 libatk1.0-0 libatk-bridge2.0-0 \
    libcups2 libdrm2 libxcomposite1 libxdamage1 libxrandr2 libgbm1 \
    libpango-1.0-0 libcairo2 libasound2 libxshmfence1 libx11-xcb1 \
    libxfixes3 libxkbcommon0 \
    && rm -rf /var/lib/apt/lists/*

WORKDIR /app

# Copy package files and install dependencies
COPY package.json package-lock.json* ./
RUN npm ci

# Install Playwright Chromium browser
RUN npx playwright install chromium

# Copy source code
COPY . .

# Build Astro for production
RUN npm run build

# Persist the database
VOLUME /app/data

# Expose the dashboard port
EXPOSE 3000

ENV HOST=0.0.0.0
ENV PORT=3000

# Start scraper cron in background, then Astro server in foreground
CMD ["sh", "-c", "node --import tsx src/start.ts & node dist/server/entry.mjs"]
