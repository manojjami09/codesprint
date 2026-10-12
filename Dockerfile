FROM node:20-bookworm-slim

# Install Python 3, OpenJDK, and GCC/G++ for multi-language code evaluation
RUN apt-get update && apt-get install -y --no-install-recommends \
    python3 \
    python-is-python3 \
    default-jdk \
    build-essential \
    && rm -rf /var/lib/apt/lists/*

WORKDIR /app

# Copy dependency manifests
COPY package*.json ./

# Install npm dependencies
RUN npm install

# Copy project source files
COPY . .

# Expose default port (Render will override via PORT env var)
EXPOSE 3000

# Seed database (if fresh) and launch Code Sprint server
CMD ["sh", "-c", "node seed.js && node server.js"]
