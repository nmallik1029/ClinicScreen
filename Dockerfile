# ClinicScreen — Next.js (Node) container for Cloudflare Containers / any Node host.
FROM node:20-bookworm-slim AS deps
WORKDIR /app
COPY package.json package-lock.json ./
RUN npm ci

FROM node:20-bookworm-slim AS build
WORKDIR /app
COPY --from=deps /app/node_modules ./node_modules
COPY . .
RUN npx prisma generate && npm run build

FROM node:20-bookworm-slim AS runner
WORKDIR /app
ENV NODE_ENV=production
ENV PORT=8080
# OpenSSL is needed by the Prisma query engine.
RUN apt-get update && apt-get install -y --no-install-recommends openssl && rm -rf /var/lib/apt/lists/*
COPY --from=build /app/node_modules ./node_modules
COPY --from=build /app/.next ./.next
COPY --from=build /app/public ./public
COPY --from=build /app/prisma ./prisma
COPY --from=build /app/package.json ./package.json
COPY --from=build /app/next.config.mjs ./next.config.mjs
ENV HOSTNAME=0.0.0.0
EXPOSE 8080
# Start fast so the platform's port check passes. Run `prisma migrate deploy`
# as a separate one-off against the DB (see DEPLOY.md), not on boot.
CMD ["sh", "-c", "npx next start -p 8080 -H 0.0.0.0"]
