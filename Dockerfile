FROM node:22-slim
WORKDIR /app
COPY package.json ./
RUN npm install
COPY . .
EXPOSE 3000
RUN mkdir -p /data
VOLUME /data
CMD ["node", "server.js"]
