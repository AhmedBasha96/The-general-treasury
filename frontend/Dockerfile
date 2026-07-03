# --- Development Stage ---
FROM node:18-alpine AS dev

WORKDIR /app

# Copy dependency manifests
COPY package*.json ./

# Install dependencies
RUN npm install

# Copy source code
COPY . .

# Expose Vite dev server port
EXPOSE 3000

# Run in dev mode
CMD ["npm", "run", "dev"]


# --- Build Stage for Production ---
FROM node:18-alpine AS build

WORKDIR /app

# Copy dependency manifests and install dependencies
COPY package*.json ./
RUN npm install

# Copy source code and build production files
COPY . .
RUN npm run build


# --- Production Nginx Stage ---
FROM nginx:alpine AS production

# Copy custom Nginx configuration
COPY nginx.conf /etc/nginx/conf.d/default.conf

# Copy build output files to Nginx html directory
COPY --from=build /app/dist /usr/share/nginx/html

# Expose standard HTTP port
EXPOSE 80

# Start Nginx
CMD ["nginx", "-g", "daemon off;"]
