# Use an official Node.js runtime as the base image
FROM node:14-alpine

# Build args
ARG REACT_APP_ENV

# Set the working directory in the container
WORKDIR /app

# Copy package.json and package-lock.json to the working directory
COPY package*.json ./

# Install the app's dependencies
RUN npm install

# Copy the rest of the app's source code to the working directory
COPY . .

# Build the React app for production
RUN if [ "$REACT_APP_ENV" = "main" ]; then \
      npm run build:main; \
    elif [ "$REACT_APP_ENV" = "test" ]; then \
      npm run build:test; \
    fi
RUN npm install -g serve

# Expose port 3000 to the outside world
EXPOSE 3000

# Define the command to start the app when the container runs
CMD ["serve", "-s", "build", "-l", "3000"]

