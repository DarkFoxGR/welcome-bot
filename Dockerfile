FROM node:20-slim

# Εγκατάσταση μόνο του ffmpeg που είναι απαραίτητο για τον ήχο
RUN apt-get update && apt-get install -y ffmpeg && rm -rf /var/lib/apt/lists/*

WORKDIR /usr/src/app
COPY package*.json ./
RUN npm install
COPY . .

EXPOSE 8080
CMD ["node", "index.js"]
