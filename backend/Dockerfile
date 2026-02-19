# ==== 此文件已迁移到项目根目录 Dockerfile ====
# 请使用根目录的 Dockerfile 进行构建
FROM python:3.11-slim

WORKDIR /app

COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

COPY . .

RUN mkdir -p data

EXPOSE 17771

CMD ["uvicorn", "main:app", "--host", "0.0.0.0", "--port", "17771", "--workers", "2"]
