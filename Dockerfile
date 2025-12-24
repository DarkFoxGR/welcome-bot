# Χρησιμοποιούμε την έκδοση 20 της Node
FROM node:20

# Δημιουργία φακέλου εργασίας
WORKDIR /usr/src/app

# Αντιγραφή των αρχείων ρυθμίσεων
COPY package*.json ./

# Εγκατάσταση των βιβλιοθηκών (εδώ θα φτιάξει μόνο του το lockfile)
RUN npm install

# Αντιγραφή όλου του κώδικα
COPY . .

# Η θύρα που χρησιμοποιεί το Koyeb
EXPOSE 8000

# Εκκίνηση του bot
CMD [ "node", "index.js" ]
