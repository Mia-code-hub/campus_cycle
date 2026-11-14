import Database from 'better-sqlite3';
import { mkdirSync, writeFileSync } from 'node:fs';
import { join, resolve } from 'node:path';
import { hashPassword } from './password.ts';
import { greenWeightKg } from '../lib/green-factors.ts';

const root = process.cwd();
const dbPath = resolve(root, process.env.DATABASE_PATH ?? './data/campus.db');
const db = new Database(dbPath);
db.pragma('journal_mode = WAL');

const PASSWORD = '123456';

// ---- 1. 清空业务表（幂等）----
db.transaction(() => {
  for (const t of [
    'letters',
    'donations',
    'messages',
    'favorites',
    'applications',
    'aid_applications',
    'items',
    'users',
  ]) {
    db.prepare(`DELETE FROM ${t}`).run();
  }
})();

// ---- 2. 生成 8 张渐变 SVG 占位图 ----
const SVG_CONFIGS = [
  { name: 'seed-1', from: '#f7b2bd', to: '#c7ceea', label: '教材' },
  { name: 'seed-2', from: '#a8d8ea', to: '#c7ceea', label: '被褥' },
  { name: 'seed-3', from: '#f7b2bd', to: '#a8d8ea', label: '文具' },
  { name: 'seed-4', from: '#c7ceea', to: '#fdf6f0', label: '小家电' },
  { name: 'seed-5', from: '#ffd8c8', to: '#fdf6f0', label: '日用品' },
  { name: 'seed-6', from: '#c8e8d8', to: '#fdf6f0', label: '衣物' },
  { name: 'seed-7', from: '#ddd0f0', to: '#fdf6f0', label: '其他' },
  { name: 'seed-8', from: '#a8d8ea', to: '#fdf6f0', label: '校园闲置' },
];
const uploadsDir = join(root, 'public', 'uploads');
mkdirSync(uploadsDir, { recursive: true });
for (const c of SVG_CONFIGS) {
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="400" height="300" viewBox="0 0 400 300"><defs><linearGradient id="g" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="${c.from}"/><stop offset="1" stop-color="${c.to}"/></linearGradient></defs><rect width="400" height="300" fill="url(#g)"/><text x="200" y="160" font-family="sans-serif" font-size="30" fill="#4a4a55" text-anchor="middle">${c.label}</text></svg>`;
  writeFileSync(join(uploadsDir, `${c.name}.svg`), svg);
}

// ---- 3. 插入用户 ----
const USERS = [
  { username: 'admin', nickname: '管理员', college: '校务处', grade: null, role: 'admin', is_aid: 0 },
  { username: 'grad1', nickname: '学长小林', college: '计算机学院', grade: '毕业班', role: 'user', is_aid: 0 },
  { username: 'grad2', nickname: '学长阿凯', college: '外国语学院', grade: '毕业班', role: 'user', is_aid: 0 },
  { username: 'grad3', nickname: '学姐小雅', college: '经济学院', grade: '毕业班', role: 'user', is_aid: 0 },
  { username: 'fresh1', nickname: '帮扶生小周', college: '计算机学院', grade: '2026级', role: 'user', is_aid: 1 },
  { username: 'fresh2', nickname: '新生小陈', college: '外国语学院', grade: '2026级', role: 'user', is_aid: 0 },
  { username: 'fresh3', nickname: '新生小李', college: '经济学院', grade: '2026级', role: 'user', is_aid: 0 },
];
const userId: Record<string, number> = {};
{
  const insertUser = db.prepare(
    'INSERT INTO users (username, password_hash, salt, nickname, college, grade, role, is_aid_approved) VALUES (?, ?, ?, ?, ?, ?, ?, ?)',
  );
  for (const u of USERS) {
    const stored = hashPassword(PASSWORD);
    const info = insertUser.run(
      u.username,
      stored,
      stored.split(':')[0],
      u.nickname,
      u.college,
      u.grade,
      u.role,
      u.is_aid,
    );
    userId[u.username] = Number(info.lastInsertRowid);
  }
}

// ---- 4. 插入物品 ----
interface SeedItem {
  owner: string;
  title: string;
  category: string;
  condition: string;
  mode: 'sale' | 'donate';
  price: number;
  status: 'listed' | 'reserved' | 'completed';
  applicant?: string; // completed/reserved 时的申领人
}
const ITEMS: SeedItem[] = [
  { owner: 'grad1', title: '高等数学（同济版）上下册', category: 'textbook', condition: '9成新', mode: 'sale', price: 15, status: 'listed' },
  { owner: 'grad1', title: '大学英语四级词汇书', category: 'textbook', condition: '8成新', mode: 'sale', price: 5, status: 'listed' },
  { owner: 'grad1', title: '数据结构（C语言版）', category: 'textbook', condition: '95新', mode: 'sale', price: 12, status: 'listed' },
  { owner: 'grad1', title: '冬季棉被 2 斤', category: 'bedding', condition: '可用', mode: 'donate', price: 0, status: 'listed' },
  { owner: 'grad1', title: '护眼台灯', category: 'appliance', condition: '9成新', mode: 'sale', price: 18, status: 'listed' },
  { owner: 'grad1', title: '收纳盒三件套', category: 'daily', condition: '可用', mode: 'donate', price: 0, status: 'completed', applicant: 'fresh2' },
  { owner: 'grad1', title: '篮球', category: 'other', condition: '8成新', mode: 'sale', price: 20, status: 'listed' },
  { owner: 'grad1', title: '折叠书桌', category: 'other', condition: '可用', mode: 'donate', price: 0, status: 'listed' },
  { owner: 'grad2', title: '线性代数教材', category: 'textbook', condition: '9成新', mode: 'sale', price: 10, status: 'listed' },
  { owner: 'grad2', title: '概率论与数理统计', category: 'textbook', condition: '8成新', mode: 'sale', price: 8, status: 'listed' },
  { owner: 'grad2', title: '宿舍床垫', category: 'bedding', condition: '可用', mode: 'donate', price: 0, status: 'completed', applicant: 'fresh1' },
  { owner: 'grad2', title: '电热水壶', category: 'appliance', condition: '9成新', mode: 'sale', price: 25, status: 'listed' },
  { owner: 'grad2', title: '笔记本（未用）10 本', category: 'stationery', condition: '95新', mode: 'donate', price: 0, status: 'listed' },
  { owner: 'grad2', title: '羽绒服（男款 L）', category: 'clothing', condition: '9成新', mode: 'donate', price: 0, status: 'reserved', applicant: 'fresh1' },
  { owner: 'grad2', title: '吉他', category: 'other', condition: '8成新', mode: 'sale', price: 60, status: 'listed' },
  { owner: 'grad2', title: '衣架 20 个', category: 'daily', condition: '可用', mode: 'sale', price: 3, status: 'completed', applicant: 'fresh3' },
  { owner: 'grad3', title: '电路原理教材', category: 'textbook', condition: '9成新', mode: 'sale', price: 11, status: 'listed' },
  { owner: 'grad3', title: '枕头一对', category: 'bedding', condition: '可用', mode: 'donate', price: 0, status: 'listed' },
  { owner: 'grad3', title: '小电风扇', category: 'appliance', condition: '9成新', mode: 'sale', price: 22, status: 'completed', applicant: 'fresh2' },
  { owner: 'grad3', title: '文件夹 + 笔记本套装', category: 'stationery', condition: '95新', mode: 'sale', price: 6, status: 'listed' },
  { owner: 'grad3', title: '卫衣（女款 M）', category: 'clothing', condition: '9成新', mode: 'sale', price: 15, status: 'listed' },
  { owner: 'grad3', title: '脸盆 + 水桶', category: 'daily', condition: '可用', mode: 'donate', price: 0, status: 'completed', applicant: 'fresh3' },
  { owner: 'grad3', title: '行李箱（24 寸）', category: 'other', condition: '8成新', mode: 'sale', price: 40, status: 'listed' },
  { owner: 'grad3', title: '吹风机', category: 'appliance', condition: '9成新', mode: 'donate', price: 0, status: 'completed', applicant: 'fresh1' },
];

const itemId: Record<string, number> = {};
const itemMeta: Record<string, { ownerId: number; category: string; mode: string }> = {};
{
  const insertItem = db.prepare(
    'INSERT INTO items (owner_id, title, raw_desc, category, condition_level, mode, price, image_path, status) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)',
  );
  ITEMS.forEach((it, i) => {
    const imagePath = `/uploads/${SVG_CONFIGS[i % SVG_CONFIGS.length].name}.svg`;
    const info = insertItem.run(
      userId[it.owner],
      it.title,
      it.title,
      it.category,
      it.condition,
      it.mode,
      it.price,
      imagePath,
      it.status,
    );
    itemId[it.title] = Number(info.lastInsertRowid);
    itemMeta[it.title] = { ownerId: userId[it.owner], category: it.category, mode: it.mode };
  });
}

// ---- 5. 申领单 + 捐赠台账 + 收藏 + 消息 ----
{
  const insertApp = db.prepare(
    'INSERT INTO applications (item_id, applicant_id, reason, status) VALUES (?, ?, ?, ?)',
  );
  const insertDonation = db.prepare(
    'INSERT INTO donations (application_id, item_id, donor_id, receiver_id, green_weight_kg) VALUES (?, ?, ?, ?, ?)',
  );
  for (const it of ITEMS) {
    if (!it.applicant) continue;
    const appStatus = it.status === 'completed' ? 'completed' : 'approved';
    const appInfo = insertApp.run(itemId[it.title], userId[it.applicant], '种子数据申领', appStatus);
    if (it.mode === 'donate' && it.status === 'completed') {
      insertDonation.run(
        Number(appInfo.lastInsertRowid),
        itemId[it.title],
        itemMeta[it.title].ownerId,
        userId[it.applicant],
        greenWeightKg(it.category),
      );
    }
  }

  // 收藏：帮扶生收藏几件捐赠物品
  const insertFav = db.prepare('INSERT INTO favorites (user_id, item_id) VALUES (?, ?)');
  for (const t of ['冬季棉被 2 斤', '折叠书桌', '笔记本（未用）10 本', '枕头一对']) {
    insertFav.run(userId['fresh1'], itemId[t]);
  }

  // 消息：羽绒服（reserved）下 grad2 ↔ fresh1
  const insertMsg = db.prepare(
    'INSERT INTO messages (item_id, from_user_id, to_user_id, content) VALUES (?, ?, ?, ?)',
  );
  const coatId = itemId['羽绒服（男款 L）'];
  insertMsg.run(coatId, userId['grad2'], userId['fresh1'], '羽绒服可以周末来取，我在南门等你');
  insertMsg.run(coatId, userId['fresh1'], userId['grad2'], '好的学长，谢谢！');
}

const itemCount = (db.prepare('SELECT count(*) AS c FROM items').get() as { c: number }).c;
const userCount = (db.prepare('SELECT count(*) AS c FROM users').get() as { c: number }).c;
const donationCount = (db.prepare('SELECT count(*) AS c FROM donations').get() as { c: number }).c;
db.close();

console.log(`[seed] 完成：${userCount} 个账号、${itemCount} 件物品、${donationCount} 条捐赠记录`);
console.log('[seed] 演示账号密码统一为：123456');
