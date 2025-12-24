FROM node:20-bookworm

# Εγκατάσταση των απαραίτητων βιβλιοθηκών συστήματος
RUN apt-get update && apt-get install -y \
    build-essential \
    libsodium-dev \
    ffmpeg \
    && rm -rf /var/lib/apt/lists/*

WORKDIR /usr/src/app
COPY package*.json ./
RUN npm install
COPY . .

CMD ["node", "index.js"]
