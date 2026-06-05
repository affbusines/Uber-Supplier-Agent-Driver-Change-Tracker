# Use the official Microsoft Playwright image which includes Node.js and all required browser dependencies (Chromium, WebKit, Firefox)
FROM mcr.microsoft.com/playwright:v1.49.0-jammy

# Set the working directory inside the container
WORKDIR /app

# Copy package.json and package-lock.json first to leverage Docker cache
COPY package*.json ./

# Install project dependencies
RUN npm install

# Copy the rest of the application code
COPY . .

# Build the React frontend (Vite) and the backend (esbuild)
RUN npm run build

# Set Node environment to production so it serves the built React app
ENV NODE_ENV=production

# Expose the port your Express server runs on
EXPOSE 3000

# Start the built server
CMD ["npm", "start"]
