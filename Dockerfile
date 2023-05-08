FROM --platform=linux/x86_64 node:16.18.1-bullseye-slim

WORKDIR /opt/app

COPY . .
RUN npm install

CMD ["node", "index.js"]
