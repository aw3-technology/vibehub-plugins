# Runs the vibehub-mcp server (mcp/) over stdio. Set VIBEHUB_TOKEN to an API
# token from www.vibehub.co → Settings → API tokens; without one the server
# starts and lists its tools, but every tool call fails.
FROM node:22-alpine
WORKDIR /app
COPY mcp/package.json ./
RUN npm install --omit=dev --no-audit --no-fund
COPY mcp/src ./src
ENTRYPOINT ["node", "src/server.js"]
