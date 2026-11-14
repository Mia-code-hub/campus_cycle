# 校园闲置物资循环 AI 平台

面向本校学生的公益向闲置流转 Web 应用：毕业季教材、被褥、文具、小家电在校内循环，支持**低价转售**与**公益捐赠给困难新生**双通道。AI 负责发布提效（识图 + 文案 + 估价）、供需语义匹配、违规审核与感谢信生成，后台提供环保数据看板。

技术栈：Next.js 15 (App Router) + TypeScript + Tailwind CSS + SQLite (better-sqlite3) + 阿里百炼 DashScope（qwen-vl-max / qwen-plus / text-embedding-v3）+ ECharts。

## 文档索引

| 文件 | 内容 |
|---|---|
| [docs/01-PRD.md](docs/01-PRD.md) | 需求、痛点、功能清单、非功能要求、验收标准、里程碑 |
| [docs/02-页面流程.md](docs/02-页面流程.md) | 站点地图、三条用户旅程、页面结构与视觉规范 |
| [docs/03-数据库设计.md](docs/03-数据库设计.md) | ER 关系、9 张表字段、状态机、环保折算系数 |
| [docs/04-AI接口契约.md](docs/04-AI接口契约.md) | 5 个 AI 接口的输入输出、降级策略、Prompt 设计要点 |
| [docs/ai-prompt-history.md](docs/ai-prompt-history.md) | **Prompt 历史快照**（脚本生成）：按功能分组的调用次数 / 成功率 / 平均耗时，附 prompt 与响应原文 |
| [prompts/](prompts/) | 分轮次开发提示词脚本 R1–R22 + 修 bug 引导话术 |

## 快速开始（骨架完成后生效）

```bash
npm install
cp .env.example .env.local     # 填入 DASHSCOPE_API_KEY
npm run migrate && npm run seed
npm run dev                    # http://localhost:3000
```

## 开发约定

- 一个功能一次提交，提交信息前缀 `feat:` / `fix:` / `chore:` / `docs:`，并标注对应的提示词轮次（如 `R10`）。
- 每次 AI 调用的 prompt 原文与模型响应写入 `ai_call_logs` 表，通过 `node scripts/export-prompts.mjs` 导出为 Prompt 历史快照。
- API Key 只在服务端读取，`.env.local` 与 `data/*.db` 不入库。

## 如何导出 AI 协同过程证据

比赛要看的是「AI 到底参与了多少、prompt 是怎么一轮轮改出来的」。这些证据不用手工整理，四个入口都能查：

| 入口 | 用途 |
|---|---|
| `/admin/ai-logs`（管理员登录） | 在线查看：按功能 / 状态筛选，展开看 prompt 原文、响应原文、解析结果 |
| `GET /api/admin/ai-logs/export?format=json` | 结构化导出，含按功能聚合的 stats 与全部原文；加 `&feature=analyze` 只导一个功能 |
| `GET /api/admin/ai-logs/export?format=csv` | 表格导出（UTF-8 BOM，Excel / WPS 双击可开），12 列含 prompt_text / response_text |
| `npm run export:prompts` | 生成 [docs/ai-prompt-history.md](docs/ai-prompt-history.md)：按功能分节，每节统计调用次数、成功率、平均耗时，附 prompt 演进与修复记录 |

数据来源只有一张表 `ai_call_logs`：每次调用（含失败与重试）都落一条，`status` 区分 `ok / timeout / parse_error / api_error`。

```bash
# 1. 跑一遍发布 / 搜索 / 审核 / 感谢信，让四条链路都留下真实调用
npm run dev

# 2. 生成提交用的快照文档（可重复执行，git diff 就是这一版 prompt 改了什么）
npm run export:prompts                       # 默认每个功能挑 5 条代表性记录
npm run export:prompts -- --all              # 全部明细都展开
npm run export:prompts -- --feature letter   # 只导一个功能
```

几条口径，答辩时可能被追问：

- **失败记录不删**。超时、欠费、解析失败的原始记录都留着，它们正是「降级不是口号」的证据。
- **平均耗时只统计成功调用**。失败大多在百毫秒内返回，混进均值会把数字算得虚低。
- **prompt 里的图片是占位说明**。识图调用的 prompt 落库前会把 dataURL 换成「[图片 dataURL，约 xxxKB，已省略]」，其余部分逐字保留，避免单条记录几 MB。

## 演示账号

密码统一为 `123456`（`npm run seed` 后生效）：

| 账号 | 角色 | 说明 |
|---|---|---|
| `admin` | 管理员 | 审核帮扶资格、违规复核、数据看板 |
| `grad1` / `grad2` / `grad3` | 毕业生 | 发布转售与捐赠物品 |
| `fresh1` | 新生（帮扶生） | 已通过帮扶资格审核，公益专区优先 |
| `fresh2` / `fresh3` | 新生 | 普通新生 |

## 当前进度

- [x] 阶段 1：需求文档包、数据库设计、AI 接口契约、分轮提示词脚本
- [x] 阶段 2：基础业务（R1–R8）
- [x] 阶段 3：AI 能力（R9–R15）—— 调用底座、识图文案、估价、向量检索、违规审核、感谢信、留痕导出
- [ ] 阶段 4：数据看板（R16–R18）
- [ ] 阶段 5：联调与打磨（R19–R22）

报名与省赛作品提交截止：**2026-11-18**。
