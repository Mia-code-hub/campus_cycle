import Database from 'better-sqlite3';
import { mkdirSync, readFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';

const root = process.cwd();
const dbPath = resolve(root, process.env.DATABASE_PATH ?? './data/campus.db');
mkdirSync(dirname(dbPath), { recursive: true });

const schema = readFileSync(resolve(root, 'src/server/schema.sql'), 'utf8');

const db = new Database(dbPath);
db.pragma('journal_mode = WAL');
db.exec(schema);

// schema.sql 用的是 CREATE TABLE IF NOT EXISTS，老库不会自动多出新列。
// 这里按 PRAGMA 检查后补列，保证「已有数据的库」和「新建的库」结构一致。
function ensureColumn(table: string, column: string, ddl: string) {
  const cols = db.prepare(`PRAGMA table_info(${table})`).all() as { name: string }[];
  if (cols.some((c) => c.name === column)) return;
  db.exec(`ALTER TABLE ${table} ADD COLUMN ${ddl}`);
  console.log(`[migrate] 补列 ${table}.${column}`);
}
ensureColumn('users', 'letter_anonymous', 'letter_anonymous INTEGER NOT NULL DEFAULT 1');
ensureColumn('letters', 'source', "source TEXT NOT NULL DEFAULT 'ai'");
// 向量来源模型：换 embedding 模型后旧向量不能和新向量比余弦，靠这一列判定失效
ensureColumn('items', 'embedding_model', 'embedding_model TEXT');
// 收款码（收款码支付模式）：平台只撮合不碰钱
ensureColumn('users', 'wechat_qr', 'wechat_qr TEXT');
ensureColumn('users', 'alipay_qr', 'alipay_qr TEXT');

const rows = db
  .prepare(
    "SELECT name FROM sqlite_master WHERE type='table' AND name NOT LIKE 'sqlite_%' ORDER BY name",
  )
  .all() as { name: string }[];
const indexes = db
  .prepare("SELECT name FROM sqlite_master WHERE type='index' AND name LIKE 'idx_%' ORDER BY name")
  .all() as { name: string }[];
db.close();

console.log(`[migrate] 数据库 ${dbPath}`);
console.log(`[migrate] ${rows.length} 张表：${rows.map((r) => r.name).join(', ')}`);
console.log(`[migrate] ${indexes.length} 个索引：${indexes.map((r) => r.name).join(', ')}`);
