# Docker 项目部署指南（腾讯云 + Nginx HTTPS）

> 基于实战总结，适用于：前端 Nginx 容器 + 后端 Node 容器，通过宿主机 Nginx 反向代理提供 HTTPS 访问。

---

## 整体架构

```
用户浏览器
    │
    ▼ https://aiphototo.com:端口
宿主机 Nginx (SSL 终止)
    │
    ▼ http://127.0.0.1:内部端口
Docker 容器 (Nginx/Node)
    ├── frontend (Nginx 容器，提供静态文件 + API 代理)
    └── backend  (Node 容器，提供 API 服务)
```

**关键思路**：HTTPS 由宿主机 Nginx 统一处理，容器内部只跑 HTTP，无需在容器内处理证书。

---

## 一、项目目录结构

```
project/
├── docker-compose.yml
├── .env                    # 后端环境变量（API Key 等）
├── backend/
│   ├── Dockerfile
│   ├── package.json
│   ├── prisma/
│   │   └── schema.prisma
│   └── src/
│       └── index.js
└── frontend/
    ├── Dockerfile
    ├── nginx.conf          # 容器内 nginx 配置（HTTP 代理到后端）
    └── dist/               # 打包好的前端静态文件
```

---

## 二、各文件模板

### 1. `docker-compose.yml`

```yaml
services:
  backend:
    build:
      context: ./backend
    env_file: .env
    environment:
      PORT: 4000
      DATABASE_URL: "file:/data/prod.db"
      # ⚠️ 务必加上前端 HTTPS 访问地址，否则 CORS 拦截
      FRONTEND_URL: "https://你的域名:端口"
    volumes:
      - db_data:/data
    restart: unless-stopped

  frontend:
    build:
      context: ./frontend
    # 仅绑定本机，由宿主机 Nginx 反向代理
    ports:
      - "127.0.0.1:内部端口:80"
    depends_on:
      - backend
    restart: unless-stopped

volumes:
  db_data:
```

**要点**：
- `ports` 用 `127.0.0.1:端口:80`，只允许本机访问，外部流量走宿主机 Nginx
- `FRONTEND_URL` 必须配成 HTTPS 地址，否则后端 CORS 拦截
- `version` 字段已废弃，可以不写

### 2. `backend/Dockerfile`

```dockerfile
FROM node:20-alpine

# ⚠️ Prisma 引擎依赖 OpenSSL 和 libc6-compat，Alpine 镜像默认没有
RUN apk add --no-cache openssl libc6-compat

WORKDIR /app

COPY package.json ./
RUN npm install --production && npm install prisma --save-dev

COPY . .
RUN npx prisma generate

EXPOSE 4000

# db push 失败不影响 node 启动（用 || true）
CMD ["sh", "-c", "npx prisma db push --skip-generate 2>/dev/null || true; node src/index.js"]
```

**踩坑记录**：
- **不装 OpenSSL** → `prisma db push` 报 `Could not parse schema engine response`，容器崩溃重启 → 前端 502
- **CMD 用 `&&` 连接** → `prisma db push` 失败会导致 `node` 不启动 → 改用 `|| true;` 隔离

### 3. `frontend/Dockerfile`

```dockerfile
FROM nginx:alpine

COPY dist /usr/share/nginx/html
COPY nginx.conf /etc/nginx/conf.d/default.conf

EXPOSE 80
```

### 4. `frontend/nginx.conf`

```nginx
server {
    listen 80;

    root /usr/share/nginx/html;
    index index.html;

    location /api/ {
        proxy_pass http://backend:4000/api/;
        proxy_http_version 1.1;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
    }

    location / {
        try_files $uri $uri/ /index.html;
    }
}
```

**要点**：
- `proxy_pass http://backend:4000` 中的 `backend` 是 docker-compose 里的服务名，Docker 内部 DNS 自动解析
- 前端 API 请求用**相对路径** `"/api"` 而非绝对路径 `"http://localhost:4000/api"`，这样才能走 nginx 代理

### 5. `backend/src/index.js` — CORS 配置

```js
app.use(cors({
  origin: [
    'http://localhost:5173',        // 本地开发
    'http://localhost:9999',        // 本地 Docker
    'https://你的域名:端口',         // 线上 HTTPS
  ],
  credentials: true,
}))
```

**踩坑记录**：
- 只写 `http://localhost:5173` → 部署后前端请求被 CORS 拦截
- 必须把线上 HTTPS 地址加进去

---

## 三、新增项目部署步骤

假设你要部署一个新项目，使用端口 `9900`。

### Step 1：准备项目文件

按上面的目录结构和模板准备文件，注意修改：
- `docker-compose.yml` 中的 `ports` → `"127.0.0.1:9900:80"`
- `backend/src/index.js` 中的 CORS `origin` 加上 `"https://aiphototo.com:9900"`
- `frontend/nginx.conf` 中的 `proxy_pass` 端口与后端一致

### Step 2：上传并启动容器

```bash
cd ~/项目目录
docker compose up -d --build
```

验证容器正常运行：

```bash
docker ps                              # 确认容器 Up，没有 Restarting
docker compose logs backend --tail 20  # 检查后端有没有报错
curl -I http://127.0.0.1:9900          # 确认前端可访问
```

### Step 3：宿主机 Nginx 添加 HTTPS 配置

```bash
sudo tee -a /etc/nginx/conf.d/aiphototo.conf << 'EOF'

server {
    listen 9900 ssl;
    server_name aiphototo.com www.aiphototo.com;

    ssl_certificate /etc/nginx/ssl/aiphototo/aiphototo.com.crt;
    ssl_certificate_key /etc/nginx/ssl/aiphototo/aiphototo.com.key;
    ssl_protocols TLSv1.2 TLSv1.3;
    ssl_ciphers HIGH:!aNULL:!MD5;

    location / {
        proxy_pass http://127.0.0.1:9900;
        proxy_http_version 1.1;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
        proxy_read_timeout 600;
    }
}
EOF
```

> ⚠️ 如果用 `sudo sh -c 'cat > ... << EOF'` 写入，注意末尾可能会多出 `EOF` 字符，需要手动删除。

### Step 4：重载 Nginx

```bash
sudo nginx -t && sudo systemctl reload nginx
```

如果报 `bind() failed (98: Address already in use)`，说明端口被占用：

```bash
sudo lsof -i :端口号    # 查看谁占了端口
# 解决占用后重新 reload
sudo systemctl reload nginx
```

### Step 5：腾讯云安全组放行

腾讯云控制台 → 安全组 → 入站规则 → 添加：`TCP 端口号 允许`

### Step 6：验证

访问 `https://aiphototo.com:9900`，确认：
- [ ] 页面正常加载
- [ ] API 接口正常（登录等功能）
- [ ] 麦克风等需要安全上下文的功能正常

---

## 四、常见问题排查

### 前端 502 Bad Gateway

**原因**：后端容器没启动，nginx 代理到后端时无响应。

```bash
docker ps                              # 看 backend 是否在 Restarting
docker compose logs backend --tail 50  # 查看崩溃原因
```

常见崩溃原因：
| 报错 | 原因 | 解决 |
|---|---|---|
| `Could not parse schema engine response` | Alpine 缺 OpenSSL | Dockerfile 加 `apk add openssl libc6-compat` |
| `prisma db push` 失败导致容器退出 | CMD 用 `&&` 连接 | 改用 `\|\| true;` 隔离 |

### 麦克风/摄像头报 `Cannot read properties of undefined`

**原因**：`navigator.mediaDevices` 只在安全上下文（HTTPS 或 localhost）下可用。

**解决**：必须通过 `https://` 访问，不能是 `http://IP:端口`。

### CORS 拦截

**原因**：后端 `cors()` 的 `origin` 没有包含线上域名。

**解决**：在 `origin` 数组中添加 `"https://你的域名:端口"`。

### Nginx `bind() failed (98: Address already in use)`

**原因**：端口被其他进程占用（可能是之前的容器或旧 Nginx 配置）。

```bash
sudo lsof -i :端口号    # 查找占用进程
# 杀掉或停止占用进程后重新 reload
```

### 容器 `Restarting` 循环

```bash
# 查看退出原因
docker compose logs 服务名 --tail 50

# 进入容器调试（如果容器还能短暂运行）
docker compose exec 服务名 sh

# 手动运行 CMD 调试
docker compose run --rm 服务名 sh -c "npx prisma db push; node src/index.js"
```

---

## 五、端口规划参考

当前已用端口：

| 端口 | 服务 | 协议 |
|---|---|---|
| 443 | ai-platform 主站 | HTTPS |
| 5174 | ai-platform-frontend | HTTP |
| 5175 | ai-platform-ai-app | HTTP |
| 5176 | ai-platform-web-portal | HTTP |
| 7777 | bage-blog | HTTP |
| 8989 | java-platform | HTTP |
| 3021 | wechat-to-md | HTTP |
| 3000 | excel-compare | HTTP |
| 8090 | excel-data-combine | HTTP |
| 9999 | 韩语学习 App | HTTPS |

新项目建议从 `10000` 开始递增分配，避免冲突。
