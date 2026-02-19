# ==== Stage 1: Build Admin Panel (frontend-manager) ====
FROM node:20-alpine AS admin-builder

WORKDIR /build
COPY frontend-manager/package*.json ./
RUN npm ci --prefer-offline

COPY frontend-manager/ .
# Override outDir to ./dist (local), avoids path issues in multi-stage context
RUN npx vite build --outDir ./dist

# ==== Stage 2: Python Backend ====
FROM python:3.11-slim

WORKDIR /app

COPY backend/requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

COPY backend/ .

# Copy built Admin Panel into backend/static/
COPY --from=admin-builder /build/dist ./static

RUN mkdir -p data

EXPOSE 17771

CMD ["uvicorn", "main:app", "--host", "0.0.0.0", "--port", "17771", "--workers", "2"]
