FROM node:20-bookworm

# Εγκαθιστούμε τα πάντα για να μην έχει δικαιολογία το σύστημα
RUN apt-get update && apt-get install -y \
    build-essential \
    python3 \
    libsodium-dev \
    ffmpeg \
    && rm -rf /var/lib/apt/lists/*

WORKDIR /usr/src/app

COPY package*.json ./

# Καθαρή εγκατάσταση και "χτίσιμο" των native modules
RUN npm install && npm rebuild sodium-native

COPY . .

EXPOSE 8000

CMD ["node", "index.js"]
