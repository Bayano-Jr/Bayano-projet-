FROM node:22-slim

WORKDIR /app

# Install dependencies
COPY package.json package-lock.json* ./
RUN npm ci

# Copy source code
COPY . .

# Build the client application
ARG GEMINI_API_KEY
ENV GEMINI_API_KEY=$GEMINI_API_KEY
RUN npm run build

# Expose the port
EXPOSE 3000

ENV NODE_ENV=production
ENV NODE_OPTIONS="--experimental-strip-types"

# Start the server
CMD ["npm", "start"]
