# Stage 1: Build
FROM node:22-alpine AS builder
WORKDIR /server
RUN apk add --no-cache python3 make g++ openssl
COPY package*.json ./
COPY prisma ./prisma
# Only download the musl binary needed for Alpine; skip other platforms
ENV PRISMA_CLI_BINARY_TARGETS=linux-musl-openssl-3.0.x
RUN npm install --legacy-peer-deps \
      --fetch-retries=5 \
      --fetch-retry-mintimeout=20000 \
      --fetch-retry-maxtimeout=120000
COPY . .
RUN DATABASE_URL="postgresql://dummy:dummy@localhost/dummy" npx prisma generate
RUN npm run build
# Stage 2: Run
FROM node:22-alpine
WORKDIR /server
ENV PRISMA_CLI_BINARY_TARGETS=linux-musl-openssl-3.0.x
COPY --from=builder /server/package*.json ./
COPY --from=builder /server/node_modules ./node_modules
COPY --from=builder /server/dist ./dist
COPY --from=builder /server/prisma ./prisma
COPY --from=builder /server/prisma.config.ts ./
COPY --from=builder /server/src ./src

EXPOSE 3000
CMD ["npm", "start"]