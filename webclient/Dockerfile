# Use an official Node.js runtime as the base image
FROM node:14-alpine

# Build args
ARG REACT_APP_ENV

# Set the working directory in the container
WORKDIR /app

# Copy package.json and package-lock.json to the working directory
COPY package*.json ./

# Copy tsconfig.json to the working directory
COPY tsconfig.json ./

# Install the app's dependencies
RUN npm install
RUN npm install -g serve

# Copy the source code to the working directory
COPY src/ ./src/

# Copy the public assets to the working directory
COPY public/ ./public/
RUN ls -la /app/src/pages/App.tsx
RUN ls -la /app/src/data/factories/IntentionFactory.ts

# Build the React app for production
RUN if [ "$REACT_APP_ENV" = "main" ]; then \
      npm run build:main; \
    elif [ "$REACT_APP_ENV" = "test" ]; then \
      npm run build:test; \
	else \
      npm run build; \
    fi

# Clean up after build
RUN rm -r package*.json src/ public/

# Expose port 3000 to the outside world
EXPOSE 3000

# Define the command to start the app when the container runs
CMD ["serve", "-s", "build", "-l", "3000"]

