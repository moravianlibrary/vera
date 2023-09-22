# Use an official Node.js runtime as the base image
FROM node:14-alpine

# Set the working directory in the container
WORKDIR /app

# Copy package.json and package-lock.json to the working directory
COPY package*.json ./

# Install the app's dependencies
RUN npm install

# Copy the rest of the app's source code to the working directory
COPY . .

# Build the React app for production
RUN npm run build

# Expose port 80 to the outside world
EXPOSE 80

# Define the command to start the app when the container runs
CMD ["npm", "start"]

