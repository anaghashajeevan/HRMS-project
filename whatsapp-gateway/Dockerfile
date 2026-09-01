# Use official Node.js lightweight Alpine image
FROM node:20-alpine

# Set working directory
WORKDIR /app

# Install build dependencies in case native packages are needed
RUN apk add --no-cache python3 make g++

# Copy package manifests first for caching layers
COPY package*.json ./

# Install production dependencies
RUN npm install --production

# Copy the rest of the application files
COPY . .

# Ensure the auth_info folder exists for volume mounting
RUN mkdir -p /app/auth_info

# Expose Gateway Port
EXPOSE 3005

# Set production environment
ENV NODE_ENV=production
ENV PORT=3005

# Start the gateway server
CMD ["node", "server.js"]