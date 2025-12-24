FROM node:20-bookworm

# Εγκατάσταση απαραίτητων εργαλείων κρυπτογράφησης
RUN apt-get update && apt-get install -y \
    build-essential \
    libsodium-dev \
    ffmpeg \
    python3 \
    && rm -rf /var/lib/apt/lists/*

WORKDIR /usr/src/app
COPY package*.json ./
RUN npm install
COPY . .
CMD ["node", "index.js"]
