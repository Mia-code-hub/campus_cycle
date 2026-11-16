# 校园闲置物资循环 AI 平台

面向高校的闲置物资循环 Web 应用：毕业季教材、被褥、小家电在校内流转，支持**低价转售**与**公益捐赠给困难新生**双通道。AI 负责拍照发布（识图 + 文案 + 估价）、供需语义匹配、违规审核、感谢信生成；管理端提供环保数据看板与经数字校验的 AI 环保报告；内置微信 / 支付宝双通道收款码支付。

**技术栈**：Next.js 16 (App Router, TypeScript) + Tailwind CSS 4 + SQLite (better-sqlite3) + 阿里百炼 DashScope（多模态 / 文本 / Embedding）+ ECharts。228 项自动化测试全绿。

---

## 十分钟从零跑起来

### Windows PowerShell 版（五步）

```powershell
# 1. 克隆并安装依赖（Node 20+）
git clone https://github.com/Mia-code-hub/campus_cycle.git
cd campus_cycle
npm install

# 2. 生成密钥并写入 .env.local（已有 API Key 就一并填上）
node -e "const c=require('crypto');const fs=require('fs');const k=c.randomBytes(48).toString('base64');const t=fs.existsSync('.env.local')?fs.readFileSync('.env.local','utf8'):'';if(!/SESSION_SECRET=/.test(t))fs.writeFileSync('.env.local','SESSION_SECRET='+k+'\n',{flag:'a'})"

# 3. 初始化数据库（迁移 + 演示数据）
$env:DATABASE_PATH="./data/campus.db"; npm run migrate; npm run seed

# 4. 构建
npm run build

# 5. 启动
npm start
```

### macOS / Linux 版（五步）

```bash
# 1. 克隆并安装依赖（Node 20+）
git clone https://github.com/Mia-code-hub/campus_cycle.git
cd campus_cycle
npm install

# 2. 生成密钥并写入 .env.local（已有 API Key 就一并填上）
node -e "const c=require('crypto');const fs=require('fs');const k=c.randomBytes(48).toString('base64');const t=fs.existsSync('.env.local')?fs.readFileSync('.env.local','utf8'):'';if(!/SESSION_SECRET=/.test(t))fs.writeFileSync('.env.local','SESSION_SECRET='+k+'\n',{flag:'a'})"

# 3. 初始化数据库（迁移 + 演示数据）
export DATABASE_PATH=./data/campus.db && npm run migrate && npm run seed

# 4. 构建
npm run build

# 5. 启动
npm start
```

打开 <http://localhost:3000> 即可。开发模式热更新用 `npm run dev`（同样先做第 2、3 步）。

**注意**
- 缺 `SESSION_SECRET` 服务会拒绝启动（而不是悄悄用弱密钥签名会话），第 2 步就是干这个的。
- `migrate` / `seed` 脚本不读 `.env.local`，靠 `DATABASE_PATH` 环境变量指定库文件（默认 `./data/campus.db`），所以第 3 步要显式设置。
- API Key 在 [阿里百炼控制台](https://bailian.console.aliyun.com/) 创建，填入 `.env.local` 的 `DASHSCOPE_API_KEY=` 后重启服务生效。

### 演示账号

密码统一 `123456`（seed 生成，常量见 `src/server/seed.mts`）：

| 账号 | 角色 | 用途 |
|---|---|---|
| `admin` | 管理员 | 环保看板、帮扶资格审核、违规复核、AI 留痕、环保报告、捐赠台账 |
| `grad1` | 毕业班卖家 | 已配微信/支付宝双通道收款码，有一笔「已同意待支付」申领可演示支付闭环 |
| `grad2` / `grad3` | 毕业班卖家 | 演示发布物品（VLM 拍照识图） |
| `fresh1` | 新生（已认证帮扶） | 公益申领置顶、帮扶生优先徽章 |
| `fresh2` | 新生（未认证） | 语义搜索、帮扶资格申请流程 |
| `fresh3` | 新生 | 申领了 grad1 的四级词汇书，停在待支付——演示买家支付 |

## 没有 API Key 能干什么

系统按「AI 挂了不能阻塞业务」设计，所有 AI 能力都有降级路径，无 Key 时平台**完整可用**，只是少了智能部分：

| 功能 | 无 API Key 时 |
|---|---|
| 注册 / 登录 / 发布 / 申领 / 收藏 / 私信 | ✅ 正常 |
| 微信 / 支付宝收款码支付流程 | ✅ 正常（支付本身不依赖 AI） |
| 帮扶资格申请与审核、公益置顶 | ✅ 正常 |
| 搜索 | ✅ 退回 2-gram 关键词召回，页面标注「语义检索暂不可用」 |
| 发布识图（VLM 自动填文案/估价） | ⚠️ 降级为纯文本描述生成；再失败则手填，发布流程不中断 |
| 发布前审核 | ⚠️ 退回本地词表判定（词表始终在跑，模型是加强项） |
| AI 导购推荐语 / 感谢信 / AI 环保报告 | ❌ 需要 Key（调用失败会明确提示，不留脏数据） |

每次调用（含失败）都写入 `ai_call_logs` 留痕表，管理端 `/admin/ai-logs` 可筛选、可导出——失败记录不删，这正是「降级不是口号」的证据。

## 架构取舍：为什么是 SQLite + 进程内向量检索

**选型**：单文件 SQLite（better-sqlite3 同步驱动）+ 进程内向量余弦相似度检索，不引入向量数据库、Redis、独立后端服务。

| 考量 | 说明 |
|---|---|
| 部署零依赖 | 评委 `npm install` 完就有一个能跑的全功能系统，无需装 PostgreSQL / Milvus / Docker，十分钟跑通的硬前提 |
| 数据规模匹配 | 校园场景物品量级在千~万件，1024 维向量全量扫一遍在毫秒级，专用向量库的收益要到十万级以上才显现 |
| 事务一致性 | 业务表、向量、支付状态同库同事务，不存在「向量库写成功但业务回滚」的分布式一致性问题 |
| 迁移简单 | `ensureColumn` 增量迁移模式，改表结构加列即可，老库无缝升级 |
| 代价（明知的） | 单机单进程、不能水平扩展、不能上 Vercel/Netlify 等 Serverless 平台（见「已知限制」） |

Embedding 向量存在 `items` 表内，`items.embedding_model` 记录向量来源；换 embedding 模型后旧向量自动判定失效，管理员可一键重算（本项目 29 件约 4.5 秒）。

## 目录树

```
campus_cycle/
├── src/
│   ├── app/                    # 路由（App Router）
│   │   ├── page.tsx            # 首页
│   │   ├── publish/            # 发布（VLM 识图辅助）
│   │   ├── search/             # 语义找物
│   │   ├── items/[id]/         # 物品详情
│   │   ├── donate/             # 公益专区
│   │   ├── me/                 # 个人中心（申领/发布/帮扶认证/收款码）
│   │   ├── letters/            # 感谢信
│   │   ├── admin/              # 管理端：看板/帮扶审核/违规复核/AI留痕/环保报告/捐赠台账
│   │   └── api/                # REST 接口（auth/items/applications/payments/ai/...）
│   ├── server/                 # 服务端层（不进客户端 bundle）
│   │   ├── db.ts / schema.sql / migrate.mts / seed.mts
│   │   ├── auth.ts             # 会话（HMAC 令牌 + 过期 + 吊销 + 登录限流）
│   │   ├── retrieval.ts        # 进程内向量检索 + 关键词召回
│   │   ├── moderation.ts       # 审核：本地词表 + 模型双路
│   │   ├── payments.ts         # 收款码支付状态机（pending/paid/confirmed）
│   │   └── stats.ts / reports.ts / ai-logs.ts ...
│   ├── components/             # UI（layout / ui 基础件 / charts / 业务组件）
│   └── lib/                    # ai 客户端、图表主题、工具函数
├── tests/                      # 228 项自动化测试（node --test）
├── docs/                       # PRD/页面流程/数据库设计/AI契约/安全复查/截图
├── prompts/                    # 分轮开发提示词 R1–R22
└── scripts/                    # prompt 历史导出等脚本
```

## 已知限制

1. **部署形态受限**：单文件 SQLite + 进程内向量检索决定了必须以常驻进程运行（VPS / 自有服务器 / 本地），不能直接部署到 Vercel、Netlify 等 Serverless 平台；公网预览需自建隧道（如 cloudflared）或使用 VPS。
2. **支付是收款码模式**：个人无商户资质，平台不接单不碰钱——买家扫物主本人的微信/支付宝收款码线下转账，物主在平台确认收款后交割；平台只做状态记账，不提供退款担保。
3. **环保折算是估算**：减碳量按 2.1 kgCO₂e/kg 的参考系数折算，非实测；所有口径在 `/api/stats/overview` 的 `caliber` 字段公开可查。
4. **管理员单账号**：`admin` 是唯一管理员，无多管理员与角色权限细分。
5. **换 embedding 模型需重算向量**：向量空间不兼容，检索只认同当前模型的向量（有自动检测 + 一键重算，见上节）。
6. **并发能力有限**：单进程 + 同步 SQLite 读写，适合校园演示与中小规模使用，高并发场景需要换数据库与独立检索服务。

## 更多文档

| 文件 | 内容 |
|---|---|
| [docs/01-PRD.md](docs/01-PRD.md) | 需求、功能清单、非功能要求、验收标准 |
| [docs/02-页面流程.md](docs/02-页面流程.md) | 站点地图、用户旅程、页面结构与视觉规范 |
| [docs/03-数据库设计.md](docs/03-数据库设计.md) | ER 关系、表字段、状态机、环保折算系数 |
| [docs/04-AI接口契约.md](docs/04-AI接口契约.md) | AI 接口的输入输出、降级策略、Prompt 设计 |
| [docs/05-安全复查.md](docs/05-安全复查.md) | 全仓安全复查：越权、SQL、上传、会话、AI 限流 |
| [docs/06-Prompt链-核心功能迭代.md](docs/06-Prompt链-核心功能迭代.md) | **三个核心功能的完整 Prompt 链**：需求原文 → AI 方案 → Bug 排查修复全过程 |

## 验证

```bash
npm test        # 228 项自动化测试
npm run lint    # ESLint
npm run build   # 生产构建（TypeScript 零错误）
```
