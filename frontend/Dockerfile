FROM node:20-slim

WORKDIR /app

COPY package*.json ./
RUN npm install

COPY . .

EXPOSE 5173

# Run vite with host set to 0.0.0.0 so port forwarding works inside containers
CMD ["npm", "run", "dev", "--", "--host"]
