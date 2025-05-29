# Step 1: Build the app using Node
FROM node:23-alpine as builder

# Set the working directory
WORKDIR /app

# Copy package.json and package-lock.json to the working directory
COPY package*.json ./

# Copy tsconfig.json to the working directory
COPY tsconfig.json ./

# Install the app's dependencies
RUN npm install

# Copy the rest of the application code to the working directory
COPY vite.config.ts .
COPY index.html .
COPY src/ ./src/
COPY public/ ./public/
COPY .env .

# Build the React app for production
RUN npm run build

# Step 2: Use a lightweight Nginx container to serve the files
FROM nginx:alpine

# Build args
ENV ASSET_DIR=/var/www/html
ENV APP_PREFIX=VERA_VITE_

# Copy Nginx config
COPY ./nginx.conf /etc/nginx/nginx.conf

# Copy the built app from the builder stage
COPY --from=builder /app/dist /var/www/html/

# Copy the runtime injection script into the container
COPY env.sh /docker-entrypoint.d/env.sh
RUN chmod +x /docker-entrypoint.d/env.sh

# Let Docker run your script before starting Nginx
ENTRYPOINT ["/docker-entrypoint.sh"]
CMD ["nginx", "-g", "daemon off;"]
