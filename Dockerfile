FROM node:22.22.0-alpine@sha256:e4bf2a82ad0a4037d28035ae71529873c069b13eb0455466ae0bc13363826e34 AS build
WORKDIR /app
COPY package.json package-lock.json ./
RUN npm ci --no-audit --no-fund
COPY index.html streamcard.html styles.css script.js server.js local-db.cjs tailwind.config.cjs font-families.json ./
COPY js ./js
COPY lang ./lang
COPY scripts/build.cjs scripts/tailwind.css ./scripts/
RUN npm run build
FROM node:22.22.0-alpine@sha256:e4bf2a82ad0a4037d28035ae71529873c069b13eb0455466ae0bc13363826e34 AS runtime
WORKDIR /app
ENV NODE_ENV=production PORT=3001 DATA_DIR=/app/data WEB_ROOT=/app/dist
COPY package.json package-lock.json ./
RUN npm ci --omit=dev --no-audit --no-fund && mkdir -p /app/data && chown node:node /app/data
COPY --from=build /app/dist ./dist
COPY server.js local-db.cjs ./
COPY seed ./seed
USER node
EXPOSE 3001
CMD ["node", "server.js"]
