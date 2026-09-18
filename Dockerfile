# Debian-based (not Alpine) so better-sqlite3's prebuilt binary works
# without needing a full C++ build toolchain in the image.
FROM node:20-bookworm-slim

WORKDIR /app

# Install dependencies first (separate layer) so `docker compose build`
# only re-installs packages when package*.json actually changes, not on
# every code edit.
COPY package.json package-lock.json ./
RUN npm install --omit=dev

COPY . .

# data/ is where SQLite files live (picks.db, sessions.db) - this gets
# overridden by the volume mount in docker-compose.yml so it persists
# across container rebuilds/restarts, but declaring it here documents
# that intent even if someone runs the image without compose.
VOLUME ["/app/data"]

EXPOSE 3000

CMD ["node", "src/server.js"]
