FROM node:20-bookworm

# Εγκατάσταση απαραίτητων εργαλείων για το sodium-native
RUN apt-get update && apt-get install -y \
    build-essential \
    python3 \
    libsodium-dev \
    ffmpeg \
    && rm -rf /var/lib/apt/lists/*

WORKDIR /usr/src/app
COPY package*.json ./
RUN npm install
COPY . .
CMD ["node", "index.js"]
