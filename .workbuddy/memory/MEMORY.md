# campus-cycle 项目长期记录

## 协作方式（用户明确要求，2026-11-15）
- **动手前先确认**：改代码 / 改文档 / 装依赖 / 跑 migrate·seed / 启停服务 / git 提交或推送 / 删改文件，都要先说明「改什么、为什么、风险」，得到同意后再做。
- 只读操作（Read、Grep、跑测试看结果、查端口）无需请示。
- 一次确认只覆盖当次说明的范围，范围变了重新问。

## 项目要点（避免重复踩坑）
- 缺 `SESSION_SECRET` 会拒绝启动；`.env.local` 用一行 `node -e` 生成 48 字节随机密钥，幂等。
- `migrate` / `seed` 脚本不读 `.env.local`，靠 `DATABASE_PATH` 环境变量指定库文件。
- 演示账号密码统一 `596777`（seed 里的 PASSWORD 常量）；`admin` 是唯一管理员。
- 构建前若 `next build` 清 `.next` 被 safe-delete 守卫拦下，先把 `.next` `mv` 到 /tmp 再构建。
- 项目是单文件 SQLite + 进程内向量检索，不能直接上 Vercel/Netlify；公网预览走 cloudflared 或 VPS。
- 无 API Key 时的降级行为与启动步骤写在 README，改动后要同步更新。
