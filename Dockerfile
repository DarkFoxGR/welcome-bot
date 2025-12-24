FROM node:20-bookworm

# Εγκατάσταση απαραίτητων εργαλείων για ήχο και κρυπτογράφηση
RUN apt-get update && apt-get install -y ffmpeg libsodium-dev build-essential python3 && rm -rf /var/lib/apt/lists/*

WORKDIR /usr/src/app
COPY package*.json ./
RUN npm install
COPY . .

EXPOSE 8000
CMD ["node", "index.js"]
