# Stage 1: Dependencies (argon2 cần toolchain native trên Alpine)
FROM node:20-alpine AS deps
RUN apk add --no-cache python3 make g++ libc6-compat
WORKDIR /app
COPY package.json package-lock.json* ./
RUN npm ci --omit=dev 2>/dev/null || npm install --omit=dev

# Stage 2: Runner
FROM node:20-alpine AS runner
RUN apk add --no-cache libc6-compat
WORKDIR /app

ENV NODE_ENV=production

RUN addgroup --system --gid 1001 nodejs \
  && adduser --system --uid 1001 nodejs

COPY --from=deps /app/node_modules ./node_modules
COPY package.json ./
COPY app.js ./
COPY views ./views
COPY public ./public

RUN mkdir -p uploads public/translations \
  && chown -R nodejs:nodejs /app

USER nodejs

EXPOSE 3000
ENV PORT=3000
ENV HOST=0.0.0.0

ENTRYPOINT []
CMD ["node", "app.js"]
