# Node 24 runs TypeScript directly (type stripping), so there is no build stage.
# Debian slim, not Alpine: httpcloak ships glibc native binaries.
FROM node:24-slim

# httpcloak's Go core verifies TLS against the OS trust store, which slim images don't ship.
RUN apt-get update && apt-get install -y --no-install-recommends ca-certificates \
  && rm -rf /var/lib/apt/lists/*

WORKDIR /app
ENV NODE_ENV=production

COPY package.json .npmrc ./
# No lock file: resolves fresh from package.json on every build.
RUN npm install --omit=dev --no-package-lock && npm cache clean --force

COPY src ./src

USER node
EXPOSE 3000
HEALTHCHECK --interval=30s --timeout=5s --start-period=10s \
  CMD node -e "fetch('http://127.0.0.1:'+(process.env.PORT||3000)+'/health').then(r=>process.exit(r.ok?0:1),()=>process.exit(1))"

CMD ["node", "src/index.ts"]
