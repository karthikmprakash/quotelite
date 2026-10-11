# syntax=docker/dockerfile:1

FROM node:22-bookworm-slim AS build
WORKDIR /app
COPY package.json package-lock.json ./
RUN npm ci
COPY index.html vite.config.ts tsconfig.json ./
COPY public ./public
COPY replica/design/tokens.css ./replica/design/tokens.css
COPY src ./src
COPY shared ./shared
COPY server ./server
RUN npm run build

FROM node:22-bookworm-slim
WORKDIR /app
ARG APP_VERSION=0.1.0
ENV NODE_ENV=production \
    HOST=0.0.0.0 \
    PORT=8787 \
    DB_PATH=/app/data/quotelite.sqlite \
    APP_VERSION=$APP_VERSION
RUN apt-get update \
  && apt-get install -y --no-install-recommends ca-certificates \
  && rm -rf /var/lib/apt/lists/* \
  && groupadd --system quotelite \
  && useradd --system --gid quotelite --home /app --shell /usr/sbin/nologin quotelite
COPY package.json package-lock.json ./
RUN npm ci --omit=dev
COPY --from=build /app/dist ./dist
COPY server ./server
COPY shared ./shared
RUN mkdir -p /app/data && chown -R quotelite:quotelite /app
USER quotelite
EXPOSE 8787
HEALTHCHECK --interval=30s --timeout=5s --start-period=20s --retries=3 \
  CMD node -e "fetch('http://127.0.0.1:'+(process.env.PORT||8787)+'/api/health').then(r=>process.exit(r.ok?0:1)).catch(()=>process.exit(1))"
CMD ["npm", "run", "start:prod"]
