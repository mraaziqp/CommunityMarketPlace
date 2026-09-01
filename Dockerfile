# ==============================================================================
# Multi-Stage Dockerfile for CommunityMarketPlace
# Optimized for AWS App Runner, Amazon ECS Fargate, AWS Elastic Beanstalk & EC2
# ==============================================================================

# ------------------------------------------------------------------------------
# Stage 1: Build the Vite React Single-Page Application
# ------------------------------------------------------------------------------
FROM node:22-alpine AS builder

WORKDIR /app

# Install dependencies first (layer caching)
COPY package.json package-lock.json* ./
RUN npm ci --prefer-offline --no-audit

# Copy source files
COPY . .

# Build production assets to /app/dist
RUN npm run build

# ------------------------------------------------------------------------------
# Stage 2: Production Nginx Server
# ------------------------------------------------------------------------------
FROM nginx:1.27-alpine-slim

# Copy custom Nginx configuration
COPY nginx.conf /etc/nginx/conf.d/default.conf

# Copy compiled static assets from builder stage
COPY --from=builder /app/dist /usr/share/nginx/html

# Expose standard web port
EXPOSE 80

# Health check for AWS load balancers & container health monitors
HEALTHCHECK --interval=30s --timeout=5s --start-period=5s --retries=3 \
  CMD wget --quiet --tries=1 --spider http://localhost/index.html || exit 1

# Start Nginx in foreground
CMD ["nginx", "-g", "daemon off;"]
