# Stage 1: Build Frontend
FROM node:18-alpine AS builder
WORKDIR /app

# Copy dependency definitions
COPY package*.json ./

# Install dependencies (use ci for reproducible builds)
# If package-lock.json exists, npm ci is faster and safer
RUN npm ci || npm install

# Copy source code
COPY . .

# Copy postcss config to frontend directory to ensure it's picked up during build
# since we are setting root to 'frontend'
COPY postcss.config.js frontend/

# Build the frontend
# We build the 'frontend' directory specifically, outputting to 'dist' in the root
RUN npx vite build frontend --outDir ../dist --emptyOutDir

# Stage 2: Run Backend
FROM python:3.9-slim
WORKDIR /app

# Set environment variables
ENV PYTHONDONTWRITEBYTECODE=1
ENV PYTHONUNBUFFERED=1
ENV PORT=8080

# Install system dependencies if needed (e.g. for opencv or others)
# RUN apt-get update && apt-get install -y libgl1-mesa-glx && rm -rf /var/lib/apt/lists/*

# Install Python dependencies
COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

# Copy Backend Code
COPY backend ./backend

# Copy Built Frontend Assets from Stage 1
COPY --from=builder /app/dist ./dist

# Copy static assets (history, etc) if they exist in source
# We create the directory structure to ensure it exists
RUN mkdir -p static/history

# Expose port
EXPOSE 8080

# Start Command
# Using uvicorn directly is standard for production FastAPI apps
CMD ["uvicorn", "backend.main:app", "--host", "0.0.0.0", "--port", "8080"]
