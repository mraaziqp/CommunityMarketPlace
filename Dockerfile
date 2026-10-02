# ShareHub: web app + API server in one Node container.
# Needs DATABASE_URL and the other variables in .env.production.example.
# For the EC2 + Caddy setup used in production, see docs/DEPLOYMENT.md.

FROM node:22-alpine AS build
WORKDIR /app
COPY package.json package-lock.json ./
RUN npm ci --no-audit --no-fund
COPY . .
RUN npm test && npm run build

FROM node:22-alpine
ENV NODE_ENV=production PORT=8787
WORKDIR /app
COPY package.json package-lock.json ./
RUN npm ci --omit=dev --no-audit --no-fund
COPY --from=build /app/dist ./dist
COPY --from=build /app/dist-server ./dist-server
COPY --from=build /app/db/migrations ./db/migrations
USER node
EXPOSE 8787
HEALTHCHECK --interval=30s --timeout=5s --start-period=20s --retries=3 \
  CMD wget -qO- http://127.0.0.1:8787/api/health || exit 1
CMD ["node", "dist-server/index.mjs"]
