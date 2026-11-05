# Multi-stage Dockerfile for CloudOps Lab
# Stage 1: Frontend Build
FROM node:20-alpine AS frontend-builder
WORKDIR /build
COPY frontend/package*.json ./
RUN npm ci
COPY frontend/ ./
RUN npm run build

# Stage 2: Production Python Backend + Terraform Runtime
FROM python:3.9-slim

# Install system dependencies, curl, unzip, git, and Terraform CLI
RUN apt-get update && apt-get install -y --no-install-recommends \
    curl \
    unzip \
    git \
    && rm -rf /var/lib/apt/lists/*

# Install official Terraform binary v1.8.5 (supports both amd64 and arm64 architectures)
RUN ARCH=$(dpkg --print-architecture) \
    && curl -fsSL "https://releases.hashicorp.com/terraform/1.8.5/terraform_1.8.5_linux_${ARCH}.zip" -o /tmp/terraform.zip \
    && unzip /tmp/terraform.zip -d /usr/local/bin \
    && rm /tmp/terraform.zip \
    && terraform version

WORKDIR /app

# Copy requirements and install python packages
COPY backend/requirements.txt ./backend/
RUN pip install --no-cache-dir --upgrade pip \
    && pip install --no-cache-dir -r backend/requirements.txt

# Copy backend, infrastructure, and built frontend assets
COPY backend/ ./backend/
COPY infrastructure/ ./infrastructure/
COPY --from=frontend-builder /build/dist ./frontend/dist/

# Set environment
ENV PYTHONPATH=/app
ENV ENV=production
ENV CLOUDOPS_DB_PATH=/app/backend/cloudops.db

EXPOSE 8000

# Healthcheck
HEALTHCHECK --interval=30s --timeout=5s --start-period=5s --retries=3 \
  CMD curl -f http://localhost:8000/health || exit 1

CMD ["uvicorn", "backend.app.main:app", "--host", "0.0.0.0", "--port", "8000"]

