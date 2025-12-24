# Χρησιμοποιούμε μια πλήρη έκδοση της Node (όχι την slim) για να έχουμε τα απαραίτητα εργαλεία
FROM node:20-bookworm

# Εγκατάσταση απαραίτητων εργαλείων συστήματος για την κρυπτογράφηση και τον ήχο
RUN apt-get update && apt-get install -y \
    python3 \
    build-essential \
    libtool \
    autoconf \
    automake \
    libsodium-dev \
    ffmpeg \
    && rm -rf /var/lib/apt/lists/*

# Δημιουργία φακέλου εργασίας
WORKDIR /usr/src/app

# Αντιγραφή του package.json
COPY package*.json ./

# Εγκατάσταση βιβλιοθηκών - Το npm rebuild θα φτιάξει τις βιβλιοθήκες κρυπτογράφησης σωστά
RUN npm install && npm rebuild sodium-native libsodium-wrappers

# Αντιγραφή του υπόλοιπου κώδικα
COPY . .

# Η θύρα του Koyeb
EXPOSE 8000

# Εκκίνηση
CMD [ "node", "index.js" ]
