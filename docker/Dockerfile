FROM node:22-alpine AS base
RUN apk add --no-cache openssl
WORKDIR /app
ENV NEXT_TELEMETRY_DISABLED=1
# Prisma schema validation/client generation needs a build-only placeholder URL.
ENV DATABASE_URL=postgresql://build:build@127.0.0.1:5432/build?schema=public

FROM base AS deps
COPY package.json package-lock.json* ./
RUN npm install

FROM base AS builder
COPY --from=deps /app/node_modules ./node_modules
COPY . .
RUN npm run db:generate
RUN npm run build

FROM node:22-alpine AS runner
RUN apk add --no-cache openssl
WORKDIR /app
ENV NODE_ENV=production NEXT_TELEMETRY_DISABLED=1 HOSTNAME=0.0.0.0
RUN addgroup --system --gid 1001 nodejs && adduser --system --uid 1001 nextjs
COPY --from=builder /app/public ./public
COPY --from=builder --chown=nextjs:nodejs /app/.next/standalone ./
COPY --from=builder --chown=nextjs:nodejs /app/.next/static ./.next/static
# Include the Prisma schema/migrations and CLI so the container can apply migrations on startup.
COPY --from=builder --chown=nextjs:nodejs /app/prisma ./prisma
COPY --from=builder --chown=nextjs:nodejs /app/node_modules/prisma ./node_modules/prisma
COPY --from=builder --chown=nextjs:nodejs /app/node_modules/@prisma ./node_modules/@prisma
COPY --from=builder --chown=nextjs:nodejs /app/node_modules/.prisma ./node_modules/.prisma
COPY --from=builder --chown=nextjs:nodejs /app/node_modules/.bin/prisma ./node_modules/.bin/prisma
USER nextjs
EXPOSE 3000
ENV PORT=3000
CMD ["sh", "-c", "npx prisma migrate deploy && node server.js"]
