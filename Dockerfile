# Optimasys QR — container voor hosting (Node 22, SQLite op een volume)
FROM node:22-bookworm-slim
WORKDIR /app
ENV NODE_ENV=production DATA_DIR=/data PORT=3000
COPY package.json package-lock.json ./
RUN npm ci && npm cache clean --force
COPY . .
RUN npm run build && npm prune --omit=dev
RUN mkdir -p /data && chown -R node:node /data
USER node
VOLUME ["/data"]
EXPOSE 3000
HEALTHCHECK --interval=30s --timeout=5s CMD node -e "fetch('http://localhost:3000/api/health').then(r=>process.exit(r.ok?0:1)).catch(()=>process.exit(1))"
CMD ["node", "server/index.js"]
