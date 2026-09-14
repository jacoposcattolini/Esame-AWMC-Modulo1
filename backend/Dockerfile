FROM node:20-bookworm-slim

WORKDIR /app

# build tools: servono a compilare il modulo nativo bcrypt quando non c'e' un prebuild
RUN apt-get update && apt-get install -y --no-install-recommends python3 make g++ \
    && rm -rf /var/lib/apt/lists/*

COPY package*.json ./
RUN npm install --omit=dev

COPY . .

EXPOSE 3000
CMD ["node", "src/server.js"]
