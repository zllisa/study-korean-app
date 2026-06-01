#!/bin/bash
set -e

echo "==> 构建前端..."
cd frontend
npm install
npm run build
cd ..

echo "==> 组装 deploy/ 目录..."

# 清理旧的 backend 源码（保留 Dockerfile）
rm -rf deploy/backend/src deploy/backend/prisma deploy/backend/package.json

# 复制 backend 源码（不含 node_modules）
cp -r backend/src deploy/backend/src
cp -r backend/prisma deploy/backend/prisma
cp backend/package.json deploy/backend/package.json

# 复制前端构建产物
rm -rf deploy/frontend/dist
cp -r frontend/dist deploy/frontend/dist

echo ""
echo "✅ 完成！deploy/ 目录已就绪"
echo ""
echo "后续步骤："
echo "  1. 将 deploy/ 文件夹上传到服务器"
echo "  2. 在服务器上执行（首次部署）："
echo "       cp .env.example .env && nano .env"
echo ""
echo "  ⚠️  .env 中必填项："
echo "       JWT_SECRET=随机字符串"
echo "       DEEPSEEK_API_KEY=你的key"
echo "       AZURE_SPEECH_KEY=你的key"
echo "       CORS_ORIGIN=http://你的服务器IP:9999"
echo ""
echo "  3. docker compose up -d --build"
