# 韩语学习应用

基于 AI 的韩语口语练习应用，支持语音对话、智能纠错、艾宾浩斯词汇复习。

## 功能

- **语音对话练习** — 麦克风说话，AI 用韩语回复并自动朗读，支持语音循环模式
- **智能纠错** — AI 实时检测语法错误并给出修正和解释
- **话题练习** — 餐厅点餐、购物、问路、自我介绍等场景
- **词汇本** — 对话中点击单词查词典并保存，支持删除
- **艾宾浩斯复习** — SM-2 算法计算复习间隔，闪卡模式四档评分（又忘了/模糊/记得/很熟）
- **对话历史** — 保存所有对话记录，支持单条和批量删除

## 技术栈

| 层级 | 技术 |
|------|------|
| 前端 | React 18 · React Router · Tailwind CSS · Vite |
| 后端 | Node.js · Express · Prisma ORM |
| 数据库 | SQLite |
| 对话 AI | DeepSeek（兼容 OpenAI API） |
| 语音 | Azure Cognitive Services Speech SDK |
| 认证 | JWT + bcrypt |

## 快速开始

### 1. 克隆项目

```bash
git clone <your-repo-url>
cd korean-app
```

### 2. 配置环境变量

```bash
cp backend/.env.example backend/.env
```

编辑 `backend/.env`，填入你的 API Key：

```
PORT=4000
JWT_SECRET=自定义一个随机字符串

DEEPSEEK_API_KEY=你的 DeepSeek API Key
DEEPSEEK_BASE_URL=https://api.deepseek.com

AZURE_SPEECH_KEY=你的 Azure Speech Key
AZURE_SPEECH_REGION=你的 Azure 区域（如 koreacentral）
```

### 3. 安装依赖

```bash
npm run install:all
```

### 4. 初始化数据库

```bash
npm run setup
```

### 5. 启动开发服务

```bash
npm run dev
```

- 前端：http://localhost:5173
- 后端：http://localhost:4000

## API Key 获取

**DeepSeek**
- 注册：https://platform.deepseek.com
- 费用：按 token 计费，价格较低

**Azure Speech**
- 注册：https://azure.microsoft.com
- 创建「语音服务」资源，复制密钥和区域
- 免费额度：每月 5 小时语音识别 + 50 万字符语音合成

## 项目结构

```
korean-app/
├── frontend/               # React 前端
│   └── src/
│       ├── pages/          # 页面（Conversation / Vocabulary / Errors）
│       ├── components/     # 组件（ChatMessage / DictionaryPopup / Layout）
│       ├── hooks/          # useVoice（语音）· useAuth（认证）
│       └── services/       # api.js（Axios 封装）
├── backend/                # Express 后端
│   ├── src/
│   │   ├── routes/         # conversation · vocabulary · speech · auth · errors
│   │   └── middleware/     # JWT 认证中间件
│   └── prisma/
│       └── schema.prisma   # 数据库结构
└── package.json            # 根目录脚本
```
