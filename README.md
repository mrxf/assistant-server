# assistant-server

小满 · 生活助理 AI 服务端 — 基于 [@innerlife/agent](https://www.npmjs.com/package/@innerlife/agent) 框架。

「小满」是一个中文生活助理，擅长育儿、家庭事务与生活科普，能准确清晰地回答问题，并具备情绪与长期记忆能力。支持多 Player 完全隔离：每个 Player 拥有独立的 Agent 实例、对话历史、记忆、情绪和关系状态。核心接入能力为**微信扫码绑定**，绑定后可直接在微信中与小满对话。

## 快速启动

```bash
# 1. 安装依赖
pnpm install

# 2. 配置环境变量
cp .env.example .env
# 编辑 .env 填入你的 LLM API Key

# 3. 初始化数据库
pnpm prisma:push

# 4. 启动开发服务器
pnpm dev
```

服务运行在 `http://localhost:4000`，Swagger 文档在 `http://localhost:4000/api/docs`。

## 基本使用流程

```bash
# 1. 创建 Player
curl -X POST http://localhost:4000/players \
  -H 'Content-Type: application/json' \
  -d '{"id": "zhangsan", "nickname": "张三"}'

# 2. 发送消息
curl -X POST http://localhost:4000/player/zhangsan/chat/send \
  -H 'Content-Type: application/json' \
  -d '{"content": "宝宝半夜总醒，有什么办法吗？"}'

# 3. 查看对话历史
curl http://localhost:4000/player/zhangsan/chat/history

# 4. 查看助理状态（情绪 / 关系）
curl http://localhost:4000/player/zhangsan/npc/status
```

## 微信扫码接入

绑定走 SSE：`POST /player/:playerId/wechat/bind` 会先推 `qr`（二维码），用户扫码后推 `bound`（或 `error`）。绑定成功后，微信侧的消息会自动归到对应 Player，由小满反应式回复。

```bash
# 发起绑定（SSE：qr → bound/error）
curl -N -X POST http://localhost:4000/player/zhangsan/wechat/bind

# 解绑某个微信身份
curl -X DELETE http://localhost:4000/player/zhangsan/wechat/<peerId>
```

## 项目结构

```
src/
├── config/            # 环境配置
├── prisma/            # 数据库服务
├── agent/             # Innerlife Agent 集成（核心）
│   ├── stores/        # Per-player 数据存储
│   ├── persona/       # 人设加载（共享）
│   ├── worldbook/     # 知识库加载（共享，目前为空占位）
│   ├── emotion/       # 情绪持久化
│   └── relationship/  # 关系持久化
├── channel/           # @innerlife/channel 的 AccountStorage（Prisma 后端）
├── wechat/            # 微信渠道接入（绑定 + 收发 + outbox）
├── chat/              # 对话 API（SSE 流式）
├── events/            # 事件上报（触发主动消息）
├── messages/          # 主动消息
├── player/            # Player CRUD + 档案
├── npc/               # 助理状态查询（情绪 / 关系）
└── debug/             # 调试接口

data/
├── persona/           # 小满人设 (xiaoman.yaml)
└── worldbook/         # 知识库 (YAML，目前为空占位，可自行填充)
```

## API 概览

### 全局端点

| 端点 | 方法 | 说明 |
|------|------|------|
| `/players` | POST | 创建 Player |
| `/players` | GET | 列出所有 Player |
| `/players/:playerId` | DELETE | 删除 Player 及所有数据 |
| `/debug/reset-all` | POST | 重置所有数据 |
| `/debug/test-llm` | POST | 测试 LLM 连接 |

### Per-Player 端点（`/player/:playerId/...`）

| 端点 | 方法 | 说明 |
|------|------|------|
| `.../chat/send` | POST | 发消息，SSE 流式返回 |
| `.../chat/history` | GET | 游标分页对话历史 |
| `.../wechat/bind` | POST | 扫码绑定微信（SSE：qr → bound/error）|
| `.../wechat/:peerId` | DELETE | 解绑某个微信身份 |
| `.../events` | POST | 上报事件，触发主动消息 |
| `.../messages/pending` | GET | 未读主动消息 |
| `.../messages/:id/read` | POST | 标记已读 |
| `.../profile` | GET/PUT | 用户档案 |
| `.../npc/status` | GET | 小满情绪 / 关系状态 |
| `.../debug/memory` | GET | 查看记忆 |
| `.../debug/emotion` | GET | 查看情绪 |
| `.../debug/relationship` | GET | 查看关系 |
| `.../debug/worldbook` | GET | 查看知识库 |
| `.../debug/reset` | POST | 重置该 Player 数据 |

## 多 Player 隔离

每个 Player 创建后拥有完全独立的：
- 小满 Agent 实例（含独立 baseMood）
- 对话历史
- 长期记忆（语义 + 情节）
- 情绪状态
- 关系值
- 主动消息队列

所有 Player 共享同一套人设（Persona）和知识库（WorldBook）。

## 技术栈

- NestJS + TypeScript
- SQLite + Prisma
- @innerlife/agent（npm 包）
- @innerlife/channel + @innerlife/channel-weixin（微信渠道）
- SSE 流式响应
