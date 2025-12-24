FROM node:20-bookworm

# Εγκατάσταση ΟΛΩΝ των πιθανών βιβλιοθηκών κρυπτογράφησης
RUN apt-get update && apt-get install -y \
    build-essential \
    python3 \
    libsodium-dev \
    ffmpeg \
    && rm -rf /var/lib/apt/lists/*

WORKDIR /usr/src/app
COPY package*.json ./
# Εξαναγκασμός σε καθαρή εγκατάσταση
RUN npm cache clean --force
RUN npm install
COPY . .
CMD ["node", "index.js"]
