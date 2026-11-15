-- 校园闲置物资循环 AI 平台 · SQLite 表结构
-- 唯一事实来源：docs/03-数据库设计.md。改字段先改文档，再改本文件。

CREATE TABLE IF NOT EXISTS users (
  id              INTEGER PRIMARY KEY AUTOINCREMENT,
  username        TEXT    NOT NULL UNIQUE,
  password_hash   TEXT    NOT NULL,
  salt            TEXT    NOT NULL,
  nickname        TEXT    NOT NULL,
  college         TEXT,
  grade           TEXT,
  role            TEXT    NOT NULL DEFAULT 'user' CHECK (role IN ('user','admin')),
  is_aid_approved INTEGER NOT NULL DEFAULT 0 CHECK (is_aid_approved IN (0,1,2,3)),
  -- 感谢信署名偏好：默认匿名，只有本人主动开启才会在信中署昵称
  letter_anonymous INTEGER NOT NULL DEFAULT 1 CHECK (letter_anonymous IN (0,1)),
  -- 收款码：平台只做撮合不碰钱，买家扫物主本人的码直接转账
  wechat_qr TEXT,
  alipay_qr TEXT,
  created_at      TEXT    NOT NULL DEFAULT (datetime('now','localtime'))
);

-- 会话表：令牌里的 jti 在这里有唯一一行，删/改这一行即刻让令牌失效。
-- 没有这张表时，「退出登录」只是删掉浏览器 cookie，偷走的令牌照样能用。
CREATE TABLE IF NOT EXISTS sessions (
  jti        TEXT    PRIMARY KEY,
  user_id    INTEGER NOT NULL,
  created_at TEXT    NOT NULL DEFAULT (datetime('now','localtime')),
  expires_at INTEGER NOT NULL,
  revoked_at TEXT,
  user_agent TEXT,
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS idx_sessions_user ON sessions(user_id);
CREATE INDEX IF NOT EXISTS idx_sessions_exp  ON sessions(expires_at);

-- 上传归属：文件名本身不含身份信息，靠这张表记「谁传的、用在哪件物品上」。
-- 没有它，任何登录用户都能把别人的图片挂到自己发布的物品上（盗图、栽赃）。
CREATE TABLE IF NOT EXISTS uploads (
  path         TEXT    PRIMARY KEY,
  user_id      INTEGER NOT NULL,
  created_at   TEXT    NOT NULL DEFAULT (datetime('now','localtime')),
  used_item_id INTEGER,
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS idx_uploads_user ON uploads(user_id, created_at);

CREATE TABLE IF NOT EXISTS items (
  id               INTEGER PRIMARY KEY AUTOINCREMENT,
  owner_id         INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  title            TEXT    NOT NULL,
  raw_desc         TEXT,
  ai_desc          TEXT,
  category         TEXT    NOT NULL CHECK (category IN
                     ('textbook','bedding','stationery','appliance','daily','clothing','other')),
  condition_level  TEXT    CHECK (condition_level IN ('95新','9成新','8成新','可用')),
  mode             TEXT    NOT NULL CHECK (mode IN ('sale','donate')),
  price            REAL    NOT NULL DEFAULT 0,
  ai_price_low     REAL,
  ai_price_high    REAL,
  ai_tags          TEXT,
  ai_edited        INTEGER NOT NULL DEFAULT 0 CHECK (ai_edited IN (0,1,2)),
  image_path       TEXT,
  donate_tag       TEXT,
  status           TEXT    NOT NULL DEFAULT 'listed' CHECK (status IN
                     ('listed','reserved','completed','removed')),
  violation_flag   INTEGER NOT NULL DEFAULT 0 CHECK (violation_flag IN (0,1,2)),
  violation_reason TEXT,
  embedding        BLOB,
  embedded_at      TEXT,
  embedding_model  TEXT,
  view_count       INTEGER NOT NULL DEFAULT 0,
  created_at       TEXT    NOT NULL DEFAULT (datetime('now','localtime'))
);
CREATE INDEX IF NOT EXISTS idx_items_category ON items(category, mode);
CREATE INDEX IF NOT EXISTS idx_items_owner    ON items(owner_id);
CREATE INDEX IF NOT EXISTS idx_items_status   ON items(status);

CREATE TABLE IF NOT EXISTS favorites (
  user_id    INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  item_id    INTEGER NOT NULL REFERENCES items(id) ON DELETE CASCADE,
  created_at TEXT    NOT NULL DEFAULT (datetime('now','localtime')),
  PRIMARY KEY (user_id, item_id)
);

CREATE TABLE IF NOT EXISTS applications (
  id           INTEGER PRIMARY KEY AUTOINCREMENT,
  item_id      INTEGER NOT NULL REFERENCES items(id) ON DELETE CASCADE,
  applicant_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  reason       TEXT,
  status       TEXT    NOT NULL DEFAULT 'pending' CHECK (status IN
                 ('pending','approved','rejected','completed','cancelled')),
  created_at   TEXT    NOT NULL DEFAULT (datetime('now','localtime')),
  updated_at   TEXT    NOT NULL DEFAULT (datetime('now','localtime'))
);
CREATE INDEX IF NOT EXISTS idx_app_item ON applications(item_id, status);

CREATE TABLE IF NOT EXISTS donations (
  id              INTEGER PRIMARY KEY AUTOINCREMENT,
  application_id  INTEGER REFERENCES applications(id) ON DELETE SET NULL,
  item_id         INTEGER NOT NULL REFERENCES items(id) ON DELETE CASCADE,
  donor_id        INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  receiver_id     INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  green_weight_kg REAL    NOT NULL DEFAULT 0,
  donated_at      TEXT    NOT NULL DEFAULT (datetime('now','localtime'))
);
CREATE INDEX IF NOT EXISTS idx_donations_donor ON donations(donor_id);

CREATE TABLE IF NOT EXISTS letters (
  id                  INTEGER PRIMARY KEY AUTOINCREMENT,
  donation_id         INTEGER NOT NULL UNIQUE REFERENCES donations(id) ON DELETE CASCADE,
  content             TEXT    NOT NULL,
  receiver_anonymous  INTEGER NOT NULL DEFAULT 1,
  -- 生成来源：ai=模型生成；template=模型不可用时按平台模板兜底（可后续升级为 ai）
  source              TEXT    NOT NULL DEFAULT 'ai' CHECK (source IN ('ai','template')),
  issued_at           TEXT    NOT NULL DEFAULT (datetime('now','localtime'))
);

CREATE TABLE IF NOT EXISTS messages (
  id           INTEGER PRIMARY KEY AUTOINCREMENT,
  item_id      INTEGER NOT NULL REFERENCES items(id) ON DELETE CASCADE,
  from_user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  to_user_id   INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  content      TEXT    NOT NULL,
  read_flag    INTEGER NOT NULL DEFAULT 0,
  created_at   TEXT    NOT NULL DEFAULT (datetime('now','localtime'))
);
CREATE INDEX IF NOT EXISTS idx_msg_pair ON messages(item_id, from_user_id, to_user_id);

CREATE TABLE IF NOT EXISTS aid_applications (
  id           INTEGER PRIMARY KEY AUTOINCREMENT,
  user_id      INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  reason       TEXT    NOT NULL,
  proof_note   TEXT,
  status       TEXT    NOT NULL DEFAULT 'pending' CHECK (status IN ('pending','approved','rejected')),
  reviewed_by  INTEGER REFERENCES users(id) ON DELETE SET NULL,
  created_at   TEXT    NOT NULL DEFAULT (datetime('now','localtime')),
  reviewed_at  TEXT
);

-- 环保报告：正文 + 生成时的数据快照 + 校验结果。
-- 校验不通过的记录也留在表里（verify_status='fail'），但页面只展示 pass 的正文——
-- 「不通过就不展示」要实现成一条写进数据的规则，而不是页面上的一个 if。
CREATE TABLE IF NOT EXISTS reports (
  id            INTEGER PRIMARY KEY AUTOINCREMENT,
  title         TEXT    NOT NULL,
  content       TEXT    NOT NULL,
  model         TEXT    NOT NULL,
  months        INTEGER NOT NULL DEFAULT 6,
  char_count    INTEGER NOT NULL DEFAULT 0,
  verify_status TEXT    NOT NULL CHECK (verify_status IN ('pass','fail')),
  verify_json   TEXT,
  -- 生成时用的数据快照：报告页的图与数字表都读它，不读实时数据
  snapshot_json TEXT    NOT NULL,
  -- 送进 prompt 的数据原文，也是数字白名单的来源，留档便于逐字复核
  payload_text  TEXT    NOT NULL,
  created_by    INTEGER REFERENCES users(id) ON DELETE SET NULL,
  created_at    TEXT    NOT NULL DEFAULT (datetime('now','localtime'))
);
CREATE INDEX IF NOT EXISTS idx_reports_created ON reports(created_at);

-- AI 调用留痕：比赛要交的「Prompt 历史快照」直接来自这张表
CREATE TABLE IF NOT EXISTS ai_call_logs (
  id            INTEGER PRIMARY KEY AUTOINCREMENT,
  feature       TEXT    NOT NULL CHECK (feature IN
                  ('analyze','search','moderate','letter','report','embed','health')),
  model         TEXT    NOT NULL,
  user_id       INTEGER REFERENCES users(id) ON DELETE SET NULL,
  ref_item_id   INTEGER REFERENCES items(id) ON DELETE SET NULL,
  prompt_text   TEXT    NOT NULL,
  response_text TEXT    NOT NULL,
  parsed_result TEXT,
  latency_ms    INTEGER,
  status        TEXT    NOT NULL DEFAULT 'ok' CHECK (status IN
                  ('ok','timeout','parse_error','api_error')),
  created_at    TEXT    NOT NULL DEFAULT (datetime('now','localtime'))
);
CREATE INDEX IF NOT EXISTS idx_ai_logs_feature ON ai_call_logs(feature, created_at);

-- 支付通道（收款码模式）：一笔出售申领最多一条支付记录。
-- 钱在买家与物主之间直接流转，这张表只做信用台账——谁选了什么方式、
-- 买家何时声明已转账、物主何时确认收款，全部有据可查。
CREATE TABLE IF NOT EXISTS payments (
  id              INTEGER PRIMARY KEY AUTOINCREMENT,
  application_id  INTEGER NOT NULL UNIQUE REFERENCES applications(id) ON DELETE CASCADE,
  method          TEXT    NOT NULL CHECK (method IN ('wechat','alipay')),
  amount          REAL    NOT NULL CHECK (amount > 0),
  status          TEXT    NOT NULL DEFAULT 'pending' CHECK (status IN ('pending','paid','confirmed')),
  created_at      TEXT    NOT NULL DEFAULT (datetime('now','localtime')),
  paid_at         TEXT,
  confirmed_at    TEXT
);
CREATE INDEX IF NOT EXISTS idx_payments_status ON payments(status, created_at);
