# Χρησιμοποιούμε την πλήρη εικόνα Node (όχι slim/alpine)
FROM node:20-bookworm

# Εγκατάσταση απαραίτητων πακέτων συστήματος
RUN apt-get update && apt-get install -y \
    build-essential \
    python3 \
    libsodium-dev \
    ffmpeg \
    && rm -rf /var/lib/apt/lists/*

# Φάκελος εργασίας
WORKDIR /usr/src/app

# Αντιγραφή μόνο των αρχείων ρυθμίσεων στην αρχή
COPY package*.json ./

# Εγκατάσταση και ΑΝΑΓΚΑΣΤΙΚΟ rebuild των native βιβλιοθηκών
RUN npm install
RUN npm rebuild sodium-native

# Αντιγραφή του υπόλοιπου κώδικα
COPY . .

# Θύρα Koyeb
EXPOSE 8000

# Εκκίνηση
CMD ["node", "index.js"]
