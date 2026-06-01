FROM node:20-alpine

# Prisma 引擎依赖 OpenSSL 和 libc6-compat
RUN apk add --no-cache openssl libc6-compat

WORKDIR /app

COPY package.json ./
RUN npm install --production && npm install prisma --save-dev

COPY . .
RUN npx prisma generate

EXPOSE 4000

# prisma db push 失败不影响 node 启动
CMD ["sh", "-c", "npx prisma db push --skip-generate 2>/dev/null || true; node src/index.js"]
