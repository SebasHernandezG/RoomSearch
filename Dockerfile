FROM oven/bun:1.4.2 AS build
WORKDIR /app
COPY package.json bun.lock ./
RUN bun install --frozen-lockfile
COPY index.html vite.config.ts tsconfig.json ./
COPY src ./src
ARG VITE_GOOGLE_MAPS_API_KEY=""
ARG VITE_GOOGLE_MAPS_MAP_ID="DEMO_MAP_ID"
RUN bun node_modules/vite/bin/vite.js build

FROM oven/bun:1.4.2 AS dependencies
WORKDIR /app
COPY package.json bun.lock ./
RUN bun install --frozen-lockfile --production

FROM oven/bun:1.4.2 AS runtime
WORKDIR /app
ENV NODE_ENV=production PORT=3000 DB_DATABASE=/app/data/roomies.sqlite
COPY --from=dependencies /app/node_modules ./node_modules
COPY --from=build /app/dist ./dist
COPY src/server ./src/server
COPY package.json ./
RUN mkdir -p /app/data && chown bun:bun /app/data
USER bun
EXPOSE 3000
HEALTHCHECK --interval=30s --timeout=5s --start-period=20s --retries=3 CMD bun -e 'const r = await fetch(`http://127.0.0.1:${process.env.PORT}/api/health`); process.exit(r.ok ? 0 : 1)'
CMD ["bun", "src/server/index.ts"]
