FROM node:20-bookworm

# Εγκατάσταση απαραίτητων εργαλείων συστήματος
RUN apt-get update && apt-get install -y \
    build-essential \
    python3 \
    libsodium-dev \
    ffmpeg \
    && rm -rf /var/lib/apt/lists/*

WORKDIR /usr/src/app

COPY package*.json ./
# Εγκατάσταση με build από τα source
RUN npm install --build-from-source

COPY . .

EXPOSE 8080
CMD ["node", "index.js"]
